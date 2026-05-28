import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function toAmerican(prob) {
  if (!prob || prob <= 0.001 || prob >= 0.999) return '—'
  if (prob >= 0.5) return `-${Math.round((prob / (1 - prob)) * 100)}`
  return `+${Math.round(((1 - prob) / prob) * 100)}`
}

function genCurve(mean, std, line, n = 120) {
  if (!std || std <= 0 || !mean) return []
  const lo = mean - 4 * std
  const hi = mean + 4 * std
  return Array.from({ length: n }, (_, i) => {
    const x = lo + (i / (n - 1)) * (hi - lo)
    const z = (x - mean) / std
    const y = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI))
    return {
      x: parseFloat(x.toFixed(1)),
      over: x > line ? y : 0,
      under: x <= line ? y : 0,
    }
  })
}

const DistTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const x = payload[0]?.payload?.x
  return (
    <div style={{
      background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '7px 12px', fontSize: 12,
    }}>
      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>{x}</div>
    </div>
  )
}

function FactorBar({ label, value, max, color, fmt }) {
  const pct = Math.min(100, Math.abs(value) / max * 100)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color }}>{fmt(value)}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 100, height: 5, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 100, background: color }}
        />
      </div>
    </div>
  )
}

function DrawerContent({ signal, onClose }) {
  const {
    player, team, stat, line, direction, sport = 'NBA',
    confidence, z_score, ev_pct,
    model_prob, market_prob,
    recommended_size_dollars,
    streak_score = 0.5, last_5_results = '',
    model_mean = 0, model_std = 0, sample_size = 0,
    volume_spike, position,
    kalshi_url, timestamp,
    actual_outcome,
  } = signal

  const isOver = direction === 'OVER'
  const dirColor = isOver ? '#10d97b' : '#ef4444'
  const sportColors = { NBA: '#a855f7', MLB: '#3b82f6', NFL: '#f59e0b', NHL: '#06b6d4' }
  const sportColor = sportColors[sport] || '#6366f1'

  const curveData = genCurve(model_mean, model_std, line)
  const hasDistribution = curveData.length > 0

  const edgeCents = ((model_prob - market_prob) * 100).toFixed(1)
  const edgeColor = model_prob > market_prob ? '#10d97b' : '#ef4444'

  const outcomeColor = actual_outcome
    ? (actual_outcome === direction ? '#10d97b' : '#ef4444')
    : null

  return (
    <motion.div
      key="drawer"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 38 }}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 501,
        width: 420, maxWidth: '95vw',
        background: 'rgba(5,8,20,0.97)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 22px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, background: 'rgba(5,8,20,0.97)', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                background: `${sportColor}20`, color: sportColor, border: `1px solid ${sportColor}40`,
              }}>{sport}</span>
              {volume_spike && (
                <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b' }}>🔥 SPIKE</span>
              )}
              {streak_score >= 0.8 && last_5_results.length >= 4 && (
                <span style={{ fontSize: 9, fontWeight: 800, color: '#10d97b' }}>🔥 HOT</span>
              )}
              {streak_score <= 0.2 && last_5_results.length >= 4 && (
                <span style={{ fontSize: 9, fontWeight: 800, color: '#60a5fa' }}>❄ COLD</span>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>{player}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {[team, position].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 18,
              width: 36, height: 36, cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 10, padding: '5px 12px', borderRadius: 8,
          background: isOver ? 'rgba(16,217,123,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${isOver ? 'rgba(16,217,123,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <span style={{ color: dirColor, fontWeight: 900, fontSize: 14 }}>{direction}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{stat} {line}</span>
        </div>

        {actual_outcome && (
          <div style={{
            marginTop: 8, display: 'inline-block', fontSize: 11, fontWeight: 800,
            padding: '4px 12px', borderRadius: 6,
            background: `${outcomeColor}18`, color: outcomeColor,
            border: `1px solid ${outcomeColor}40`,
          }}>
            {actual_outcome === direction ? '✓ WIN' : '✗ LOSS'} · {actual_outcome}
          </div>
        )}
      </div>

      <div style={{ padding: '20px 22px', flex: 1 }}>

        {/* Distribution chart */}
        {hasDistribution ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
              Stat Distribution
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
              μ = {model_mean.toFixed(1)} · σ = {model_std.toFixed(2)} · n = {sample_size} games
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.05)', padding: '12px 4px 4px',
            }}>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={curveData} margin={{ top: 4, right: 8, left: -32, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10d97b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10d97b" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="underGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="x" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis hide />
                  <Tooltip content={<DistTooltip />} />
                  <ReferenceLine x={line} stroke={dirColor} strokeWidth={1.5} strokeDasharray="3 3" label={{ value: `${line}`, fill: dirColor, fontSize: 10, position: 'top' }} />
                  <ReferenceLine x={model_mean} stroke="rgba(255,255,255,0.2)" strokeWidth={1} label={{ value: 'μ', fill: 'rgba(255,255,255,0.3)', fontSize: 9, position: 'top' }} />
                  <Area type="monotone" dataKey="over" stroke="#10d97b" strokeWidth={1.5} fill="url(#overGrad)" dot={false} />
                  <Area type="monotone" dataKey="under" stroke="#6366f1" strokeWidth={1} fill="url(#underGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 2, background: '#10d97b', display: 'inline-block', borderRadius: 1 }} />
                OVER zone ({(model_prob * 100).toFixed(1)}%)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 2, background: '#6366f1', display: 'inline-block', borderRadius: 1 }} />
                UNDER zone ({((1 - model_prob) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 24, padding: '16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center',
          }}>
            Distribution data available on signals generated after this update.
          </div>
        )}

        {/* Odds matrix */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>Market vs Model</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'YES', prob: market_prob, color: '#10d97b', highlight: isOver },
              { label: 'NO', prob: 1 - market_prob, color: '#ef4444', highlight: !isOver },
              { label: 'MODEL', prob: model_prob, color: 'var(--accent)', highlight: false, accent: true },
            ].map((box) => (
              <div key={box.label} style={{
                borderRadius: 10, padding: '10px 8px', textAlign: 'center',
                background: box.highlight ? (isOver ? 'rgba(16,217,123,0.08)' : 'rgba(239,68,68,0.08)') : box.accent ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${box.highlight ? (isOver ? 'rgba(16,217,123,0.25)' : 'rgba(239,68,68,0.25)') : box.accent ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: 4 }}>{box.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: box.color, fontFamily: 'monospace' }}>{Math.round(box.prob * 100)}¢</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'monospace' }}>{toAmerican(box.prob)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${edgeColor}08`, border: `1px solid ${edgeColor}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Edge: model − market</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: edgeColor, fontFamily: 'monospace' }}>
              {model_prob > market_prob ? '+' : ''}{edgeCents}¢
            </span>
          </div>
        </div>

        {/* Confidence factor breakdown */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>Confidence Factors</div>
          <FactorBar label="Confidence Score" value={confidence} max={100} color="#10d97b" fmt={v => `${v.toFixed(0)}/100`} />
          <FactorBar label="Z-Score (σ from mean)" value={Math.abs(z_score || 0)} max={4} color="#6366f1" fmt={v => `${(z_score || 0) >= 0 ? '+' : ''}${(z_score || 0).toFixed(2)}σ`} />
          <FactorBar label="Expected Value" value={Math.abs(ev_pct || 0)} max={150} color="#f59e0b" fmt={() => `${(ev_pct || 0) >= 0 ? '+' : ''}${(ev_pct || 0).toFixed(1)}%`} />
          <FactorBar label="Streak Score" value={streak_score * 100} max={100} color={streak_score >= 0.6 ? '#10d97b' : streak_score <= 0.4 ? '#ef4444' : '#f59e0b'} fmt={v => `${v.toFixed(0)}%`} />
        </div>

        {/* Last 5 games */}
        {last_5_results.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>Last {last_5_results.length} Games vs {stat} {line}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {last_5_results.split('').map((c, i) => {
                const hit = c === '1'
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', margin: '0 auto 6px',
                      background: hit ? 'rgba(16,217,123,0.15)' : 'rgba(239,68,68,0.15)',
                      border: `2px solid ${hit ? '#10d97b' : '#ef4444'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                    }}>
                      {hit ? '✓' : '✗'}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                      {i === 0 ? 'Latest' : `G-${i}`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Kelly sizing */}
        <div style={{ marginBottom: 24, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kelly-Sized Position</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#10d97b', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
            ${(recommended_size_dollars || 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Fractional Kelly at current bankroll
          </div>
        </div>

        {/* Kalshi link */}
        {kalshi_url && (
          <a
            href={kalshi_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '13px', borderRadius: 10,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              marginBottom: 16,
            }}
          >
            Trade on Kalshi ↗
          </a>
        )}

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingBottom: 8 }}>
          Signal generated {new Date(timestamp).toLocaleString()}
        </div>
      </div>
    </motion.div>
  )
}

export default function SignalDrawer({ signal, isOpen, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}
      {isOpen && signal && <DrawerContent key="drawer" signal={signal} onClose={onClose} />}
    </AnimatePresence>
  )
}
