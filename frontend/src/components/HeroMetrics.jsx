import { useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'

function useAnimatedNumber(target, duration = 900) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    const from = fromRef.current
    const to = Number(target) || 0
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Sparkline({ points = [], color = '#00ff88', height = 38, width = 140 }) {
  if (!points.length) return <svg width={width} height={height} />
  const min = Math.min(...points, 0)
  const max = Math.max(...points, 0)
  const range = max - min || 1
  const stepX = width / Math.max(1, points.length - 1)
  const d = points
    .map((p, i) => {
      const x = i * stepX
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const last = points[points.length - 1]
  const positive = last >= (points[0] ?? 0)

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(points.length - 1) * stepX} cy={height - ((last - min) / range) * height}
              r={3} fill={positive ? color : '#ef4444'} />
    </svg>
  )
}

function MetricCard({ label, value, sub, subColor, color = 'var(--success)', glow, sparkline, accent, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      style={{
        position: 'relative',
        background: 'linear-gradient(140deg, rgba(0,22,12,0.85), rgba(0,14,8,0.7))',
        backdropFilter: 'blur(22px)',
        border: `1px solid ${accent ? 'rgba(0,255,136,0.3)' : 'rgba(0,255,136,0.1)'}`,
        borderRadius: 16,
        padding: '18px 20px',
        overflow: 'hidden',
        boxShadow: glow ? `0 0 28px ${color}33, 0 12px 28px rgba(0,0,0,0.45)` : '0 8px 20px rgba(0,0,0,0.35)',
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      {/* corner accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 90, height: 90,
        background: `radial-gradient(circle at top right, ${color}22, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{
        fontSize: 10, fontWeight: 800, color: 'rgba(180,255,210,0.45)',
        letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10,
        position: 'relative', zIndex: 1,
      }}>
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 28, fontWeight: 900, color,
          fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em', lineHeight: 1,
        }}>
          {value}
        </div>
        {sparkline}
      </div>

      {sub && (
        <div style={{
          fontSize: 11, color: subColor || 'rgba(255,255,255,0.4)', fontWeight: 600,
          marginTop: 8, position: 'relative', zIndex: 1, letterSpacing: '0.02em',
        }}>
          {sub}
        </div>
      )}
    </motion.div>
  )
}

function fmtMoney(n) {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`
  return `${n < 0 ? '-' : '$'}${abs.toFixed(0).replace('-', '')}`
}

export default function HeroMetrics({ signals = [], perfStats, dailyPnl = [], bankroll = 0 }) {
  const stats = useMemo(() => {
    const active = signals.filter((s) => !s.actual_outcome)
    const totalEdge = active.reduce((acc, s) => acc + (s.model_prob - s.market_prob) * (s.recommended_size || 0) / 100, 0)
    const avgConf = active.length ? active.reduce((a, s) => a + s.confidence, 0) / active.length : 0
    const totalDeployed = active.reduce((acc, s) => acc + (s.recommended_size_dollars || 0), 0)
    const best = [...active].sort((a, b) => b.confidence - a.confidence)[0] || null

    // running win streak from most recently resolved
    const resolvedByTime = signals
      .filter((s) => s.actual_outcome && s.resolved_at)
      .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))
    let streak = 0
    let streakWon = null
    for (const r of resolvedByTime) {
      const won = r.actual_outcome === r.direction
      if (streakWon === null) { streakWon = won; streak = 1; continue }
      if (won === streakWon) streak += 1
      else break
    }

    return { totalEdge, avgConf, totalDeployed, best, streak, streakWon }
  }, [signals])

  const cumPnl = useMemo(() => {
    if (!dailyPnl?.length) return []
    let acc = 0
    return dailyPnl.map((d) => { acc += (d.pnl_dollars ?? d.pnl ?? 0); return acc })
  }, [dailyPnl])

  const animatedEdge = useAnimatedNumber(stats.totalEdge, 1100)
  const animatedConf = useAnimatedNumber(stats.avgConf, 900)
  const animatedDeployed = useAnimatedNumber(stats.totalDeployed, 900)
  const animatedPnl = useAnimatedNumber(perfStats?.total_pnl_dollars ?? 0, 1200)

  const edgePositive = stats.totalEdge >= 0
  const pnlPositive = (perfStats?.total_pnl_dollars ?? 0) >= 0

  return (
    <motion.div
      layout
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14, marginBottom: 24,
      }}
    >
      <MetricCard
        label="Today's Edge"
        value={`${edgePositive ? '+' : '-'}$${Math.abs(animatedEdge).toFixed(2)}`}
        color={edgePositive ? 'var(--success)' : '#ef4444'}
        sub={`${signals.filter((s) => !s.actual_outcome).length} live signals tracked`}
        glow accent
        delay={0}
      />

      <MetricCard
        label="30D Cum P&L"
        value={`${pnlPositive ? '+' : '-'}${fmtMoney(Math.abs(animatedPnl))}`}
        color={pnlPositive ? 'var(--success)' : '#ef4444'}
        sub={perfStats ? `${perfStats.win_rate_pct?.toFixed?.(1) ?? 0}% win rate · ${perfStats.total_resolved ?? 0} resolved` : 'Awaiting data'}
        sparkline={<Sparkline points={cumPnl} color={pnlPositive ? '#00ff88' : '#ef4444'} />}
        glow
        delay={0.05}
      />

      <MetricCard
        label={stats.best ? `Top Pick · ${stats.best.player}` : 'Top Pick'}
        value={stats.best ? `${stats.best.confidence.toFixed(0)}` : '—'}
        sub={stats.best
          ? `${stats.best.direction} ${stats.best.line} ${stats.best.stat} · ${stats.best.ev_pct >= 0 ? '+' : ''}${stats.best.ev_pct?.toFixed(1)}% EV`
          : 'No live signals yet'}
        subColor={stats.best ? (stats.best.ev_pct >= 0 ? 'var(--success)' : '#ef4444') : undefined}
        color="var(--accent-purple)"
        glow={!!stats.best && stats.best.confidence >= 88}
        delay={0.1}
      />

      <MetricCard
        label="Deployed Capital"
        value={`$${animatedDeployed.toFixed(0)}`}
        sub={bankroll > 0
          ? `${((stats.totalDeployed * 100) / bankroll).toFixed(1)}% of $${bankroll.toFixed(0)} bankroll`
          : 'Set a bankroll in Settings'}
        color="#6366f1"
        delay={0.15}
      />

      <MetricCard
        label="Win Streak"
        value={stats.streak > 0 ? `${stats.streakWon ? 'W' : 'L'}${stats.streak}` : '—'}
        sub={stats.streak === 0
          ? 'No resolved bets yet'
          : `${stats.streakWon ? 'on a heater' : 'cold streak — buy low'}`}
        subColor={stats.streakWon ? 'var(--success)' : '#ef4444'}
        color={stats.streakWon ? 'var(--success)' : '#ef4444'}
        glow={stats.streak >= 3 && stats.streakWon}
        delay={0.2}
      />

      <MetricCard
        label="Avg Confidence"
        value={`${animatedConf.toFixed(0)}`}
        sub={stats.avgConf >= 85 ? 'Elite slate · top-grade edge' : stats.avgConf >= 80 ? 'Solid slate' : 'Mixed-grade signals'}
        subColor={stats.avgConf >= 85 ? 'var(--success)' : 'rgba(255,255,255,0.4)'}
        color="var(--accent-orange)"
        delay={0.25}
      />
    </motion.div>
  )
}
