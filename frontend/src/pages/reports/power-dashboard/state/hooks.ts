/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import {
  Dashboard,
  Alert,
  Template,
  FieldMeta,
  MetricMeta,
  WidgetConfig,
} from './types';

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

export {
  useDashboards,
  useDashboard,
  useTemplates,
  useAlerts,
  useFields,
  useCustomFields,
  useFieldValues,
  useWidgetData,
};
