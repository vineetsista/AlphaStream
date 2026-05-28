import { useEffect, useRef, useState } from 'react';

export default function ConfidenceRing({ value = 0, size = 80, stroke = 6 }) {
  const [animated, setAnimated] = useState(0);
  const ref = useRef(null);

  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (animated / 100) * circ;

  const color = value >= 80 ? '#00ff88' : value >= 60 ? '#f59e0b' : '#ef4444';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min((now - start) / 900, 1);
          const eased = 1 - Math.pow(1 - t, 2);
          setAnimated(eased * value);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="conf-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke 0.3s', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.22, fontWeight: 700,
        color, fontFamily: 'var(--font-mono)',
      }}>
        {Math.round(animated)}
      </span>
    </div>
  );
}
