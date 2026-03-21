import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NlpResponsePayload {
  message: string | null;
  route: string | null;
  formData: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  drillDown: string | null;
}

export interface NlpQueryResponse {
  intent: string;
  confidence: number;
  resolvedBy: string;
  response: NlpResponsePayload;
  suggestions: string[];
  queryLogId: number | null;
}

export interface NlpCatalogPageInfo {
  id: string;
  route: string;
  title: string;
  description: string;
  aliases: string[];
}

export interface NlpCatalogResourceInfo {
  id: number;
  name: string;
  role: string;
  location: string;
  podName: string;
  billingRate: string;
  fte: string;
}

export interface NlpCatalogProjectInfo {
  id: number;
  name: string;
  priority: string;
  owner: string;
  status: string;
  assignedPods: string;
  timeline: string;
  durationMonths: string;
  client: string | null;
}

export interface NlpCatalogPodInfo {
  id: number;
  name: string;
  memberCount: number;
  projectCount: number;
  avgBauPct: string;
  active: boolean;
  members: string[];
  projectNames: string[];
}

export interface NlpCatalogSprintInfo {
  id: number;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  lockInDate: string | null;
  status: string;
}

export interface NlpCatalogReleaseInfo {
  id: number;
  name: string;
  releaseDate: string;
  codeFreezeDate: string;
  type: string;
  notes: string | null;
  status: string;
}

export interface NlpCatalogCostRateInfo {
  role: string;
  location: string;
  hourlyRate: string;
}

export interface NlpCatalogTshirtSizeInfo {
  name: string;
  baseHours: number;
}

export interface NlpCatalogResponse {
  pods: string[];
  projects: string[];
  resources: string[];
  sprints: string[];
  releases: string[];
  roles: string[];
  statuses: string[];
  pages: NlpCatalogPageInfo[];
  resourceDetails: NlpCatalogResourceInfo[];
  projectDetails: NlpCatalogProjectInfo[];
  podDetails: NlpCatalogPodInfo[];
  sprintDetails: NlpCatalogSprintInfo[];
  releaseDetails: NlpCatalogReleaseInfo[];
  costRates: NlpCatalogCostRateInfo[];
  tshirtSizes: NlpCatalogTshirtSizeInfo[];
}

export interface NlpStrategyStatus {
  available: boolean;
  message: string | null;
  avgResponseMs: number | null;
}

export interface NlpConfigResponse {
  strategyChain: string[];
  confidenceThreshold: number;
  cloudProvider: string;
  cloudModel: string;
  cloudApiKeySet: boolean;
  localModelUrl: string;
  localModel: string;
  localTimeoutMs: number;
  cacheEnabled: boolean;
  cacheTtlMinutes: number;
  logQueries: boolean;
  maxTimeoutMs: number;
  strategyStatuses: Record<string, NlpStrategyStatus>;
}

export interface NlpConfigRequest {
  strategyChain?: string[];
  confidenceThreshold?: number;
  cloudProvider?: string;
  cloudModel?: string;
  cloudApiKey?: string;
  localModelUrl?: string;
  localModel?: string;
  localTimeoutMs?: number;
  cacheEnabled?: boolean;
  cacheTtlMinutes?: number;
  logQueries?: boolean;
  maxTimeoutMs?: number;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** Fire a natural-language query. Use as a mutation so the caller controls when it fires. */
export function useNlpQuery() {
  return useMutation<NlpQueryResponse, Error, string>({
    mutationFn: (query: string) =>
      apiClient.post('/nlp/query', { query }, { timeout: 90000 }).then(r => r.data),
  });
}

/** Warm up the NLP catalog cache on the backend so queries are fast. */
export function useNlpCatalogWarmup() {
  return useQuery<NlpCatalogResponse>({
    queryKey: ['nlp-catalog-warmup'],
    queryFn: () => apiClient.get('/nlp/catalog', { timeout: 90000 }).then(r => r.data),
    staleTime: 4 * 60 * 1000, // Re-warm before 5-min cache TTL
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Entity catalog — cached, used for autocomplete chips. */
export function useNlpCatalog() {
  return useQuery<NlpCatalogResponse>({
    queryKey: ['nlp-catalog'],
    queryFn: () => apiClient.get('/nlp/catalog', { timeout: 90000 }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/** NLP configuration (admin). */
export function useNlpConfig() {
  return useQuery<NlpConfigResponse>({
    queryKey: ['nlp-config'],
    queryFn: () => apiClient.get('/nlp/config').then(r => r.data),
  });
}

/** Update NLP configuration (admin). */
export function useUpdateNlpConfig() {
  return useMutation<NlpConfigResponse, Error, NlpConfigRequest>({
    mutationFn: (data) =>
      apiClient.put('/nlp/config', data).then(r => r.data),
  });
}

/** Test strategy connections. */
export function useTestNlpConnection() {
  return useMutation<NlpConfigResponse, Error, void>({
    mutationFn: () =>
      apiClient.post('/nlp/test-connection').then(r => r.data),
  });
}

// ── Learner / Optimizer Types ──────────────────────────────────────────────

export interface NlpQueryLog {
  id: number;
  userId: number | null;
  queryText: string;
  intent: string | null;
  confidence: number | null;
  resolvedBy: string | null;
  responseMs: number | null;
  entityName: string | null;
  userRating: number | null;
  feedbackComment: string | null;
  feedbackScreenshot: string | null;
  expectedIntent: string | null;
  createdAt: string;
}

export interface NlpLearnedPattern {
  id: number;
  queryPattern: string;
  patternType: string;
  resolvedIntent: string;
  entityName: string | null;
  route: string | null;
  confidence: number;
  source: string;
  timesSeen: number;
  positiveVotes: number;
  negativeVotes: number;
  active: boolean;
  corrective: boolean;
  keywords: string | null;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NlpLearnerStats {
  totalQueries: number;
  unknownQueries: number;
  lowConfidenceQueries: number;
  positiveRatings: number;
  negativeRatings: number;
  activePatterns: number;
  newPatternsGenerated: number;
  intentDistribution: Record<string, number>;
  strategyAvgConfidence: Record<string, number>;
}

export interface NlpLearnerRunHistory {
  id: number;
  runAt: string;
  durationMs: number | null;
  totalQueries: number;
  unknownQueries: number;
  lowConfidence: number;
  positiveRatings: number;
  negativeRatings: number;
  activePatterns: number;
  newPatterns: number;
  strategyCount: number;
  intentDistribution: string | null;
  strategyConfidence: string | null;
  triggeredBy: string;
}

// ── Learner / Optimizer Hooks ──────────────────────────────────────────────

/** Submit feedback (thumbs up/down) on an NLP query, with optional explanation, screenshot. */
export function useNlpFeedback() {
  return useMutation<void, Error, { queryLogId: number; rating: number; comment?: string; screenshot?: string }>({
    mutationFn: (data) =>
      apiClient.post('/nlp/feedback', data).then(r => r.data),
  });
}

/** Undo feedback within the undo window. */
export function useNlpFeedbackUndo() {
  return useMutation<void, Error, { queryLogId: number }>({
    mutationFn: (data) =>
      apiClient.post('/nlp/feedback/undo', data).then(r => r.data),
  });
}

/** Run the NLP learner analysis (admin). */
export function useRunNlpLearner() {
  return useMutation<NlpLearnerStats, Error, void>({
    mutationFn: () =>
      apiClient.post('/nlp/learner/run').then(r => r.data),
  });
}

/** Get low-confidence query logs. */
export function useNlpLowConfidenceLogs() {
  return useQuery<NlpQueryLog[]>({
    queryKey: ['nlp-low-confidence'],
    queryFn: () => apiClient.get('/nlp/learner/low-confidence').then(r => r.data),
  });
}

/** Get negatively-rated query logs. */
export function useNlpNegativeRatedLogs() {
  return useQuery<NlpQueryLog[]>({
    queryKey: ['nlp-negative-rated'],
    queryFn: () => apiClient.get('/nlp/learner/negative-rated').then(r => r.data),
  });
}

/** Get all learned patterns. */
export function useNlpLearnedPatterns() {
  return useQuery<NlpLearnedPattern[]>({
    queryKey: ['nlp-patterns'],
    queryFn: () => apiClient.get('/nlp/learner/patterns').then(r => r.data),
  });
}

/** Toggle a learned pattern active/inactive. */
export function useToggleNlpPattern() {
  return useMutation<NlpLearnedPattern, Error, number>({
    mutationFn: (id) =>
      apiClient.put(`/nlp/learner/patterns/${id}/toggle`).then(r => r.data),
  });
}

/** Delete a learned pattern. */
export function useDeleteNlpPattern() {
  return useMutation<void, Error, number>({
    mutationFn: (id) =>
      apiClient.delete(`/nlp/learner/patterns/${id}`).then(r => r.data),
  });
}

/** Get learner run history for trend analysis. */
export function useNlpLearnerRunHistory() {
  return useQuery<NlpLearnerRunHistory[]>({
    queryKey: ['nlp-learner-history'],
    queryFn: () => apiClient.get('/nlp/learner/history').then(r => r.data),
  });
}
