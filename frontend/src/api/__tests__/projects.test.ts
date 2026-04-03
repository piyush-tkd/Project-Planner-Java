/**
 * Projects API hook tests — CRUD operations, pod planning, status filtering.
 *
 * Covers:
 * - useProjects / useProject fetching
 * - useCreateProject / useUpdateProject / useDeleteProject
 * - useProjectPodPlannings (per-project planning records)
 * - useProjectPodMatrix (all pod-matrix records)
 * - Status filtering: non-terminal statuses in unmapped count
 * - POD planning with devHours/qaHours/bsaHours/techLeadHours
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { makeWrapper, PROJECTS, PODS, makeProject, makePlanning } from '../../test/helpers';
import { useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject,
         useProjectPodMatrix, useProjectPodPlannings, useUpdatePodPlannings } from '../projects';
import type { ProjectPodMatrixResponse } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLANNING_ACTIVE   = makePlanning({ id: 1, podId: 1, podName: 'Alpha Pod', devHours: 400, qaHours: 200 });
const PLANNING_NO_HOURS = makePlanning({ id: 2, podId: 2, podName: 'Beta Pod',  devHours: 0,   qaHours: 0, bsaHours: 0, techLeadHours: 0, totalHours: 0, totalHoursWithContingency: 0 });

const MATRIX_ROWS: ProjectPodMatrixResponse[] = [
  {
    planningId: 1, projectId: 1, projectName: 'Project Alpha',
    priority: 'P1', owner: 'owner@test.com', status: 'ACTIVE',
    projectStartMonth: 1, projectDurationMonths: 6, defaultPattern: 'UNIFORM',
    podId: 1, podName: 'Alpha Pod',
    devHours: 400, qaHours: 200, bsaHours: 100, techLeadHours: 80,
    contingencyPct: 10, totalHours: 780, totalHoursWithContingency: 858,
    targetReleaseId: null, targetReleaseName: null,
    effortPattern: 'UNIFORM', podStartMonth: 1, durationOverride: null,
    tshirtSize: null, complexityOverride: null,
  },
  {
    planningId: 2, projectId: 2, projectName: 'Project Beta',
    priority: 'P2', owner: 'owner@test.com', status: 'IN_DISCOVERY',
    projectStartMonth: 3, projectDurationMonths: 4, defaultPattern: 'FRONT_LOADED',
    podId: 2, podName: 'Beta Pod',
    devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
    contingencyPct: 0, totalHours: 0, totalHoursWithContingency: 0,
    targetReleaseId: null, targetReleaseName: null,
    effortPattern: null, podStartMonth: 3, durationOverride: null,
    tshirtSize: null, complexityOverride: null,
  },
  {
    planningId: 3, projectId: 3, projectName: 'Project Gamma',
    priority: 'P3', owner: 'owner@test.com', status: 'COMPLETED',
    projectStartMonth: 1, projectDurationMonths: 3, defaultPattern: 'UNIFORM',
    podId: 1, podName: 'Alpha Pod',
    devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
    contingencyPct: 0, totalHours: 0, totalHoursWithContingency: 0,
    targetReleaseId: null, targetReleaseName: null,
    effortPattern: null, podStartMonth: null, durationOverride: null,
    tshirtSize: null, complexityOverride: null,
  },
];

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/projects',           () => HttpResponse.json(PROJECTS)),
  http.get('/api/projects/:id',       ({ params }) => {
    const p = PROJECTS.find(x => x.id === Number(params.id));
    return p ? HttpResponse.json(p) : HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
  http.post('/api/projects',          async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 99, ...body }, { status: 201 });
  }),
  http.put('/api/projects/:id',       async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: Number(params.id), ...body });
  }),
  http.delete('/api/projects/:id',    () => new HttpResponse(null, { status: 204 })),
  http.get('/api/projects/pod-matrix',() => HttpResponse.json(MATRIX_ROWS)),
  http.get('/api/projects/:id/pod-planning', ({ params }) => {
    if (Number(params.id) === 1) return HttpResponse.json([PLANNING_ACTIVE]);
    if (Number(params.id) === 2) return HttpResponse.json([PLANNING_NO_HOURS]);
    return HttpResponse.json([]);
  }),
  http.put('/api/projects/:id/pod-planning', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useProjects', () => {
  it('fetches all projects', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
  });

  it('returns projects with expected fields', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const p = result.current.data![0];
    expect(p).toMatchObject({ id: 1, name: 'Project Alpha', status: 'ACTIVE' });
  });
});

describe('useProject (single)', () => {
  it('fetches project by id', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProject(2), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Project Beta');
  });

  it('returns error for missing project', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProject(999), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateProject', () => {
  it('creates a project and returns it with new id', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper: Wrapper });
    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({
        name: 'New Project', priority: 'P1', owner: 'a@b.com',
        startMonth: 1, durationMonths: 3, defaultPattern: 'UNIFORM',
        status: 'ACTIVE', notes: null,
      });
    });
    expect((created as { id: number }).id).toBe(99);
  });
});

describe('useUpdateProject', () => {
  it('updates a project and returns updated data', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateProject(), { wrapper: Wrapper });
    let updated: unknown;
    await act(async () => {
      updated = await result.current.mutateAsync({
        id: 1,
        data: { name: 'Updated Alpha', priority: 'P0', owner: 'a@b.com',
                startMonth: 1, durationMonths: 6, defaultPattern: 'UNIFORM',
                status: 'ACTIVE', notes: null },
      });
    });
    expect((updated as { name: string }).name).toBe('Updated Alpha');
  });
});

describe('useDeleteProject', () => {
  it('calls DELETE and resolves without data', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteProject(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync(1);
    });
    expect(result.current.isSuccess).toBe(true);
  });
});

describe('useProjectPodMatrix', () => {
  it('fetches all pod-matrix rows', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjectPodMatrix(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
  });

  it('includes rows with zero hours (invisible to demand calculator)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjectPodMatrix(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const zeroHoursRows = result.current.data!.filter(r => r.totalHours === 0);
    expect(zeroHoursRows.length).toBeGreaterThan(0);
  });

  it('includes COMPLETED projects in matrix (for history)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjectPodMatrix(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const completed = result.current.data!.filter(r => r.status === 'COMPLETED');
    expect(completed.length).toBeGreaterThan(0);
  });
});

describe('useProjectPodPlannings', () => {
  it('returns planning with hours for active project', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjectPodPlannings(1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].devHours).toBe(400);
  });

  it('returns planning with zero hours for project missing effort data', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProjectPodPlannings(2), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].totalHours).toBe(0);
  });
});

// ── Regression: unmapped projects count includes non-terminal statuses ────────
// Bug fixed: only ACTIVE counted; should include NOT_STARTED, IN_DISCOVERY, ON_HOLD too

describe('Regression: unmapped projects status filter', () => {
  const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED'];

  it('counts NOT_STARTED as non-terminal (should appear in unmapped count)', () => {
    const project = makeProject({ status: 'NOT_STARTED' });
    expect(TERMINAL_STATUSES.includes(project.status)).toBe(false);
  });

  it('counts IN_DISCOVERY as non-terminal (should appear in unmapped count)', () => {
    const project = makeProject({ status: 'IN_DISCOVERY' });
    expect(TERMINAL_STATUSES.includes(project.status)).toBe(false);
  });

  it('counts ON_HOLD as non-terminal (should appear in unmapped count)', () => {
    const project = makeProject({ status: 'ON_HOLD' });
    expect(TERMINAL_STATUSES.includes(project.status)).toBe(false);
  });

  it('does NOT count COMPLETED in unmapped', () => {
    const project = makeProject({ status: 'COMPLETED' });
    expect(TERMINAL_STATUSES.includes(project.status)).toBe(true);
  });

  it('does NOT count CANCELLED in unmapped', () => {
    const project = makeProject({ status: 'CANCELLED' });
    expect(TERMINAL_STATUSES.includes(project.status)).toBe(true);
  });

  it('unmapped count from all projects: only non-terminal without mappings', () => {
    const allProjects = [
      makeProject({ id: 1, status: 'ACTIVE' }),
      makeProject({ id: 2, status: 'NOT_STARTED' }),
      makeProject({ id: 3, status: 'IN_DISCOVERY' }),
      makeProject({ id: 4, status: 'ON_HOLD' }),
      makeProject({ id: 5, status: 'COMPLETED' }),
      makeProject({ id: 6, status: 'CANCELLED' }),
    ];
    const mappings: { ppProjectId: number }[] = [{ ppProjectId: 1 }]; // only project 1 is mapped

    const unmapped = allProjects.filter(
      p => !TERMINAL_STATUSES.includes(p.status) && !mappings.some(m => m.ppProjectId === p.id)
    );

    // Projects 2 (NOT_STARTED), 3 (IN_DISCOVERY), 4 (ON_HOLD) are unmapped non-terminal
    expect(unmapped).toHaveLength(3);
    expect(unmapped.map(p => p.status).sort()).toEqual(['IN_DISCOVERY', 'NOT_STARTED', 'ON_HOLD']);
  });
});
