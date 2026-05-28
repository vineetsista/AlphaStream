"""
Anomaly Detection Engine — Z-score, EV, and confidence scoring.
"""
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

MIN_GAMES = 20  # minimum game history required for reliable statistical signal

# Combo stat → component columns to sum from per-game dict
_COMBO_STATS: dict[str, tuple] = {
    'PA': ('PTS', 'AST'),
    'PR': ('PTS', 'REB'),
    'PRA': ('PTS', 'REB', 'AST'),
    'RA': ('REB', 'AST'),
}

# Component sets for correlated-signal dedup (used by callers)
STAT_COMPONENTS: dict[str, frozenset] = {
    stat: frozenset(cols) for stat, cols in _COMBO_STATS.items()
}

def _sort_games_chrono(games: list[dict]) -> list[dict]:
    """Sort games oldest→newest using whichever date field is present."""
    def _key(g):
        for f in ('GAME_DATE', '_date', 'date', 'gameDate'):
            d = g.get(f, '')
            if d:
                return str(d)
        return ''
    try:
        return sorted(games, key=_key)
    except Exception:
        return games


def compute_streak(games: list[dict], stat: str, line: float, direction: str, n: int = 5) -> dict:
    """
    Last-n games streak: did the player hit over/under on this stat vs line?
    Sorts games chronologically first. Returns results newest-first.
    """
    sorted_g = _sort_games_chrono(games)
    recent = [g for g in sorted_g if g.get(stat) is not None][-n:]
    results = []
    for g in recent:
        v = float(g.get(stat, 0) or 0)
        results.append(v > line if direction == 'OVER' else v < line)
    hits = sum(results)
    total = len(results)
    return {
        'hits': hits,
        'total': total,
        'score': round(hits / total, 2) if total else 0.5,
        'results': list(reversed(results)),  # newest-first for UI display
        'hot': hits >= 4 and total >= 4,
        'cold': hits <= 1 and total >= 4,
    }


# Half-life (hours) for staleness decay on illiquid markets
_STALENESS_HALF_LIFE: dict[str, float] = {
    'MLB': 1.5,
    'NBA': 3.0,
    'NFL': 3.0,
}
_VOLUME_SATURATION = 50  # contracts/24h — above this, staleness effect fades

# B2B confidence multiplier: star players often sit or play <30 min on second night
_B2B_CONFIDENCE_FACTOR = 0.72


def _compute_combo_stat(games: list[dict], stat: str) -> list[dict]:
    """Inject computed combo stat into each game dict if needed."""
    if stat not in _COMBO_STATS:
        return games
    components = _COMBO_STATS[stat]
    result = []
    for g in games:
        combo_val = sum(float(g.get(c, 0) or 0) for c in components)
        result.append({**g, stat: combo_val})
    return result


@dataclass
class Signal:
    event_id: str
    player: str
    team: str
    stat: str
    line: float
    model_prob: float
    market_prob: float
    z_score: float
    ev: float
    confidence: float
    direction: str         # OVER / UNDER
    recommended_size: int  # cents
    kalshi_ticker: str
    sport: str = 'NBA'
    volume_spike: bool = False
    position: str = ''
    streak_score: float = 0.5
    last_5_results: str = ''
    model_mean: float = 0.0
    model_std: float = 0.0
    sample_size: int = 0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def calc_z_score(
    games: list[dict],
    stat: str,
    current_line: float,
    weight_col: Optional[str] = None,
) -> Optional[float]:
    """
    Compute z-score of current_line relative to player's rolling stat distribution.
    When weight_col is provided (e.g. 'MIN' for NBA), each game is weighted by
    playing time so foul-out / DNP-C outliers don't distort the distribution.
    Returns None if insufficient history (< MIN_GAMES games with valid data).
    """
    values, weights = [], []
    for g in games:
        v = g.get(stat)
        if v is None:
            continue
        try:
            values.append(float(v))
            w = float(g.get(weight_col, 1.0) or 1.0) if weight_col else 1.0
            weights.append(max(0.1, w))
        except (TypeError, ValueError):
            continue

    if len(values) < MIN_GAMES:
        return None

    arr = np.array(values)

    if weight_col:
        w = np.array(weights)
        w = w / w.sum()
        mean = float(np.average(arr, weights=w))
        variance = float(np.average((arr - mean) ** 2, weights=w))
        std = math.sqrt(variance) if variance > 1e-4 else 0.0
    else:
        mean = float(arr.mean())
        std = float(arr.std(ddof=1))

    if std < 0.01:
        return 0.0

    return float((current_line - mean) / std)


def model_probability(
    games: list[dict],
    stat: str,
    line: float,
    direction: str,
    weight_col: Optional[str] = None,
) -> Optional[float]:
    """
    Estimate model probability using historical hit rate + normal approximation.
    Blends empirical hit rate with normal CDF for smooth probability.
    Supports weighted games (weight_col) for playing-time normalization.
    """
    values, weights = [], []
    for g in games:
        v = g.get(stat)
        if v is None:
            continue
        try:
            values.append(float(v))
            w = float(g.get(weight_col, 1.0) or 1.0) if weight_col else 1.0
            weights.append(max(0.1, w))
        except (TypeError, ValueError):
            continue

    if len(values) < MIN_GAMES:
        return None

    from scipy.stats import norm

    arr = np.array(values)

    if weight_col:
        w = np.array(weights)
        w = w / w.sum()
        mean = float(np.average(arr, weights=w))
        variance = float(np.average((arr - mean) ** 2, weights=w))
        std = math.sqrt(variance) if variance > 1e-4 else 0.0
        hits_weight = sum(wt for v, wt in zip(values, weights) if v > line)
        empirical_prob = hits_weight / sum(weights)
    else:
        mean = float(arr.mean())
        std = float(arr.std(ddof=1))
        hits = sum(1 for v in values if v > line)
        empirical_prob = hits / len(values)

    # Recency-weighted empirical: 3x weight on last 7 games (chronological sort)
    sorted_chrono = _sort_games_chrono(games)
    rec_vals = [float(g.get(stat, 0) or 0) for g in sorted_chrono if g.get(stat) is not None]
    tw_r, hw_r = 0.0, 0.0
    for i, v in enumerate(rec_vals):
        w_r = 3.0 if (len(rec_vals) - 1 - i) < 7 else 1.0
        tw_r += w_r
        if v > line:
            hw_r += w_r
    recency_emp = hw_r / tw_r if tw_r > 0 else empirical_prob
    # Blend 60% full-history empirical with 40% recency-weighted
    empirical_prob = 0.6 * empirical_prob + 0.4 * recency_emp

    if std < 0.01:
        normal_prob = 1.0 if mean > line else 0.0
    else:
        normal_prob = 1.0 - float(norm.cdf(line, loc=mean, scale=std))

    # Poisson model for non-negative count stats
    poisson_prob_over = None
    if all(v >= 0 for v in values) and mean > 0:
        from scipy.stats import poisson as _poisson
        poisson_prob_over = 1.0 - float(_poisson.cdf(int(line), mean))

    if poisson_prob_over is not None:
        blended = 0.4 * normal_prob + 0.3 * empirical_prob + 0.3 * poisson_prob_over
    else:
        blended = 0.6 * normal_prob + 0.4 * empirical_prob

    if direction == 'UNDER':
        return 1.0 - blended
    return blended


def poisson_probability(
    games: list[dict],
    stat: str,
    line: float,
    direction: str,
    weight_col: Optional[str] = None,
) -> Optional[float]:
    """Poisson-based probability for count-based stats."""
    from scipy.stats import poisson as _poisson

    values, weights = [], []
    for g in games:
        v = g.get(stat)
        if v is None:
            continue
        try:
            fv = float(v)
            if fv < 0:
                continue
            values.append(fv)
            w = float(g.get(weight_col, 1.0) or 1.0) if weight_col else 1.0
            weights.append(max(0.1, w))
        except (TypeError, ValueError):
            continue

    if len(values) < MIN_GAMES:
        return None

    arr = np.array(values)
    if weight_col:
        w = np.array(weights)
        w = w / w.sum()
        lam = float(np.average(arr, weights=w))
    else:
        lam = float(arr.mean())

    if lam <= 0:
        return None

    prob_over = 1.0 - float(_poisson.cdf(int(line), lam))
    return prob_over if direction == 'OVER' else 1.0 - prob_over


def model_consensus(
    games: list[dict],
    stat: str,
    line: float,
    direction: str,
    market_prob: float,
    weight_col: Optional[str] = None,
    min_edge: float = 0.02,
) -> int:
    """
    Count how many of 3 independent models (normal, empirical, Poisson) show
    model_prob > market_prob + min_edge in the given direction. Returns 0–3.
    Callers should require >= 2 for a valid signal.
    """
    from scipy.stats import norm as _norm, poisson as _poisson

    values, weights = [], []
    for g in games:
        v = g.get(stat)
        if v is None:
            continue
        try:
            values.append(float(v))
            w = float(g.get(weight_col, 1.0) or 1.0) if weight_col else 1.0
            weights.append(max(0.1, w))
        except (TypeError, ValueError):
            continue

    if len(values) < MIN_GAMES:
        return 0

    arr = np.array(values)
    if weight_col:
        w = np.array(weights)
        w = w / w.sum()
        mean = float(np.average(arr, weights=w))
    else:
        mean = float(arr.mean())
    std = float(arr.std(ddof=1))

    if std < 0.01:
        normal_over = 1.0 if mean > line else 0.0
    else:
        normal_over = 1.0 - float(_norm.cdf(line, mean, std))
    normal_p = normal_over if direction == 'OVER' else 1.0 - normal_over

    hits = sum(1 for v in values if v > line)
    empirical_over = hits / len(values)
    empirical_p = empirical_over if direction == 'OVER' else 1.0 - empirical_over

    poisson_p = None
    if all(v >= 0 for v in values) and mean > 0:
        raw_over = 1.0 - float(_poisson.cdf(int(line), mean))
        poisson_p = raw_over if direction == 'OVER' else 1.0 - raw_over

    threshold = market_prob + min_edge
    return sum([
        normal_p > threshold,
        empirical_p > threshold,
        (poisson_p or 0) > threshold if poisson_p is not None else False,
    ])


def ev_calculator(model_prob: float, market_price: float) -> float:
    """
    Expected return on investment for a YES bet at market_price.
    EV = model_prob / market_price - 1
    Positive → model says YES is underpriced (+EV to buy).
    """
    if market_price <= 0 or market_price >= 1:
        return 0.0
    return float(model_prob / market_price - 1.0)


def staleness_decay(ev: float, hours_stale: float, sport: str, volume_24h: int) -> float:
    """
    Attenuate EV exponentially based on time since last market trade, weighted by
    illiquidity. High-volume markets age slowly; low-volume markets age fast.

    vol_factor = clamp(V_SAT / volume_24h, 0, 1):
      - volume_24h == 0   → factor 1.0 (full staleness)
      - volume_24h == 50  → factor 1.0 (at threshold)
      - volume_24h == 200 → factor 0.25 (1/4 effective staleness)
    """
    if hours_stale <= 0:
        return ev
    half_life = _STALENESS_HALF_LIFE.get(sport, 3.0)
    lam = math.log(2) / half_life
    vol_factor = min(1.0, _VOLUME_SATURATION / max(volume_24h, 1))
    return ev * math.exp(-lam * hours_stale * vol_factor)


def spread_discount(ev: float, spread: float) -> float:
    """
    Discount EV by bid-ask spread width. Wide spread means the market maker is
    uncertain about fair value, making the price we observed less reliable.
    At spread=0 → no discount. At spread=0.30 (our skip threshold) → 50% discount.
    """
    if spread <= 0:
        return ev
    factor = max(0.5, 1.0 - (spread / 0.30) * 0.5)
    return ev * factor


def velocity_factor(price_delta: float, direction: str) -> float:
    """
    Confidence multiplier based on recent price movement direction.
    If the market is moving toward our signal direction, it's modest confirmation.
    If it's moving against us, apply a penalty — the market may be correcting.

    price_delta = current_yes_price - previous_scan_yes_price.
    Capped between 0.85 and 1.10 so velocity never dominates the signal.
    """
    if abs(price_delta) < 0.005:  # < 0.5 cent movement is noise
        return 1.0
    aligned = price_delta if direction == 'OVER' else -price_delta
    return max(0.85, min(1.10, 1.0 + aligned * 0.5))


def remove_correlated_signals(signals: list) -> list:
    """
    Given signals already deduped by (player, stat), further suppress cross-stat
    correlations within the same player (e.g. PTS + PRA share the PTS component).
    Greedily keeps the highest-confidence signal per player, skipping any whose
    stat components overlap with an already-selected signal.
    """
    def components(stat):
        return STAT_COMPONENTS.get(stat, frozenset({stat}))

    by_player: dict = {}
    for sig in signals:
        by_player.setdefault(sig.player, []).append(sig)

    result = []
    for player_sigs in by_player.values():
        player_sigs.sort(key=lambda s: s.confidence, reverse=True)
        selected_components: set = set()
        for sig in player_sigs:
            comps = components(sig.stat)
            if not comps & selected_components:
                result.append(sig)
                selected_components |= comps
    return result


def score_signal(z_score: float, ev: float) -> float:
    """
    Combines EV and Z-score into a 0-100 confidence score.
    EV is the primary filter; z-score amplifies confidence.
    """
    if ev <= 0.10 or ev > 1.50:  # require 10%-150% ROI; >150% likely market anomaly
        return 0.0

    z_component = min(50.0, (abs(z_score) / 3.0) * 50.0)
    ev_component = min(60.0, ev * 300.0)  # 20% EV → 60 pts, 50% → capped at 60

    return float(min(100.0, max(0.0, z_component + ev_component)))


def build_signal(
    event_id: str,
    player: str,
    team: str,
    stat: str,
    line: float,
    direction: str,
    kalshi_ticker: str,
    market_prob: float,
    games: list[dict],
    bankroll_cents: int,
    kelly_fraction: float,
    vault=None,
    sport: str = 'NBA',
    last_trade_time: Optional[datetime] = None,
    volume_24h: int = 0,
    spread: float = 0.0,
    price_delta: float = 0.0,
    is_b2b: bool = False,
    volume_spike: bool = False,
    position: str = '',
) -> Optional[Signal]:
    """
    Full signal construction pipeline. Evaluates both OVER and UNDER for each market
    and returns whichever direction has higher confidence (if either clears threshold).

    Quality filters applied in order to raw EV before confidence scoring:
      1. staleness_decay  — penalizes illiquid markets that haven't traded recently
      2. spread_discount  — penalizes wide bid-ask (uncertain market price)
    Then post-scoring:
      3. velocity_factor  — confidence modifier based on price direction since last scan
      4. B2B penalty      — NBA players on second night of back-to-back lose 28% confidence
    """
    if market_prob < 0.05 or market_prob > 0.95:
        return None

    games = _compute_combo_stat(games, stat)

    # Minutes-weighted for NBA; unweighted for MLB/NFL
    weight_col = 'MIN' if sport == 'NBA' else None

    z = calc_z_score(games, stat, line, weight_col=weight_col)
    if z is None:
        return None

    prob_over = model_probability(games, stat, line, 'OVER', weight_col=weight_col)
    if prob_over is None:
        return None

    prob_over = max(0.02, min(0.98, prob_over))
    market_prob = max(0.02, min(0.98, market_prob))
    market_prob_under = 1.0 - market_prob
    prob_under = 1.0 - prob_over

    # Hours since last Kalshi trade
    now_utc = datetime.now(timezone.utc)
    if last_trade_time is not None:
        ltt = last_trade_time if last_trade_time.tzinfo else last_trade_time.replace(tzinfo=timezone.utc)
        hours_stale = max(0.0, (now_utc - ltt).total_seconds() / 3600)
    else:
        hours_stale = 0.0

    def _adjusted_ev(raw_ev: float) -> float:
        ev = staleness_decay(raw_ev, hours_stale, sport, volume_24h)
        ev = spread_discount(ev, spread)
        return ev

    ev_over = _adjusted_ev(ev_calculator(prob_over, market_prob))
    ev_under = _adjusted_ev(ev_calculator(prob_under, market_prob_under))

    conf_over = score_signal(z, ev_over)
    conf_under = score_signal(z, ev_under)

    if conf_over == 0.0 and conf_under == 0.0:
        return None

    if conf_over >= conf_under:
        chosen_dir = 'OVER'
        chosen_prob = prob_over
        chosen_mkt = market_prob
        chosen_ev = ev_over
        chosen_conf = conf_over
    else:
        chosen_dir = 'UNDER'
        chosen_prob = prob_under
        chosen_mkt = market_prob_under
        chosen_ev = ev_under
        chosen_conf = conf_under

    if chosen_conf == 0.0:
        return None

    # Multi-model consensus: suppress signals where only 1 model sees positive edge
    if model_consensus(games, stat, line, chosen_dir, chosen_mkt, weight_col) < 2:
        return None

    # Distribution statistics (stored for visualization)
    _stat_vals = [float(g[stat]) for g in games if g.get(stat) is not None]
    _model_mean_v = float(np.mean(_stat_vals)) if _stat_vals else 0.0
    _model_std_v = float(np.std(_stat_vals, ddof=1)) if len(_stat_vals) > 1 else 0.0
    _sample_size = len(_stat_vals)

    # Streak analysis: last 5 games vs this line in chosen direction
    streak = compute_streak(games, stat, line, chosen_dir)
    if streak['total'] >= 4:
        if streak['hot']:
            chosen_conf = min(100.0, chosen_conf * 1.10)
        elif streak['cold']:
            chosen_conf = max(0.0, chosen_conf * 0.90)
    last_5_enc = ''.join('1' if r else '0' for r in streak['results'][:5])

    # Post-scoring adjustments
    chosen_conf *= velocity_factor(price_delta, chosen_dir)
    if is_b2b and sport == 'NBA':
        chosen_conf *= _B2B_CONFIDENCE_FACTOR
    chosen_conf = max(0.0, min(100.0, chosen_conf))

    if chosen_conf < 1.0:
        return None

    size_cents = 0
    if vault is not None:
        from alpha_stream.vault import kelly_size
        size_cents = kelly_size(bankroll_cents, chosen_prob, chosen_mkt, kelly_fraction)

    return Signal(
        event_id=event_id,
        player=player,
        team=team,
        stat=stat,
        line=line,
        model_prob=chosen_prob,
        market_prob=chosen_mkt,
        z_score=z,
        ev=chosen_ev,
        confidence=chosen_conf,
        direction=chosen_dir,
        recommended_size=size_cents,
        kalshi_ticker=kalshi_ticker,
        sport=sport,
        volume_spike=volume_spike,
        position=position,
        streak_score=streak.get('score', 0.5),
        last_5_results=last_5_enc,
        model_mean=_model_mean_v,
        model_std=_model_std_v,
        sample_size=_sample_size,
    )
