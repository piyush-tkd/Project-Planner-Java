/**
 * Project Baselines — API hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface ProjectBaseline {
  id: number;
  projectId: number;
  label: string;
  snappedBy: string;
  plannedStart?: string;
  plannedTarget?: string;
  plannedHours?: number;
  snappedAt: string;
}

export function useProjectBaselines(projectId: number) {
  return useQuery<ProjectBaseline[]>({
    queryKey: ['project-baselines', projectId],
    queryFn: async () => {
      const r = await apiClient.get(`/projects/${projectId}/baselines`);
      return r.data;
    },
    staleTime: 2 * 60_000,
  });
}

export function useSnapBaseline(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      apiClient.post(`/projects/${projectId}/baselines`, { label }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-baselines', projectId] }),
  });
}

export function useDeleteBaseline(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/projects/${projectId}/baselines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-baselines', projectId] }),
  });
}
