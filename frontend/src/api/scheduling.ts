import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  PhaseScheduleResponse,
  PhaseScheduleRequest,
  SchedulingRulesResponse,
  SchedulingRulesRequest,
  ProjectMilestonesRequest,
} from '../types';

export function usePhaseSchedules(projectId: number) {
  return useQuery<PhaseScheduleResponse[]>({
    queryKey: ['projects', projectId, 'scheduling', 'phases'],
    queryFn: () => apiClient.get(`/projects/${projectId}/scheduling/phases`).then(r => r.data),
    enabled: !!projectId,
  });
}

export function useUpdatePhaseSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: PhaseScheduleRequest[] }) =>
      apiClient.put(`/projects/${projectId}/scheduling/phases`, data).then(r => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'scheduling'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'pod-planning'] });
    },
  });
}

export function useSchedulingRules(projectId: number) {
  return useQuery<SchedulingRulesResponse>({
    queryKey: ['projects', projectId, 'scheduling', 'rules'],
    queryFn: () => apiClient.get(`/projects/${projectId}/scheduling/rules`).then(r => r.data),
    enabled: !!projectId,
  });
}

export function useUpdateSchedulingRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: SchedulingRulesRequest }) =>
      apiClient.put(`/projects/${projectId}/scheduling/rules`, data).then(r => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId, 'scheduling', 'rules'] });
    },
  });
}

export function useUpdateProjectMilestones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: ProjectMilestonesRequest }) =>
      apiClient.put(`/projects/${projectId}/scheduling/milestones`, data).then(r => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['projects', vars.projectId] });
    },
  });
}
