/**
 * PPSkeleton — shimmer skeleton loading variants (DL-11)
 *
 * Usage:
 *   <PPSkeleton variant="table" rows={8} />
 *   <PPSkeleton variant="dashboard" />
 *   <PPSkeleton variant="cards" columns={3} rows={6} />
 */
import React from 'react';
import styles from './PPSkeleton.module.css';

export interface PPSkeletonProps {
  /** Layout variant */
  variant: 'dashboard' | 'table' | 'kanban' | 'detail' | 'chart' | 'cards';
  /** Number of rows/items (tables, cards, detail content blocks) */
  rows?: number;
  /** Number of columns (kanban columns, cards grid columns) */
  columns?: number;
}

// Varying widths create a more realistic skeleton
const ROW_WIDTHS = ['100%', '92%', '96%', '88%', '100%', '94%', '90%', '97%'];

/** ── Dashboard: 4 metric cards + 2 charts ── */
function DashboardSkeleton() {
  return (
    <div>
      <div className={styles.dashboardGrid}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${styles.block} ${styles.metricCardSkeleton}`} />
        ))}
      </div>
      <div className={styles.chartRowSkeleton}>
        <div className={`${styles.block} ${styles.chartBlockSkeleton}`} />
        <div className={`${styles.block} ${styles.chartBlockSkeleton}`} />
      </div>
    </div>
  );
}

/** ── Table: header + N rows ── */
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.tableContainer}>
      <div className={`${styles.block} ${styles.tableHeader}`} />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${styles.block} ${styles.tableRow}`}
          style={{ width: ROW_WIDTHS[i % ROW_WIDTHS.length] }}
        />
      ))}
    </div>
  );
}

/** ── Kanban: N columns with M cards each ── */
function KanbanSkeleton({
  columns = 4,
  rows = 3,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className={styles.kanbanBoard}>
      {Array.from({ length: columns }).map((_, ci) => (
        <div key={ci} className={styles.kanbanColumn}>
          <div className={`${styles.block} ${styles.kanbanHeader}`} />
          {Array.from({ length: rows }).map((_, ri) => (
            <div key={ri} className={`${styles.block} ${styles.kanbanCard}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** ── Detail: title + subtitle + content blocks ── */
function DetailSkeleton({ rows = 4 }: { rows?: number }) {
  const contentWidths = ['100%', '85%', '92%', '78%', '95%', '88%'];
  return (
    <div className={styles.detailContainer}>
      <div className={`${styles.block} ${styles.detailTitle}`} />
      <div className={`${styles.block} ${styles.detailSubtitle}`} />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${styles.block} ${styles.detailRow}`}
          style={{ width: contentWidths[i % contentWidths.length] }}
        />
      ))}
    </div>
  );
}

/** ── Chart: title bar + large chart body ── */
function ChartSkeleton() {
  return (
    <div className={styles.chartContainer}>
      <div className={`${styles.block} ${styles.chartTitle}`} />
      <div className={`${styles.block} ${styles.chartBody}`} />
    </div>
  );
}

/** ── Cards: responsive grid of card skeletons ── */
function CardsSkeleton({
  rows = 6,
  columns = 3,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className={styles.cardsGrid}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${styles.block} ${styles.cardSkeleton}`} />
      ))}
    </div>
  );
}

/**
 * PPSkeleton — shimmer placeholder for loading states.
 *
 * Six layout variants: dashboard | table | kanban | detail | chart | cards.
 * All variants use a staggered wave shimmer animation.
 */
export function PPSkeleton({ variant, rows, columns }: PPSkeletonProps) {
  switch (variant) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'table':
      return <TableSkeleton rows={rows} />;
    case 'kanban':
      return <KanbanSkeleton columns={columns} rows={rows} />;
    case 'detail':
      return <DetailSkeleton rows={rows} />;
    case 'chart':
      return <ChartSkeleton />;
    case 'cards':
      return <CardsSkeleton rows={rows} columns={columns} />;
    default:
      return <TableSkeleton rows={rows} />;
  }
}

export default PPSkeleton;
