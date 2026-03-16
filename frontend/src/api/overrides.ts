import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface OverrideResponse {
  id: number;
  resourceId: number;
  resourceName: string;
  toPodId: number;
  toPodName: string;
  startMonth: number;
  endMonth: number;
  allocationPct: number;
  notes: string | null;
}

export interface OverrideRequest {
  resourceId: number;
  toPodId: number;
  startMonth: number;
  endMonth: number;
  allocationPct: number;
  notes: string | null;
}

export function useOverrides() {
  return useQuery<OverrideResponse[]>({
    queryKey: ['overrides'],
    queryFn: () => apiClient.get('/overrides').then(r => r.data),
  });
}

export function useCreateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OverrideRequest) => apiClient.post('/overrides', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overrides'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: OverrideRequest }) =>
      apiClient.put(`/overrides/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overrides'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/overrides/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overrides'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
