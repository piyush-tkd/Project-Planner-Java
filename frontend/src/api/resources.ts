import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { ResourceResponse, ResourceRequest, AvailabilityData } from '../types';

export interface CostRateData {
  id: number;
  role: string;
  location: string;
  hourlyRate: number;
}

export interface CostRateRequest {
  role: string;
  location: string;
  hourlyRate: number;
}

export function useCostRates() {
  return useQuery<CostRateData[]>({
    queryKey: ['cost-rates'],
    queryFn: () => apiClient.get('/cost-rates').then(r => r.data),
  });
}

export function useCreateCostRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CostRateRequest) => apiClient.post('/cost-rates', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost-rates'] }),
  });
}

export function useUpdateCostRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CostRateRequest }) =>
      apiClient.put(`/cost-rates/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost-rates'] }),
  });
}

export function useDeleteCostRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cost-rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost-rates'] }),
  });
}

export function useResources() {
  return useQuery<ResourceResponse[]>({
    queryKey: ['resources'],
    queryFn: () => apiClient.get('/resources').then(r => r.data),
  });
}

export function useResource(id: number) {
  return useQuery<ResourceResponse>({
    queryKey: ['resources', id],
    queryFn: () => apiClient.get(`/resources/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ResourceRequest) => apiClient.post('/resources', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ResourceRequest }) =>
      apiClient.put(`/resources/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/resources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export function useResourceAvailability(id: number) {
  return useQuery<AvailabilityData>({
    queryKey: ['availability', id],
    queryFn: () => apiClient.get(`/resources/${id}/availability`).then(r => r.data),
    enabled: !!id,
  });
}

export function useAllAvailability() {
  return useQuery<AvailabilityData[]>({
    queryKey: ['availability'],
    queryFn: () => apiClient.get('/resources/availability').then(r => r.data),
  });
}

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AvailabilityData[]) =>
      apiClient.put('/availability', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}


export function useUpdateActualRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualRate }: { id: number; actualRate: number | null }) =>
      apiClient.put(`/resources/${id}/actual-rate`, { actualRate }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function useSetAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId, podId, capacityFte }: { resourceId: number; podId: number; capacityFte: number }) =>
      apiClient.put(`/resources/${resourceId}/assignment`, { podId, capacityFte }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
