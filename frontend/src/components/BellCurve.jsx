import { motion } from 'framer-motion';

export default function BellCurve({ zScore = 2.4, width = 340, height = 140 }) {
  const pts = 120;
  const sigma = 1;
  const mean = 0;
  const xMin = -4, xMax = 4;

  const gaussian = (x) =>
    (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));

  const maxY = gaussian(0);

  const toSVG = (x, y) => ({
    sx: ((x - xMin) / (xMax - xMin)) * width,
    sy: height - (y / maxY) * (height - 20) - 10,
  });

  const pathPoints = Array.from({ length: pts }, (_, i) => {
    const x = xMin + (i / (pts - 1)) * (xMax - xMin);
    return { x, y: gaussian(x) };
  });

  const pathD = pathPoints
    .map((p, i) => {
      const { sx, sy } = toSVG(p.x, p.y);
      return `${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
    })
    .join(' ');

  const fillPoints = pathPoints.filter((p) => p.x >= zScore);
  const fillD = fillPoints.length
    ? [
        `M ${toSVG(zScore, gaussian(zScore)).sx.toFixed(1)} ${toSVG(zScore, gaussian(zScore)).sy.toFixed(1)}`,
        ...fillPoints.map((p) => {
          const { sx, sy } = toSVG(p.x, p.y);
          return `L ${sx.toFixed(1)} ${sy.toFixed(1)}`;
        }),
        `L ${toSVG(xMax, 0).sx} ${height - 10}`,
        `L ${toSVG(zScore, 0).sx.toFixed(1)} ${height - 10}`,
        'Z',
      ].join(' ')
    : '';

  const zX = toSVG(zScore, 0).sx;
  const zTop = toSVG(zScore, gaussian(zScore)).sy;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="curve-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,255,136,0.15)" />
            <stop offset="60%" stopColor="rgba(0,255,136,0.4)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.6)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Baseline */}
        <line x1={0} y1={height - 10} x2={width} y2={height - 10} stroke="rgba(0,255,136,0.1)" strokeWidth="1" />

        {/* Fill area to the right of z-score */}
        {fillD && (
          <motion.path
            d={fillD}
            fill="url(#curve-grad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />
        )}

        {/* Main curve */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="#00ff88"
          strokeWidth="2"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />

        {/* Z-score vertical line */}
        <motion.line
          x1={zX} y1={height - 10}
          x2={zX} y2={zTop}
          stroke="rgba(168,85,247,0.8)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          style={{ transformOrigin: `${zX}px ${height - 10}px` }}
        />

        {/* Z-score label */}
        <motion.text
          x={zX + 6} y={zTop - 6}
          fill="#a855f7"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          z = +{zScore}σ
        </motion.text>

        {/* Axis labels */}
        {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
          <text
            key={v}
            x={toSVG(v, 0).sx}
            y={height}
            textAnchor="middle"
            fill="rgba(180,255,210,0.3)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {v > 0 ? `+${v}` : v}
          </text>
        ))}
      </svg>

      <div style={{
        display: 'flex', gap: 16, marginTop: 12, fontSize: 11,
        fontFamily: 'var(--font-mono)', color: 'rgba(180,255,210,0.5)',
      }}>
        <span style={{ color: '#00ff88' }}>█</span> Historical distribution
        <span style={{ color: '#a855f7' }}>█</span> Z &gt; +{zScore}σ edge zone
      </div>
    </div>
  );
}
