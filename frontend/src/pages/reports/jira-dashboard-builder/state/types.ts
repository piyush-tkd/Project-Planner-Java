import { DashboardWidget, AnalyticsBreakdown } from '../../../../api/jira';
export type { DashboardWidget };

/* ── Extended Widget type with new fields ──────────────────────────── */
export interface ExtendedDashboardWidget extends DashboardWidget {
  color?: string;
  sortBy?: 'count' | 'sp' | 'hours' | 'name';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  targetDate?: string; // ISO date for countdown timer
  targetLabel?: string; // label for the countdown target
  secondaryDataKey?: string; // for 2D filter stats cross-tab / pivot col dimension
  // Power analytics fields
  jql?: string;         // JQL filter expression for the widget
  metric?: 'count' | 'storyPoints'; // aggregation metric
  groupBy?: string;     // custom groupBy field (overrides dataKey)
  periodType?: 'week' | 'month' | 'quarter' | 'year'; // for productivity comparison
  // Pivot Builder fields
  pivotRowDim?: string;    // row groupBy dimension
  pivotColDim?: string;    // column groupBy dimension (optional)
  pivotMetric?: 'count' | 'storyPoints' | 'hours' | 'cycleTimeDays'; // measure
  pivotView?: 'table' | 'bar' | 'heatmap'; // visualization mode
  pivotGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'; // for date dims
}

export interface DrillDownState {
  title: string;
  items: AnalyticsBreakdown[];
}

export type WidgetCatalogItem = {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultSize: DashboardWidget['size'];
  category: string;
};
