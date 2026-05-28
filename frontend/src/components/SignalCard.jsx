import { useState } from 'react';
import { motion } from 'framer-motion';
import ConfidenceRing from './ConfidenceRing';
import { api } from '../api.js';

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toAmericanOdds(prob) {
  if (!prob || prob <= 0.001 || prob >= 0.999) return '—';
  if (prob >= 0.5) return `-${Math.round((prob / (1 - prob)) * 100)}`;
  return `+${Math.round(((1 - prob) / prob) * 100)}`;
}

export default function SignalCard({ signal, isNew = false, onSelect, onDelete }) {
  const {
    id, player, team, stat, line, direction,
    confidence, z_score, ev_pct,
    recommended_size_dollars,
    model_prob, market_prob,
    kalshi_url, timestamp, sport = 'NBA',
    volume_spike = false,
    position = '',
    streak_score = 0.5,
    last_5_results = '',
    actual_outcome: initialOutcome,
  } = signal;

  const sportColors = { NBA: '#a855f7', MLB: '#3b82f6', NFL: '#f59e0b', NHL: '#06b6d4' };
  const sportColor = sportColors[sport] || 'rgba(255,255,255,0.3)';

  const isOver = direction === 'OVER';
  const dirColor = isOver ? 'var(--success)' : '#ef4444';
  const evPositive = ev_pct > 0;
  const isFire = confidence >= 90;
  const isElite = confidence >= 88 && confidence < 90;

  const [outcome, setOutcome] = useState(initialOutcome || null);
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e) {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteSignal(id);
      onDelete && onDelete(id);
    } catch {
      setDeleting(false);
    }
  }

  async function logOutcome(result) {
    if (outcome || logging) return;
    setLogging(true);
    try {
      await api.updateOutcome(id, result);
      setOutcome(result);
    } catch {
      // silent
    } finally {
      setLogging(false);
    }
  }

  const outcomeColor = outcome === direction ? 'var(--success)' : outcome ? '#ef4444' : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="signal-card glass"
      onClick={() => onSelect && onSelect(signal)}
      style={{
        borderRadius: 14, padding: 22,
        borderLeft: `3px solid ${outcome ? outcomeColor : isNew ? 'var(--accent)' : dirColor}`,
        position: 'relative', overflow: 'hidden',
        cursor: onSelect ? 'pointer' : 'default',
        boxShadow: isFire && !outcome ? '0 0 22px rgba(255,107,53,0.18), 0 8px 24px rgba(0,0,0,0.4)' : undefined,
        borderColor: isFire && !outcome ? 'rgba(255,107,53,0.32)' : undefined,
      }}
    >
      {/* Fire-grade ambient glow */}
      {isFire && !outcome && (
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 180, height: 180,
          background: 'radial-gradient(circle at top right, rgba(255,107,53,0.18), transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              padding: '2px 7px', borderRadius: 4,
              background: `${sportColor}20`, border: `1px solid ${sportColor}50`,
              color: sportColor,
            }}>{sport}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.08em' }}>
              {team} · {stat}
            </span>
            {isFire && !outcome && (
              <motion.span
                animate={{ boxShadow: [
                  '0 0 0px rgba(255,107,53,0)',
                  '0 0 14px rgba(255,107,53,0.55)',
                  '0 0 0px rgba(255,107,53,0)',
                ] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  fontSize: 10, fontWeight: 900, padding: '2px 9px', borderRadius: 100,
                  background: 'linear-gradient(135deg, #ff6b35, #f59e0b)', color: '#0a0a0a',
                  letterSpacing: '0.1em',
                }}
              >⚡ FIRE</motion.span>
            )}
            {isElite && !outcome && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                background: 'rgba(168,85,247,0.15)', color: '#a855f7',
                border: '1px solid rgba(168,85,247,0.35)', letterSpacing: '0.08em',
              }}>★ ELITE</span>
            )}
            {volume_spike && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.35)', letterSpacing: '0.06em',
              }}>🔥 SPIKE</span>
            )}
            {streak_score >= 0.8 && last_5_results.length >= 4 && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                background: 'rgba(0,255,136,0.12)', color: '#10d97b',
                border: '1px solid rgba(0,255,136,0.3)', letterSpacing: '0.06em',
              }}>🔥 HOT</span>
            )}
            {streak_score <= 0.2 && last_5_results.length >= 4 && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.3)', letterSpacing: '0.06em',
              }}>❄ COLD</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{player}</span>
            {(team || position) && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em' }}>
                {[team, position].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: isOver ? 'rgba(0,255,136,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isOver ? 'rgba(0,255,136,0.25)' : 'rgba(239,68,68,0.25)'}`,
            borderRadius: 7, padding: '4px 10px',
          }}>
            <span style={{ color: dirColor, fontWeight: 800, fontSize: 13 }}>{direction}</span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{line}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isNew && !outcome && (
              <span className="live-badge" style={{ fontSize: 10, padding: '3px 10px' }}>NEW</span>
            )}
            <motion.button
              onClick={handleDelete}
              disabled={deleting}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', opacity: deleting ? 0.4 : 1,
              }}
            >✕</motion.button>
          </div>
          <ConfidenceRing value={confidence} size={68} stroke={5} />
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Z-Score', value: `${z_score > 0 ? '+' : ''}${z_score.toFixed(2)}`, color: Math.abs(z_score) > 2 ? 'var(--accent)' : 'rgba(255,255,255,0.8)' },
          { label: 'EV', value: `${evPositive ? '+' : ''}${ev_pct.toFixed(1)}%`, color: evPositive ? 'var(--success)' : '#ef4444' },
          { label: 'Kelly Size', value: `$${recommended_size_dollars.toFixed(0)}`, color: 'rgba(255,255,255,0.9)' },
        ].map((m) => (
          <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '9px 12px' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, fontWeight: 600 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: m.color, fontFamily: 'var(--font-mono)' }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Last-5 streak dots */}
      {last_5_results.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 3 }}>
            Last {last_5_results.length}
          </span>
          {last_5_results.split('').map((c, i) => (
            <div key={i} style={{
              width: 9, height: 9, borderRadius: '50%',
              background: c === '1' ? '#10d97b' : '#ef4444',
              boxShadow: c === '1' ? '0 0 5px rgba(16,217,123,0.5)' : '0 0 5px rgba(239,68,68,0.5)',
            }} />
          ))}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 3, fontFamily: 'monospace', fontWeight: 700 }}>
            {last_5_results.split('').filter(c => c === '1').length}/{last_5_results.length}
          </span>
        </div>
      )}

      {/* Odds comparison */}
      <div style={{ marginBottom: 14 }}>
        {/* YES / NO / Model boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
          {/* YES */}
          <div style={{
            borderRadius: 9, padding: '8px 10px', textAlign: 'center',
            background: isOver ? 'rgba(0,255,136,0.07)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isOver ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <div style={{ fontSize: 9, color: isOver ? 'rgba(0,255,136,0.6)' : 'rgba(255,255,255,0.25)', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 3 }}>YES</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#10d97b', fontFamily: 'monospace', lineHeight: 1 }}>
              {Math.round(market_prob * 100)}¢
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontFamily: 'monospace', fontWeight: 700 }}>
              {toAmericanOdds(market_prob)}
            </div>
          </div>

          {/* NO */}
          <div style={{
            borderRadius: 9, padding: '8px 10px', textAlign: 'center',
            background: !isOver ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${!isOver ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <div style={{ fontSize: 9, color: !isOver ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.25)', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 3 }}>NO</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace', lineHeight: 1 }}>
              {Math.round((1 - market_prob) * 100)}¢
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontFamily: 'monospace', fontWeight: 700 }}>
              {toAmericanOdds(1 - market_prob)}
            </div>
          </div>

          {/* Model fair value */}
          <div style={{
            borderRadius: 9, padding: '8px 10px', textAlign: 'center',
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.22)',
          }}>
            <div style={{ fontSize: 9, color: 'rgba(99,102,241,0.7)', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 3 }}>MODEL</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)', fontFamily: 'monospace', lineHeight: 1 }}>
              {Math.round(model_prob * 100)}¢
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontFamily: 'monospace', fontWeight: 700 }}>
              {toAmericanOdds(model_prob)}
            </div>
          </div>
        </div>

        {/* Edge callout */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            Edge: model {Math.round(model_prob * 100)}¢ vs market {Math.round(market_prob * 100)}¢
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800,
            color: model_prob > market_prob ? 'var(--success)' : '#ef4444',
          }}>
            {model_prob > market_prob ? '+' : ''}{((model_prob - market_prob) * 100).toFixed(0)}¢ edge
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {outcome ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{fmtTime(timestamp)}</span>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 6,
              background: outcome === direction ? 'rgba(0,255,136,0.12)' : 'rgba(239,68,68,0.12)',
              color: outcome === direction ? 'var(--success)' : '#ef4444',
              border: `1px solid ${outcome === direction ? 'rgba(0,255,136,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {outcome === direction ? '✓ WIN' : '✗ LOSS'} · {outcome}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{fmtTime(timestamp)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginRight: 2 }}>Result:</span>
              {['OVER', 'UNDER'].map((r) => (
                <motion.button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); logOutcome(r); }}
                  disabled={logging}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${r === 'OVER' ? 'rgba(0,255,136,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    background: r === 'OVER' ? 'rgba(0,255,136,0.08)' : 'rgba(239,68,68,0.08)',
                    color: r === 'OVER' ? 'var(--success)' : '#ef4444',
                    opacity: logging ? 0.5 : 1,
                  }}
                >{r}</motion.button>
              ))}
              {kalshi_url && (
                <a
                  href={kalshi_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 7, padding: '4px 10px', color: 'var(--accent)',
                    fontSize: 10, fontWeight: 700, textDecoration: 'none', marginLeft: 2,
                  }}
                >Kalshi ↗</a>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
