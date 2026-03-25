import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface JiraUserInfo {
  displayName: string;
  accountId: string | null;
  issueCount: number;
  hoursLogged: number;
}

export interface BufferEntry {
  jiraDisplayName: string;
  jiraAccountId: string | null;
  issueCount: number;
  hoursLogged: number;
  projectKeys: string[];
}

export interface BufferStats {
  totalResources: number;
  mappedResources: number;
  unmappedResources: number;
  bufferCount: number;
}

export interface AutoMatchSuggestion {
  resourceId: number;
  resourceName: string;
  suggestedJiraName: string;
  suggestedJiraAccountId: string | null;
  confidence: number;
  matchReason: string;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

const BUFFER_KEY = ['jira-buffer'];
const JIRA_USERS_KEY = ['jira-users'];

/** All Jira display names — used for the resource form dropdown */
export function useJiraUsers() {
  return useQuery({
    queryKey: JIRA_USERS_KEY,
    queryFn: () => apiClient.get<JiraUserInfo[]>('/jira/buffer/jira-users').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

/** Buffer users: logged hours in configured PODs but not mapped to a resource */
export function useBufferUsers() {
  return useQuery({
    queryKey: [...BUFFER_KEY, 'users'],
    queryFn: () => apiClient.get<BufferEntry[]>('/jira/buffer').then(r => r.data),
  });
}

/** Stats for the buffer page */
export function useBufferStats() {
  return useQuery({
    queryKey: [...BUFFER_KEY, 'stats'],
    queryFn: () => apiClient.get<BufferStats>('/jira/buffer/stats').then(r => r.data),
  });
}

/** Auto-match suggestions for unmapped resources */
export function useAutoMatchSuggestions() {
  return useQuery({
    queryKey: [...BUFFER_KEY, 'suggestions'],
    queryFn: () => apiClient.get<AutoMatchSuggestion[]>('/jira/buffer/auto-match-suggestions').then(r => r.data),
  });
}

/** Apply auto-match */
export function useApplyAutoMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (minConfidence: number) =>
      apiClient.post<{ matched: number }>('/jira/buffer/auto-match', { minConfidence }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      qc.invalidateQueries({ queryKey: BUFFER_KEY });
      qc.invalidateQueries({ queryKey: JIRA_USERS_KEY });
    },
  });
}
