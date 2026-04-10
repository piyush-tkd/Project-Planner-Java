import React from 'react';
import styles from './PPMetricCard.module.css';
import { AQUA } from '../../brandTokens';

export interface PPMetricCardProps {
  /** Overline label */
  label: string;
  /** Primary metric value */
  value: string | number;
  /** Trend direction */
  trend?: 'up' | 'down' | 'flat';
  /** Trend label (e.g. "+12%") */
  trendValue?: string;
  /** Left accent border colour (default: --pp-accent) */
  color?: string;
  /** Optional icon displayed left of content */
  icon?: React.ReactNode;
  /** Muted footer text */
  footer?: string;
  /** Optional sparkline data (array of numbers, min 2 points) */
  sparkData?: number[];
  /** Size variant (default 'md') */
  size?: 'sm' | 'md' | 'lg';
  /** Makes the card clickable with hover lift */
  onClick?: () => void;
}

// ── Micro sparkline (pure SVG, no library) ───────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const W = 80;
  const H = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={W}
      height={H}
      className={styles.spark}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--pp-accent, #2DCCD3)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
}

// ── Trend icon ────────────────────────────────────────────────────────
function TrendIndicator({
  trend,
  value,
}: {
  trend: 'up' | 'down' | 'flat';
  value?: string;
}) {
  const trendClass =
    trend === 'up'
      ? styles.trendUp
      : trend === 'down'
      ? styles.trendDown
      : styles.trendFlat;

  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—';

  return (
    <span className={`${styles.trend} ${trendClass}`}>
      {arrow}
      {value && <span>{value}</span>}
    </span>
  );
}

/**
 * PPMetricCard — styled KPI card with accent bar, trend indicator, and optional sparkline (DL-4).
 *
 * ```tsx
 * <PPMetricCard
 *   label="Active Projects"
 *   value={24}
 *   trend="up"
 *   trendValue="+3"
 *   color={AQUA}
 *   sparkData={[10, 14, 12, 18, 16, 22, 24]}
 * />
 * ```
 */
export function PPMetricCard({
  label,
  value,
  trend,
  trendValue,
  color = 'var(--pp-accent, #2DCCD3)',
  icon,
  footer,
  sparkData,
  size = 'md',
  onClick,
}: PPMetricCardProps) {
  const sizeClass =
    size === 'sm' ? styles.cardSm : size === 'lg' ? styles.cardLg : styles.cardMd;
  const valueSizeClass =
    size === 'sm' ? styles.valueSm : size === 'lg' ? styles.valueLg : styles.valueMd;

  return (
    <div
      className={[
        styles.card,
        sizeClass,
        onClick ? styles.cardClickable : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick()
          : undefined
      }
    >
      {/* Left accent bar */}
      <div className={styles.accentBar} style={{ background: color }} />

      {/* Icon */}
      {icon && <div className={styles.icon}>{icon}</div>}

      {/* Content */}
      <div className={styles.content}>
        <p className={styles.label}>{label}</p>
        <p className={`${styles.value} ${valueSizeClass}`}>{value}</p>
        {footer && <p className={styles.footer}>{footer}</p>}
      </div>

      {/* Right: trend + sparkline */}
      {(trend || sparkData) && (
        <div className={styles.right}>
          {trend && (
            <TrendIndicator trend={trend} value={trendValue} />
          )}
          {sparkData && sparkData.length >= 2 && (
            <Sparkline data={sparkData} />
          )}
        </div>
      )}
    </div>
  );
}

export default PPMetricCard;
