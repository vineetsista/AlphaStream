<div align="center">

# α  Alpha-Stream

**A self-hosted quant engine for Kalshi player-prop markets.**

Z-score anomaly detection · fractional-Kelly sizing · live Discord alerts · multi-sport coverage.

<p>
  <a href="https://github.com/vineetsista/AlphaStream/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/vineetsista/AlphaStream/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white">
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white">
  <img alt="Postgres" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-10D97B">
  <img alt="Status" src="https://img.shields.io/badge/status-personal%20project-A855F7">
</p>

<!--
  Drop a hero screenshot at docs/screenshots/landing-hero.png and uncomment:
  <img src="docs/screenshots/landing-hero.png" alt="Alpha-Stream landing" width="900">
-->

</div>

---

## What it is

Alpha-Stream pulls live prices from Kalshi player-prop markets every five minutes, compares them against a player's rolling 20-game empirical distribution, and surfaces statistically anomalous lines as **signals** — each one sized with fractional Kelly, scored for confidence, and (optionally) pushed to Discord.

It is a **personal project**. There is no paywall, no subscription, no SaaS. You run it locally, drop in your own Kalshi API key, and the engine works for you.

> **Not financial advice.** Prediction-market trading involves real risk of loss. Use at your own discretion.

---

## Features

| | |
|---|---|
| 📐 **Z-score anomaly engine** | Rolling 20-game mean & σ. Blended CDF (60% normal, 40% empirical) flags real outliers, not noise. |
| ⚖️ **Fractional Kelly sizing** | Auto-sizes each bet. Hard 25% per-bet cap, 15% per-team exposure cap to limit correlated drawdowns. |
| 📡 **Multi-sport coverage** | NBA, MLB, and NFL player props — points, rebounds, assists, 3PM, hits, HR, RBI, K, passing yards, etc. |
| 🔔 **Live Discord alerts** | Signals over 80 confidence broadcast to your server as rich embeds with deep-links to Kalshi. |
| 📊 **30-day backtesting** | Win rate, ROI, Sharpe, max drawdown, daily P&L curve — auto-resolves outcomes from official stat APIs. |
| 🎯 **Auto-execution** *(optional)* | Above a confidence threshold you set, the engine can place orders directly via the Kalshi Trading API. |
| 🛰️ **Server-Sent Events feed** | Dashboard receives new signals instantly — no polling delay. |
| 🔐 **AES-256 at rest** | Your Kalshi API key is encrypted with a Fernet key derived from your Flask secret. Never logged, never transmitted plain. |
| 📈 **Calibration tracking** | Reliability diagram — measures whether the model's 70% bets really win 70% of the time. |
| 🧪 **Demo slate** | Seed ~44 realistic signals with one click for screenshots/demos without burning API credits. |

---

## Screenshots

> Drop PNGs into `docs/screenshots/` and uncomment the table rows below. See `docs/screenshots/README.md` for the suggested capture list.

<!--
| | |
|:---:|:---:|
| ![Landing](docs/screenshots/landing-hero.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| **Landing — gradient hero + radar scan** | **Live signal feed with SSE auto-updates** |
| ![Signal drawer](docs/screenshots/signal-drawer.png) | ![Backtest](docs/screenshots/backtest.png) |
| **Per-signal drawer — game logs + bell curve** | **30-day backtest with P&L curve** |
| ![Portfolio](docs/screenshots/portfolio.png) | ![Discord alert](docs/screenshots/discord-alert.png) |
| **Exposure breakdown by team / stat / sport** | **Live Discord webhook embed** |
-->

---

## Architecture

```
                         ┌──────────────────────────────────────────────┐
                         │                  Scheduler                   │
                         │       (APScheduler, every 5 minutes)         │
                         └────────────────────┬─────────────────────────┘
                                              │
              ┌───────────────────────────────┼────────────────────────────────┐
              ▼                               ▼                                ▼
      ┌───────────────┐               ┌──────────────┐                 ┌───────────────┐
      │ Kalshi Markets│               │   NBA API    │                 │  MLB / NFL    │
      │  (RSA auth)   │               │   stats.nba  │                 │   stat APIs   │
      └───────┬───────┘               └──────┬───────┘                 └───────┬───────┘
              │                              │                                 │
              └──────────────┬───────────────┴────────────────┬────────────────┘
                             ▼                                ▼
                  ┌──────────────────────┐         ┌─────────────────────┐
                  │     Harvester        │ ─────►  │  Anomaly Engine     │
                  │ (snapshots + parsing)│         │  (Z-score, EV, CDF) │
                  └──────────────────────┘         └──────────┬──────────┘
                                                              │
                                            ┌─────────────────┼────────────────┐
                                            ▼                 ▼                ▼
                                   ┌────────────────┐ ┌──────────────┐ ┌─────────────────┐
                                   │ Kelly Sizing   │ │ Vault (DB)   │ │ Discord Gateway │
                                   │ + dedup/correl │ │ Postgres/SQL │ │ + SSE stream    │
                                   └────────────────┘ └──────┬───────┘ └─────────────────┘
                                                             ▼
                                                  ┌────────────────────┐
                                                  │  React Dashboard   │
                                                  │ (Vite + Framer)    │
                                                  └────────────────────┘
```

### Backend (`/backend`)
| Module | What it does |
|---|---|
| `app.py` | Flask app, all REST routes, SSE stream, auth, rate limiting. |
| `models.py` | SQLAlchemy models — `User`, `Signal`, `WatchedMarket`, `PushSubscription`. Encrypts the Kalshi key at rest. |
| `scheduler.py` | APScheduler jobs — 5-min signal scan, daily outcome resolution, morning digest email. |
| `alpha_stream/harvester.py` | Pulls Kalshi snapshots + per-player game logs for NBA/MLB/NFL. |
| `alpha_stream/alpha.py` | The anomaly engine — Z-score, blended CDF probability, EV math, correlation dedup. |
| `alpha_stream/vault.py` | Fractional Kelly sizing with hard per-bet and per-team caps. |
| `alpha_stream/backtester.py` | Walks resolved signals to compute win rate, ROI, Sharpe, max drawdown, daily P&L. |
| `alpha_stream/execution.py` | Optional auto-order placement via Kalshi Trading API. |
| `alpha_stream/gateway.py` | Discord webhook embeds + DB persistence. |
| `alpha_stream/injury_feed.py` | NBA/MLB injury feed — suppresses signals for out/doubtful players. |
| `alpha_stream/demo.py` | One-click demo slate seeder. |

### Frontend (`/frontend`)
React 18 + Vite + Framer Motion. Glassmorphic dark theme, particle background, animated radar, live SSE feed, recharts P&L curves. Pages: Landing · Dashboard · Backtest · Portfolio · Analytics · Settings · Admin.

---

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/vineetsista/AlphaStream.git
cd AlphaStream

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Configure

```bash
cp .env.example backend/.env
# Edit backend/.env — at minimum set FLASK_SECRET_KEY
```

If you want live Kalshi data, also:
1. Visit [kalshi.com → API Keys](https://kalshi.com/account/profile) → Create Key (Read/Write)
2. Save the RSA private key as `backend/kalshi_key.pem`
3. Add the key ID to `backend/.env` as `KALSHI_KEY_ID`

### 3. Run

```bash
# Terminal 1 — Flask API on :5000
cd backend
python app.py

# Terminal 2 — Vite dev server on :3000 (proxies /api to :5000)
cd frontend
npm run dev
```

Open <http://localhost:3000>, create an account, click **Settings → Kalshi**, paste your key, and you're live.

### 4. Production build

```bash
cd frontend
npm run build           # outputs to backend/static/
cd ../backend
gunicorn app:app --bind 0.0.0.0:8000 --workers 2 --timeout 120
```

A `Dockerfile` and `railway.toml` are included for one-command container deploys.

---

## The math

For each market, the engine fetches the player's last ~20 game logs for the stat in question, computes mean μ and standard deviation σ, then:

```
z       = (line − μ) / σ
p_model = 0.60 · Φ(z)        +  0.40 · (% of games over line)
                ↑ normal CDF       ↑ empirical exceedance rate

EV      = p_model · (1 / price) − (1 − p_model)
size    = bankroll · kelly_fraction · (p_model · odds − (1 − p_model)) / odds
```

A signal fires when:
- `|z| > 1σ` from rolling history
- `EV > 0` against Kalshi's implied probability
- The player isn't on the injury report
- Confidence ≥ 75 after blending price action + sample-size penalties

Correlated signals (PTS + PRA, REB + RA, …) collapse to the single highest-confidence variant.

---

## Tech stack

**Backend** — Python 3.11 · Flask · SQLAlchemy · APScheduler · NumPy · SciPy · cryptography · aiohttp · nba_api · mlb-statsapi · SendGrid (optional)

**Frontend** — React 18 · Vite · Framer Motion · React Router · Recharts

**Infra** — PostgreSQL (or SQLite for dev) · Docker · Railway · Web Push (VAPID)

---

## Project layout

```
.
├── backend/
│   ├── app.py                # Flask app & all routes
│   ├── models.py             # User, Signal, WatchedMarket, PushSubscription
│   ├── scheduler.py          # APScheduler jobs (scan / resolve / digest)
│   ├── email_delivery.py     # Transactional + digest emails (SendGrid)
│   ├── requirements.txt
│   └── alpha_stream/
│       ├── alpha.py          # Z-score + EV anomaly engine
│       ├── harvester.py      # Kalshi + NBA/MLB/NFL data pull
│       ├── vault.py          # Fractional Kelly sizing
│       ├── backtester.py     # Win rate / ROI / Sharpe / drawdown
│       ├── execution.py      # Optional auto-bet via Kalshi Trading API
│       ├── gateway.py        # Discord embeds + signal persistence
│       ├── injury_feed.py    # NBA/MLB injury suppression
│       └── demo.py           # Demo-slate seeder
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── components/       # NavBar, SignalCard, ConfidenceRing, RadarScan, …
│   │   ├── hooks/            # useParticles, useDemo
│   │   └── pages/            # Landing, Dashboard, Backtest, Portfolio, Analytics, Settings, Admin
│   ├── vite.config.js
│   └── package.json
├── Dockerfile
├── railway.toml
├── .env.example
└── README.md
```

---

## Roadmap

- [ ] WNBA and NHL coverage
- [ ] Multi-leg parlay correlation modeling
- [ ] Pluggable model registry (XGBoost head-to-head)
- [ ] Live PnL websocket for the portfolio page
- [ ] Mobile-first redesign

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
  <sub>Built for the love of the math. Not financial advice. Trade responsibly.</sub>
</div>
