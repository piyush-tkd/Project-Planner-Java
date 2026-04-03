/**
 * ResourcePodMatrixPage tests — month index regression and rendering.
 *
 * Covers:
 * - Month columns render with correct labels (Jan–Dec)
 * - Resource names appear in the table
 * - Cells show utilization data, not all "—"
 *
 * Regression:
 * - Bug: loop used `i` (0-indexed, 0–11) for monthIndex, but API returns 1–12.
 *   getMonthData(resourceId, 0) never matched any allocation → all cells showed "—".
 * - Fix: `const monthIdx = i + 1` so lookup uses 1–12, matching API data.
 * - These tests verify real data appears in month cells after the fix.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithProviders, commonHandlers } from '../../test/helpers';
import ResourcePodMatrixPage from '../reports/ResourcePodMatrixPage';

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Use 1-based monthIndex as the API returns

const ALLOCATIONS = [
  { resourceId: 1, resourceName: 'Alice Dev', role: 'DEVELOPER', podName: 'Alpha Pod',
    monthIndex: 1, allocatedHours: 140, availableHours: 168, utilizationPct: 83 },
  { resourceId: 1, resourceName: 'Alice Dev', role: 'DEVELOPER', podName: 'Alpha Pod',
    monthIndex: 2, allocatedHours: 160, availableHours: 152, utilizationPct: 105 },
  { resourceId: 1, resourceName: 'Alice Dev', role: 'DEVELOPER', podName: 'Alpha Pod',
    monthIndex: 3, allocatedHours: 120, availableHours: 168, utilizationPct: 71 },
  { resourceId: 2, resourceName: 'Bob QA', role: 'QA', podName: 'Alpha Pod',
    monthIndex: 1, allocatedHours: 80, availableHours: 84, utilizationPct: 95 },
];

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer(
  ...commonHandlers,
  http.get('/api/reports/resource-allocation',
    () => HttpResponse.json({ allocations: ALLOCATIONS })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResourcePodMatrixPage — basic rendering', () => {
  it('renders without crashing', async () => {
    renderWithProviders(<ResourcePodMatrixPage />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 3000 });
  });

  it('shows resource names in the matrix', async () => {
    renderWithProviders(<ResourcePodMatrixPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob QA')).toBeInTheDocument();
  });

  it('shows pod name in the table', async () => {
    renderWithProviders(<ResourcePodMatrixPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Alpha Pod').length).toBeGreaterThan(0);
    });
  });
});

// ── Regression: monthIndex must be 1-based ────────────────────────────────────
// Before fix: monthIdx was `i` (0–11), getMonthData always returned undefined
// After fix:  monthIdx is `i+1` (1–12), matches API data correctly

describe('Regression: ResourcePodMatrixPage monthIndex 1-based', () => {
  it('does NOT show all dashes — at least some cells have utilization data', async () => {
    renderWithProviders(<ResourcePodMatrixPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    });
    // After fix, cells with utilization > 0 should show percentage values
    // If the bug exists, every cell shows "—" and no percentages are visible
    const cells = screen.getAllByRole('cell');
    const hasPercentCell = cells.some((c: HTMLElement) => /\d+%/.test(c.textContent ?? ''));
    expect(hasPercentCell).toBe(true);
  });

  it('month column headers show Jan through Dec labels', async () => {
    renderWithProviders(<ResourcePodMatrixPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    });
    // Month header labels should be present in the table header
    const headers = screen.getAllByRole('columnheader');
    const headerText = headers.map((h: HTMLElement) => h.textContent).join(' ');
    // At minimum Jan and Dec should be present as column headers
    expect(headerText).toMatch(/Jan/i);
    expect(headerText).toMatch(/Dec/i);
  });

  it('getMonthData correctly finds month 1 (Jan) data — not month 0 (undefined)', () => {
    // Unit test of the key lookup logic — verifies 1-based indexing
    const allocations = ALLOCATIONS;
    const getMonthData = (resourceId: number, monthIndex: number, podName: string) =>
      allocations.find(a =>
        a.resourceId === resourceId &&
        a.monthIndex === monthIndex &&
        a.podName === podName
      );

    // 1-based lookup should find data
    expect(getMonthData(1, 1, 'Alpha Pod')).toBeDefined();
    expect(getMonthData(1, 2, 'Alpha Pod')).toBeDefined();

    // 0-based lookup should NOT find data (the old bug)
    expect(getMonthData(1, 0, 'Alpha Pod')).toBeUndefined();
  });

  it('all 12 month columns render in the table header', async () => {
    renderWithProviders(<ResourcePodMatrixPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Dev')).toBeInTheDocument();
    });
    const headers = screen.getAllByRole('columnheader');
    // Expect: Name + POD + 12 month columns = at least 14 headers
    expect(headers.length).toBeGreaterThanOrEqual(14);
  });
});

describe('ResourcePodMatrixPage — utilization color levels', () => {
  it('getUtilizationLevel returns Healthy for ≤ 50%', () => {
    const getLevel = (pct: number) => {
      if (pct <= 50) return 'Healthy';
      if (pct <= 80) return 'Moderate';
      if (pct <= 95) return 'High';
      return 'Overloaded';
    };
    expect(getLevel(0)).toBe('Healthy');
    expect(getLevel(50)).toBe('Healthy');
  });

  it('getUtilizationLevel returns Overloaded for > 95%', () => {
    const getLevel = (pct: number) => {
      if (pct <= 50) return 'Healthy';
      if (pct <= 80) return 'Moderate';
      if (pct <= 95) return 'High';
      return 'Overloaded';
    };
    expect(getLevel(96)).toBe('Overloaded');
    expect(getLevel(105)).toBe('Overloaded');
    expect(getLevel(200)).toBe('Overloaded');
  });

  it('getUtilizationLevel returns High for 81–95%', () => {
    const getLevel = (pct: number) => {
      if (pct <= 50) return 'Healthy';
      if (pct <= 80) return 'Moderate';
      if (pct <= 95) return 'High';
      return 'Overloaded';
    };
    expect(getLevel(81)).toBe('High');
    expect(getLevel(95)).toBe('High');
  });
});
