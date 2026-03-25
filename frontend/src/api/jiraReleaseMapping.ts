import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────

export interface LinkedVersion {
  mappingId: number;
  versionName: string;
  projectKey: string | null;
  matchType: string;
  confidence: number | null;
}

export interface ReleaseMappingResponse {
  id: number | null;
  releaseCalendarId: number;
  releaseName: string;
  releaseDate: string;
  codeFreezeDate: string;
  releaseType: string;
  linkedVersions: LinkedVersion[];
  mappingType: string | null;
  confidence: number | null;
}

export interface JiraFixVersionInfo {
  versionName: string;
  projectKey: string;
  releaseDate: string | null;
  released: boolean;
  issueCount: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────

const MAPPING_KEY = ['jira-release-mappings'];

export function useReleaseMappings() {
  return useQuery<ReleaseMappingResponse[]>({
    queryKey: MAPPING_KEY,
    queryFn: () => apiClient.get('/jira/release-mappings').then(r => r.data),
  });
}

export function useFixVersionsScan() {
  return useQuery<JiraFixVersionInfo[]>({
    queryKey: [...MAPPING_KEY, 'fix-versions'],
    queryFn: () => apiClient.get('/jira/release-mappings/fix-versions').then(r => r.data),
  });
}

export function useAutoMatchReleases() {
  const qc = useQueryClient();
  return useMutation<ReleaseMappingResponse[]>({
    mutationFn: () => apiClient.post('/jira/release-mappings/auto-match').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useSaveReleaseMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { releaseCalendarId: number; jiraVersionName: string; jiraProjectKey: string | null; mappingType: string }) =>
      apiClient.post('/jira/release-mappings', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useSaveBulkReleaseMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseCalendarId, mappings }: {
      releaseCalendarId: number;
      mappings: { releaseCalendarId: number; jiraVersionName: string; jiraProjectKey: string | null; mappingType: string }[];
    }) => apiClient.put(`/jira/release-mappings/${releaseCalendarId}`, mappings).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}

export function useDeleteReleaseMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/jira/release-mappings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MAPPING_KEY });
    },
  });
}
