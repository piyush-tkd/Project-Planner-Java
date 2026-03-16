import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export interface ProjectActualResponse {
  id: number;
  projectId: number;
  projectName: string;
  monthKey: number;
  actualHours: number;
}

/** All actuals across all projects */
export function useActuals() {
  return useQuery<ProjectActualResponse[]>({
    queryKey: ['actuals'],
    queryFn: () => apiClient.get('/actuals').then(r => r.data),
  });
}

/** Actuals for a single project */
export function useProjectActuals(projectId: number) {
  return useQuery<ProjectActualResponse[]>({
    queryKey: ['actuals', 'project', projectId],
    queryFn: () => apiClient.get(`/actuals/by-project/${projectId}`).then(r => r.data),
    enabled: !!projectId,
  });
}
