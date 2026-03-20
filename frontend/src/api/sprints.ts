import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { SprintResponse, SprintRequest } from '../types/project';

export function useSprints() {
  return useQuery<SprintResponse[]>({
    queryKey: ['sprints'],
    queryFn: () => apiClient.get('/sprints').then(r => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SprintRequest) => apiClient.post('/sprints', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SprintRequest }) =>
      apiClient.put(`/sprints/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/sprints/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}
