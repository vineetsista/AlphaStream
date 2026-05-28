import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import NavBar from '../components/NavBar.jsx'
import { api } from '../api.js'
import { useDemo } from '../hooks/useDemo.jsx'

const card = {
  background: 'rgba(0,18,10,0.7)',
  backdropFilter: 'blur(18px)',
  border: '1px solid rgba(0,255,136,0.12)',
  borderRadius: 14,
  padding: 22,
}

const sectionHead = {
  fontSize: 11, fontWeight: 800, color: 'rgba(180,255,210,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14,
}

const btn = (bg = 'linear-gradient(135deg, #00ff88, #00c96a)', dark = false) => ({
  background: bg,
  color: dark ? '#fff' : '#010308',
  border: 'none', borderRadius: 9,
  padding: '10px 18px', fontWeight: 800, fontSize: 13,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
})

function Stat({ label, value, color = 'var(--success)' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      style={card}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(180,255,210,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em' }}>
        {value}
      </div>
    </motion.div>
  )
}

export default function Admin() {
  const { demoMode, setDemoMode } = useDemo()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState({})
  const [toast, setToast] = useState('')

  const refresh = async () => {
    try {
      const [s, u] = await Promise.all([api.adminStats(), api.adminListUsers()])
      setStats(s); setUsers(u.users || [])
    } catch (e) { /* noop */ }
  }

  useEffect(() => { refresh() }, [])

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }
  const lock = (k, v) => setBusy((b) => ({ ...b, [k]: v }))

  const seedDemo = async () => {
    lock('seed', true)
    try {
      const r = await api.adminSeedDemo()
      flash(`Demo seeded — ${r.inserted} signals inserted`)
      setDemoMode(true)
      await refresh()
    } catch (e) {
      flash(e.error || 'Seed failed')
    } finally { lock('seed', false) }
  }

  const clearDemo = async () => {
    lock('clear', true)
    try {
      const r = await api.adminClearDemo()
      flash(`Cleared ${r.deleted} demo signals`)
      await refresh()
    } catch (e) {
      flash(e.error || 'Clear failed')
    } finally { lock('clear', false) }
  }

  const forceScan = async () => {
    lock('scan', true)
    try {
      await api.adminScan()
      flash('Scheduler scan completed')
      await refresh()
    } catch (e) {
      flash(e.error || 'Scan failed')
    } finally { lock('scan', false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-1" style={{ opacity: 0.4 }} />
        <div className="orb-3" style={{ opacity: 0.2 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <NavBar />

        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px' }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100,
                  background: 'rgba(255,107,53,0.15)', color: '#ff6b35',
                  border: '1px solid rgba(255,107,53,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>ADMIN</span>
                <span className="live-badge" style={{ fontSize: 10, padding: '4px 10px' }}>LIVE</span>
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 4 }}>
                Control <span className="gradient-text">Tower</span>
              </h1>
              <div style={{ color: 'rgba(180,255,210,0.4)', fontSize: 13 }}>
                System health, user roster, demo data, and scheduler controls.
              </div>
            </div>

            {/* Live demo toggle hero */}
            <div style={{
              ...card,
              padding: '14px 20px',
              borderColor: demoMode ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.12)',
              boxShadow: demoMode ? '0 0 32px rgba(0,255,136,0.25)' : 'none',
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(180,255,210,0.45)', letterSpacing: '0.14em', marginBottom: 3 }}>
                    DEMO MODE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: demoMode ? 'var(--success)' : 'rgba(255,255,255,0.5)' }}>
                    {demoMode ? '● Active' : '○ Off'}
                  </div>
                </div>
                <div
                  onClick={() => setDemoMode(!demoMode)}
                  style={{
                    width: 50, height: 28, borderRadius: 100,
                    background: demoMode ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${demoMode ? 'var(--success)' : 'rgba(255,255,255,0.15)'}`,
                    cursor: 'pointer', position: 'relative', transition: 'all 0.25s',
                  }}
                >
                  <motion.div
                    animate={{ x: demoMode ? 24 : 2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    style={{
                      position: 'absolute', top: 2, width: 22, height: 22,
                      borderRadius: '50%', background: '#fff',
                      boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Toast */}
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                ...card, padding: '12px 16px', marginBottom: 18, borderLeft: '3px solid var(--success)',
                fontSize: 13, color: 'rgba(255,255,255,0.85)',
              }}
            >
              {toast}
            </motion.div>
          )}

          {/* Stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12, marginBottom: 24,
          }}>
            <Stat label="Total Users" value={stats?.total_users ?? '—'} />
            <Stat label="Verified" value={stats?.verified_users ?? '—'} color="var(--success)" />
            <Stat label="Total Signals" value={stats?.total_signals ?? '—'} color="var(--accent-purple)" />
          </div>

          {/* Action row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24,
          }}>
            {/* Demo controls */}
            <motion.div style={card} whileHover={{ y: -2 }}>
              <div style={sectionHead}>Demo Data</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14, lineHeight: 1.55 }}>
                Seeds your account with ~44 realistic NBA + MLB signals across
                4 marquee bets, 14 prior wins, and 6 losses — perfect for live demos.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={btn()} onClick={seedDemo} disabled={busy.seed}
                >
                  {busy.seed ? 'Seeding…' : '✨ Seed Demo Slate'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    ...btn('rgba(239,68,68,0.1)', true),
                    border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                  }}
                  onClick={clearDemo} disabled={busy.clear}
                >
                  {busy.clear ? 'Clearing…' : '✕ Clear Demo'}
                </motion.button>
              </div>
            </motion.div>

            {/* Scheduler */}
            <motion.div style={card} whileHover={{ y: -2 }}>
              <div style={sectionHead}>Scheduler</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14, lineHeight: 1.55 }}>
                Force a full signal scan for every active user right now. Runs the same
                pipeline as the 5-min cron during game hours.
              </p>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={btn('linear-gradient(135deg, #6366f1, #a855f7)', true)}
                onClick={forceScan} disabled={busy.scan}
              >
                {busy.scan ? 'Scanning…' : '⚡ Force Full Scan'}
              </motion.button>
            </motion.div>

            {/* Quick links */}
            <motion.div style={card} whileHover={{ y: -2 }}>
              <div style={sectionHead}>Quick Links</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Dashboard', href: '/dashboard' },
                  { label: 'Analytics', href: '/analytics' },
                  { label: 'Portfolio', href: '/portfolio' },
                  { label: 'Backtest', href: '/backtest' },
                ].map((l) => (
                  <a key={l.href} href={l.href} style={{
                    fontSize: 13, padding: '7px 12px', borderRadius: 7,
                    background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)',
                    color: 'var(--success)', textDecoration: 'none', fontWeight: 600,
                  }}>→ {l.label}</a>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Users table */}
          <motion.div style={card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div style={sectionHead}>User Roster</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'rgba(180,255,210,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <th style={{ padding: '8px 12px' }}>Name</th>
                    <th style={{ padding: '8px 12px' }}>Email</th>
                    <th style={{ padding: '8px 12px' }}>Verified</th>
                    <th style={{ padding: '8px 12px' }}>Signals</th>
                    <th style={{ padding: '8px 12px' }}>Bankroll</th>
                    <th style={{ padding: '8px 12px' }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No users yet.</td></tr>
                  )}
                  {users.map((u) => {
                    const verified = u.email_verified === true
                    const sc = verified ? '#10d97b' : u.is_admin ? '#ff6b35' : 'rgba(255,255,255,0.4)'
                    return (
                      <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          {u.name}
                          {u.is_admin && (
                            <span style={{ marginLeft: 8, fontSize: 9, padding: '2px 7px', borderRadius: 100, background: 'rgba(255,107,53,0.15)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.3)', letterSpacing: '0.1em', fontWeight: 800 }}>
                              ADMIN
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', fontSize: 12 }}>{u.email}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 100,
                            background: `${sc}15`, color: sc, border: `1px solid ${sc}33`,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                          }}>
                            {verified ? 'verified' : 'pending'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--success)' }}>{u.signal_count}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>${u.bankroll_dollars?.toLocaleString() ?? 0}</td>
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
