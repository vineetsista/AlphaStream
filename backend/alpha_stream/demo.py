"""Demo data generator — admin-only seed signals for live demos.

Generates a realistic-looking slate of signals across NBA + MLB stars with
varied confidence, EV, streak patterns, and a handful of resolved wins/losses
so the Dashboard / Analytics / Portfolio pages all light up.

Signals are tagged with event_id prefix 'DEMO::' so they can be cleanly purged.
"""

import random
from datetime import datetime, timezone, timedelta

DEMO_EVENT_PREFIX = 'DEMO::'


# Roster designed to be instantly recognizable on stage.
_NBA_PLAYERS = [
    # (name, team, position, stat_pool)
    ('Luka Doncic',          'DAL', 'G',  ['PTS', 'AST', 'PRA', 'PR']),
    ('Jayson Tatum',         'BOS', 'F',  ['PTS', 'REB', 'PRA', 'PR']),
    ('Shai Gilgeous-Alexander', 'OKC', 'G', ['PTS', 'AST', 'PRA']),
    ('Giannis Antetokounmpo', 'MIL', 'F', ['PTS', 'REB', 'PRA', 'PR']),
    ('Nikola Jokic',         'DEN', 'C',  ['PTS', 'REB', 'AST', 'PRA']),
    ('Anthony Edwards',      'MIN', 'G',  ['PTS', '3PT', 'PA']),
    ('Stephen Curry',        'GSW', 'G',  ['PTS', '3PT', 'AST']),
    ('Devin Booker',         'PHX', 'G',  ['PTS', 'AST']),
    ('Kevin Durant',         'PHX', 'F',  ['PTS', 'REB', 'PR']),
    ('LeBron James',         'LAL', 'F',  ['PTS', 'REB', 'AST']),
    ('Trae Young',           'ATL', 'G',  ['PTS', 'AST', 'PA']),
    ('Jalen Brunson',        'NYK', 'G',  ['PTS', 'AST']),
    ('Joel Embiid',          'PHI', 'C',  ['PTS', 'REB', 'BLK']),
    ('Damian Lillard',       'MIL', 'G',  ['PTS', '3PT', 'AST']),
    ('De\'Aaron Fox',        'SAC', 'G',  ['PTS', 'AST', 'STL']),
    ('Tyrese Haliburton',    'IND', 'G',  ['PTS', 'AST', 'PA']),
    ('Donovan Mitchell',     'CLE', 'G',  ['PTS', 'AST', '3PT']),
    ('Paolo Banchero',       'ORL', 'F',  ['PTS', 'REB']),
    ('Victor Wembanyama',    'SAS', 'C',  ['PTS', 'REB', 'BLK', 'PR']),
    ('Anthony Davis',        'LAL', 'F',  ['PTS', 'REB', 'BLK']),
]

_MLB_PLAYERS = [
    ('Aaron Judge',          'NYY', 'OF', ['HIT', 'HR', 'RBI', 'TB']),
    ('Shohei Ohtani',        'LAD', 'DH', ['HIT', 'HR', 'TB', 'HRR']),
    ('Juan Soto',            'NYY', 'OF', ['HIT', 'HR', 'TB', 'RBI']),
    ('Ronald Acuna Jr.',     'ATL', 'OF', ['HIT', 'TB']),
    ('Mookie Betts',         'LAD', 'OF', ['HIT', 'RBI', 'TB']),
    ('Freddie Freeman',      'LAD', '1B', ['HIT', 'RBI']),
    ('Bobby Witt Jr.',       'KC',  'SS', ['HIT', 'TB']),
    ('Bryce Harper',         'PHI', '1B', ['HIT', 'HR', 'RBI']),
    ('Vladimir Guerrero Jr.', 'TOR', '1B', ['HIT', 'TB']),
    ('Corey Seager',         'TEX', 'SS', ['HIT', 'RBI']),
    ('Jose Ramirez',         'CLE', '3B', ['HIT', 'TB', 'HRR']),
    ('Yordan Alvarez',       'HOU', 'DH', ['HIT', 'HR', 'TB']),
    ('Kyle Tucker',          'HOU', 'OF', ['HIT', 'TB']),
    ('Gunnar Henderson',     'BAL', 'SS', ['HIT', 'RBI']),
    ('Francisco Lindor',     'NYM', 'SS', ['HIT', 'TB']),
]


_STAT_RANGES = {
    'PTS':  (18, 36), 'REB':  (5, 14),  'AST':  (4, 12), 'STL': (1, 4),
    'BLK':  (1, 3),   '3PT':  (2, 6),   'PA':   (24, 46), 'PR':  (26, 48),
    'PRA':  (32, 60), 'RA':   (8, 22),
    'HIT':  (1, 3),   'HR':   (1, 2),   'RBI':  (1, 3),   'TB':  (2, 5),
    'KS':   (5, 9),   'HRR':  (2, 5),
}


def _line_for(stat: str) -> float:
    lo, hi = _STAT_RANGES.get(stat, (10, 25))
    base = random.randint(lo, hi)
    return base - 0.5


def _kalshi_ticker(sport: str, stat: str, team: str) -> str:
    series_map = {
        ('NBA', 'PTS'): 'KXNBAPTS',  ('NBA', 'REB'): 'KXNBAREB',
        ('NBA', 'AST'): 'KXNBAAST',  ('NBA', 'STL'): 'KXNBASTL',
        ('NBA', 'BLK'): 'KXNBABLK',  ('NBA', '3PT'): 'KXNBA3PT',
        ('NBA', 'PA'):  'KXNBAPA',   ('NBA', 'PR'):  'KXNBAPR',
        ('NBA', 'PRA'): 'KXNBAPRA',  ('NBA', 'RA'):  'KXNBARA',
        ('MLB', 'HIT'): 'KXMLBHIT',  ('MLB', 'HR'):  'KXMLBHR',
        ('MLB', 'RBI'): 'KXMLBRBI',  ('MLB', 'TB'):  'KXMLBTB',
        ('MLB', 'KS'):  'KXMLBKS',   ('MLB', 'HRR'): 'KXMLBHRR',
    }
    series = series_map.get((sport, stat), 'KXNBAPTS')
    today = datetime.now(timezone.utc).strftime('%y%b%d').upper()
    opp = random.choice(['BOS', 'LAL', 'GSW', 'MIA', 'PHI', 'DEN', 'OKC', 'NYY', 'LAD', 'HOU'])
    return f'{series}-{today}{team}{opp}-T{int(random.random() * 100)}'


def _gen_signal(sport: str, player_pool: list, *, force_high_conf: bool = False,
                resolved: bool = False, won: bool = True):
    name, team, position, stats = random.choice(player_pool)
    stat = random.choice(stats)
    line = _line_for(stat)
    direction = random.choices(['OVER', 'UNDER'], weights=[0.65, 0.35])[0]

    # Confidence + EV distributions tuned to look like a real elite slate.
    if force_high_conf:
        confidence = round(random.uniform(89, 96), 1)
        ev = round(random.uniform(0.20, 0.55), 4)
    else:
        confidence = round(random.uniform(76, 92), 1)
        ev = round(random.uniform(0.08, 0.32), 4)

    market_prob = round(random.uniform(0.42, 0.62), 4)
    model_prob = round(min(0.92, market_prob + ev / 2 + random.uniform(0.05, 0.18)), 4)
    z_score = round(random.uniform(1.4, 3.6) * (1 if direction == 'OVER' else -1), 3)

    # Recommended Kelly size — varies but realistic ($25–$220 for a $5k bankroll).
    recommended_size = random.randint(2500, 22000)  # cents

    last_5 = ''.join(random.choices(['1', '0'], weights=[0.6, 0.4], k=5))
    streak_score = round(last_5.count('1') / 5, 2)

    volume_spike = random.random() < 0.18

    sig = {
        'event_id': f'{DEMO_EVENT_PREFIX}{name}-{stat}-{datetime.now(timezone.utc).timestamp():.0f}',
        'player': name, 'team': team, 'position': position,
        'stat': stat, 'line': line, 'direction': direction,
        'model_prob': model_prob, 'market_prob': market_prob,
        'z_score': z_score, 'ev': ev, 'confidence': confidence,
        'recommended_size': recommended_size,
        'kalshi_ticker': _kalshi_ticker(sport, stat, team),
        'sport': sport, 'volume_spike': volume_spike,
        'streak_score': streak_score, 'last_5_results': last_5,
        'model_mean': round(line + (1 if direction == 'OVER' else -1) * random.uniform(1.2, 3.5), 2),
        'model_std': round(random.uniform(2.5, 6.0), 2),
        'sample_size': random.randint(22, 38),
    }

    if resolved:
        sig['actual_outcome'] = direction if won else ('UNDER' if direction == 'OVER' else 'OVER')
        if won:
            odds = 1.0 / market_prob - 1.0
            sig['pnl'] = int(recommended_size * odds)
        else:
            sig['pnl'] = -recommended_size
    return sig


def generate_demo_slate(*, n_active: int = 24, n_resolved_wins: int = 14,
                        n_resolved_losses: int = 6):
    """Build the demo slate. Returns a list of dicts ready to feed the Signal model."""
    random.seed()  # fresh randomness each call
    out = []

    # 4 marquee high-confidence active signals — top of the dashboard.
    for _ in range(4):
        pool = random.choice([_NBA_PLAYERS, _MLB_PLAYERS])
        sport = 'NBA' if pool is _NBA_PLAYERS else 'MLB'
        out.append(_gen_signal(sport, pool, force_high_conf=True))

    # Rest of the active feed.
    for _ in range(max(0, n_active - 4)):
        pool = random.choice([_NBA_PLAYERS, _MLB_PLAYERS])
        sport = 'NBA' if pool is _NBA_PLAYERS else 'MLB'
        out.append(_gen_signal(sport, pool))

    # Resolved history — staggered timestamps so the PnL chart has shape.
    now = datetime.now(timezone.utc)
    for i in range(n_resolved_wins):
        pool = random.choice([_NBA_PLAYERS, _MLB_PLAYERS])
        sport = 'NBA' if pool is _NBA_PLAYERS else 'MLB'
        sig = _gen_signal(sport, pool, resolved=True, won=True)
        sig['_ts_offset_days'] = random.randint(1, 28)
        out.append(sig)
    for i in range(n_resolved_losses):
        pool = random.choice([_NBA_PLAYERS, _MLB_PLAYERS])
        sport = 'NBA' if pool is _NBA_PLAYERS else 'MLB'
        sig = _gen_signal(sport, pool, resolved=True, won=False)
        sig['_ts_offset_days'] = random.randint(1, 28)
        out.append(sig)

    return out


def seed_demo_signals(user_id: int, db_session, Signal):
    """Insert a full demo slate for the given user. Returns count inserted."""
    # Clear existing demo signals first so re-seeding is idempotent.
    clear_demo_signals(user_id, db_session, Signal)

    slate = generate_demo_slate()
    now = datetime.now(timezone.utc)

    for s in slate:
        ts_offset = s.pop('_ts_offset_days', 0)
        ts = now - timedelta(days=ts_offset, minutes=random.randint(0, 1200))
        sig = Signal(
            user_id=user_id,
            timestamp=ts,
            **s,
        )
        if s.get('actual_outcome'):
            sig.resolved_at = ts + timedelta(hours=random.randint(3, 14))
        db_session.add(sig)
    db_session.commit()
    return len(slate)


def clear_demo_signals(user_id: int, db_session, Signal):
    """Remove all demo signals for a user."""
    deleted = Signal.query.filter(
        Signal.user_id == user_id,
        Signal.event_id.like(f'{DEMO_EVENT_PREFIX}%'),
    ).delete(synchronize_session=False)
    db_session.commit()
    return deleted
