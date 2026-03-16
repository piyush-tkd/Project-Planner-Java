/**
 * Tests for useCostRates hook.
 *
 * Uses MSW to intercept the axios GET /api/cost-rates call at the network level,
 * so we're testing the real hook logic (query key, data mapping, error handling)
 * without hitting an actual server.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { useCostRates, CostRateResponse } from '../costRates';

// ── MSW server ───────────────────────────────────────────────────────────────

const MOCK_COST_RATES: CostRateResponse[] = [
  { id: 1, role: 'DEVELOPER', location: 'US',    hourlyRate: 150 },
  { id: 2, role: 'QA',        location: 'INDIA', hourlyRate: 60  },
  { id: 3, role: 'BSA',       location: 'US',    hourlyRate: 120 },
];

const server = setupServer(
  http.get('/api/cost-rates', () => HttpResponse.json(MOCK_COST_RATES)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useCostRates', () => {
  it('returns cost rate data on successful fetch', async () => {
    const { result } = renderHook(() => useCostRates(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toMatchObject({
      id: 1,
      role: 'DEVELOPER',
      location: 'US',
      hourlyRate: 150,
    });
  });

  it('returns all four fields for every entry', async () => {
    const { result } = renderHook(() => useCostRates(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    for (const rate of result.current.data!) {
      expect(rate).toHaveProperty('id');
      expect(rate).toHaveProperty('role');
      expect(rate).toHaveProperty('location');
      expect(rate).toHaveProperty('hourlyRate');
    }
  });

  it('enters error state when the API returns 500', async () => {
    server.use(
      http.get('/api/cost-rates', () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useCostRates(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('starts in loading state before resolving', async () => {
    const { result } = renderHook(() => useCostRates(), {
      wrapper: makeWrapper(),
    });

    // On the very first render the query should still be pending
    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
