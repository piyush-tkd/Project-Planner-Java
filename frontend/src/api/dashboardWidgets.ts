/**
 * Custom Dashboard Widgets — API hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface DashboardWidget {
  id?: number;
  username?: string;
  widgetType: string;
  title?: string;
  gridCol: number;
  gridRow: number;
  colSpan: number;
  rowSpan: number;
  config?: Record<string, unknown>;
}

const QK = ['dashboard-widgets'] as const;

export function useDashboardWidgets() {
  return useQuery<DashboardWidget[]>({
    queryKey: QK,
    queryFn: async () => {
      const r = await apiClient.get('/dashboard-widgets');
      return r.data;
    },
    staleTime: 2 * 60_000,
  });
}

export function useSaveDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      apiClient.post('/dashboard-widgets/bulk', { widgets }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(QK, data);
    },
  });
}

export function useDeleteDashboardWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/dashboard-widgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
