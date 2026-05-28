import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RADAR_DOTS = [
  { angle: 38, radius: 0.62, label: 'Luka PTS', conf: 87 },
  { angle: 115, radius: 0.45, label: 'Judge HR', conf: 92 },
  { angle: 190, radius: 0.72, label: 'Mahomes PASS', conf: 74 },
  { angle: 260, radius: 0.38, label: 'Acuña H', conf: 88 },
  { angle: 320, radius: 0.58, label: 'Jokic REB', conf: 71 },
];

function dotPosition(angle, radius, size) {
  const rad = (angle - 90) * (Math.PI / 180);
  const r = (size / 2) * radius;
  return {
    x: size / 2 + r * Math.cos(rad),
    y: size / 2 + r * Math.sin(rad),
  };
}

export default function RadarScan({ size = 360 }) {
  const [activeDot, setActiveDot] = useState(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const tick = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const angle = (elapsed / 4000) * 360 % 360;
      setSweepAngle(angle);

      RADAR_DOTS.forEach((d, i) => {
        const diff = Math.abs(((angle - d.angle) + 360) % 360);
        if (diff < 8) setActiveDot(i);
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Outer glow */}
      <div style={{
        position: 'absolute', inset: -20,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,255,136,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Main radar circle */}
      <div
        className="radar-container"
        style={{ width: size, height: size, background: 'rgba(0, 18, 10, 0.85)' }}
      >
        {/* Crosshairs */}
        <div className="radar-crosshair" />
        <div className="radar-crosshair-v" />

        {/* Rings */}
        {rings.map((r, i) => (
          <div
            key={i}
            className="radar-ring"
            style={{
              width: size * r, height: size * r,
              opacity: 0.4 - i * 0.06,
            }}
          />
        ))}

        {/* Sweep */}
        <div
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(from ${sweepAngle}deg, transparent 340deg, rgba(0,255,136,0.04) 352deg, rgba(0,255,136,0.25) 360deg)`,
          }}
        />

        {/* Sweep arm line */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '50%', height: '1px',
          transformOrigin: '0 50%',
          transform: `rotate(${sweepAngle}deg)`,
          background: 'linear-gradient(90deg, rgba(0,255,136,0.8), transparent)',
          boxShadow: '0 0 8px rgba(0,255,136,0.5)',
        }} />

        {/* Dots */}
        {RADAR_DOTS.map((dot, i) => {
          const pos = dotPosition(dot.angle, dot.radius, size);
          const isActive = activeDot === i;
          const color = dot.conf >= 80 ? '#00ff88' : dot.conf >= 65 ? '#f59e0b' : '#ef4444';
          return (
            <div key={i}>
              <div style={{
                position: 'absolute',
                left: pos.x - 4, top: pos.y - 4,
                width: 8, height: 8,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 10px ${color}`,
                zIndex: 2,
              }} />
              {isActive && (
                <>
                  <div style={{
                    position: 'absolute',
                    left: pos.x - 12, top: pos.y - 12,
                    width: 24, height: 24,
                    borderRadius: '50%',
                    border: `1px solid ${color}`,
                    animation: 'radar-ping 1s ease-out',
                    animationFillMode: 'forwards',
                    zIndex: 1,
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: pos.x - 20, top: pos.y - 20,
                    width: 40, height: 40,
                    borderRadius: '50%',
                    border: `1px solid ${color}`,
                    opacity: 0.4,
                    animation: 'radar-ping 1.4s ease-out 0.2s',
                    animationFillMode: 'forwards',
                    zIndex: 1,
                  }} />
                </>
              )}
            </div>
          );
        })}

        {/* Center dot */}
        <div className="radar-center-dot" />

        {/* Radar labels */}
        {RADAR_DOTS.map((dot, i) => {
          const pos = dotPosition(dot.angle, dot.radius, size);
          const isRight = pos.x > size / 2;
          const isBottom = pos.y > size / 2;
          return (
            <div
              key={`label-${i}`}
              style={{
                position: 'absolute',
                left: pos.x + (isRight ? 12 : -80),
                top: pos.y + (isBottom ? 8 : -22),
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'rgba(0, 255, 136, 0.7)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            >
              {dot.label}
            </div>
          );
        })}
      </div>

      {/* LIVE label */}
      <div style={{
        position: 'absolute', bottom: -36, left: '50%', transform: 'translateX(-50%)',
      }}>
        <span className="live-badge" style={{ fontSize: 10, padding: '4px 12px' }}>
          Scanning markets
        </span>
      </div>
    </div>
  );
}
