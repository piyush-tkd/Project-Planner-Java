import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NlpResponsePayload {
  message: string | null;
  route: string | null;
  formData: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  drillDown: string | null;
  shape?: string | null;
}

export interface NlpQueryResponse {
  intent: string;
  confidence: number;
  resolvedBy: string;
  response: NlpResponsePayload;
  suggestions: string[];
  queryLogId: number | null;
  debug?: Record<string, unknown> | null;
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

/** Fire a natural-language query with optional session context. */
export function useNlpQuery() {
  return useMutation<NlpQueryResponse, Error, { query: string; sessionContext?: string }>({
    mutationFn: ({ query, sessionContext }) =>
      apiClient.post('/nlp/query', { query, sessionContext }, { timeout: 90000 }).then(r => r.data),
  });
}

/** Execute a tool directly, bypassing the NLP pipeline (Phase 0.2 — insight cards). */
export async function directToolCall(toolName: string, params: Record<string, string>): Promise<NlpQueryResponse> {
  const response = await apiClient.post('/nlp/direct-tool', { toolName, params });
  return response.data;
}

// ── SSE Streaming Types ──────────────────────────────────────────────────────

export interface NlpStreamPhase {
  phase: string;
  message: string;
  detail: string;
}

export interface NlpStreamCallbacks {
  onPhase: (phase: NlpStreamPhase) => void;
  onResult: (result: NlpQueryResponse) => void;
  onError: (error: Error) => void;
}

/**
 * Stream an NLP query with real-time progress events via SSE.
 * Returns an abort function to cancel the stream.
 */
export function streamNlpQuery(query: string, callbacks: NlpStreamCallbacks, sessionContext?: string): () => void {
  const controller = new AbortController();
  const token = localStorage.getItem('pp_token');

  fetch('/api/nlp/query/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, sessionContext }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let gotResult = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventName = '';
        let eventData = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          } else if (line === '' && eventName && eventData) {
            try {
              const parsed = JSON.parse(eventData);
              if (eventName === 'phase') {
                callbacks.onPhase(parsed);
              } else if (eventName === 'result') {
                gotResult = true;
                callbacks.onResult(parsed);
              }
            } catch {
              // Ignore parse errors for non-JSON events
            }
            eventName = '';
            eventData = '';
          }
        }
      }

      // Stream ended without a result event — fall back to POST
      if (!gotResult) {
        throw new Error('SSE stream completed without result');
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err);
      }
    });

  return () => controller.abort();
}

// ── Proactive Insights ──────────────────────────────────────────────────────

export interface NlpInsightCard {
  id: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  query: string;
  toolName?: string;
  toolParams?: Record<string, string>;
  filters?: Record<string, string>;
  drillDownRoute?: string;
}

/** Fetch proactive insight cards for the Ask AI landing page. */
export function useNlpInsights() {
  return useQuery<NlpInsightCard[]>({
    queryKey: ['nlp-insights'],
    queryFn: () => apiClient.get('/nlp/insights').then(r => r.data),
    staleTime: 2 * 60 * 1000, // Refresh every 2 min
    retry: 1,
    refetchOnWindowFocus: false,
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

// ── Health Check ─────────────────────────────────────────────────────────────

export interface NlpHealthStatus {
  pgvector: boolean;
  ollama: boolean;
  cloudLlm: boolean;
  /** FULL | DB_ONLY | REGEX_ONLY */
  tier: 'FULL' | 'DB_ONLY' | 'REGEX_ONLY';
  strategyAvailability: Record<string, boolean>;
  activeChain: string[];
}

/**
 * Lightweight health check — polled every 60 seconds.
 * Used by the frontend to show a degraded-mode banner when the LLM is unavailable.
 */
export function useNlpHealth() {
  return useQuery<NlpHealthStatus>({
    queryKey: ['nlp-health'],
    queryFn: () => apiClient.get('/nlp/health').then(r => r.data),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ── Smart Autocomplete ────────────────────────────────────────────────────

/**
 * Server-side autocomplete suggestions — returns up to 5 example phrases
 * matching the partial query. Enabled only when query.length >= 2.
 * Uses a 300ms debounce on the caller side; staleTime=30s so rapid keystrokes
 * hit the cache rather than the server.
 */
export function useNlpSuggest(query: string) {
  return useQuery<string[]>({
    queryKey: ['nlp-suggest', query],
    queryFn: () =>
      apiClient.get('/nlp/suggest', { params: { q: query } }).then(r => r.data),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
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

// ── Conversation Types ─────────────────────────────────────────────────────

export interface NlpConversationMessage {
  id: number;
  role: string;
  content: string;
  intent: string | null;
  confidence: number | null;
  resolvedBy: string | null;
  response: NlpResponsePayload | null;
  suggestions: string[];
  toolCalls: Array<Record<string, unknown>>;
  responseMs: number | null;
  createdAt: string;
}

export interface NlpConversationSummary {
  id: number;
  title: string;
  pinned: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NlpConversationDetail extends NlpConversationSummary {
  messages: NlpConversationMessage[];
}

// ── Conversation Hooks ─────────────────────────────────────────────────────

/** Get all conversations for the user. */
export function useNlpConversations() {
  return useQuery<NlpConversationSummary[]>({
    queryKey: ['nlp-conversations'],
    queryFn: () => apiClient.get('/nlp/conversations').then(r => r.data),
  });
}

/** Get a specific conversation with all its messages. */
export function useNlpConversation(id: number | null) {
  return useQuery<NlpConversationDetail>({
    queryKey: ['nlp-conversation', id],
    queryFn: () => apiClient.get(`/nlp/conversations/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

/** Create a new conversation. */
export function useCreateNlpConversation() {
  return useMutation<NlpConversationSummary, Error, { title?: string }>({
    mutationFn: (data) =>
      apiClient.post('/nlp/conversations', data).then(r => r.data),
  });
}

/** Send a message to a conversation. */
export function useSendNlpMessage() {
  return useMutation<NlpConversationMessage, Error, { conversationId: number; message: string }>({
    mutationFn: (data) =>
      apiClient.post(`/nlp/conversations/${data.conversationId}/messages`, { message: data.message }).then(r => r.data),
  });
}

/** Delete a conversation. */
export function useDeleteNlpConversation() {
  return useMutation<void, Error, number>({
    mutationFn: (id) =>
      apiClient.delete(`/nlp/conversations/${id}`).then(r => r.data),
  });
}

/** Toggle pin status on a conversation. */
export function useToggleNlpPin() {
  return useMutation<NlpConversationSummary, Error, number>({
    mutationFn: (id) =>
      apiClient.put(`/nlp/conversations/${id}/pin`).then(r => r.data),
  });
}

/** Get conversation context JSON for restoring session memory on resume. */
export function useNlpConversationContext(conversationId: number | null) {
  return useQuery<string | null>({
    queryKey: ['nlp-conversation-context', conversationId],
    queryFn: () => conversationId
      ? apiClient.get(`/nlp/conversations/${conversationId}/context`).then(r => r.data ?? null)
      : null,
    enabled: conversationId != null,
    staleTime: 60 * 1000,
  });
}
