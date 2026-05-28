"""
Risk Controller — Kelly Criterion bankroll sizing and exposure limits.
All monetary values in cents.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MAX_SINGLE_BET_FRACTION = 0.25  # Hard cap: never risk more than 25% of bankroll
MAX_TEAM_EXPOSURE = 0.15        # Max 15% of bankroll on any single team


def kelly_size(
    bankroll_cents: int,
    model_prob: float,
    market_prob: float,
    fraction: float = 0.25,
) -> int:
    """
    Fractional Kelly Criterion.
    f* = ((b × p − q) / b) × fraction
    where b = (1/market_prob) - 1 (decimal odds - 1), p = model_prob, q = 1 - p

    Returns recommended bet size in cents. Never negative, capped at 25% of bankroll.
    """
    if bankroll_cents <= 0 or model_prob <= 0 or market_prob <= 0 or market_prob >= 1:
        return 0

    # Decimal odds on the yes side
    decimal_odds = 1.0 / market_prob
    b = decimal_odds - 1.0  # net odds (profit per $1 risked)
    p = model_prob
    q = 1.0 - p

    if b <= 0:
        return 0

    # Full Kelly fraction
    kelly_f = (b * p - q) / b

    # Cap at 0 if model_prob < implied prob (not +EV)
    if kelly_f <= 0:
        return 0

    # Apply fractional Kelly
    f_applied = kelly_f * fraction

    # Hard cap at MAX_SINGLE_BET_FRACTION
    f_capped = min(f_applied, MAX_SINGLE_BET_FRACTION)

    size_cents = int(bankroll_cents * f_capped)
    return max(0, size_cents)


def check_exposure(
    pending_signals: list,
    new_signal_team: str,
    bankroll_cents: int,
    max_per_team: float = MAX_TEAM_EXPOSURE,
) -> tuple[bool, str]:
    """
    Check if adding a new signal for new_signal_team would exceed per-team exposure.
    pending_signals: list of Signal objects already queued this scan cycle.
    Returns (allowed: bool, reason: str).
    """
    if not new_signal_team or bankroll_cents <= 0:
        return True, ''

    team_exposure_cents = sum(
        s.recommended_size for s in pending_signals
        if s.team == new_signal_team and s.recommended_size > 0
    )

    max_exposure_cents = int(bankroll_cents * max_per_team)

    if team_exposure_cents >= max_exposure_cents:
        reason = (
            f'Team exposure limit reached for {new_signal_team}: '
            f'${team_exposure_cents/100:.2f} / ${max_exposure_cents/100:.2f} max'
        )
        return False, reason

    return True, ''


def get_sizing(
    bankroll_cents: int,
    signal,
    pending_signals: list,
    kelly_fraction: float = 0.25,
) -> tuple[int, str]:
    """
    Combines kelly_size + check_exposure.
    Returns (recommended_cents, reason_if_blocked).
    """
    allowed, reason = check_exposure(pending_signals, signal.team, bankroll_cents)
    if not allowed:
        return 0, reason

    size = kelly_size(bankroll_cents, signal.model_prob, signal.market_prob, kelly_fraction)
    return size, ''
