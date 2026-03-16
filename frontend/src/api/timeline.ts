import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface TimelineConfig {
  id: number;
  startYear: number;
  startMonth: number;
  currentMonthIndex: number;
  workingHours: Record<string, number>;
  monthLabels: Record<string, string>;
}

export function useTimeline() {
  return useQuery<TimelineConfig>({
    queryKey: ['timeline'],
    queryFn: () => apiClient.get('/timeline').then(r => r.data),
  });
}

export function useUpdateTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TimelineConfig>) =>
      apiClient.put('/timeline', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeline'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
