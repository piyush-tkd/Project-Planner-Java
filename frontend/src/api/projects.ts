import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { ProjectResponse, ProjectRequest, ProjectPodPlanningResponse, ProjectPodPlanningRequest, ProjectPodMatrixResponse } from '../types';

export function useProjects() {
  return useQuery<ProjectResponse[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then(r => r.data),
  });
}

export function useProject(id: number) {
  return useQuery<ProjectResponse>({
    queryKey: ['projects', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectRequest) => apiClient.post('/projects', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProjectRequest }) =>
      apiClient.put(`/projects/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useCopyProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/projects/${id}/copy`, {}).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function usePatchProjectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiClient.patch(`/projects/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useProjectPodMatrix() {
  return useQuery<ProjectPodMatrixResponse[]>({
    queryKey: ['project-pod-matrix'],
    queryFn: () => apiClient.get('/projects/pod-matrix').then(r => r.data),
  });
}

export function usePodProjects(podId: number) {
  return useQuery<ProjectPodMatrixResponse[]>({
    queryKey: ['project-pod-matrix', 'pod', podId],
    queryFn: () => apiClient.get(`/projects/pod-matrix/by-pod/${podId}`).then(r => r.data),
    enabled: !!podId,
  });
}

export function useProjectPodPlannings(projectId: number) {
  return useQuery<ProjectPodPlanningResponse[]>({
    queryKey: ['projects', projectId, 'pod-planning'],
    queryFn: () => apiClient.get(`/projects/${projectId}/pod-planning`).then(r => r.data),
    enabled: !!projectId,
  });
}

export function useUpdatePodPlannings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: ProjectPodPlanningRequest[] }) =>
      apiClient.put(`/projects/${projectId}/pod-planning`, data).then(r => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'pod-planning'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
