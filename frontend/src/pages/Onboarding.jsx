import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api.js'
import { useAuth } from '../App.jsx'

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '12px 14px', color: '#fff', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s',
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: 7, display: 'block',
}

export default function Onboarding() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (form.password.length < 8) {
      setErr('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await api.register(form)
      setRegistered(true)
    } catch (ex) {
      setErr(ex.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-1" style={{ opacity: 0.5 }} />
        <div className="orb-2" style={{ opacity: 0.3 }} />
      </div>

      <motion.div
        key={registered ? 'success' : 'form'}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="glass"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, borderRadius: 18, padding: '40px 36px' }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: '#000',
            boxShadow: '0 0 20px rgba(0,255,136,0.4)',
          }}>α</div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Alpha-Stream</span>
        </div>

        {registered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
            style={{ textAlign: 'center', padding: '12px 0' }}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
              style={{ fontSize: 52, marginBottom: 20 }}
            >📧</motion.div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 12 }}>Check your email</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.75 }}>
              We sent a verification link to{' '}
              <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{form.email}</strong>.
              <br />Click it to activate your account and start using Alpha-Stream.
            </div>
            <div style={{ marginTop: 28 }}>
              <Link to="/signin" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>Go to sign in →</Link>
            </div>
          </motion.div>
        ) : (
          <>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Create your account</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>Personal quant edge — free and self-hosted.</div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.2)',
              borderRadius: 9, padding: '10px 14px', marginBottom: 24,
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 15, fontWeight: 800 }}>✓</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Bring your own Kalshi API key · No payment, no limits</span>
            </div>

            <AnimatePresence>
              {err && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, borderLeft: '3px solid #ef4444' }}
                >{err}</motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Full name</label>
                <input style={inputStyle} value={form.name} onChange={set('name')} required placeholder="Jane Smith" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Email address</label>
                <input style={inputStyle} type="email" value={form.email} onChange={set('email')} required placeholder="jane@example.com" />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" value={form.password} onChange={set('password')} required placeholder="At least 8 characters" />
              </div>
              <motion.button
                className="btn-primary"
                type="submit"
                disabled={loading}
                whileHover={loading ? {} : { scale: 1.02 }}
                whileTap={loading ? {} : { scale: 0.97 }}
                style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 16, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block' }}>⟳</motion.span>
                    Creating account…
                  </span>
                ) : 'Create Account →'}
              </motion.button>
            </form>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
              By signing up you agree to our terms. Alpha-Stream is an analytical tool — not financial advice.
            </p>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              Already have an account?{' '}
              <Link to="/signin" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
