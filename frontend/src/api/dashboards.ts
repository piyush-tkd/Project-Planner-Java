/**
 * Dashboards API — hooks for named dashboards (V125 backend)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface DashboardConfig {
  id?: number;
  name: string;
  description?: string;
  isDefault: boolean;
  isTemplate: boolean;
  templateName?: string;
  config: string; // JSON string of { widgets: WidgetDef[], layout: any[] }
  createdAt?: string;
  updatedAt?: string;
}

const QK = ['dashboards'] as const;

export function useDashboards() {
  return useQuery<DashboardConfig[]>({
    queryKey: QK,
    queryFn: async () => {
      const r = await apiClient.get('/dashboards');
      return r.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useDashboardTemplates() {
  return useQuery<DashboardConfig[]>({
    queryKey: [...QK, 'templates'],
    queryFn: async () => {
      const r = await apiClient.get('/dashboards/templates');
      return r.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<DashboardConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
      apiClient.post('/dashboards', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DashboardConfig> }) =>
      apiClient.put(`/dashboards/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/dashboards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useDuplicateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.post(`/dashboards/${id}/duplicate`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}
