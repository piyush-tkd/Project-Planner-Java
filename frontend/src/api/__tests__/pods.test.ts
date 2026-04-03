/**
 * Pods API hook tests — CRUD, BAU assumptions, cache invalidation.
 *
 * Covers:
 * - usePods: fetches pod list
 * - useCreatePod: creates a pod and invalidates ['pods'] + ['reports']
 * - useUpdatePod: updates a pod and invalidates ['pods'] + ['reports']
 * - Pod shape validation
 * - Cache invalidation on create/update triggers report refresh
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { makeWrapper, makePod, PODS } from '../../test/helpers';
import { usePods, useCreatePod, useUpdatePod } from '../pods';

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/pods', () => HttpResponse.json(PODS)),
  http.post('/api/pods', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 99, active: true, displayOrder: 3, ...body }, { status: 201 });
  }),
  http.put('/api/pods/:id', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: Number(params.id), ...body });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePods', () => {
  it('fetches all pods', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePods(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('each pod has id, name, and active fields', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePods(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const pod = result.current.data![0];
    expect(pod).toHaveProperty('id');
    expect(pod).toHaveProperty('name');
    expect(pod).toHaveProperty('active');
  });

  it('returns Alpha Pod and Beta Pod by name', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePods(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const names = result.current.data!.map(p => p.name);
    expect(names).toContain('Alpha Pod');
    expect(names).toContain('Beta Pod');
  });
});

describe('useCreatePod', () => {
  it('creates a pod and returns it with a new id', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePod(), { wrapper: Wrapper });
    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({ name: 'Gamma Pod' });
    });
    expect((created as { id: number }).id).toBe(99);
    expect((created as { name: string }).name).toBe('Gamma Pod');
  });

  it('creates a pod with complexityMultiplier', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePod(), { wrapper: Wrapper });
    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({ name: 'Delta Pod', complexityMultiplier: 1.2 });
    });
    expect((created as { complexityMultiplier: number }).complexityMultiplier).toBe(1.2);
  });
});

describe('useUpdatePod', () => {
  it('updates a pod and returns updated data', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePod(), { wrapper: Wrapper });
    let updated: unknown;
    await act(async () => {
      updated = await result.current.mutateAsync({
        id: 1,
        data: { name: 'Alpha Pod Renamed', active: true },
      });
    });
    expect((updated as { name: string }).name).toBe('Alpha Pod Renamed');
    expect((updated as { id: number }).id).toBe(1);
  });

  it('can deactivate a pod (active: false)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePod(), { wrapper: Wrapper });
    let updated: unknown;
    await act(async () => {
      updated = await result.current.mutateAsync({ id: 2, data: { active: false } });
    });
    expect((updated as { active: boolean }).active).toBe(false);
  });
});

// ── Cache invalidation ────────────────────────────────────────────────────────
// Creating or updating a pod changes capacity allocation → reports must refresh.

describe('Pod cache invalidation', () => {
  it('createPod invalidates pods cache', async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreatePod(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'New Pod' });
    });

    const podCalls = spy.mock.calls.filter(
      call => JSON.stringify(call[0]).includes('pods'),
    );
    expect(podCalls.length).toBeGreaterThan(0);
  });

  it('createPod invalidates reports cache (new pod affects capacity)', async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreatePod(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'New Pod' });
    });

    const reportCalls = spy.mock.calls.filter(
      call => JSON.stringify(call[0]).includes('reports'),
    );
    expect(reportCalls.length).toBeGreaterThan(0);
  });

  it('updatePod invalidates both pods and reports cache', async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdatePod(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 1, data: { name: 'Renamed Pod' } });
    });

    const allKeys = spy.mock.calls.map(c => JSON.stringify(c[0]));
    expect(allKeys.some(k => k.includes('pods'))).toBe(true);
    expect(allKeys.some(k => k.includes('reports'))).toBe(true);
  });
});

// ── Pod factory ───────────────────────────────────────────────────────────────

describe('makePod factory (test helper)', () => {
  it('returns a valid pod with defaults', () => {
    const pod = makePod();
    expect(pod.id).toBe(1);
    expect(pod.name).toBe('Alpha Pod');
    expect(pod.active).toBe(true);
  });

  it('allows overriding fields', () => {
    const pod = makePod({ id: 5, name: 'Custom Pod', active: false });
    expect(pod.id).toBe(5);
    expect(pod.name).toBe('Custom Pod');
    expect(pod.active).toBe(false);
  });
});
