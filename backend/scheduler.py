"""
Background scheduler — runs signal scans every 5 minutes during NBA game hours.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)


def run_signal_scan(flask_app):
    """
    Core scan job: harvest Kalshi + NBA data, detect +EV signals, broadcast alerts.
    Runs every 5 minutes during NBA game windows.
    """
    with flask_app.app_context():
        from models import db, User, Signal as SignalModel
        from alpha_stream.harvester import run_harvest
        from alpha_stream.alpha import build_signal
        from alpha_stream.vault import kelly_size
        from alpha_stream.gateway import broadcast, log_signal

        try:
            snapshots, harvesters = asyncio.run(run_harvest())
        except Exception as e:
            logger.error('Harvest failed: %s', e)
            return

        # Pre-fetch injury data for NBA and MLB
        from alpha_stream.injury_feed import get_injuries, injury_confidence_multiplier
        async def _fetch_injuries():
            try:
                nba = await get_injuries('NBA')
                mlb = await get_injuries('MLB')
                return {'NBA': nba, 'MLB': mlb}
            except Exception as exc:
                logger.warning('Injury feed failed: %s', exc)
                return {}
        try:
            asyncio.run(_fetch_injuries())
        except Exception:
            pass  # injuries are a best-effort signal quality filter

        # Filter to markets with parseable player props
        prop_markets = [s for s in snapshots if s.player_name and s.stat and s.line is not None]
        if not prop_markets:
            logger.info('Signal scan: no parseable prop markets found')
            return

        logger.info('Signal scan: processing %d prop markets across sports', len(prop_markets))

        # Fetch all users who have a Kalshi key configured
        active_users = User.query.filter(
            User._kalshi_api_key.isnot(None),
        ).all()

        if not active_users:
            logger.info('Signal scan: no active users to process')
            return

        # Fetch player stats once (shared across all users), dispatch by sport
        player_stats_cache: dict = {}

        async def _fetch_all_stats():
            results = {}
            for mkt in prop_markets:
                key = (mkt.player_name, mkt.sport)
                if key in results:
                    continue
                harvester = harvesters.get(mkt.sport, harvesters['NBA'])
                try:
                    stats = await harvester.fetch_player_stats(mkt.player_name)
                    results[key] = stats
                except Exception as e:
                    logger.warning('Stats fetch failed for %s (%s): %s', mkt.player_name, mkt.sport, e)
                    results[key] = None
            return results

        try:
            player_stats_cache = asyncio.run(_fetch_all_stats())
        except Exception as e:
            logger.error('Player stats batch fetch failed: %s', e)
            return

        # Process signals per user
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        for user in active_users:
            bankroll = user.bankroll or 100_000  # default $1,000 in cents
            kelly_frac = user.kelly_fraction or 0.25

            # Build all candidates for this user
            candidates = []
            for mkt in prop_markets:
                stats = player_stats_cache.get((mkt.player_name, mkt.sport))
                if not stats or not stats.games:
                    continue
                try:
                    signal = build_signal(
                        event_id=mkt.event_id,
                        player=mkt.player_name,
                        team=stats.team,
                        stat=mkt.stat,
                        line=mkt.line,
                        direction=mkt.direction or 'OVER',
                        kalshi_ticker=mkt.ticker,
                        market_prob=mkt.implied_probability,
                        games=stats.games,
                        bankroll_cents=bankroll,
                        kelly_fraction=kelly_frac,
                        vault=True,
                        last_trade_time=mkt.last_trade_time,
                        volume_24h=mkt.volume_24h,
                        spread=mkt.spread,
                        price_delta=mkt.price_delta,
                        is_b2b=getattr(stats, 'is_b2b', False),
                        sport=mkt.sport,
                        volume_spike=getattr(mkt, 'volume_spike', False),
                        position=getattr(stats, 'position', ''),
                    )
                    if signal and signal.confidence >= 75:
                        # Apply injury multiplier (suppresses out/doubtful players)
                        inj_mult = injury_confidence_multiplier(mkt.player_name, mkt.sport)
                        if inj_mult == 0.0:
                            continue
                        if inj_mult < 1.0:
                            signal.confidence *= inj_mult
                            signal.confidence = min(100.0, max(0.0, signal.confidence))
                        if signal.confidence >= 75:
                            candidates.append(signal)
                except Exception as e:
                    logger.error('Signal build error for %s / %s: %s', mkt.player_name, mkt.ticker, e)

            # Deduplicate correlated threshold-level signals: keep best confidence per player+stat
            best: dict = {}
            for sig in candidates:
                key = (sig.player, sig.stat)
                if key not in best or sig.confidence > best[key].confidence:
                    best[key] = sig

            # Remove cross-stat correlations (e.g. PTS + PRA share component)
            from alpha_stream.alpha import remove_correlated_signals
            deduped = remove_correlated_signals(list(best.values()))

            # Pre-fetch all player+stat combos already stored today to avoid race duplicates
            stored_today = set(
                (r.player, r.stat)
                for r in SignalModel.query.filter(
                    SignalModel.user_id == user.id,
                    SignalModel.timestamp >= today_start,
                ).with_entities(SignalModel.player, SignalModel.stat).all()
            )

            new_count = 0
            for signal in deduped:
                if (signal.player, signal.stat) in stored_today:
                    continue
                stored_today.add((signal.player, signal.stat))  # prevent same-run dupes

                log_signal(signal, db.session, user.id)
                new_count += 1

                if user.discord_webhook_url:
                    broadcast(signal, user.discord_webhook_url)

                # Auto-execution
                if getattr(user, 'auto_bet_enabled', False):
                    from alpha_stream.execution import auto_execute_signal
                    exec_result = auto_execute_signal(signal, user)
                    if exec_result and 'error' not in exec_result:
                        logger.info('Auto-bet executed for user %d: %s', user.id, signal.kalshi_ticker)

            if new_count > 0:
                try:
                    db.session.commit()
                    logger.info('User %d: committed %d new signals', user.id, new_count)
                except Exception as e:
                    db.session.rollback()
                    logger.error('DB commit failed for user %d: %s', user.id, e)


def _nba_stat_on_date(harvester, player_name: str, stat: str, target_date) -> float | None:
    """Fetch a player's actual NBA stat value for a specific game date."""
    from alpha_stream.alpha import _compute_combo_stat
    player_id, _, _pos = harvester._find_player_id_sync(player_name)
    if not player_id:
        return None
    season = harvester._get_current_season()
    games = harvester._fetch_player_logs_sync(player_id, season)
    games = _compute_combo_stat(games, stat)
    target_str = str(target_date)  # "YYYY-MM-DD"
    for g in games:
        if str(g.get('GAME_DATE', ''))[:10] == target_str:
            v = g.get(stat)
            return float(v) if v is not None else None
    return None


def _mlb_stat_on_date(harvester, player_name: str, stat: str, target_date) -> float | None:
    """Fetch a player's actual MLB stat value for a specific game date."""
    player_id, _, position, _team = harvester._lookup_player_sync(player_name)
    if not player_id:
        return None
    games = harvester._fetch_game_log_sync(player_id, position)
    # date format from raw API: "YYYY-MM-DD"
    target_iso = str(target_date)
    for g in games:
        if g.get('_date', '') == target_iso:
            v = g.get(stat)
            return float(v) if v is not None else None
    return None


def run_outcome_resolution(flask_app):
    """
    Runs every morning: fetch actual game stats and auto-resolve unresolved signals
    from the previous day. Computes PnL and marks WIN/LOSS.
    """
    with flask_app.app_context():
        from models import db, Signal as SignalModel
        from alpha_stream.harvester import NBAHarvester, MLBHarvester
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)

        unresolved = SignalModel.query.filter(
            SignalModel.actual_outcome.is_(None),
            SignalModel.timestamp < cutoff,
        ).all()

        if not unresolved:
            logger.info('Outcome resolution: no unresolved signals')
            return

        logger.info('Outcome resolution: checking %d signals', len(unresolved))

        nba = NBAHarvester()
        mlb = MLBHarvester()
        resolved = 0

        for signal in unresolved:
            try:
                # Check signal date and the day after (covers late west-coast games)
                signal_date = signal.timestamp.date()
                actual = None

                for check_date in [signal_date, signal_date + timedelta(days=1)]:
                    if signal.sport == 'NBA':
                        actual = _nba_stat_on_date(nba, signal.player, signal.stat, check_date)
                    elif signal.sport == 'MLB':
                        actual = _mlb_stat_on_date(mlb, signal.player, signal.stat, check_date)
                    if actual is not None:
                        break

                if actual is None:
                    continue  # game not found or not yet played

                outcome = 'OVER' if actual > signal.line else 'UNDER'
                signal.actual_outcome = outcome
                signal.resolved_at = now

                if signal.recommended_size and signal.recommended_size > 0:
                    if outcome == signal.direction:
                        odds = 1.0 / signal.market_prob - 1.0
                        signal.pnl = int(signal.recommended_size * odds)
                    else:
                        signal.pnl = -signal.recommended_size

                resolved += 1

            except Exception as e:
                logger.error('Resolution failed for signal %d (%s %s): %s',
                             signal.id, signal.player, signal.stat, e)

        if resolved > 0:
            try:
                db.session.commit()
                logger.info('Outcome resolution: auto-resolved %d signals', resolved)
            except Exception as e:
                db.session.rollback()
                logger.error('Resolution commit failed: %s', e)


def run_signal_digest(flask_app):
    """
    Send each active user a daily 7am ET digest: yesterday's outcomes, top open signals,
    and a quick performance summary.
    """
    with flask_app.app_context():
        from models import db, User, Signal as SignalModel
        from datetime import timedelta
        from email_delivery import send_signal_digest_email

        app_url = os.getenv('APP_URL', 'http://localhost:3000')
        now = datetime.now(timezone.utc)
        yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_end = now.replace(hour=0, minute=0, second=0, microsecond=0)

        active_users = User.query.filter(
            User._kalshi_api_key.isnot(None),
        ).all()

        for user in active_users:
            try:
                # Yesterday's resolved signals
                yesterday_resolved = SignalModel.query.filter(
                    SignalModel.user_id == user.id,
                    SignalModel.actual_outcome.isnot(None),
                    SignalModel.timestamp >= yesterday_start,
                    SignalModel.timestamp < yesterday_end,
                ).all()

                # Top 5 open signals (unresolved, ordered by confidence)
                top_open = SignalModel.query.filter(
                    SignalModel.user_id == user.id,
                    SignalModel.actual_outcome.is_(None),
                ).order_by(SignalModel.confidence.desc()).limit(5).all()

                # Performance stats (last 30 days)
                thirty_days_ago = now - timedelta(days=30)
                recent = SignalModel.query.filter(
                    SignalModel.user_id == user.id,
                    SignalModel.actual_outcome.isnot(None),
                    SignalModel.timestamp >= thirty_days_ago,
                ).all()
                wins = sum(1 for s in recent if s.actual_outcome == s.direction)
                win_rate = round(wins / len(recent) * 100, 1) if recent else 0
                total_pnl = round(sum((s.pnl or 0) for s in recent) / 100.0, 2)

                perf = {
                    'signals_30d': len(recent),
                    'win_rate': win_rate,
                    'total_pnl_dollars': total_pnl,
                }

                send_signal_digest_email(
                    to_email=user.email,
                    name=user.name,
                    yesterday_signals=yesterday_resolved,
                    top_signals=top_open,
                    perf_stats=perf,
                    app_url=app_url,
                )
            except Exception as e:
                logger.error('Digest email failed for user %d: %s', user.id, e)


def start_scheduler(flask_app):
    scheduler = BackgroundScheduler(timezone='US/Eastern')

    # Signal scan: every 5 minutes, noon–midnight ET (covers NBA, MLB, NFL game windows)
    scheduler.add_job(
        func=run_signal_scan,
        args=[flask_app],
        trigger=CronTrigger(
            minute='*/5',
            hour='12-23',
            day_of_week='mon-sun',
            timezone='US/Eastern',
        ),
        id='signal_scan',
        name='Sports Signal Scanner',
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Late window for west-coast games
    scheduler.add_job(
        func=run_signal_scan,
        args=[flask_app],
        trigger=CronTrigger(
            minute='*/5',
            hour='0,1',
            day_of_week='mon-sun',
            timezone='US/Eastern',
        ),
        id='signal_scan_late',
        name='Sports Signal Scanner (Late)',
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Auto-resolve signal outcomes daily at 9am ET (after overnight games finalize in APIs)
    scheduler.add_job(
        func=run_outcome_resolution,
        args=[flask_app],
        trigger=CronTrigger(hour=9, minute=0, timezone='US/Eastern'),
        id='outcome_resolution',
        name='Auto Outcome Resolution',
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Daily signal digest at 7am ET
    scheduler.add_job(
        func=run_signal_digest,
        args=[flask_app],
        trigger=CronTrigger(hour=7, minute=0, timezone='US/Eastern'),
        id='signal_digest',
        name='Daily Signal Digest',
        replace_existing=True,
        misfire_grace_time=3600,
    )

    scheduler.start()
    logger.info('Scheduler started — signal scans noon–2am ET every 5 min')
    return scheduler
