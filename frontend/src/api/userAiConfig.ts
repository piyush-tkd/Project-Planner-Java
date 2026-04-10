import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface UserAiConfigResponse {
  provider: string;
  model: string;
  apiKeySet: boolean;
  maskedKey: string | null;
}

export interface UserAiConfigRequest {
  provider: string;
  model: string;
  apiKey?: string;
}

export interface AiStatusResponse {
  source: 'ORG' | 'USER' | 'NONE';
  orgKeyActive: boolean;
  userKeySet: boolean;
}

export function useUserAiConfig() {
  return useQuery<UserAiConfigResponse>({
    queryKey: ['user-ai-config'],
    queryFn: () => apiClient.get('/user/ai-config').then(r => r.data),
  });
}

export function useAiStatus() {
  return useQuery<AiStatusResponse>({
    queryKey: ['user-ai-status'],
    queryFn: () => apiClient.get('/user/ai-config/status').then(r => r.data),
  });
}

export function useSaveUserAiConfig() {
  const queryClient = useQueryClient();
  return useMutation<UserAiConfigResponse, Error, UserAiConfigRequest>({
    mutationFn: (data) => apiClient.put('/user/ai-config', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ai-config'] });
      queryClient.invalidateQueries({ queryKey: ['user-ai-status'] });
    },
  });
}

export function useDeleteUserAiConfig() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => apiClient.delete('/user/ai-config').then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ai-config'] });
      queryClient.invalidateQueries({ queryKey: ['user-ai-status'] });
    },
  });
}
