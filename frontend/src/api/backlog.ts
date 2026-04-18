import { useQuery, useQueries } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PodSummary {
  id: number;
  displayName: string;
  projectKeys: string[];
}

export interface IssueRow {
  key: string;
  summary: string;
  issueType: string;
  statusName: string;
  statusCategory: string | null;
  priorityName: string | null;
  assignee: string | null;
  assigneeAvatarUrl: string | null;
  storyPoints: number | null;
  epicName: string | null;
  epicKey: string | null;
  fixVersionName: string | null;
  subtask: boolean | null;
  parentKey: string | null;
  subtasks: IssueRow[];
  createdAt: string | null;
  /** ISO date string yyyy-MM-dd, or null if no due date in Jira */
  dueDate: string | null;
  /** Days issue has been in its current status */
  timeInCurrentStatusDays: number | null;
  /** All synced custom fields for this issue, keyed by field name (e.g. "BA Owner") */
  customFields: Record<string, string>;
}

export interface SprintGroup {
  sprintJiraId: number;
  boardId: number | null;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  totalCount: number;
  issues: IssueRow[];
}

export interface BacklogGroup {
  totalCount: number;
  issues: IssueRow[];
}

export interface BacklogResponse {
  podId: number;
  podDisplayName: string;
  projectKeys: string[];
  sprints: SprintGroup[];
  backlog: BacklogGroup;
  syncedAt: string | null;
}

/** Issue row augmented with which POD it belongs to — used by cross-pod views */
export interface IssueWithPod extends IssueRow {
  podId: number;
  podDisplayName: string;
  sprintName: string | null;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export interface SprintNameEntry {
  name: string;
  state: 'active' | 'closed';
}

export function usePodList() {
  return useQuery<PodSummary[]>({
    queryKey: ['backlog', 'pods'],
    queryFn: () => apiClient.get('/backlog/pods').then(r => r.data),
    staleTime: 5 * 60_000,
  });
}

/**
 * Lightweight list of sprint names + states across all enabled PODs.
 * Active sprints first, then closed (last 90 days) by end date desc.
 */
export function useSprintNames() {
  return useQuery<SprintNameEntry[]>({
    queryKey: ['backlog', 'sprint-names'],
    queryFn: () => apiClient.get<SprintNameEntry[]>('/backlog/sprint-names').then(r => r.data),
    staleTime: 10 * 60_000,
  });
}

export function usePodBacklog(podId: number | null, view = 'active') {
  return useQuery<BacklogResponse>({
    queryKey: ['backlog', podId, view],
    queryFn: () => apiClient.get(`/backlog/${podId}?view=${view}`).then(r => r.data),
    enabled: podId !== null,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Loads active-sprint issues across ALL pods in parallel.
 * Returns a merged flat list of IssueWithPod, plus loading/error state.
 */
export function useAllActiveSprintIssues() {
  const { data: pods = [], isLoading: podsLoading } = usePodList();

  const results = useQueries({
    queries: pods.map(pod => ({
      queryKey: ['backlog', pod.id, 'active'],
      queryFn: () =>
        apiClient.get<BacklogResponse>(`/backlog/${pod.id}?view=active`).then(r => r.data),
      staleTime: 5 * 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    })),
  });

  const isLoading = podsLoading || results.some(r => r.isLoading);
  const isError   = results.some(r => r.isError);

  const issues: IssueWithPod[] = results.flatMap((r, idx) => {
    const pod = pods[idx];
    if (!pod || !r.data) return [];
    // Only active sprints
    const activeSprints = r.data.sprints.filter(s => s.state === 'active');
    return activeSprints.flatMap(sprint =>
      sprint.issues.map(issue => ({
        ...issue,
        podId: pod.id,
        podDisplayName: pod.displayName,
        sprintName: sprint.name,
      }))
    );
  });

  return { issues, isLoading, isError };
}
