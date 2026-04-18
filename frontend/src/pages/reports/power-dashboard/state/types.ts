// ── Types ─────────────────────────────────────────────────────────────────────

export interface WidgetFilter {
  field: string;
  op: string;
  value?: string | string[];
}

export interface WidgetConfig {
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

export interface Widget {
  id: number;
  dashboard_id: number;
  title: string;
  widget_type: string;
  config: WidgetConfig | string;
  position: { x: number; y: number; w: number; h: number } | string;
  sort_order: number;
}

export interface GlobalFilters {
  date_preset?: string;
  project_key?: string;
  assignee?: string;
  sprint_name?: string;
}

export interface CustomMetric {
  id: string;
  name: string;
  formula_type: 'ratio' | 'pct' | 'delta' | 'subtract';
  metric_a: string;   // numerator / primary
  metric_b: string;   // denominator / comparison
  multiplier?: number;
  unit?: string;
}

export interface Dashboard {
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

export interface FieldMeta {
  key: string;
  label: string;
  type: string;
}

export interface MetricMeta {
  key: string;
  label: string;
}

export interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface Alert {
  widget_id: number;
  title: string;
  value: number;
  threshold_warning?: number;
  threshold_critical?: number;
  direction: string;
  status: 'warning' | 'critical';
}

export interface Template {
  id: number;
  name: string;
  description: string;
  category: string;
  icon: string;
  widget_count: number;
}

export interface DrillFilter {
  field: string;
  value: string;
  label: string;
  // Widget's own filters — applied alongside the drill dimension
  widgetFilters?: WidgetFilter[];
  widgetDateRange?: { preset?: string; from?: string; to?: string };
}

export interface DrillCtx {
  drill: DrillFilter | null;
  setDrill: (d: DrillFilter | null) => void;
  openDrawer: () => void;   // directly opens the drawer — no useEffect timing issues
}

export interface GlobalFilterCtx {
  globalFilters: GlobalFilters;
  setGlobalFilters: (f: GlobalFilters) => void;
}
