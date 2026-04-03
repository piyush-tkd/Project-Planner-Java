/**
 * BAU (Business-As-Usual) Assumptions API tests — fetch, save, cache invalidation.
 *
 * Covers:
 * - useBauAssumptions: fetches per-pod/role records
 * - useUpdateBauAssumptions: saves updated BAU percentages
 * - Cache invalidation: saving BAU MUST invalidate ['bau-assumptions'] AND ['reports']
 *   so the Utilization Center refreshes in real-time without a page reload.
 *
 * Regression:
 * - If ['reports'] is NOT invalidated after BAU save, UtilizationCenterPage will
 *   display stale data until the user manually refreshes the page.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { makeWrapper } from '../../test/helpers';
import { useBauAssumptions, useUpdateBauAssumptions } from '../pods';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_BAU = [
  { id: 1, podId: 1, podName: 'Alpha Pod', role: 'DEVELOPER', bauPct: 20 },
  { id: 2, podId: 1, podName: 'Alpha Pod', role: 'QA', bauPct: 15 },
  { id: 3, podId: 2, podName: 'Beta Pod',  role: 'DEVELOPER', bauPct: 30 },
  { id: 4, podId: 2, podName: 'Beta Pod',  role: 'QA', bauPct: 25 },
];

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/bau-assumptions', () => HttpResponse.json(MOCK_BAU)),
  http.put('/api/bau-assumptions', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useBauAssumptions', () => {
  it('fetches BAU assumption records', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBauAssumptions(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(4);
  });

  it('each record has podId, podName, role, and bauPct', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBauAssumptions(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const rec = result.current.data![0];
    expect(rec).toHaveProperty('podId');
    expect(rec).toHaveProperty('podName');
    expect(rec).toHaveProperty('role');
    expect(rec).toHaveProperty('bauPct');
  });

  it('returns records for multiple pods', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBauAssumptions(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const pods = [...new Set(result.current.data!.map(r => r.podId))];
    expect(pods).toHaveLength(2);
  });

  it('bauPct values are numeric and non-negative', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBauAssumptions(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    result.current.data!.forEach(r => {
      expect(typeof r.bauPct).toBe('number');
      expect(r.bauPct).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('useUpdateBauAssumptions', () => {
  it('sends PUT request and resolves with updated data', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });
    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync([
        { podId: 1, role: 'DEVELOPER', bauPct: 25 },
        { podId: 1, role: 'QA', bauPct: 20 },
      ]);
    });
    expect(result.current.isSuccess).toBe(true);
    expect(saved).toEqual([
      { podId: 1, role: 'DEVELOPER', bauPct: 25 },
      { podId: 1, role: 'QA', bauPct: 20 },
    ]);
  });

  it('accepts bauPct of 0 (no BAU overhead)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync([{ podId: 2, role: 'DEVELOPER', bauPct: 0 }]);
    });
    expect(result.current.isSuccess).toBe(true);
  });

  it('accepts bauPct of 100 (fully BAU pod)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync([{ podId: 2, role: 'DEVELOPER', bauPct: 100 }]);
    });
    expect(result.current.isSuccess).toBe(true);
  });
});

// ── Regression: BAU save must invalidate ['reports'] cache ────────────────────
// If this invalidation is missing, UtilizationCenterPage shows stale data after
// BAU changes — user has to manually hard-refresh the page to see updated charts.

describe('Regression: BAU save invalidates reports cache', () => {
  it('onSuccess calls invalidateQueries for bau-assumptions key', async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync([{ podId: 1, role: 'DEVELOPER', bauPct: 30 }]);
    });

    // Must invalidate bau-assumptions to refresh the BAU form
    const bauCalls = spy.mock.calls.filter(
      call => JSON.stringify(call[0]).includes('bau-assumptions'),
    );
    expect(bauCalls.length).toBeGreaterThan(0);
  });

  it('onSuccess calls invalidateQueries for reports key (real-time utilization update)', async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync([{ podId: 1, role: 'DEVELOPER', bauPct: 30 }]);
    });

    // CRITICAL: must also invalidate reports so UtilizationCenter refreshes automatically
    const reportCalls = spy.mock.calls.filter(
      call => JSON.stringify(call[0]).includes('reports'),
    );
    expect(reportCalls.length).toBeGreaterThan(0);
  });

  it('changing BAU from 20% to 30% changes effective capacity — reports must re-fetch', async () => {
    // This is a semantic regression test: BAU reduces capacity available for projects.
    // If ['reports'] cache is stale, the capacity gap shown to users will be wrong.
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateBauAssumptions(), { wrapper: Wrapper });

    // Simulate increasing BAU overhead (more capacity goes to BAU, less to projects)
    await act(async () => {
      await result.current.mutateAsync([
        { podId: 1, role: 'DEVELOPER', bauPct: 30 }, // was 20
        { podId: 1, role: 'QA', bauPct: 20 },        // was 15
      ]);
    });

    const invalidatedKeys = spy.mock.calls.map(call => JSON.stringify(call[0]));
    expect(invalidatedKeys.some(k => k.includes('reports'))).toBe(true);
    expect(invalidatedKeys.some(k => k.includes('bau-assumptions'))).toBe(true);
  });
});
