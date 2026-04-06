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
  // Time (hours)
  hoursLogged: number;
  estimatedHours: number;
  remainingHours: number;
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
  labelBreakdown: Record<string, number>;       // e.g. { frontend: 5, api: 3 }
  epicBreakdown: Record<string, number>;        // e.g. { "Auth Epic": 4, "Dashboard": 6 }
  releaseBreakdown: Record<string, number>;     // e.g. { "v2.1.0": 8, "v2.2.0": 3 }
  componentBreakdown: Record<string, number>;   // e.g. { Frontend: 6, Backend: 5, API: 4 }
  // Time-series for burndown / activity charts
  dailyHoursLogged: Record<string, number>;                  // date (yyyy-MM-dd) → hours
  memberDailyHours: Record<string, Record<string, number>>;  // member → date → hours
  // Estimates & cycle time
  totalEstimatedHours: number;
  totalRemainingHours: number;
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

// ── Jira credentials (UI-managed) ──────────────────────────────────────

export interface JiraCredentialsResponse {
  baseUrl: string;
  email: string;
  apiToken: string;   // always masked on the server side
  hasToken: boolean;
  configured: boolean;
  source: 'database' | 'config-file';
}

export interface JiraCredentialsSaveRequest {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export function useJiraCredentials() {
  return useQuery<JiraCredentialsResponse>({
    queryKey: ['jira', 'credentials'],
    queryFn: () => apiClient.get('/jira/credentials').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

export function useSaveJiraCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: JiraCredentialsSaveRequest) =>
      apiClient.post('/jira/credentials', req).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'status'] });
      qc.invalidateQueries({ queryKey: ['jira', 'credentials'] });
    },
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

// ── Sprint issue row (for drill-down modal in JiraPodDetailPage) ────────

export interface SprintIssueRow {
  key: string;
  summary: string;
  issueType: string;
  statusCategory: string;
  statusName: string;
  assignee: string;
  storyPoints: number;
  hoursLogged: number;
  priority: string;
}

/**
 * Fetches the active-sprint issue list for one POD.
 * Only fires when `enabled` is true (modal is open) — avoids unnecessary Jira calls.
 */
export function useSprintIssues(podId: number | null, enabled = false) {
  return useQuery<SprintIssueRow[]>({
    queryKey: ['jira', 'pods', podId, 'sprint-issues'],
    queryFn: () => apiClient.get(`/jira/pods/${podId}/sprint-issues`).then(r => r.data),
    enabled: !!podId && enabled,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
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
      // Re-fetch pod config itself
      qc.invalidateQueries({ queryKey: ['jira', 'pods', 'config'] });
      qc.removeQueries({ queryKey: ['jira', 'pods'] });
      // Invalidate every page that uses jira_pod_board data so they re-fetch
      // with the new project-key → POD mapping straight away
      qc.invalidateQueries({ queryKey: ['pod-hours'] });
      qc.invalidateQueries({ queryKey: ['jira', 'worklog'] });
      qc.invalidateQueries({ queryKey: ['jira', 'projects'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
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
 * Fetches only the Jira projects that are mapped to a POD board.
 * Used in filter dropdowns on data pages (Worklog Breakdown, etc.)
 * so users only see projects their PODs actively track.
 */
export function useJiraProjectsSimple() {
  return useQuery<SimpleProject[]>({
    queryKey: ['jira', 'projects', 'simple'],
    queryFn: () => apiClient.get('/jira/projects/simple').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

/**
 * Fetches all Jira projects visible to the configured account.
 * Used in settings pages that need the full project list
 * (Jira Board Settings board-picker, Projects page linking).
 */
export function useJiraAllProjectsSimple() {
  return useQuery<SimpleProject[]>({
    queryKey: ['jira', 'projects', 'all-simple'],
    queryFn: () => apiClient.get('/jira/projects/all-simple').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

// ── Release tracking types ─────────────────────────────────────────────

export interface IssueRow {
  key: string;
  summary: string;
  issueType: string;
  statusName: string;
  statusCategory: string;
  assignee: string;
  storyPoints: number;
  hoursLogged: number;
  parentKey: string | null;
}

export interface ReleaseMetrics {
  podId: number | null;
  podDisplayName: string;
  versionName: string;
  notes: string | null;
  totalIssues: number;
  issueTypeBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  statusCategoryBreakdown: Record<string, number>;
  totalSP: number;
  doneSP: number;
  totalHoursLogged: number;
  assigneeHoursLogged: Record<string, number>;
  assigneeBreakdown: Record<string, number>;
  issues: IssueRow[];
  errorMessage: string | null;
}

export interface ReleaseConfigResponse {
  podId: number;
  podDisplayName: string;
  enabled: boolean;
  versions: string[];
  boardKeys: string[];
  versionNotes: Record<string, string>;
}

export interface ReleaseConfigRequest {
  podId: number;
  versions: string[];
  versionNotes: Record<string, string>;
}

export interface JiraFixVersion {
  id: string;
  name: string;
  released: boolean;
  releaseDate: string | null;
  description: string | null;
  /** Only present on the /fixversions (all-pods) endpoint — lists which PODs carry this version */
  podNames?: string[];
}

// ── Release hooks ──────────────────────────────────────────────────────

/** All (pod, version) release metrics — expensive Jira call, cached 30 min client-side. */
export function useReleaseMetrics() {
  return useQuery<ReleaseMetrics[]>({
    queryKey: ['jira', 'releases'],
    queryFn: () => apiClient.get('/jira/releases').then(r => r.data),
    ...JIRA_LIVE_OPTS,
  });
}

/** Release version config per POD (DB-backed, cheap). */
export function useReleaseConfig() {
  return useQuery<ReleaseConfigResponse[]>({
    queryKey: ['jira', 'releases', 'config'],
    queryFn: () => apiClient.get('/jira/releases/config').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

/**
 * Ad-hoc search: fetches release metrics for any Jira fix-version name,
 * broken down one entry per enabled POD that has issues tagged with that version.
 * Only fires when `enabled` is true and `versionName` is non-empty.
 */
export function useSearchReleaseVersion(versionName: string, enabled: boolean) {
  return useQuery<ReleaseMetrics[]>({
    queryKey: ['jira', 'releases', 'search', versionName],
    queryFn: () =>
      apiClient.get(`/jira/releases/search?version=${encodeURIComponent(versionName)}`).then(r => r.data),
    enabled: enabled && versionName.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Fetches Jira sprint issues by date range — finds every Jira sprint (across all enabled
 * POD boards) whose dates overlap the given calendar-sprint window, then returns issues
 * grouped by POD.  Only fires when `enabled` is true and both dates are non-empty.
 */
export function useSprintCalendarIssues(startDate: string, endDate: string, enabled: boolean) {
  return useQuery<ReleaseMetrics[]>({
    queryKey: ['jira', 'sprint-issues', startDate, endDate],
    queryFn: () =>
      apiClient
        .get(`/jira/sprint-issues?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)
        .then(r => r.data),
    enabled: enabled && startDate.length > 0 && endDate.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Saves tracked release versions for a list of PODs. */
export function useSaveReleaseConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqs: ReleaseConfigRequest[]) =>
      apiClient.post('/jira/releases/config', reqs).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'releases', 'config'] });
      qc.removeQueries({ queryKey: ['jira', 'releases'] });
    },
  });
}

/**
 * All fix versions across every enabled POD — for the global version search multi-select.
 * Returns versions annotated with `podNames` (which PODs carry that version).
 * Cached 30 min — matches the cost of loading per-pod versions.
 */
export function useAllFixVersions() {
  return useQuery<JiraFixVersion[]>({
    queryKey: ['jira', 'releases', 'fixversions', 'all'],
    queryFn: () => apiClient.get('/jira/releases/fixversions').then(r => r.data),
    ...JIRA_LIVE_OPTS,
  });
}

/** Available fix versions in Jira for a given POD's boards — for the version picker. */
export function usePodFixVersions(podId: number | null) {
  return useQuery<JiraFixVersion[]>({
    queryKey: ['jira', 'releases', 'fixversions', podId],
    queryFn: () => apiClient.get(`/jira/releases/fixversions/${podId}`).then(r => r.data),
    enabled: podId != null,
    ...JIRA_LIVE_OPTS,
  });
}

// ── CapEx / OpEx types ─────────────────────────────────────────────────

export interface CapexIssue {
  key: string;
  summary: string;
  issueType: string;
  statusName: string;
  statusCategory: string;
  assignee: string;
  assigneeLocation: string;       // "US" or "India"
  podDisplayName: string | null;
  capexCategory: string | null;   // "IDS", "NON-IDS", or null = Untagged
  monthlyHours: number;
  storyPoints: number;
}

export interface CapexCategoryBreakdown {
  category: string;
  issueCount: number;
  totalHours: number;
  totalSP: number;
}

export interface CapexPodBreakdown {
  podName: string;
  hoursByCategory: Record<string, number>;
}

/** Per worklog-author breakdown (hours logged by a person this month). */
export interface WorklogAuthorRow {
  author: string;
  location: string;       // "US" or "India"
  idsHours: number;
  nonIdsHours: number;
  untaggedHours: number;
  totalHours: number;
}

/** Aggregate hours by location (India vs US). */
export interface LocationSummary {
  location: string;
  idsHours: number;
  nonIdsHours: number;
  untaggedHours: number;
  totalHours: number;
  authorCount: number;
}

export interface CapexMonthReport {
  month: string;
  fieldId: string | null;
  totalIssues: number;
  taggedIssues: number;
  untaggedIssues: number;
  totalHours: number;
  breakdown: CapexCategoryBreakdown[];
  podBreakdown: CapexPodBreakdown[];
  issues: CapexIssue[];
  authorBreakdown: WorklogAuthorRow[];
  locationBreakdown: LocationSummary[];
}

export interface JiraField {
  id: string;
  name: string;
  type: string;
}

// ── CapEx hooks ────────────────────────────────────────────────────────

export function useCapexReport(month: string, fieldId?: string) {
  return useQuery<CapexMonthReport>({
    queryKey: ['jira', 'capex', month, fieldId ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ month });
      if (fieldId) params.set('fieldId', fieldId);
      return apiClient.get(`/jira/capex?${params}`).then(r => r.data);
    },
    enabled: !!month,
    ...JIRA_LIVE_OPTS,
  });
}

export function useCapexSettings() {
  return useQuery<{ capexFieldId: string }>({
    queryKey: ['jira', 'capex', 'settings'],
    queryFn: () => apiClient.get('/jira/capex/settings').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

export function useSaveCapexSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { capexFieldId: string }) =>
      apiClient.post('/jira/capex/settings', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'capex', 'settings'] });
    },
  });
}

export function useJiraFields(enabled = true) {
  return useQuery<JiraField[]>({
    queryKey: ['jira', 'fields'],
    queryFn: () => apiClient.get('/jira/capex/fields').then(r => r.data),
    enabled,
    // staleTime: 0 so every time the modal opens (enabled flips true) the
    // data is treated as stale and a fresh fetch fires — prevents a previously
    // cached empty array from being returned permanently.
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 2,
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
      // Invalidate all cached Jira data — marks stale so active queries re-fetch immediately
      qc.invalidateQueries({ queryKey: ['jira', 'projects'] });
      qc.invalidateQueries({ queryKey: ['jira', 'pods'] });
      qc.invalidateQueries({ queryKey: ['jira', 'actuals'] });
      qc.invalidateQueries({ queryKey: ['jira', 'suggestions'] });
      qc.invalidateQueries({ queryKey: ['jira', 'releases'] });
      qc.invalidateQueries({ queryKey: ['jira', 'support'] });
    },
  });
}

// ── Support Queue ──────────────────────────────────────────────────────────────

export interface SupportTicket {
  key: string;
  summary: string;
  status: string | null;
  statusCategory: string | null;
  priority: string | null;
  priorityIconUrl: string | null;
  reporter: string | null;
  assignee: string | null;
  labels: string[];
  created: string | null;
  updated: string | null;
  lastCommentDate: string | null;
  lastCommentSnippet: string | null;
  lastStatusChangeDate: string | null;
  stale: boolean;
  /** "today" | "last3" | "last7" | "older" */
  timeWindow: string;
}

export interface SupportBoardSnapshot {
  configId: number;
  boardId: number;
  boardName: string;
  tickets: SupportTicket[];
  errorMessage: string | null;
}

export interface SupportSnapshot {
  boards: SupportBoardSnapshot[];
  fetchedAt: string;
}

export interface SupportBoard {
  id: number;
  name: string;
  boardId: number | null;
  /** Jira project key, e.g. "AC" or "LR" — preferred over boardId */
  projectKey: string | null;
  /** JSM custom-queue ID from the queue URL, e.g. 1649 */
  queueId: number | null;
  enabled: boolean;
  staleThresholdDays: number;
}

export interface SnapshotDayPoint {
  date: string;
  openCount: number;
  staleCount: number;
  avgAgeDays: number;
}

export interface BoardHistory {
  boardId: number;
  boardName: string;
  history: SnapshotDayPoint[];
}

export interface AvailableBoard {
  id: number;
  name: string;
  type: string;
  location?: { projectName?: string };
}

export function useSupportSnapshot(enabled = true) {
  return useQuery<SupportSnapshot>({
    queryKey: ['jira', 'support', 'snapshot'],
    queryFn: () => apiClient.get('/jira/support/snapshot').then(r => r.data),
    enabled,
    staleTime: 30 * 60_000,   // 30 min — use Refresh button for fresh data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSupportBoards() {
  return useQuery<SupportBoard[]>({
    queryKey: ['jira', 'support', 'boards'],
    queryFn: () => apiClient.get('/jira/support/boards').then(r => r.data),
    staleTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useAvailableBoards(enabled = true) {
  return useQuery<AvailableBoard[]>({
    queryKey: ['jira', 'support', 'available-boards'],
    queryFn: () => apiClient.get('/jira/support/available-boards').then(r => r.data),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSupportHistory(days = 30) {
  return useQuery<BoardHistory[]>({
    queryKey: ['jira', 'support', 'history', days],
    queryFn: () => apiClient.get(`/jira/support/history?days=${days}`).then(r => r.data),
    staleTime: 30 * 60_000,   // 30 min — use Refresh button for fresh data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ── Monthly throughput ──────────────────────────────────────────────────────

export interface MonthPoint {
  month: string;   // "YYYY-MM"
  created: number;
  closed: number;
}

export interface MonthlyThroughput {
  boardId: number;
  boardName: string;
  months: MonthPoint[];
}

export function useSupportMonthlyThroughput(months = 6, enabled = true) {
  return useQuery<MonthlyThroughput[]>({
    queryKey: ['jira', 'support', 'monthly-throughput', months],
    queryFn: () =>
      apiClient.get(`/jira/support/monthly-throughput?months=${months}`).then(r => r.data),
    enabled,
    staleTime: 15 * 60_000,   // 15 min — counts don't change that fast
    refetchOnWindowFocus: false,
  });
}

export function useAllSupportTickets(enabled = false, days = 90) {
  return useQuery<SupportSnapshot>({
    queryKey: ['jira', 'support', 'all-tickets', days],
    queryFn: () => apiClient.get(`/jira/support/all-tickets?days=${days}`).then(r => r.data),
    enabled,
    staleTime: 10 * 60_000,   // 10 min — historical data changes slowly
    refetchOnWindowFocus: false,
  });
}

export function useCaptureSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/jira/support/snapshot/capture').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'support', 'history'] }),
  });
}

export interface BoardUpsertPayload {
  name: string;
  boardId?: number | null;
  projectKey?: string | null;
  queueId?: number | null;
  enabled?: boolean;
  staleThresholdDays: number;
}

export function useCreateSupportBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BoardUpsertPayload) =>
      apiClient.post('/jira/support/boards', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'support', 'boards'] }),
  });
}

export function useUpdateSupportBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & BoardUpsertPayload) =>
      apiClient.put(`/jira/support/boards/${id}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'support', 'boards'] }),
  });
}

export function useDeleteSupportBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/jira/support/boards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'support', 'boards'] }),
  });
}

// ── Worklog Report ─────────────────────────────────────────────────────────────

export interface WorklogIssueEntry {
  issueKey: string;
  summary: string;
  issueType: string;
  projectKey: string;
  hoursLogged: number;
}

export interface WorklogUserRow {
  author: string;
  totalHours: number;
  issueTypeBreakdown: Record<string, number>;
  issues: WorklogIssueEntry[];
  homePodName: string | null;   // planning POD the resource is formally assigned to
  isBuffer: boolean;            // true if this person logged to any non-home POD
  bufferPods: string[];         // POD names where they contributed as buffer
}

export interface WorklogMonthReport {
  month: string;
  totalUsers: number;
  totalHours: number;
  issueTypeBreakdown: Record<string, number>;
  users: WorklogUserRow[];
}

export function useWorklogReport(month: string, projectKey?: string) {
  return useQuery<WorklogMonthReport>({
    queryKey: ['jira', 'worklog', month, projectKey ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ month });
      if (projectKey) params.set('projectKey', projectKey);
      return apiClient.get(`/jira/worklog?${params}`).then(r => r.data);
    },
    enabled: !!month,
    ...JIRA_LIVE_OPTS,
  });
}

export interface UserMonthPoint {
  month: string;
  monthLabel: string;
  totalHours: number;
  issueTypeBreakdown: Record<string, number>;
}

export interface UserHistoryReport {
  author: string;
  months: UserMonthPoint[];
}

export function useWorklogUserHistory(author: string | null, months = 6) {
  return useQuery<UserHistoryReport>({
    queryKey: ['jira', 'worklog', 'history', author, months],
    queryFn: () =>
      apiClient.get(`/jira/worklog/user-history?author=${encodeURIComponent(author!)}&months=${months}`)
        .then(r => r.data),
    enabled: !!author,
    ...JIRA_LIVE_OPTS,
  });
}

// ── Jira Analytics Dashboard ──────────────────────────────────────────────

export interface AnalyticsBreakdown {
  name: string;
  count: number;
  sp?: number;
  hours?: number;
}

export interface AnalyticsWorkload {
  assignee: string;
  total: number;
  bugs: number;
  highPriority: number;
  sp: number;
}

export interface AnalyticsTrend {
  week: string;
  created: number;
  resolved: number;
}

export interface AnalyticsBugTrend {
  month: string;
  bugs: number;
  total: number;
  bugRate: number;
}

export interface AnalyticsBucket {
  bucket: string;
  count: number;
}

export interface AnalyticsKpis {
  totalOpen: number;
  totalCreated: number;
  totalResolved: number;
  bugCount: number;
  bugRatio: number;
  avgCycleTimeDays: number;
  throughputPerWeek: number;
  totalSPResolved: number;
  totalHoursLogged: number;
}

export interface JiraAnalyticsData {
  lookbackMonths: number;
  projectKeys: string[];
  podNames: string[];
  totalResolved: number;
  totalCreated: number;
  totalOpen: number;
  kpis: AnalyticsKpis;
  byType: AnalyticsBreakdown[];
  byStatus: AnalyticsBreakdown[];
  byPriority: AnalyticsBreakdown[];
  byAssignee: AnalyticsBreakdown[];
  byLabel: AnalyticsBreakdown[];
  byComponent: AnalyticsBreakdown[];
  byPod: AnalyticsBreakdown[];
  byFixVersion: AnalyticsBreakdown[];
  createdVsResolved: AnalyticsTrend[];
  workload: AnalyticsWorkload[];
  aging: AnalyticsBucket[];
  cycleTime: AnalyticsBucket[];
  bugTrend: AnalyticsBugTrend[];
  statusCategoryBreakdown: Record<string, number>;
  byWorklogAuthor?: { name: string; hours: number }[];
  lastSyncAt?: string;
  needsSync?: boolean;
  error?: string;
}

export interface AnalyticsFilterPod {
  id: number;
  name: string;
  projectKeys: string[];
}

export interface AnalyticsFilters {
  pods: AnalyticsFilterPod[];
}

export function useJiraAnalytics(months?: number, pods?: string) {
  return useQuery<JiraAnalyticsData>({
    queryKey: ['jira', 'analytics', months ?? 3, pods ?? 'all'],
    queryFn: () => apiClient.get('/jira/analytics', {
      params: { ...(months ? { months } : {}), ...(pods ? { pods } : {}) },
    }).then(r => r.data),
    staleTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useJiraAnalyticsFilters() {
  return useQuery<AnalyticsFilters>({
    queryKey: ['jira', 'analytics', 'filters'],
    queryFn: () => apiClient.get('/jira/analytics/filters').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

// ── Custom Jira Dashboards ────────────────────────────────────────────────

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  dataKey?: string;
  size: 'full' | 'half' | 'third' | 'quarter';
  enabled: boolean;
  chartType?: string;       // for custom widgets: bar | donut | line | area | horizontalBar | table
  groupBy?: string;         // for custom widgets: the data field to chart
}

export interface JiraDashboardConfig {
  id: number;
  name: string;
  description?: string;
  username: string;
  isDefault: boolean;
  widgetsJson: string;
  filtersJson: string;
  createdAt: string;
  updatedAt: string;
}

export function useJiraDashboards() {
  return useQuery<JiraDashboardConfig[]>({
    queryKey: ['jira', 'dashboards'],
    queryFn: () => apiClient.get('/jira/dashboards').then(r => r.data),
    ...JIRA_CHEAP_OPTS,
  });
}

export function useJiraDashboard(id: number | null) {
  return useQuery<JiraDashboardConfig>({
    queryKey: ['jira', 'dashboards', id],
    queryFn: () => apiClient.get(`/jira/dashboards/${id}`).then(r => r.data),
    enabled: id !== null,
    ...JIRA_CHEAP_OPTS,
  });
}

export function useSaveDashboard() {
  const qc = useQueryClient();
  return useMutation<JiraDashboardConfig, Error, { id?: number; name?: string; description?: string; widgetsJson?: string; filtersJson?: string }>({
    mutationFn: (data) => {
      if (data.id) {
        return apiClient.put(`/jira/dashboards/${data.id}`, data).then(r => r.data);
      }
      return apiClient.post('/jira/dashboards', data).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'dashboards'] }),
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiClient.delete(`/jira/dashboards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'dashboards'] }),
  });
}

export function useCloneDashboard() {
  const qc = useQueryClient();
  return useMutation<JiraDashboardConfig, Error, number>({
    mutationFn: (id) => apiClient.post(`/jira/dashboards/${id}/clone`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira', 'dashboards'] }),
  });
}

// ── Jira Sync ────────────────────────────────────────────────────────────

export interface JiraSyncProjectStatus {
  projectKey: string;
  boardType: string;
  status: string;        // IDLE | RUNNING | FAILED
  lastSyncAt: string | null;
  lastFullSync: string | null;
  issuesSynced: number;
  errorMessage: string | null;
}

export interface JiraSyncStatus {
  syncing: boolean;
  projects: JiraSyncProjectStatus[];
}

export function useJiraSyncStatus() {
  return useQuery<JiraSyncStatus>({
    queryKey: ['jira', 'sync', 'status'],
    queryFn: () => apiClient.get('/jira/sync/status').then(r => r.data),
    refetchInterval: 10_000,   // poll every 10s while viewing sync page
    staleTime: 5_000,
  });
}

export function useTriggerJiraSync() {
  const qc = useQueryClient();
  return useMutation<{ status: string; message: string }, Error, boolean>({
    mutationFn: (fullSync) =>
      apiClient.post('/jira/sync/trigger', null, { params: { fullSync } }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jira', 'sync', 'status'] });
      // Sync runs @Async on the backend — invalidate all data caches in multiple waves
      // so the UI refreshes as soon as the sync completes regardless of how long it takes.
      const invalidateAll = () => {
        qc.invalidateQueries({ queryKey: ['jira', 'analytics'] });
        qc.invalidateQueries({ queryKey: ['jira', 'actuals'] });
        qc.invalidateQueries({ queryKey: ['jira', 'worklog'] });
        qc.invalidateQueries({ queryKey: ['jira', 'capex'] });
        qc.invalidateQueries({ queryKey: ['reports'] });      // DORA, productivity, etc.
        qc.invalidateQueries({ queryKey: ['jira', 'sync', 'status'] });
      };
      setTimeout(invalidateAll, 5000);   // fast syncs
      setTimeout(invalidateAll, 15000);  // medium syncs
      setTimeout(invalidateAll, 30000);  // large syncs
    },
  });
}
