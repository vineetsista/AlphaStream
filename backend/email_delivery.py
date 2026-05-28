import os
import re
import html as _html_module
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

APP_NAME = 'Alpha-Stream'
BRAND_COLOR = '#4f7cf6'
ACCENT_COLOR = '#06b6d4'


def _html_to_text(html_body: str) -> str:
    text = re.sub(r'<style[^>]*>.*?</style>', '', html_body, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</?(tr|p|div|li|h[1-6])[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = _html_module.unescape(text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _send_transactional_email(to_email: str, subject: str, html_body: str) -> bool:
    api_key = os.getenv('SENDGRID_API_KEY')
    from_email = os.getenv('SENDGRID_FROM_EMAIL')
    if not api_key or not from_email:
        logger.warning('SendGrid not configured — skipping email to %s', to_email)
        return False
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        plain = _html_to_text(html_body)
        message = Mail(
            from_email=Email(from_email, APP_NAME),
            to_emails=To(to_email),
            subject=subject,
        )
        message.add_content(Content('text/plain', plain))
        message.add_content(Content('text/html', html_body))
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        resp = sg.send(message)
        return resp.status_code in (200, 202)
    except Exception as e:
        logger.error('Email send failed to %s: %s', to_email, e)
        return False


def _email_shell(title: str, subtitle: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#050c18,#0d1829);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#7a8fa6;margin-bottom:6px;">{APP_NAME}</div>
    <div style="font-size:22px;font-weight:800;color:#f0f4ff;letter-spacing:-0.03em;margin-bottom:4px;">{title}</div>
    <div style="font-size:13px;color:#7a8fa6;">{subtitle}</div>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,{BRAND_COLOR},{ACCENT_COLOR});"></td></tr>
  <tr><td style="padding:36px;">{body_html}</td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">{APP_NAME} · Not financial advice · Prediction market trading involves risk of loss</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def send_verification_email(to_email: str, name: str, token: str, app_url: str) -> bool:
    verify_url = f'{app_url}/verify-email?token={token}'
    body = f"""
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 32px;">
      Welcome to {APP_NAME}. Click below to verify your email and activate your account.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,{BRAND_COLOR},{ACCENT_COLOR});color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
        Verify My Email →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>"""
    html = _email_shell('Verify your email', 'One click to activate your account', body)
    return _send_transactional_email(to_email, f'Verify your {APP_NAME} email', html)


def send_welcome_email(to_email: str, name: str, app_url: str) -> bool:
    body = f"""
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">
      Your {APP_NAME} account is active. Here's how to get started:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:14px;color:#334155;line-height:1.6;padding-top:4px;"><strong>1. Add your Kalshi API key</strong> — go to Settings to connect your Kalshi account.</div>
      </td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:14px;color:#334155;line-height:1.6;padding-top:4px;"><strong>2. Set your bankroll</strong> — declare your bankroll so we can size positions with Kelly Criterion.</div>
      </td></tr>
      <tr><td style="padding:12px 0;">
        <div style="font-size:14px;color:#334155;line-height:1.6;padding-top:4px;"><strong>3. Watch the signal feed</strong> — we scan for +EV opportunities every 5 minutes during game windows.</div>
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="{app_url}/dashboard" style="display:inline-block;background:linear-gradient(135deg,{BRAND_COLOR},{ACCENT_COLOR});color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
        Open Dashboard →
      </a>
    </div>"""
    html = _email_shell(f'Welcome to {APP_NAME}', 'Your account is active', body)
    return _send_transactional_email(to_email, f'Welcome to {APP_NAME}, {name}', html)


def send_password_reset_email(to_email: str, name: str, token: str, app_url: str) -> bool:
    reset_url = f'{app_url}/reset-password?token={token}'
    body = f"""
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 24px;">Hi {name},</p>
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 32px;">
      We received a request to reset your password. Click below — this link expires in 1 hour.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,{BRAND_COLOR},{ACCENT_COLOR});color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
        Reset My Password →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
      If you didn't request this, ignore this email. Your password won't change.
    </p>"""
    html = _email_shell('Reset your password', 'Link expires in 1 hour', body)
    return _send_transactional_email(to_email, f'Reset your {APP_NAME} password', html)


def send_signal_digest_email(
    to_email: str,
    name: str,
    yesterday_signals: list,
    top_signals: list,
    perf_stats: dict,
    app_url: str,
) -> bool:
    from datetime import date
    today = date.today().strftime('%B %d, %Y')

    def _outcome_row(sig) -> str:
        is_win = sig.actual_outcome == sig.direction
        color = '#16a34a' if is_win else '#dc2626'
        label = 'WIN' if is_win else 'LOSS'
        pnl_str = ''
        if sig.pnl is not None:
            dollars = sig.pnl / 100.0
            pnl_str = f' · <strong style="color:{color}">{("+" if dollars >= 0 else "")}${abs(dollars):.2f}</strong>'
        return (
            f'<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">'
            f'{sig.player} — {sig.stat} {sig.direction} {sig.line}</td>'
            f'<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">'
            f'<span style="color:{color};font-weight:700;font-size:12px;">{label}{pnl_str}</span></td></tr>'
        )

    def _open_row(sig) -> str:
        ev_pct = round(sig.ev * 100, 1) if sig.ev else 0
        return (
            f'<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">'
            f'{sig.player} — {sig.stat} {sig.direction} {sig.line}</td>'
            f'<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px;color:#475569;">'
            f'Conf {sig.confidence:.0f} · EV +{ev_pct}%</td></tr>'
        )

    yesterday_rows = ''.join(_outcome_row(s) for s in yesterday_signals) or (
        '<tr><td colspan="2" style="padding:12px 0;font-size:13px;color:#94a3b8;text-align:center;">No resolved signals yesterday</td></tr>'
    )
    open_rows = ''.join(_open_row(s) for s in top_signals) or (
        '<tr><td colspan="2" style="padding:12px 0;font-size:13px;color:#94a3b8;text-align:center;">No open signals</td></tr>'
    )

    pnl = perf_stats.get('total_pnl_dollars', 0)
    pnl_color = '#16a34a' if pnl >= 0 else '#dc2626'
    pnl_str = f'{("+" if pnl >= 0 else "")}${abs(pnl):.2f}'

    body = f"""
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 20px;">Good morning, {name} 👋</p>

    <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:10px;">30-Day Performance</div>
      <div style="display:flex;gap:24px;">
        <div><div style="font-size:22px;font-weight:800;color:{pnl_color};">{pnl_str}</div><div style="font-size:11px;color:#94a3b8;">Total P&amp;L</div></div>
        <div><div style="font-size:22px;font-weight:800;color:#1e293b;">{perf_stats.get("win_rate", 0)}%</div><div style="font-size:11px;color:#94a3b8;">Win Rate</div></div>
        <div><div style="font-size:22px;font-weight:800;color:#1e293b;">{perf_stats.get("signals_30d", 0)}</div><div style="font-size:11px;color:#94a3b8;">Signals</div></div>
      </div>
    </div>

    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Yesterday's Outcomes</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">{yesterday_rows}</table>

    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Top Open Signals</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">{open_rows}</table>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="{app_url}/dashboard" style="display:inline-block;background:linear-gradient(135deg,{BRAND_COLOR},{ACCENT_COLOR});color:#fff;text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:700;font-size:14px;">
        Open Dashboard →
      </a>
    </div>
    <p style="font-size:11px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
      This digest is sent daily at 7am ET. Outcomes resolve automatically at 9am ET.
    </p>"""

    html = _email_shell(f'Your Daily Signal Digest', today, body)
    return _send_transactional_email(to_email, f'Alpha-Stream Digest — {today}', html)
