/**
 * UtilizationCenterPage tests — demand quality warning banner, data rendering.
 *
 * Covers:
 * - Page renders correctly with utilization data
 * - Warning banner appears when active projects have no demand contribution
 * - Warning banner identifies 'no-hours' vs 'no-pattern' issues correctly
 * - Warning banner is hidden when all active projects have demand
 * - missingDemandProjects logic: only ACTIVE_STATUSES trigger the warning
 * - COMPLETED / CANCELLED projects do NOT trigger the warning
 *
 * Regression:
 * - Bug: Warning initially only checked `totalHours === 0`.
 *   Projects with hours but NULL effortPattern also contribute 0 demand
 *   (DemandCalculator skips them). Fixed to also detect missing effort patterns.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithProviders, commonHandlers, makeProject } from '../../test/helpers';
import UtilizationCenterPage from '../reports/UtilizationCenterPage';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const UTIL_CELLS = [
  { podId: 1, podName: 'Alpha Pod', monthIndex: 1, utilizationPct: 85 },
  { podId: 1, podName: 'Alpha Pod', monthIndex: 2, utilizationPct: 110 },
  { podId: 2, podName: 'Beta Pod',  monthIndex: 1, utilizationPct: 60 },
];

const GAP_DATA = {
  gaps: [
    { podId: 1, podName: 'Alpha Pod', monthIndex: 1, monthLabel: 'Jan',
      demandHours: 400, capacityHours: 480, gapHours: 80, gapFte: 0.5 },
    { podId: 1, podName: 'Alpha Pod', monthIndex: 2, monthLabel: 'Feb',
      demandHours: 530, capacityHours: 480, gapHours: -50, gapFte: -0.3 },
  ],
};

const CONCURRENCY = {
  risks: [
    { podId: 1, podName: 'Alpha Pod', monthIndex: 1, monthLabel: 'Jan',
      activeProjectCount: 2, riskLevel: 'LOW' },
  ],
};

// Matrix with all-zero hours for an active project (should trigger warning)
const MATRIX_WITH_ZERO_HOURS = [
  {
    planningId: 1, projectId: 1, projectName: 'Project Alpha',
    priority: 'P1', owner: 'owner@test.com', status: 'ACTIVE',
    projectStartMonth: 1, projectDurationMonths: 6, defaultPattern: 'UNIFORM',
    podId: 1, podName: 'Alpha Pod',
    devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
    contingencyPct: 0, totalHours: 0, totalHoursWithContingency: 0,
    targetReleaseId: null, targetReleaseName: null,
    effortPattern: 'UNIFORM', podStartMonth: 1, durationOverride: null,
    tshirtSize: null, complexityOverride: null,
  },
];

// Matrix with hours but no effort pattern (should also trigger warning)
const MATRIX_WITH_NO_PATTERN = [
  {
    planningId: 2, projectId: 2, projectName: 'Project Beta',
    priority: 'P2', owner: 'owner@test.com', status: 'ACTIVE',
    projectStartMonth: 1, projectDurationMonths: 4, defaultPattern: null,
    podId: 2, podName: 'Beta Pod',
    devHours: 200, qaHours: 100, bsaHours: 50, techLeadHours: 40,
    contingencyPct: 10, totalHours: 390, totalHoursWithContingency: 429,
    targetReleaseId: null, targetReleaseName: null,
    effortPattern: null, podStartMonth: 1, durationOverride: null,
    tshirtSize: null, complexityOverride: null,
  },
];

// Matrix with all-good data (should NOT trigger warning)
const MATRIX_CLEAN = [
  {
    planningId: 3, projectId: 3, projectName: 'Project Gamma',
    priority: 'P1', owner: 'owner@test.com', status: 'ACTIVE',
    projectStartMonth: 1, projectDurationMonths: 6, defaultPattern: 'UNIFORM',
    podId: 1, podName: 'Alpha Pod',
    devHours: 320, qaHours: 160, bsaHours: 80, techLeadHours: 64,
    contingencyPct: 10, totalHours: 624, totalHoursWithContingency: 686,
    targetReleaseId: null, targetReleaseName: null,
    effortPattern: 'UNIFORM', podStartMonth: 1, durationOverride: null,
    tshirtSize: null, complexityOverride: null,
  },
];

// ── Server helpers ─────────────────────────────────────────────────────────────

function buildServer(matrix: unknown[]) {
  return setupServer(
    ...commonHandlers,
    http.get('/api/reports/utilization-heatmap', () => HttpResponse.json({ cells: UTIL_CELLS })),
    http.get('/api/reports/capacity-gap', () => HttpResponse.json(GAP_DATA)),
    http.get('/api/reports/concurrency-risk', () => HttpResponse.json(CONCURRENCY)),
    http.get('/api/projects/pod-matrix', () => HttpResponse.json(matrix)),
    http.get('/api/reports/hiring-forecast', () => HttpResponse.json({ hires: [] })),
    http.get('/api/reports/resource-allocation', () => HttpResponse.json({ allocations: [] })),
    http.get('/api/reports/capacity-demand-summary', () => HttpResponse.json({ months: [] })),
    http.get('/api/reports/pod-resource-summary', () => HttpResponse.json({ pods: [] })),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UtilizationCenterPage — basic rendering', () => {
  let server: ReturnType<typeof buildServer>;

  beforeAll(() => {
    server = buildServer(MATRIX_CLEAN);
    server.listen({ onUnhandledRequest: 'warn' });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders the page without crashing', async () => {
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).toBeNull();
    }, { timeout: 3000 });
  });

  it('does NOT show warning banner when all active projects have demand', async () => {
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).toBeNull();
    }, { timeout: 3000 });
    // No warning should appear
    expect(screen.queryByText(/contribute 0 demand hours/i)).toBeNull();
  });
});

describe('Regression: Warning banner — zero hours detection', () => {
  let server: ReturnType<typeof buildServer>;

  beforeAll(() => {
    server = buildServer(MATRIX_WITH_ZERO_HOURS);
    server.listen({ onUnhandledRequest: 'warn' });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('shows warning banner when an active project has all-zero hours', async () => {
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.getByText(/contribute 0 demand hours/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('warning banner shows the project name', async () => {
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.getByText(/contribute 0 demand hours/i)).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText(/Project Alpha/i)).toBeInTheDocument();
  });

  it('warning banner indicates "no hours entered" reason for zero-hours project', async () => {
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.getByText(/contribute 0 demand hours/i)).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText(/no hours entered/i)).toBeInTheDocument();
  });
});

describe('Regression: Warning banner — missing effort pattern detection', () => {
  let server: ReturnType<typeof buildServer>;

  beforeAll(() => {
    server = buildServer(MATRIX_WITH_NO_PATTERN);
    server.listen({ onUnhandledRequest: 'warn' });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('shows warning banner when active project has hours but no effort pattern', async () => {
    // DemandCalculator skips records with null effortPattern even if hours > 0
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.getByText(/contribute 0 demand hours/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('warning shows "no effort pattern" for missing-pattern project', async () => {
    renderWithProviders(<UtilizationCenterPage />);
    await waitFor(() => {
      expect(screen.getByText(/contribute 0 demand hours/i)).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText(/no effort pattern/i)).toBeInTheDocument();
  });
});

// ── missingDemandProjects logic unit tests ────────────────────────────────────
// These test the detection logic directly without rendering the full page

describe('missingDemandProjects detection logic', () => {
  const ACTIVE_STATUSES = ['ACTIVE', 'IN_DISCOVERY', 'NOT_STARTED', 'ON_HOLD'];

  type MatrixRow = {
    projectId: number;
    projectName: string;
    status: string;
    podName: string;
    devHours: number;
    qaHours: number;
    bsaHours: number;
    techLeadHours: number;
    effortPattern: string | null;
    defaultPattern: string | null;
  };

  function detectMissingDemand(rows: MatrixRow[]) {
    const projectMap = new Map<number, { name: string; status: string; issues: { podName: string; reason: string }[] }>();
    for (const row of rows) {
      if (!ACTIVE_STATUSES.includes(row.status)) continue;
      const rowHours = (row.devHours ?? 0) + (row.qaHours ?? 0) + (row.bsaHours ?? 0) + (row.techLeadHours ?? 0);
      const effectivePattern = row.effortPattern ?? row.defaultPattern;
      let reason: string | null = null;
      if (rowHours === 0) reason = 'no-hours';
      else if (!effectivePattern) reason = 'no-pattern';
      if (reason) {
        if (!projectMap.has(row.projectId)) {
          projectMap.set(row.projectId, { name: row.projectName, status: row.status, issues: [] });
        }
        projectMap.get(row.projectId)!.issues.push({ podName: row.podName, reason });
      }
    }
    return Array.from(projectMap.entries()).map(([id, v]) => ({ id, ...v }));
  }

  it('detects zero-hours active project', () => {
    const result = detectMissingDemand([{
      projectId: 1, projectName: 'Zero Hours', status: 'ACTIVE', podName: 'Alpha',
      devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
      effortPattern: 'UNIFORM', defaultPattern: 'UNIFORM',
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].issues[0].reason).toBe('no-hours');
  });

  it('detects missing effort pattern (has hours but no pattern)', () => {
    const result = detectMissingDemand([{
      projectId: 2, projectName: 'No Pattern', status: 'ACTIVE', podName: 'Beta',
      devHours: 200, qaHours: 100, bsaHours: 0, techLeadHours: 0,
      effortPattern: null, defaultPattern: null,
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].issues[0].reason).toBe('no-pattern');
  });

  it('does NOT flag completed projects', () => {
    const result = detectMissingDemand([{
      projectId: 3, projectName: 'Done', status: 'COMPLETED', podName: 'Alpha',
      devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
      effortPattern: null, defaultPattern: null,
    }]);
    expect(result).toHaveLength(0);
  });

  it('does NOT flag cancelled projects', () => {
    const result = detectMissingDemand([{
      projectId: 4, projectName: 'Cancelled', status: 'CANCELLED', podName: 'Beta',
      devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
      effortPattern: null, defaultPattern: null,
    }]);
    expect(result).toHaveLength(0);
  });

  it('flags IN_DISCOVERY, NOT_STARTED, ON_HOLD when they have missing demand', () => {
    const rows = [
      { projectId: 5, projectName: 'In Disco', status: 'IN_DISCOVERY', podName: 'Alpha',
        devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
        effortPattern: null, defaultPattern: null },
      { projectId: 6, projectName: 'Not Started', status: 'NOT_STARTED', podName: 'Beta',
        devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
        effortPattern: null, defaultPattern: null },
      { projectId: 7, projectName: 'On Hold', status: 'ON_HOLD', podName: 'Alpha',
        devHours: 0, qaHours: 0, bsaHours: 0, techLeadHours: 0,
        effortPattern: null, defaultPattern: null },
    ];
    const result = detectMissingDemand(rows);
    expect(result).toHaveLength(3);
    const statuses = result.map(r => r.status).sort();
    expect(statuses).toEqual(['IN_DISCOVERY', 'NOT_STARTED', 'ON_HOLD']);
  });

  it('does NOT flag active projects that have hours AND effort pattern', () => {
    const result = detectMissingDemand([{
      projectId: 8, projectName: 'Good Project', status: 'ACTIVE', podName: 'Alpha',
      devHours: 320, qaHours: 160, bsaHours: 80, techLeadHours: 40,
      effortPattern: 'UNIFORM', defaultPattern: 'UNIFORM',
    }]);
    expect(result).toHaveLength(0);
  });

  it('uses effortPattern first, falls back to defaultPattern', () => {
    // If effortPattern is null but defaultPattern is set → should NOT be flagged
    const result = detectMissingDemand([{
      projectId: 9, projectName: 'Default Pattern', status: 'ACTIVE', podName: 'Alpha',
      devHours: 200, qaHours: 100, bsaHours: 0, techLeadHours: 0,
      effortPattern: null, defaultPattern: 'UNIFORM',
    }]);
    expect(result).toHaveLength(0);
  });
});
