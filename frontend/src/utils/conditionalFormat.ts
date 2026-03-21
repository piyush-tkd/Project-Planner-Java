import { CSSProperties } from 'react';

/**
 * Returns a CSSProperties object for utilization percentage styling
 * - < 50%: green background
 * - 50-80%: no special styling (normal)
 * - 80-100%: amber/orange light background
 * - > 100%: red background
 */
export function getUtilizationStyle(pct: number): CSSProperties {
  if (pct < 50) {
    return {
      backgroundColor: '#e6ffec',
      color: '#2b5a2b',
    };
  }
  if (pct >= 50 && pct <= 80) {
    return {};
  }
  if (pct > 80 && pct < 100) {
    return {
      backgroundColor: '#fff3e0',
      color: '#e65100',
    };
  }
  // > 100%
  return {
    backgroundColor: '#ffe0e0',
    color: '#c41e3a',
  };
}

/**
 * Returns a CSSProperties object for budget variance styling
 * - > 10% over: red background
 * - 0-10% over: orange background
 * - under budget: green background
 */
export function getBudgetVarianceStyle(variance: number): CSSProperties {
  if (variance > 10) {
    return {
      backgroundColor: '#ffe0e0',
      color: '#c41e3a',
    };
  }
  if (variance > 0 && variance <= 10) {
    return {
      backgroundColor: '#fff3e0',
      color: '#e65100',
    };
  }
  // under budget (variance <= 0)
  return {
    backgroundColor: '#e6ffec',
    color: '#2b5a2b',
  };
}

/**
 * Returns a CSSProperties object for gap hours/FTE styling
 * - gap > 0 (surplus): green background
 * - gap = 0: neutral (no styling)
 * - gap < 0 (deficit): red background, intensity based on magnitude
 */
export function getDeficitStyle(gapHours: number): CSSProperties {
  if (gapHours > 0) {
    // Surplus: green tinting
    return {
      backgroundColor: 'rgba(102, 194, 102, 0.1)',
    };
  }
  if (gapHours === 0) {
    // Neutral: no styling
    return {};
  }
  // Deficit: red tinting, intensity increases with magnitude
  const magnitude = Math.abs(gapHours);
  let opacity = 0.08;
  if (magnitude > 100) opacity = 0.15;
  if (magnitude > 200) opacity = 0.22;
  return {
    backgroundColor: `rgba(255, 0, 0, ${opacity})`,
  };
}
