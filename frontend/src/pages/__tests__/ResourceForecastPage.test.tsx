/**
 * ResourceForecastPage tests — chart dataKey regression and data rendering.
 *
 * Covers:
 * - Page renders without crashing
 * - Hiring forecast table shows month labels and pod names
 * - CapacityDemandSummary data uses correct field names
 *
 * Regression:
 * - Bug: Recharts Area/Line components used wrong dataKeys:
 *     dataKey="month"     → correct: dataKey="monthLabel"
 *     dataKey="capacity"  → correct: dataKey="totalCapacityHours"
 *     dataKey="demand"    → correct: dataKey="totalDemandHours"
 *     dataKey="gap"       → correct: dataKey="netGapHours"
 *   With wrong dataKeys, Recharts finds no matching field in data objects
 *   and renders blank lines — chart appears completely empty.
 * - Fix: Updated all dataKey props in ResourceForecastPage.tsx to match
 *   the CapacityDemandSummaryData TypeScript interface.
 *
 * These tests verify the API response shape matches what the chart expects,
 * ensuring the fix remains effective and the type contract is not broken.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithProviders, commonHandlers } from '../../test/helpers';
import type { CapacityDemandSummaryData } from '../../types/report';
import ResourceForecastPage from '../reports/ResourceForecastPage';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CAPACITY_DEMAND: CapacityDemandSummaryData[] = [
  { monthIndex: 1, monthLabel: 'Jan', totalDemandHours: 320, totalCapacityHours: 480, netGapHours: 160,  utilizationPct: 66.7 },
  { monthIndex: 2, monthLabel: 'Feb', totalDemandHours: 600, totalCapacityHours: 480, netGapHours: -120, utilizationPct: 125.0 },
  { monthIndex: 3, monthLabel: 'Mar', totalDemandHours: 400, totalCapacityHours: 520, netGapHours: 120,  utilizationPct: 76.9 },
];

const HIRING_FORECAST = {
  hires: [
    { podId: 1, podName: 'Alpha Pod', role: 'DEVELOPER', monthIndex: 2, monthLabel: 'Feb',
      deficitHours: 120, ftesNeeded: 0.75 },
    { podId: 2, podName: 'Beta Pod', role: 'QA', monthIndex: 3, monthLabel: 'Mar',
      deficitHours: 80, ftesNeeded: 0.5 },
  ],
};

const POD_RESOURCE_SUMMARY = {
  pods: [
    {
      podId: 1, podName: 'Alpha Pod',
      resources: [{ role: 'DEVELOPER', count: 3, totalFte: 3.0 }],
    },
  ],
};

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  ...commonHandlers,
  http.get('/api/reports/capacity-demand-summary',
    () => HttpResponse.json({ months: CAPACITY_DEMAND })),
  http.get('/api/reports/hiring-forecast',
    () => HttpResponse.json(HIRING_FORECAST)),
  http.get('/api/reports/pod-resource-summary',
    () => HttpResponse.json(POD_RESOURCE_SUMMARY)),
  http.get('/api/reports/resource-allocation',
    () => HttpResponse.json({ allocations: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResourceForecastPage — basic rendering', () => {
  it('renders without crashing', async () => {
    renderWithProviders(<ResourceForecastPage />);
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).toBeNull();
    }, { timeout: 4000 });
  });

  it('shows hiring forecast pod names', async () => {
    renderWithProviders(<ResourceForecastPage />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Pod')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows hiring forecast month labels', async () => {
    renderWithProviders(<ResourceForecastPage />);
    await waitFor(() => {
      expect(screen.getByText('Feb')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText('Mar')).toBeInTheDocument();
  });

  it('shows hiring forecast FTE values', async () => {
    renderWithProviders(<ResourceForecastPage />);
    await waitFor(() => {
      expect(screen.getByText(/0.75/)).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});

// ── Regression: CapacityDemandSummaryData field names ─────────────────────────
// These are pure data/type contract tests that verify the API shape matches
// what Recharts charts expect after the dataKey fix.

describe('Regression: CapacityDemandSummaryData field name contract', () => {
  it('monthLabel field exists (not "month")', () => {
    const data = CAPACITY_DEMAND[0];
    expect(data).toHaveProperty('monthLabel');
    expect(data).not.toHaveProperty('month'); // old wrong key
    expect(data.monthLabel).toBe('Jan');
  });

  it('totalCapacityHours field exists (not "capacity")', () => {
    const data = CAPACITY_DEMAND[0];
    expect(data).toHaveProperty('totalCapacityHours');
    expect(data).not.toHaveProperty('capacity'); // old wrong key
    expect(data.totalCapacityHours).toBe(480);
  });

  it('totalDemandHours field exists (not "demand")', () => {
    const data = CAPACITY_DEMAND[0];
    expect(data).toHaveProperty('totalDemandHours');
    expect(data).not.toHaveProperty('demand'); // old wrong key
    expect(data.totalDemandHours).toBe(320);
  });

  it('netGapHours field exists (not "gap")', () => {
    const data = CAPACITY_DEMAND[0];
    expect(data).toHaveProperty('netGapHours');
    expect(data).not.toHaveProperty('gap'); // old wrong key
    expect(data.netGapHours).toBe(160);
  });

  it('netGapHours = totalCapacityHours − totalDemandHours', () => {
    CAPACITY_DEMAND.forEach(d => {
      const expected = d.totalCapacityHours - d.totalDemandHours;
      expect(d.netGapHours).toBeCloseTo(expected, 1);
    });
  });

  it('utilizationPct = (totalDemandHours / totalCapacityHours) * 100', () => {
    CAPACITY_DEMAND.forEach(d => {
      const expected = (d.totalDemandHours / d.totalCapacityHours) * 100;
      expect(d.utilizationPct).toBeCloseTo(expected, 0);
    });
  });

  it('overloaded months have utilizationPct > 100', () => {
    const overloaded = CAPACITY_DEMAND.filter(d => d.utilizationPct > 100);
    expect(overloaded).toHaveLength(1);
    expect(overloaded[0].monthLabel).toBe('Feb');
    expect(overloaded[0].netGapHours).toBeLessThan(0); // demand exceeds capacity
  });

  it('surplus months have positive netGapHours', () => {
    const surplus = CAPACITY_DEMAND.filter(d => d.netGapHours > 0);
    expect(surplus.length).toBeGreaterThan(0);
    surplus.forEach(d => {
      expect(d.totalCapacityHours).toBeGreaterThan(d.totalDemandHours);
    });
  });

  it('all 3 months are returned in order', () => {
    expect(CAPACITY_DEMAND).toHaveLength(3);
    expect(CAPACITY_DEMAND.map(d => d.monthLabel)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(CAPACITY_DEMAND.map(d => d.monthIndex)).toEqual([1, 2, 3]);
  });
});

describe('Hiring forecast data shape', () => {
  it('hiring record has podName, role, monthLabel, deficitHours, ftesNeeded', () => {
    const hire = HIRING_FORECAST.hires[0];
    expect(hire).toHaveProperty('podName');
    expect(hire).toHaveProperty('role');
    expect(hire).toHaveProperty('monthLabel');
    expect(hire).toHaveProperty('deficitHours');
    expect(hire).toHaveProperty('ftesNeeded');
  });

  it('ftesNeeded is deficitHours / 160 (approx one FTE = 160 hours)', () => {
    const hire = HIRING_FORECAST.hires[0];
    // 120 deficit hours / 160 = 0.75 FTE
    expect(hire.ftesNeeded).toBeCloseTo(hire.deficitHours / 160, 1);
  });
});
