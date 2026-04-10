import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { PodResponse, BauAssumptionResponse, BauAssumptionRequest } from '../types';

export function usePods() {
  return useQuery<PodResponse[]>({
    queryKey: ['pods'],
    queryFn: () => apiClient.get('/pods').then(r => r.data),
  });
}

/** Invalidates every query that embeds POD data — used by create/update/delete */
function invalidatePodDependents(qc: ReturnType<typeof useQueryClient>) {
  // Core POD list
  qc.invalidateQueries({ queryKey: ['pods'] });
  // Resources: each resource carries podAssignment.podId + pod name
  qc.invalidateQueries({ queryKey: ['resources'] });
  // Project–POD matrix (used by Projects page, PodsPage summary stats, POD detail)
  qc.invalidateQueries({ queryKey: ['project-pod-matrix'] });
  // BAU assumptions are keyed per POD
  qc.invalidateQueries({ queryKey: ['bau-assumptions'] });
  // Pod-hours report (Jira + capacity planning hours per pod)
  qc.invalidateQueries({ queryKey: ['pod-hours'] });
  // All server-side report calculations (utilization, capacity, dashboard widgets, etc.)
  qc.invalidateQueries({ queryKey: ['reports'] });
  // Jira POD watch config references our capacity PODs
  qc.invalidateQueries({ queryKey: ['jira', 'pods', 'config'] });
  // Jira analytics filters list PODs
  qc.invalidateQueries({ queryKey: ['jira', 'analytics', 'filters'] });
}

export function useCreatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; complexityMultiplier?: number }) =>
      apiClient.post('/pods', data).then(r => r.data),
    onSuccess: () => invalidatePodDependents(qc),
  });
}

export function useUpdatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PodResponse> }) =>
      apiClient.put(`/pods/${id}`, data).then(r => r.data),
    onSuccess: () => invalidatePodDependents(qc),
  });
}

export function useDeletePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/pods/${id}`),
    onSuccess: () => {
      invalidatePodDependents(qc);
      // Also bust any per-project pod-planning queries since the deleted pod's
      // planning rows are now stale
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useBauAssumptions() {
  return useQuery<BauAssumptionResponse[]>({
    queryKey: ['bau-assumptions'],
    queryFn: () => apiClient.get('/bau-assumptions').then(r => r.data),
  });
}

export function useUpdateBauAssumptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BauAssumptionRequest[]) =>
      apiClient.put('/bau-assumptions', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bau-assumptions'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
