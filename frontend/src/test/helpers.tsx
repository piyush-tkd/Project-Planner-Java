/**
 * Shared test helpers, wrappers, and mock factories for the Portfolio Planner test suite.
 *
 * Usage:
 *   import { makeWrapper, renderWithProviders, mockAuthContext } from '../test/helpers';
 */
import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { http, HttpResponse } from 'msw';
import type { ResourceResponse, ProjectResponse, ProjectPodPlanningResponse } from '../types';
import type { PodResponse } from '../types/pod';

// ── Query client factory (no retries, instant fail) ──────────────────────────

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ── Provider wrapper ─────────────────────────────────────────────────────────

interface WrapperOptions {
  initialRoute?: string;
  token?: string | null;
}

export function makeWrapper(opts: WrapperOptions = {}) {
  const { initialRoute = '/', token = 'test-token' } = opts;
  const qc = makeQueryClient();

  // Inject a fake JWT so apiClient sends Authorization header
  if (token) {
    localStorage.setItem('pp_token', token);
    localStorage.setItem('pp_role', 'ADMIN');
    localStorage.setItem('pp_username', 'testuser');
  } else {
    localStorage.removeItem('pp_token');
  }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <MantineProvider>
          {children}
        </MantineProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return { Wrapper, qc };
}

/** Full render helper that injects all providers. */
export function renderWithProviders(
  ui: React.ReactElement,
  opts: WrapperOptions & RenderOptions = {},
) {
  const { initialRoute, token, ...renderOpts } = opts;
  const { Wrapper } = makeWrapper({ initialRoute, token });
  return render(ui, { wrapper: Wrapper, ...renderOpts });
}

// ── Mock data factories ───────────────────────────────────────────────────────

export function makeResource(overrides: Partial<ResourceResponse> = {}): ResourceResponse {
  return {
    id: 1,
    name: 'Alice Tester',
    role: 'DEVELOPER',
    location: 'US',
    active: true,
    countsInCapacity: true,
    skills: 'React, Java',
    podAssignment: { podId: 1, podName: 'Alpha Pod', capacityFte: 1.0 },
    ...overrides,
  };
}

export function makeProject(overrides: Partial<ProjectResponse> = {}): ProjectResponse {
  return {
    id: 1,
    name: 'Test Project',
    priority: 'P1',
    owner: 'owner@test.com',
    startMonth: 1,
    targetEndMonth: 6,
    durationMonths: 6,
    defaultPattern: 'UNIFORM',
    status: 'ACTIVE',
    notes: null,
    blockedById: null,
    targetDate: null,
    startDate: null,
    capacityNote: null,
    client: null,
    createdAt: null,
    sourceType: 'MANUAL',
    jiraEpicKey: null,
    jiraBoardId: null,
    jiraLastSyncedAt: null,
    jiraSyncError: false,
    archived: false,
    estimatedBudget: null,
    actualCost: null,
    ...overrides,
  };
}

export function makePod(overrides: Partial<PodResponse> = {}): PodResponse {
  return {
    id: 1,
    name: 'Alpha Pod',
    active: true,
    displayOrder: 1,
    description: null,
    podType: 'DELIVERY',
    complexityMultiplier: null,
    ...overrides,
  };
}

export function makePlanning(overrides: Partial<ProjectPodPlanningResponse> = {}): ProjectPodPlanningResponse {
  return {
    id: 1,
    podId: 1,
    podName: 'Alpha Pod',
    devHours: 400,
    qaHours: 200,
    bsaHours: 100,
    techLeadHours: 80,
    contingencyPct: 10,
    totalHours: 780,
    totalHoursWithContingency: 858,
    targetReleaseId: null,
    targetReleaseName: null,
    effortPattern: 'UNIFORM',
    podStartMonth: 1,
    durationOverride: null,
    devStartDate: null,
    devEndDate: null,
    qaStartDate: null,
    qaEndDate: null,
    uatStartDate: null,
    uatEndDate: null,
    scheduleLocked: false,
    devCount: 2,
    qaCount: 1,
    ...overrides,
  };
}

// ── Common MSW handlers ───────────────────────────────────────────────────────

export const RESOURCES = [
  makeResource({ id: 1, name: 'Alice', role: 'DEVELOPER' }),
  makeResource({ id: 2, name: 'Bob', role: 'QA', podAssignment: { podId: 2, podName: 'Beta Pod', capacityFte: 0.5 } }),
];

export const PROJECTS = [
  makeProject({ id: 1, name: 'Project Alpha', status: 'ACTIVE' }),
  makeProject({ id: 2, name: 'Project Beta', status: 'IN_DISCOVERY' }),
  makeProject({ id: 3, name: 'Project Gamma', status: 'COMPLETED' }),
];

export const PODS = [
  makePod({ id: 1, name: 'Alpha Pod' }),
  makePod({ id: 2, name: 'Beta Pod' }),
];

export const MONTH_LABELS: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};

/** Standard handler set reused across test files. */
export const commonHandlers = [
  http.get('/api/resources', () => HttpResponse.json(RESOURCES)),
  http.get('/api/resources/:id', ({ params }) => {
    const r = RESOURCES.find(x => x.id === Number(params.id));
    return r ? HttpResponse.json(r) : HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
  http.get('/api/projects', () => HttpResponse.json(PROJECTS)),
  http.get('/api/projects/:id', ({ params }) => {
    const p = PROJECTS.find(x => x.id === Number(params.id));
    return p ? HttpResponse.json(p) : HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
  http.get('/api/pods', () => HttpResponse.json(PODS)),
  http.get('/api/pods/:id', ({ params }) => {
    const p = PODS.find(x => x.id === Number(params.id));
    return p ? HttpResponse.json(p) : HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),
  http.get('/api/timeline', () => HttpResponse.json({
    startYear: 2026, startMonth: 1, currentMonthIndex: 3,
    workingHours: { M1: 168, M2: 152, M3: 168, M4: 160, M5: 168, M6: 160,
                    M7: 168, M8: 160, M9: 168, M10: 160, M11: 152, M12: 160 },
  })),
  http.get('/api/auth/me', () => HttpResponse.json({
    username: 'testuser', role: 'ADMIN', displayName: 'Test User', allowedPages: null,
  })),
];
