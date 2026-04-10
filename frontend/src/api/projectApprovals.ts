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
  /** Encodes the change pending review, e.g. "STATUS:PLANNING→ACTIVE" */
  proposedChange?: string;
  requestedAt: string;
  reviewedAt?: string;
}

/**
 * Parse a proposedChange string into a human-readable label.
 * "STATUS:PLANNING→ACTIVE" → "Status: PLANNING → ACTIVE"
 */
export function describeProposedChange(proposedChange?: string): string | null {
  if (!proposedChange) return null;
  if (proposedChange.startsWith('STATUS:')) {
    const body = proposedChange.slice('STATUS:'.length);
    const [from, to] = body.split('→');
    return `Status: ${from} → ${to}`;
  }
  if (proposedChange.startsWith('TIMELINE:')) {
    const body = proposedChange.slice('TIMELINE:'.length);
    const [from, to] = body.split('→');
    return `Timeline extended: month ${from} → ${to}`;
  }
  if (proposedChange.startsWith('BUDGET:')) {
    const body = proposedChange.slice('BUDGET:'.length);
    const [from, to] = body.split('→');
    return `Budget increase: $${from} → $${to}`;
  }
  return proposedChange;
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
    staleTime: 0,           // always fetch fresh when the queue page mounts
    refetchInterval: 60_000, // poll every 60 s so new submissions appear automatically
  });
}

export function useAllApprovals() {
  return useQuery<ProjectApproval[]>({
    queryKey: ['approvals-history'],
    queryFn: async () => {
      const r = await apiClient.get('/approvals/history');
      return r.data;
    },
    staleTime: 0,
    refetchInterval: 60_000,
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
      qc.invalidateQueries({ queryKey: ['approvals-history'] });
      qc.invalidateQueries({ queryKey: ['project-approvals'] });
      // Auto-apply may have changed a project's status — invalidate project cache
      qc.invalidateQueries({ queryKey: ['projects'] });
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
