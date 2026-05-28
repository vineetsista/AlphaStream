import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
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

export default function SignIn() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [form, setForm] = useState({ email: '', password: '' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // login | forgot | forgot_sent
  const [forgotEmail, setForgotEmail] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleLogin(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const user = await api.login(form)
      login(user)
      navigate(from, { replace: true })
    } catch (ex) {
      setErr(ex.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.forgotPassword(forgotEmail)
    } catch {
      // intentional — always show sent state
    } finally {
      setLoading(false)
      setMode('forgot_sent')
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
        key={mode}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="glass"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, borderRadius: 18, padding: '40px 36px' }}
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

        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Welcome back</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 28 }}>Sign in to your account</div>

              <AnimatePresence>
                {err && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, borderLeft: '3px solid #ef4444' }}
                  >{err}</motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Password</label>
                  <input style={inputStyle} type="password" value={form.password} onChange={set('password')} autoComplete="current-password" placeholder="••••••••" />
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
                      Signing in…
                    </span>
                  ) : 'Sign In →'}
                </motion.button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 13 }}>
                <button onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                  Forgot password?
                </button>
                <Link to="/onboarding" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create account →</Link>
              </div>
            </motion.div>
          )}

          {mode === 'forgot' && (
            <motion.div key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 6 }}>Reset password</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 28 }}>Enter your email and we'll send a reset link.</div>
              <form onSubmit={handleForgot}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required placeholder="you@example.com" />
                </div>
                <motion.button
                  className="btn-primary"
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? {} : { scale: 1.02 }}
                  whileTap={loading ? {} : { scale: 0.97 }}
                  style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 8, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </motion.button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>← Back to sign in</button>
              </div>
            </motion.div>
          )}

          {mode === 'forgot_sent' && (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} style={{ textAlign: 'center', padding: '12px 0' }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                style={{ fontSize: 48, marginBottom: 20 }}
              >📧</motion.div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 10 }}>Check your inbox</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
                If that email is registered, a reset link is on its way.
              </div>
              <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>← Back to sign in</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
