import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  Title, Text, Stack, Group, Button, Card, ActionIcon, Badge, Select, TextInput,
  Modal, Loader, Tooltip, ScrollArea, Divider,
  NumberInput, Box, SimpleGrid, Textarea, Collapse,
  Container, HoverCard, Paper, ThemeIcon, Drawer, Switch, Tabs, SegmentedControl,
  RingProgress, Progress,
} from '@mantine/core';
import {
  IconPlus, IconEdit, IconTrash, IconRefresh, IconChartBar, IconChartLine,
  IconChartPie, IconTable, IconChartDots, IconLayoutGrid, IconDeviceFloppy,
  IconCopy, IconArrowLeft, IconChevronDown, IconChevronUp,
  IconChartArea, IconTrendingUp, IconUsers, IconBolt, IconClock, IconList, IconDownload,
  IconSettings,
} from '@tabler/icons-react';
// react-grid-layout — CJS module, use namespace import for Vite interop
import * as RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactGridLayout: any = (RGL as any).default ?? RGL;
type Layout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; };
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  ReferenceLine, Treemap, FunnelChart, Funnel, LabelList, RadialBarChart, RadialBar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import apiClient from '../../api/client';
import { useDarkMode } from '../../hooks/useDarkMode';
// Use CSS-var versions for Mantine text/border, HEX versions for SVG/canvas/recharts
import { AQUA, DEEP_BLUE, AQUA_HEX, DEEP_BLUE_HEX } from '../../brandTokens';
// Chart-safe colors (never CSS variables — SVG can't use them)
const CHART_PRIMARY = (dark: boolean) => dark ? AQUA_HEX : DEEP_BLUE_HEX;
const CHART_ACCENT  = (_dark: boolean) => AQUA_HEX;

// ── Types ─────────────────────────────────────────────────────────────────────

interface WidgetFilter {
  field: string;
  op: string;
  value?: string | string[];
}

interface WidgetConfig {
  source: string;
  metric: string;
  groupBy?: string;
  groupBy2?: string;
  filters: WidgetFilter[];
  dateRange: { preset?: string; from?: string; to?: string };
  limit: number;
  // Custom display names for columns (label, label2, value)
  label_name?: string;
  label2_name?: string;
  value_name?: string;
  // For Phase 2 widgets that use dedicated endpoints instead of generic /query
  special_endpoint?: string;
  special_params?: Record<string, string>;
  // Auto-refresh interval (0 = off)
  refresh_interval_minutes?: number;
  // Text block content (for text_block / section_header widget types)
  text_content?: string;
  text_align?: 'left' | 'center' | 'right';
  text_size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  // Custom metric formula
  custom_metric_id?: string;
  // Alerting thresholds (for KPI cards)
  threshold_warning?: number;
  threshold_critical?: number;
  threshold_direction?: 'above' | 'below'; // 'above' = alert when value > threshold
  sortBy: string;
}

interface Widget {
  id: number;
  dashboard_id: number;
  title: string;
  widget_type: string;
  config: WidgetConfig | string;
  position: { x: number; y: number; w: number; h: number } | string;
  sort_order: number;
}

interface GlobalFilters {
  date_preset?: string;
  project_key?: string;
  assignee?: string;
  sprint_name?: string;
}

interface CustomMetric {
  id: string;
  name: string;
  formula_type: 'ratio' | 'pct' | 'delta' | 'subtract';
  metric_a: string;   // numerator / primary
  metric_b: string;   // denominator / comparison
  multiplier?: number;
  unit?: string;
}

interface Dashboard {
  id: number;
  name: string;
  description?: string;
  created_by?: string;
  is_public: boolean;
  tags?: string;
  widget_count?: number;
  widgets?: Widget[];
  global_filters?: GlobalFilters | string;
  custom_metrics?: CustomMetric[] | string;
}

interface FieldMeta { key: string; label: string; type: string; }
interface MetricMeta { key: string; label: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

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

function generateInsights(rows: Record<string, unknown>[], config: WidgetConfig, widgetType: string): string[] {
  const insights: string[] = [];
  if (!rows.length) return ['No data loaded yet'];
  const vals = rows.map(r => Number(r.value ?? r.y ?? 0)).filter(v => !isNaN(v) && v > 0);
  if (!vals.length) return ['All values are zero'];
  const total = vals.reduce((a, b) => a + b, 0);
  const avg   = total / vals.length;
  const max   = Math.max(...vals);
  const min   = Math.min(...vals);
  const topRow = rows.reduce((a, b) => Number(b.value ?? 0) > Number(a.value ?? 0) ? b : a, rows[0]);
  const botRow = rows.reduce((a, b) => Number(b.value ?? 0) < Number(a.value ?? 0) ? b : a, rows[0]);

  if (rows.length === 1) {
    insights.push(`Current value: ${fmtValue(vals[0])}`);
  } else {
    insights.push(`${rows.length} data points`);
    if (topRow.label) insights.push(`Highest: ${topRow.label} (${fmtValue(max)})`);
    if (botRow.label && botRow.label !== topRow.label) insights.push(`Lowest: ${botRow.label} (${fmtValue(min)})`);
    insights.push(`Average: ${fmtValue(Math.round(avg * 10) / 10)}`);
    const spread = ((max - min) / (avg || 1) * 100).toFixed(0);
    if (Number(spread) > 200) insights.push(`⚡ High variance (${spread}%) — some outliers exist`);
  }
  const metric = config.metric ?? '';
  if (metric.includes('pct') || metric.includes('rate')) insights.push(`Values are percentages (0–100)`);
  if (metric.includes('hours')) insights.push(`Values in hours`);
  if (metric.includes('days')) insights.push(`Values in days`);
  if (metric.includes('sp') || metric.includes('velocity')) insights.push(`Values in story points`);
  return insights.slice(0, 4);
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseConfig(raw: WidgetConfig | string | unknown): WidgetConfig {
  let parsed: Partial<WidgetConfig> = {};
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  } else if (raw && typeof raw === 'object') {
    // JSONB from API may arrive as object with nested value (PGobject serialization)
    const obj = raw as Record<string, unknown>;
    if (typeof obj.value === 'string') {
      try { parsed = JSON.parse(obj.value); } catch { parsed = {}; }
    } else {
      parsed = obj as Partial<WidgetConfig>;
    }
  }
  // Always ensure all required fields have valid defaults
  return {
    source:      (parsed.source      as string) || DEFAULT_CONFIG.source,
    metric:      (parsed.metric      as string) || DEFAULT_CONFIG.metric,
    groupBy:     parsed.groupBy      as string | undefined,
    groupBy2:    parsed.groupBy2     as string | undefined,
    filters:     Array.isArray(parsed.filters) ? parsed.filters : [],
    dateRange:   (parsed.dateRange   as object) || DEFAULT_CONFIG.dateRange,
    limit:       typeof parsed.limit === 'number' ? parsed.limit : DEFAULT_CONFIG.limit,
    sortBy:      (parsed.sortBy      as string) || DEFAULT_CONFIG.sortBy,
    label_name:       (parsed.label_name       as string) || undefined,
    label2_name:      (parsed.label2_name      as string) || undefined,
    value_name:       (parsed.value_name       as string) || undefined,
    special_endpoint:     (parsed.special_endpoint     as string)  || undefined,
    special_params:       (parsed.special_params       as Record<string, string>) || undefined,
    threshold_warning:    typeof parsed.threshold_warning  === 'number' ? parsed.threshold_warning  : undefined,
    threshold_critical:   typeof parsed.threshold_critical === 'number' ? parsed.threshold_critical : undefined,
    threshold_direction:  (parsed.threshold_direction as 'above' | 'below') || undefined,
  };
}

function parsePosition(raw: { x: number; y: number; w: number; h: number } | string) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return { x: 0, y: 0, w: 6, h: 4 }; }
  }
  return raw ?? { x: 0, y: 0, w: 6, h: 4 };
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v % 1 === 0 ? v.toLocaleString() : v.toFixed(1);
  return String(v);
}

// ── API hooks ─────────────────────────────────────────────────────────────────

function useDashboards() {
  return useQuery<Dashboard[]>({
    queryKey: ['power-dashboards'],
    queryFn: () => apiClient.get('/power-dashboard/dashboards').then(r => r.data),
  });
}

function useDashboard(id: number | null) {
  return useQuery<Dashboard>({
    queryKey: ['power-dashboard', id],
    queryFn: () => apiClient.get(`/power-dashboard/dashboards/${id}`).then(r => r.data),
    enabled: id !== null,
  });
}

interface Alert { widget_id: number; title: string; value: number; threshold_warning?: number; threshold_critical?: number; direction: string; status: 'warning' | 'critical'; }

interface Template { id: number; name: string; description: string; category: string; icon: string; widget_count: number; }

function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['power-dashboard-templates'],
    queryFn: () => apiClient.get('/power-dashboard/templates').then(r => r.data),
    staleTime: Infinity,
  });
}

function useAlerts(dashboardId: number | null) {
  return useQuery<Alert[]>({
    queryKey: ['power-dashboard-alerts', dashboardId],
    queryFn: () => apiClient.get(`/power-dashboard/dashboards/${dashboardId}/alerts`).then(r => r.data),
    enabled: dashboardId !== null,
    refetchInterval: 5 * 60 * 1000, // recheck every 5 min
  });
}

// Drill-through context — shared across all widgets on a dashboard
interface DrillFilter {
  field: string;
  value: string;
  label: string;
  // Widget's own filters — applied alongside the drill dimension
  widgetFilters?: WidgetFilter[];
  widgetDateRange?: { preset?: string; from?: string; to?: string };
}
interface DrillCtx {
  drill: DrillFilter | null;
  setDrill: (d: DrillFilter | null) => void;
  openDrawer: () => void;   // directly opens the drawer — no useEffect timing issues
}
const DrillContext = React.createContext<DrillCtx>({ drill: null, setDrill: () => {}, openDrawer: () => {} });

function useFields() {
  return useQuery<Record<string, { dimensions: FieldMeta[]; metrics: MetricMeta[] }>>({
    queryKey: ['power-dashboard-fields'],
    queryFn: () => apiClient.get('/power-dashboard/fields').then(r => r.data),
    staleTime: Infinity,
  });
}

function useCustomFields() {
  return useQuery<{ field_id: string; field_name: string; issue_count: number }[]>({
    queryKey: ['power-dashboard-custom-fields'],
    queryFn: () => apiClient.get('/power-dashboard/fields/custom').then(r => r.data),
    staleTime: Infinity,
  });
}

function useFieldValues(field: string | null, source: string) {
  return useQuery<string[]>({
    queryKey: ['power-field-values', field, source],
    queryFn: () => apiClient.get(`/power-dashboard/fields/values?field=${field}&source=${source}`).then(r => r.data),
    enabled: field !== null,
    staleTime: 5 * 60 * 1000,
  });
}

function useWidgetData(config: WidgetConfig | null, enabled: boolean) {
  const intervalMs = config?.refresh_interval_minutes
    ? config.refresh_interval_minutes * 60 * 1000
    : false;
  return useQuery<{ data: Record<string, unknown>[]; columns: string[]; count: number }>({
    queryKey: ['power-widget-data', JSON.stringify(config)],
    refetchInterval: intervalMs || false,
    queryFn: async () => {
      if (!config) return { data: [], columns: [], count: 0 };
      // Special endpoint (box_plot, gantt, release_readiness, etc.)
      if (config.special_endpoint) {
        const params = new URLSearchParams(config.special_params ?? {});
        const url = `/power-dashboard/${config.special_endpoint}${params.toString() ? '?' + params : ''}`;
        const r = await apiClient.get(url);
        const raw = r.data;
        // Normalise response: array, or nested array, or single object wrapped in []
        const data = Array.isArray(raw) ? raw
          : Array.isArray(raw?.metrics)  ? raw.metrics
          : Array.isArray(raw?.burndown) ? raw.burndown
          : (raw?.series ?? raw?.data ?? (raw && typeof raw === 'object' ? [raw] : []));
        return { data, columns: data.length ? Object.keys(data[0]) : [], count: data.length };
      }
      // Text blocks and countdown — no query needed
      if (['countdown','text_block','section_header'].includes(config.source ?? '')) {
        return { data: [], columns: [], count: 0 };
      }
      // Generic query
      return apiClient.post('/power-dashboard/query', config).then(r => r.data);
    },
    enabled: enabled && config !== null,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Widget Renderers ──────────────────────────────────────────────────────────

// ── Sync from Jira button ─────────────────────────────────────────────────────

function SyncJiraButton() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiClient.post('/power-dashboard/sync-jira');
      setLastSync(new Date().toLocaleTimeString());
      notifications.show({
        title: 'Jira sync triggered',
        message: 'Data is syncing in background — refresh widgets in ~1 min',
        color: 'teal',
      });
    } catch {
      notifications.show({ title: 'Sync failed', message: 'Check Jira credentials in Settings', color: 'red' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Tooltip label={lastSync ? `Last synced ${lastSync}` : 'Pull latest data from Jira into the DB'}>
      <Button size="sm" variant="light" color="teal"
        leftSection={syncing ? <Loader size={14} /> : <IconRefresh size={15} />}
        loading={syncing} onClick={handleSync}>
        Sync from Jira
      </Button>
    </Tooltip>
  );
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

function KpiCard({ data, title, metric, dark, onDrill }: {
  data: Record<string, unknown>[];
  title: string; metric: string; dark: boolean;
  onDrill?: () => void;
}) {
  const raw   = Number(data[0]?.value ?? 0);
  const value = useCountUp(Number.isFinite(raw) ? Math.round(raw) : 0);
  const displayValue = Number.isInteger(raw) ? value.toLocaleString() : fmtValue(data[0]?.value ?? 0);
  const prev  = data[1]?.value;
  const change = (prev && Number(prev) > 0)
    ? ((raw - Number(prev)) / Number(prev) * 100).toFixed(1)
    : null;
  const m = metric ?? '';
  const kpiColor = CHART_PRIMARY(dark);

  return (
    <Stack gap={4} align="center" justify="center" h="100%" py="sm"
      style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={onDrill}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" ta="center" style={{ letterSpacing: '0.06em' }}>{title}</Text>
      <Tooltip label={onDrill ? 'Click to see issues' : ''} disabled={!onDrill} withArrow>
        <Text style={{ fontSize: '2.6rem', fontWeight: 900, color: kpiColor, lineHeight: 1,
          letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          textDecoration: onDrill ? 'underline dotted' : undefined, textUnderlineOffset: 4 }}>
          {displayValue}
        </Text>
      </Tooltip>
      {m.includes('pct')  && <Badge size="xs" variant="light" color="gray">%</Badge>}
      {m.includes('days') && <Badge size="xs" variant="light" color="gray">days</Badge>}
      {m.includes('hours')&& <Badge size="xs" variant="light" color="gray">hrs</Badge>}
      {m.includes('sp') || m.includes('velocity') ? <Badge size="xs" variant="light" color="teal">SP</Badge> : null}
      {change !== null && (
        <Badge color={Number(change) >= 0 ? 'green' : 'red'} size="sm">
          {Number(change) >= 0 ? '↑' : '↓'} {Math.abs(Number(change))}%
        </Badge>
      )}
    </Stack>
  );
}

function BarChartWidget({ data, stacked, dark, config, onDrill }: {
  data: Record<string, unknown>[]; stacked?: boolean; dark: boolean; config?: WidgetConfig;
  onDrill?: (field: string, value: string) => void;
}) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];

  if (hasLabel2 && stacked) {
    // Group by label, pivot label2 values
    const labels2 = [...new Set(data.map(d => String(d.label2 ?? '')))];
    const grouped: Record<string, Record<string, number>> = {};
    data.forEach(d => {
      const k = String(d.label ?? '');
      if (!grouped[k]) grouped[k] = {};
      grouped[k][String(d.label2 ?? '')] = Number(d.value ?? 0);
    });
    const chartData = Object.entries(grouped).map(([label, vals]) => ({ label, ...vals }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 14)} />
          <YAxis tick={{ fontSize: 11 }} />
          <ReTooltip />
          <Legend />
          {labels2.map((l, i) => (
            <Bar key={l} dataKey={l} stackId="a" fill={chartColor(dark, i)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 14)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Bar dataKey="value" name={config?.value_name || 'Value'} radius={[3, 3, 0, 0]}
          animationBegin={0} animationDuration={600}
          cursor={onDrill ? 'pointer' : undefined}
          onClick={onDrill ? (d: Record<string, unknown>) => {
            // recharts Bar onClick: d is the data entry {label, value, ...recharts internals}
            const val = d?.label ?? d?.name ?? d?.xValue ?? '';
            if (val && config?.groupBy) onDrill(config.groupBy, String(val));
          } : undefined}>
          {data.map((_, i) => <Cell key={i} fill={chartColor(dark, i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartWidget({ data, area, dark, config, onDrill }: {
  data: Record<string, unknown>[]; area?: boolean; dark: boolean; config?: WidgetConfig;
  onDrill?: (f: string, v: string) => void;
}) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const color = CHART_PRIMARY(dark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      {area ? (
        <AreaChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
          <YAxis tick={{ fontSize: 11 }} />
          <ReTooltip />
          <Area type="monotone" dataKey="value" stroke={color} fill={color + '40'} strokeWidth={2} />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
          <YAxis tick={{ fontSize: 11 }} />
          <ReTooltip />
          <Line type="monotone" dataKey="value" name={config?.value_name || 'Value'} stroke={color} strokeWidth={2}
            dot={{ r: 3, cursor: onDrill ? 'pointer' : undefined }}
            activeDot={onDrill
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? (props: any) => <circle {...props} r={5} style={{ cursor:'pointer' }} onClick={() => { const v = props?.payload?.label; if (v && config?.groupBy) onDrill(config.groupBy, String(v)); }} />
              : { r: 5 }} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function PieChartWidget({ data, dark, config, onDrill }: {
  data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig;
  onDrill?: (field: string, value: string) => void;
}) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%"
             innerRadius="35%" outerRadius="70%" paddingAngle={2}
             cursor={onDrill ? 'pointer' : undefined}
             onClick={onDrill ? (d: Record<string, unknown>) => {
               const val = d?.name ?? d?.label ?? '';
               if (val && config?.groupBy) onDrill(config.groupBy, String(val));
             } : undefined}
             label={({ label, percent }) => percent > 0.05 ? `${String(label ?? '').substring(0, 10)} ${(percent * 100).toFixed(0)}%` : ''}
             labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={chartColor(dark, i)} />)}
        </Pie>
        <ReTooltip formatter={(v) => [fmtValue(v), '']} />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TableWidget({ data, columns, dark, config, onDrill }: {
  data: Record<string, unknown>[]; columns: string[]; dark: boolean;
  config?: WidgetConfig; onDrill?: (f: string, v: string) => void;
}) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const cols = columns.length ? columns : Object.keys(data[0] ?? {});

  // Map internal column keys → display names from config
  const colLabel = (c: string): string => {
    if (c === 'label'  && config?.label_name)  return config.label_name;
    if (c === 'label2' && config?.label2_name) return config.label2_name;
    if (c === 'value'  && config?.value_name)  return config.value_name;
    return c.replace(/_/g, ' ').toUpperCase();
  };

  // Append unit suffix to value column header if metric implies it
  const valueHeader = (c: string): string => {
    const base = colLabel(c);
    if (c === 'value' && !config?.value_name) {
      const m = config?.metric ?? '';
      if (m.includes('hours') || m.includes('hrs')) return base + ' (hrs)';
      if (m.includes('sp') || m.includes('velocity')) return base + ' (SP)';
      if (m.includes('pct') || m.includes('rate'))    return base + ' (%)';
      if (m.includes('days'))                          return base + ' (days)';
    }
    return base;
  };

  return (
    <ScrollArea h="100%" style={{ fontSize: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${dark ? '#333' : '#eee'}` }}>
            {cols.map(c => (
              <th key={c} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600,
                color: dark ? AQUA : DEEP_BLUE, whiteSpace: 'nowrap', fontSize: 11 }}>
                {valueHeader(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}
              style={{ borderBottom: `1px solid ${dark ? '#222' : '#f5f5f5'}`, cursor: onDrill ? 'pointer' : undefined }}
              onClick={() => { if (onDrill && config?.groupBy && row.label) onDrill(config.groupBy, String(row.label)); }}>
              {cols.map(c => (
                <td key={c} style={{ padding: '5px 8px', fontSize: 12 }}>
                  {fmtValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function HeatmapWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const xLabels = [...new Set(data.map(d => String(d.label2 ?? '')))];
  const yLabels = [...new Set(data.map(d => String(d.label ?? '')))];
  const maxVal  = Math.max(...data.map(d => Number(d.value ?? 0)));

  const grid: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const y = String(d.label ?? ''); const x = String(d.label2 ?? '');
    if (!grid[y]) grid[y] = {};
    grid[y][x] = Number(d.value ?? 0);
  });

  return (
    <ScrollArea h="100%">
      <Box style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', minWidth: 120 }}></th>
              {xLabels.map(x => (
                <th key={x} style={{ padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap',
                  color: dark ? '#aaa' : '#555', fontSize: 10, transform: 'rotate(-30deg)',
                  display: 'inline-block' }}>
                  {String(x).substring(0, 15)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map(y => (
              <tr key={y}>
                <td style={{ padding: '2px 8px', fontWeight: 500, whiteSpace: 'nowrap',
                  color: dark ? '#ccc' : '#333', fontSize: 11 }}>
                  {String(y).substring(0, 20)}
                </td>
                {xLabels.map(x => {
                  const val = grid[y]?.[x] ?? 0;
                  const pct = maxVal > 0 ? val / maxVal : 0;
                  const bg  = dark
                    ? `rgba(78,205,196,${0.1 + pct * 0.85})`
                    : `rgba(30,100,170,${0.08 + pct * 0.75})`;
                  return (
                    <td key={x} title={`${y} × ${x}: ${val}`}
                      style={{ width: 32, height: 28, textAlign: 'center', backgroundColor: bg,
                        color: pct > 0.6 ? '#fff' : dark ? '#aaa' : '#555',
                        fontSize: 10, fontWeight: pct > 0.3 ? 600 : 400, cursor: 'default',
                        transition: 'background 0.2s', border: `1px solid ${dark ? '#1a1a1a' : '#fff'}` }}>
                      {val > 0 ? val : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </ScrollArea>
  );
}

function LeaderboardWidget({ data, dark, onDrill, config }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f: string, v: string) => void; config?: WidgetConfig }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const max = Math.max(...data.map(d => Number(d.value ?? 0)));
  return (
    <ScrollArea h="100%">
      <Stack gap={6} p="xs">
        {data.map((row, i) => (
          <Group key={i} gap="sm" wrap="nowrap"
            style={{ cursor: onDrill ? 'pointer' : undefined, borderRadius: 4, padding: '2px 4px', transition: 'background 0.15s' }}
            onClick={() => onDrill?.(config?.groupBy ?? 'label', String(row.label ?? ''))}>
            <Text size="xs" c="dimmed" fw={700} w={20} ta="right">{i + 1}</Text>
            <Box style={{ flex: 1 }}>
              <Group justify="space-between" mb={3}>
                <Text size="sm" fw={500} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(row.label ?? '—')}
                </Text>
                <Text size="sm" fw={700} c={dark ? AQUA : DEEP_BLUE}>{fmtValue(row.value)}</Text>
              </Group>
              <Box style={{ height: 4, background: dark ? '#2a2a2a' : '#eee', borderRadius: 2, overflow: 'hidden' }}>
                <Box style={{ height: '100%', width: `${max > 0 ? (Number(row.value) / max * 100) : 0}%`,
                  background: chartColor(dark, i), borderRadius: 2, transition: 'width 0.6s' }} />
              </Box>
            </Box>
          </Group>
        ))}
      </Stack>
    </ScrollArea>
  );
}

function VelocityChart({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const avg = data.reduce((s, d) => s + Number(d.value ?? 0), 0) / data.length;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Bar dataKey="value" name="Velocity (SP)" fill={CHART_PRIMARY(dark)} radius={[3, 3, 0, 0]}
          cursor={onDrill ? 'pointer' : undefined}
          onClick={onDrill ? (d: Record<string,unknown>) => { const v = d?.label ?? d?.name; if (v && config?.groupBy) onDrill(config.groupBy, String(v)); } : undefined} />
        {/* Average reference line via custom bar */}
        <ReTooltip />
      </BarChart>
    </ResponsiveContainer>
  );
}

const EMPTY_MESSAGES = [
  { icon: '🔍', text: 'Nothing to see here... yet', hint: 'Try widening the date range' },
  { icon: '🌵', text: 'Tumbleweeds. That\'s it.', hint: 'Check your filters' },
  { icon: '📭', text: 'Empty inbox, empty chart', hint: 'No data matches these filters' },
  { icon: '🎭', text: 'The data is on vacation', hint: 'Try "last 90 days"' },
  { icon: '🔭', text: 'Looking for data...', hint: 'It might be out there somewhere' },
  { icon: '🧊', text: 'Cool silence', hint: 'Zero results — good or bad?' },
  { icon: '💤', text: 'This widget needs coffee', hint: 'Try a broader time range' },
  { icon: '🎲', text: 'Roll a different filter', hint: 'No matches found' },
];

function EmptyState({ reason }: { reason?: string }) {
  const [entry] = useState(() => EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)]);
  const isError = reason && !reason.includes('No data');
  return (
    <Stack align="center" justify="center" h="100%" gap={4} px="md">
      <Text style={{ fontSize: 28, lineHeight: 1 }}>{isError ? '⚠️' : entry.icon}</Text>
      <Text size="xs" fw={700} c="dimmed" ta="center" style={{ letterSpacing: '0.01em' }}>
        {isError ? 'Query failed' : entry.text}
      </Text>
      <Text size="xs" c="dimmed" ta="center" opacity={0.7}>
        {isError ? reason?.substring(0, 80) : entry.hint}
      </Text>
    </Stack>
  );
}

// ── Phase 2 Widget Renderers ──────────────────────────────────────────────────

/** Horizontal heatmap — rows across top, columns down side */
function HeatmapHWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const yLabels = [...new Set(data.map(d => String(d.label ?? '')))];
  const xLabels = [...new Set(data.map(d => String(d.label2 ?? '')))];
  const maxVal  = Math.max(...data.map(d => Number(d.value ?? 0)));
  const grid: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const y = String(d.label ?? ''); const x = String(d.label2 ?? '');
    if (!grid[y]) grid[y] = {};
    grid[y][x] = Number(d.value ?? 0);
  });
  return (
    <ScrollArea h="100%">
      <Box style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', minWidth: 100 }}></th>
              {xLabels.map(x => (
                <th key={x} style={{ padding: '4px 6px', fontWeight: 600, color: dark ? '#aaa' : '#555', fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {String(x).substring(0, 15)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map(y => (
              <tr key={y}>
                <td style={{ padding: '2px 8px', fontWeight: 500, whiteSpace: 'nowrap', color: dark ? '#ccc' : '#333', fontSize: 11 }}>
                  {String(y).substring(0, 22)}
                </td>
                {xLabels.map(x => {
                  const val = grid[y]?.[x] ?? 0;
                  const pct = maxVal > 0 ? val / maxVal : 0;
                  const bg = dark ? `rgba(78,205,196,${0.1 + pct * 0.85})` : `rgba(30,100,170,${0.08 + pct * 0.75})`;
                  return (
                    <td key={x} title={`${y} / ${x}: ${val}`}
                      style={{ width: 36, height: 26, textAlign: 'center', backgroundColor: bg,
                        color: pct > 0.6 ? '#fff' : dark ? '#aaa' : '#555', fontSize: 10,
                        fontWeight: pct > 0.3 ? 600 : 400, cursor: 'default',
                        border: `1px solid ${dark ? '#1a1a1a' : '#fff'}` }}>
                      {val > 0 ? val : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </ScrollArea>
  );
}

/** Treemap — hierarchical area chart sized by metric */
// Custom tooltip for Treemap that shows name + value
const TreemapTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name?: string; size?: number } }> }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <Box style={{ background: 'rgba(0,0,0,0.8)', padding: '6px 10px', borderRadius: 4 }}>
      <Text size="xs" c="white" fw={700}>{d.name}</Text>
      <Text size="xs" c="white">{fmtValue(d.size)}</Text>
    </Box>
  );
};

function TreemapWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const treeData = data.map((d, i) => ({
    name: String(d.label ?? ''), size: Number(d.value ?? 0),
    fill: chartColor(dark, i),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap data={treeData} dataKey="size" nameKey="name" aspectRatio={4 / 3}
        onClick={onDrill ? (d: Record<string,unknown>) => { const v = d?.name ?? d?.label; if (v && config?.groupBy) onDrill(config.groupBy, String(v)); } : undefined}>
        <ReTooltip content={<TreemapTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}

/** Funnel chart — issue flow through stages */
function FunnelWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const fData = data.map((d, i) => ({
    name: String(d.label ?? ''), value: Number(d.value ?? 0),
    fill: chartColor(dark, i),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <ReTooltip />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Funnel dataKey="value" data={fData} isAnimationActive
          onClick={onDrill ? (d: any) => { const v = d?.name ?? d?.label; if (v && config?.groupBy) onDrill(config.groupBy, String(v)); } : undefined}>
          <LabelList position="right" fill={dark ? '#ccc' : '#333'} stroke="none"
            dataKey="name" style={{ fontSize: 11 }} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

/** Scatter plot — x vs y per dimension */
function ScatterWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  // Filter out NaN/invalid points before charting
  const pts = data
    .map(d => ({ x: Number(d.x ?? 0), y: Number(d.y ?? d.value ?? 0), name: String(d.label ?? '') }))
    .filter(p => isFinite(p.x) && isFinite(p.y));
  if (!pts.length) return <EmptyState reason="No numeric x/y values found — configure x_metric" />;
  const color = CHART_PRIMARY(dark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, bottom: 48, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="x" type="number" name={config?.label_name || 'X'} tick={{ fontSize: 11 }} label={{ value: config?.label_name || config?.groupBy || 'X', position: 'insideBottom', offset: -8, fontSize: 11 }} />
        <YAxis dataKey="y" type="number" name={config?.value_name || 'Y'} tick={{ fontSize: 11 }} />
        <ReTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: unknown, n: string) => [fmtValue(v), n]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Scatter data={pts} fill={color} opacity={0.7}
          onClick={onDrill ? (d: any) => { const v = d?.name ?? d?.label; if (v) onDrill('assignee_display_name', String(v)); } : undefined} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Waterfall — sprint-over-sprint delta */
function WaterfallWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  // Compute running total + delta
  let running = 0;
  const wData = data.map(d => {
    const val = Number(d.value ?? 0);
    const base = running;
    running += val;
    return { label: String(d.label ?? ''), value: val, base, total: running, positive: val >= 0 };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={wData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        {/* invisible base bar to lift positive bars */}
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]}>
          {wData.map((d, i) => <Cell key={i} fill={d.positive ? '#4ECDC4' : '#F1948A'} />)}
        </Bar>
        <Line type="monotone" dataKey="total" stroke={dark ? '#FFD700' : '#FFA500'} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Sprint Comparison — grouped bar, last N sprints side by side */
function SprintComparisonWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];
  if (!hasLabel2) return <BarChartWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
  const labels2 = [...new Set(data.map(d => String(d.label2 ?? '')))].slice(0, 6); // max 6 series
  const grouped: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const k = String(d.label ?? '');
    if (!grouped[k]) grouped[k] = {};
    grouped[k][String(d.label2 ?? '')] = Number(d.value ?? 0);
  });
  // Limit to last 8 sprints to keep bars visible
  const allSprints = Object.keys(grouped);
  const sprints = allSprints.slice(-8);
  const chartData = sprints.map(label => ({ label: String(label).substring(0, 16), ...grouped[label] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 12)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        {labels2.map((l, i) => (
          <Bar key={l} dataKey={l} fill={chartColor(dark, i)} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Label Cloud — tags sized by frequency */
function LabelCloudWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const max = Math.max(...data.map(d => Number(d.value ?? 0)));
  const colors = dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  return (
    <Box style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '12px', overflow: 'hidden' }}>
      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        justifyContent: 'center', alignContent: 'center', maxWidth: '100%' }}>
        {data.map((d, i) => {
          const val   = Number(d.value ?? 0);
          const scale = max > 0 ? 0.75 + (val / max) * 1.25 : 1;
          const color = colors[i % colors.length];
          const fs    = Math.max(11, Math.round(11 * scale));
          const fw    = scale > 1.5 ? 800 : scale > 1.1 ? 700 : 600;
          // Light bg = slightly tinted white; dark bg = color with alpha
          const bg    = dark ? `${color}28` : `${color}18`;
          const border = dark ? `1px solid ${color}60` : `1px solid ${color}50`;
          return (
            <Box key={i} style={{
              fontSize: fs, fontWeight: fw, color,
              padding: `${Math.round(3 * scale)}px ${Math.round(8 * scale)}px`,
              borderRadius: 6, backgroundColor: bg, border,
              cursor: 'default', whiteSpace: 'nowrap',
              transition: 'transform 0.15s',
              letterSpacing: scale > 1.3 ? '-0.02em' : undefined,
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }}
            title={`${d.label}: ${fmtValue(d.value)}`}>
              {String(d.label ?? '')}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** CFD — cumulative flow (stacked area). Handles both pivoted and {label,label2,value} formats */
function CfdWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;

  // If data has label2, it's unpivoted {label=week, label2=status, value=count} — pivot it
  let chartData = data;
  let statuses: string[] = [];
  if ('label2' in (data[0] ?? {})) {
    const weeks    = [...new Set(data.map(d => String(d.label ?? '')))].sort();
    statuses       = [...new Set(data.map(d => String(d.label2 ?? '')))].filter(Boolean).sort();
    const grid: Record<string, Record<string, number>> = {};
    data.forEach(d => {
      const w = String(d.label ?? ''); const s = String(d.label2 ?? '');
      if (!grid[w]) grid[w] = {};
      grid[w][s] = (grid[w][s] ?? 0) + Number(d.value ?? 0);
    });
    chartData = weeks.map(w => ({ week: w, ...grid[w] }));
  } else {
    statuses = Object.keys(data[0] ?? {}).filter(k => k !== 'week' && k !== 'label');
  }

  if (statuses.length === 0) return <BarChartWidget data={data} stacked dark={dark} />;
  const numWeeks = chartData.length;
  // Only show top 8 statuses by total volume to keep the chart readable
  const topStatuses = statuses.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end"
          interval={Math.max(0, Math.ceil(numWeeks / 6) - 1)}
          tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {topStatuses.map((s, i) => (
          <Area key={s} type="monotone" dataKey={s} stackId="cfd" name={s}
            stroke={chartColor(dark, i)}
            fill={chartColor(dark, i)} fillOpacity={0.55} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Control Chart — scatter with mean + ±2σ lines */
function ControlChartWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const vals = data.map(d => Number(d.value ?? 0));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sigma = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / vals.length);
  const pts = data.map((d, i) => ({ idx: i + 1, value: Number(d.value ?? 0), label: String(d.label ?? '') }));
  const color = CHART_PRIMARY(dark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 8, bottom: 30, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="idx" type="number" tick={{ fontSize: 10 }} label={{ value: 'Issue #', position: 'insideBottom', offset: -8, fontSize: 10 }} />
        <YAxis dataKey="value" tick={{ fontSize: 11 }} label={{ value: 'Cycle Days', angle: -90, position: 'insideLeft', fontSize: 10 }} />
        <ReTooltip formatter={(v: unknown) => [fmtValue(v), 'Cycle Days']} />
        <ReferenceLine y={mean} stroke="#FFD700" strokeDasharray="6 3" label={{ value: `Avg ${mean.toFixed(1)}`, fontSize: 10, fill: '#FFD700' }} />
        <ReferenceLine y={mean + 2 * sigma} stroke="#F1948A" strokeDasharray="4 4" label={{ value: `UCL ${(mean + 2 * sigma).toFixed(1)}`, fontSize: 9, fill: '#F1948A' }} />
        <ReferenceLine y={Math.max(0, mean - 2 * sigma)} stroke="#82E0AA" strokeDasharray="4 4" label={{ value: `LCL ${Math.max(0, mean - 2 * sigma).toFixed(1)}`, fontSize: 9, fill: '#82E0AA' }} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Scatter data={pts} fill={color} opacity={0.7}
          onClick={onDrill ? (d: any) => { const v = d?.name ?? d?.label; if (v) onDrill('assignee_display_name', String(v)); } : undefined} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Box Plot — custom SVG quartile boxes */
function BoxPlotWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const color = CHART_PRIMARY(dark);
  const boxH = 16; const rowH = 32; const labelW = 110; const chartW = 260;
  const allVals = data.flatMap(d => [Number(d.min_val ?? 0), Number(d.max_val ?? 0)]);
  const globalMax = Math.max(...allVals) || 1;
  const scale = (v: number) => (v / globalMax) * chartW;
  return (
    <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
      <Box p="xs" style={{ width: '100%' }}>
        <svg width="100%" viewBox={`0 0 ${labelW + chartW + 40} ${data.length * rowH + 40}`}
          style={{ maxHeight: '100%', display: 'block' }}>
          {/* X axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <text key={p} x={labelW + scale(p * globalMax)} y={data.length * rowH + 20}
              textAnchor="middle" fontSize={9} fill={dark ? '#666' : '#999'}>
              {(p * globalMax).toFixed(0)}d
            </text>
          ))}
          {data.map((d, i) => {
            const y = i * rowH + rowH / 2;
            const x1 = labelW + scale(Number(d.q1 ?? 0));
            const x3 = labelW + scale(Number(d.q3 ?? 0));
            const xMed = labelW + scale(Number(d.median ?? 0));
            const xMin = labelW + scale(Number(d.min_val ?? 0));
            const xMax = labelW + scale(Number(d.max_val ?? 0));
            const xP90 = labelW + scale(Number(d.p90 ?? 0));
            return (
              <g key={i} style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={() => { if (onDrill && d.label) onDrill('issue_type', String(d.label)); }}>
                <text x={labelW - 4} y={y + 4} textAnchor="end" fontSize={10} fill={dark ? '#ccc' : '#444'}>
                  {String(d.label ?? '').substring(0, 16)}
                </text>
                {/* Whisker line */}
                <line x1={xMin} x2={xMax} y1={y} y2={y} stroke={dark ? '#555' : '#bbb'} strokeWidth={1} />
                {/* IQR box */}
                <rect x={x1} y={y - boxH / 2} width={Math.max(2, x3 - x1)} height={boxH}
                  fill={color + '30'} stroke={color} strokeWidth={1.5} rx={2} />
                {/* Median line */}
                <line x1={xMed} x2={xMed} y1={y - boxH / 2} y2={y + boxH / 2} stroke={color} strokeWidth={2.5} />
                {/* P90 tick */}
                <line x1={xP90} x2={xP90} y1={y - 6} y2={y + 6} stroke="#F1948A" strokeWidth={1.5} />
                {/* N label */}
                <text x={xMax + 4} y={y + 4} fontSize={9} fill={dark ? '#666' : '#999'}>n={String(d.n ?? '')}</text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}

/** Gantt — horizontal timeline bars */
function GanttWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const dates = data.flatMap(d => [String(d.start_date ?? ''), String(d.end_date ?? '')]).filter(Boolean).sort();
  const minDate = new Date(dates[0] ?? new Date());
  const maxDate = new Date(dates[dates.length - 1] ?? new Date());
  const totalMs = Math.max(1, maxDate.getTime() - minDate.getTime());
  const pct = (d: string) => ((new Date(d).getTime() - minDate.getTime()) / totalMs) * 100;
  const width = (s: string, e: string) => Math.max(0.5, pct(e) - pct(s));
  const statusColor = (sc: string) => sc === 'done' ? '#82E0AA' : sc === 'indeterminate' ? '#F7DC6F' : '#85C1E9';

  return (
    <ScrollArea h="100%">
      <Stack gap={3} p="xs">
        {data.map((d, i) => (
          <Group key={i} gap={4} wrap="nowrap"
            style={{ cursor: onDrill ? 'pointer' : undefined }}
            onClick={() => { if (onDrill && d.project_key) onDrill('project_key', String(d.project_key)); }}>
            <Text size="xs" style={{ width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(d.summary ?? '')}>
              {String(d.issue_key ?? '')} {String(d.summary ?? '').substring(0, 20)}
            </Text>
            <Box style={{ flex: 1, position: 'relative', height: 18, backgroundColor: dark ? '#1a1a2e' : '#f5f5f5', borderRadius: 4 }}>
              <Box style={{
                position: 'absolute', left: `${pct(String(d.start_date ?? ''))}%`,
                width: `${width(String(d.start_date ?? ''), String(d.end_date ?? ''))}%`,
                height: '100%', backgroundColor: statusColor(String(d.status_category ?? '')),
                borderRadius: 4, minWidth: 4,
                display: 'flex', alignItems: 'center', paddingLeft: 4,
              }}>
                <Text size="xs" style={{ fontSize: 9, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {String(d.start_date ?? '')} → {String(d.end_date ?? '')}
                </Text>
              </Box>
            </Box>
            <Badge size="xs" variant="light" color={String(d.status_category ?? '') === 'done' ? 'green' : 'blue'}>
              {String(d.status_name ?? '').substring(0, 12)}
            </Badge>
          </Group>
        ))}
        {/* Legend */}
        <Group gap={8} mt={4}>
          {[['Done','#82E0AA'],['In Progress','#F7DC6F'],['Todo','#85C1E9']].map(([l, c]) => (
            <Group key={l} gap={4}>
              <Box style={{ width: 10, height: 10, backgroundColor: c, borderRadius: 2 }} />
              <Text size="xs" c="dimmed">{l}</Text>
            </Group>
          ))}
        </Group>
      </Stack>
    </ScrollArea>
  );
}

/** Release Readiness — radial completion bars per sprint */
function ReleaseReadinessWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const rData = data.slice(0, 6).map((d, i) => ({
    name: String(d.sprint_name ?? '').substring(0, 20),
    pct: Number(d.completion_pct ?? 0),
    fill: chartColor(dark, i),
  }));
  return (
    <Stack gap={6} p="xs" h="100%">
      {rData.map((d, i) => (
        <Box key={i} style={{ cursor: onDrill ? 'pointer' : undefined }}
          onClick={() => { if (onDrill) onDrill('sprint_name', d.name); }}>
          <Group justify="space-between" mb={2}>
            <Text size="xs" fw={500} style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Text>
            <Text size="xs" fw={700} c={d.pct >= 80 ? 'green' : d.pct >= 50 ? 'yellow' : 'red'}>{d.pct}%</Text>
          </Group>
          <Box style={{ height: 8, backgroundColor: dark ? '#2a2a2a' : '#eee', borderRadius: 4 }}>
            <Box style={{ height: '100%', width: `${d.pct}%`, backgroundColor: d.fill, borderRadius: 4, transition: 'width 0.5s' }} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/** Worklog Heatmap — hours per person per day/week */
function WorklogHeatmapWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  return <HeatmapHWidget data={data} dark={dark} config={config} onDrill={onDrill} />;
}

/** Worklog Trend — hours logged over time per person */
function WorklogTrendWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const hasLabel2 = 'label2' in data[0];
  if (!hasLabel2) return <LineChartWidget data={data} dark={dark} />;
  // Multi-series: each person as a line
  const persons = [...new Set(data.map(d => String(d.label2 ?? '')))];
  const weeks   = [...new Set(data.map(d => String(d.label ?? '')))].sort();
  const series: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const w = String(d.label ?? ''); const p = String(d.label2 ?? '');
    if (!series[w]) series[w] = {};
    series[w][p] = Number(d.value ?? 0);
  });
  const chartData = weeks.map(w => ({ week: w, ...series[w] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.ceil(weeks.length / 6)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {persons.map((p, i) => (
          <Line key={p} type="monotone" dataKey={p} stroke={chartColor(dark, i)} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Missing Widgets from Dashboard Builder ────────────────────────────────────

/** Horizontal Bar — top-N items laid out horizontally */
function HorizontalBarWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f: string, v: string) => void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100}
          tickFormatter={(v: string) => String(v).substring(0, 18)} />
        <ReTooltip formatter={(v: unknown) => [fmtValue(v), config?.value_name || 'Value']} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 10 }}>
          {data.map((_, i) => <Cell key={i} fill={chartColor(dark, i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Gauge — SVG arc speedometer (270° sweep, fixed viewBox) */
function GaugeWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  const value  = Number(data[0]?.value ?? 0);
  const warn   = config?.threshold_warning;
  const crit   = config?.threshold_critical;
  const maxVal = crit ? crit * 1.25 : warn ? warn * 2.5 : Math.max(value * 1.5, 100);
  const pct    = Math.min(1, value / maxVal);

  // Gauge geometry — 240° arc from 150° to 390° (=30°), symmetric around top
  // This keeps the full arc within a 200×160 viewBox
  const cx = 100; const cy = 95; const r = 70;
  const START_DEG = 150;   // bottom-left (7 o'clock)
  const SWEEP_DEG = 240;   // 240° sweep
  const toRad = (d: number) => (d * Math.PI) / 180;

  const pt = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  const arcPath = (fromDeg: number, toDeg: number) => {
    const s = pt(fromDeg); const e = pt(toDeg);
    const span = ((toDeg - fromDeg) + 360) % 360;
    const large = span > 180 ? 1 : 0;
    const sweep = 1;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const endDeg  = START_DEG + SWEEP_DEG;   // 390° = 30°
  const valDeg  = START_DEG + pct * SWEEP_DEG;
  const needleAngle = START_DEG + pct * SWEEP_DEG;
  const nx = cx + (r - 22) * Math.cos(toRad(needleAngle));
  const ny = cy + (r - 22) * Math.sin(toRad(needleAngle));

  const needleColor = (crit && value > crit) ? '#e74c3c' : (warn && value > warn) ? '#f39c12' : AQUA_HEX;
  const trackColor  = dark ? '#2d2d2d' : '#e2e8f0';

  return (
    <Stack align="center" justify="center" h="100%" style={{ overflow: 'hidden', cursor: onDrill ? 'pointer' : undefined }}
      onClick={() => onDrill?.('__all__', 'gauge')}>
      <svg viewBox="0 0 200 155" style={{ width: '100%', maxWidth: 240, maxHeight: '85%', pointerEvents: 'none' }}>
        {/* Track */}
        <path d={arcPath(START_DEG, endDeg)} fill="none" stroke={trackColor} strokeWidth={14} strokeLinecap="round" />
        {/* Warning zone */}
        {warn && <path d={arcPath(START_DEG, START_DEG + (warn / maxVal) * SWEEP_DEG)} fill="none" stroke="#4ECDC4" strokeWidth={14} strokeLinecap="round" opacity={0.45} />}
        {/* Critical zone */}
        {crit && <path d={arcPath(START_DEG + (warn ? (warn / maxVal) * SWEEP_DEG : 0), START_DEG + (crit / maxVal) * SWEEP_DEG)} fill="none" stroke="#f39c12" strokeWidth={14} strokeLinecap="round" opacity={0.45} />}
        {/* Value arc */}
        <path d={arcPath(START_DEG, valDeg)} fill="none" stroke={needleColor} strokeWidth={14} strokeLinecap="round" />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
          stroke={dark ? '#ddd' : '#333'} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill={needleColor} />
        {/* Value text — font size scales with value length */}
        <text x={cx} y={cy + 24} textAnchor="middle"
          fontSize={String(fmtValue(value)).length > 5 ? 18 : 24}
          fontWeight="800" fill={needleColor} fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-1">{fmtValue(value)}</text>
        <text x={cx} y={cy + 38} textAnchor="middle" fontSize={11} fill={dark ? '#888' : '#aaa'}
          fontFamily="system-ui, -apple-system, sans-serif">{config?.value_name || 'Value'}</text>
        {/* Min / max labels */}
        <text x={pt(START_DEG).x - 4} y={pt(START_DEG).y + 14} textAnchor="middle" fontSize={9} fill={dark ? '#666' : '#bbb'}>0</text>
        <text x={pt(endDeg).x + 4} y={pt(endDeg).y + 14} textAnchor="middle" fontSize={9} fill={dark ? '#666' : '#bbb'}>{fmtValue(maxVal)}</text>
        {/* Threshold labels */}
        {warn && <text x={cx - 28} y={cy + 52} textAnchor="middle" fontSize={9} fill="#f39c12">⚠ {warn}</text>}
        {crit && <text x={cx + 28} y={cy + 52} textAnchor="middle" fontSize={9} fill="#e74c3c">🔴 {crit}</text>}
      </svg>
    </Stack>
  );
}

/** Radar Chart — spider chart across dimensions */
function RadarWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const color = CHART_PRIMARY(dark);
  const radarData = data.map(d => ({ subject: String(d.label ?? '').substring(0, 16), value: Number(d.value ?? 0) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke={dark ? '#333' : '#e0e0e0'} />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: dark ? '#aaa' : '#555',
          cursor: onDrill ? 'pointer' : undefined,
          onClick: onDrill ? (e: React.MouseEvent<SVGTextElement>) => {
            const txt = (e.target as SVGTextElement).textContent;
            if (txt && config?.groupBy) onDrill(config.groupBy, txt);
          } : undefined }} />
        <Radar name="Value" dataKey="value" stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={onDrill ? (d: any) => { if (d?.subject && config?.groupBy) onDrill(config.groupBy, String(d.subject)); } : undefined} />
        <ReTooltip formatter={(v: unknown, name: unknown) => [fmtValue(v), String(name || '')]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Sparkline KPI — large number + mini trend line */
function SparklineKpiWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const sorted = [...data].sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? '')));
  const latest = Number(sorted[sorted.length - 1]?.value ?? 0);
  const prev   = Number(sorted[sorted.length - 2]?.value ?? 0);
  const trend  = prev > 0 ? ((latest - prev) / prev * 100).toFixed(1) : null;
  const color  = dark ? AQUA : DEEP_BLUE;
  return (
    <Stack gap={4} align="center" h="100%" justify="center"
      style={{ cursor: onDrill ? 'pointer' : undefined }}
      onClick={() => onDrill?.('__all__', 'sparkline')}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">{config?.value_name || 'Value'}</Text>
      <Text size="2rem" fw={800} c={color} lh={1}>{fmtValue(latest)}</Text>
      {trend && (
        <Badge size="xs" color={Number(trend) >= 0 ? 'green' : 'red'}>
          {Number(trend) >= 0 ? '↑' : '↓'} {Math.abs(Number(trend))}% vs prior
        </Badge>
      )}
      {/* pointerEvents:none lets click pass through recharts to parent Stack */}
      <Box style={{ width: '100%', height: 50, pointerEvents: 'none' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sorted} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
}

/** Countdown Timer — days/hours to a target date (stored in special_params) */
function CountdownWidget({ dark, config }: { dark: boolean; config?: WidgetConfig }) {
  const target = config?.special_params?.target_date;
  const label  = config?.special_params?.target_label ?? config?.label_name ?? 'Target';
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  if (!target) return (
    <Stack align="center" justify="center" h="100%">
      <Text size="xs" c="dimmed">Set target_date in special_params</Text>
      <Text size="xs" c="dimmed" ff="monospace">e.g. 2026-06-30</Text>
    </Stack>
  );
  const ms   = new Date(target).getTime() - now.getTime();
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  const past = ms < 0;
  const color = past ? 'red' : days < 7 ? 'orange' : days < 30 ? 'yellow' : dark ? AQUA : DEEP_BLUE;
  return (
    <Stack align="center" justify="center" h="100%" gap={4}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
      <Text style={{ fontSize: '2.8rem', fontWeight: 900, color, lineHeight: 1 }}>
        {past ? `+${Math.abs(days)}` : days}
      </Text>
      <Text size="sm" fw={600} c="dimmed">{past ? 'days overdue' : 'days remaining'}</Text>
      {!past && days < 30 && <Text size="xs" c="dimmed">{hrs}h left today</Text>}
      <Text size="xs" c="dimmed">{new Date(target).toLocaleDateString()}</Text>
    </Stack>
  );
}

/** Epic Progress Bars — horizontal progress bars per epic */
function EpicProgressWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ScrollArea h="100%">
      <Stack gap={8} p="xs">
        {data.map((d, i) => {
          const pct = Math.min(100, Number(d.value ?? 0));
          const bar = pct >= 80 ? '#82E0AA' : pct >= 50 ? '#F7DC6F' : '#F1948A';
          return (
            <Box key={i}
              style={{ cursor: onDrill ? 'pointer' : undefined }}
              onClick={() => { if (onDrill && d.label && config?.groupBy) onDrill(config.groupBy, String(d.label)); }}>
              <Group justify="space-between" mb={3}>
                <Text size="xs" fw={500} style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(d.label ?? '—')}
                </Text>
                <Text size="xs" fw={700} c={pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'}>{pct}%</Text>
              </Group>
              <Box style={{ height: 8, backgroundColor: dark ? '#2a2a2a' : '#eee', borderRadius: 4, overflow: 'hidden' }}>
                <Box style={{ height: '100%', width: `${pct}%`, backgroundColor: bar, borderRadius: 4, transition: 'width 0.5s' }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}

/** Monthly Summary — created / resolved / net change table */
function MonthlySummaryWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const cols = ['month','created','resolved','open','net_new_open','avg_age_days'];
  const hdrs = ['Month','Created','Resolved','Open','Net New','Avg Age (d)'];
  return (
    <ScrollArea h="100%">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${dark ? '#333' : '#eee'}` }}>
            {hdrs.map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Month' ? 'left' : 'right',
                fontWeight: 700, color: dark ? AQUA : DEEP_BLUE, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const net = Number(row.net_new_open ?? 0);
            return (
              <tr key={i}
                style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, cursor: onDrill ? 'pointer' : undefined }}
                onClick={() => { if (onDrill && row.month) onDrill('resolution_month', String(row.month)); }}>
                {cols.map((c, ci) => (
                  <td key={c} style={{ padding: '4px 8px', textAlign: ci === 0 ? 'left' : 'right',
                    color: c === 'net_new_open' ? (net > 0 ? '#e74c3c' : net < 0 ? '#82E0AA' : undefined) : undefined }}>
                    {fmtValue(row[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

/** Period vs Period — side-by-side comparison */
function PeriodVsPeriodWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  // data has: metric, current, previous, change, change_pct, better
  return (
    <ScrollArea h="100%">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${dark ? '#333' : '#eee'}` }}>
            {['Metric','Current','Previous','Change'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Metric' ? 'left' : 'right',
                fontWeight: 700, color: dark ? AQUA : DEEP_BLUE }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const chg  = Number(row.change ?? 0);
            const pct  = Number(row.change_pct ?? 0);
            const up   = chg > 0;
            const arrow = chg === 0 ? '→' : up ? '↑' : '↓';
            const color = chg === 0 ? undefined : up ? '#82E0AA' : '#F1948A';
            return (
              <tr key={i}
                style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, cursor: onDrill ? 'pointer' : undefined }}
                onClick={() => onDrill?.('__all__', String(row.metric ?? ''))}>
                <td style={{ padding: '5px 8px', fontWeight: 500 }}>{String(row.metric ?? '')}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtValue(row.current)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: dark ? '#888' : '#999' }}>{fmtValue(row.previous)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color }}>
                  {arrow} {Math.abs(Number(fmtValue(chg)))} ({pct > 0 ? '+' : ''}{pct}%)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

/** Issue Table with CSV Export — searchable full issue rows */
function IssueTableRawWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  const [search, setSearch] = useState('');
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;

  const filtered = search
    ? data.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : data;

  const exportCSV = () => {
    const cols = Object.keys(data[0] ?? {});
    const csv  = [cols.join(','), ...filtered.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'issues.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const cols = ['issue_key','summary','issue_type','status_name','priority_name','assignee_display_name','story_points','age_days'];
  const hdrs = ['Key','Summary','Type','Status','Priority','Assignee','SP','Age(d)'];
  return (
    <Stack gap={6} h="100%">
      <Group gap={6}>
        <TextInput size="xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }} />
        <Tooltip label="Export CSV">
          <ActionIcon size="sm" variant="light" onClick={exportCSV}><IconDownload size={14} /></ActionIcon>
        </Tooltip>
        <Text size="xs" c="dimmed">{filtered.length} rows</Text>
      </Group>
      <ScrollArea style={{ flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${dark ? '#333' : '#eee'}`, position: 'sticky', top: 0, backgroundColor: dark ? '#1a1a2e' : '#fff' }}>
              {hdrs.map(h => (
                <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700,
                  color: dark ? AQUA : DEEP_BLUE, whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f8f8f8'}`, cursor: onDrill ? 'pointer' : undefined }}
                onClick={() => { if (onDrill && row.assignee_display_name) onDrill('assignee_display_name', String(row.assignee_display_name)); }}>
                {cols.map(c => (
                  <td key={c} style={{ padding: '3px 6px', maxWidth: c === 'summary' ? 200 : undefined,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}
                    title={String(row[c] ?? '')}>
                    {fmtValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </Stack>
  );
}

/** Worklog Timeline — timesheet view per assignee with totals */
function WorklogTimelineWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  // Expects groupBy=author, groupBy2=week (or month)
  const hasLabel2 = 'label2' in data[0];
  if (!hasLabel2) return <LeaderboardWidget data={data} dark={dark} />;
  const periods  = [...new Set(data.map(d => String(d.label2 ?? '')))].sort();
  const authors  = [...new Set(data.map(d => String(d.label ?? '')))];
  const grid: Record<string, Record<string, number>> = {};
  let grandTotal = 0;
  data.forEach(d => {
    const a = String(d.label ?? ''); const p = String(d.label2 ?? '');
    if (!grid[a]) grid[a] = {};
    grid[a][p] = Number(d.value ?? 0);
    grandTotal += Number(d.value ?? 0);
  });
  return (
    <ScrollArea h="100%">
      <Box style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 400 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${dark ? '#333' : '#ddd'}` }}>
              <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700, minWidth: 120 }}>Assignee</th>
              {periods.map(p => <th key={p} style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 10, color: dark ? '#aaa' : '#777' }}>{String(p).substring(0, 10)}</th>)}
              <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: dark ? AQUA : DEEP_BLUE }}>Total</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: dark ? '#888' : '#999', fontSize: 10 }}>% Share</th>
            </tr>
          </thead>
          <tbody>
            {authors.map((a, i) => {
              const total = periods.reduce((s, p) => s + (grid[a]?.[p] ?? 0), 0);
              const share = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0';
              return (
                <tr key={a} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`, backgroundColor: i % 2 === 0 ? (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') : undefined }}>
                  <td style={{ padding: '3px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>{a.substring(0, 22)}</td>
                  {periods.map(p => {
                    const v = grid[a]?.[p] ?? 0;
                    return <td key={p} style={{ padding: '3px 6px', textAlign: 'right', color: v > 0 ? undefined : dark ? '#333' : '#ddd' }}>{v > 0 ? v.toFixed(1) : '—'}</td>;
                  })}
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700 }}>{total.toFixed(1)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: dark ? '#888' : '#999', fontSize: 10 }}>{share}%</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `2px solid ${dark ? '#333' : '#ddd'}`, fontWeight: 700 }}>
              <td style={{ padding: '4px 8px' }}>Total</td>
              {periods.map(p => {
                const colTotal = authors.reduce((s, a) => s + (grid[a]?.[p] ?? 0), 0);
                return <td key={p} style={{ padding: '4px 6px', textAlign: 'right' }}>{colTotal > 0 ? colTotal.toFixed(1) : '—'}</td>;
              })}
              <td style={{ padding: '4px 8px', textAlign: 'right', color: dark ? AQUA : DEEP_BLUE }}>{grandTotal.toFixed(1)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </Box>
    </ScrollArea>
  );
}

// ── Completing Dashboard Builder Parity ──────────────────────────────────────

/** Ratio KPI — metric A : metric B (e.g. Bug:Story ratio) */
function RatioKpiWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: () => void }) {
  if (!data.length) return <EmptyState reason="No data — set numeratorType/denominatorType in special_params" />;
  const d = data[0] ?? {};
  const num  = Number(d.numerator   ?? 0);
  const den  = Number(d.denominator ?? 0);
  const pct  = Number(d.ratio_pct   ?? 0);
  const total = Number(d.total      ?? 0);
  const color = CHART_PRIMARY(dark);
  const sp = config?.special_params ?? {};
  return (
    <Stack align="center" justify="center" h="100%" gap={6}
      style={{ cursor: onDrill ? 'pointer' : undefined }} onClick={onDrill}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        {sp.numeratorType || 'Bug'} : {sp.denominatorType || 'Story'} Ratio
      </Text>
      <Text style={{ fontSize: '2.4rem', fontWeight: 900, color, lineHeight: 1 }}>{pct}%</Text>
      <Group gap={16}>
        <Stack gap={0} align="center">
          <Text size="xl" fw={700} c="red">{num.toLocaleString()}</Text>
          <Text size="xs" c="dimmed">{sp.numeratorType || 'Bugs'}</Text>
        </Stack>
        <Text size="xl" c="dimmed">:</Text>
        <Stack gap={0} align="center">
          <Text size="xl" fw={700} c={color}>{den.toLocaleString()}</Text>
          <Text size="xs" c="dimmed">{sp.denominatorType || 'Stories'}</Text>
        </Stack>
      </Group>
      <Text size="xs" c="dimmed">out of {total.toLocaleString()} total issues</Text>
    </Stack>
  );
}

/** Created vs Resolved — dual-line chart */
function CreatedVsResolvedWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.ceil(data.length / 8)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        <Area type="monotone" dataKey="created" name="Created" stroke="#F1948A" fill="#F1948A" fillOpacity={0.2} strokeWidth={2}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeDot={onDrill ? (p: any) => <circle {...p} r={5} style={{ cursor:'pointer' }} onClick={() => { const v = p?.payload?.week; if (v) onDrill('week', String(v)); }} /> : { r: 5 }} />
        <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#82E0AA" fill="#82E0AA" fillOpacity={0.2} strokeWidth={2}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeDot={onDrill ? (p: any) => <circle {...p} r={5} style={{ cursor:'pointer' }} onClick={() => { const v = p?.payload?.week; if (v) onDrill('week', String(v)); }} /> : { r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Open Trend — running total of open issues with created/resolved overlay */
function OpenTrendWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  const color = CHART_PRIMARY(dark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 28, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={Math.ceil(data.length / 8)} tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        <Bar yAxisId="left" dataKey="created" name="Created" fill="#F1948A" opacity={0.5} />
        <Bar yAxisId="left" dataKey="resolved" name="Resolved" fill="#82E0AA" opacity={0.5} />
        <Line yAxisId="right" type="monotone" dataKey="open_running_total" name="Open Total"
          stroke={color} strokeWidth={2.5}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeDot={onDrill ? (p: any) => <circle {...p} r={5} style={{ cursor:'pointer' }} onClick={() => { const v = p?.payload?.week; if (v) onDrill('week', String(v)); }} /> : { r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Sprint Burndown — remaining SP vs ideal line */
function SprintBurndownWidget({ data, dark, config, onDrill }: { data: Record<string, unknown>[]; dark: boolean; config?: WidgetConfig; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No sprint found — try setting a project filter" />;
  // data is the burndown array from special endpoint (normalised in useWidgetData)
  const burndown = data.filter(d => d.day !== undefined || d.remaining !== undefined);
  if (!burndown.length) return <EmptyState reason="No burndown data" />;
  const color = CHART_PRIMARY(dark);
  return (
    <Box h="100%" style={{ cursor: onDrill ? 'pointer' : undefined }}
      onClick={() => onDrill?.('__all__', 'burndown')}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={burndown} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" tickFormatter={(v: string) => String(v ?? '').substring(0, 10)} />
        <YAxis tick={{ fontSize: 11 }} label={{ value: 'SP', angle: -90, position: 'insideLeft', fontSize: 10 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} verticalAlign="top" />
        <Line type="monotone" dataKey="remaining" name="Actual" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#aaa" strokeDasharray="6 3" strokeWidth={1.5} dot={false} />
        <ReferenceLine y={0} stroke={dark ? '#444' : '#ccc'} />
      </LineChart>
    </ResponsiveContainer>
    </Box>
  );
}

// ── Global Filters Context ────────────────────────────────────────────────────

interface GlobalFilterCtx {
  globalFilters: GlobalFilters;
  setGlobalFilters: (f: GlobalFilters) => void;
}
const GlobalFilterContext = React.createContext<GlobalFilterCtx>({
  globalFilters: {}, setGlobalFilters: () => {},
});

// ── Text Block / Section Header widget ────────────────────────────────────────

function TextBlockWidget({ config, dark }: { config: WidgetConfig; dark: boolean }) {
  const content = config.text_content ?? '';
  const align   = config.text_align   ?? 'left';
  const size    = config.text_size    ?? 'sm';
  // Detect if it's a section header (starts with ##)
  const isHeader = content.trimStart().startsWith('#');
  const lines    = content.replace(/^#{1,3}\s/gm, '').split('\n');

  return (
    <Box p="md" h="100%" style={{ display:'flex', flexDirection:'column', justifyContent:'center' }}>
      {isHeader ? (
        <>
          <Title order={4} ta={align} c={dark ? AQUA : DEEP_BLUE} style={{ letterSpacing: '-0.02em' }}>
            {content.replace(/^#{1,3}\s/, '').split('\n')[0]}
          </Title>
          {lines.length > 1 && <Text size="sm" c="dimmed" ta={align as 'left'}>{lines.slice(1).join('\n')}</Text>}
        </>
      ) : (
        <Text size={size} ta={align as 'left'} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{content}</Text>
      )}
    </Box>
  );
}

// ── Benchmark / Period Comparison widget ──────────────────────────────────────

function BenchmarkWidget({ data, dark, onDrill }: { data: Record<string, unknown>[]; dark: boolean; onDrill?: (f:string,v:string)=>void }) {
  if (!data.length) return <EmptyState reason="No data matches this configuration" />;
  return (
    <ScrollArea h="100%">
      <Stack gap={8} p="xs">
        {data.map((row, i) => {
          const chg  = Number(row.change   ?? 0);
          const pct  = Number(row.change_pct ?? 0);
          const cur  = Number(row.current  ?? 0);
          const prev = Number(row.previous ?? 0);
          const up   = chg > 0;
          const pctAbs = Math.abs(pct);
          const ringColor = pctAbs > 20 ? (up ? 'green' : 'red') : (up ? 'teal' : 'orange');
          return (
            <Group key={i} gap={12} wrap="nowrap" p={8}
              style={{
                borderRadius: 8, cursor: onDrill ? 'pointer' : undefined,
                background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`,
              }}
              onClick={() => onDrill?.('__all__', String(row.metric ?? ''))}>

              <RingProgress size={56} thickness={5} roundCaps
                sections={[{ value: Math.min(100, pctAbs * 2), color: ringColor }]}
                label={<Text size="xs" fw={700} ta="center" c={ringColor}>{up ? '↑' : '↓'}{pctAbs.toFixed(0)}%</Text>} />
              <Box style={{ flex: 1 }}>
                <Text size="xs" fw={700} mb={2}>{String(row.metric ?? '')}</Text>
                <Group gap={12}>
                  <Box>
                    <Text size="xs" c="dimmed">Current</Text>
                    <Text size="md" fw={800} c={dark ? AQUA : DEEP_BLUE}>{fmtValue(cur)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Previous</Text>
                    <Text size="sm" fw={500} c="dimmed">{fmtValue(prev)}</Text>
                  </Box>
                </Group>
              </Box>
              <Badge size="lg" variant="light" color={ringColor} style={{ flexShrink: 0 }}>
                {up ? '+' : ''}{fmtValue(chg)}
              </Badge>
            </Group>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}

// ── Size Presets ──────────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { label: '¼',   w: 3,  h: 3, title: 'Small (3×3)' },
  { label: '⅓',   w: 4,  h: 4, title: 'Narrow (4×4)' },
  { label: '½',   w: 6,  h: 4, title: 'Half width (6×4)' },
  { label: '⅔',   w: 8,  h: 4, title: 'Wide (8×4)' },
  { label: 'Full',w: 12, h: 5, title: 'Full width (12×5)' },
  { label: 'Tall',w: 6,  h: 7, title: 'Tall half (6×7)' },
];

// ── Widget Layout Popover ─────────────────────────────────────────────────────

function WidgetLayoutPopover({ widget, dark, onReposition }: {
  widget: Widget; dark: boolean;
  onReposition: (pos: { x: number; y: number; w: number; h: number }) => void;
}) {
  const pos = parsePosition(widget.position);
  const [localPos, setLocalPos] = useState({ x: pos.x ?? 0, y: pos.y ?? 0, w: pos.w ?? 6, h: pos.h ?? 4 });
  const [open, setOpen] = useState(false);

  const apply = (p: typeof localPos) => {
    setLocalPos(p);
    onReposition(p);
    setOpen(false);
  };

  return (
    <Tooltip label="Layout & Size">
      <Box style={{ position: 'relative', display: 'inline-block' }}>
        <ActionIcon size="xs" variant="subtle"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}>
          <IconLayoutGrid size={13} />
        </ActionIcon>
        {open && (
          <Box
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 22, right: 0, zIndex: 1000,
              width: 280, padding: 12, borderRadius: 8,
              backgroundColor: dark ? '#1a1a2e' : '#fff',
              border: `1px solid ${dark ? '#333' : '#e0e0e0'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
            <Text size="xs" fw={700} c="dimmed" mb={8}>SIZE PRESETS</Text>
            <Group gap={4} mb={12} wrap="wrap">
              {SIZE_PRESETS.map(p => (
                <Tooltip key={p.label} label={p.title}>
                  <Button size="xs" variant="light"
                    onClick={() => apply({ ...localPos, w: p.w, h: p.h })}>
                    {p.label}
                  </Button>
                </Tooltip>
              ))}
            </Group>

            <Text size="xs" fw={700} c="dimmed" mb={6}>MANUAL POSITION</Text>
            <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <NumberInput size="xs" label="Column (x)" min={0} max={11}
                value={localPos.x} onChange={v => setLocalPos(p => ({ ...p, x: Number(v ?? 0) }))} />
              <NumberInput size="xs" label="Row (y)" min={0} max={50}
                value={localPos.y} onChange={v => setLocalPos(p => ({ ...p, y: Number(v ?? 0) }))} />
              <NumberInput size="xs" label="Width (cols)" min={1} max={12}
                value={localPos.w} onChange={v => setLocalPos(p => ({ ...p, w: Number(v ?? 1) }))} />
              <NumberInput size="xs" label="Height (rows)" min={1} max={20}
                value={localPos.h} onChange={v => setLocalPos(p => ({ ...p, h: Number(v ?? 1) }))} />
            </Box>

            <Group justify="flex-end" mt={10} gap={6}>
              <Button size="xs" variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="xs" onClick={() => apply(localPos)}>Apply</Button>
            </Group>
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

// ── Widget Card (renders any widget type) ─────────────────────────────────────

function WidgetCard({ widget, dark, onEdit, onDelete, onDuplicate, onReposition }: {
  widget: Widget; dark: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
  onReposition: (pos: { x: number; y: number; w: number; h: number }) => void;
}) {
  const baseConfig = parseConfig(widget.config);
  const { drill }          = useContext(DrillContext);
  const { globalFilters }  = useContext(GlobalFilterContext);

  // Merge global filters + drill filter into config
  const config: WidgetConfig = React.useMemo(() => {
    // Skip merging for text/layout widgets
    if (['text_block','section_header','countdown'].includes(baseConfig.source ?? '')) return baseConfig;

    const extra: WidgetFilter[] = [];
    // Global filters
    if (globalFilters.date_preset) {/* handled below */}
    if (globalFilters.project_key) extra.push({ field: 'project_key', op: 'eq', value: globalFilters.project_key });
    if (globalFilters.assignee)    extra.push({ field: 'assignee_display_name', op: 'like', value: globalFilters.assignee });
    if (globalFilters.sprint_name) extra.push({ field: 'sprint_name', op: 'eq', value: globalFilters.sprint_name });
    // Drill filter
    if (drill && baseConfig.groupBy) {
      const alreadyFiltered = baseConfig.filters.some(f => f.field === drill.field);
      if (!alreadyFiltered) extra.push({ field: drill.field, op: 'eq', value: drill.value });
    }
    if (!extra.length && !globalFilters.date_preset) return baseConfig;
    return {
      ...baseConfig,
      dateRange: globalFilters.date_preset ? { preset: globalFilters.date_preset } : baseConfig.dateRange,
      filters: [...(baseConfig.filters ?? []), ...extra],
    };
  }, [baseConfig, drill, globalFilters]);

  const { data: qData, isLoading, isError } = useWidgetData(config, true);
  const rows    = qData?.data ?? [];
  const cols    = qData?.columns ?? [];

  const { setDrill, openDrawer } = useContext(DrillContext);
  const handleDrill = useCallback((field: string, value: string) => {
    const isAll = field === '__all__';
    const df: DrillFilter = {
      field,
      value,
      label: isAll ? `All issues — ${widget.title}` : `${field.replace(/_/g, ' ')} = "${value}"`,
      // Carry widget's own filters so the drawer applies them too
      widgetFilters: baseConfig.filters ?? [],
      widgetDateRange: baseConfig.dateRange,
    };
    setDrill(df);
    openDrawer();
  }, [setDrill, openDrawer, baseConfig, widget.title]);

  // Threshold status for KPI cards
  const thresholdStatus: 'ok' | 'warning' | 'critical' = React.useMemo(() => {
    if (widget.widget_type !== 'kpi_card') return 'ok';
    const val   = Number(rows[0]?.value ?? 0);
    const warn  = baseConfig.threshold_warning;
    const crit  = baseConfig.threshold_critical;
    const dir   = baseConfig.threshold_direction ?? 'above';
    if (crit !== undefined && (dir === 'above' ? val > crit : val < crit)) return 'critical';
    if (warn !== undefined && (dir === 'above' ? val > warn : val < warn)) return 'warning';
    return 'ok';
  }, [rows, baseConfig, widget.widget_type]);

  const HEADER_H = 38;
  const borderColor = thresholdStatus === 'critical' ? '#e74c3c' : thresholdStatus === 'warning' ? '#f39c12' : undefined;

  const CAT_COLORS: Record<string, string> = {
    violet: '#9c36b5', blue: '#1971c2', cyan: '#0c8599', grape: '#862e9c',
    indigo: '#3b5bdb', teal: '#0f9e8d', orange: '#e67700', green: '#2f9e44',
    yellow: '#e67700', pink: '#c2255c', gray: '#868e96',
  };
  const catColor = getWidgetColor(widget.widget_type);
  const catHex   = CAT_COLORS[catColor] ?? '#4ECDC4';

  return (
    <Card p={0} style={{
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#fff',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: borderColor
        ? `2px solid ${borderColor}`
        : `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
      borderRadius: 10,
      boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.3s, box-shadow 0.2s',
    }}>
      {/* Color accent bar at top */}
      <Box style={{ height: 3, background: catHex, flexShrink: 0 }} />

      {/* Header — drag handle */}
      <Group px={10} py={6} justify="space-between" wrap="nowrap"
        className="widget-drag-handle"
        style={{
          height: HEADER_H - 3, cursor: 'grab',
          borderBottom: `1px solid ${dark ? '#232323' : '#f0f2f5'}`,
          userSelect: 'none',
        }}>
        <HoverCard width={260} shadow="md" openDelay={500} closeDelay={100} withinPortal>
          <HoverCard.Target>
            <Group gap={6} wrap="nowrap" style={{ overflow: 'hidden', flex: 1, cursor: 'default' }}>
              <Box style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: catHex }} />
              <Text size="sm" fw={600} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                {widget.title}
              </Text>
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown p="sm" style={{ border: `1px solid ${dark ? '#333' : '#e8ecf0'}` }}>
            <Stack gap={6}>
              <Group gap={6}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: catHex }} />
                <Text size="xs" fw={700} tt="uppercase" style={{ color: catHex, letterSpacing: '0.05em' }}>
                  {widget.widget_type.replace(/_/g, ' ')}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" lh={1.5}>
                {WIDGET_HELP[widget.widget_type] ?? 'Configure this widget using the Edit button.'}
              </Text>
              {rows.length > 0 && (() => {
                try {
                  const ins = generateInsights(rows, config, widget.widget_type);
                  return (
                    <>
                      <Divider my={2} />
                      <Text size="xs" fw={600} mb={2}>📊 Current data</Text>
                      {ins.map((line, i) => (
                        <Text key={i} size="xs" c="dimmed">• {line}</Text>
                      ))}
                    </>
                  );
                } catch { return null; }
              })()}
              <Text size="xs" c="dimmed" mt={4} style={{ fontStyle: 'italic', opacity: 0.6 }}>
                Click ✏️ to edit · ⊞ to resize/move · 🔍 Click chart to drill-through
              </Text>
            </Stack>
          </HoverCard.Dropdown>
        </HoverCard>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          <WidgetLayoutPopover widget={widget} dark={dark} onReposition={onReposition} />
          <Tooltip label="Edit" withArrow><ActionIcon size="xs" variant="subtle" color="gray" onClick={onEdit}><IconEdit size={12} /></ActionIcon></Tooltip>
          <Tooltip label="Duplicate" withArrow><ActionIcon size="xs" variant="subtle" color="gray" onClick={onDuplicate}><IconCopy size={12} /></ActionIcon></Tooltip>
          <Tooltip label="Remove" withArrow><ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}><IconTrash size={12} /></ActionIcon></Tooltip>
        </Group>
      </Group>

      {/* Body — flex fills remaining height of the RGL cell */}
      <Box style={{ flex: 1, padding: '6px 4px 4px 4px', overflow: 'hidden', minHeight: 0 }}>
        {isLoading ? (
          <Stack align="center" justify="center" h="100%"><Loader size="sm" color="teal" /></Stack>
        ) : isError ? (
          <EmptyState reason={(qData as unknown as { error?: string })?.error ?? 'Query failed — click edit to check config'} />
        ) : widget.widget_type === 'kpi_card' ? (
          <KpiCard data={rows} title={widget.title} metric={config.metric} dark={dark}
            onDrill={() => handleDrill('__all__', widget.title)} />
        ) : widget.widget_type === 'bar' ? (
          <BarChartWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'stacked_bar' ? (
          <BarChartWidget data={rows} stacked dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'line' ? (
          <LineChartWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'area' ? (
          <LineChartWidget data={rows} area dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'pie' ? (
          <PieChartWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'table' ? (
          <TableWidget data={rows} columns={cols} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'heatmap' ? (
          <HeatmapWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'heatmap_h' ? (
          <HeatmapHWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'leaderboard' ? (
          <LeaderboardWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'velocity' ? (
          <VelocityChart data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'text_block' || widget.widget_type === 'section_header' ? (
          <TextBlockWidget config={config} dark={dark} />
        ) : widget.widget_type === 'benchmark' ? (
          <BenchmarkWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'ratio_kpi' ? (
          <RatioKpiWidget data={rows} dark={dark} config={config} onDrill={() => handleDrill('__all__', 'ratio_kpi')} />
        ) : widget.widget_type === 'created_vs_resolved' ? (
          <CreatedVsResolvedWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'open_trend' ? (
          <OpenTrendWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'sprint_burndown' ? (
          <SprintBurndownWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'horizontal_bar' ? (
          <HorizontalBarWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'gauge' ? (
          <GaugeWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'radar' ? (
          <RadarWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'sparkline_kpi' ? (
          <SparklineKpiWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'countdown' ? (
          <CountdownWidget dark={dark} config={config} />
        ) : widget.widget_type === 'epic_progress' ? (
          <EpicProgressWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'monthly_summary' ? (
          <MonthlySummaryWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'period_vs_period' ? (
          <PeriodVsPeriodWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'issue_table_raw' ? (
          <IssueTableRawWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'worklog_timeline' ? (
          <WorklogTimelineWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'treemap' ? (
          <TreemapWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'funnel' ? (
          <FunnelWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'scatter' ? (
          <ScatterWidget data={rows} dark={dark} config={config} onDrill={handleDrill} />
        ) : widget.widget_type === 'waterfall' ? (
          <WaterfallWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'sprint_comparison' ? (
          <SprintComparisonWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'label_cloud' ? (
          <LabelCloudWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'cfd' ? (
          <CfdWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'control_chart' ? (
          <ControlChartWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'box_plot' ? (
          <BoxPlotWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'gantt' ? (
          <GanttWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'release_readiness' ? (
          <ReleaseReadinessWidget data={rows} dark={dark} onDrill={handleDrill} />
        ) : widget.widget_type === 'worklog_heatmap' ? (
          <WorklogHeatmapWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : widget.widget_type === 'worklog_trend' ? (
          <WorklogTrendWidget data={rows} dark={dark} onDrill={handleDrill} config={config} />
        ) : (
          <EmptyState />
        )}
      </Box>
    </Card>
  );
}

// ── Widget Config Panel ───────────────────────────────────────────────────────

// ── Smart filter row with value autocomplete for label / custom fields ────────

function FilterRow({ filter, source, dimOptions, onChange, onRemove }: {
  filter: WidgetFilter;
  source: string;
  dimOptions: { value: string; label: string }[];
  onChange: (f: WidgetFilter) => void;
  onRemove: () => void;
}) {
  const needsValues = filter.field && !['is_null', 'is_not_null'].includes(filter.op);
  const isSpecial = filter.field === 'label' || (filter.field ?? '').startsWith('cf_');
  const { data: fieldValues = [] } = useFieldValues(
    isSpecial && needsValues ? filter.field : null, source
  );

  return (
    <Group gap={4} wrap="nowrap">
      <Select size="xs" value={filter.field || null} data={dimOptions} searchable
        style={{ flex: 2 }} placeholder="Field"
        onChange={v => onChange({ ...filter, field: v ?? '', value: '' })} />
      <Select size="xs" value={filter.op} data={FILTER_OPS} style={{ flex: 1 }}
        onChange={v => onChange({ ...filter, op: v ?? 'eq' })} />
      {needsValues && (
        isSpecial && fieldValues.length > 0 ? (
          // Smart dropdown for label / custom field values
          <Select size="xs" value={String(filter.value ?? '')} searchable clearable
            style={{ flex: 2 }} placeholder="Select value..."
            data={fieldValues.map(v => ({ value: v, label: v }))}
            onChange={v => onChange({ ...filter, value: v ?? '' })} />
        ) : (
          <TextInput size="xs" value={String(filter.value ?? '')} style={{ flex: 2 }}
            placeholder="value"
            onChange={e => onChange({ ...filter, value: e.target.value })} />
        )
      )}
      <ActionIcon size="xs" color="red" variant="subtle" onClick={onRemove}>
        <IconTrash size={12} />
      </ActionIcon>
    </Group>
  );
}

function WidgetConfigPanel({ config, onChange, fields, customFields, dark }: {
  config: WidgetConfig;
  onChange: (c: WidgetConfig) => void;
  fields: Record<string, { dimensions: FieldMeta[]; metrics: MetricMeta[] }> | undefined;
  customFields: { field_id: string; field_name: string; issue_count: number }[] | undefined;
  dark: boolean;
}) {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const qc = useQueryClient();
  const srcFields = fields?.[config.source];
  const baseDims = (srcFields?.dimensions ?? [])
    .filter(d => d.key !== 'label') // remove generic 'label' — replaced by the explicit entry below
    .map(d => ({ value: d.key, label: d.label }));

  const dimOptions = [
    ...baseDims,
    // Labels: individual values from jira_issue_label (issues source only)
    ...(config.source === 'issues' ? [{ value: 'label', label: '🏷️ Label (individual tag)' }] : []),
    // Custom fields from jira_issue_custom_field
    ...(config.source === 'issues' ? (customFields ?? []).map(f => {
      // Format raw field IDs into readable labels:
      // If field_name exists: use it. Otherwise humanize: customfield_10020 → "Custom Field 10020"
      const rawId    = f.field_id;
      const numPart  = rawId.replace('customfield_', '');
      const display  = f.field_name && f.field_name.trim()
        ? f.field_name
        : `Custom Field ${numPart}`;
      return { value: `cf_${rawId}`, label: `🔧 ${display} (${f.issue_count} issues)` };
    }) : []),
  ];
  // Guard: deduplicate by value (safety net)
  const seen = new Set<string>();
  const uniqueDimOptions = dimOptions.filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true; });
  // Deduplicate metrics too (safety net)
  const metricSeen = new Set<string>();
  const metricOptions = (srcFields?.metrics ?? [])
    .map(m => ({ value: m.key, label: m.label }))
    .filter(o => { if (metricSeen.has(o.value)) return false; metricSeen.add(o.value); return true; });

  const setField = (key: keyof WidgetConfig, val: unknown) => onChange({ ...config, [key]: val });

  return (
    <Stack gap="sm">
      {/* Source */}
      <Select label="Data Source" value={config.source} data={SOURCES}
        onChange={v => onChange({ ...config, source: v ?? 'issues', groupBy: undefined, metric: 'count' })} />

      {/* Metric */}
      <Select label="Measure (metric)" value={config.metric} data={metricOptions}
        searchable onChange={v => setField('metric', v ?? 'count')} />

      {/* Group By */}
      <Select label="Group by (dimension)" value={config.groupBy ?? null} data={uniqueDimOptions}
        searchable clearable placeholder="No grouping"
        onChange={v => setField('groupBy', v ?? undefined)} />

      {/* Group By 2 (for heatmap/stacked) */}
      <Select label="Second dimension (heatmap / stacked)" value={config.groupBy2 ?? null}
        data={uniqueDimOptions} searchable clearable placeholder="Optional"
        onChange={v => setField('groupBy2', v ?? undefined)} />

      {/* Date Range */}
      <Select label="Date range" value={config.dateRange?.preset ?? 'last_90d'}
        data={DATE_PRESETS}
        onChange={v => setField('dateRange', { preset: v ?? 'last_90d' })} />

      {/* Sort + Limit + Auto-Refresh */}
      <Group grow>
        <Select label="Sort by" value={config.sortBy} data={SORT_OPTIONS}
          onChange={v => setField('sortBy', v ?? 'metric_desc')} />
        <NumberInput label="Row limit" value={config.limit} min={1} max={500}
          onChange={v => setField('limit', Number(v ?? 20))} />
      </Group>
      <Select size="xs" label="🔄 Auto-refresh"
        value={String(config.refresh_interval_minutes ?? 0)}
        data={[
          { value: '0',  label: 'Off (manual refresh only)' },
          { value: '5',  label: 'Every 5 minutes' },
          { value: '15', label: 'Every 15 minutes' },
          { value: '30', label: 'Every 30 minutes' },
          { value: '60', label: 'Every hour' },
        ]}
        onChange={v => setField('refresh_interval_minutes', Number(v ?? 0))} />

      {/* Text block content — only shown for text widget types */}
      {(config.source === 'text_block' || config.source === 'section_header' ||
        config.source === undefined) && (
        <>
          <Divider label="Text Content" labelPosition="left" />
          <Textarea label="Content (use # for header)" rows={4}
            placeholder="# My Section&#10;Add notes, context, or a section title here..."
            value={config.text_content ?? ''}
            onChange={e => setField('text_content', e.target.value)} />
          <Group grow>
            <Select size="xs" label="Alignment" value={config.text_align ?? 'left'}
              data={[{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]}
              onChange={v => setField('text_align', v ?? 'left')} />
            <Select size="xs" label="Text size" value={config.text_size ?? 'sm'}
              data={[{value:'xs',label:'XS'},{value:'sm',label:'SM'},{value:'md',label:'MD'},{value:'lg',label:'LG'},{value:'xl',label:'XL'}]}
              onChange={v => setField('text_size', v ?? 'sm')} />
          </Group>
        </>
      )}

      {/* Thresholds — works on any widget, any metric */}
      <Divider label="Alert Thresholds" labelPosition="left" />
      <Text size="xs" c="dimmed">
        Set warning/critical levels on the metric value. Works on any widget — KPI cards show a colored border; dashboard banner alerts when breached.
      </Text>
      <Group grow>
        <NumberInput size="xs" label="⚠️ Warning"
          placeholder="e.g. 50"
          value={config.threshold_warning ?? ''}
          onChange={v => setField('threshold_warning', v === '' ? undefined : Number(v))} />
        <NumberInput size="xs" label="🔴 Critical"
          placeholder="e.g. 100"
          value={config.threshold_critical ?? ''}
          onChange={v => setField('threshold_critical', v === '' ? undefined : Number(v))} />
      </Group>
      <Select size="xs" label="Trigger direction"
        value={config.threshold_direction ?? 'above'}
        data={[
          { value: 'above', label: '↑ Alert when value ABOVE threshold (e.g. bugs > 50)' },
          { value: 'below', label: '↓ Alert when value BELOW threshold (e.g. velocity < 20)' },
        ]}
        onChange={v => setField('threshold_direction', v ?? 'above')} />
      <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
        Tip: Use filters to scope thresholds to a specific dimension — e.g. filter by project_key to alert per-project.
      </Text>

      {/* Custom field name sync — only shown when cf_ fields are unnamed */}
      {config.source === 'issues' && (customFields ?? []).some(f => !f.field_name?.trim()) && (
        <Group gap={6} align="center">
          <Text size="xs" c="dimmed" style={{ flex: 1 }}>
            Some custom fields show raw IDs — sync names from Jira to get readable labels.
          </Text>
          <Button size="xs" variant="light" color="teal"
            onClick={async () => {
              try {
                const r = await apiClient.post('/power-dashboard/fields/sync-names');
                notifications.show({ title: 'Field names synced', message: r.data.message, color: 'teal' });
                // Refresh custom fields
                qc.invalidateQueries({ queryKey: ['power-dashboard-custom-fields'] });
              } catch (e) {
                notifications.show({ title: 'Sync failed', message: 'Check Jira credentials', color: 'red' });
              }
            }}>
            🔄 Sync names from Jira
          </Button>
        </Group>
      )}

      {/* Column Display Names */}
      <Divider label="Column Labels (optional)" labelPosition="left" />
      <Group grow>
        <TextInput size="xs" label={`Dimension label${config.groupBy ? ` (${config.groupBy})` : ''}`}
          placeholder="e.g. Assignee"
          value={config.label_name ?? ''}
          onChange={e => setField('label_name', e.target.value || undefined)} />
        {config.groupBy2 && (
          <TextInput size="xs" label={`2nd dimension (${config.groupBy2})`}
            placeholder="e.g. Project"
            value={config.label2_name ?? ''}
            onChange={e => setField('label2_name', e.target.value || undefined)} />
        )}
      </Group>
      <TextInput size="xs" label={`Value label (${config.metric})`}
        placeholder="e.g. Issue Count, Hours, SP"
        value={config.value_name ?? ''}
        onChange={e => setField('value_name', e.target.value || undefined)} />

      {/* Filters */}
      <Box>
        <Group justify="space-between" mb={4} style={{ cursor: 'pointer' }}
          onClick={() => setFiltersOpen(o => !o)}>
          <Text size="sm" fw={600}>Filters ({config.filters.length})</Text>
          {filtersOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </Group>
        <Collapse in={filtersOpen}>
          <Stack gap={6}>
            {config.filters.map((f, i) => (
              <FilterRow key={i} filter={f} source={config.source} dimOptions={uniqueDimOptions}
                onChange={updated => {
                  const nf = [...config.filters];
                  nf[i] = updated;
                  setField('filters', nf);
                }}
                onRemove={() => setField('filters', config.filters.filter((_, j) => j !== i))} />
            ))}
            <Button size="xs" variant="light" leftSection={<IconPlus size={12} />}
              onClick={() => setField('filters', [...config.filters, { field: '', op: 'eq', value: '' }])}>
              Add filter
            </Button>
          </Stack>
        </Collapse>
      </Box>
    </Stack>
  );
}

// ── Widget Preview (live) ──────────────────────────────────────────────────────

const PREVIEW_H = 230;

function WidgetPreview({ widgetType, config, dark }: {
  widgetType: string; config: WidgetConfig; dark: boolean;
}) {
  const { data: qData, isLoading } = useWidgetData(config, true);
  const rows = qData?.data ?? [];
  const cols = qData?.columns ?? [];
  const isKpi = widgetType === 'kpi_card';

  return (
    <Card withBorder p="xs" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.02)' : '#fafafa' }}>
      <Text size="xs" c="dimmed" mb={6} fw={600}>LIVE PREVIEW</Text>
      <Box style={{ height: isKpi ? 110 : PREVIEW_H }}>
        {isLoading ? (
          <Stack align="center" justify="center" h="100%"><Loader size="sm" /></Stack>
        ) : widgetType === 'kpi_card' ? (
          <KpiCard data={rows} title="Preview" metric={config.metric} dark={dark} />
        ) : widgetType === 'bar' ? (
          <BarChartWidget data={rows} dark={dark} />
        ) : widgetType === 'stacked_bar' ? (
          <BarChartWidget data={rows} stacked dark={dark} />
        ) : widgetType === 'line' ? (
          <LineChartWidget data={rows} dark={dark} />
        ) : widgetType === 'area' ? (
          <LineChartWidget data={rows} area dark={dark} />
        ) : widgetType === 'pie' ? (
          <PieChartWidget data={rows} dark={dark} />
        ) : widgetType === 'table' ? (
          <TableWidget data={rows} columns={cols} dark={dark} />
        ) : widgetType === 'heatmap' ? (
          <HeatmapWidget data={rows} dark={dark} />
        ) : widgetType === 'leaderboard' ? (
          <LeaderboardWidget data={rows} dark={dark} />
        ) : widgetType === 'velocity' ? (
          <VelocityChart data={rows} dark={dark} />
        ) : widgetType === 'heatmap_h' ? (
          <HeatmapHWidget data={rows} dark={dark} />
        ) : widgetType === 'treemap' ? (
          <TreemapWidget data={rows} dark={dark} />
        ) : widgetType === 'funnel' ? (
          <FunnelWidget data={rows} dark={dark} />
        ) : widgetType === 'scatter' ? (
          <ScatterWidget data={rows} dark={dark} config={config} />
        ) : widgetType === 'waterfall' ? (
          <WaterfallWidget data={rows} dark={dark} />
        ) : widgetType === 'sprint_comparison' ? (
          <SprintComparisonWidget data={rows} dark={dark} />
        ) : widgetType === 'label_cloud' ? (
          <LabelCloudWidget data={rows} dark={dark} />
        ) : widgetType === 'cfd' ? (
          <CfdWidget data={rows} dark={dark} />
        ) : widgetType === 'control_chart' ? (
          <ControlChartWidget data={rows} dark={dark} />
        ) : widgetType === 'box_plot' ? (
          <BoxPlotWidget data={rows} dark={dark} />
        ) : widgetType === 'gantt' ? (
          <GanttWidget data={rows} dark={dark} />
        ) : widgetType === 'release_readiness' ? (
          <ReleaseReadinessWidget data={rows} dark={dark} />
        ) : widgetType === 'worklog_heatmap' ? (
          <WorklogHeatmapWidget data={rows} dark={dark} />
        ) : widgetType === 'worklog_trend' ? (
          <WorklogTrendWidget data={rows} dark={dark} />
        ) : <EmptyState />}
      </Box>
    </Card>
  );
}

// ── Add/Edit Widget Modal ─────────────────────────────────────────────────────

function WidgetModal({ opened, onClose, onSave, initial, fields, customFields, dark }: {
  opened: boolean; onClose: () => void;
  onSave: (title: string, type: string, config: WidgetConfig) => void;
  initial?: { title: string; type: string; config: WidgetConfig } | null;
  fields: Record<string, { dimensions: FieldMeta[]; metrics: MetricMeta[] }> | undefined;
  customFields: { field_id: string; field_name: string; issue_count: number }[] | undefined;
  dark: boolean;
}) {
  const [title,      setTitle]      = useState(initial?.title ?? 'New Widget');
  const [widgetType, setWidgetType] = useState(initial?.type ?? 'bar');
  const [config,     setConfig]     = useState<WidgetConfig>(initial?.config ?? { ...DEFAULT_CONFIG });

  useEffect(() => {
    if (opened) {
      setTitle(initial?.title ?? 'New Widget');
      setWidgetType(initial?.type ?? 'bar');
      setConfig(initial?.config ?? { ...DEFAULT_CONFIG });
    }
  }, [opened, initial]);

  return (
    <Modal
      opened={opened} onClose={onClose}
      title={<Text fw={700} size="lg">Configure Widget</Text>}
      size="90vw"
      styles={{
        body: { padding: 0 },
        content: { maxWidth: 1400, margin: '0 auto' },
        inner: { padding: '20px' },
      }}
    >
      <Box style={{ display: 'flex', height: 'calc(90vh - 80px)', overflow: 'hidden' }}>
        {/* LEFT — Config panel (fixed width, scrollable) */}
        <Box style={{
          width: 420, flexShrink: 0,
          borderRight: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`,
          display: 'flex', flexDirection: 'column',
        }}>
          <Box p="md" style={{ borderBottom: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}` }}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={8}>Widget Setup</Text>
            <Stack gap="xs">
              <TextInput label="Title" value={title} onChange={e => setTitle(e.target.value)} size="sm" />
              <Select size="sm" label="Chart type" value={widgetType}
                data={WIDGET_TYPES.map(t => ({ value: t.value, label: t.label }))}
                onChange={v => setWidgetType(v ?? 'bar')} />
            </Stack>
          </Box>
          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="sm">
              <Divider label="Data" labelPosition="left" />
              <WidgetConfigPanel config={config} onChange={setConfig}
                fields={fields} customFields={customFields} dark={dark} />
            </Stack>
          </ScrollArea>
          <Box p="md" style={{ borderTop: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}` }}>
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" leftSection={<IconDeviceFloppy size={15} />}
                onClick={() => { onSave(title, widgetType, config); onClose(); }}>
                Save Widget
              </Button>
            </Group>
          </Box>
        </Box>

        {/* RIGHT — Live preview (fills remaining space) */}
        <Box style={{ flex: 1, padding: '20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">Live Preview</Text>
          <WidgetPreview widgetType={widgetType} config={config} dark={dark} />
          <Box style={{
            flex: 1,
            backgroundColor: dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.015)',
            borderRadius: 8, border: `1px dashed ${dark ? '#333' : '#ddd'}`,
            padding: 12, minHeight: 120,
          }}>
            <Text size="xs" c="dimmed" fw={600} mb={6}>QUERY CONFIGURATION</Text>
            <Text size="xs" c="dimmed" ff="monospace" style={{ lineBreak: 'anywhere' }}>
              Source: <b>{config.source}</b> · Metric: <b>{config.metric}</b>
              {config.groupBy ? ` · Group by: ${config.groupBy}` : ''}
              {config.groupBy2 ? ` × ${config.groupBy2}` : ''}
              {config.filters.length > 0 ? ` · ${config.filters.length} filter(s)` : ''}
              {' · '}{config.dateRange?.preset ?? 'custom date range'}
              {' · '} Limit: {config.limit} · Sort: {config.sortBy}
            </Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────────────────

// ── Global Filter Bar ─────────────────────────────────────────────────────────

function GlobalFilterBar({ dashboardId, filters, onChange, dark }: {
  dashboardId: number; filters: GlobalFilters;
  onChange: (f: GlobalFilters) => void; dark: boolean;
}) {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery<string[]>({
    queryKey: ['power-field-values', 'project_key', 'issues'],
    queryFn: () => apiClient.get('/power-dashboard/fields/values?field=project_key&source=issues').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const save = useCallback(async (next: GlobalFilters) => {
    onChange(next);
    try {
      await apiClient.put(`/power-dashboard/dashboards/${dashboardId}/global-filters`, next);
      qc.invalidateQueries({ queryKey: ['power-widget-data'] });
    } catch { /* silent */ }
  }, [dashboardId, onChange, qc]);

  return (
    <Box style={{
      padding: '10px 16px',
      borderRadius: 10,
      background: dark ? 'rgba(78,205,196,0.05)' : 'rgba(28,126,214,0.04)',
      border: `1px solid ${dark ? '#4ECDC440' : '#1971c220'}`,
      marginBottom: 8,
    }}>
      <Group gap={12} wrap="wrap" align="flex-end">
        <Group gap={6} align="center">
          <Text size="xs">🌐</Text>
          <Text size="xs" fw={700} c={dark ? 'teal' : 'blue'} style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Dashboard Filters
          </Text>
        </Group>
        <Select size="xs" placeholder="All dates" clearable
          value={filters.date_preset ?? null}
          data={DATE_PRESETS}
          style={{ width: 140 }}
          onChange={v => save({ ...filters, date_preset: v ?? undefined })} />
        <Select size="xs" placeholder="All projects" clearable searchable
          value={filters.project_key ?? null}
          data={projects.map(p => ({ value: p, label: p }))}
          style={{ width: 130 }}
          onChange={v => save({ ...filters, project_key: v ?? undefined })} />
        <TextInput size="xs" placeholder="Filter by assignee..."
          value={filters.assignee ?? ''}
          style={{ width: 160 }}
          onChange={e => onChange({ ...filters, assignee: e.target.value || undefined })}
          onBlur={() => save(filters)} />
        {(filters.date_preset || filters.project_key || filters.assignee) && (
          <Button size="xs" variant="subtle" color="red"
            onClick={() => save({})}>
            Clear all
          </Button>
        )}
        {(filters.date_preset || filters.project_key || filters.assignee) && (
          <Badge size="sm" variant="filled" color="teal">
            {[filters.date_preset, filters.project_key, filters.assignee].filter(Boolean).length} active
          </Badge>
        )}
        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          Applies to all widgets
        </Text>
      </Group>
    </Box>
  );
}

// ── Drill-Through Drawer ──────────────────────────────────────────────────────

function DrillDrawer({ drill, isOpen, dark, onClose }: {
  drill: DrillFilter | null; isOpen: boolean; dark: boolean; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  // Keep last drill value while drawer is closing (avoid empty flash)
  const activeDrill = drill;
  const { data, isLoading } = useQuery<{ data: Record<string, unknown>[]; count: number }>({
    queryKey: ['drill-issues', activeDrill?.field, activeDrill?.value,
               JSON.stringify(activeDrill?.widgetFilters), activeDrill?.widgetDateRange?.preset],
    queryFn: () => apiClient.post('/power-dashboard/drill-issues', {
      drillField:    activeDrill?.field ?? '',
      drillValue:    activeDrill?.value ?? '',
      widgetFilters: activeDrill?.widgetFilters ?? [],
      dateRange:     activeDrill?.widgetDateRange ?? { preset: 'last_2y' },
      days: 730,
      limit: 200,
    }).then(r => r.data),
    enabled: !!activeDrill && isOpen,
  });

  const rows = data?.data ?? [];
  const filtered = search
    ? rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : rows;

  const exportCSV = () => {
    if (!filtered.length) return;
    const cols = Object.keys(filtered[0]);
    const csv  = [cols.join(','), ...filtered.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a    = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'drill-issues.csv'; a.click();
  };

  const COLS = ['issue_key','summary','status_name','priority_name','assignee_display_name','story_points','age_days'];

  return (
    <Drawer opened={isOpen} onClose={onClose} position="right" size="xl"
      title={
        <Group gap={8}>
          <Text fw={700}>🔍 Drill-Through</Text>
          {activeDrill && <Badge size="sm" variant="light" color="teal">{activeDrill.label}</Badge>}
          {data && <Badge size="sm" color="blue">{data.count} issues</Badge>}
        </Group>
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' } }}>
      <Box p="sm" style={{ borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}>
        <Group gap={8}>
          <TextInput size="sm" placeholder="Search issues..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <Tooltip label="Export CSV">
            <ActionIcon size="sm" variant="light" onClick={exportCSV}><IconDownload size={14} /></ActionIcon>
          </Tooltip>
          <Text size="xs" c="dimmed">{isLoading ? '...' : `${filtered.length} issues`}</Text>
        </Group>
        <Group gap={4} mt={4} wrap="wrap">
          {activeDrill?.field !== '__all__' && activeDrill?.field && (
            <Badge size="xs" variant="light" color="teal">
              🔍 {activeDrill.field.replace(/_/g,' ')} = {activeDrill.value}
            </Badge>
          )}
          {(activeDrill?.widgetFilters ?? []).map((f, i) => (
            <Badge key={i} size="xs" variant="dot" color="gray">
              {f.field.replace(/_/g,' ')} {f.op} {Array.isArray(f.value) ? f.value.join(',') : f.value}
            </Badge>
          ))}
          {activeDrill?.widgetDateRange?.preset && (
            <Badge size="xs" variant="dot" color="blue">{activeDrill.widgetDateRange.preset}</Badge>
          )}
        </Group>
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        {isLoading ? (
          <Stack align="center" py="xl"><Loader /></Stack>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: dark ? '#1a1a2e' : '#f8f9fa', position: 'sticky', top: 0 }}>
                {['Key','Summary','Status','Priority','Assignee','SP','Age'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                    color: dark ? AQUA_HEX : DEEP_BLUE_HEX, fontSize: 11, whiteSpace: 'nowrap',
                    borderBottom: `2px solid ${dark ? '#333' : '#e0e0e0'}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f5f5f5'}`,
                  backgroundColor: i % 2 === 0 ? undefined : (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') }}>
                  {COLS.map(c => (
                    <td key={c} style={{ padding: '6px 10px', maxWidth: c === 'summary' ? 240 : undefined,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: c === 'issue_key' ? 600 : undefined,
                      color: c === 'issue_key' ? (dark ? AQUA_HEX : DEEP_BLUE_HEX) : undefined }}
                      title={String(row[c] ?? '')}>
                      {fmtValue(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </Drawer>
  );
}

// ── Custom Metrics Panel ──────────────────────────────────────────────────────

const METRIC_OPTIONS = Object.entries({
  count: 'Count of Issues', count_done: 'Count Done', count_open: 'Count Open',
  sum_sp: 'Sum Story Points', avg_sp: 'Avg Story Points', velocity_sp: 'Velocity SP',
  avg_lead_time_days: 'Avg Lead Time', avg_cycle_time_days: 'Avg Cycle Time',
  sum_hours_logged: 'Sum Hours Logged', completion_rate_pct: 'Completion Rate %',
}).map(([k, v]) => ({ value: k, label: v }));

function CustomMetricsPanel({ dashboardId, dark }: { dashboardId: number; dark: boolean }) {
  const qc = useQueryClient();
  const { data: metrics = [] } = useQuery<CustomMetric[]>({
    queryKey: ['custom-metrics', dashboardId],
    queryFn: () => apiClient.get(`/power-dashboard/dashboards/${dashboardId}/custom-metrics`).then(r => r.data),
  });

  const [editing, setEditing] = useState<CustomMetric | null>(null);
  const [showForm, setShowForm] = useState(false);

  const save = useMutation({
    mutationFn: (list: CustomMetric[]) =>
      apiClient.put(`/power-dashboard/dashboards/${dashboardId}/custom-metrics`, list),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-metrics', dashboardId] });
      setShowForm(false); setEditing(null);
      notifications.show({ title: 'Metrics saved', message: '', color: 'teal' });
    },
  });

  const handleSave = (m: CustomMetric) => {
    const next = editing
      ? metrics.map(x => x.id === m.id ? m : x)
      : [...metrics, { ...m, id: Date.now().toString() }];
    save.mutate(next);
  };
  const handleDelete = (id: string) => save.mutate(metrics.filter(m => m.id !== id));

  return (
    <Box p="md">
      {/* Header row */}
      <Group justify="space-between" align="center" mb="xs">
        <Box>
          <Text fw={700} size="md">Custom Metrics</Text>
          <Text size="xs" c="dimmed" mt={2}>
            Define ratio / % / delta metrics reusable in any widget
          </Text>
        </Box>
        <Button size="sm" leftSection={<IconPlus size={14} />}
          onClick={() => { setEditing(null); setShowForm(true); }}>
          New Metric
        </Button>
      </Group>

      <Divider mb="sm" />

      {metrics.length === 0 ? (
        <Box py="xl" style={{ textAlign: 'center' }}>
          <Text size="2rem" mb={8}>🔢</Text>
          <Text size="sm" c="dimmed" fw={500}>No custom metrics yet</Text>
          <Text size="xs" c="dimmed" mt={4}>
            Create a metric like "Bug Rate = Bugs ÷ Stories × 100%"
          </Text>
          <Button mt="md" size="sm" variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => { setEditing(null); setShowForm(true); }}>
            Create first metric
          </Button>
        </Box>
      ) : (
        <Stack gap="sm">
          {metrics.map(m => (
            <Group key={m.id} gap={10} p="sm" style={{
              borderRadius: 8,
              background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
            }}>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600} style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {m.name}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {m.metric_a} {m.formula_type === 'ratio' ? '÷' : m.formula_type === 'subtract' ? '−' : '÷'} {m.metric_b}
                  {m.unit ? <Badge size="xs" variant="light" ml={4}>{m.unit}</Badge> : null}
                </Text>
              </Box>
              <Badge size="sm" variant="light" color={
                m.formula_type === 'ratio' ? 'blue' :
                m.formula_type === 'pct'   ? 'teal' :
                m.formula_type === 'subtract' ? 'orange' : 'gray'
              }>{m.formula_type}</Badge>
              <Group gap={4}>
                <Tooltip label="Edit"><ActionIcon size="sm" variant="subtle"
                  onClick={() => { setEditing(m); setShowForm(true); }}><IconEdit size={14} /></ActionIcon></Tooltip>
                <Tooltip label="Delete"><ActionIcon size="sm" variant="subtle" color="red"
                  onClick={() => handleDelete(m.id)}><IconTrash size={14} /></ActionIcon></Tooltip>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      <Modal opened={showForm} onClose={() => { setShowForm(false); setEditing(null); }}
        title={<Text fw={700}>{editing ? '✏️ Edit Metric' : '➕ New Custom Metric'}</Text>} size="sm">
        <Box p="xs">
          <CustomMetricForm initial={editing} onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }} />
        </Box>
      </Modal>
    </Box>
  );
}

function CustomMetricForm({ initial, onSave, onCancel }: {
  initial: CustomMetric | null;
  onSave: (m: CustomMetric) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState<CustomMetric>(initial ?? {
    id: '', name: '', formula_type: 'pct', metric_a: 'count', metric_b: 'count_done', unit: '%',
  });
  return (
    <Stack gap="md" p="xs">
      <TextInput label="Metric name" description="A clear label like 'Bug Rate' or 'Done %'"
        placeholder="e.g. Bug Rate" value={m.name}
        onChange={e => setM({...m, name: e.target.value})} required />

      <Select label="Formula type" description="How A and B are combined"
        data={[
          { value: 'pct',      label: '% Percentage — A / B × 100' },
          { value: 'ratio',    label: '÷ Ratio — A ÷ B' },
          { value: 'subtract', label: '− Delta — A − B' },
        ]}
        value={m.formula_type}
        onChange={v => setM({...m, formula_type: v as CustomMetric['formula_type']})} />

      <Box style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '10px 12px' }}>
        <Text size="xs" fw={600} c="dimmed" mb={8}>FORMULA INPUTS</Text>
        <Group grow gap={8}>
          <Select label="Metric A" description="Numerator" data={METRIC_OPTIONS} searchable
            value={m.metric_a} onChange={v => setM({...m, metric_a: v ?? 'count'})} />
          <Select label="Metric B" description="Denominator" data={METRIC_OPTIONS} searchable
            value={m.metric_b} onChange={v => setM({...m, metric_b: v ?? 'count_done'})} />
        </Group>
        <Text size="xs" c="dimmed" mt={8} ta="center">
          Result = {m.metric_a} {m.formula_type === 'pct' ? '/ ' + m.metric_b + ' × 100' : m.formula_type === 'ratio' ? '÷ ' + m.metric_b : '− ' + m.metric_b}
        </Text>
      </Box>

      <TextInput label="Unit label" description="Shown after the value in widgets"
        placeholder="% or hrs or ratio"
        value={m.unit ?? ''} onChange={e => setM({...m, unit: e.target.value})} />

      <Group justify="flex-end" pt={4}>
        <Button variant="subtle" onClick={onCancel}>Cancel</Button>
        <Button disabled={!m.name.trim()} leftSection={<IconDeviceFloppy size={15} />}
          onClick={() => onSave(m)}>
          Save Metric
        </Button>
      </Group>
    </Stack>
  );
}

// ── Template Gallery ──────────────────────────────────────────────────────────

function TemplateGallery({ dark, onCreated }: { dark: boolean; onCreated: (id: number, name: string) => void }) {
  const { data: templates = [], isLoading } = useTemplates();
  const qc = useQueryClient();
  const [creating, setCreating] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: (templateId: number) =>
      apiClient.post(`/power-dashboard/templates/${templateId}/create`, { name: templates.find(t => t.id === templateId)?.name }),
    onSuccess: (res, templateId) => {
      qc.invalidateQueries({ queryKey: ['power-dashboards'] });
      onCreated(res.data.id, res.data.name);
      notifications.show({ title: 'Dashboard created!', message: `${res.data.name} — ${res.data.widget_count} widgets ready`, color: 'teal' });
    },
    onSettled: () => setCreating(null),
  });

  if (isLoading) return <Stack align="center" py="xl"><Loader size="sm" /></Stack>;

  return (
    <Box>
      <Text size="xs" c="dimmed" mb={12}>Start from a pre-built template — all widgets are pre-configured and ready to use.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {templates.map(t => (
          <Card key={t.id} p="md" withBorder style={{
            cursor: 'pointer',
            backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#fafafa',
            border: `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
            <Stack gap={6}>
              <Group justify="space-between">
                <Group gap={8}>
                  <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                  <Text fw={700} size="sm">{t.name}</Text>
                </Group>
                <Badge size="xs" variant="light">{t.category}</Badge>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2}>{t.description}</Text>
              <Group justify="space-between" align="center" mt={4}>
                <Badge size="xs" variant="dot" color="teal">{t.widget_count} widgets</Badge>
                <Button size="xs" loading={creating === t.id}
                  onClick={() => { setCreating(t.id); create.mutate(t.id); }}>
                  Use Template
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function DashboardView({ dashboard, dark, onBack }: {
  dashboard: Dashboard; dark: boolean; onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data: full, isLoading } = useDashboard(dashboard.id);
  const { data: fields } = useFields();
  const { data: customFields } = useCustomFields();
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drill, setDrill] = useState<DrillFilter | null>(null);
  const [drillDrawerOpen, setDrillDrawerOpen] = useState(false);
  const { data: alerts = [] } = useAlerts(dashboard.id);
  const [showMetrics, setShowMetrics] = useState(false);

  // Global filters — load from dashboard, persist changes
  const initGf = React.useMemo(() => {
    const raw = full?.global_filters;
    if (!raw) return {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw as GlobalFilters;
  }, [full?.global_filters]);
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>(initGf);
  useEffect(() => { setGlobalFilters(initGf); }, [JSON.stringify(initGf)]);

  // Measure container width for the grid
  useEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setGridWidth(w);
    });
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [full]);

  const widgets = full?.widgets ?? [];

  const addWidget = useMutation({
    mutationFn: (payload: { title: string; widget_type: string; config: WidgetConfig }) =>
      apiClient.post(`/power-dashboard/dashboards/${dashboard.id}/widgets`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] });
      notifications.show({ title: 'Widget added', message: '', color: 'green' });
    },
  });

  const updateWidget = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: unknown }) =>
      apiClient.put(`/power-dashboard/dashboards/${dashboard.id}/widgets/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] }),
  });

  const deleteWidget = useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/power-dashboard/dashboards/${dashboard.id}/widgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] });
      notifications.show({ title: 'Widget removed', message: '', color: 'orange' });
    },
  });

  const handleSaveWidget = (title: string, type: string, config: WidgetConfig) => {
    if (editingWidget) {
      updateWidget.mutate({ id: editingWidget.id, payload: { title, widget_type: type, config } });
    } else {
      addWidget.mutate({ title, widget_type: type, config });
    }
    setEditingWidget(null);
  };

  const handleDuplicate = (w: Widget) => {
    const cfg = parseConfig(w.config);
    addWidget.mutate({ title: w.title + ' (copy)', widget_type: w.widget_type, config: cfg });
  };

  const [saving, setSaving] = useState(false);

  // Build RGL layout from widget positions
  const rglLayout: Layout[] = widgets.map(w => {
    const pos = parsePosition(w.position);
    return {
      i: String(w.id),
      x: pos.x ?? 0,
      y: pos.y ?? 0,
      w: pos.w ?? 6,
      h: pos.h ?? 4,
      minW: 2,
      minH: 2,
    };
  });

  // Save a single widget's new position — called on drag stop OR resize stop only
  const savePosition = useCallback((item: Layout) => {
    const wid = parseInt(item.i);
    const widget = widgets.find(w => w.id === wid);
    if (!widget) return;
    const prev = parsePosition(widget.position);
    // Skip if nothing changed
    if (prev.x === item.x && prev.y === item.y && prev.w === item.w && prev.h === item.h) return;
    setSaving(true);
    updateWidget.mutate(
      { id: wid, payload: { position: { x: item.x, y: item.y, w: item.w, h: item.h } } },
      { onSettled: () => setSaving(false) }
    );
  }, [widgets, updateWidget]);

  // onDragStop / onResizeStop: fires ONCE when user releases — not during drag
  const handleDragStop = useCallback((_l: Layout[], _o: Layout, n: Layout) => savePosition(n), [savePosition]);
  const handleResizeStop = useCallback((_l: Layout[], _o: Layout, n: Layout) => savePosition(n), [savePosition]);

  // Drill-through: set drill filter AND open the drawer
  const handleDrillWithDrawer = useCallback((field: string, value: string) => {
    setDrill({ field, value, label: `${field.replace(/_/g,' ')} = "${value}"` });
    setDrillDrawerOpen(true);
  }, []);

  // Manual reposition from the Layout popover
  const handleReposition = useCallback((widgetId: number, pos: { x: number; y: number; w: number; h: number }) => {
    setSaving(true);
    updateWidget.mutate(
      { id: widgetId, payload: { position: pos } },
      { onSettled: () => setSaving(false) }
    );
  }, [updateWidget]);

  // Row height: each RGL unit = 80px
  const ROW_H = 80;

  return (
    <GlobalFilterContext.Provider value={{ globalFilters, setGlobalFilters }}>
    <DrillContext.Provider value={{ drill, setDrill, openDrawer: () => setDrillDrawerOpen(true) }}>
    {/* Drill-through drawer */}
    <DrillDrawer drill={drill} isOpen={drillDrawerOpen} dark={dark}
      onClose={() => { setDrillDrawerOpen(false); }} />
    <Stack gap="md">
      {/* Alert banner */}
      {alerts.length > 0 && (
        <Box style={{
          padding: '8px 14px', borderRadius: 8,
          backgroundColor: alerts.some(a => a.status === 'critical') ? 'rgba(231,76,60,0.12)' : 'rgba(243,156,18,0.12)',
          border: `1px solid ${alerts.some(a => a.status === 'critical') ? '#e74c3c' : '#f39c12'}`,
        }}>
          <Group gap={8} wrap="wrap">
            <Text size="sm" fw={700} c={alerts.some(a => a.status === 'critical') ? 'red' : 'yellow'}>
              {alerts.some(a => a.status === 'critical') ? '🔴' : '🟡'} {alerts.length} threshold alert{alerts.length > 1 ? 's' : ''}
            </Text>
            {alerts.map(a => (
              <Badge key={a.widget_id} size="sm" color={a.status === 'critical' ? 'red' : 'yellow'} variant="light">
                {a.title}: {a.value} {a.status === 'critical' ? '> critical' : '> warning'}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* Drill-through banner */}
      {drill && (
        <Group gap={8} style={{
          padding: '6px 12px', borderRadius: 8,
          backgroundColor: dark ? 'rgba(78,205,196,0.1)' : 'rgba(30,100,170,0.08)',
          border: `1px solid ${dark ? '#4ECDC4' : '#1c7ed6'}`,
        }}>
          <Text size="sm" fw={600} c={dark ? 'teal' : 'blue'}>🔍 Drill-through:</Text>
          <Badge size="sm" variant="light" color={dark ? 'teal' : 'blue'}>{drill.label}</Badge>
          <Text size="xs" c="dimmed">— all widgets filtered by this value</Text>
          <ActionIcon size="xs" variant="subtle" ml="auto" onClick={() => setDrill(null)}>
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      )}

      {/* Global Filter Bar */}
      <GlobalFilterBar dashboardId={dashboard.id} filters={globalFilters}
        onChange={setGlobalFilters} dark={dark} />

      {/* Custom Metrics Modal */}
      <Modal opened={showMetrics} onClose={() => setShowMetrics(false)}
        title="⚙️ Custom Metrics" size="md">
        <CustomMetricsPanel dashboardId={dashboard.id} dark={dark} />
      </Modal>

      {/* Toolbar */}
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={onBack}><IconArrowLeft size={18} /></ActionIcon>
          <div>
            <Title order={3} c={dark ? AQUA : DEEP_BLUE}>{dashboard.name}</Title>
            {dashboard.description && <Text size="sm" c="dimmed">{dashboard.description}</Text>}
          </div>
        </Group>
        <Group gap="sm">
          <Group gap={6}>
            <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
              ✥ Drag header to move &nbsp;·&nbsp; ↔ Pull corner to resize
            </Text>
            {saving && (
              <Group gap={4}>
                <Loader size={12} />
                <Text size="xs" c="dimmed">Saving…</Text>
              </Group>
            )}
          </Group>
          <Tooltip label="Export dashboard as PNG">
            <Button size="sm" variant="light" leftSection={<IconDownload size={15} />}
              onClick={() => {
                const el = gridRef.current;
                if (!el) return;
                import('html2canvas').then(({ default: html2canvas }) => {
                  html2canvas(el, { backgroundColor: dark ? '#1a1a2e' : '#f5f7fa', scale: 2 }).then(canvas => {
                    const a = document.createElement('a');
                    a.href = canvas.toDataURL('image/png');
                    a.download = `${dashboard.name.replace(/\s+/g, '-')}.png`;
                    a.click();
                  });
                }).catch(() => {
                  // html2canvas not installed — use window.print fallback
                  window.print();
                });
              }}>
              Export PNG
            </Button>
          </Tooltip>
          <Button size="sm" variant="light" leftSection={<IconRefresh size={15} />}
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] });
              qc.invalidateQueries({ queryKey: ['power-widget-data'] });
            }}>
            Refresh
          </Button>
          <SyncJiraButton />
          <Button size="sm" variant="light" color="grape"
            leftSection={<IconSettings size={15} />}
            onClick={() => setShowMetrics(true)}>
            Metrics
          </Button>
          <Button size="sm" leftSection={<IconPlus size={15} />}
            onClick={() => { setEditingWidget(null); setWidgetModalOpen(true); }}>
            Add Widget
          </Button>
        </Group>
      </Group>

      {/* Widget Grid — drag-and-drop + resizable */}
      {isLoading ? (
        <Stack align="center" py="xl"><Loader /></Stack>
      ) : widgets.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconChartBar size={48} opacity={0.3} />
            <Text size="lg" fw={600} c="dimmed">No widgets yet</Text>
            <Text size="sm" c="dimmed" ta="center">
              Add your first widget to start building your power dashboard.
              Drag to reposition, pull the corner handle to resize.
            </Text>
            <Button leftSection={<IconPlus size={16} />}
              onClick={() => { setEditingWidget(null); setWidgetModalOpen(true); }}>
              Add your first widget
            </Button>
          </Stack>
        </Card>
      ) : (
        <Box ref={gridRef} style={{ position: 'relative' }}>
          {/* Global styles for RGL drag/resize handles */}
          <style>{`
            .react-resizable-handle {
              width: 20px !important;
              height: 20px !important;
              background: none !important;
              border-right: 3px solid ${dark ? '#4ECDC4' : '#1c7ed6'} !important;
              border-bottom: 3px solid ${dark ? '#4ECDC4' : '#1c7ed6'} !important;
              border-radius: 0 0 4px 0 !important;
              opacity: 0.4;
              transition: opacity 0.2s;
              bottom: 4px !important;
              right: 4px !important;
              cursor: se-resize !important;
            }
            .react-resizable-handle:hover { opacity: 1 !important; }
            .react-grid-item.react-grid-placeholder {
              background: ${dark ? 'rgba(78,205,196,0.15)' : 'rgba(28,126,214,0.12)'} !important;
              border: 2px dashed ${dark ? '#4ECDC4' : '#1c7ed6'} !important;
              border-radius: 8px !important;
              opacity: 1 !important;
            }
            .react-grid-item > .react-resizable-handle::after { display: none; }
            .widget-drag-handle:active { cursor: grabbing !important; }
          `}</style>
          <ReactGridLayout
            layout={rglLayout}
            cols={12}
            rowHeight={ROW_H}
            width={gridWidth}
            margin={[10, 10]}
            containerPadding={[0, 0]}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            draggableHandle=".widget-drag-handle"
            isResizable={true}
            isDraggable={true}
            resizeHandles={['se', 's', 'e']}
            style={{ minHeight: 200 }}
          >
            {widgets.map(w => (
              <div key={String(w.id)} style={{ overflow: 'hidden' }}>
                <WidgetCard widget={w} dark={dark}
                  onEdit={() => { setEditingWidget(w); setWidgetModalOpen(true); }}
                  onDelete={() => deleteWidget.mutate(w.id)}
                  onDuplicate={() => handleDuplicate(w)}
                  onReposition={(pos) => handleReposition(w.id, pos)} />
              </div>
            ))}
          </ReactGridLayout>
        </Box>
      )}

      {/* Widget modal */}
      <WidgetModal
        opened={widgetModalOpen}
        onClose={() => { setWidgetModalOpen(false); setEditingWidget(null); }}
        onSave={handleSaveWidget}
        initial={editingWidget ? {
          title: editingWidget.title,
          type: editingWidget.widget_type,
          config: parseConfig(editingWidget.config),
        } : null}
        fields={fields} customFields={customFields} dark={dark}
      />
    </Stack>
    </DrillContext.Provider>
    </GlobalFilterContext.Provider>
  );
}

// ── Dashboard List (home screen) ──────────────────────────────────────────────

function DashboardList({ dark, onOpen }: {
  dark: boolean; onOpen: (d: Dashboard) => void;
}) {
  const qc = useQueryClient();
  const { data: dashboards = [], isLoading } = useDashboards();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const createDashboard = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      apiClient.post('/power-dashboard/dashboards', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['power-dashboards'] });
      notifications.show({ title: 'Dashboard created', message: res.data.name, color: 'green' });
      setCreateOpen(false); setNewName(''); setNewDesc('');
    },
  });

  const deleteDashboard = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/power-dashboard/dashboards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['power-dashboards'] }),
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c={dark ? AQUA : DEEP_BLUE} fw={700}>Power Dashboard</Title>
          <Text size="sm" c="dimmed">
            Build any report — any field, any metric, any filter. No restrictions.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          New Dashboard
        </Button>
      </Group>

      {/* Tabs: My Dashboards | Templates */}
      <Tabs defaultValue="dashboards">
        <Tabs.List>
          <Tabs.Tab value="dashboards">My Dashboards ({dashboards.length})</Tabs.Tab>
          <Tabs.Tab value="templates">📋 Templates</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="templates" pt="md">
          <TemplateGallery dark={dark} onCreated={(id, name) => {
            const d = { id, name, is_public: false } as Dashboard;
            onOpen(d);
          }} />
        </Tabs.Panel>
        <Tabs.Panel value="dashboards" pt="md">

      {isLoading ? (
        <Stack align="center" py="xl"><Loader /></Stack>
      ) : dashboards.length === 0 ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconLayoutGrid size={48} opacity={0.3} />
            <Text size="lg" fw={600} c="dimmed">No dashboards yet</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Create your first Power Dashboard. Query across issues, worklogs, sprints,
              and transitions with any combination of filters and dimensions.
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
              Create your first dashboard
            </Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {dashboards.map(d => (
            <Card key={d.id} p={0} style={{
              cursor: 'pointer',
              backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#fff',
              border: `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
              borderRadius: 12,
              boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = dark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'; }}
              onClick={() => onOpen(d)}>
              {/* Top accent */}
              <Box style={{ height: 4, background: `linear-gradient(90deg, ${AQUA}, ${DEEP_BLUE})`, borderRadius: '12px 12px 0 0' }} />
              <Box p="md">
                <Group justify="space-between" wrap="nowrap" mb={8}>
                  <Text fw={700} size="md" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, letterSpacing: '-0.02em' }}>
                    {d.name}
                  </Text>
                  <ActionIcon size="sm" variant="subtle" color="red"
                    onClick={e => { e.stopPropagation(); deleteDashboard.mutate(d.id); }}>
                    <IconTrash size={13} />
                  </ActionIcon>
                </Group>
                {d.description
                  ? <Text size="xs" c="dimmed" lineClamp={2} mb={10}>{d.description}</Text>
                  : <Text size="xs" c="dimmed" fs="italic" mb={10}>No description</Text>}
                <Group gap={6} justify="space-between">
                  <Group gap={4}>
                    <Badge size="sm" variant="filled" color="blue" radius="sm">
                      {d.widget_count ?? 0} widgets
                    </Badge>
                    {d.created_by && <Badge size="sm" variant="light" color="gray" radius="sm">{d.created_by}</Badge>}
                  </Group>
                  {d.tags && (
                    <Group gap={4}>
                      {d.tags.split(',').slice(0, 2).map(t => (
                        <Badge key={t} size="xs" variant="dot" color="teal">{t.trim()}</Badge>
                      ))}
                    </Group>
                  )}
                </Group>
              </Box>
            </Card>
          ))}
        </SimpleGrid>
      )}
      </Tabs.Panel>
      </Tabs>

      {/* Create dashboard modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Dashboard" size="sm">
        <Stack gap="sm">
          <TextInput label="Name" placeholder="My Dashboard" value={newName}
            onChange={e => setNewName(e.target.value)} required />
          <Textarea label="Description (optional)" placeholder="What this dashboard tracks..."
            value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!newName.trim()} loading={createDashboard.isPending}
              onClick={() => createDashboard.mutate({ name: newName.trim(), description: newDesc })}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PowerDashboardPage() {
  const dark = useDarkMode();
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);

  return (
    <Container size="xl" py="md">
      <Stack className="page-enter stagger-children">
        {activeDashboard ? (
          <DashboardView
            dashboard={activeDashboard}
            dark={dark}
            onBack={() => setActiveDashboard(null)}
          />
        ) : (
          <DashboardList dark={dark} onOpen={setActiveDashboard} />
        )}
      </Stack>
    </Container>
  );
}
