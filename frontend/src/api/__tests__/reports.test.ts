/**
 * Reports API hook tests — capacity gap, utilization, hiring forecast,
 * concurrency risk, resource allocation, capacity-demand summary.
 *
 * Covers:
 * - useCapacityGap: returns gaps array with correct shape
 * - useUtilizationHeatmap: returns utilization data
 * - useHiringForecast: returns hiring recommendations
 * - useConcurrencyRisk: returns risk data
 * - useResourceAllocation: returns per-resource monthly allocation
 * - useCapacityDemandSummary: returns month-indexed data with correct field names
 * - Regression: CapacityDemandSummaryData uses monthLabel/totalCapacityHours/totalDemandHours/netGapHours
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { makeWrapper } from '../../test/helpers';
import {
  useCapacityGap,
  useUtilizationHeatmap,
  useHiringForecast,
  useConcurrencyRisk,
  useResourceAllocation,
  useCapacityDemandSummary,
} from '../reports';
import type { CapacityDemandSummaryData } from '../../types/report';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_GAPS = {
  gaps: [
    { podId: 1, podName: 'Alpha Pod', monthIndex: 1, monthLabel: 'Jan', demandHours: 320, capacityHours: 480, gapHours: 160, gapFte: 1.0 },
    { podId: 1, podName: 'Alpha Pod', monthIndex: 2, monthLabel: 'Feb', demandHours: 600, capacityHours: 480, gapHours: -120, gapFte: -0.75 },
    { podId: 2, podName: 'Beta Pod',  monthIndex: 1, monthLabel: 'Jan', demandHours: 0,   capacityHours: 320, gapHours: 320, gapFte: 2.0 },
  ],
};

const MOCK_UTILIZATION = [
  { podId: 1, podName: 'Alpha Pod', monthIndex: 1, utilizationPct: 66.7 },
  { podId: 1, podName: 'Alpha Pod', monthIndex: 2, utilizationPct: 125.0 },
  { podId: 2, podName: 'Beta Pod',  monthIndex: 1, utilizationPct: 0.0 },
];

const MOCK_HIRING = {
  hires: [
    { podId: 1, podName: 'Alpha Pod', role: 'DEVELOPER', monthIndex: 2, monthLabel: 'Feb', deficitHours: 120, ftesNeeded: 0.75 },
  ],
};

const MOCK_CONCURRENCY = {
  risks: [
    { podId: 1, podName: 'Alpha Pod', monthIndex: 1, monthLabel: 'Jan', activeProjectCount: 3, riskLevel: 'MEDIUM' },
    { podId: 1, podName: 'Alpha Pod', monthIndex: 2, monthLabel: 'Feb', activeProjectCount: 5, riskLevel: 'HIGH' },
  ],
};

const MOCK_ALLOCATION = {
  allocations: [
    { resourceId: 1, resourceName: 'Alice', role: 'DEVELOPER', podName: 'Alpha Pod', monthIndex: 1, allocatedHours: 160, availableHours: 168, utilizationPct: 95 },
    { resourceId: 1, resourceName: 'Alice', role: 'DEVELOPER', podName: 'Alpha Pod', monthIndex: 2, allocatedHours: 200, availableHours: 152, utilizationPct: 131 },
  ],
};

// Critical: these are the CORRECT field names after our fix
const MOCK_CAPACITY_DEMAND: CapacityDemandSummaryData[] = [
  { monthIndex: 1, monthLabel: 'Jan', totalDemandHours: 320,  totalCapacityHours: 480,  netGapHours: 160,   utilizationPct: 66.7 },
  { monthIndex: 2, monthLabel: 'Feb', totalDemandHours: 600,  totalCapacityHours: 480,  netGapHours: -120,  utilizationPct: 125.0 },
  { monthIndex: 3, monthLabel: 'Mar', totalDemandHours: 400,  totalCapacityHours: 520,  netGapHours: 120,   utilizationPct: 76.9 },
];

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  http.get('/api/reports/capacity-gap',       () => HttpResponse.json(MOCK_GAPS)),
  http.get('/api/reports/utilization-heatmap',() => HttpResponse.json(MOCK_UTILIZATION)),
  http.get('/api/reports/hiring-forecast',    () => HttpResponse.json(MOCK_HIRING)),
  http.get('/api/reports/concurrency-risk',   () => HttpResponse.json(MOCK_CONCURRENCY)),
  http.get('/api/reports/resource-allocation',() => HttpResponse.json(MOCK_ALLOCATION)),
  http.get('/api/reports/capacity-demand-summary', () => HttpResponse.json({ months: MOCK_CAPACITY_DEMAND })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCapacityGap', () => {
  it('returns gaps array', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityGap(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.gaps).toHaveLength(3);
  });

  it('gap shapes include podName, monthIndex, demandHours, capacityHours, gapHours, gapFte', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityGap(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const gap = result.current.data!.gaps[0];
    expect(gap).toHaveProperty('podName');
    expect(gap).toHaveProperty('monthIndex');
    expect(gap).toHaveProperty('demandHours');
    expect(gap).toHaveProperty('capacityHours');
    expect(gap).toHaveProperty('gapHours');
    expect(gap).toHaveProperty('gapFte');
  });

  it('identifies deficit months (gapHours < 0)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityGap(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const deficits = result.current.data!.gaps.filter(g => g.gapHours < 0);
    expect(deficits).toHaveLength(1);
    expect(deficits[0].podName).toBe('Alpha Pod');
    expect(deficits[0].monthIndex).toBe(2);
  });
});

describe('useUtilizationHeatmap', () => {
  it('returns utilization array', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUtilizationHeatmap(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
  });

  it('identifies overloaded months (utilizationPct > 100)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUtilizationHeatmap(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const overloaded = result.current.data!.filter(u => u.utilizationPct > 100);
    expect(overloaded).toHaveLength(1);
    expect(overloaded[0].utilizationPct).toBe(125.0);
  });
});

describe('useHiringForecast', () => {
  it('returns hiring recommendations', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHiringForecast(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('hiring record has correct shape', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHiringForecast(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const hire = result.current.data![0];
    expect(hire).toMatchObject({ podName: 'Alpha Pod', role: 'DEVELOPER', monthLabel: 'Feb', deficitHours: 120, ftesNeeded: 0.75 });
  });
});

describe('useConcurrencyRisk', () => {
  it('returns risk entries', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useConcurrencyRisk(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('HIGH risk when activeProjectCount >= 5', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useConcurrencyRisk(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const high = result.current.data!.filter(r => r.riskLevel === 'HIGH');
    expect(high).toHaveLength(1);
    expect(high[0].activeProjectCount).toBe(5);
  });
});

describe('useResourceAllocation', () => {
  it('returns allocation entries', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResourceAllocation(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('includes over-allocated months (allocatedHours > availableHours)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResourceAllocation(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const overAlloc = result.current.data!.filter(a => a.allocatedHours > a.availableHours);
    expect(overAlloc).toHaveLength(1);
    expect(overAlloc[0].utilizationPct).toBe(131);
  });
});

// ── Regression: CapacityDemandSummary field names ─────────────────────────────
// Bug fixed: ResourceForecastPage used wrong dataKey names in Recharts
// "month", "capacity", "demand", "gap" → correct names below

describe('Regression: useCapacityDemandSummary field names', () => {
  it('response uses monthLabel (not month)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityDemandSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data![0];
    expect(first).toHaveProperty('monthLabel');
    expect(first).not.toHaveProperty('month'); // old wrong key
  });

  it('response uses totalCapacityHours (not capacity)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityDemandSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data![0];
    expect(first).toHaveProperty('totalCapacityHours');
    expect(first).not.toHaveProperty('capacity'); // old wrong key
  });

  it('response uses totalDemandHours (not demand)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityDemandSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data![0];
    expect(first).toHaveProperty('totalDemandHours');
    expect(first).not.toHaveProperty('demand'); // old wrong key
  });

  it('response uses netGapHours (not gap)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityDemandSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data![0];
    expect(first).toHaveProperty('netGapHours');
    expect(first).not.toHaveProperty('gap'); // old wrong key
  });

  it('net gap is correctly computed as capacity minus demand', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityDemandSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const month = result.current.data![0];
    expect(month.netGapHours).toBeCloseTo(month.totalCapacityHours - month.totalDemandHours, 1);
  });

  it('all 3 months are returned', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCapacityDemandSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
  });
});
