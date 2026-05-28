import { useEffect, useRef, useState } from 'react';

export default function AnimatedCounter({ to, duration = 1800, prefix = '', suffix = '', decimals = 0 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(parseFloat((eased * to).toFixed(decimals)));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration, decimals]);

  return (
    <span ref={ref}>
      {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}
