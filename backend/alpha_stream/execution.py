"""
Kalshi order execution — auto-places YES/NO bets on qualifying signals.
Uses RSA-PSS auth (same keypair as KalshiHarvester).
Only fires when user.auto_bet_enabled=True and confidence >= auto_bet_min_confidence.
"""
import base64
import json
import logging
import os
import time
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

KALSHI_ORDERS_URL = 'https://api.elections.kalshi.com/trade-api/v2/portfolio/orders'
KALSHI_ORDERS_PATH = '/trade-api/v2/portfolio/orders'


def _load_private_key():
    from cryptography.hazmat.primitives import serialization
    pem_path = os.getenv('KALSHI_PRIVATE_KEY_PATH', '')
    if not pem_path:
        for candidate in [
            os.path.join(os.path.dirname(__file__), '..', 'kalshi_key.pem'),
            os.path.join(os.path.dirname(__file__), 'kalshi_key.pem'),
        ]:
            if os.path.exists(candidate):
                pem_path = candidate
                break
    if not pem_path or not os.path.exists(pem_path):
        return None
    try:
        with open(pem_path, 'rb') as f:
            return serialization.load_pem_private_key(f.read(), password=None)
    except Exception as e:
        logger.warning('Execution: private key load failed: %s', e)
        return None


def _auth_headers(method: str, path: str) -> dict:
    key_id = os.getenv('KALSHI_KEY_ID', '')
    private_key = _load_private_key()
    if not private_key or not key_id:
        return {}
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    ts = str(int(time.time() * 1000))
    msg = (ts + method + path).encode()
    sig = private_key.sign(
        msg,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
        hashes.SHA256(),
    )
    return {
        'Kalshi-Access-Key': key_id,
        'Kalshi-Access-Timestamp': ts,
        'Kalshi-Access-Signature': base64.b64encode(sig).decode(),
        'Content-Type': 'application/json',
    }


def place_order(ticker: str, side: str, count: int, price_cents: int) -> dict:
    """
    Place a limit order on Kalshi.
    side: 'yes' or 'no'
    price_cents: limit price in cents (1–99)
    Returns Kalshi response dict or {'error': str}.
    """
    if price_cents <= 0 or price_cents >= 100 or count <= 0:
        return {'error': f'Invalid order params: side={side} count={count} price={price_cents}'}

    body = {
        'ticker': ticker,
        'action': 'buy',
        'side': side,
        'count': count,
        'type': 'limit',
        'yes_price': price_cents,
    }
    headers = _auth_headers('POST', KALSHI_ORDERS_PATH)
    if not headers:
        return {'error': 'Kalshi credentials not configured — check KALSHI_KEY_ID and key file'}

    try:
        payload = json.dumps(body).encode('utf-8')
        req = urllib.request.Request(KALSHI_ORDERS_URL, data=payload, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            order = result.get('order', {})
            logger.info('Auto-bet placed: %s %s×%d @ %d¢ → status=%s id=%s',
                        ticker, side, count, price_cents, order.get('status'), order.get('id'))
            return result
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        logger.error('Kalshi order HTTP %d for %s: %s', e.code, ticker, body_bytes)
        return {'error': f'HTTP {e.code}: {body_bytes.decode(errors="replace")}'}
    except Exception as e:
        logger.error('Kalshi order failed for %s: %s', ticker, e)
        return {'error': str(e)}


def auto_execute_signal(signal, user) -> Optional[dict]:
    """
    Execute a signal if user's auto-bet is enabled and confidence threshold is met.
    Returns execution result dict, or None if not executed.
    """
    if not getattr(user, 'auto_bet_enabled', False):
        return None
    min_conf = getattr(user, 'auto_bet_min_confidence', 85.0)
    if signal.confidence < min_conf:
        return None
    if not signal.kalshi_ticker:
        return None
    if not signal.recommended_size or signal.recommended_size <= 0:
        return None

    # Derive order params from signal
    if signal.direction == 'OVER':
        side = 'yes'
        price_cents = max(1, min(99, int(signal.market_prob * 100)))
    else:
        side = 'no'
        # NO price = 100 - YES price
        yes_cents = max(1, min(99, int(signal.market_prob * 100)))
        price_cents = 100 - yes_cents

    cost_per_contract = price_cents  # cents per contract
    contracts = max(1, int(signal.recommended_size / cost_per_contract))

    return place_order(signal.kalshi_ticker, side, contracts, price_cents)
