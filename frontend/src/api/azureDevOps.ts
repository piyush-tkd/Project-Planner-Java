import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdoSettings {
  orgUrl:               string;
  projectName:          string;
  personalAccessToken:  string;   // masked as •••••••• when returned from API
  repositories:         string;   // comma-separated
  configured:           boolean;
}

export interface AdoStatus {
  configured: boolean;
  repos:      string[];
}

export interface AdoPr {
  id:             number;
  title:          string;
  status:         string;
  author:         string;
  reviewers:      string[];
  createdDate:    string | null;
  closedDate:     string | null;
  cycleTimeHours: number | null;
  repo:           string;
}

export interface AdoCommitSummary {
  totalCommits:  number;
  uniqueAuthors: number;
  dailyTotals:   { date: string; count: number }[];
  byAuthor:      { author: string; byDay: Record<string, number> }[];
}

export interface AdoBranch {
  name:      string;
  repo:      string;
  createdBy: string | null;
}

export interface AdoSummary {
  prsMerged:      number;
  commits:        number;
  avgCycleHours:  number;
  contributors:   number;
  repoCount:      number;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function useAdoSettings() {
  return useQuery<AdoSettings>({
    queryKey: ['ado-settings'],
    queryFn:  () => apiClient.get('/azure-devops/settings').then(r => r.data),
  });
}

export function useSaveAdoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<AdoSettings, 'configured'>) =>
      apiClient.put('/azure-devops/settings', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ado-settings'] });
      qc.invalidateQueries({ queryKey: ['ado-status'] });
    },
  });
}

export function useAdoStatus() {
  return useQuery<AdoStatus>({
    queryKey: ['ado-status'],
    queryFn:  () => apiClient.get('/azure-devops/status').then(r => r.data),
  });
}

export function useAdoTestConnection() {
  return useMutation({
    mutationFn: () => apiClient.get('/azure-devops/settings/test').then(r => r.data),
  });
}

// ── Data queries ──────────────────────────────────────────────────────────────

export function useAdoSummary(days: number) {
  return useQuery<AdoSummary>({
    queryKey: ['ado-summary', days],
    queryFn:  () => apiClient.get('/azure-devops/summary', { params: { days } }).then(r => r.data),
    enabled:  true,
  });
}

export function useAdoPrs(repo: string | null, days: number) {
  return useQuery<AdoPr[]>({
    queryKey: ['ado-prs', repo, days],
    queryFn:  () => apiClient.get('/azure-devops/prs', {
      params: { ...(repo ? { repo } : {}), days },
    }).then(r => r.data),
  });
}

export function useAdoCommits(repo: string | null, days: number) {
  return useQuery<AdoCommitSummary>({
    queryKey: ['ado-commits', repo, days],
    queryFn:  () => apiClient.get('/azure-devops/commits', {
      params: { ...(repo ? { repo } : {}), days },
    }).then(r => r.data),
  });
}

export function useAdoBranches(repo: string | null) {
  return useQuery<AdoBranch[]>({
    queryKey: ['ado-branches', repo],
    queryFn:  () => apiClient.get('/azure-devops/branches', {
      params: { ...(repo ? { repo } : {}) },
    }).then(r => r.data),
  });
}
