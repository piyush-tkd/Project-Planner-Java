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

/** PP chart colour palette — Slate design system (v29.0), optimised for both light and dark */
export const PP_CHART_COLORS = [
  '#2DCCD3',  // Aqua         — brand primary
  '#38BDF8',  // Sky-400      — Slate blue
  '#6366F1',  // Indigo-500   — Slate accent
  '#22C55E',  // Green-500    — positive / success
  '#F59E0B',  // Amber-500    — warning / budget
  '#EC4899',  // Pink-500     — sixth series
  '#8B5CF6',  // Violet-500   — seventh series
  '#F43F5E',  // Rose-500     — alerts / risk
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
