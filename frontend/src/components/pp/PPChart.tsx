/**
 * PPChart — chart wrapper with entrance animation & consistent styling (DL-12)
 *
 * Usage:
 *   <PPChart title="Budget Burn" subtitle="Actuals vs. forecast" height={300}>
 *     <AreaChart data={data} .../>
 *   </PPChart>
 */
import React from 'react';
import { PPSkeleton } from './PPSkeleton';
import styles from './PPChart.module.css';
import { AQUA, SIDEBAR_INACTIVE } from '../../brandTokens';

/** PP chart colour palette — optimised for dark backgrounds */
export const PP_CHART_COLORS = [
  AQUA, // accent teal
  '#7C4DFF', // violet
  '#FF8F00', // amber
  '#2E7D32', // green
  '#1565C0', // blue
  '#D32F2F', // red
  '#FF6D00', // orange
  SIDEBAR_INACTIVE, // gray
] as const;

export interface PPChartProps {
  /** Chart title shown in the card header */
  title?: string;
  /** Muted subtitle / description */
  subtitle?: string;
  /** Recharts (or any) chart component */
  children: React.ReactNode;
  /** Fixed height of the chart canvas area (default 300) */
  height?: number;
  /** Show skeleton instead of chart while loading */
  loading?: boolean;
  /** Optional toolbar rendered right-aligned in the header */
  toolbar?: React.ReactNode;
  /**
   * Animation delay in ms — stagger multiple charts on the same page.
   * E.g. first chart: 0, second: 150, third: 300.
   */
  animationDelay?: number;
}

/**
 * Wraps any Recharts chart in a PP-styled card with a slide-up entrance
 * animation and optional skeleton loading state.
 */
export function PPChart({
  title,
  subtitle,
  children,
  height = 300,
  loading = false,
  toolbar,
  animationDelay = 0,
}: PPChartProps) {
  const hasHeader = title || subtitle || toolbar;

  return (
    <div className={styles.wrapper}>
      {hasHeader && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        </div>
      )}

      <div className={styles.body}>
        {loading ? (
          <PPSkeleton variant="chart" />
        ) : (
          <div
            className={styles.chartContainer}
            style={
              { '--chart-delay': `${animationDelay}ms` } as React.CSSProperties
            }
          >
            <div style={{ width: '100%', height }}>{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PPChart;
