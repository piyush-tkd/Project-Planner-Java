import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface TourConfig {
  enabled: boolean;
  frequency: 'first_login' | 'every_login' | 'every_n' | 'disabled';
  everyN: number;
}

export interface TourStatus {
  showTour: boolean;
  config: TourConfig;
}

export function useTourStatus() {
  return useQuery<TourStatus>({
    queryKey: ['tour-status'],
    queryFn: () => apiClient.get('/tour/status').then(r => r.data),
    staleTime: Infinity, // only fetch once per session
  });
}

export function useTourConfig() {
  return useQuery<TourConfig>({
    queryKey: ['tour-config'],
    queryFn: () => apiClient.get('/tour/config').then(r => r.data),
  });
}

export function useMarkTourSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/tour/seen').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tour-status'] }),
  });
}

export function useUpdateTourConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<TourConfig>) =>
      apiClient.put('/tour/config', config).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tour-config'] });
      qc.invalidateQueries({ queryKey: ['tour-status'] });
    },
  });
}
