import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface JiraEpicInfo {
  key: string;
  name: string;
  status: string;
}

export interface JiraProjectInfo {
  key: string;
  name: string;
  epics: JiraEpicInfo[];
  labels: string[];
}

export interface MappingSuggestion {
  jiraProjectKey: string;
  jiraProjectName: string;
  matchType: 'EPIC_NAME' | 'LABEL' | 'EPIC_KEY' | 'PROJECT_NAME';
  matchValue: string;
  epicKey: string | null;
  confidence: number;
}

export interface MappingResponse {
  id: number;
  ppProjectId: number;
  ppProjectName: string;
  jiraProjectKey: string;
  matchType: string;
  matchValue: string;
  active: boolean;
}

export interface SaveMappingRequest {
  ppProjectId: number;
  jiraProjectKey: string;
  matchType: string;
  matchValue: string;
}

export interface ActualsRow {
  ppProjectId: number;
  ppProjectName: string;
  jiraProjectKey: string;
  matchType: string;
  matchValue: string;
  issueCount: number;
  totalStoryPoints: number;
  storyPointHours: number;
  hasTimeData: boolean;
  actualHoursByMonth: Record<number, number>;
  actualHoursByResource: Record<string, number>;
  monthLabels: Record<number, string>;
  errorMessage: string | null;
}

export interface JiraStatus {
  configured: boolean;
  baseUrl: string;
}

// ── POD Metrics types ──────────────────────────────────────────────────

export interface SprintInfo {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  totalIssues: number;
  doneIssues: number;
  inProgressIssues: number;
  totalSP: number;
  doneSP: number;
  hoursLogged: number;
  progressPct: number;
  spProgressPct: number;
}

export interface SprintVelocity {
  sprintName: string;
  committedSP: number;
  completedSP: number;
}

export interface PodMetrics {
  jiraProjectKey: string;
  jiraProjectName: string;
  boardName: string | null;
  activeSprint: SprintInfo | null;
  velocity: SprintVelocity[];
  backlogSize: number;
  hoursByMember: Record<string, number>;
  spByMember: Record<string, number>;
  errorMessage: string | null;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useJiraStatus() {
  return useQuery<JiraStatus>({
    queryKey: ['jira', 'status'],
    queryFn: () => apiClient.get('/jira/status').then(r => r.data),
  });
}

export function useJiraProjects() {
  return useQuery<JiraProjectInfo[]>({
    queryKey: ['jira', 'projects'],
    queryFn: () => apiClient.get('/jira/projects').then(r => r.data),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useJiraSuggestions() {
  return useQuery<MappingSuggestion[]>({
    queryKey: ['jira', 'suggestions'],
    queryFn: () => apiClient.get('/jira/suggestions').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useJiraMappings() {
  return useQuery<MappingResponse[]>({
    queryKey: ['jira', 'mappings'],
    queryFn: () => apiClient.get('/jira/mappings').then(r => r.data),
  });
}

export function useJiraActuals() {
  return useQuery<ActualsRow[]>({
    queryKey: ['jira', 'actuals'],
    queryFn: () => apiClient.get('/jira/actuals').then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSaveMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: SaveMappingRequest) =>
      apiClient.post('/jira/mappings', req).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'mappings'] });
      qc.invalidateQueries({ queryKey: ['jira', 'actuals'] });
    },
  });
}

export function useSaveMappingsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqs: SaveMappingRequest[]) =>
      apiClient.post('/jira/mappings/bulk', reqs).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'mappings'] });
      qc.invalidateQueries({ queryKey: ['jira', 'actuals'] });
    },
  });
}

export function useJiraPods() {
  return useQuery<PodMetrics[]>({
    queryKey: ['jira', 'pods'],
    queryFn: () => apiClient.get('/jira/pods').then(r => r.data),
    staleTime: 3 * 60 * 1000,
  });
}

export function useDeleteMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/jira/mappings/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'mappings'] });
      qc.invalidateQueries({ queryKey: ['jira', 'actuals'] });
    },
  });
}
