import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import SignalCard from '../components/SignalCard.jsx';
import SignalDrawer from '../components/SignalDrawer.jsx';
import HeroMetrics from '../components/HeroMetrics.jsx';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { useDemo } from '../hooks/useDemo.jsx';

const REFRESH_INTERVAL = 30_000;

// Web Audio API ping for high-confidence signals.
let _audioCtx = null;
function playPing(intensity = 1) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    // dual-oscillator chime
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.0001, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.14 * intensity, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.5);
    });
  } catch { /* audio blocked by browser */ }
}

export default function Dashboard() {
  const { user } = useAuth();
  const { demoMode } = useDemo();
  const navigate = useNavigate();
  const [signals, setSignals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [newIds, setNewIds] = useState(new Set());
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filters, setFilters] = useState({ sort: 'confidence', direction: '', min_confidence: 0, sport: '' });
  const [perfStats, setPerfStats] = useState(null);
  const [dailyPnl, setDailyPnl] = useState([]);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const intervalRef = useRef(null);
  const prevIds = useRef(new Set());

  const fetchSignals = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = { page: 1, per_page: 50, sort: filters.sort };
      if (filters.direction) params.direction = filters.direction;
      if (filters.min_confidence > 0) params.min_confidence = filters.min_confidence;
      if (filters.sport) params.sport = filters.sport;
      const data = await api.getSignals(params);
      const list = data.signals || [];
      const newSet = new Set(list.map((s) => s.id).filter((id) => !prevIds.current.has(id)));
      prevIds.current = new Set(list.map((s) => s.id));
      setSignals(list);
      setTotal(data.total || 0);
      setNewIds(newSet);
      setLastRefresh(new Date());
      if (newSet.size > 0) setTimeout(() => setNewIds(new Set()), 5000);
    } catch (ex) {
      // network / auth error — leave existing signals visible
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSignals(true);
    intervalRef.current = setInterval(() => fetchSignals(false), REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchSignals]);

  useEffect(() => {
    api.getBacktest(30).then(setPerfStats).catch(() => {});
    api.getBacktestHistory(30).then((d) => setDailyPnl(d.daily_pnl || [])).catch(() => {});
  }, [demoMode]);

  // refetch when demo mode toggles
  useEffect(() => { fetchSignals(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [demoMode]);

  // SSE: push new signals instantly without waiting for the 30s poll
  useEffect(() => {
    const key = localStorage.getItem('alpha_api_key');
    if (!key) return;
    const es = new EventSource(`/api/signals/stream?api_key=${encodeURIComponent(key)}`);
    es.onmessage = (e) => {
      try {
        const sig = JSON.parse(e.data);
        setSignals((prev) => {
          if (prev.some((s) => s.id === sig.id)) return prev;
          // ping on high-confidence signal
          if (sig.confidence >= 88) playPing(1);
          else if (sig.confidence >= 82) playPing(0.5);
          setNewIds((ids) => {
            const next = new Set([...ids, sig.id]);
            setTimeout(() => setNewIds(new Set()), 5000);
            return next;
          });
          setLastRefresh(new Date());
          return [sig, ...prev];
        });
      } catch { /* ignore malformed frames */ }
    };
    es.onerror = () => es.close(); // browser will not retry closed EventSource
    return () => es.close();
  }, []);

  async function handleResolve() {
    setResolving(true);
    setScanMsg('');
    try {
      const result = await api.resolveOutcomes();
      setScanMsg(`Outcomes resolved — ${result.resolved_total} total signals resolved so far`);
      await fetchSignals(false);
    } catch (ex) {
      setScanMsg(ex.error || 'Resolve failed');
    } finally {
      setResolving(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanMsg('');
    try {
      const result = await api.scanNow();
      setScanMsg(`Scanned ${result.scanned} markets — ${result.new_signals} new signal${result.new_signals !== 1 ? 's' : ''} found`);
      await fetchSignals(false);
    } catch (ex) {
      setScanMsg(ex.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function handleSeedDemo() {
    setScanning(true);
    setScanMsg('');
    try {
      const r = await api.adminSeedDemo();
      setScanMsg(`✨ Demo slate loaded — ${r.inserted} signals ready for showtime`);
      await fetchSignals(false);
      api.getBacktest(30).then(setPerfStats).catch(() => {});
      api.getBacktestHistory(30).then((d) => setDailyPnl(d.daily_pnl || [])).catch(() => {});
    } catch (ex) {
      setScanMsg(ex.error || 'Demo seed failed');
    } finally {
      setScanning(false);
    }
  }

  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  const selectStyle = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 9, padding: '8px 14px', color: '#fff',
    fontSize: 13, cursor: 'pointer', outline: 'none',
    backdropFilter: 'blur(8px)', colorScheme: 'dark',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div className="orbs-container" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div className="orb-2" style={{ opacity: 0.3 }} />
        <div className="orb-3" style={{ opacity: 0.2 }} />
      </div>

      <SignalDrawer
        signal={selectedSignal}
        isOpen={!!selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <NavBar />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}
          >
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>
                Signal Feed
              </h1>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {total} signal{total !== 1 ? 's' : ''} · auto-refreshes every 30s
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {user?.is_admin && (
                <motion.button
                  onClick={handleSeedDemo}
                  disabled={scanning}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '11px 20px', fontSize: 13, fontWeight: 700, borderRadius: 10,
                    border: '1px solid rgba(255,107,53,0.4)', cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(168,85,247,0.12))',
                    color: '#ff6b35',
                  }}
                  title="Admin: load demo data slate"
                >
                  ✨ Demo Slate
                </motion.button>
              )}
              <motion.button
                onClick={handleResolve}
                disabled={resolving || scanning}
                whileHover={resolving ? {} : { scale: 1.04 }}
                whileTap={resolving ? {} : { scale: 0.97 }}
                style={{
                  padding: '11px 20px', fontSize: 13, fontWeight: 700, borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
                  opacity: resolving ? 0.5 : 1,
                }}
              >
                {resolving ? '⟳ Resolving…' : '✓ Resolve Outcomes'}
              </motion.button>
              <motion.button
                className="btn-primary"
                onClick={handleScan}
                disabled={scanning}
                whileHover={scanning ? {} : { scale: 1.04 }}
                whileTap={scanning ? {} : { scale: 0.97 }}
                style={{ padding: '11px 24px', fontSize: 14, opacity: scanning ? 0.7 : 1 }}
              >
                {scanning ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      style={{ display: 'inline-block' }}
                    >⟳</motion.span>
                    Scanning…
                  </span>
                ) : '⚡ Scan Now'}
              </motion.button>
            </div>
          </motion.div>

          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}
          >
            <span className="live-badge" style={{ fontSize: 11, padding: '3px 10px' }}>LIVE</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Last refresh: {lastRefresh ? lastRefresh.toLocaleTimeString() : '—'}
            </span>
            {demoMode && user?.is_admin && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '4px 12px', borderRadius: 100, fontSize: 10, fontWeight: 800,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(168,85,247,0.15))',
                  border: '1px solid rgba(255,107,53,0.35)',
                  color: '#ff6b35',
                }}
              >
                ✨ Demo Slate Active
              </motion.span>
            )}
          </motion.div>

          {/* Scan result toast */}
          <AnimatePresence>
            {scanMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass"
                style={{
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                  fontSize: 13, color: 'rgba(255,255,255,0.7)',
                  borderLeft: '3px solid var(--accent)',
                }}
              >
                {scanMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wow-factor hero metrics */}
          <HeroMetrics
            signals={signals}
            perfStats={perfStats}
            dailyPnl={dailyPnl}
            bankroll={user?.bankroll_dollars || 0}
          />

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <select style={selectStyle} value={filters.sort} onChange={setFilter('sort')}>
              <option value="confidence">Sort: Confidence</option>
              <option value="ev">Sort: EV%</option>
              <option value="time">Sort: Time</option>
            </select>
            <select style={selectStyle} value={filters.sport} onChange={setFilter('sport')}>
              <option value="">All sports</option>
              <option value="NBA">NBA</option>
              <option value="MLB">MLB</option>
              <option value="NFL">NFL</option>
            </select>
            <select style={selectStyle} value={filters.direction} onChange={setFilter('direction')}>
              <option value="">All directions</option>
              <option value="OVER">OVER only</option>
              <option value="UNDER">UNDER only</option>
            </select>
            <input
              className="input-field"
              type="number"
              min={0} max={100}
              placeholder="Min confidence"
              value={filters.min_confidence || ''}
              onChange={(e) => setFilters({ ...filters, min_confidence: parseFloat(e.target.value) || 0 })}
              style={{ width: 150, padding: '8px 14px', fontSize: 13 }}
            />
          </motion.div>

          {/* Signal grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 36, height: 36, border: '3px solid rgba(0,255,136,0.3)', borderTopColor: 'var(--success)', borderRadius: '50%', margin: '0 auto 16px' }}
              />
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading signals…</div>
            </div>
          ) : signals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '80px 24px' }}
            >
              <div style={{ fontSize: 52, marginBottom: 16 }}>📡</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No signals yet</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 400, margin: '0 auto 12px' }}>
                Run a manual scan or wait for the next automatic scan every 5 min during game hours (NBA, MLB, NFL).
              </div>
              <span
                style={{ color: 'var(--accent)', fontSize: 13, cursor: 'pointer' }}
                onClick={() => navigate('/settings')}
              >
                Check your Kalshi API key in Settings →
              </span>
            </motion.div>
          ) : (
            <motion.div
              layout
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}
            >
              <AnimatePresence mode="popLayout">
                {signals.map((sig) => (
                  <SignalCard key={sig.id} signal={sig} isNew={newIds.has(sig.id)} onSelect={setSelectedSignal} onDelete={(deletedId) => setSignals((prev) => prev.filter((s) => s.id !== deletedId))} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
