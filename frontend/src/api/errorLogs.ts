import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface AppErrorLog {
  id: number;
  source: string;
  severity: string;
  errorType: string | null;
  message: string;
  stackTrace: string | null;
  pageUrl: string | null;
  apiEndpoint: string | null;
  httpStatus: number | null;
  userAgent: string | null;
  username: string | null;
  component: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface ErrorLogSummary {
  total: number;
  unresolved: number;
  frontend: number;
  backend: number;
  errors: number;
  warnings: number;
}

export interface LogErrorPayload {
  source: string;
  severity?: string;
  errorType?: string;
  message: string;
  stackTrace?: string;
  pageUrl?: string;
  apiEndpoint?: string;
  httpStatus?: number;
  userAgent?: string;
  component?: string;
  username?: string;
}

export function useErrorLogs() {
  return useQuery<AppErrorLog[]>({
    queryKey: ['error-logs'],
    queryFn: () => apiClient.get('/error-logs').then(r => r.data),
  });
}

export function useErrorLogSummary() {
  return useQuery<ErrorLogSummary>({
    queryKey: ['error-logs-summary'],
    queryFn: () => apiClient.get('/error-logs/summary').then(r => r.data),
  });
}

export function useLogError() {
  return useMutation<AppErrorLog, Error, LogErrorPayload>({
    mutationFn: (data) => apiClient.post('/error-logs', data).then(r => r.data),
  });
}

export function useResolveError() {
  const qc = useQueryClient();
  return useMutation<AppErrorLog, Error, number>({
    mutationFn: (id) => apiClient.put(`/error-logs/${id}/resolve`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-logs'] });
      qc.invalidateQueries({ queryKey: ['error-logs-summary'] });
    },
  });
}

export function useDeleteErrorLog() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiClient.delete(`/error-logs/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-logs'] });
      qc.invalidateQueries({ queryKey: ['error-logs-summary'] });
    },
  });
}

export function useClearResolvedErrors() {
  const qc = useQueryClient();
  return useMutation<{ deleted: number }, Error, void>({
    mutationFn: () => apiClient.delete('/error-logs/clear-resolved').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-logs'] });
      qc.invalidateQueries({ queryKey: ['error-logs-summary'] });
    },
  });
}

/**
 * Standalone function for logging errors outside React components (e.g., in interceptors).
 * Does a fire-and-forget POST.
 */
export function logErrorToServer(payload: LogErrorPayload) {
  apiClient.post('/error-logs', payload).catch(() => {
    // Silently fail — we don't want error logging to cause more errors
  });
}
