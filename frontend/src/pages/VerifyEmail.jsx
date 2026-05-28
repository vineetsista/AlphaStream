import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api.js'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const [state, setState] = useState('loading') // loading | success | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMsg('No verification token provided.')
      return
    }
    api.verifyEmail(token)
      .then(() => {
        setState('success')
        setTimeout(() => navigate('/signin'), 3500)
      })
      .catch((ex) => {
        setState('error')
        setMsg(ex.error || 'Verification failed. The link may have expired.')
      })
  }, [token])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-1" style={{ opacity: 0.5 }} />
        <div className="orb-2" style={{ opacity: 0.3 }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="glass"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, borderRadius: 18, padding: '48px 36px', textAlign: 'center' }}
      >
        {/* Logo mark */}
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-b))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 900, color: '#000', margin: '0 auto 28px',
          boxShadow: '0 0 24px rgba(0,255,136,0.4)',
        }}>α</div>

        <AnimatePresence mode="wait">
          {state === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 40, height: 40, border: '3px solid rgba(0,255,136,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 24px' }}
              />
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>Verifying your email…</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Just a moment.</div>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                style={{ fontSize: 52, marginBottom: 20 }}
              >✅</motion.div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 10 }}>Email verified!</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
                Your account is active. Redirecting you to sign in…
              </div>
              {/* Progress bar */}
              <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3.5, ease: 'linear' }}
                  style={{ height: '100%', background: 'var(--accent)', borderRadius: 2 }}
                />
              </div>
              <Link to="/signin" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>Go to sign in →</Link>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                style={{ fontSize: 52, marginBottom: 20 }}
              >❌</motion.div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 10 }}>Verification failed</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>{msg}</div>
              <Link to="/signin" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>Go to sign in →</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
