/**
 * Tests for the resources API hooks: useResources, useResource, useCreateResource.
 *
 * Focuses on the new `skills` field added to ResourceResponse.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { useResources, useResource, useCreateResource } from '../resources';
import type { ResourceResponse } from '../../types';

// ── Test data ────────────────────────────────────────────────────────────────

const MOCK_RESOURCES: ResourceResponse[] = [
  {
    id: 1,
    name: 'Alice',
    role: 'DEVELOPER',
    location: 'US',
    active: true,
    countsInCapacity: true,
    skills: 'React, TypeScript, Java',
    podAssignment: { podId: 1, podName: 'Alpha Pod', capacityFte: 1.0 },
  },
  {
    id: 2,
    name: 'Bob',
    role: 'QA',
    location: 'INDIA',
    active: true,
    countsInCapacity: true,
    skills: null,
    podAssignment: null,
  },
];

// ── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/resources', () => HttpResponse.json(MOCK_RESOURCES)),
  http.get('/api/resources/:id', ({ params }) => {
    const resource = MOCK_RESOURCES.find(r => r.id === Number(params.id));
    if (!resource) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(resource);
  }),
  http.post('/api/resources', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 99, ...body, podAssignment: null }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── useResources ──────────────────────────────────────────────────────────────

describe('useResources', () => {
  it('returns a list of resources', async () => {
    const { result } = renderHook(() => useResources(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it('includes the skills field (string or null)', async () => {
    const { result } = renderHook(() => useResources(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const alice = result.current.data!.find(r => r.name === 'Alice');
    const bob   = result.current.data!.find(r => r.name === 'Bob');

    expect(alice?.skills).toBe('React, TypeScript, Java');
    expect(bob?.skills).toBeNull();
  });

  it('resource has podAssignment when assigned', async () => {
    const { result } = renderHook(() => useResources(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const alice = result.current.data![0];
    expect(alice.podAssignment).not.toBeNull();
    expect(alice.podAssignment!.podName).toBe('Alpha Pod');
  });

  it('resource has null podAssignment when unassigned', async () => {
    const { result } = renderHook(() => useResources(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const bob = result.current.data![1];
    expect(bob.podAssignment).toBeNull();
  });
});

// ── useResource (single) ──────────────────────────────────────────────────────

describe('useResource', () => {
  it('fetches a single resource by id', async () => {
    const { result } = renderHook(() => useResource(1), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.name).toBe('Alice');
    expect(result.current.data!.skills).toBe('React, TypeScript, Java');
  });

  it('enters error state when resource is not found', async () => {
    const { result } = renderHook(() => useResource(404), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('is disabled when id is 0', () => {
    const { result } = renderHook(() => useResource(0), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ── useCreateResource ─────────────────────────────────────────────────────────

describe('useCreateResource', () => {
  it('creates a resource and returns the new entity', async () => {
    const { result } = renderHook(() => useCreateResource(), { wrapper: makeWrapper() });

    const newResource = {
      name: 'Carol',
      role: 'BSA',
      location: 'US',
      active: true,
      countsInCapacity: true,
      homePodId: null,
      capacityFte: 1.0,
    };

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync(newResource);
    });

    expect(created).toMatchObject({ id: 99, name: 'Carol', role: 'BSA' });
  });
});
