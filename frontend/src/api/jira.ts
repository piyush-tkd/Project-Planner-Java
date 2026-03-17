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

// ── Shared query options for expensive Jira calls ──────────────────────
//
// These calls hit the live Jira API and can be slow.
// - staleTime: 30 min  → cached data is considered fresh for 30 min
// - refetchOnMount: false   → don't re-fetch when re-navigating to the page
// - refetchOnWindowFocus: false  → don't re-fetch when switching tabs
// - refetchOnReconnect: false    → don't re-fetch on network reconnect
// Users trigger a refresh explicitly via the "Sync" / "Refresh" button.

const JIRA_LIVE_OPTS = {
  staleTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

// Lighter option for cheap DB-backed endpoints (mappings list, status)
const JIRA_CHEAP_OPTS = {
  staleTime: 2 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

// ── Hooks ──────────────────────────────────────────────────────────────

export function useJiraStatus() {
  return useQuery<JiraStatus>({
    queryKey: ['jira', 'status'],
    queryFn: () => apiClient.get('/jira/status').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

/**
 * Loads Jira projects + epics/labels for the mapper.
 * Expensive: makes N API calls for N projects. Cached for 30 min.
 * Only refreshes when user clicks "Refresh Jira".
 */
export function useJiraProjects() {
  return useQuery<JiraProjectInfo[]>({
    queryKey: ['jira', 'projects'],
    queryFn: () => apiClient.get('/jira/projects').then(r => r.data),
    ...JIRA_LIVE_OPTS,
  });
}

export function useJiraSuggestions() {
  return useQuery<MappingSuggestion[]>({
    queryKey: ['jira', 'suggestions'],
    queryFn: () => apiClient.get('/jira/suggestions').then(r => r.data),
    ...JIRA_LIVE_OPTS,
  });
}

/** Cheap — just reads the DB mapping table. */
export function useJiraMappings() {
  return useQuery<MappingResponse[]>({
    queryKey: ['jira', 'mappings'],
    queryFn: () => apiClient.get('/jira/mappings').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

/**
 * Fetches actuals from Jira for each mapped project.
 * Expensive. Only refreshes when user clicks "Sync".
 */
export function useJiraActuals() {
  return useQuery<ActualsRow[]>({
    queryKey: ['jira', 'actuals'],
    queryFn: () => apiClient.get('/jira/actuals').then(r => r.data),
    ...JIRA_LIVE_OPTS,
  });
}

/**
 * Fetches sprint/velocity metrics for every Jira project (POD dashboard).
 * Very expensive — hits Agile API for all projects. Cached 30 min.
 */
export function useJiraPods() {
  return useQuery<PodMetrics[]>({
    queryKey: ['jira', 'pods'],
    queryFn: () => apiClient.get('/jira/pods').then(r => r.data),
    ...JIRA_LIVE_OPTS,
  });
}

export function useSaveMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: SaveMappingRequest) =>
      apiClient.post('/jira/mappings', req).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'mappings'] });
      // Actuals are now stale after a mapping change — clear so next Sync re-fetches
      qc.removeQueries({ queryKey: ['jira', 'actuals'] });
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
      qc.removeQueries({ queryKey: ['jira', 'actuals'] });
    },
  });
}

export function useDeleteMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/jira/mappings/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'mappings'] });
      qc.removeQueries({ queryKey: ['jira', 'actuals'] });
    },
  });
}
