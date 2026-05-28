"""
Data harvesting from NBA/MLB/NFL stats APIs and Kalshi prediction market API.
All harvesters use asyncio + aiohttp for non-blocking I/O where possible.
"""
import asyncio
import base64
import logging
import os
import re
import time
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'

# Module-level price history for velocity computation across scan cycles.
# Maps ticker → yes_price from the previous scan.
_price_history: dict[str, float] = {}

# Rolling volume history for spike detection (8 cycles × 5 min = 40 min window)
_volume_history: dict[str, deque] = {}
_VOLUME_SPIKE_WINDOW = 8
_VOLUME_SPIKE_MULT = 5.0

# Kalshi series ticker → (sport, internal stat column)
# Only series with individual player prop markets (not parlays)
PROP_SERIES = {
    # NBA single stats
    'KXNBAPTS': ('NBA', 'PTS'),
    'KXNBAREB': ('NBA', 'REB'),
    'KXNBAAST': ('NBA', 'AST'),
    'KXNBASTL': ('NBA', 'STL'),
    'KXNBABLK': ('NBA', 'BLK'),
    'KXNBA3PT': ('NBA', 'FG3M'),
    'KXNBAPLAYOFFPTS': ('NBA', 'PTS'),
    # NBA combo stats
    'KXNBAPA': ('NBA', 'PA'),
    'KXNBAPR': ('NBA', 'PR'),
    'KXNBAPRA': ('NBA', 'PRA'),
    'KXNBARA': ('NBA', 'RA'),
    # MLB single stats
    'KXMLBHIT': ('MLB', 'H'),
    'KXMLBHR': ('MLB', 'HR'),
    'KXMLBRBI': ('MLB', 'RBI'),
    'KXMLBKS': ('MLB', 'SO'),
    # MLB combo stats
    'KXMLBTB': ('MLB', 'TB'),
    'KXMLBHRR': ('MLB', 'HRR'),
}

# Pattern: "Player Name: X+" at start of Kalshi prop market title
_PROP_TITLE_RE = re.compile(r'^(.+?):\s+(\d+(?:\.\d+)?)\+', re.IGNORECASE)


@dataclass
class MarketSnapshot:
    event_id: str
    ticker: str
    title: str
    yes_price: float
    no_price: float
    implied_probability: float
    volume: int
    open_interest: int
    sport: str = 'OTHER'
    player_name: Optional[str] = None
    team: Optional[str] = None
    stat: Optional[str] = None
    line: Optional[float] = None
    direction: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_trade_time: Optional[datetime] = None
    volume_24h: int = 0
    spread: float = 0.0       # yes_ask - yes_bid at snapshot time
    price_delta: float = 0.0  # yes_price change since previous scan cycle
    volume_spike: bool = False  # True if volume_24h > 5× rolling average


@dataclass
class PlayerStats:
    player_id: int
    player_name: str
    team: str
    games: list  # list of dicts with sport-specific stat columns
    position: str = ''
    is_b2b: bool = False  # NBA: player's team played yesterday (today is second night)


class BaseHarvester(ABC):
    def __init__(self):
        self._backoff = 1.0

    @abstractmethod
    async def fetch(self, session: aiohttp.ClientSession) -> list:
        pass

    def _reset_backoff(self):
        self._backoff = 1.0

    def _increase_backoff(self):
        self._backoff = min(self._backoff * 2, 60.0)

    async def _get_with_retry(self, session, url, headers=None, params=None, max_retries=3):
        for attempt in range(max_retries):
            try:
                async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status == 429:
                        wait = self._backoff
                        logger.warning('Rate limited on %s — backing off %.1fs', url, wait)
                        self._increase_backoff()
                        await asyncio.sleep(wait)
                        continue
                    if resp.status >= 500:
                        wait = self._backoff
                        self._increase_backoff()
                        await asyncio.sleep(wait)
                        continue
                    self._reset_backoff()
                    return await resp.json()
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                wait = self._backoff
                logger.warning('Request failed (%s): %s — retry in %.1fs', url, e, wait)
                self._increase_backoff()
                if attempt < max_retries - 1:
                    await asyncio.sleep(wait)
        return None


class KalshiHarvester(BaseHarvester):
    """Polls Kalshi REST API for open sports markets every scan cycle."""

    def __init__(self):
        super().__init__()
        self.key_id = os.getenv('KALSHI_KEY_ID', '')
        self._private_key = None
        self._load_private_key()

    def _load_private_key(self):
        from cryptography.hazmat.primitives import serialization
        pem_path = os.getenv('KALSHI_PRIVATE_KEY_PATH', '')
        if not pem_path:
            candidates = [
                os.path.join(os.path.dirname(__file__), '..', 'kalshi_key.pem'),
                os.path.join(os.path.dirname(__file__), 'kalshi_key.pem'),
            ]
            for c in candidates:
                if os.path.exists(c):
                    pem_path = c
                    break
        if not pem_path or not os.path.exists(pem_path):
            return
        try:
            with open(pem_path, 'rb') as f:
                self._private_key = serialization.load_pem_private_key(f.read(), password=None)
            logger.info('KalshiHarvester: loaded RSA private key from %s', pem_path)
        except Exception as e:
            logger.warning('KalshiHarvester: failed to load private key: %s', e)

    def _auth_headers(self, method='GET', path=''):
        if not self._private_key or not self.key_id:
            return {}
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        ts = str(int(time.time() * 1000))
        msg = (ts + method + path).encode()
        sig = self._private_key.sign(
            msg,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
        )
        return {
            'Kalshi-Access-Key': self.key_id,
            'Kalshi-Access-Timestamp': ts,
            'Kalshi-Access-Signature': base64.b64encode(sig).decode(),
        }

    def _detect_sport(self, ticker: str, title: str) -> str:
        combined = (ticker + ' ' + (title or '')).upper()
        for sport, keywords in _SPORT_KEYS.items():
            if any(k in combined for k in keywords):
                return sport
        # SPORTS MULTIGAME EXTENDED with "PLAYER: X+" pattern → likely MLB
        if 'SPORTSMULTIGAMEEXTENDED' in combined and ': ' in (title or ''):
            return 'MLB'
        return 'OTHER'

    def _parse_player_prop(self, market: dict, sport: str) -> tuple:
        title = market.get('title', '') or ''
        subtitle = market.get('subtitle', '') or ''
        combined = f'{title} {subtitle}'.upper()

        if sport == 'NBA':
            patterns = [
                r'(.+?)\s+(OVER|UNDER)\s+(\d+\.?\d*)\s+(PTS|REB|AST|STL|BLK|3PM|TOV)',
                r'(.+?)\s+(PTS|REB|AST|STL|BLK|3PM|TOV)\s+(OVER|UNDER)\s+(\d+\.?\d*)',
            ]
            for pat in patterns:
                m = re.search(pat, combined)
                if m:
                    groups = m.groups()
                    if groups[1] in ('OVER', 'UNDER'):
                        player_raw, direction, line_str, stat_raw = groups
                    else:
                        player_raw, stat_raw, direction, line_str = groups
                    stat = STAT_MAP.get(stat_raw, stat_raw)
                    try:
                        return player_raw.strip().title(), stat, float(line_str), direction
                    except ValueError:
                        continue

        elif sport == 'MLB':
            # Standard prop: "PLAYER OVER/UNDER X STAT"
            patterns = [
                r'(.+?)\s+(OVER|UNDER)\s+(\d+\.?\d*)\s+(H|HR|RBI|SO|K|SB|ER)',
                r'(.+?)\s+(H|HR|RBI|SO|K|SB|ER)\s+(OVER|UNDER)\s+(\d+\.?\d*)',
            ]
            for pat in patterns:
                m = re.search(pat, combined)
                if m:
                    groups = m.groups()
                    if groups[1] in ('OVER', 'UNDER'):
                        player_raw, direction, line_str, stat_raw = groups
                    else:
                        player_raw, stat_raw, direction, line_str = groups
                    stat = STAT_MAP.get(stat_raw, stat_raw)
                    try:
                        return player_raw.strip().title(), stat, float(line_str), direction
                    except ValueError:
                        continue

            # Parlay format: "yes Player Name: X+, yes ..."
            # Extract the first player; "X+" → OVER (X - 0.5) hits
            parlay = re.search(r'(?:yes\s+)?([A-Za-z][A-Za-z\s\.\'-]{2,30}):\s*(\d+)\+', title, re.IGNORECASE)
            if parlay:
                player_raw = parlay.group(1).strip().title()
                line = float(parlay.group(2)) - 0.5  # "1+" → OVER 0.5
                return player_raw, 'H', line, 'OVER'

        elif sport == 'NFL':
            patterns = [
                r'(.+?)\s+(OVER|UNDER)\s+(\d+\.?\d*)\s+(PASS|RUSH|REC|TD)',
                r'(.+?)\s+(PASSYDS|RUSHYDS|RECYDS|TD)\s+(OVER|UNDER)\s+(\d+\.?\d*)',
            ]
            for pat in patterns:
                m = re.search(pat, combined)
                if m:
                    groups = m.groups()
                    if groups[1] in ('OVER', 'UNDER'):
                        player_raw, direction, line_str, stat_raw = groups
                    else:
                        player_raw, stat_raw, direction, line_str = groups
                    stat = STAT_MAP.get(stat_raw, stat_raw)
                    try:
                        return player_raw.strip().title(), stat, float(line_str), direction
                    except ValueError:
                        continue

        return None, None, None, None

    async def fetch(self, session: aiohttp.ClientSession) -> list[MarketSnapshot]:
        """Fetch player prop markets from known Kalshi sports series."""
        path = '/trade-api/v2/markets'
        snapshots = []

        for series_ticker, (sport, stat) in PROP_SERIES.items():
            cursor = None
            while True:
                params = {'status': 'open', 'limit': 100, 'series_ticker': series_ticker}
                if cursor:
                    params['cursor'] = cursor

                data = await self._get_with_retry(
                    session,
                    f'{KALSHI_BASE}/markets',
                    headers=self._auth_headers('GET', path),
                    params=params,
                )
                if not data:
                    break

                markets = data.get('markets', []) if isinstance(data, dict) else []
                cursor = data.get('cursor') if isinstance(data, dict) else None

                for mkt in markets:
                    ticker = mkt.get('ticker', '')
                    if not ticker:
                        continue

                    title = mkt.get('title', '') or ''
                    m = _PROP_TITLE_RE.match(title)
                    if not m:
                        continue

                    player_name = m.group(1).strip()
                    try:
                        threshold = float(m.group(2))
                    except ValueError:
                        continue

                    # "X+" title → player needs ≥X; equivalent to OVER X-0.5 line
                    line = threshold - 0.5

                    # Price: prefer last traded price, then tight-spread midpoint
                    yes_bid = float(mkt.get('yes_bid_dollars') or 0)
                    yes_ask = float(mkt.get('yes_ask_dollars') or 0)
                    last = float(mkt.get('last_price_dollars') or 0)
                    spread = (yes_ask - yes_bid) if (yes_bid > 0 and yes_ask > 0) else 0.30

                    if last > 0:
                        yes_mid = last
                    elif yes_bid > 0 and yes_ask > 0 and spread <= 0.30:
                        yes_mid = (yes_bid + yes_ask) / 2
                    else:
                        continue  # skip markets without meaningful price discovery

                    # Price velocity: compare to previous scan
                    prev_price = _price_history.get(ticker, yes_mid)
                    price_delta = yes_mid - prev_price
                    _price_history[ticker] = yes_mid

                    # Parse last trade timestamp — try several possible field names
                    last_trade_time = None
                    for ts_field in ('last_trade_time', 'last_updated', 'updated_at', 'last_price_time'):
                        raw_ts = mkt.get(ts_field)
                        if raw_ts:
                            try:
                                last_trade_time = datetime.fromisoformat(raw_ts.replace('Z', '+00:00'))
                            except (ValueError, AttributeError):
                                pass
                            break

                    volume_24h = int(mkt.get('volume_24h', 0) or 0)

                    # Volume spike: flag if current volume > 5× rolling 40-min average
                    vol_hist = _volume_history.setdefault(ticker, deque(maxlen=_VOLUME_SPIKE_WINDOW))
                    vol_avg = sum(vol_hist) / len(vol_hist) if vol_hist else 0
                    volume_spike = bool(volume_24h > 0 and vol_avg > 0 and volume_24h > vol_avg * _VOLUME_SPIKE_MULT)
                    vol_hist.append(volume_24h)

                    snapshots.append(MarketSnapshot(
                        event_id=ticker,  # ticker is unique per threshold level
                        ticker=ticker,
                        title=title,
                        yes_price=yes_mid,
                        no_price=1.0 - yes_mid,
                        implied_probability=yes_mid,
                        volume=int(mkt.get('volume', 0) or 0),
                        open_interest=int(mkt.get('open_interest', 0) or 0),
                        sport=sport,
                        player_name=player_name,
                        stat=stat,
                        line=line,
                        direction='OVER',  # all Kalshi props are "X+" = OVER
                        last_trade_time=last_trade_time,
                        volume_24h=volume_24h,
                        spread=spread,
                        price_delta=price_delta,
                        volume_spike=volume_spike,
                    ))

                if not cursor:
                    break

        logger.info('KalshiHarvester: fetched %d prop markets from %d series',
                    len(snapshots), len(PROP_SERIES))
        return snapshots


class NBAHarvester(BaseHarvester):
    """Fetches NBA player game logs via nba_api (sync wrapped in executor)."""

    def __init__(self):
        super().__init__()
        self._cache: dict[str, tuple[float, PlayerStats]] = {}
        self._cache_ttl = 300

    def _get_current_season(self) -> str:
        now = datetime.now(timezone.utc)
        year = now.year
        start_year = year - 1 if now.month < 7 else year
        return f'{start_year}-{str(start_year + 1)[-2:]}'

    def _fetch_player_logs_sync(self, player_id: int, season: str) -> list[dict]:
        try:
            from nba_api.stats.endpoints import playergamelogs
            logs = playergamelogs.PlayerGameLogs(
                player_id_nullable=player_id,
                season_nullable=season,
                timeout=30,
            )
            df = logs.get_data_frames()[0]
            if df.empty:
                return []
            cols = ['GAME_DATE', 'MATCHUP', 'WL', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FG3M']
            available = [c for c in cols if c in df.columns]
            return df[available].head(40).to_dict('records')  # up to 40 games
        except Exception as e:
            logger.warning('nba_api fetch failed for player %s: %s', player_id, e)
            return []

    def _find_player_id_sync(self, player_name: str) -> tuple:
        try:
            from nba_api.stats.static import players
            active = players.get_active_players()
            name_lower = player_name.lower()
            matched = None
            for p in active:
                if p['full_name'].lower() == name_lower:
                    matched = p
                    break
            if not matched:
                for p in active:
                    if name_lower in p['full_name'].lower() or p['full_name'].lower() in name_lower:
                        matched = p
                        break
            if not matched:
                last_name = name_lower.split()[-1] if name_lower.split() else name_lower
                for p in active:
                    if p['last_name'].lower() == last_name:
                        matched = p
                        break
            if not matched:
                return None, player_name, ''
            player_id = matched['id']
            full_name = matched['full_name']
            position = ''
            try:
                from nba_api.stats.endpoints import commonplayerinfo
                info = commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=10)
                df = info.get_data_frames()[0]
                if not df.empty:
                    position = str(df['POSITION'].iloc[0]).strip()
            except Exception:
                pass
            return player_id, full_name, position
        except Exception as e:
            logger.warning('NBA player lookup failed for %s: %s', player_name, e)
            return None, player_name, ''

    def _check_back_to_back(self, games: list[dict]) -> bool:
        """True if the player's most recent logged game was yesterday — today is B2B night."""
        if not games:
            return False
        from datetime import timedelta
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        raw = str(games[0].get('GAME_DATE', ''))[:10]
        try:
            return datetime.strptime(raw, '%Y-%m-%d').date() == yesterday
        except ValueError:
            return False

    async def fetch_player_stats(self, player_name: str) -> Optional[PlayerStats]:
        now = time.time()
        cached = self._cache.get(player_name)
        if cached and now - cached[0] < self._cache_ttl:
            return cached[1]

        loop = asyncio.get_event_loop()
        player_id, full_name, position = await loop.run_in_executor(None, self._find_player_id_sync, player_name)
        if not player_id:
            return None

        season = self._get_current_season()
        games = await loop.run_in_executor(None, self._fetch_player_logs_sync, player_id, season)
        if not games:
            return None

        team = ''
        if games and 'MATCHUP' in games[0]:
            team = games[0]['MATCHUP'].split(' ')[0]

        is_b2b = self._check_back_to_back(games)
        result = PlayerStats(player_id=player_id, player_name=full_name, team=team, games=games, position=position, is_b2b=is_b2b)
        self._cache[player_name] = (now, result)
        return result

    async def fetch(self, session: aiohttp.ClientSession) -> list:
        return []


class MLBHarvester(BaseHarvester):
    """Fetches MLB player game logs via mlb-statsapi (sync wrapped in executor)."""

    def __init__(self):
        super().__init__()
        self._cache: dict[str, tuple[float, PlayerStats]] = {}
        self._cache_ttl = 300

    def _lookup_player_sync(self, player_name: str) -> tuple:
        try:
            import statsapi
            results = statsapi.lookup_player(player_name)
            if not results:
                return None, player_name, '', ''
            p = results[0]
            position = p.get('primaryPosition', {}).get('abbreviation', '') if isinstance(p.get('primaryPosition'), dict) else ''
            # Get team abbreviation via team endpoint
            team = ''
            current_team = p.get('currentTeam', {})
            team_id = current_team.get('id') if isinstance(current_team, dict) else None
            if team_id:
                try:
                    team_data = statsapi.get('team', {'teamId': team_id})
                    teams = team_data.get('teams', [])
                    if teams:
                        team = teams[0].get('abbreviation', '') or teams[0].get('teamCode', '')
                except Exception:
                    pass
            return p['id'], p['fullName'], position, team
        except Exception as e:
            logger.warning('MLB player lookup failed for %s: %s', player_name, e)
            return None, player_name, '', ''

    def _fetch_game_log_sync(self, player_id: int, position: str) -> list[dict]:
        try:
            import statsapi
            from datetime import datetime
            is_pitcher = position == 'P'
            group = 'pitching' if is_pitcher else 'hitting'
            season = datetime.now().year
            # Use raw API so we get the 'date' field that player_stat_data strips
            raw = statsapi.get('person', {
                'personId': player_id,
                'hydrate': f'stats(group=[{group}],type=[gameLog],season={season})',
            })
            splits = (
                raw.get('people', [{}])[0]
                   .get('stats', [{}])[0]
                   .get('splits', [])
            )

            games = []
            for entry in splits[-30:]:  # last 30 games
                s = entry.get('stat', {})
                game_date = entry.get('date', '')  # "YYYY-MM-DD"
                if is_pitcher:
                    games.append({
                        '_date': game_date,
                        'SO': int(s.get('strikeOuts', 0) or 0),
                        'ER': int(s.get('earnedRuns', 0) or 0),
                        'H': int(s.get('hits', 0) or 0),
                        'BB': int(s.get('baseOnBalls', 0) or 0),
                    })
                else:
                    h = int(s.get('hits', 0) or 0)
                    hr = int(s.get('homeRuns', 0) or 0)
                    rbi = int(s.get('rbi', 0) or 0)
                    r = int(s.get('runs', 0) or 0)
                    doubles = int(s.get('doubles', 0) or 0)
                    triples = int(s.get('triples', 0) or 0)
                    tb = int(s.get('totalBases', 0) or 0)  # provided directly by API
                    games.append({
                        '_date': game_date,
                        'H': h,
                        'HR': hr,
                        'RBI': rbi,
                        'R': r,
                        'SO': int(s.get('strikeOuts', 0) or 0),
                        'SB': int(s.get('stolenBases', 0) or 0),
                        'BB': int(s.get('baseOnBalls', 0) or 0),
                        '2B': doubles,
                        '3B': triples,
                        'TB': tb,
                        'HRR': h + r + rbi,
                    })
            return games
        except Exception as e:
            logger.warning('MLB game log fetch failed for player_id %s: %s', player_id, e)
            return []

    async def fetch_player_stats(self, player_name: str) -> Optional[PlayerStats]:
        now = time.time()
        cached = self._cache.get(player_name)
        if cached and now - cached[0] < self._cache_ttl:
            return cached[1]

        loop = asyncio.get_event_loop()
        player_id, full_name, position, team = await loop.run_in_executor(None, self._lookup_player_sync, player_name)
        if not player_id:
            return None

        games = await loop.run_in_executor(None, self._fetch_game_log_sync, player_id, position)
        if not games:
            return None

        result = PlayerStats(player_id=player_id, player_name=full_name, team=team, games=games, position=position)
        self._cache[player_name] = (now, result)
        return result

    async def fetch(self, session: aiohttp.ClientSession) -> list:
        return []


class NFLHarvester(BaseHarvester):
    """NFL player stats via nfl_data_py. Primarily useful during season (Sep–Feb)."""

    def __init__(self):
        super().__init__()
        self._cache: dict[str, tuple[float, PlayerStats]] = {}
        self._cache_ttl = 600

    def _fetch_player_stats_sync(self, player_name: str) -> Optional[PlayerStats]:
        try:
            import nfl_data_py as nfl
            from datetime import datetime
            season = datetime.now().year if datetime.now().month >= 9 else datetime.now().year - 1
            weekly = nfl.import_weekly_data([season])
            if weekly is None or weekly.empty:
                return None

            name_lower = player_name.lower()
            mask = weekly['player_display_name'].str.lower().str.contains(name_lower, na=False)
            player_df = weekly[mask].tail(10)
            if player_df.empty:
                return None

            games = []
            for _, row in player_df.iterrows():
                games.append({
                    'passing_yards': float(row.get('passing_yards', 0) or 0),
                    'rushing_yards': float(row.get('rushing_yards', 0) or 0),
                    'receiving_yards': float(row.get('receiving_yards', 0) or 0),
                    'touchdowns': float((row.get('passing_tds', 0) or 0) + (row.get('rushing_tds', 0) or 0) + (row.get('receiving_tds', 0) or 0)),
                    'receptions': float(row.get('receptions', 0) or 0),
                })

            team = str(player_df.iloc[-1].get('recent_team', ''))
            return PlayerStats(player_id=0, player_name=player_name, team=team, games=games)
        except Exception as e:
            logger.warning('NFL stats fetch failed for %s: %s', player_name, e)
            return None

    async def fetch_player_stats(self, player_name: str) -> Optional[PlayerStats]:
        now = time.time()
        cached = self._cache.get(player_name)
        if cached and now - cached[0] < self._cache_ttl:
            return cached[1]

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._fetch_player_stats_sync, player_name)
        if result:
            self._cache[player_name] = (now, result)
        return result

    async def fetch(self, session: aiohttp.ClientSession) -> list:
        return []


async def run_harvest() -> tuple[list[MarketSnapshot], dict]:
    """
    Run Kalshi harvest. Returns (snapshots, harvesters_by_sport).
    harvesters_by_sport: {'NBA': NBAHarvester, 'MLB': MLBHarvester, 'NFL': NFLHarvester}
    """
    kalshi = KalshiHarvester()
    harvesters = {
        'NBA': NBAHarvester(),
        'MLB': MLBHarvester(),
        'NFL': NFLHarvester(),
    }

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        snapshots = await kalshi.fetch(session)

    return snapshots, harvesters
