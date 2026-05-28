import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import NavBar from '../components/NavBar.jsx'
import { api } from '../api.js'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

const glass = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.07)',
}

const sportColors = { NBA: '#a855f7', MLB: '#3b82f6', NFL: '#f59e0b', NHL: '#06b6d4' }

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{
      background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 9, padding: '10px 14px', fontSize: 12, minWidth: 160,
    }}>
      <div style={{ fontWeight: 800, marginBottom: 6, color: '#fff' }}>{d.label}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{d.total} signals · {d.wins}W {d.losses}L</div>
      <div style={{ fontWeight: 800, color: d.win_rate >= 50 ? '#10d97b' : '#ef4444' }}>Win rate: {d.win_rate}%</div>
      <div style={{ fontWeight: 800, color: d.pnl_dollars >= 0 ? '#10d97b' : '#ef4444', marginTop: 2 }}>
        P&L: {d.pnl_dollars >= 0 ? '+' : ''}${Math.abs(d.pnl_dollars).toFixed(2)}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
        ROI: {d.roi_pct >= 0 ? '+' : ''}{d.roi_pct}%
      </div>
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 3 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{sub}</div>}
    </div>
  )
}

function BreakdownTable({ rows, colorKey }) {
  if (!rows?.length) return <div style={{ padding: '20px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No data yet.</div>
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 80px',
        gap: 8, padding: '10px 20px',
        fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span>{colorKey || 'Label'}</span><span>Bets</span><span>Win %</span><span>P&L</span><span>ROI</span>
      </div>
      {rows.map((row, i) => {
        const sc = colorKey === 'Sport' ? (sportColors[row.label] || '#fff') : null
        return (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 80px',
              gap: 8, padding: '12px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              fontSize: 13, alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, color: sc || '#fff' }}>{row.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{row.total}</span>
            <span style={{
              fontWeight: 800, fontFamily: 'monospace',
              color: row.win_rate >= 50 ? '#10d97b' : '#ef4444',
            }}>{row.win_rate}%</span>
            <span style={{
              fontWeight: 800, fontFamily: 'monospace',
              color: row.pnl_dollars >= 0 ? '#10d97b' : '#ef4444',
            }}>{row.pnl_dollars >= 0 ? '+' : ''}${Math.abs(row.pnl_dollars).toFixed(2)}</span>
            <span style={{
              fontWeight: 700, fontFamily: 'monospace', fontSize: 12,
              color: row.roi_pct >= 0 ? 'rgba(16,217,123,0.8)' : 'rgba(239,68,68,0.8)',
            }}>{row.roi_pct >= 0 ? '+' : ''}{row.roi_pct}%</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAnalyticsBreakdown()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const topStats = data?.by_stat?.slice(0, 8) || []
  const winRateData = topStats.map(r => ({ ...r, fill: r.win_rate >= 50 ? '#10d97b' : '#ef4444' }))
  const pnlData = topStats.map(r => ({ ...r, fill: r.pnl_dollars >= 0 ? '#10d97b' : '#ef4444' }))

  const totalResolved = data?.total_resolved || 0
  const totalWins = (data?.by_stat || []).reduce((a, r) => a + r.wins, 0)
  const totalPnl = (data?.by_stat || []).reduce((a, r) => a + r.pnl_dollars, 0)
  const bestStat = [...(data?.by_stat || [])].sort((a, b) => b.pnl_dollars - a.pnl_dollars)[0]
  const bestSport = [...(data?.by_sport || [])].sort((a, b) => b.pnl_dollars - a.pnl_dollars)[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-2" style={{ opacity: 0.2 }} />
        <div className="orb-3" style={{ opacity: 0.15 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <NavBar />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

          {/* Header */}
          <motion.div {...fadeUp(0)} style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>
              Signal Analytics
            </h1>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              Win rate, ROI and P&L broken down by stat, sport, direction and player.
            </div>
          </motion.div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 12px' }}
              />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading analytics…</div>
            </div>
          ) : totalResolved === 0 ? (
            <motion.div {...fadeUp(0.1)} style={{ textAlign: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              No resolved signals yet. Outcomes auto-resolve at 9am ET daily.
            </motion.div>
          ) : (
            <>
              {/* Summary cards */}
              <motion.div {...fadeUp(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Total Resolved', val: totalResolved, color: 'rgba(255,255,255,0.9)' },
                  { label: 'Overall Win Rate', val: `${totalResolved > 0 ? Math.round(totalWins / totalResolved * 100) : 0}%`, color: totalWins / totalResolved >= 0.5 ? '#10d97b' : '#f59e0b' },
                  { label: 'Total P&L', val: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`, color: totalPnl >= 0 ? '#10d97b' : '#ef4444' },
                  { label: 'Best Stat', val: bestStat?.label ?? '—', color: '#6366f1' },
                  { label: 'Best Sport', val: bestSport?.label ?? '—', color: sportColors[bestSport?.label] || '#fff' },
                ].map((m, i) => (
                  <motion.div key={m.label} {...fadeUp(0.08 + i * 0.04)} style={{ ...glass, padding: '18px 20px' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: m.color, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{m.val}</div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Win rate by stat — bar chart */}
              {winRateData.length > 0 && (
                <motion.div {...fadeUp(0.18)} style={{ ...glass, padding: 24, marginBottom: 20 }}>
                  <SectionHeader title="Win Rate by Stat" sub="How often each stat category resolves in your favor" />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={winRateData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
                        {winRateData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* P&L by stat — bar chart */}
              {pnlData.length > 0 && (
                <motion.div {...fadeUp(0.22)} style={{ ...glass, padding: 24, marginBottom: 20 }}>
                  <SectionHeader title="P&L by Stat" sub="Net profit/loss in dollars per stat category" />
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={pnlData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="pnl_dollars" radius={[4, 4, 0, 0]}>
                        {pnlData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Detailed breakdown tables */}
              <motion.div {...fadeUp(0.28)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ ...glass, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <SectionHeader title="Stat Breakdown" />
                  </div>
                  <BreakdownTable rows={data?.by_stat} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ ...glass, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <SectionHeader title="By Sport" />
                    </div>
                    <BreakdownTable rows={data?.by_sport} colorKey="Sport" />
                  </div>
                  <div style={{ ...glass, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <SectionHeader title="OVER vs UNDER" />
                    </div>
                    <BreakdownTable rows={data?.by_direction} />
                  </div>
                </div>
              </motion.div>

              {/* Top players */}
              {data?.by_player?.length > 0 && (
                <motion.div {...fadeUp(0.33)} style={{ ...glass, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <SectionHeader title="Top Players" sub="Players with 3+ signals, ranked by P&L" />
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 80px',
                    gap: 8, padding: '10px 20px',
                    fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span>Player</span><span>Bets</span><span>Win %</span><span>P&L</span><span>ROI</span>
                  </div>
                  {data.by_player.map((row, i) => (
                    <div key={row.label} style={{
                      display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 80px',
                      gap: 8, padding: '12px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: 13, alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{row.label}</span>
                        {i === 0 && <span style={{ marginLeft: 8, fontSize: 10, color: '#f59e0b' }}>⭐ Best</span>}
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{row.total}</span>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: row.win_rate >= 50 ? '#10d97b' : '#ef4444' }}>{row.win_rate}%</span>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: row.pnl_dollars >= 0 ? '#10d97b' : '#ef4444' }}>
                        {row.pnl_dollars >= 0 ? '+' : ''}${Math.abs(row.pnl_dollars).toFixed(2)}
                      </span>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: row.roi_pct >= 0 ? 'rgba(16,217,123,0.8)' : 'rgba(239,68,68,0.8)' }}>
                        {row.roi_pct >= 0 ? '+' : ''}{row.roi_pct}%
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
