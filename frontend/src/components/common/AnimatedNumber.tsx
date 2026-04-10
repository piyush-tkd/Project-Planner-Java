/**
 * AnimatedNumber — Sprint 6 S6-03
 *
 * Counts from 0 to a target value with easeOut (cubic) over configurable duration.
 * Used for KPI tiles and prominent numbers.
 *
 * - Only animates on first mount (prevents re-trigger on updates)
 * - Respects prefers-reduced-motion for accessibility
 * - Handles edge cases: NaN, Infinity, null
 */

import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // ms, default 800
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate once, on first mount
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Validate input
    const safeValue = !isFinite(value) ? 0 : value;

    // Respect prefers-reduced-motion for accessibility
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(safeValue);
      return;
    }

    const start = Date.now();
    let frameId: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);

      // easeOut cubic: 1 - (1 - progress)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(safeValue * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    // Cleanup on unmount
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [value, duration]);

  // Format the displayed number
  const formatted =
    decimals > 0
      ? displayed.toFixed(decimals)
      : Math.round(displayed).toLocaleString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
