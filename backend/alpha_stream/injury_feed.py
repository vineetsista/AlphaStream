"""
Injury feed — ESPN public API for NBA/MLB active injuries.
Results cached per-sport for 5 minutes. Player names normalized to lowercase.
"""
import logging
import time
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

_CACHE_TTL = 300  # 5 minutes
_INJURY_CACHE: dict = {}

ESPN_NBA = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
ESPN_MLB = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries'

# Statuses that suppress a signal entirely
SEVERE = {'out', 'doubtful', 'suspended', 'inactive'}
# Statuses that reduce confidence
MODERATE = {'questionable', 'day-to-day', 'probable'}


async def _fetch_espn(url: str, session: aiohttp.ClientSession) -> dict[str, str]:
    """Fetch ESPN injury page → {player_name_lower: status_lower}."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return {}
            data = await resp.json()
    except Exception as e:
        logger.warning('ESPN injury fetch failed (%s): %s', url, e)
        return {}

    result = {}
    for team_entry in data.get('injuries', []):
        for injury in team_entry.get('injuries', []):
            athlete = injury.get('athlete', {})
            name = athlete.get('displayName', '').strip().lower()
            status = injury.get('status', '').strip().lower()
            if name and status:
                result[name] = status
    return result


async def refresh_injuries(sport: str) -> dict[str, str]:
    """Fetch fresh injury data for the sport and update cache. Returns injury dict."""
    url_map = {'NBA': ESPN_NBA, 'MLB': ESPN_MLB}
    url = url_map.get(sport.upper())
    if not url:
        return {}

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        data = await _fetch_espn(url, session)

    _INJURY_CACHE[sport.upper()] = {'ts': time.time(), 'data': data}
    logger.info('Injury feed: loaded %d %s injuries', len(data), sport)
    return data


async def get_injuries(sport: str) -> dict[str, str]:
    """Return cached injury dict, refreshing if stale."""
    key = sport.upper()
    cached = _INJURY_CACHE.get(key)
    if cached and time.time() - cached['ts'] < _CACHE_TTL:
        return cached['data']
    return await refresh_injuries(sport)


def get_injury_status(player_name: str, sport: str) -> Optional[str]:
    """Synchronous lookup from cache (call get_injuries() first)."""
    cached = _INJURY_CACHE.get(sport.upper(), {}).get('data', {})
    name_lower = player_name.lower()
    # Exact match first, then partial
    if name_lower in cached:
        return cached[name_lower]
    for key, status in cached.items():
        if name_lower in key or key in name_lower:
            return status
    return None


def injury_confidence_multiplier(player_name: str, sport: str) -> float:
    """
    Confidence multiplier from injury status.
    Severe (out/doubtful) → 0.0, questionable → 0.75, day-to-day → 0.85, else → 1.0.
    """
    status = get_injury_status(player_name, sport)
    if not status:
        return 1.0
    if status in SEVERE:
        return 0.0
    if status == 'questionable':
        return 0.75
    if status in ('day-to-day', 'probable'):
        return 0.88
    return 1.0
