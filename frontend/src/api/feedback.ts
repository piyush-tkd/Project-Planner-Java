import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface UserFeedback {
  id: number;
  category: string;
  message: string;
  pageUrl: string | null;
  screenshot: string | null;
  submittedBy: string | null;
  status: string;
  adminNotes: string | null;
  priority: string;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitFeedbackPayload {
  category: string;
  message: string;
  pageUrl?: string;
  screenshot?: string;
  priority?: string;
  rating?: number;
}

export function useAllFeedback() {
  return useQuery<UserFeedback[]>({
    queryKey: ['user-feedback'],
    queryFn: () => apiClient.get('/feedback').then(r => r.data),
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation<UserFeedback, Error, SubmitFeedbackPayload>({
    mutationFn: (data) => apiClient.post('/feedback', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-feedback'] }),
  });
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation<UserFeedback, Error, { id: number; data: Partial<Pick<UserFeedback, 'status' | 'priority' | 'adminNotes'>> }>({
    mutationFn: ({ id, data }) => apiClient.put(`/feedback/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-feedback'] }),
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiClient.delete(`/feedback/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-feedback'] }),
  });
}
