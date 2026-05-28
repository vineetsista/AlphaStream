import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import useParticles from '../hooks/useParticles';
import AnimatedCounter from '../components/AnimatedCounter';
import TiltCard from '../components/TiltCard';
import ConfidenceRing from '../components/ConfidenceRing';
import RadarScan from '../components/RadarScan';
import GlitchText from '../components/GlitchText';
import DiscordMockup from '../components/DiscordMockup';
import BellCurve from '../components/BellCurve';

/* ────────────────────── Data ────────────────────── */

const TICKER_ITEMS = [
  { text: 'LeBron James OVER 25.5 PTS', ev: '+8.2%', dir: 'OVER' },
  { text: 'Steph Curry OVER 4.5 AST', ev: '+6.7%', dir: 'OVER' },
  { text: 'Nikola Jokic OVER 11.5 REB', ev: '+11.3%', dir: 'OVER' },
  { text: 'Jayson Tatum UNDER 3.5 3PM', ev: '+5.1%', dir: 'UNDER' },
  { text: 'Luka Doncic OVER 28.5 PTS', ev: '+9.4%', dir: 'OVER' },
  { text: 'Anthony Davis OVER 13.5 REB', ev: '+7.8%', dir: 'OVER' },
  { text: 'Kevin Durant OVER 27.5 PTS', ev: '+6.2%', dir: 'OVER' },
  { text: 'Giannis OVER 12.5 REB', ev: '+10.1%', dir: 'OVER' },
];

const CYCLING_SIGNALS = [
  { player: 'LeBron James', team: 'LAL', stat: 'PTS', line: 25.5, dir: 'OVER', conf: 87, ev: 8.2, z: 2.41 },
  { player: 'Nikola Jokic', team: 'DEN', stat: 'REB', line: 11.5, dir: 'OVER', conf: 92, ev: 11.3, z: 3.12 },
  { player: 'Luka Doncic', team: 'DAL', stat: 'PTS', line: 28.5, dir: 'OVER', conf: 83, ev: 6.8, z: 2.07 },
  { player: 'Jayson Tatum', team: 'BOS', stat: '3PM', line: 3.5, dir: 'UNDER', conf: 74, ev: 5.1, z: 1.93 },
];

const PIPELINE_STEPS = [
  {
    num: '01',
    icon: '📡',
    title: 'Harvest',
    subtitle: 'Every 5 minutes',
    desc: 'Pulls live odds from 200+ player prop markets across NBA, MLB, and NFL on Kalshi alongside the last 10 game logs from official sports stats APIs.',
    color: '#00ff88',
    glow: 'rgba(0,255,136,0.3)',
  },
  {
    num: '02',
    icon: '⚗️',
    title: 'Analyze',
    subtitle: 'Z-score + EV engine',
    desc: 'Z-score anomaly detection blended with scipy normal CDF against the empirical distribution. Edge = model probability minus market implied.',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.3)',
  },
  {
    num: '03',
    icon: '🎯',
    title: 'Size & Fire',
    subtitle: 'Kelly Criterion + Discord',
    desc: 'Fractional Kelly sizes the bet. 25% single-bet cap. 15% team exposure cap. Signals above confidence 80 hit your Discord instantly.',
    color: '#ff6b35',
    glow: 'rgba(255,107,53,0.3)',
  },
];

const FEATURES = [
  { icon: '📐', title: 'Z-Score Anomaly Engine', desc: 'Rolling 10-game mean and σ. Minimum 5 games required. Blended CDF model (60% normal, 40% empirical) surfaces true statistical outliers.', color: '#00ff88' },
  { icon: '⚖️', title: 'Kelly Criterion Sizing', desc: 'Fractional Kelly auto-calculates bet size. Hard cap at 25% per bet. Per-team exposure limit at 15% to prevent correlated drawdowns.', color: '#a855f7' },
  { icon: '📡', title: 'Kalshi Integration', desc: 'Live market data pulled directly from Kalshi trading API. Your encrypted API key connects to your account for direct market access.', color: '#ff6b35' },
  { icon: '📊', title: '30-Day Backtesting', desc: 'Win rate, ROI, Sharpe ratio, and max drawdown over rolling 30-day windows. Full P&L curve with daily granularity.', color: '#f59e0b' },
  { icon: '🔔', title: 'Discord Alerts', desc: 'Signals with confidence > 80 broadcast to your server as rich embeds — player, line, EV, Kelly size, and a Kalshi deep-link.', color: '#00ff88' },
  { icon: '🔐', title: 'Encrypted at Rest', desc: 'Kalshi API key AES-256 encrypted using a Fernet key derived from your server secret. Never logged, never transmitted plain.', color: '#a855f7' },
];

const FAQS = [
  { q: 'How is Expected Value calculated?', a: 'EV = model_probability × (1 / market_price) − (1 − model_probability). A positive EV means the model estimates a higher win probability than Kalshi\'s implied odds reflect — that\'s the edge.' },
  { q: 'What\'s the minimum games requirement?', a: 'We require at least 5 games of history for a player to generate a signal. With fewer data points the Z-score is statistically unreliable. 10 games is the rolling window size.' },
  { q: 'How does team exposure work?', a: 'Across all pending signals, no single team can account for more than 15% of your bankroll. This prevents a bad night from one team from cratering your bankroll.' },
  { q: 'What markets does Alpha-Stream cover?', a: 'NBA player props (points, rebounds, assists, 3PM), MLB player props (hits, home runs, RBI, strikeouts), and NFL player props (passing yards, rushing yards, touchdowns) — all on Kalshi. Coverage expands as Kalshi adds new market types.' },
  { q: 'Is this open source?', a: 'Yes. Alpha-Stream is a self-hosted personal project. Clone the repo, drop in your Kalshi API key, and run it on your own machine. No payment, no SaaS lock-in.' },
];

/* ────────────────────── Animations ────────────────────── */

const stagger = (delay = 0.1) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.15 } },
});
const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.7 } },
};

/* ────────────────────── Terminal ────────────────────── */

const TERM_LINES = [
  { text: '$ alpha-stream scan --user=you', delay: 0 },
  { text: '↳ Fetching 247 Kalshi markets (NBA/MLB/NFL)…', delay: 500 },
  { text: '↳ Harvesters: 18 NBA + 12 MLB logs cached', delay: 950 },
  { text: '↳ Z-score: LeBron.PTS  μ=22.1  σ=3.4  val=27.2', delay: 1400, hl: true },
  { text: '↳ z = +2.41σ  →  model_prob = 0.611', delay: 1800, hl: true },
  { text: '↳ market_price = 0.41  EV = +8.2%', delay: 2200, hl: true },
  { text: '↳ Kelly size = $127  (2.1% of $6,000)', delay: 2600 },
  { text: '✓ Signal persisted  conf=87', delay: 3000, ok: true },
  { text: '✓ Discord embed posted  → #alpha-signals', delay: 3400, ok: true },
];

function Terminal() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timers = TERM_LINES.map((l, i) => setTimeout(() => setShown(i + 1), l.delay + 400));
    const loop = setTimeout(() => setShown(0), 5500);
    return () => { timers.forEach(clearTimeout); clearTimeout(loop); };
  }, [shown === 0 ? shown : -1]);

  useEffect(() => { setShown(1); }, []);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span style={{ background: '#ff5f57' }} />
        <span style={{ background: '#febc2e' }} />
        <span style={{ background: '#28c840' }} />
        <span style={{ marginLeft: 10, opacity: 0.45, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          alpha-stream — signal-engine
        </span>
      </div>
      <div className="terminal-body" style={{ minHeight: 220 }}>
        <div className="scan-line" />
        {TERM_LINES.slice(0, shown).map((l, i) => (
          <motion.div
            key={`${shown}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              color: l.ok ? 'var(--success)' : l.hl ? '#f59e0b' : 'rgba(200,255,220,0.65)',
              fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 3, lineHeight: 1.6,
            }}
          >
            {l.text}{i === shown - 1 && <span className="cursor" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────── Signal demo card ────────────────────── */

function CyclingSignalCard() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % CYCLING_SIGNALS.length), 3800);
    return () => clearInterval(t);
  }, []);

  const sig = CYCLING_SIGNALS[idx];
  const isOver = sig.dir === 'OVER';
  const dirColor = isOver ? 'var(--success)' : '#ef4444';

  return (
    <div style={{ position: 'relative', height: 260 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="glass"
          style={{
            position: 'absolute', inset: 0, borderRadius: 18,
            padding: 28, borderLeft: `3px solid ${dirColor}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(180,255,210,0.4)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
                {sig.team} · {sig.stat}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em' }}>{sig.player}</div>
              <div style={{
                display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 8,
                background: isOver ? 'rgba(0,255,136,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${isOver ? 'rgba(0,255,136,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 8, padding: '5px 12px',
              }}>
                <span style={{ color: dirColor, fontWeight: 800, fontSize: 13 }}>{sig.dir}</span>
                <span style={{ color: 'rgba(200,255,220,0.5)', fontSize: 13 }}>{sig.line}</span>
              </div>
            </div>
            <ConfidenceRing value={sig.conf} size={76} stroke={6} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'EV', value: `+${sig.ev}%`, color: 'var(--success)' },
              { label: 'Z-Score', value: `+${sig.z}σ`, color: '#a855f7' },
              { label: 'Stat', value: `${sig.stat} ${sig.dir.toLowerCase()} ${sig.line}`, color: 'rgba(200,255,220,0.8)' },
            ].map((m) => (
              <div key={m.label} style={{ background: 'rgba(0,255,136,0.04)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'rgba(180,255,210,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Dot nav */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18 }}>
            {CYCLING_SIGNALS.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
                background: i === idx ? 'var(--success)' : 'rgba(0,255,136,0.15)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────── Waveform ────────────────────── */

function Waveform() {
  const bars = 32;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${30 + Math.sin(i * 0.8) * 25 + Math.cos(i * 0.4) * 15}%`,
            animation: `waveform ${0.8 + Math.random() * 1.2}s ease-in-out ${i * 0.05}s infinite`,
            background: i < bars * 0.6
              ? 'var(--success)'
              : i < bars * 0.8
              ? '#a855f7'
              : '#ff6b35',
            opacity: 0.7 + (i / bars) * 0.3,
          }}
        />
      ))}
    </div>
  );
}

/* ────────────────────── Main ────────────────────── */

export default function Landing() {
  const canvasRef = useRef(null);
  useParticles(canvasRef, { count: 80, maxDist: 140, speed: 0.35, nodeColor: '0, 255, 136', lineColor: '0, 255, 136' });

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{ position: 'relative', overflowX: 'hidden', background: 'var(--bg)' }}>
      {/* Particles */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />

      {/* Orbs */}
      <div className="orbs-container" style={{ position: 'fixed', zIndex: 0 }}>
        <div className="orb-1" /><div className="orb-2" /><div className="orb-3" />
      </div>

      {/* Grid */}
      <div className="grid-bg" />

      {/* Basketball court arc decoration */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[600, 900, 1200].map((s, i) => (
          <div
            key={i}
            className="court-arc"
            style={{
              width: s, height: s,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              animationDelay: `${i * 1.3}s`,
            }}
          />
        ))}
      </div>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        style={{
          minHeight: '100vh', position: 'relative', zIndex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0, alignItems: 'center',
          padding: '120px 5vw 80px',
        }}
      >
        {/* LEFT: Text */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 28 }}
          >
            <span className="live-badge">Open Source · Quant-Grade · Self-hosted</span>
          </motion.div>

          <motion.div
            variants={stagger(0.1)}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={fadeUp} style={{ marginBottom: 0 }}>
              <div style={{
                fontSize: 'clamp(1rem, 2vw, 1.3rem)',
                fontWeight: 700,
                letterSpacing: '0.25em',
                color: 'rgba(0,255,136,0.5)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Find your statistical
              </div>
              <div style={{ lineHeight: 0.9, marginBottom: 20 }}>
                <GlitchText
                  text="EDGE."
                  style={{
                    fontSize: 'clamp(5rem, 13vw, 11rem)',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    background: 'linear-gradient(135deg, #00ff88 40%, #a855f7 80%, #ff6b35 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    display: 'block',
                  }}
                />
              </div>
            </motion.div>

            <motion.p variants={fadeUp} style={{
              fontSize: 'clamp(0.95rem, 1.4vw, 1.15rem)',
              color: 'rgba(180,255,210,0.55)',
              maxWidth: 480, lineHeight: 1.7, marginBottom: 36,
            }}>
              Multi-sport prediction market analytics on Kalshi. Z-score anomaly detection,
              fractional Kelly sizing, and real-time Discord alerts — fully automated,
              statistically rigorous.
            </motion.p>

            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 52 }}>
              <Link to="/onboarding">
                <motion.button
                  className="btn-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  style={{ padding: '15px 36px', fontSize: 15 }}
                >
                  Get Started →
                </motion.button>
              </Link>
              <Link to="/signin">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  style={{
                    padding: '15px 32px', fontSize: 15, background: 'rgba(0,255,136,0.05)',
                    border: '1px solid rgba(0,255,136,0.2)', borderRadius: 10,
                    color: 'var(--success)', cursor: 'pointer', fontWeight: 700,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Sign In
                </motion.button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeUp}>
              <Waveform />
              <div style={{ display: 'flex', gap: 36, marginTop: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Win Rate', value: 61.4, suffix: '%', decimals: 1, color: 'var(--success)' },
                  { label: 'Avg EV', value: 7.3, suffix: '%', decimals: 1, color: '#a855f7' },
                  { label: 'Sharpe', value: 2.1, suffix: 'x', decimals: 1, color: '#ff6b35' },
                  { label: 'Signals', value: 1847, suffix: '+', decimals: 0, color: '#f59e0b' },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 900, color: s.color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
                      <AnimatedCounter to={s.value} suffix={s.suffix} decimals={s.decimals} duration={1800} />
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(180,255,210,0.35)', marginTop: 2, letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* RIGHT: Radar */}
        <motion.div
          style={{ y: useTransform(scrollYProgress, [0, 1], ['0%', '15%']), opacity: heroOpacity }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
            <RadarScan size={360} />

            {/* Floating stat cards beside radar */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="glass"
              style={{
                padding: '10px 16px', borderRadius: 12, fontSize: 12,
                fontFamily: 'var(--font-mono)', color: 'rgba(180,255,210,0.7)',
                borderLeft: '2px solid var(--success)',
                display: 'flex', gap: 16,
              }}
            >
              <span>Markets scanned: <strong style={{ color: 'var(--success)' }}>247</strong></span>
              <span>Signals found: <strong style={{ color: '#f59e0b' }}>5</strong></span>
              <span>Next scan: <strong style={{ color: '#a855f7' }}>3m 22s</strong></span>
            </motion.div>
          </div>
        </motion.div>

        {/* Mobile: collapse to single column */}
        <style>{`
          @media (max-width: 768px) {
            .hero-grid { grid-template-columns: 1fr !important; }
            .radar-hide { display: none !important; }
          }
        `}</style>

        {/* Scroll hint */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
          style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(0,255,136,0.3)', fontSize: 11, display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ letterSpacing: '0.15em' }}>SCROLL</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </section>

      {/* ── TICKER ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(0,255,136,0.12)',
        borderBottom: '1px solid rgba(0,255,136,0.12)',
        background: 'rgba(0, 255, 136, 0.025)',
        overflow: 'hidden',
      }}>
        <div className="ticker-wrap">
          <div className="ticker-inner">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="ticker-item">
                <span style={{ color: item.dir === 'OVER' ? 'var(--success)' : '#ef4444', marginRight: 6 }}>
                  {item.dir === 'OVER' ? '▲' : '▼'}
                </span>
                {item.text}
                <span style={{ color: 'var(--success)', marginLeft: 10, fontWeight: 700 }}>{item.ev}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PIPELINE: HOW IT WORKS ── */}
      <section style={{ padding: '120px 5vw', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger(0.12)}
            style={{ textAlign: 'center', marginBottom: 72 }}
          >
            <motion.p variants={fadeUp} style={{ color: 'var(--success)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>
              Architecture
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>
              From Market Data
              <span style={{
                display: 'block',
                background: 'linear-gradient(90deg, #00ff88, #a855f7)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>to Sized Bets.</span>
            </motion.h2>
            <motion.p variants={fadeUp} style={{ color: 'rgba(180,255,210,0.45)', maxWidth: 500, margin: '0 auto', fontSize: 15 }}>
              Three automated stages run every five minutes during game hours across NBA, MLB, and NFL — no manual intervention required.
            </motion.p>
          </motion.div>

          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap' }}>
            {PIPELINE_STEPS.map((step, i) => (
              <>
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2, duration: 0.6 }}
                  style={{ flex: 1, minWidth: 260 }}
                >
                  <TiltCard
                    className="glass"
                    style={{
                      padding: 32, borderRadius: 20, height: '100%',
                      borderTop: `2px solid ${step.color}44`,
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {/* Step number background */}
                    <div style={{
                      position: 'absolute', top: 16, right: 20,
                      fontSize: 72, fontWeight: 900, opacity: 0.04,
                      color: step.color, fontFamily: 'var(--font-mono)',
                      lineHeight: 1, pointerEvents: 'none',
                      userSelect: 'none',
                    }}>
                      {step.num}
                    </div>

                    <div style={{
                      width: 58, height: 58, borderRadius: 16,
                      background: `${step.color}12`,
                      border: `1px solid ${step.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, marginBottom: 20,
                      boxShadow: `0 0 20px ${step.glow}`,
                    }}>
                      {step.icon}
                    </div>

                    <div style={{ fontSize: 10, color: step.color, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>
                      Step {step.num}  ·  {step.subtitle}
                    </div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>{step.title}</h3>
                    <p style={{ fontSize: 14, color: 'rgba(180,255,210,0.5)', lineHeight: 1.7 }}>{step.desc}</p>

                    {/* Animated line at bottom */}
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '60%' }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.2 + 0.5, duration: 0.8 }}
                      style={{
                        height: 2, background: `linear-gradient(90deg, ${step.color}, transparent)`,
                        borderRadius: 1, marginTop: 24,
                      }}
                    />
                  </TiltCard>
                </motion.div>

                {i < PIPELINE_STEPS.length - 1 && (
                  <div key={`conn-${i}`} className="pipeline-connector" style={{ minWidth: 0, margin: 'auto 8px', flexBasis: 60 }} />
                )}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO ── */}
      <section style={{ padding: '80px 5vw', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger()}
            style={{ textAlign: 'center', marginBottom: 56 }}
          >
            <motion.p variants={fadeUp} style={{ color: 'var(--success)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>
              Live Output
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, marginBottom: 14 }}>
              Real Signals. Real Data.
            </motion.h2>
            <motion.p variants={fadeUp} style={{ color: 'rgba(180,255,210,0.45)', maxWidth: 460, margin: '0 auto' }}>
              Every signal has survived Z-score screening, EV validation, and Kelly sizing before it reaches you.
            </motion.p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <div style={{ marginBottom: 16, fontSize: 12, color: 'rgba(180,255,210,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                LIVE SIGNAL FEED
              </div>
              <CyclingSignalCard />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}>
              <div style={{ marginBottom: 16, fontSize: 12, color: 'rgba(180,255,210,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                ENGINE OUTPUT
              </div>
              <Terminal />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── THE MATH ── */}
      <section style={{ padding: '100px 5vw', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Left: bell curve */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div style={{ padding: 36, borderRadius: 20 }} className="glass">
              <div style={{ fontSize: 12, color: 'var(--success)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
                Statistical Distribution
              </div>
              <BellCurve zScore={2.4} width={320} height={160} />
              <div style={{
                marginTop: 24, padding: '14px 18px', background: 'rgba(0,255,136,0.05)',
                border: '1px solid rgba(0,255,136,0.12)', borderRadius: 12,
                fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(180,255,210,0.8)',
              }}>
                <div style={{ marginBottom: 4 }}>EV = p_model × (1 / price) − (1 − p_model)</div>
                <div style={{ color: 'var(--success)' }}>→ 0.611 × 2.439 − 0.389 = <strong>+8.2%</strong></div>
              </div>
            </div>
          </motion.div>

          {/* Right: explanation */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ color: 'var(--success)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}
            >
              The Math
            </motion.p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 20, lineHeight: 1.1 }}>
              Systematic edge,<br />not intuition.
            </h2>
            <p style={{ color: 'rgba(180,255,210,0.5)', fontSize: 15, lineHeight: 1.8, marginBottom: 28 }}>
              We compute a Z-score of a player's current line against their rolling
              10-game distribution. When the Z-score exceeds 1σ and Expected Value
              is positive, a signal is generated and sized using fractional Kelly Criterion.
            </p>

            {[
              { step: '1', text: 'Z-score > 1σ from 10-game history', color: 'var(--success)' },
              { step: '2', text: 'EV > 0 vs Kalshi implied probability', color: '#a855f7' },
              { step: '3', text: 'Fractional Kelly sizing (25% hard cap)', color: '#ff6b35' },
              { step: '4', text: 'Team exposure ≤ 15% of bankroll', color: '#f59e0b' },
            ].map((r) => (
              <div key={r.step} style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `${r.color}18`, border: `1px solid ${r.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, color: r.color, fontFamily: 'var(--font-mono)',
                }}>
                  {r.step}
                </div>
                <span style={{ fontSize: 14, color: 'rgba(180,255,210,0.65)' }}>{r.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── DISCORD MOCKUP ── */}
      <section style={{ padding: '80px 5vw', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Left: copy */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.12)}
          >
            <motion.p variants={fadeUp} style={{ color: 'var(--success)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
              Instant Alerts
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 20, lineHeight: 1.1 }}>
              High-confidence signals land in Discord
              <span style={{ color: 'var(--success)' }}> before the market moves.</span>
            </motion.h2>
            <motion.p variants={fadeUp} style={{ color: 'rgba(180,255,210,0.5)', fontSize: 15, lineHeight: 1.8, marginBottom: 32 }}>
              Any signal scoring above 80 confidence broadcasts a rich Discord embed to your server — player, line, EV, Kelly size, and a direct Kalshi link. You act. The market corrects.
            </motion.p>
            <motion.div variants={stagger(0.08)}>
              {[
                { icon: '⚡', text: 'Sub-second delivery after scan completes' },
                { icon: '📎', text: 'Direct Kalshi market link in every alert' },
                { icon: '🔒', text: 'Your webhook URL is stored encrypted' },
                { icon: '🧪', text: 'Test your webhook from the Settings page' },
              ].map((f) => (
                <motion.div key={f.text} variants={fadeUp} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>{f.icon}</span>
                  <span style={{ fontSize: 14, color: 'rgba(180,255,210,0.6)' }}>{f.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: Discord mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <DiscordMockup />
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '80px 5vw', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger()}
            style={{ textAlign: 'center', marginBottom: 56 }}
          >
            <motion.p variants={fadeUp} style={{ color: 'var(--success)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>
              Full Stack
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, marginBottom: 14 }}>
              Everything the edge requires.
            </motion.h2>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.5 }}
              >
                <TiltCard
                  className="glass"
                  style={{ padding: 28, borderRadius: 18, height: '100%', borderLeft: `2px solid ${f.color}30` }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 40px ${f.color}18, inset 0 0 30px ${f.color}05`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{
                    fontSize: 28, marginBottom: 16, width: 52, height: 52, borderRadius: 14,
                    background: `${f.color}12`, border: `1px solid ${f.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {f.icon}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.01em' }}>{f.title}</h3>
                  <p style={{ fontSize: 13.5, color: 'rgba(180,255,210,0.45)', lineHeight: 1.7 }}>{f.desc}</p>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OPEN SOURCE ── */}
      <section style={{ padding: '100px 5vw', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.12)}
          >
            <motion.p variants={fadeUp} style={{ color: 'var(--success)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>
              Open Source
            </motion.p>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>
              Free. Self-hosted. Yours.
            </motion.h2>
            <motion.p variants={fadeUp} style={{ color: 'rgba(180,255,210,0.4)', marginBottom: 40, fontSize: 15 }}>
              Clone the repo, drop in your Kalshi API key, and run it on your own machine. Everything included from day one.
            </motion.p>

            <motion.div variants={fadeIn}>
              <div className="glass-strong holo-card" style={{ borderRadius: 22, padding: '36px 40px' }}>
                {[
                  'Unlimited signal scans (every 5 min)',
                  'Discord webhook alerts for conf > 80',
                  'Fractional Kelly auto-sizing',
                  'Full 30-day backtesting + P&L chart',
                  'AES-256 encrypted Kalshi integration',
                  'Team exposure & drawdown controls',
                  'NBA, MLB, and NFL coverage',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 13, textAlign: 'left' }}>
                    <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }}>✓</span>
                    <span style={{ fontSize: 14, color: 'rgba(180,255,210,0.65)' }}>{item}</span>
                  </div>
                ))}
                <Link to="/onboarding" style={{ display: 'block', marginTop: 32 }}>
                  <motion.button
                    className="btn-primary"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 12 }}
                  >
                    Get Started →
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '60px 5vw 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 900, textAlign: 'center', letterSpacing: '-0.03em', marginBottom: 40 }}
          >
            Questions
          </motion.h2>
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="glass"
              style={{ borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', padding: '18px 22px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  color: 'var(--text)', fontSize: 15, fontWeight: 700, gap: 16,
                }}
              >
                {faq.q}
                <motion.span
                  animate={{ rotate: openFaq === i ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--success)', fontSize: 22, flexShrink: 0 }}
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 22px 20px', color: 'rgba(180,255,210,0.5)', fontSize: 14, lineHeight: 1.75 }}>
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        padding: '100px 24px 140px',
        borderTop: '1px solid rgba(0,255,136,0.08)',
      }}>
        {/* Burst glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,136,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger(0.12)}
          style={{ position: 'relative' }}
        >
          <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
            <span className="live-badge">Open source · Personal project · Free forever</span>
          </motion.div>
          <motion.h2 variants={fadeUp} style={{
            fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
            fontWeight: 900, letterSpacing: '-0.04em',
            lineHeight: 1.0, marginBottom: 20,
          }}>
            Your statistical
            <span style={{ display: 'block', color: 'var(--success)' }}>edge awaits.</span>
          </motion.h2>
          <motion.p variants={fadeUp} style={{ color: 'rgba(180,255,210,0.4)', marginBottom: 40, fontSize: 16, maxWidth: 440, margin: '0 auto 40px' }}>
            Spin up your own quant engine and start finding systematic edge against Kalshi's implied probabilities.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/onboarding">
              <motion.button
                className="btn-primary"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                style={{ padding: '17px 52px', fontSize: 17 }}
              >
                Get Started
              </motion.button>
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} style={{ marginTop: 18, fontSize: 12, color: 'rgba(180,255,210,0.2)' }}>
            Personal project · Self-hosted · CFTC-regulated via Kalshi · Not financial advice
          </motion.p>
        </motion.div>
      </section>
    </div>
  );
}
