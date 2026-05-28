import { useRef } from 'react';

export default function TiltCard({ children, className = '', intensity = 12, ...props }) {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) scale(1.02)`;
    el.style.transition = 'transform 0.1s ease-out';
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
    el.style.transition = 'transform 0.5s ease-out';
  };

  return (
    <div ref={ref} className={className} onMouseMove={onMove} onMouseLeave={onLeave} {...props}>
      {children}
    </div>
  );
}
