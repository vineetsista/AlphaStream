import os
import logging

logging.basicConfig(level=logging.INFO)

from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

from models import db, User, Signal, WatchedMarket, PushSubscription
from email_delivery import (
    send_verification_email,
    send_welcome_email,
    send_password_reset_email,
)
from scheduler import start_scheduler

load_dotenv()

logger = logging.getLogger(__name__)


def create_app():
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
    app = Flask(__name__, static_folder=None)

    database_url = os.getenv('DATABASE_URL', 'sqlite:///alpha_stream_dev.db')
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    CORS(app)
    db.init_app(app)
    Migrate(app, db)

    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=[],
        storage_uri='memory://',
    )

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'error': 'Too many requests. Please wait before trying again.'}), 429

    _PUBLIC_ENDPOINTS = {
        'health', 'register', 'login', 'verify_email', 'resend_verification',
        'forgot_password', 'reset_password', 'serve_react', 'static',
        'signal_stream',   # auth handled inline via query param (EventSource can't set headers)
        'get_vapid_key',   # public key for push subscription setup
    }

    @app.before_request
    def authenticate():
        if request.endpoint in _PUBLIC_ENDPOINTS or request.endpoint is None:
            return None
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'Authentication required'}), 401
        user = User.query.filter_by(api_key=api_key).first()
        if not user:
            return jsonify({'error': 'Invalid or expired API key'}), 401
        g.user = user

    with app.app_context():
        db.create_all()

    # ── Health ─────────────────────────────────────────────────────────────────

    @app.route('/health')
    def health():
        try:
            db.session.execute(db.text('SELECT 1'))
            return jsonify({'status': 'ok', 'db': 'connected'})
        except Exception as e:
            return jsonify({'status': 'error', 'db': str(e)}), 500

    # ── Auth ───────────────────────────────────────────────────────────────────

    @app.route('/api/auth/register', methods=['POST'])
    @limiter.limit('10 per hour')
    def register():
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not name or not email or not password:
            return jsonify({'error': 'name, email, and password are required'}), 400
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        if '@' not in email:
            return jsonify({'error': 'Invalid email address'}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409

        user = User(name=name, email=email)
        user.set_password(password)
        token = user.generate_verification_token()
        user.ensure_api_key()

        db.session.add(user)
        db.session.commit()

        app_url = os.getenv('APP_URL', 'http://localhost:3000')
        send_verification_email(email, name, token, app_url)

        result = user.to_dict()
        result['api_key'] = user.api_key
        return jsonify(result), 201

    @app.route('/api/auth/login', methods=['POST'])
    @limiter.limit('20 per hour; 5 per minute')
    def login():
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email:
            return jsonify({'error': 'email required'}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'No account found with that email address'}), 404
        if user.has_password() and not user.check_password(password):
            return jsonify({'error': 'Incorrect password'}), 401

        user.ensure_api_key()
        db.session.commit()

        result = user.to_dict()
        result['api_key'] = user.api_key
        return jsonify(result)

    @app.route('/api/auth/me')
    def get_me():
        return jsonify(g.user.to_dict())

    # ── Email Verification ─────────────────────────────────────────────────────

    @app.route('/api/verify-email/<token>', methods=['POST'])
    def verify_email(token):
        user = User.query.filter_by(verification_token=token).first()
        if not user:
            return jsonify({'error': 'Invalid or expired verification link'}), 400
        first_verify = not user.email_verified
        user.email_verified = True
        user.verification_token = None
        db.session.commit()
        if first_verify:
            app_url = os.getenv('APP_URL', 'http://localhost:3000')
            send_welcome_email(user.email, user.name, app_url)
        return jsonify({'message': 'Email verified', 'user': user.to_dict()})

    @app.route('/api/resend-verification', methods=['POST'])
    def resend_verification():
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        user = User.query.filter_by(email=email).first()
        if user and not user.email_verified:
            token = user.generate_verification_token()
            db.session.commit()
            app_url = os.getenv('APP_URL', 'http://localhost:3000')
            send_verification_email(user.email, user.name, token, app_url)
        return jsonify({'message': 'If that account exists and is unverified, a new email was sent'})

    @app.route('/api/forgot-password', methods=['POST'])
    @limiter.limit('5 per hour')
    def forgot_password():
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        user = User.query.filter_by(email=email).first()
        if user:
            token = user.generate_reset_token()
            db.session.commit()
            app_url = os.getenv('APP_URL', 'http://localhost:3000')
            send_password_reset_email(user.email, user.name, token, app_url)
        return jsonify({'message': 'If that email is registered, a reset link was sent'})

    @app.route('/api/reset-password/<token>', methods=['POST'])
    def reset_password(token):
        from datetime import datetime, timezone
        data = request.get_json() or {}
        new_pw = data.get('password', '')
        if len(new_pw) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        user = User.query.filter_by(reset_token=token).first()
        if not user:
            return jsonify({'error': 'Invalid or expired reset link'}), 400
        if user.reset_token_expires and user.reset_token_expires < datetime.now(timezone.utc):
            return jsonify({'error': 'Reset link has expired. Please request a new one'}), 400
        user.set_password(new_pw)
        user.reset_token = None
        user.reset_token_expires = None
        db.session.commit()
        return jsonify({'message': 'Password updated successfully'})

    # ── Signals ────────────────────────────────────────────────────────────────

    @app.route('/api/signals')
    def get_signals():
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 25, type=int), 100)
        sort = request.args.get('sort', 'confidence')  # confidence | ev | time
        direction_filter = request.args.get('direction', '')  # OVER | UNDER | ''
        sport_filter = request.args.get('sport', '')  # NBA | MLB | NFL | ''
        min_confidence = request.args.get('min_confidence', 0, type=float)

        query = Signal.query.filter_by(user_id=g.user.id)

        if direction_filter in ('OVER', 'UNDER'):
            query = query.filter_by(direction=direction_filter)
        if sport_filter in ('NBA', 'MLB', 'NFL', 'NHL'):
            query = query.filter_by(sport=sport_filter)
        if min_confidence > 0:
            query = query.filter(Signal.confidence >= min_confidence)

        sort_map = {
            'confidence': Signal.confidence.desc(),
            'ev': Signal.ev.desc(),
            'time': Signal.timestamp.desc(),
        }
        query = query.order_by(sort_map.get(sort, Signal.confidence.desc()))

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            'signals': [s.to_dict() for s in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
        })

    @app.route('/api/signals/scan', methods=['POST'])
    @limiter.limit('1 per 2 minutes', key_func=lambda: f'scan:{g.user.id}')
    def trigger_scan():
        import asyncio
        from datetime import datetime, timezone
        from alpha_stream.harvester import run_harvest
        from alpha_stream.alpha import build_signal
        from alpha_stream.gateway import log_signal

        user = g.user

        try:
            snapshots, harvesters = asyncio.run(run_harvest())
        except Exception as e:
            return jsonify({'error': f'Harvest failed: {str(e)}'}), 500

        prop_markets = [s for s in snapshots if s.player_name and s.stat and s.line is not None]

        # Purge unresolved signals for markets Kalshi has since closed (eliminated teams, ended games).
        # active_tickers is the ground truth — if a market is gone from Kalshi it should leave the feed.
        active_tickers = {s.ticker for s in snapshots}
        if active_tickers:
            stale = Signal.query.filter(
                Signal.user_id == user.id,
                Signal.actual_outcome.is_(None),
                Signal.kalshi_ticker.isnot(None),
                ~Signal.kalshi_ticker.in_(active_tickers),
            ).all()
            if stale:
                for s in stale:
                    db.session.delete(s)
                logger.info('Purged %d stale signals (Kalshi markets closed)', len(stale))

        # Batch-fetch stats for all unique players first (uses built-in cache)
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
                    logger.warning('Stats fetch failed for %s: %s', mkt.player_name, e)
                    results[key] = None
            return results

        try:
            stats_cache = asyncio.run(_fetch_all_stats())
        except Exception as e:
            logger.error('Stats batch fetch failed: %s', e)
            stats_cache = {}

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        def _last_game_days_ago(games: list) -> float:
            """Return how many days ago the player's most recent game was played."""
            from datetime import date as _date
            best = None
            for g in games:
                raw = g.get('GAME_DATE') or g.get('_date') or g.get('date') or g.get('gameDate', '')
                raw = str(raw)[:10]
                try:
                    d = datetime.strptime(raw, '%Y-%m-%d').date()
                    if best is None or d > best:
                        best = d
                except ValueError:
                    continue
            if best is None:
                return 999
            return (datetime.now(timezone.utc).date() - best).days

        # Build all candidate signals first, then deduplicate
        candidates = []
        for mkt in prop_markets:
            try:
                stats = stats_cache.get((mkt.player_name, mkt.sport))
                if not stats or not stats.games:
                    continue
                # Skip players whose team is eliminated / inactive — last game > 3 days ago
                if _last_game_days_ago(stats.games) > 3:
                    logger.info('Skipping %s — last game >3 days ago (likely eliminated)', mkt.player_name)
                    continue
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
                    bankroll_cents=user.bankroll or 100000,
                    kelly_fraction=user.kelly_fraction or 0.25,
                    vault=True,
                    sport=mkt.sport,
                    last_trade_time=mkt.last_trade_time,
                    volume_24h=mkt.volume_24h,
                    spread=mkt.spread,
                    price_delta=mkt.price_delta,
                    is_b2b=getattr(stats, 'is_b2b', False),
                    volume_spike=getattr(mkt, 'volume_spike', False),
                    position=getattr(stats, 'position', ''),
                )
                if signal and signal.confidence >= 75:
                    candidates.append(signal)
            except Exception as e:
                logger.warning('Scan error for %s: %s', mkt.player_name, e)

        # Deduplicate correlated threshold-level signals: keep best confidence per player+stat
        best: dict = {}
        for sig in candidates:
            key = (sig.player, sig.stat)
            if key not in best or sig.confidence > best[key].confidence:
                best[key] = sig

        # Remove cross-stat correlations: e.g. PTS + PRA share PTS component — keep highest conf
        from alpha_stream.alpha import remove_correlated_signals
        deduped = remove_correlated_signals(list(best.values()))

        # Persist only signals not already stored today (check by player+stat, not ticker)
        new_signals = []
        for signal in deduped:
            existing = Signal.query.filter_by(
                user_id=user.id, player=signal.player, stat=signal.stat,
            ).filter(Signal.timestamp >= today_start).first()
            if existing:
                continue
            log_signal(signal, db.session, user.id)
            new_signals.append(signal)

        if new_signals:
            db.session.commit()

        return jsonify({
            'scanned': len(prop_markets),
            'new_signals': len(new_signals),
            'signals': [
                {
                    'player': s.player,
                    'stat': s.stat,
                    'line': s.line,
                    'direction': s.direction,
                    'confidence': round(s.confidence, 1),
                    'ev_pct': round(s.ev * 100, 2),
                    'z_score': round(s.z_score, 2),
                }
                for s in new_signals
            ],
        })

    @app.route('/api/signals/stream')
    def signal_stream():
        """
        Server-Sent Events endpoint — pushes new signals in real time.
        Auth via ?api_key= query param (EventSource API cannot set custom headers).
        Emits a heartbeat comment every 5s to keep the connection alive through proxies.
        """
        import json
        import time as _time
        from flask import Response, stream_with_context

        api_key = request.args.get('api_key', '')
        user = User.query.filter_by(api_key=api_key).first()
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401

        user_id = user.id

        def generate():
            last = Signal.query.filter_by(user_id=user_id).order_by(Signal.id.desc()).first()
            last_id = last.id if last else 0

            while True:
                new_sigs = Signal.query.filter(
                    Signal.user_id == user_id,
                    Signal.id > last_id,
                ).order_by(Signal.id.asc()).all()

                for sig in new_sigs:
                    last_id = sig.id
                    yield f'data: {json.dumps(sig.to_dict())}\n\n'

                yield ': heartbeat\n\n'
                _time.sleep(5)

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
        )

    @app.route('/api/signals/<int:signal_id>')
    def get_signal(signal_id):
        signal = Signal.query.filter_by(id=signal_id, user_id=g.user.id).first_or_404()
        return jsonify(signal.to_dict())

    @app.route('/api/signals/<int:signal_id>', methods=['DELETE'])
    def delete_signal(signal_id):
        signal = Signal.query.filter_by(id=signal_id, user_id=g.user.id).first_or_404()
        db.session.delete(signal)
        db.session.commit()
        return jsonify({'ok': True})

    @app.route('/api/signals/<int:signal_id>/outcome', methods=['PATCH'])
    def update_signal_outcome(signal_id):
        signal = Signal.query.filter_by(id=signal_id, user_id=g.user.id).first_or_404()
        data = request.get_json() or {}
        outcome = data.get('actual_outcome', '').upper()
        if outcome not in ('OVER', 'UNDER'):
            return jsonify({'error': 'actual_outcome must be OVER or UNDER'}), 400

        from datetime import datetime, timezone
        signal.actual_outcome = outcome
        signal.resolved_at = datetime.now(timezone.utc)

        # Calculate PnL
        if signal.recommended_size and signal.recommended_size > 0:
            if outcome == signal.direction:
                # Win: profit = size × (1/market_prob - 1)
                odds = 1.0 / signal.market_prob - 1.0
                signal.pnl = int(signal.recommended_size * odds)
            else:
                # Loss: lose the bet
                signal.pnl = -signal.recommended_size

        db.session.commit()
        return jsonify(signal.to_dict())

    @app.route('/api/signals/resolve', methods=['POST'])
    def resolve_outcomes():
        from scheduler import run_outcome_resolution
        try:
            run_outcome_resolution(app)
            resolved = Signal.query.filter(
                Signal.user_id == g.user.id,
                Signal.actual_outcome.isnot(None),
            ).count()
            return jsonify({'ok': True, 'resolved_total': resolved})
        except Exception as e:
            logger.error('Manual resolve failed: %s', e)
            return jsonify({'error': str(e)}), 500

    # ── Backtest ───────────────────────────────────────────────────────────────

    @app.route('/api/backtest')
    def get_backtest():
        from alpha_stream.backtester import run_backtest
        days = request.args.get('days', 30, type=int)
        stats = run_backtest(g.user.id, db.session, days)
        return jsonify(stats)

    @app.route('/api/backtest/history')
    def get_backtest_history():
        from alpha_stream.backtester import get_daily_pnl
        days = request.args.get('days', 30, type=int)
        sport_filter = request.args.get('sport', '')
        history = get_daily_pnl(g.user.id, db.session, days)

        # Include signal history table
        sig_query = (
            Signal.query.filter_by(user_id=g.user.id)
            .filter(Signal.actual_outcome.isnot(None))
        )
        if sport_filter in ('NBA', 'MLB', 'NFL', 'NHL'):
            sig_query = sig_query.filter_by(sport=sport_filter)
        signals = sig_query.order_by(Signal.timestamp.desc()).limit(100).all()
        return jsonify({
            'daily_pnl': history,
            'resolved_signals': [s.to_dict() for s in signals],
        })

    # ── Watched Markets ────────────────────────────────────────────────────────

    @app.route('/api/markets/watched')
    def get_watched_markets():
        markets = WatchedMarket.query.filter_by(user_id=g.user.id, active=True).order_by(
            WatchedMarket.created_at.desc()
        ).all()
        return jsonify([m.to_dict() for m in markets])

    @app.route('/api/markets/watched', methods=['POST'])
    def add_watched_market():
        data = request.get_json() or {}
        ticker = data.get('kalshi_ticker', '').strip().upper()
        label = data.get('label', '').strip()
        if not ticker:
            return jsonify({'error': 'kalshi_ticker is required'}), 400

        existing = WatchedMarket.query.filter_by(user_id=g.user.id, kalshi_ticker=ticker).first()
        if existing:
            existing.active = True
            db.session.commit()
            return jsonify(existing.to_dict())

        market = WatchedMarket(user_id=g.user.id, kalshi_ticker=ticker, label=label or ticker)
        db.session.add(market)
        db.session.commit()
        return jsonify(market.to_dict()), 201

    @app.route('/api/markets/watched/<int:market_id>', methods=['DELETE'])
    def delete_watched_market(market_id):
        market = WatchedMarket.query.filter_by(id=market_id, user_id=g.user.id).first_or_404()
        market.active = False
        db.session.commit()
        return jsonify({'deleted': market_id})

    # ── Settings ───────────────────────────────────────────────────────────────

    @app.route('/api/settings')
    def get_settings():
        return jsonify(g.user.to_dict())

    @app.route('/api/settings', methods=['PATCH'])
    def update_settings():
        user = g.user
        data = request.get_json() or {}

        if 'name' in data and data['name'].strip():
            user.name = data['name'].strip()
        if 'bankroll' in data:
            try:
                user.bankroll = max(0, int(data['bankroll']))
            except (ValueError, TypeError):
                return jsonify({'error': 'bankroll must be an integer (cents)'}), 400
        if 'kelly_fraction' in data:
            try:
                kf = float(data['kelly_fraction'])
                user.kelly_fraction = max(0.05, min(0.5, kf))
            except (ValueError, TypeError):
                return jsonify({'error': 'kelly_fraction must be a number between 0.05 and 0.5'}), 400
        if 'kalshi_api_key' in data:
            user.kalshi_api_key = data['kalshi_api_key'] or None
        if 'discord_webhook_url' in data:
            url = (data['discord_webhook_url'] or '').strip()
            if url and not url.startswith('https://discord.com/api/webhooks/'):
                return jsonify({'error': 'Invalid Discord webhook URL'}), 400
            user.discord_webhook_url = url or None
        if 'auto_bet_enabled' in data:
            user.auto_bet_enabled = bool(data['auto_bet_enabled'])
        if 'auto_bet_min_confidence' in data:
            try:
                conf = float(data['auto_bet_min_confidence'])
                user.auto_bet_min_confidence = max(75.0, min(100.0, conf))
            except (ValueError, TypeError):
                return jsonify({'error': 'auto_bet_min_confidence must be 75–100'}), 400

        db.session.commit()
        return jsonify(user.to_dict())

    @app.route('/api/settings/change-password', methods=['POST'])
    def change_password():
        user = g.user
        data = request.get_json() or {}
        current = data.get('current_password', '')
        new_pw = data.get('new_password', '')
        if len(new_pw) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        if user.has_password() and not user.check_password(current):
            return jsonify({'error': 'Current password is incorrect'}), 401
        user.set_password(new_pw)
        db.session.commit()
        return jsonify({'message': 'Password updated'})

    @app.route('/api/settings/discord/test', methods=['POST'])
    def test_discord():
        user = g.user
        if not user.discord_webhook_url:
            return jsonify({'error': 'No Discord webhook configured'}), 400
        import json
        import urllib.request
        payload = json.dumps({
            'embeds': [{
                'title': '✅ Alpha-Stream connected',
                'description': f'Discord alerts are configured for your account. You\'ll receive notifications for signals with confidence > 80.',
                'color': 0x10D97B,
                'footer': {'text': 'Alpha-Stream · Test notification'},
            }]
        }).encode()
        try:
            req = urllib.request.Request(
                user.discord_webhook_url,
                data=payload,
                headers={'Content-Type': 'application/json'},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 204):
                    return jsonify({'message': 'Test notification sent'})
                return jsonify({'error': f'Discord returned {resp.status}'}), 502
        except Exception as e:
            return jsonify({'error': f'Discord delivery failed: {str(e)}'}), 502

    @app.route('/api/settings/rotate-api-key', methods=['POST'])
    def rotate_api_key():
        new_key = g.user.rotate_api_key()
        db.session.commit()
        return jsonify({'api_key': new_key})

    # ── Portfolio ──────────────────────────────────────────────────────────────

    @app.route('/api/portfolio/exposure')
    def portfolio_exposure():
        user = g.user
        all_signals = Signal.query.filter(
            Signal.user_id == user.id,
            Signal.actual_outcome.is_(None),
            Signal.recommended_size.isnot(None),
        ).order_by(Signal.confidence.desc()).all()

        # Deduplicate: keep highest-confidence signal per player+stat
        seen = {}
        for s in all_signals:
            key = (s.player, s.stat)
            if key not in seen:
                seen[key] = s
        signals = list(seen.values())

        bankroll = user.bankroll or 100000
        total_deployed = sum(s.recommended_size or 0 for s in signals)
        # Expected edge = sum of (model_prob - market_prob) * recommended_size for each position
        total_expected_edge_cents = sum(
            (s.model_prob - s.market_prob) * (s.recommended_size or 0)
            for s in signals
        )

        by_team, by_stat, by_sport = {}, {}, {}
        for s in signals:
            size = s.recommended_size or 0
            by_team[s.team or 'Other'] = by_team.get(s.team or 'Other', 0) + size
            by_stat[s.stat or '?'] = by_stat.get(s.stat or '?', 0) + size
            by_sport[s.sport or 'NBA'] = by_sport.get(s.sport or 'NBA', 0) + size

        def _to_dollars(d):
            return {k: round(v / 100.0, 2) for k, v in sorted(d.items(), key=lambda x: -x[1])}

        return jsonify({
            'total_deployed_dollars': round(total_deployed / 100.0, 2),
            'expected_edge_dollars': round(total_expected_edge_cents / 100.0, 2),
            'bankroll_dollars': round(bankroll / 100.0, 2),
            'utilization_pct': round(total_deployed / bankroll * 100, 1) if bankroll > 0 else 0,
            'active_positions': len(signals),
            'by_team': dict(list(_to_dollars(by_team).items())[:10]),
            'by_stat': _to_dollars(by_stat),
            'by_sport': _to_dollars(by_sport),
            'signals': [s.to_dict() for s in sorted(signals, key=lambda x: -(x.confidence or 0))],
        })

    # ── Calibration ────────────────────────────────────────────────────────────

    @app.route('/api/calibration')
    def get_calibration():
        resolved = Signal.query.filter(
            Signal.user_id == g.user.id,
            Signal.actual_outcome.isnot(None),
        ).all()

        if not resolved:
            return jsonify({'buckets': [], 'total': 0})

        buckets = [{'wins': 0, 'total': 0} for _ in range(10)]
        for sig in resolved:
            idx = min(9, int(sig.model_prob * 10))
            buckets[idx]['total'] += 1
            if sig.actual_outcome == sig.direction:
                buckets[idx]['wins'] += 1

        result = []
        for i, b in enumerate(buckets):
            if b['total'] > 0:
                result.append({
                    'predicted_pct': round((i + 0.5) * 10, 1),
                    'actual_pct': round(b['wins'] / b['total'] * 100, 1),
                    'count': b['total'],
                })

        return jsonify({'buckets': result, 'total': len(resolved)})

    # ── CSV Export ─────────────────────────────────────────────────────────────

    @app.route('/api/signals/export')
    def export_signals():
        import csv, io
        from flask import Response

        sport_filter = request.args.get('sport', '')
        outcome_filter = request.args.get('outcome', '')  # resolved | unresolved | all
        limit = min(request.args.get('limit', 1000, type=int), 5000)

        q = Signal.query.filter_by(user_id=g.user.id)
        if sport_filter in ('NBA', 'MLB', 'NFL', 'NHL'):
            q = q.filter_by(sport=sport_filter)
        if outcome_filter == 'resolved':
            q = q.filter(Signal.actual_outcome.isnot(None))
        elif outcome_filter == 'unresolved':
            q = q.filter(Signal.actual_outcome.is_(None))
        signals = q.order_by(Signal.timestamp.desc()).limit(limit).all()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            'id', 'timestamp', 'player', 'team', 'sport', 'stat', 'line', 'direction',
            'confidence', 'z_score', 'ev_pct', 'model_prob', 'market_prob',
            'recommended_size_dollars', 'streak_score', 'last_5_results',
            'actual_outcome', 'pnl_dollars', 'kalshi_ticker',
        ])
        for s in signals:
            writer.writerow([
                s.id, s.timestamp.strftime('%Y-%m-%d %H:%M'), s.player, s.team or '', s.sport or '',
                s.stat, s.line, s.direction, round(s.confidence, 1), round(s.z_score, 3),
                round(s.ev * 100, 2), round(s.model_prob, 4), round(s.market_prob, 4),
                round((s.recommended_size or 0) / 100.0, 2),
                round(s.streak_score or 0.5, 2), s.last_5_results or '',
                s.actual_outcome or '', round((s.pnl or 0) / 100.0, 2), s.kalshi_ticker or '',
            ])

        csv_content = buf.getvalue()
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=alphastream_signals.csv'},
        )

    # ── Analytics ──────────────────────────────────────────────────────────────

    @app.route('/api/analytics/breakdown')
    def analytics_breakdown():
        resolved = Signal.query.filter(
            Signal.user_id == g.user.id,
            Signal.actual_outcome.isnot(None),
            Signal.pnl.isnot(None),
        ).all()

        def aggregate(groups):
            result = []
            for key, items in sorted(groups.items(), key=lambda x: -len(x[1])):
                wins = sum(1 for s in items if s.actual_outcome == s.direction)
                total = len(items)
                pnl_cents = sum(s.pnl or 0 for s in items)
                wagered = sum(s.recommended_size or 0 for s in items)
                result.append({
                    'label': key,
                    'wins': wins,
                    'losses': total - wins,
                    'total': total,
                    'win_rate': round(wins / total * 100, 1) if total else 0.0,
                    'pnl_dollars': round(pnl_cents / 100.0, 2),
                    'roi_pct': round(pnl_cents / wagered * 100.0, 2) if wagered else 0.0,
                })
            return result

        by_stat, by_sport, by_direction, by_player = {}, {}, {}, {}
        for s in resolved:
            by_stat.setdefault(s.stat or '?', []).append(s)
            by_sport.setdefault(s.sport or 'NBA', []).append(s)
            by_direction.setdefault(s.direction or 'OVER', []).append(s)
            by_player.setdefault(s.player or 'Unknown', []).append(s)

        by_player_filtered = {k: v for k, v in by_player.items() if len(v) >= 3}
        by_player_agg = sorted(aggregate(by_player_filtered), key=lambda x: -x['pnl_dollars'])[:15]

        return jsonify({
            'by_stat': aggregate(by_stat),
            'by_sport': aggregate(by_sport),
            'by_direction': aggregate(by_direction),
            'by_player': by_player_agg,
            'total_resolved': len(resolved),
        })

    # ── Push Notifications ─────────────────────────────────────────────────────

    @app.route('/api/push/vapid-key')
    def get_vapid_key():
        return jsonify({'public_key': os.getenv('VAPID_PUBLIC_KEY', '')})

    @app.route('/api/push/subscribe', methods=['POST'])
    def push_subscribe():
        data = request.get_json() or {}
        endpoint = data.get('endpoint', '').strip()
        keys = data.get('keys', {})
        p256dh = keys.get('p256dh', '').strip()
        auth = keys.get('auth', '').strip()
        if not endpoint or not p256dh or not auth:
            return jsonify({'error': 'endpoint and keys.p256dh/auth are required'}), 400

        existing = PushSubscription.query.filter_by(
            user_id=g.user.id, endpoint=endpoint
        ).first()
        if existing:
            return jsonify({'message': 'Already subscribed'})

        sub = PushSubscription(user_id=g.user.id, endpoint=endpoint, p256dh=p256dh, auth=auth)
        db.session.add(sub)
        db.session.commit()
        return jsonify({'message': 'Push notifications enabled'}), 201

    @app.route('/api/push/subscribe', methods=['DELETE'])
    def push_unsubscribe():
        data = request.get_json() or {}
        endpoint = data.get('endpoint', '').strip()
        sub = PushSubscription.query.filter_by(user_id=g.user.id, endpoint=endpoint).first()
        if sub:
            db.session.delete(sub)
            db.session.commit()
        return jsonify({'message': 'Unsubscribed'})

    # ── Admin ──────────────────────────────────────────────────────────────────

    def _require_admin():
        if not g.user.is_admin():
            return jsonify({'error': 'Unauthorized'}), 403
        return None

    @app.route('/api/admin/stats')
    def admin_stats():
        err = _require_admin()
        if err:
            return err
        return jsonify({
            'total_users': User.query.count(),
            'total_signals': Signal.query.count(),
            'verified_users': User.query.filter_by(email_verified=True).count(),
        })

    @app.route('/api/admin/scan', methods=['POST'])
    def admin_trigger_scan():
        err = _require_admin()
        if err:
            return err
        from scheduler import run_signal_scan
        try:
            run_signal_scan(app)
            return jsonify({'status': 'done'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/demo/seed', methods=['POST'])
    def admin_seed_demo():
        err = _require_admin()
        if err:
            return err
        from alpha_stream.demo import seed_demo_signals
        try:
            count = seed_demo_signals(g.user.id, db.session, Signal)
            return jsonify({'status': 'ok', 'inserted': count})
        except Exception as e:
            logger.exception('Demo seed failed')
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/demo/clear', methods=['POST'])
    def admin_clear_demo():
        err = _require_admin()
        if err:
            return err
        from alpha_stream.demo import clear_demo_signals
        try:
            count = clear_demo_signals(g.user.id, db.session, Signal)
            return jsonify({'status': 'ok', 'deleted': count})
        except Exception as e:
            logger.exception('Demo clear failed')
            return jsonify({'error': str(e)}), 500

    @app.route('/api/admin/users')
    def admin_list_users():
        err = _require_admin()
        if err:
            return err
        users = User.query.order_by(User.created_at.desc()).limit(200).all()
        result = []
        for u in users:
            sig_count = Signal.query.filter_by(user_id=u.id).count()
            result.append({
                **u.to_dict(),
                'signal_count': sig_count,
            })
        return jsonify({'users': result})

    # ── Serve React ────────────────────────────────────────────────────────────

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        if path.startswith('api/'):
            return jsonify({'error': 'Not found'}), 404
        full_path = os.path.join(static_dir, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(static_dir, path)
        index = os.path.join(static_dir, 'index.html')
        if os.path.isfile(index):
            return send_from_directory(static_dir, 'index.html')
        return jsonify({'message': 'Alpha-Stream API'}), 200

    if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        start_scheduler(app)

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
