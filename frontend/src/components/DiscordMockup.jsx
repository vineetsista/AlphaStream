import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ALERTS = [
  { player: 'Luka Doncic', stat: 'PTS', line: 28.5, dir: 'OVER', conf: 87, ev: 8.2, size: 127, sport: 'NBA' },
  { player: 'Aaron Judge', stat: 'HR', line: 0.5, dir: 'OVER', conf: 91, ev: 11.3, size: 184, sport: 'MLB' },
  { player: 'Nikola Jokic', stat: 'REB', line: 11.5, dir: 'OVER', conf: 83, ev: 6.8, size: 103, sport: 'NBA' },
];

export default function DiscordMockup() {
  const [alertIdx, setAlertIdx] = useState(0);
  const [messages, setMessages] = useState([ALERTS[0]]);

  useEffect(() => {
    const t = setInterval(() => {
      setAlertIdx((i) => {
        const next = (i + 1) % ALERTS.length;
        setMessages((prev) => [...prev.slice(-2), ALERTS[next]]);
        return next;
      });
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const times = ['9:12 PM', '9:14 PM', '9:17 PM'];

  return (
    <div className="discord-mock" style={{ width: '100%', maxWidth: 440 }}>
      {/* Title bar */}
      <div style={{
        background: '#1e1f22',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f57','#febc2e','#28c840'].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
          Discord — #alpha-signals
        </span>
      </div>

      <div style={{ display: 'flex', height: 340 }}>
        {/* Sidebar */}
        <div style={{
          width: 56, background: '#1e1f22',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '12px 0', gap: 8,
          borderRight: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          {['⚡', '⚾', '📡'].map((icon, i) => (
            <div key={i} style={{
              width: 36, height: 36, borderRadius: i === 0 ? '12px' : '50%',
              background: i === 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              border: i === 0 ? '1px solid rgba(0,255,136,0.3)' : 'none',
            }}>
              {icon}
            </div>
          ))}
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, background: '#313338', display: 'flex', flexDirection: 'column' }}>
          {/* Channel header */}
          <div style={{
            padding: '8px 12px', background: '#2b2d31',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>#</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>alpha-signals</span>
            <span className="live-badge" style={{ fontSize: 9, padding: '2px 8px', marginLeft: 6 }}>LIVE</span>
          </div>

          {/* Message list */}
          <div style={{ flex: 1, padding: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'flex-end' }}>
            <AnimatePresence mode="popLayout">
              {messages.map((alert, i) => (
                <motion.div
                  key={`${alert.player}-${i}`}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #00ff88, #00c96a)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 900, color: '#010308',
                    }}>
                      α
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#00ff88' }}>Alpha-Stream</span>
                        <span style={{
                          fontSize: 9, background: 'rgba(0,255,136,0.15)',
                          color: '#00ff88', padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                        }}>BOT</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {times[i % times.length]}
                        </span>
                      </div>
                      {/* Embed */}
                      <div className="discord-embed">
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#00ff88', marginBottom: 6 }}>
                          {alert.dir === 'OVER' ? '🟢' : '🔴'} SIGNAL DETECTED — {alert.conf}/100
                        </div>
                        <div style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>
                          {alert.sport && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: alert.sport === 'MLB' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)', color: alert.sport === 'MLB' ? '#3b82f6' : '#a855f7', marginRight: 6 }}>{alert.sport}</span>}
                          <strong>{alert.player}</strong> {alert.dir} {alert.line} {alert.stat}
                        </div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.6)',
                        }}>
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>EV</div>
                            <div style={{ color: '#00ff88', fontWeight: 700 }}>+{alert.ev}%</div>
                          </div>
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Kelly Size</div>
                            <div style={{ fontWeight: 700 }}>${alert.size}</div>
                          </div>
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Conf.</div>
                            <div style={{ color: alert.conf >= 80 ? '#00ff88' : '#f59e0b', fontWeight: 700 }}>{alert.conf}/100</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input bar mockup */}
          <div style={{
            margin: '0 12px 12px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '10px 14px',
            color: 'rgba(255,255,255,0.25)', fontSize: 13,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            Message #alpha-signals
          </div>
        </div>
      </div>
    </div>
  );
}
