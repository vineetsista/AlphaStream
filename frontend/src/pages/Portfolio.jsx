import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
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

const SPORT_COLORS = { NBA: '#a855f7', MLB: '#3b82f6', NFL: '#f59e0b', NHL: '#06b6d4' }
const PIE_COLORS = ['#10d97b', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16']

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background: 'rgba(15,17,26,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 9, padding: '8px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{name}</div>
      <div style={{ fontWeight: 800, color: '#10d97b' }}>${value.toFixed(2)}</div>
    </div>
  )
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(15,17,26,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 9, padding: '8px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 800, color: '#6366f1' }}>${payload[0].value.toFixed(2)}</div>
    </div>
  )
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ ...glassCard, padding: '20px 22px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Portfolio() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPortfolioExposure()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const teamData = data ? Object.entries(data.by_team || {}).map(([name, value]) => ({ name, value })) : []
  const statData = data ? Object.entries(data.by_stat || {}).map(([name, value]) => ({ name, value })) : []
  const sportData = data ? Object.entries(data.by_sport || {}).map(([name, value]) => ({ name, value, color: SPORT_COLORS[name] || '#94a3b8' })) : []

  const utilColor = !data ? '#fff'
    : data.utilization_pct > 50 ? '#ef4444'
    : data.utilization_pct > 25 ? '#f59e0b'
    : '#10d97b'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-2" style={{ opacity: 0.22 }} />
        <div className="orb-3" style={{ opacity: 0.12 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <NavBar />

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
          <motion.div {...fadeUp(0)} style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>Portfolio Exposure</h1>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              Live view of open positions — how your bankroll is deployed across teams, stats, and sports.
            </div>
          </motion.div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 32, height: 32, border: '3px solid rgba(0,255,136,0.2)', borderTopColor: 'var(--success)', borderRadius: '50%', margin: '0 auto 14px' }}
              />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading portfolio…</div>
            </div>
          ) : !data ? (
            <motion.div {...fadeUp(0.1)} style={{ textAlign: 'center', padding: '80px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No exposure data</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Run a scan to generate signals with position sizes.</div>
            </motion.div>
          ) : (
            <>
              {/* Stat strip */}
              <motion.div {...fadeUp(0.05)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                <StatBox label="Deployed" value={`$${data.total_deployed_dollars.toFixed(2)}`} color="#10d97b" sub={`of $${data.bankroll_dollars.toFixed(0)} bankroll`} />
                <StatBox label="Utilization" value={`${data.utilization_pct}%`} color={utilColor} sub="of total bankroll" />
                <StatBox label="Open Positions" value={data.active_positions} color="rgba(255,255,255,0.9)" sub="unresolved signals" />
                <StatBox label="Expected Edge" value={`${(data.expected_edge_dollars || 0) >= 0 ? '+' : ''}$${(data.expected_edge_dollars || 0).toFixed(2)}`} color={(data.expected_edge_dollars || 0) >= 0 ? '#10d97b' : '#ef4444'} sub="theoretical open PnL" />
                <StatBox label="Avg per Position" value={data.active_positions > 0 ? `$${(data.total_deployed_dollars / data.active_positions).toFixed(2)}` : '—'} color="#6366f1" />
              </motion.div>

              {/* Utilization bar */}
              <motion.div {...fadeUp(0.1)} style={{ ...glassCard, padding: '20px 22px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Bankroll Utilization</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: utilColor, fontFamily: 'monospace' }}>{data.utilization_pct}%</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, data.utilization_pct)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 100, background: `linear-gradient(90deg, ${utilColor}cc, ${utilColor})` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  <span>$0</span>
                  <span>${data.bankroll_dollars.toFixed(0)}</span>
                </div>
              </motion.div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Sport breakdown */}
                <motion.div {...fadeUp(0.15)} style={{ ...glassCard, padding: '22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>By Sport</div>
                  {sportData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={sportData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                          {sportData.map((entry, i) => (
                            <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No data</div>
                  )}
                </motion.div>

                {/* Stat type breakdown */}
                <motion.div {...fadeUp(0.2)} style={{ ...glassCard, padding: '22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>By Stat Type</div>
                  {statData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={statData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {statData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No data</div>
                  )}
                </motion.div>
              </div>

              {/* Team concentration */}
              {teamData.length > 0 && (
                <motion.div {...fadeUp(0.25)} style={{ ...glassCard, padding: '22px', marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>Team Concentration</div>
                  {teamData.map((t, i) => {
                    const pct = data.total_deployed_dollars > 0 ? (t.value / data.total_deployed_dollars) * 100 : 0
                    const barColor = PIE_COLORS[i % PIE_COLORS.length]
                    return (
                      <div key={t.name} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{t.name}</span>
                          <span style={{ color: barColor, fontWeight: 700, fontFamily: 'monospace' }}>${t.value.toFixed(2)} · {pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 5, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 }}
                            style={{ height: '100%', borderRadius: 100, background: barColor }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}

              {/* Open signals table */}
              {data.signals?.length > 0 && (
                <motion.div {...fadeUp(0.3)} style={{ ...glassCard, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                    Open Positions
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 80px 100px',
                    gap: 8, padding: '10px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    <span>Player</span><span>Sport</span><span>Dir</span><span>Conf</span><span>EV%</span><span>Size</span>
                  </div>
                  {data.signals.map((sig, i) => {
                    const sc = SPORT_COLORS[sig.sport] || '#94a3b8'
                    return (
                      <motion.div
                        key={sig.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 80px 100px',
                          gap: 8, padding: '13px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          fontSize: 13, alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{sig.player}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sig.stat} {sig.line}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: `${sc}20`, color: sc, border: `1px solid ${sc}40` }}>{sig.sport}</span>
                        </div>
                        <div style={{ color: sig.direction === 'OVER' ? '#10d97b' : '#ef4444', fontWeight: 800, fontSize: 12 }}>{sig.direction}</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{sig.confidence?.toFixed(0)}</div>
                        <div style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 700 }}>+{sig.ev_pct?.toFixed(1)}%</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10d97b' }}>${sig.recommended_size_dollars?.toFixed(2)}</div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
