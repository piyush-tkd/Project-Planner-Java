/**
 * Project Approvals — API hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface ProjectApproval {
  id: number;
  projectId: number;
  requestedBy: string;
  reviewedBy?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  requestNote?: string;
  reviewComment?: string;
  requestedAt: string;
  reviewedAt?: string;
}

export function useProjectApprovals(projectId: number) {
  return useQuery<ProjectApproval[]>({
    queryKey: ['project-approvals', projectId],
    queryFn: async () => {
      const r = await apiClient.get(`/projects/${projectId}/approvals`);
      return r.data;
    },
    staleTime: 60_000,
  });
}

export function usePendingApprovals() {
  return useQuery<ProjectApproval[]>({
    queryKey: ['approvals-pending'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/pending');
      return r.data;
    },
    staleTime: 30_000,
  });
}

export function useSubmitApproval(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestNote: string) =>
      apiClient.post(`/projects/${projectId}/approvals`, { requestNote }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-approvals', projectId] });
      qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    },
  });
}

export function useReviewApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reviewComment }: { id: number; action: 'APPROVE' | 'REJECT'; reviewComment?: string }) =>
      apiClient.put(`/approvals/${id}/review`, { action, reviewComment }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals-pending'] });
      qc.invalidateQueries({ queryKey: ['project-approvals'] });
    },
  });
}

export function useWithdrawApproval(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/projects/${projectId}/approvals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-approvals', projectId] });
      qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    },
  });
}
