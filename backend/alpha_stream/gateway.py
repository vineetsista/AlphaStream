"""
Broadcast service — Discord webhook alerts and signal persistence.
"""
import json
import logging
import urllib.request
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

DISCORD_COLOR_OVER = 0x10D97B   # green
DISCORD_COLOR_UNDER = 0xEF4444  # red
CONFIDENCE_THRESHOLD = 80.0     # only broadcast high-confidence signals


def format_alert(signal) -> dict:
    """
    Format a Discord embed payload for a signal.
    signal: Signal dataclass from alpha.py
    """
    color = DISCORD_COLOR_OVER if signal.direction == 'OVER' else DISCORD_COLOR_UNDER
    direction_emoji = '📈' if signal.direction == 'OVER' else '📉'
    ev_pct = round(signal.ev * 100, 1)
    size_dollars = round(signal.recommended_size / 100.0, 2)
    kalshi_url = f'https://kalshi.com/markets/{signal.kalshi_ticker}' if signal.kalshi_ticker else 'https://kalshi.com'

    # Streak label for Discord
    streak_score = getattr(signal, 'streak_score', 0.5)
    last_5 = getattr(signal, 'last_5_results', '')
    streak_dots = ''.join('🟢' if c == '1' else '🔴' for c in last_5) if last_5 else '—'
    streak_label = ''
    if last_5 and len(last_5) >= 4:
        hits = last_5.count('1')
        if hits >= 4:
            streak_label = f' 🔥 HOT ({hits}/{len(last_5)})'
        elif hits <= 1:
            streak_label = f' ❄️ COLD ({hits}/{len(last_5)})'
        else:
            streak_label = f' ({hits}/{len(last_5)})'

    embed = {
        'title': f'{direction_emoji} {signal.player} — {signal.stat} {signal.direction} {signal.line}{streak_label}',
        'description': f'High-confidence +EV signal detected on Kalshi',
        'color': color,
        'fields': [
            {'name': 'Confidence', 'value': f'**{signal.confidence:.0f}/100**', 'inline': True},
            {'name': 'Z-Score', 'value': f'**{signal.z_score:+.2f}σ**', 'inline': True},
            {'name': 'EV', 'value': f'**+{ev_pct:.1f}%**', 'inline': True},
            {'name': 'Model', 'value': f'{signal.model_prob*100:.1f}¢', 'inline': True},
            {'name': 'Market', 'value': f'{signal.market_prob*100:.1f}¢', 'inline': True},
            {'name': 'Edge', 'value': f'**+{(signal.model_prob - signal.market_prob)*100:.1f}¢**', 'inline': True},
            {'name': 'Kelly Size', 'value': f'**${size_dollars:.2f}**', 'inline': True},
            {'name': 'Sport / Team', 'value': f'{getattr(signal, "sport", "NBA")} · {signal.team or "N/A"}', 'inline': True},
            {'name': 'Last 5', 'value': streak_dots or '—', 'inline': True},
            {'name': 'Kalshi', 'value': f'[{signal.kalshi_ticker}]({kalshi_url})', 'inline': False},
        ],
        'footer': {
            'text': 'Alpha-Stream · Statistical arbitrage engine · Not financial advice'
        },
        'timestamp': signal.timestamp.isoformat(),
    }

    return {'embeds': [embed]}


def broadcast(signal, webhook_url: str) -> bool:
    """
    If signal.confidence > CONFIDENCE_THRESHOLD, send Discord embed via webhook.
    Returns True on success, False otherwise.
    """
    if not webhook_url:
        return False
    if signal.confidence <= CONFIDENCE_THRESHOLD:
        return False

    payload = format_alert(signal)

    try:
        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            webhook_url,
            data=body,
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            success = resp.status in (200, 204)
            if success:
                logger.info('Discord alert sent for %s (confidence=%.0f)', signal.player, signal.confidence)
            else:
                logger.warning('Discord webhook returned %d', resp.status)
            return success
    except Exception as e:
        logger.error('Discord broadcast failed: %s', e)
        return False


def log_signal(signal, db_session, user_id: int) -> None:
    """
    Persist a signal to the database regardless of confidence threshold.
    """
    from models import Signal as SignalModel

    row = SignalModel(
        user_id=user_id,
        event_id=signal.event_id,
        player=signal.player,
        team=signal.team,
        stat=signal.stat,
        line=signal.line,
        model_prob=signal.model_prob,
        market_prob=signal.market_prob,
        z_score=signal.z_score,
        ev=signal.ev,
        confidence=signal.confidence,
        direction=signal.direction,
        recommended_size=signal.recommended_size,
        kalshi_ticker=signal.kalshi_ticker,
        sport=getattr(signal, 'sport', 'NBA'),
        volume_spike=getattr(signal, 'volume_spike', False),
        position=getattr(signal, 'position', ''),
        streak_score=getattr(signal, 'streak_score', 0.5),
        last_5_results=getattr(signal, 'last_5_results', ''),
        model_mean=getattr(signal, 'model_mean', 0.0),
        model_std=getattr(signal, 'model_std', 0.0),
        sample_size=getattr(signal, 'sample_size', 0),
        timestamp=signal.timestamp,
    )
    db_session.add(row)
    # Caller is responsible for db_session.commit()
