import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { PodResponse, BauAssumptionResponse, BauAssumptionRequest } from '../types';

export function usePods() {
  return useQuery<PodResponse[]>({
    queryKey: ['pods'],
    queryFn: () => apiClient.get('/pods').then(r => r.data),
  });
}

export function useCreatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; complexityMultiplier?: number }) =>
      apiClient.post('/pods', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods'] }),
  });
}

export function useUpdatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PodResponse> }) =>
      apiClient.put(`/pods/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bau-assumptions'] }),
  });
}
