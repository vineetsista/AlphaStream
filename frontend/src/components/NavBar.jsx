import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../App.jsx';
import { useDemo } from '../hooks/useDemo.jsx';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/backtest', label: 'Backtest' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const { demoMode, toggleDemoMode } = useDemo();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  const navLinks = [...NAV_LINKS];
  if (user?.is_admin) navLinks.push({ to: '/admin', label: 'Admin', accent: true });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'sticky', top: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 62,
        background: scrolled ? 'rgba(2,8,16,0.85)' : 'rgba(2,8,16,0.6)',
        backdropFilter: `blur(${scrolled ? 20 : 12}px)`,
        WebkitBackdropFilter: `blur(${scrolled ? 20 : 12}px)`,
        borderBottom: scrolled
          ? '1px solid rgba(0,255,136,0.12)'
          : '1px solid rgba(255,255,255,0.06)',
        transition: 'background 0.3s, border 0.3s, backdrop-filter 0.3s',
      }}
    >
      {/* Logo */}
      <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <motion.div
          whileHover={{ scale: 1.08, rotate: 5 }}
          style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--success), #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 900, color: '#000',
            boxShadow: '0 0 16px rgba(0,255,136,0.35)',
          }}
        >
          α
        </motion.div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
          Alpha<span style={{ color: 'var(--success)' }}>Stream</span>
        </span>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {navLinks.map((l) => {
          const active = location.pathname === l.to;
          const accent = l.accent;
          return (
            <Link key={l.to} to={l.to} style={{ textDecoration: 'none', position: 'relative' }}>
              <motion.div
                whileHover={{ scale: 1.04 }}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: active
                    ? '#fff'
                    : accent ? '#ff6b35' : 'rgba(255,255,255,0.5)',
                  background: active
                    ? (accent ? 'rgba(255,107,53,0.12)' : 'rgba(0,255,136,0.1)')
                    : 'transparent',
                  border: active
                    ? `1px solid ${accent ? 'rgba(255,107,53,0.3)' : 'rgba(0,255,136,0.2)'}`
                    : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {l.label}
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Demo toggle — admin only */}
        {user?.is_admin && (
          <motion.button
            onClick={toggleDemoMode}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 13px', borderRadius: 100, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              background: demoMode ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${demoMode ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.12)'}`,
              color: demoMode ? 'var(--success)' : 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              boxShadow: demoMode ? '0 0 14px rgba(0,255,136,0.3)' : 'none',
              transition: 'all 0.25s',
            }}
            title="Toggle demo data mode (admin only)"
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: demoMode ? 'var(--success)' : 'rgba(255,255,255,0.3)',
                animation: demoMode ? 'live-dot 1.5s ease-in-out infinite' : 'none',
              }}
            />
            DEMO {demoMode ? 'ON' : 'OFF'}
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 12,
            fontWeight: 600, padding: '6px 14px', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          }}
        >
          Sign out
        </motion.button>
      </div>
    </motion.nav>
  );
}
