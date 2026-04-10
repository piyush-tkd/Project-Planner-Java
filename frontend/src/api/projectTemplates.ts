import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface TemplatePhase {
  name: string;
  duration: string;
  description: string;
}

export interface ProjectTemplateResponse {
  id: number;
  name: string;
  description: string;
  category: string;
  duration: string;
  team: string;
  effort: string;
  tags: string[];
  starred: boolean;
  usageCount: number;
  lastUsed: string | null;
  phases: string; // raw JSON — parse on use
}

export interface ProjectTemplateRequest {
  name: string;
  description: string;
  category: string;
  duration: string;
  team: string;
  effort: string;
  tags: string[];
  starred: boolean;
  phases: string; // JSON string
}

const BASE = '/project-templates';

export function useProjectTemplates() {
  return useQuery<ProjectTemplateResponse[]>({
    queryKey: ['project-templates'],
    queryFn: () => apiClient.get(BASE).then(r => r.data),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ProjectTemplateRequest) => apiClient.post(BASE, req).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: ProjectTemplateRequest & { id: number }) =>
      apiClient.put(`${BASE}/${id}`, req).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  });
}

export function useToggleTemplateStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.patch(`${BASE}/${id}/star`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  });
}

export function useMarkTemplateUsed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`${BASE}/${id}/use`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  });
}
