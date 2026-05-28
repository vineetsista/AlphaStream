import os
import secrets
import uuid
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# Kalshi series ticker → URL slug used in kalshi.com/markets/{series}/{slug}/{ticker}
# Confirmed format from live URL: kxmlbhit/pro-baseball-hits/{ticker}
_KALSHI_SLUGS = {
    'KXNBAPTS':         'pro-basketball-points',
    'KXNBAREB':         'pro-basketball-rebounds',
    'KXNBAAST':         'pro-basketball-assists',
    'KXNBASTL':         'pro-basketball-steals',
    'KXNBABLK':         'pro-basketball-blocks',
    'KXNBA3PT':         'pro-basketball-three-pointers',
    'KXNBAPLAYOFFPTS':  'pro-basketball-playoff-points',
    'KXNBAPA':          'pro-basketball-points-assists',
    'KXNBAPR':          'pro-basketball-points-rebounds',
    'KXNBAPRA':         'pro-basketball-points-rebounds-assists',
    'KXNBARA':          'pro-basketball-rebounds-assists',
    'KXMLBHIT':         'pro-baseball-hits',
    'KXMLBHR':          'pro-baseball-home-runs',
    'KXMLBRBI':         'pro-baseball-rbis',
    'KXMLBKS':          'pro-baseball-strikeouts',
    'KXMLBTB':          'pro-baseball-total-bases',
    'KXMLBHRR':         'pro-baseball-home-runs-rbis',
}


def _build_kalshi_url(ticker: str) -> str:
    if not ticker:
        return None
    parts = ticker.split('-')
    series = parts[0].upper()
    slug = _KALSHI_SLUGS.get(series)
    s = series.lower()
    # Kalshi web URLs use the game-event ticker (first 2 dash-segments only).
    # Player-level tickers (3+ segments) don't have their own pages — they all
    # resolve to the parent game market, so we strip the player/threshold suffix.
    if len(parts) >= 2:
        game_ticker = f'{parts[0]}-{parts[1]}'.lower()
        if slug:
            return f'https://kalshi.com/markets/{s}/{slug}/{game_ticker}'
    return f'https://kalshi.com/markets/{s}'


def _get_fernet():
    from cryptography.fernet import Fernet
    key_material = os.getenv('FLASK_SECRET_KEY', 'alpha-stream-dev-secret-key-32chars!!')
    key_bytes = hashlib.sha256(key_material.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def encrypt_value(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    try:
        return _get_fernet().encrypt(plaintext.encode()).decode()
    except Exception:
        return plaintext


def decrypt_value(ciphertext: str) -> str:
    if not ciphertext:
        return ciphertext
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return ciphertext


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), nullable=False, unique=True)
    password_hash = db.Column(db.String(256), nullable=True)
    email_verified = db.Column(db.Boolean, nullable=True, default=None)
    verification_token = db.Column(db.String(100), nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    api_key = db.Column(db.String(64), nullable=True, unique=True, index=True)
    # Encrypted Kalshi API key
    _kalshi_api_key = db.Column('kalshi_api_key', db.String(512), nullable=True)
    discord_webhook_url = db.Column(db.String(512), nullable=True)
    # Bankroll in cents
    bankroll = db.Column(db.Integer, nullable=True, default=100000)
    kelly_fraction = db.Column(db.Float, nullable=False, default=0.25)
    # Auto-execution
    auto_bet_enabled = db.Column(db.Boolean, nullable=False, default=False)
    auto_bet_min_confidence = db.Column(db.Float, nullable=False, default=85.0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    signals = db.relationship('Signal', backref='user', lazy=True, cascade='all, delete-orphan')
    watched_markets = db.relationship('WatchedMarket', backref='user', lazy=True, cascade='all, delete-orphan')
    push_subscriptions = db.relationship('PushSubscription', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def has_password(self):
        return self.password_hash is not None

    def generate_verification_token(self):
        self.verification_token = secrets.token_urlsafe(32)
        self.email_verified = False
        return self.verification_token

    def generate_reset_token(self):
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        return self.reset_token

    def ensure_api_key(self):
        if not self.api_key:
            self.api_key = uuid.uuid4().hex
        return self.api_key

    def rotate_api_key(self):
        self.api_key = uuid.uuid4().hex
        return self.api_key

    def is_admin(self):
        # Default admin so the project owner always has access without extra env config.
        admin_email = os.getenv('ADMIN_EMAIL', 'vineet.sista@gmail.com')
        return bool(admin_email) and self.email.lower() == admin_email.lower()

    @property
    def kalshi_api_key(self):
        return decrypt_value(self._kalshi_api_key)

    @kalshi_api_key.setter
    def kalshi_api_key(self, value):
        self._kalshi_api_key = encrypt_value(value) if value else None

    def bankroll_dollars(self):
        return (self.bankroll or 0) / 100.0

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'email_verified': self.email_verified,
            'is_admin': self.is_admin(),
            'discord_webhook_url': self.discord_webhook_url,
            'has_kalshi_key': bool(self._kalshi_api_key),
            'bankroll': self.bankroll or 0,
            'bankroll_dollars': self.bankroll_dollars(),
            'kelly_fraction': self.kelly_fraction,
            'auto_bet_enabled': self.auto_bet_enabled,
            'auto_bet_min_confidence': self.auto_bet_min_confidence,
            'created_at': self.created_at.isoformat(),
        }


class Signal(db.Model):
    __tablename__ = 'signals'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    event_id = db.Column(db.String(200), nullable=False)
    player = db.Column(db.String(200), nullable=False)
    team = db.Column(db.String(100), nullable=True)
    stat = db.Column(db.String(50), nullable=False)
    line = db.Column(db.Float, nullable=False)
    model_prob = db.Column(db.Float, nullable=False)
    market_prob = db.Column(db.Float, nullable=False)
    z_score = db.Column(db.Float, nullable=False)
    ev = db.Column(db.Float, nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    direction = db.Column(db.String(10), nullable=False)  # OVER / UNDER
    # Recommended size in cents
    recommended_size = db.Column(db.Integer, nullable=True)
    actual_outcome = db.Column(db.String(10), nullable=True)  # OVER / UNDER / None
    # PnL in cents
    pnl = db.Column(db.Integer, nullable=True)
    kalshi_ticker = db.Column(db.String(200), nullable=True)
    sport = db.Column(db.String(10), nullable=True, default='NBA')
    volume_spike = db.Column(db.Boolean, nullable=True, default=False)
    position = db.Column(db.String(20), nullable=True)
    streak_score = db.Column(db.Float, nullable=True)
    last_5_results = db.Column(db.String(10), nullable=True)
    model_mean = db.Column(db.Float, nullable=True)
    model_std = db.Column(db.Float, nullable=True)
    sample_size = db.Column(db.Integer, nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'event_id': self.event_id,
            'player': self.player,
            'team': self.team,
            'stat': self.stat,
            'line': self.line,
            'model_prob': round(self.model_prob, 4),
            'market_prob': round(self.market_prob, 4),
            'z_score': round(self.z_score, 3),
            'ev': round(self.ev, 4),
            'ev_pct': round(self.ev * 100, 2),
            'confidence': round(self.confidence, 1),
            'direction': self.direction,
            'recommended_size': self.recommended_size or 0,
            'recommended_size_dollars': round((self.recommended_size or 0) / 100.0, 2),
            'actual_outcome': self.actual_outcome,
            'pnl': self.pnl,
            'pnl_dollars': round((self.pnl or 0) / 100.0, 2),
            'kalshi_ticker': self.kalshi_ticker,
            'kalshi_url': _build_kalshi_url(self.kalshi_ticker),
            'sport': self.sport or 'NBA',
            'volume_spike': bool(self.volume_spike),
            'position': self.position or '',
            'streak_score': round(self.streak_score or 0.5, 2),
            'last_5_results': self.last_5_results or '',
            'model_mean': round(self.model_mean or 0.0, 2),
            'model_std': round(self.model_std or 0.0, 2),
            'sample_size': self.sample_size or 0,
            'timestamp': self.timestamp.isoformat(),
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
        }


class WatchedMarket(db.Model):
    __tablename__ = 'watched_markets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    kalshi_ticker = db.Column(db.String(200), nullable=False)
    label = db.Column(db.String(500), nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'kalshi_ticker': self.kalshi_ticker,
            'label': self.label,
            'active': self.active,
            'kalshi_url': _build_kalshi_url(self.kalshi_ticker),
            'created_at': self.created_at.isoformat(),
        }


class PushSubscription(db.Model):
    __tablename__ = 'push_subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    endpoint = db.Column(db.Text, nullable=False, unique=True)
    p256dh = db.Column(db.String(512), nullable=False)
    auth = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
