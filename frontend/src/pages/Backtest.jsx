import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter, Line,
  LineChart, CartesianGrid,
} from 'recharts'
import NavBar from '../components/NavBar.jsx'
import { api } from '../api.js'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

const glassCard = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.07)',
}

const sportColors = { NBA: '#a855f7', MLB: '#3b82f6', NFL: '#f59e0b', NHL: '#06b6d4' }

function winLossStyle(actual_outcome, direction) {
  if (!actual_outcome) return {
    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
    background: 'rgba(120,130,150,0.1)', color: 'rgba(255,255,255,0.3)',
  }
  const isWin = actual_outcome === direction
  return {
    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
    background: isWin ? 'rgba(16,217,123,0.12)' : 'rgba(239,68,68,0.12)',
    color: isWin ? '#10d97b' : '#ef4444',
    border: `1px solid ${isWin ? 'rgba(16,217,123,0.25)' : 'rgba(239,68,68,0.25)'}`,
  }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div style={{
      background: 'rgba(15,17,26,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 9,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: v >= 0 ? '#10d97b' : '#ef4444', fontFamily: 'monospace', fontSize: 15 }}>
        {v >= 0 ? '+' : ''}${v.toFixed(2)}
      </div>
    </div>
  )
}

const CalibTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{
      background: 'rgba(15,17,26,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 9, padding: '9px 13px', fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Predicted: {d?.predicted_pct}%</div>
      <div style={{ fontWeight: 800, color: '#10d97b' }}>Actual: {d?.actual_pct}%</div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{d?.count} signals</div>
    </div>
  )
}

export default function Backtest() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState(null)
  const [calibration, setCalibration] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getBacktest(days),
      api.getBacktestHistory(days),
      api.getCalibration(),
      api.getAnalyticsBreakdown(),
    ])
      .then(([s, h, c, b]) => { setStats(s); setHistory(h); setCalibration(c); setBreakdown(b) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const pnlData = history?.daily_pnl || []
  const resolved = history?.resolved_signals || []
  const totalPnl = stats?.total_pnl_dollars || 0

  const statCards = stats ? [
    { label: 'Win Rate', val: `${stats.win_rate_pct}%`, color: stats.win_rate >= 0.55 ? '#10d97b' : stats.win_rate >= 0.45 ? '#f59e0b' : '#ef4444' },
    { label: 'Total ROI', val: `${totalPnl >= 0 ? '+' : ''}${stats.roi_pct}%`, color: totalPnl >= 0 ? '#10d97b' : '#ef4444' },
    { label: 'Signals', val: stats.total_signals, color: 'rgba(255,255,255,0.9)' },
    { label: 'Avg EV%', val: `${stats.avg_ev_pct > 0 ? '+' : ''}${stats.avg_ev_pct}%`, color: '#6366f1' },
    { label: 'Sharpe', val: stats.sharpe, color: stats.sharpe > 1 ? '#10d97b' : 'rgba(255,255,255,0.7)' },
    { label: 'Profit Factor', val: stats.profit_factor?.toFixed(2) ?? '—', color: (stats.profit_factor || 0) > 1 ? '#10d97b' : '#ef4444' },
    { label: 'Avg Win', val: `+$${stats.avg_win_dollars?.toFixed(2) ?? '0'}`, color: '#10d97b' },
    { label: 'Avg Loss', val: `-$${stats.avg_loss_dollars?.toFixed(2) ?? '0'}`, color: '#ef4444' },
    { label: 'Best Streak', val: `${stats.best_streak ?? 0}W`, color: '#10d97b' },
    { label: 'Max Drawdown', val: `-$${Math.abs(stats.max_drawdown_dollars || 0).toFixed(2)}`, color: '#ef4444' },
    { label: 'IC', val: stats.ic?.toFixed(3) ?? '—', color: (stats.ic || 0) > 0.05 ? '#10d97b' : (stats.ic || 0) > 0 ? '#f59e0b' : '#ef4444' },
    { label: 'VaR 95%', val: `-$${Math.abs(stats.var_95_dollars || 0).toFixed(2)}`, color: '#ef4444' },
  ] : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* Background */}
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-2" style={{ opacity: 0.2 }} />
        <div className="orb-3" style={{ opacity: 0.15 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <NavBar />

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

          {/* Header */}
          <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>
                Backtest Performance
              </h1>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                Historical signal outcomes & P&amp;L — resolved daily at 9am ET automatically.
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => api.exportSignalsCsv().catch(() => {})}
              style={{
                padding: '9px 18px', fontSize: 12, fontWeight: 700, borderRadius: 9,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                color: '#818cf8', cursor: 'pointer',
              }}
            >
              ↓ Export CSV
            </motion.button>
          </motion.div>

          {/* Disclaimer */}
          <motion.div {...fadeUp(0.05)} style={{
            background: 'rgba(245,158,11,0.07)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 10,
            padding: '11px 16px',
            marginBottom: 24,
            fontSize: 12,
            color: '#f59e0b',
            lineHeight: 1.7,
          }}>
            ⚠ Results are based on signals with logged outcomes. Outcomes are auto-resolved daily at 9am ET, or you can log them manually on each signal card. Past performance does not guarantee future results.
          </motion.div>

          {/* Day selector */}
          <motion.div {...fadeUp(0.1)} style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
            {[7, 14, 30, 60].map((d) => (
              <motion.button
                key={d}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDays(d)}
                style={{
                  background: days === d ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${days === d ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: days === d ? '#6366f1' : 'rgba(255,255,255,0.4)',
                  borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >{d}D</motion.button>
            ))}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>window</span>
          </motion.div>

          {/* Stats strip */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 12px' }}
              />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</div>
            </div>
          ) : (
            <>
              <motion.div {...fadeUp(0.15)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                {statCards.map((m, i) => (
                  <motion.div
                    key={m.label}
                    {...fadeUp(0.15 + i * 0.04)}
                    style={{ ...glassCard, padding: '18px 20px' }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{m.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: m.color, fontFamily: 'var(--font-mono, monospace)' }}>{m.val}</div>
                  </motion.div>
                ))}
              </motion.div>

              {/* PnL Chart */}
              <motion.div {...fadeUp(0.3)} style={{ ...glassCard, padding: '24px', marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: 'rgba(255,255,255,0.8)' }}>
                  Cumulative P&amp;L — {days}D
                </div>
                {pnlData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={pnlData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={totalPnl >= 0 ? '#10d97b' : '#ef4444'} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={totalPnl >= 0 ? '#10d97b' : '#ef4444'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.07)" />
                      <Area
                        type="monotone"
                        dataKey="cumulative_dollars"
                        stroke={totalPnl >= 0 ? '#10d97b' : '#ef4444'}
                        strokeWidth={2}
                        fill="url(#pnlGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    No resolved signals yet — outcomes are logged automatically each morning.
                  </div>
                )}
              </motion.div>

              {/* Calibration reliability chart */}
              {calibration?.buckets?.length > 0 && (
                <motion.div {...fadeUp(0.32)} style={{ ...glassCard, padding: '24px', marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                      Model Calibration
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{calibration.total} resolved signals</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                    Predicted probability vs. actual win rate — a well-calibrated model hugs the diagonal.
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={calibration.buckets} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="predicted_pct" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip content={<CalibTooltip />} />
                      {/* Perfect calibration reference line */}
                      <Line type="linear" dataKey="predicted_pct" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" dot={false} name="Perfect" />
                      {/* Actual calibration */}
                      <Line type="monotone" dataKey="actual_pct" stroke="#10d97b" strokeWidth={2} dot={{ fill: '#10d97b', r: 4 }} name="Actual" />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Stat & Sport Breakdown */}
              {breakdown && breakdown.total_resolved > 0 && (
                <motion.div {...fadeUp(0.35)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  {/* By Stat */}
                  <div style={{ ...glassCard, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                      Performance by Stat
                    </div>
                    {breakdown.by_stat.map((row) => (
                      <div key={row.label} style={{
                        display: 'grid', gridTemplateColumns: '1fr 52px 52px 70px',
                        gap: 8, padding: '11px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{row.label}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{row.total} bets</span>
                        <span style={{ color: row.win_rate >= 50 ? '#10d97b' : '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>{row.win_rate}%</span>
                        <span style={{ color: row.pnl_dollars >= 0 ? '#10d97b' : '#ef4444', fontWeight: 800, fontFamily: 'monospace', fontSize: 13 }}>
                          {row.pnl_dollars >= 0 ? '+' : ''}${Math.abs(row.pnl_dollars).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* By Sport + Direction */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ ...glassCard, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                        By Sport
                      </div>
                      {breakdown.by_sport.map((row) => {
                        const sc = { NBA: '#a855f7', MLB: '#3b82f6', NFL: '#f59e0b' }[row.label] || '#fff'
                        return (
                          <div key={row.label} style={{
                            display: 'grid', gridTemplateColumns: '70px 1fr 52px 70px',
                            gap: 8, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                            fontSize: 12, alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: `${sc}20`, color: sc, border: `1px solid ${sc}40` }}>{row.label}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{row.total} signals</span>
                            <span style={{ color: row.win_rate >= 50 ? '#10d97b' : '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>{row.win_rate}%</span>
                            <span style={{ color: row.pnl_dollars >= 0 ? '#10d97b' : '#ef4444', fontWeight: 800, fontFamily: 'monospace' }}>
                              {row.pnl_dollars >= 0 ? '+' : ''}${Math.abs(row.pnl_dollars).toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ ...glassCard, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                        OVER vs UNDER
                      </div>
                      {breakdown.by_direction.map((row) => (
                        <div key={row.label} style={{
                          display: 'grid', gridTemplateColumns: '60px 1fr 52px 70px',
                          gap: 8, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                          fontSize: 12, alignItems: 'center',
                        }}>
                          <span style={{ fontWeight: 800, color: row.label === 'OVER' ? '#10d97b' : '#ef4444' }}>{row.label}</span>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{row.total} signals</span>
                          <span style={{ color: row.win_rate >= 50 ? '#10d97b' : '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>{row.win_rate}%</span>
                          <span style={{ color: row.pnl_dollars >= 0 ? '#10d97b' : '#ef4444', fontWeight: 800, fontFamily: 'monospace' }}>
                            {row.pnl_dollars >= 0 ? '+' : ''}${Math.abs(row.pnl_dollars).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Signal history table */}
              <motion.div {...fadeUp(0.38)} style={{ ...glassCard, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 56px 80px 80px 90px 80px 80px',
                  gap: 8,
                  padding: '13px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  <span>Player / Market</span>
                  <span>Sport</span>
                  <span>Dir</span>
                  <span>Conf</span>
                  <span>Result</span>
                  <span>P&amp;L</span>
                  <span>Date</span>
                </div>

                {resolved.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                    No resolved signals in this period.
                  </div>
                ) : (
                  resolved.map((sig, i) => {
                    const sc = sportColors[sig.sport || 'NBA'] || '#a855f7'
                    const pnl = sig.pnl_dollars || 0
                    return (
                      <motion.div
                        key={sig.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 56px 80px 80px 90px 80px 80px',
                          gap: 8,
                          padding: '14px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          fontSize: 13,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{sig.player}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sig.stat} {sig.line}</div>
                        </div>
                        <div>
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                            background: `${sc}20`, border: `1px solid ${sc}50`, color: sc,
                          }}>{sig.sport || 'NBA'}</span>
                        </div>
                        <div style={{ color: sig.direction === 'OVER' ? '#10d97b' : '#ef4444', fontWeight: 800, fontSize: 12 }}>
                          {sig.direction}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                          {sig.confidence.toFixed(0)}
                        </div>
                        <div>
                          {sig.actual_outcome ? (
                            <span style={winLossStyle(sig.actual_outcome, sig.direction)}>
                              {sig.actual_outcome === sig.direction ? '✓ WIN' : '✗ LOSS'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Pending</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: pnl >= 0 ? '#10d97b' : '#ef4444' }}>
                          {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(sig.timestamp).toLocaleDateString()}
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
