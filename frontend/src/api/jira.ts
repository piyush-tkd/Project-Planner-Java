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
  // Issue counts
  totalIssues: number;
  doneIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  // Story points
  totalSP: number;
  doneSP: number;
  // Time
  hoursLogged: number;
  estimatedHours: number;
  // Pre-computed percentages
  progressPct: number;
  spProgressPct: number;
  // Cycle time
  avgCycleTimeDays: number;
}

export interface SprintVelocity {
  sprintName: string;
  committedSP: number;
  completedSP: number;
}

export interface PodMetrics {
  podId: number | null;
  podDisplayName: string;
  boardKeys: string[];
  boardName: string | null;
  activeSprint: SprintInfo | null;
  velocity: SprintVelocity[];
  backlogSize: number;
  // Team breakdown
  hoursByMember: Record<string, number>;
  spByMember: Record<string, number>;
  memberIssueCount: Record<string, number>;
  // Issue breakdowns (current sprint)
  issueTypeBreakdown: Record<string, number>;   // e.g. { Bug: 5, Story: 10, Task: 3 }
  priorityBreakdown: Record<string, number>;    // e.g. { High: 4, Medium: 8, Low: 2 }
  statusBreakdown: Record<string, number>;      // e.g. { "To Do": 2, "In Progress": 8, Done: 10 }
  labelBreakdown: Record<string, number>;       // e.g. { "frontend": 5, "api": 3 }
  epicBreakdown: Record<string, number>;        // e.g. { "Auth Epic": 4, "Dashboard": 6 }
  // Estimates & cycle time
  totalEstimatedHours: number;
  avgCycleTimeDays: number;
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

// ── POD config types ───────────────────────────────────────────────────

/** A configured POD with one or more Jira board keys. */
export interface PodConfigResponse {
  id: number;
  podDisplayName: string;
  enabled: boolean;
  sortOrder: number;
  boardKeys: string[];
}

export interface PodConfigRequest {
  podDisplayName: string;
  enabled: boolean;
  boardKeys: string[];
}

// ── POD config hooks ───────────────────────────────────────────────────

export function usePodWatchConfig() {
  return useQuery<PodConfigResponse[]>({
    queryKey: ['jira', 'pods', 'config'],
    queryFn: () => apiClient.get('/jira/pods/config').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

export function useSavePodWatchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqs: PodConfigRequest[]) =>
      apiClient.post('/jira/pods/config', reqs).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'pods', 'config'] });
      qc.removeQueries({ queryKey: ['jira', 'pods'] });
    },
  });
}

/** Velocity for a single POD — fires only when `fetchEnabled` is true. */
export function usePodVelocity(podId: number | null, fetchEnabled: boolean) {
  return useQuery<SprintVelocity[]>({
    queryKey: ['jira', 'pods', podId, 'velocity'],
    queryFn: () => apiClient.get(`/jira/pods/${podId}/velocity`).then(r => r.data),
    enabled: fetchEnabled && podId != null,
    ...JIRA_LIVE_OPTS,
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

// ── Lightweight project list (key + name only) ─────────────────────

export interface SimpleProject {
  key: string;
  name: string;
}

/**
 * Fetches just project key + name — no epics or labels.
 * Used by board pickers in Settings so we don't pay the full project load cost.
 */
export function useJiraProjectsSimple() {
  return useQuery<SimpleProject[]>({
    queryKey: ['jira', 'projects', 'simple'],
    queryFn: () => apiClient.get('/jira/projects/simple').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

/**
 * Clears all Jira server-side caches and removes the relevant React Query
 * caches so the next request re-fetches live data from Jira.
 */
export function useClearJiraCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post('/jira/cache/clear').then(r => r.data),
    onSuccess: () => {
      // Remove all cached Jira data — next load will re-fetch from Jira
      qc.removeQueries({ queryKey: ['jira', 'projects'] });
      qc.removeQueries({ queryKey: ['jira', 'pods'] });
      qc.removeQueries({ queryKey: ['jira', 'actuals'] });
      qc.removeQueries({ queryKey: ['jira', 'suggestions'] });
    },
  });
}
