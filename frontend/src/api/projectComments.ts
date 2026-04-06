/**
 * Project Comments — API hooks for threaded discussion on projects.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectComment {
  id:        number;
  projectId: number;
  parentId:  number | null;
  author:    string;
  body:      string;
  edited:    boolean;
  createdAt: string;
  updatedAt: string;
  replies:   ProjectComment[] | null;
}

export interface CommentRequest {
  body:     string;
  parentId?: number | null;
}

// ── Query key factory ──────────────────────────────────────────────────────

const QK = (projectId: number | string) => ['project-comments', String(projectId)];

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useProjectComments(projectId: number | string) {
  return useQuery<ProjectComment[]>({
    queryKey: QK(projectId),
    queryFn: async () => {
      const r = await apiClient.get(`/projects/${projectId}/comments`);
      return r.data;
    },
    staleTime: 30_000,
  });
}

export function useAddComment(projectId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CommentRequest) =>
      apiClient.post(`/projects/${projectId}/comments`, req).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(projectId) }),
  });
}

export function useEditComment(projectId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiClient.put(`/projects/${projectId}/comments/${id}`, { body }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(projectId) }),
  });
}

export function useDeleteComment(projectId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) =>
      apiClient.delete(`/projects/${projectId}/comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(projectId) }),
  });
}
