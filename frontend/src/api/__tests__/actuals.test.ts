/**
 * Tests for useActuals and useProjectActuals hooks.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { useActuals, useProjectActuals, ProjectActualResponse } from '../actuals';

// ── Test data ────────────────────────────────────────────────────────────────

const MOCK_ACTUALS: ProjectActualResponse[] = [
  { id: 1, projectId: 10, projectName: 'Alpha', monthKey: 1, actualHours: 320 },
  { id: 2, projectId: 10, projectName: 'Alpha', monthKey: 2, actualHours: 480 },
  { id: 3, projectId: 20, projectName: 'Beta',  monthKey: 1, actualHours: 160 },
];

const PROJECT_10_ACTUALS = MOCK_ACTUALS.filter(a => a.projectId === 10);

// ── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/actuals', () => HttpResponse.json(MOCK_ACTUALS)),
  http.get('/api/actuals/by-project/:id', ({ params }) => {
    const id = Number(params.id);
    return HttpResponse.json(MOCK_ACTUALS.filter(a => a.projectId === id));
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── useActuals tests ─────────────────────────────────────────────────────────

describe('useActuals', () => {
  it('fetches all actuals across all projects', async () => {
    const { result } = renderHook(() => useActuals(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  it('returns data with all expected fields', async () => {
    const { result } = renderHook(() => useActuals(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data![0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('projectId');
    expect(first).toHaveProperty('projectName');
    expect(first).toHaveProperty('monthKey');
    expect(first).toHaveProperty('actualHours');
  });

  it('enters error state on server failure', async () => {
    server.use(
      http.get('/api/actuals', () =>
        HttpResponse.json({ message: 'Database error' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useActuals(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useProjectActuals tests ───────────────────────────────────────────────────

describe('useProjectActuals', () => {
  it('fetches actuals for a specific project', async () => {
    const { result } = renderHook(() => useProjectActuals(10), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data!.every(a => a.projectId === 10)).toBe(true);
  });

  it('monthKey and actualHours are numeric', async () => {
    const { result } = renderHook(() => useProjectActuals(10), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const actual of result.current.data!) {
      expect(typeof actual.monthKey).toBe('number');
      expect(typeof actual.actualHours).toBe('number');
    }
  });

  it('is disabled when projectId is 0 (falsy)', () => {
    const { result } = renderHook(() => useProjectActuals(0), {
      wrapper: makeWrapper(),
    });

    // Query is disabled — should remain pending without fetching
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns empty array when no actuals exist for a project', async () => {
    const { result } = renderHook(() => useProjectActuals(999), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(0);
  });
});
