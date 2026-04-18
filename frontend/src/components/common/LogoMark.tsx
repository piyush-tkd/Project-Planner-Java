/**
 * LogoMark — animated 4-triangle brand mark.
 * Uses CSS keyframe animations so the logo pulses even inside <img> tags
 * isn't needed — we render it inline so SVG animations always work.
 */

interface LogoMarkProps {
  /** Rendered size in px (both width & height). Default 28. */
  size?: number;
  /** Extra className (e.g. "logo-mark-animated" for the hover glow). */
  className?: string;
  style?: React.CSSProperties;
}

export function LogoMark({ size = 28, className, style }: LogoMarkProps) {
  const id = 'lm'; // short prefix for animation names — stable, no conflict
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-label="Portfolio Planner logo"
      role="img"
    >
      <defs>
        <style>{`
          .${id}-1 { animation: ${id}p1 1.8s ease-in-out infinite; }
          .${id}-2 { animation: ${id}p2 1.8s ease-in-out infinite; }
          .${id}-3 { animation: ${id}p3 1.8s ease-in-out infinite; }
          .${id}-4 { animation: ${id}p4 1.8s ease-in-out infinite; }
          @keyframes ${id}p1 {
            0%,100% { fill: #5DD5DB; opacity: 1; }
            50%     { fill: #1E3A52; opacity: 0.6; }
          }
          @keyframes ${id}p2 {
            0%,100% { fill: #2B9BA3; opacity: 0.7; }
            50%     { fill: #5DD5DB; opacity: 1; }
          }
          @keyframes ${id}p3 {
            0%,100% { fill: #1E3A52; opacity: 1; }
            50%     { fill: #2B9BA3; opacity: 0.7; }
          }
          @keyframes ${id}p4 {
            0%,100% { fill: #2C4A66; opacity: 0.8; }
            50%     { fill: #5DD5DB; opacity: 1; }
          }
        `}</style>
      </defs>
      <polygon className={`${id}-1`} points="0,0 200,0 100,100"   fill="#5DD5DB" />
      <polygon className={`${id}-2`} points="200,0 200,200 100,100" fill="#2B9BA3" />
      <polygon className={`${id}-3`} points="200,200 0,200 100,100" fill="#1E3A52" />
      <polygon className={`${id}-4`} points="0,200 0,0 100,100"   fill="#2C4A66" />
    </svg>
  );
}

export default LogoMark;
