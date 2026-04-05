/**
 * Tests for the NLP API hooks and SSE streaming function.
 *
 * Covers:
 * - useNlpQuery mutation hook
 * - useNlpInsights, useNlpCatalog, useNlpConfig query hooks
 * - useNlpFeedback, useNlpFeedbackUndo mutation hooks
 * - useNlpConversations, useCreateNlpConversation, useSendNlpMessage hooks
 * - streamNlpQuery SSE parser
 * - Type interface validation
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import {
  useNlpQuery,
  useNlpInsights,
  useNlpCatalog,
  useNlpConfig,
  useNlpFeedback,
  useNlpFeedbackUndo,
  useNlpConversations,
  useCreateNlpConversation,
  useSendNlpMessage,
  streamNlpQuery,
  type NlpQueryResponse,
  type NlpInsightCard,
  type NlpCatalogResponse,
  type NlpConfigResponse,
  type NlpConversationSummary,
  type NlpConversationMessage,
  type NlpStreamPhase,
} from '../nlp';

// ── Mock data ─────────────────────────────────────────────────────────────

const MOCK_QUERY_RESPONSE: NlpQueryResponse = {
  intent: 'DATA_QUERY',
  confidence: 0.92,
  resolvedBy: 'DETERMINISTIC',
  response: {
    message: 'Found 3 P0 projects:',
    route: null,
    formData: null,
    data: { _type: 'LIST', listType: 'PROJECTS', Count: '3', '#1': 'Alpha [P0]', '#2': 'Beta [P0]', '#3': 'Gamma [P0]' },
    drillDown: '/projects',
  },
  suggestions: ['Show P0 project estimates', 'Show resource utilization'],
  queryLogId: 42,
  debug: null,
};

const MOCK_INSIGHTS: NlpInsightCard[] = [
  { id: '1', icon: 'alert', color: 'red', title: 'Over-allocated', description: '3 resources at >100%', query: 'who is over-allocated?' },
  { id: '2', icon: 'chart', color: 'blue', title: 'Portfolio Health', description: '5 P0 at risk', query: 'show at risk projects' },
];

const MOCK_CATALOG: NlpCatalogResponse = {
  pods: ['API Pod', 'Core Pod'],
  projects: ['Alpha', 'Beta'],
  resources: ['John', 'Jane'],
  sprints: ['Sprint 10'],
  releases: ['Release 5.0'],
  roles: ['DEVELOPER', 'QA'],
  statuses: ['ACTIVE', 'ON_HOLD'],
  pages: [{ id: 'projects', route: '/projects', title: 'Projects', description: 'Project listing', aliases: ['project list'] }],
  resourceDetails: [],
  projectDetails: [],
  podDetails: [],
  sprintDetails: [],
  releaseDetails: [],
  costRates: [],
  tshirtSizes: [],
};

const MOCK_CONFIG: NlpConfigResponse = {
  strategyChain: ['DETERMINISTIC', 'LOCAL_LLM', 'RULE_BASED'],
  confidenceThreshold: 0.6,
  cloudProvider: 'openai',
  cloudModel: 'gpt-4',
  cloudApiKeySet: false,
  localModelUrl: 'http://localhost:11434',
  localModel: 'llama3:8b',
  localTimeoutMs: 10000,
  cacheEnabled: true,
  cacheTtlMinutes: 5,
  logQueries: true,
  maxTimeoutMs: 30000,
  strategyStatuses: {
    DETERMINISTIC: { available: true, message: null, avgResponseMs: 15 },
    LOCAL_LLM: { available: true, message: null, avgResponseMs: 2500 },
    RULE_BASED: { available: true, message: null, avgResponseMs: 30 },
  },
};

const MOCK_CONVERSATIONS: NlpConversationSummary[] = [
  { id: 1, title: 'Project planning', pinned: false, messageCount: 5, lastMessageAt: '2026-03-22T10:00:00Z', createdAt: '2026-03-22T09:00:00Z', updatedAt: '2026-03-22T10:00:00Z' },
  { id: 2, title: 'Resource questions', pinned: true, messageCount: 3, lastMessageAt: '2026-03-21T15:00:00Z', createdAt: '2026-03-21T14:00:00Z', updatedAt: '2026-03-21T15:00:00Z' },
];

// ── MSW server ────────────────────────────────────────────────────────────

const server = setupServer(
  http.post('/api/nlp/query', () => HttpResponse.json(MOCK_QUERY_RESPONSE)),
  http.get('/api/nlp/insights', () => HttpResponse.json(MOCK_INSIGHTS)),
  http.get('/api/nlp/catalog', () => HttpResponse.json(MOCK_CATALOG)),
  http.get('/api/nlp/config', () => HttpResponse.json(MOCK_CONFIG)),
  http.post('/api/nlp/feedback', () => HttpResponse.json(null, { status: 200 })),
  http.post('/api/nlp/feedback/undo', () => HttpResponse.json(null, { status: 200 })),
  http.get('/api/nlp/conversations', () => HttpResponse.json(MOCK_CONVERSATIONS)),
  http.post('/api/nlp/conversations', () => HttpResponse.json(MOCK_CONVERSATIONS[0])),
  http.post('/api/nlp/conversations/1/messages', () =>
    HttpResponse.json({
      id: 10, role: 'assistant', content: 'Found 3 P0 projects', intent: 'DATA_QUERY',
      confidence: 0.92, resolvedBy: 'DETERMINISTIC', response: MOCK_QUERY_RESPONSE.response,
      suggestions: [], toolCalls: [], responseMs: 150, createdAt: '2026-03-22T10:01:00Z',
    } satisfies NlpConversationMessage),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Test wrapper ──────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ══════════════════════════════════════════════════════════════════════════
//  Query hooks
// ══════════════════════════════════════════════════════════════════════════

describe('NLP Query hooks', () => {
  it('useNlpQuery should return structured response on mutation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpQuery(), { wrapper });

    await act(async () => {
      result.current.mutate({ query: 'show me P0 projects' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.intent).toBe('DATA_QUERY');
    expect(result.current.data?.resolvedBy).toBe('DETERMINISTIC');
    expect(result.current.data?.confidence).toBe(0.92);
    expect(result.current.data?.response?.data?.Count).toBe('3');
    expect(result.current.data?.suggestions).toHaveLength(2);
    expect(result.current.data?.queryLogId).toBe(42);
  });

  it('useNlpInsights should fetch insight cards', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpInsights(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].title).toBe('Over-allocated');
    expect(result.current.data?.[1].query).toBe('show at risk projects');
  });

  it('useNlpCatalog should fetch entity catalog', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpCatalog(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pods).toContain('API Pod');
    expect(result.current.data?.projects).toContain('Alpha');
    expect((result.current.data as unknown as Record<string, unknown>)?.strategyChain).toBeUndefined(); // Not a config field
  });

  it('useNlpConfig should fetch NLP configuration', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.strategyChain).toEqual(['DETERMINISTIC', 'LOCAL_LLM', 'RULE_BASED']);
    expect(result.current.data?.localModel).toBe('llama3:8b');
    expect(result.current.data?.strategyStatuses?.DETERMINISTIC?.available).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Feedback hooks
// ══════════════════════════════════════════════════════════════════════════

describe('NLP Feedback hooks', () => {
  it('useNlpFeedback should submit rating', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpFeedback(), { wrapper });

    await act(async () => {
      result.current.mutate({ queryLogId: 42, rating: 1, comment: 'Great answer' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useNlpFeedbackUndo should undo feedback', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpFeedbackUndo(), { wrapper });

    await act(async () => {
      result.current.mutate({ queryLogId: 42 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Conversation hooks
// ══════════════════════════════════════════════════════════════════════════

describe('NLP Conversation hooks', () => {
  it('useNlpConversations should fetch conversation list', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNlpConversations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].title).toBe('Project planning');
    expect(result.current.data?.[1].pinned).toBe(true);
  });

  it('useCreateNlpConversation should create new conversation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateNlpConversation(), { wrapper });

    await act(async () => {
      result.current.mutate({ title: 'New chat' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(1);
  });

  it('useSendNlpMessage should send message and get response', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendNlpMessage(), { wrapper });

    await act(async () => {
      result.current.mutate({ conversationId: 1, message: 'Show P0 projects' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.role).toBe('assistant');
    expect(result.current.data?.intent).toBe('DATA_QUERY');
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  SSE streaming
// ══════════════════════════════════════════════════════════════════════════

describe('streamNlpQuery', () => {
  it('should parse SSE phase and result events', async () => {
    const phases: NlpStreamPhase[] = [];
    let finalResult: NlpQueryResponse | null = null;

    // Create a mock readable stream that emits SSE events
    const ssePayload =
      'event:phase\ndata:{"phase":"thinking","message":"Understanding...","detail":"Parsing"}\n\n' +
      'event:phase\ndata:{"phase":"analyzing","message":"Running analysis...","detail":"Strategy chain"}\n\n' +
      'event:result\ndata:' + JSON.stringify(MOCK_QUERY_RESPONSE) + '\n\n';

    // Mock fetch to return SSE stream
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ssePayload));
          controller.close();
        },
      }),
    });
    globalThis.fetch = mockFetch;

    const abort = streamNlpQuery('show P0 projects', {
      onPhase: (phase) => phases.push(phase),
      onResult: (result) => { finalResult = result; },
      onError: (err) => { throw err; },
    });

    // Wait for the stream to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(phases).toHaveLength(2);
    expect(phases[0].phase).toBe('thinking');
    expect(phases[1].phase).toBe('analyzing');
    expect(finalResult).not.toBeNull();
    expect(finalResult!.intent).toBe('DATA_QUERY');
    expect(finalResult!.resolvedBy).toBe('DETERMINISTIC');

    // Cleanup
    abort();
  });

  it('should call onError when fetch fails', async () => {
    let caughtError: Error | null = null;

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    streamNlpQuery('fail query', {
      onPhase: () => {},
      onResult: () => {},
      onError: (err) => { caughtError = err; },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('500');
  });

  it('should return abort function', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves
    const abort = streamNlpQuery('pending', { onPhase: () => {}, onResult: () => {}, onError: () => {} });
    expect(typeof abort).toBe('function');
    abort(); // Should not throw
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Type validation
// ══════════════════════════════════════════════════════════════════════════

describe('NLP type interfaces', () => {
  it('NlpQueryResponse should include debug field', () => {
    const resp: NlpQueryResponse = {
      intent: 'DATA_QUERY',
      confidence: 0.92,
      resolvedBy: 'DETERMINISTIC',
      response: { message: 'Test', route: null, formData: null, data: null, drillDown: null },
      suggestions: [],
      queryLogId: null,
      debug: { strategy: 'DETERMINISTIC', elapsed: 25 },
    };
    expect(resp.debug?.strategy).toBe('DETERMINISTIC');
  });

  it('NlpCatalogResponse should include all entity arrays', () => {
    const catalog: NlpCatalogResponse = MOCK_CATALOG;
    expect(catalog.pods).toBeDefined();
    expect(catalog.projects).toBeDefined();
    expect(catalog.resources).toBeDefined();
    expect(catalog.roles).toBeDefined();
    expect(catalog.pages).toBeDefined();
    expect(catalog.costRates).toBeDefined();
    expect(catalog.tshirtSizes).toBeDefined();
  });

  it('NlpConfigResponse should include strategy chain and statuses', () => {
    const config: NlpConfigResponse = MOCK_CONFIG;
    expect(config.strategyChain).toContain('DETERMINISTIC');
    expect(config.strategyStatuses).toHaveProperty('DETERMINISTIC');
    expect(config.strategyStatuses).toHaveProperty('LOCAL_LLM');
    expect(config.strategyStatuses).toHaveProperty('RULE_BASED');
  });
});
