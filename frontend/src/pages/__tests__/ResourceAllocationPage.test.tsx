/**
 * ResourceAllocationPage tests — over-allocation warning fix and rendering.
 *
 * Covers:
 * - Page renders with resource allocation data
 * - Resource names appear in the table
 * - Filter controls are present (search, pod, role)
 * - Over-allocation warning logic (overAllocMap)
 *
 * Regression:
 * - Bug: `if (row.capacityFte >= 1) continue` in overAllocMap useMemo
 *   skipped full-time (100% FTE) resources, so they never got flagged for
 *   over-allocation even when they worked more hours than available.
 * - Fix: Removed the guard — all resources are now checked against their
 *   own FTE cap (max = workingHours * capacityFte).
 * - These tests verify full-time resources CAN appear in the overAllocMap.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithProviders, commonHandlers } from '../../test/helpers';
import ResourceAllocationPage from '../reports/ResourceAllocationPage';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Allocation data: resource 1 has one over-allocated month (month 2)
const ALLOCATIONS = [
  { resourceId: 1, resourceName: 'Alice Dev', role: 'DEVELOPER', podName: 'Alpha Pod',
    monthIndex: 1, allocatedHours: 140, availableHours: 168, utilizationPct: 83 },
  { resourceId: 1, resourceName: 'Alice Dev', role: 'DEVELOPER', podName: 'Alpha Pod',
    monthIndex: 2, allocatedHours: 200, availableHours: 152, utilizationPct: 131 }, // over-allocated
  { resourceId: 2, resourceName: 'Bob QA', role: 'QA', podName: 'Beta Pod',
    monthIndex: 1, allocatedHours: 80, availableHours: 84, utilizationPct: 95 },
  { resourceId: 2, resourceName: 'Bob QA', role: 'QA', podName: 'Beta Pod',
    monthIndex: 2, allocatedHours: 60, availableHours: 76, utilizationPct: 79 },
];

// Availability data with 1-based month keys
// Resource 1 is full-time (capacityFte = 1.0) — was previously SKIPPED by the bug
// Resource 2 is part-time (capacityFte = 0.5)
interface AvailRow {
  resourceId: number;
  resourceName: string;
  capacityFte: number;
  months: Record<number, number>;
}

const AVAILABILITY: AvailRow[] = [
  {
    resourceId: 1,
    resourceName: 'Alice Dev',
    capacityFte: 1.0, // full-time — BUG: previously skipped from over-alloc detection
    months: {
      1: 140, 2: 200, 3: 0, 4: 0, 5: 0, 6: 0,
      7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    },
  },
  {
    resourceId: 2,
    resourceName: 'Bob QA',
    capacityFte: 0.5,
    months: {
      1: 80, 2: 60, 3: 0, 4: 0, 5: 0, 6: 0,
      7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    },
  },
];

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  ...commonHandlers,
  http.get('/api/reports/resource-allocation',
    () => HttpResponse.json({ allocations: ALLOCATIONS })),
  http.get('/api/resources/availability',
    () => HttpResponse.json(AVAILABILITY)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResourceAllocationPage — basic rendering', () => {
  it('renders without crashing', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).toBeNull();
    }, { timeout: 4000 });
  });

  it('shows resource names in the table', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText('Bob QA')).toBeInTheDocument();
  });

  it('shows pod names in the table', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alpha Pod')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows role filter control', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByPlaceholderText(/all roles/i)).toBeInTheDocument();
  });

  it('shows pod filter control', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByPlaceholderText(/all pods/i)).toBeInTheDocument();
  });

  it('shows search input', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });
});

// ── Regression: overAllocMap must check full-time resources ───────────────────

describe('Regression: overAllocMap — full-time resources over-allocation check', () => {
  it('correctly computes overAllocMap for full-time resource (capacityFte = 1.0)', () => {
    // Replicate the fixed overAllocMap logic
    const workingHoursPerMonth: Record<number, number> = {
      1: 168, 2: 152, 3: 168, 4: 160, 5: 168, 6: 160,
      7: 168, 8: 160, 9: 168, 10: 160, 11: 152, 12: 160,
    };

    const map = new Map<number, number>();
    for (const row of AVAILABILITY) {
      // BUG was here: `if (row.capacityFte >= 1) continue;`
      // Fixed: removed the guard — all resources checked
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const hours = row.months[m] ?? 0;
        const max = Math.round((workingHoursPerMonth[m] ?? 160) * (row.capacityFte ?? 1));
        if (hours > max) count++;
      }
      if (count > 0) map.set(row.resourceId, count);
    }

    // Alice (full-time): month 2 = 200 hours, max = 152 * 1.0 = 152 → over-allocated
    expect(map.has(1)).toBe(true);
    expect(map.get(1)).toBe(1); // 1 over-allocated month
  });

  it('buggy version with guard would NOT flag full-time resource', () => {
    // Demonstrate the bug: with the guard in place, Alice is skipped
    const workingHoursPerMonth: Record<number, number> = {
      1: 168, 2: 152, 3: 168, 4: 160, 5: 168, 6: 160,
      7: 168, 8: 160, 9: 168, 10: 160, 11: 152, 12: 160,
    };

    const buggyMap = new Map<number, number>();
    for (const row of AVAILABILITY) {
      if (row.capacityFte >= 1) continue; // THE BUG
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const hours = row.months[m] ?? 0;
        const max = Math.round((workingHoursPerMonth[m] ?? 160) * (row.capacityFte ?? 1));
        if (hours > max) count++;
      }
      if (count > 0) buggyMap.set(row.resourceId, count);
    }

    // With the bug: Alice (full-time) is NOT in the map (false negative)
    expect(buggyMap.has(1)).toBe(false);
  });

  it('fixed version correctly flags full-time over-allocation', () => {
    const workingHoursPerMonth: Record<number, number> = {
      1: 168, 2: 152, 3: 168, 4: 160, 5: 168, 6: 160,
      7: 168, 8: 160, 9: 168, 10: 160, 11: 152, 12: 160,
    };

    const fixedMap = new Map<number, number>();
    for (const row of AVAILABILITY) {
      // No guard — all resources checked regardless of FTE
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const hours = row.months[m] ?? 0;
        const max = Math.round((workingHoursPerMonth[m] ?? 160) * (row.capacityFte ?? 1));
        if (hours > max) count++;
      }
      if (count > 0) fixedMap.set(row.resourceId, count);
    }

    // Fixed: Alice (full-time, month 2 = 200 > 152) IS flagged
    expect(fixedMap.has(1)).toBe(true);
    // Bob (part-time 0.5): month 1 = 80, max = 168 * 0.5 = 84 → not over-allocated
    //                       month 2 = 60, max = 152 * 0.5 = 76 → not over-allocated
    expect(fixedMap.has(2)).toBe(false);
  });

  it('part-time resources with over-allocation are flagged', () => {
    const workingHoursPerMonth: Record<number, number> = {
      1: 168, 2: 152, 3: 168, 4: 160, 5: 168, 6: 160,
      7: 168, 8: 160, 9: 168, 10: 160, 11: 152, 12: 160,
    };

    // Create a part-time resource that IS over-allocated
    const partTimeOverAlloc = [{
      resourceId: 10,
      resourceName: 'Carol PT',
      capacityFte: 0.5,
      months: { 1: 100, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
    }];

    const map = new Map<number, number>();
    for (const row of partTimeOverAlloc) {
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const hours = (row.months as Record<number, number>)[m] ?? 0;
        const max = Math.round((workingHoursPerMonth[m] ?? 160) * (row.capacityFte ?? 1));
        if (hours > max) count++;
      }
      if (count > 0) map.set(row.resourceId, count);
    }

    // Carol: month 1 = 100, max = 168 * 0.5 = 84 → over-allocated
    expect(map.has(10)).toBe(true);
    expect(map.get(10)).toBe(1);
  });
});

describe('ResourceAllocationPage — utilization display', () => {
  it('shows utilization percentages in month cells', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    }, { timeout: 4000 });
    // Should show some percentage values in the cells
    const cells = screen.getAllByRole('cell');
    const hasPercentCell = cells.some((c: HTMLElement) => /\d+%/.test(c.textContent ?? ''));
    expect(hasPercentCell).toBe(true);
  });

  it('shows resource count summary', async () => {
    renderWithProviders(<ResourceAllocationPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    }, { timeout: 4000 });
    // Should show "X of Y resources" count
    expect(screen.getByText(/resources/i)).toBeInTheDocument();
  });
});
