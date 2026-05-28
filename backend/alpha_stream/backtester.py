"""
Backtesting engine — performance stats from historical signals.
"""
import logging
from datetime import datetime, timezone, timedelta

import numpy as np

logger = logging.getLogger(__name__)


def run_backtest(user_id: int, db_session, days_back: int = 30) -> dict:
    """
    Query resolved signals and compute win rate, ROI, Sharpe ratio, max drawdown.
    Returns performance metrics dict.
    """
    from models import Signal

    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    signals = (
        db_session.query(Signal)
        .filter(
            Signal.user_id == user_id,
            Signal.timestamp >= cutoff,
            Signal.actual_outcome.isnot(None),
        )
        .order_by(Signal.timestamp.asc())
        .all()
    )

    if not signals:
        return _empty_stats()

    resolved = [s for s in signals if s.pnl is not None]
    if not resolved:
        return _empty_stats()

    pnl_values = [s.pnl for s in resolved]  # cents
    wins = sum(1 for s in resolved if (s.pnl or 0) > 0)
    total = len(resolved)
    win_rate = wins / total if total > 0 else 0.0

    total_pnl_cents = sum(pnl_values)
    total_wagered_cents = sum(s.recommended_size or 0 for s in resolved if (s.recommended_size or 0) > 0)
    roi = total_pnl_cents / total_wagered_cents if total_wagered_cents > 0 else 0.0

    # Sharpe ratio (annualized, treating each signal as an independent period)
    pnl_arr = np.array(pnl_values, dtype=float)
    if len(pnl_arr) > 1 and pnl_arr.std() > 0:
        sharpe = float(pnl_arr.mean() / pnl_arr.std() * np.sqrt(252))
    else:
        sharpe = 0.0

    # Max drawdown (in cents)
    cumulative = np.cumsum(pnl_arr)
    peak = np.maximum.accumulate(cumulative)
    drawdown = cumulative - peak
    max_drawdown_cents = int(drawdown.min()) if len(drawdown) > 0 else 0

    # Profit factor: gross wins / gross losses
    gross_wins = sum(p for p in pnl_values if p > 0)
    gross_losses = abs(sum(p for p in pnl_values if p < 0))
    profit_factor = round(gross_wins / max(1, gross_losses), 2)

    # Average win and average loss sizes
    win_amounts = [p for p in pnl_values if p > 0]
    loss_amounts = [abs(p) for p in pnl_values if p < 0]
    avg_win_dollars = round(float(np.mean(win_amounts)) / 100.0, 2) if win_amounts else 0.0
    avg_loss_dollars = round(float(np.mean(loss_amounts)) / 100.0, 2) if loss_amounts else 0.0

    # Current winning/losing streak (sequential from most recent)
    streak = 0
    best_streak, worst_streak = 0, 0
    run = 0
    for p in pnl_values:
        if p > 0:
            run = max(1, run + 1)
            best_streak = max(best_streak, run)
        elif p < 0:
            run = min(-1, run - 1)
            worst_streak = min(worst_streak, run)
        else:
            run = 0
    current_streak = run

    # Information Coefficient: correlation between model_prob and binary outcome
    # IC > 0 means the model has predictive power; IC > 0.05 is considered meaningful
    outcomes_bin = [1.0 if s.actual_outcome == s.direction else 0.0 for s in resolved]
    model_probs = [s.model_prob for s in resolved]
    try:
        from scipy.stats import pearsonr as _pearsonr
        if len(set(outcomes_bin)) > 1:
            ic_val, _ = _pearsonr(model_probs, outcomes_bin)
            ic = round(float(ic_val), 4)
        else:
            ic = 0.0
    except Exception:
        ic = 0.0

    # Value at Risk: worst expected per-signal loss at 95% and 99% confidence
    var_95_dollars = round(float(np.percentile(pnl_arr, 5)) / 100.0, 2)
    var_99_dollars = round(float(np.percentile(pnl_arr, 1)) / 100.0, 2)

    avg_ev = float(np.mean([s.ev for s in resolved]))
    avg_confidence = float(np.mean([s.confidence for s in resolved]))

    return {
        'win_rate': round(win_rate, 4),
        'win_rate_pct': round(win_rate * 100, 1),
        'roi': round(roi, 4),
        'roi_pct': round(roi * 100, 2),
        'total_signals': total,
        'total_resolved': total,
        'wins': wins,
        'losses': total - wins,
        'total_pnl_cents': total_pnl_cents,
        'total_pnl_dollars': round(total_pnl_cents / 100.0, 2),
        'max_drawdown_cents': max_drawdown_cents,
        'max_drawdown_dollars': round(max_drawdown_cents / 100.0, 2),
        'sharpe': round(sharpe, 3),
        'profit_factor': profit_factor,
        'avg_win_dollars': avg_win_dollars,
        'avg_loss_dollars': avg_loss_dollars,
        'best_streak': best_streak,
        'worst_streak': abs(worst_streak),
        'current_streak': current_streak,
        'ic': ic,
        'var_95_dollars': var_95_dollars,
        'var_99_dollars': var_99_dollars,
        'avg_ev': round(avg_ev, 4),
        'avg_ev_pct': round(avg_ev * 100, 2),
        'avg_confidence': round(avg_confidence, 1),
        'days_back': days_back,
    }


def get_performance_stats(user_id: int, db_session) -> dict:
    """Returns summary stats across all resolved signals."""
    return run_backtest(user_id, db_session, days_back=365)


def get_daily_pnl(user_id: int, db_session, days_back: int = 30) -> list[dict]:
    """
    Returns daily PnL grouped by date for charting.
    Returns list of {date, pnl_cents, pnl_dollars, cumulative_cents, cumulative_dollars}.
    """
    from models import Signal
    from datetime import date

    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    signals = (
        db_session.query(Signal)
        .filter(
            Signal.user_id == user_id,
            Signal.timestamp >= cutoff,
            Signal.actual_outcome.isnot(None),
            Signal.pnl.isnot(None),
        )
        .order_by(Signal.timestamp.asc())
        .all()
    )

    # Group by date
    daily: dict[str, int] = {}
    for s in signals:
        day = s.timestamp.strftime('%Y-%m-%d')
        daily[day] = daily.get(day, 0) + (s.pnl or 0)

    # Fill in all days in range (including zero-PnL days)
    result = []
    cumulative = 0
    for i in range(days_back - 1, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime('%Y-%m-%d')
        pnl = daily.get(d, 0)
        cumulative += pnl
        result.append({
            'date': d,
            'pnl_cents': pnl,
            'pnl_dollars': round(pnl / 100.0, 2),
            'cumulative_cents': cumulative,
            'cumulative_dollars': round(cumulative / 100.0, 2),
        })

    return result


def _empty_stats() -> dict:
    return {
        'win_rate': 0.0,
        'win_rate_pct': 0.0,
        'roi': 0.0,
        'roi_pct': 0.0,
        'total_signals': 0,
        'total_resolved': 0,
        'wins': 0,
        'losses': 0,
        'total_pnl_cents': 0,
        'total_pnl_dollars': 0.0,
        'max_drawdown_cents': 0,
        'max_drawdown_dollars': 0.0,
        'sharpe': 0.0,
        'profit_factor': 0.0,
        'avg_win_dollars': 0.0,
        'avg_loss_dollars': 0.0,
        'best_streak': 0,
        'worst_streak': 0,
        'current_streak': 0,
        'ic': 0.0,
        'var_95_dollars': 0.0,
        'var_99_dollars': 0.0,
        'avg_ev': 0.0,
        'avg_ev_pct': 0.0,
        'avg_confidence': 0.0,
        'days_back': 30,
    }
