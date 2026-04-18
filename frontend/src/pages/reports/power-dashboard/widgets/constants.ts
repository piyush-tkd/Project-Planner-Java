import {
  IconBolt, IconChartBar, IconChartLine, IconChartPie, IconTable, IconChartDots,
  IconLayoutGrid, IconChartArea, IconTrendingUp, IconUsers, IconClock, IconList,
} from '@tabler/icons-react';
import { WidgetConfig } from '../state/types';

// ── Widget hover insights ─────────────────────────────────────────────────────

const WIDGET_HELP: Record<string, string> = {
  kpi_card:        'Single metric card. Click Edit to change metric or add thresholds.',
  gauge:           'Speedometer showing progress toward a goal. Set Warning/Critical thresholds to trigger alerts.',
  sparkline_kpi:   'KPI card with mini trend line showing recent trajectory.',
  countdown:       'Days remaining to a target date. Set target_date in special_params.',
  ratio_kpi:       'Ratio of two issue types (e.g. Bug:Story). Shows % and counts.',
  bar:             'Compare values across categories. Click a bar to drill-through and filter all other widgets.',
  horizontal_bar:  'Top-N items ranked horizontally. Great for leaderboards and comparisons.',
  stacked_bar:     'Stacked breakdown by two dimensions. Requires Group by + Second dimension.',
  waterfall:       'Sprint-over-sprint delta. Green = up, Red = down, Yellow line = running total.',
  line:            'Trend over time. Use resolution_week or month as Group by for time series.',
  area:            'Filled trend over time. Good for showing volume changes.',
  pie:             'Distribution breakdown. Click a slice to drill-through.',
  radar:           'Spider chart comparing categories across a single metric.',
  treemap:         'Area-proportional view of volumes. Larger = more issues.',
  funnel:          'Issue flow through workflow stages showing drop-off.',
  scatter:         'Correlation between two metrics per dimension. Requires x_metric + metric.',
  heatmap:         'Grid showing intensity at dimension intersections. Requires Group by + Second dimension.',
  heatmap_h:       'Same as heatmap but with rows and columns transposed.',
  table:           'Aggregated data table. Add Column Labels to rename LABEL/VALUE headers.',
  issue_table_raw: 'Full raw issue rows with search and CSV export.',
  leaderboard:     'Ranked bar list. Shows top contributors, projects, or labels by any metric.',
  velocity:        'Sprint-by-sprint SP completed. Sorted by label (sprint name).',
  sprint_comparison: 'Side-by-side sprints grouped by a second dimension.',
  epic_progress:   'Progress bars per epic showing completion %. Requires completion_rate_pct metric.',
  cfd:             'Cumulative Flow Diagram. Use week + status_name grouping for classic CFD.',
  control_chart:   'Cycle time scatter with mean and ±2σ control limits. Dots above UCL = outliers.',
  box_plot:        'Q1/Median/Q3/P90 whisker plot. Uses dedicated box-plot endpoint.',
  gantt:           'Epic timeline bars showing start → end dates. Uses dedicated gantt endpoint.',
  release_readiness: 'Sprint completion % progress bars. Uses dedicated release-readiness endpoint.',
  monthly_summary: 'Month-by-month table: created, resolved, open, net change, avg age.',
  period_vs_period: 'Compare current vs previous period on 5 KPIs with % change.',
  created_vs_resolved: 'Dual area chart: issues created vs resolved per week.',
  open_trend:      'Running total of open issues with created/resolved bars.',
  sprint_burndown: 'SP remaining vs ideal burndown line. Uses most recent active sprint.',
  label_cloud:     'Tag cloud sized by frequency. Use labels or issue_type as Group by.',
  worklog_heatmap: 'Hours per person per week heatmap. Use worklogs source.',
  worklog_trend:   'Multi-line hours over time per person/project. Use worklogs source.',
  worklog_timeline:'Timesheet view with totals and % share per person.',
};

// ── Widget category metadata for colors and grouping ─────────────────────────
const WIDGET_CATEGORY_COLOR: Record<string, string> = {
  kpi_card: 'violet', gauge: 'violet', sparkline_kpi: 'violet', countdown: 'violet', ratio_kpi: 'violet',
  bar: 'blue', stacked_bar: 'blue', horizontal_bar: 'blue', waterfall: 'blue',
  line: 'cyan', area: 'cyan', created_vs_resolved: 'cyan', open_trend: 'cyan',
  pie: 'grape', radar: 'grape', treemap: 'grape', funnel: 'grape',
  table: 'indigo', issue_table_raw: 'indigo', monthly_summary: 'indigo', period_vs_period: 'indigo', leaderboard: 'indigo',
  heatmap: 'teal', heatmap_h: 'teal', worklog_heatmap: 'teal',
  scatter: 'orange', control_chart: 'orange', box_plot: 'orange', cfd: 'orange', sprint_burndown: 'orange',
  velocity: 'green', sprint_comparison: 'green', epic_progress: 'green', release_readiness: 'green',
  gantt: 'yellow', label_cloud: 'yellow',
  worklog_trend: 'pink', worklog_timeline: 'pink', worklog_heatmap_h: 'pink',
};

const getWidgetColor = (type: string) => WIDGET_CATEGORY_COLOR[type] ?? 'gray';

const WIDGET_TYPES = [
  // Phase 1
  { value: 'kpi_card',         label: 'KPI Card',             icon: IconBolt },
  { value: 'bar',              label: 'Bar Chart',            icon: IconChartBar },
  { value: 'stacked_bar',      label: 'Stacked Bar',          icon: IconChartBar },
  { value: 'line',             label: 'Line Chart',           icon: IconChartLine },
  { value: 'area',             label: 'Area Chart',           icon: IconChartArea },
  { value: 'pie',              label: 'Pie / Donut',          icon: IconChartPie },
  { value: 'table',            label: 'Data Table',           icon: IconTable },
  { value: 'heatmap',          label: 'Heatmap (vertical)',   icon: IconLayoutGrid },
  { value: 'heatmap_h',        label: 'Heatmap (horizontal)', icon: IconLayoutGrid },
  { value: 'leaderboard',      label: 'Leaderboard',          icon: IconUsers },
  { value: 'velocity',         label: 'Velocity Chart',       icon: IconTrendingUp },
  // Layout & Text
  { value: 'section_header', label: 'Section Header',      icon: IconBolt },
  { value: 'text_block',     label: 'Text / Markdown',     icon: IconList },
  // Enhanced
  { value: 'benchmark',      label: 'Benchmark Compare',   icon: IconChartBar },
  // Completing Dashboard Builder parity
  { value: 'ratio_kpi',          label: 'Ratio KPI',              icon: IconBolt },
  { value: 'created_vs_resolved',label: 'Created vs Resolved',    icon: IconChartLine },
  { value: 'open_trend',         label: 'Open Issues Trend',      icon: IconChartArea },
  { value: 'sprint_burndown',    label: 'Sprint Burndown',         icon: IconTrendingUp },
  // Phase 1.5 — previously missing
  { value: 'horizontal_bar',   label: 'Horizontal Bar',       icon: IconChartBar },
  { value: 'gauge',            label: 'Gauge Chart',          icon: IconChartPie },
  { value: 'radar',            label: 'Radar Chart',          icon: IconChartDots },
  { value: 'sparkline_kpi',    label: 'Sparkline KPI',        icon: IconBolt },
  { value: 'countdown',        label: 'Countdown Timer',      icon: IconClock },
  { value: 'epic_progress',    label: 'Epic Progress Bars',   icon: IconTrendingUp },
  { value: 'monthly_summary',  label: 'Monthly Summary',      icon: IconTable },
  { value: 'period_vs_period', label: 'Period vs Period',     icon: IconChartBar },
  { value: 'issue_table_raw',  label: 'Issue Table + CSV',    icon: IconList },
  { value: 'worklog_timeline', label: 'Worklog Timeline',     icon: IconUsers },
  // Phase 2
  { value: 'treemap',          label: 'Treemap',              icon: IconLayoutGrid },
  { value: 'funnel',           label: 'Funnel',               icon: IconChartBar },
  { value: 'scatter',          label: 'Scatter Plot',         icon: IconChartDots },
  { value: 'waterfall',        label: 'Waterfall',            icon: IconChartBar },
  { value: 'sprint_comparison',label: 'Sprint Comparison',    icon: IconChartBar },
  { value: 'label_cloud',      label: 'Label Cloud',          icon: IconLayoutGrid },
  { value: 'cfd',              label: 'Cumulative Flow (CFD)',icon: IconChartArea },
  { value: 'control_chart',    label: 'Control Chart',        icon: IconChartDots },
  { value: 'box_plot',         label: 'Box Plot',             icon: IconChartBar },
  { value: 'gantt',            label: 'Gantt Timeline',       icon: IconChartLine },
  { value: 'release_readiness',label: 'Release Readiness',    icon: IconTrendingUp },
  { value: 'worklog_heatmap',  label: 'Worklog Heatmap',      icon: IconLayoutGrid },
  { value: 'worklog_trend',    label: 'Worklog Trend',        icon: IconChartLine },
];

const DATE_PRESETS = [
  { value: 'last_7d',  label: 'Last 7 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'last_6m',  label: 'Last 6 months' },
  { value: 'last_12m', label: 'Last 12 months' },
  { value: 'last_2y',  label: 'Last 2 years' },
];

const FILTER_OPS = [
  { value: 'eq',          label: 'equals' },
  { value: 'neq',         label: 'not equals' },
  { value: 'in',          label: 'in list' },
  { value: 'not_in',      label: 'not in list' },
  { value: 'like',        label: 'contains' },
  { value: 'is_null',     label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
];

const SORT_OPTIONS = [
  { value: 'metric_desc', label: 'Value ↓ (highest first)' },
  { value: 'metric_asc',  label: 'Value ↑ (lowest first)' },
  { value: 'label_asc',   label: 'Label A → Z' },
  { value: 'label_desc',  label: 'Label Z → A' },
];

const SOURCES = [
  { value: 'issues',      label: 'Issues' },
  { value: 'worklogs',    label: 'Worklogs' },
  { value: 'sprints',     label: 'Sprints' },
  { value: 'transitions', label: 'Transitions' },
];

// Dark-mode chart colors (bright/pastel, readable on dark bg)
const CHART_COLORS_DARK = [
  '#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8',
  '#F7DC6F','#BB8FCE','#85C1E9','#F1948A','#82E0AA','#F8C471',
];
// Light-mode chart colors (saturated/dark, readable on white bg)
const CHART_COLORS_LIGHT = [
  '#1971c2','#2f9e44','#e03131','#e67700','#6741d9',
  '#0b7285','#a61e4d','#364fc7','#087f5b','#d6336c',
  '#5c940d','#862e9c',
];
// Default (used in a few legacy spots — prefer chartColor() helper below)
const CHART_COLORS = CHART_COLORS_DARK;

/** Returns the correct chart color for light or dark mode at a given series index */
const chartColor = (dark: boolean, i: number) =>
  (dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT)[i % (dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT).length];

const DEFAULT_CONFIG: WidgetConfig = {
  source: 'issues', metric: 'count', groupBy: 'status_name',
  filters: [], dateRange: { preset: 'last_90d' }, limit: 20, sortBy: 'metric_desc',
};

const SIZE_PRESETS = [
  { label: '¼',   w: 3,  h: 3, title: 'Small (3×3)' },
  { label: '⅓',   w: 4,  h: 4, title: 'Narrow (4×4)' },
  { label: '½',   w: 6,  h: 4, title: 'Half width (6×4)' },
  { label: '⅔',   w: 8,  h: 4, title: 'Wide (8×4)' },
  { label: 'Full',w: 12, h: 5, title: 'Full width (12×5)' },
  { label: 'Tall',w: 6,  h: 7, title: 'Tall half (6×7)' },
];

const METRIC_OPTIONS = Object.entries({
  count: 'Count of Issues', count_done: 'Count Done', count_open: 'Count Open',
  sum_sp: 'Sum Story Points', avg_sp: 'Avg Story Points', velocity_sp: 'Velocity SP',
  avg_lead_time_days: 'Avg Lead Time', avg_cycle_time_days: 'Avg Cycle Time',
  sum_hours_logged: 'Sum Hours Logged', completion_rate_pct: 'Completion Rate %',
}).map(([k, v]) => ({ value: k, label: v }));

export {
  WIDGET_HELP,
  WIDGET_CATEGORY_COLOR,
  getWidgetColor,
  WIDGET_TYPES,
  DATE_PRESETS,
  FILTER_OPS,
  SORT_OPTIONS,
  SOURCES,
  CHART_COLORS_DARK,
  CHART_COLORS_LIGHT,
  CHART_COLORS,
  chartColor,
  DEFAULT_CONFIG,
  SIZE_PRESETS,
  METRIC_OPTIONS,
};
