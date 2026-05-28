import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar.jsx'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

const glassSection = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.07)',
  marginBottom: 20,
  overflow: 'hidden',
}

const sectionHead = {
  padding: '15px 22px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  fontSize: 11,
  fontWeight: 800,
  color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
}

const sectionBody = { padding: '22px' }

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 9,
  padding: '11px 14px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.45)',
  marginBottom: 7,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}

const hintStyle = { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 5, lineHeight: 1.6 }
const groupStyle = { marginBottom: 20 }
const rowStyle = { display: 'flex', gap: 10, alignItems: 'flex-end' }

const btnPrimary = {
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '11px 22px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.2s',
}

const btnGhost = {
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 9,
  padding: '11px 22px',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnDanger = {
  background: 'transparent',
  color: '#ef4444',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: 9,
  padding: '11px 22px',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
}

function Field({ label, hint, children }) {
  return (
    <div style={groupStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )
}

function StatusMsg({ msg }) {
  if (!msg) return null
  const ok = msg.startsWith('✓')
  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ fontSize: 12, marginTop: 8, display: 'block', color: ok ? '#10d97b' : '#ef4444', fontWeight: 600 }}
    >
      {msg}
    </motion.span>
  )
}

export default function Settings() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: user?.name || '',
    bankroll_dollars: ((user?.bankroll || 0) / 100),
    kelly_fraction: user?.kelly_fraction || 0.25,
    kalshi_api_key: '',
    discord_webhook_url: user?.discord_webhook_url || '',
    auto_bet_enabled: user?.auto_bet_enabled || false,
    auto_bet_min_confidence: user?.auto_bet_min_confidence || 85,
  })
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [msg, setMsg] = useState({})
  const [loading, setLoading] = useState({})

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: user.name,
        bankroll_dollars: (user.bankroll || 0) / 100,
        kelly_fraction: user.kelly_fraction,
        discord_webhook_url: user.discord_webhook_url || '',
        auto_bet_enabled: user.auto_bet_enabled || false,
        auto_bet_min_confidence: user.auto_bet_min_confidence || 85,
      }))
    }
  }, [user])

  const setL = (k) => setLoading((l) => ({ ...l, [k]: true }))
  const clearL = (k) => setLoading((l) => ({ ...l, [k]: false }))
  const setM = (k, v) => setMsg((m) => ({ ...m, [k]: v }))

  async function saveProfile() {
    setL('profile'); setM('profile', '')
    try {
      await api.updateSettings({ name: form.name })
      await refresh()
      setM('profile', '✓ Profile saved')
    } catch (ex) {
      setM('profile', ex.error || 'Save failed')
    } finally { clearL('profile') }
  }

  async function saveBankroll() {
    setL('bankroll'); setM('bankroll', '')
    try {
      const bankroll_cents = Math.round((parseFloat(form.bankroll_dollars) || 0) * 100)
      await api.updateSettings({ bankroll: bankroll_cents, kelly_fraction: form.kelly_fraction })
      await refresh()
      setM('bankroll', '✓ Risk settings saved')
    } catch (ex) {
      setM('bankroll', ex.error || 'Save failed')
    } finally { clearL('bankroll') }
  }

  async function saveKalshi() {
    setL('kalshi'); setM('kalshi', '')
    try {
      await api.updateSettings({ kalshi_api_key: form.kalshi_api_key })
      await refresh()
      setM('kalshi', '✓ Kalshi API key saved')
      setForm((f) => ({ ...f, kalshi_api_key: '' }))
    } catch (ex) {
      setM('kalshi', ex.error || 'Save failed')
    } finally { clearL('kalshi') }
  }

  async function saveDiscord() {
    setL('discord'); setM('discord', '')
    try {
      await api.updateSettings({ discord_webhook_url: form.discord_webhook_url })
      await refresh()
      setM('discord', '✓ Discord webhook saved')
    } catch (ex) {
      setM('discord', ex.error || 'Save failed')
    } finally { clearL('discord') }
  }

  async function testDiscord() {
    setL('discordTest'); setM('discord', '')
    try {
      await api.testDiscord()
      setM('discord', '✓ Test notification sent — check Discord')
    } catch (ex) {
      setM('discord', ex.error || 'Test failed')
    } finally { clearL('discordTest') }
  }

  async function saveAutoBet() {
    setL('autobet'); setM('autobet', '')
    try {
      await api.updateSettings({
        auto_bet_enabled: form.auto_bet_enabled,
        auto_bet_min_confidence: form.auto_bet_min_confidence,
      })
      await refresh()
      setM('autobet', '✓ Auto-execution settings saved')
    } catch (ex) {
      setM('autobet', ex.error || 'Save failed')
    } finally { clearL('autobet') }
  }

  async function changePassword() {
    setL('pw'); setM('pw', '')
    try {
      await api.changePassword(pw)
      setPw({ current_password: '', new_password: '' })
      setM('pw', '✓ Password updated')
    } catch (ex) {
      setM('pw', ex.error || 'Update failed')
    } finally { clearL('pw') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* Background layers */}
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-2" style={{ opacity: 0.25 }} />
        <div className="orb-3" style={{ opacity: 0.15 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <NavBar />

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <motion.div {...fadeUp(0)} style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>Settings</h1>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Manage your account, API keys, and risk parameters.</div>
          </motion.div>

          {/* Profile */}
          <motion.div {...fadeUp(0.05)} style={glassSection}>
            <div style={sectionHead}>Profile</div>
            <div style={sectionBody}>
              <Field label="Full name">
                <div style={rowStyle}>
                  <input style={{ ...inputStyle, flex: 1 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <motion.button style={btnPrimary} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveProfile} disabled={loading.profile}>
                    {loading.profile ? 'Saving…' : 'Save'}
                  </motion.button>
                </div>
                <StatusMsg msg={msg.profile} />
              </Field>
              <Field label="Email">
                <input style={{ ...inputStyle, opacity: 0.5 }} value={user?.email || ''} readOnly />
              </Field>
            </div>
          </motion.div>

          {/* Risk */}
          <motion.div {...fadeUp(0.1)} style={glassSection}>
            <div style={sectionHead}>Risk Parameters</div>
            <div style={sectionBody}>
              <Field label="Bankroll ($)" hint="Enter your bankroll in dollars. Used for Kelly Criterion position sizing.">
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  step={100}
                  placeholder="e.g. 5000"
                  value={form.bankroll_dollars}
                  onChange={(e) => setForm({ ...form, bankroll_dollars: e.target.value })}
                />
                {form.bankroll_dollars > 0 && (
                  <div style={{ marginTop: 5, fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                    = ${parseFloat(form.bankroll_dollars || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </Field>
              <Field
                label={`Kelly Fraction — ${(form.kelly_fraction * 100).toFixed(0)}%`}
                hint="Fraction of full Kelly to bet per signal. 25% is standard. Lower = more conservative."
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input
                    type="range" min={0.05} max={0.5} step={0.05}
                    value={form.kelly_fraction}
                    onChange={(e) => setForm({ ...form, kelly_fraction: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: '#6366f1' }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#6366f1', minWidth: 44 }}>
                    {(form.kelly_fraction * 100).toFixed(0)}%
                  </span>
                </div>
              </Field>
              <motion.button style={btnPrimary} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveBankroll} disabled={loading.bankroll}>
                {loading.bankroll ? 'Saving…' : 'Save Risk Settings'}
              </motion.button>
              <StatusMsg msg={msg.bankroll} />
            </div>
          </motion.div>

          {/* Kalshi */}
          <motion.div {...fadeUp(0.15)} style={glassSection}>
            <div style={sectionHead}>Kalshi API</div>
            <div style={sectionBody}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Status:</span>
                {user?.has_kalshi_key
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: '#10d97b' }}>✓ Connected</span>
                  : <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Not configured</span>}
              </div>
              <Field label="Kalshi API Key" hint="Your Kalshi API key — stored encrypted. Required to pull live market prices.">
                <div style={rowStyle}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="password"
                    placeholder={user?.has_kalshi_key ? '••••••••••• (replace to update)' : 'Enter your Kalshi API key'}
                    value={form.kalshi_api_key}
                    onChange={(e) => setForm({ ...form, kalshi_api_key: e.target.value })}
                  />
                  <motion.button style={btnPrimary} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveKalshi} disabled={loading.kalshi || !form.kalshi_api_key}>
                    {loading.kalshi ? 'Saving…' : 'Save'}
                  </motion.button>
                </div>
                <StatusMsg msg={msg.kalshi} />
              </Field>
            </div>
          </motion.div>

          {/* Discord */}
          <motion.div {...fadeUp(0.2)} style={glassSection}>
            <div style={sectionHead}>Discord Alerts</div>
            <div style={sectionBody}>
              <Field label="Webhook URL" hint="Paste your Discord channel webhook URL. Alerts fire automatically when a high-confidence signal is detected.">
                <input
                  style={inputStyle}
                  type="url"
                  placeholder="https://discord.com/api/webhooks/…"
                  value={form.discord_webhook_url}
                  onChange={(e) => setForm({ ...form, discord_webhook_url: e.target.value })}
                />
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button style={btnPrimary} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveDiscord} disabled={loading.discord}>
                  {loading.discord ? 'Saving…' : 'Save Webhook'}
                </motion.button>
                <motion.button style={btnGhost} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={testDiscord} disabled={loading.discordTest || !form.discord_webhook_url}>
                  {loading.discordTest ? 'Sending…' : 'Send Test'}
                </motion.button>
              </div>
              <StatusMsg msg={msg.discord} />
            </div>
          </motion.div>

          {/* Auto-Execution */}
          <motion.div {...fadeUp(0.25)} style={glassSection}>
            <div style={sectionHead}>Auto-Execution</div>
            <div style={sectionBody}>
              <div style={{
                background: 'rgba(245,158,11,0.07)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 9,
                padding: '10px 14px',
                marginBottom: 20,
                fontSize: 12,
                color: '#f59e0b',
                lineHeight: 1.6,
              }}>
                ⚠ Auto-execution places real money bets on your Kalshi account. Requires a valid Kalshi API key and sufficient balance. Use at your own risk.
              </div>

              <Field label="Auto-execute signals" hint="When enabled, qualifying signals will automatically place orders on Kalshi at the Kelly-sized amount.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                  <div
                    onClick={() => setForm({ ...form, auto_bet_enabled: !form.auto_bet_enabled })}
                    style={{
                      width: 44, height: 24, borderRadius: 100,
                      background: form.auto_bet_enabled ? '#10d97b' : 'rgba(255,255,255,0.1)',
                      border: `1px solid ${form.auto_bet_enabled ? '#10d97b' : 'rgba(255,255,255,0.15)'}`,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.25s',
                    }}
                  >
                    <motion.div
                      animate={{ x: form.auto_bet_enabled ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      style={{
                        position: 'absolute', top: 2, width: 18, height: 18,
                        borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 13, color: form.auto_bet_enabled ? '#10d97b' : 'rgba(255,255,255,0.4)', fontWeight: 600, transition: 'color 0.2s' }}>
                    {form.auto_bet_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </Field>

              <Field
                label={`Minimum confidence — ${form.auto_bet_min_confidence.toFixed(0)}/100`}
                hint="Only signals above this confidence threshold will be auto-executed. Recommended: 85+."
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input
                    type="range" min={75} max={100} step={1}
                    value={form.auto_bet_min_confidence}
                    onChange={(e) => setForm({ ...form, auto_bet_min_confidence: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: '#10d97b' }}
                    disabled={!form.auto_bet_enabled}
                  />
                  <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#10d97b', minWidth: 44, opacity: form.auto_bet_enabled ? 1 : 0.35 }}>
                    {form.auto_bet_min_confidence.toFixed(0)}
                  </span>
                </div>
              </Field>

              <motion.button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10d97b, #059669)' }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveAutoBet} disabled={loading.autobet}>
                {loading.autobet ? 'Saving…' : 'Save Auto-Execution'}
              </motion.button>
              <StatusMsg msg={msg.autobet} />
            </div>
          </motion.div>

          {/* Password */}
          <motion.div {...fadeUp(0.32)} style={glassSection}>
            <div style={sectionHead}>Change Password</div>
            <div style={sectionBody}>
              <Field label="Current password">
                <input style={inputStyle} type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
              </Field>
              <Field label="New password">
                <input style={inputStyle} type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder="At least 8 characters" />
              </Field>
              <motion.button style={btnPrimary} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={changePassword} disabled={loading.pw || !pw.new_password}>
                {loading.pw ? 'Updating…' : 'Update Password'}
              </motion.button>
              <StatusMsg msg={msg.pw} />
            </div>
          </motion.div>

          {/* API Key */}
          <motion.div {...fadeUp(0.35)} style={glassSection}>
            <div style={sectionHead}>API Key</div>
            <div style={sectionBody}>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 9,
                padding: '12px 16px',
                fontFamily: 'monospace',
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(255,255,255,0.07)',
                wordBreak: 'break-all',
                letterSpacing: '0.04em',
              }}>
                {user?.api_key || '—'}
              </div>
              <div style={{ marginTop: 12 }}>
                <motion.button
                  style={btnGhost}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    try {
                      const { api_key } = await api.rotateApiKey()
                      localStorage.setItem('alpha_api_key', api_key)
                      await refresh()
                      setM('apikey', '✓ API key rotated — update any integrations')
                    } catch (ex) {
                      setM('apikey', ex.error || 'Rotation failed')
                    }
                  }}
                >
                  Rotate Key
                </motion.button>
                <StatusMsg msg={msg.apikey} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
