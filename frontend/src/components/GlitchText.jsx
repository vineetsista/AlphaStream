export default function GlitchText({ text, style = {}, className = '' }) {
  return (
    <span
      className={`glitch-text ${className}`}
      data-text={text}
      style={style}
    >
      {text}
    </span>
  );
}
