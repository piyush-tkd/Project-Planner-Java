import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { ReleaseCalendarResponse, ReleaseCalendarRequest } from '../types/project';

export function useReleases() {
  return useQuery<ReleaseCalendarResponse[]>({
    queryKey: ['releases'],
    queryFn: () => apiClient.get('/releases').then(r => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreateRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReleaseCalendarRequest) => apiClient.post('/releases', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}

export function useUpdateRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReleaseCalendarRequest }) =>
      apiClient.put(`/releases/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}

export function useDeleteRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/releases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}
