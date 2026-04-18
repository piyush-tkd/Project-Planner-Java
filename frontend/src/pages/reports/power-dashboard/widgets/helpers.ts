import { useEffect, useState } from 'react';
import { WidgetConfig } from '../state/types';
import { CHART_COLORS_DARK, CHART_COLORS_LIGHT, DEFAULT_CONFIG, WIDGET_CATEGORY_COLOR } from './constants';
import { AQUA_HEX, DEEP_BLUE_HEX } from '../../../../brandTokens';

// Chart-safe colors (never CSS variables — SVG can't use them)
const CHART_PRIMARY = (dark: boolean) => dark ? AQUA_HEX : DEEP_BLUE_HEX;
const CHART_ACCENT  = (_dark: boolean) => AQUA_HEX;

/** Returns the correct chart color for light or dark mode at a given series index */
const chartColor = (dark: boolean, i: number) =>
  (dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT)[i % (dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT).length];

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

function generateInsights(rows: Record<string, unknown>[], config: WidgetConfig, _widgetType: string): string[] {
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

const getWidgetColor = (type: string) => WIDGET_CATEGORY_COLOR[type] ?? 'gray';

export {
  parseConfig,
  parsePosition,
  fmtValue,
  generateInsights,
  chartColor,
  getWidgetColor,
  CHART_PRIMARY,
  CHART_ACCENT,
  useCountUp,
};
