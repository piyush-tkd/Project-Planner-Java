import { describe, it, expect } from 'vitest';
import {
  formatHours,
  formatFte,
  formatGapHours,
  formatGapFte,
  formatPercent,
  formatMonth,
  formatResourceName,
  formatProjectDate,
} from '../formatting';

// ── formatHours ──────────────────────────────────────────────────────────────
describe('formatHours', () => {
  it('rounds a decimal to the nearest integer', () => {
    expect(formatHours(160.4)).toBe('160');
    expect(formatHours(160.6)).toBe('161');
  });

  it('formats integers unchanged', () => {
    expect(formatHours(0)).toBe('0');
    expect(formatHours(1000)).toBe('1,000');
  });

  it('formats large numbers with locale separators', () => {
    expect(formatHours(10000)).toBe('10,000');
  });
});

// ── formatFte ────────────────────────────────────────────────────────────────
describe('formatFte', () => {
  it('renders one decimal place', () => {
    expect(formatFte(1.0)).toBe('1.0');
    expect(formatFte(0.5)).toBe('0.5');
    expect(formatFte(2.75)).toBe('2.8'); // rounds to 1dp
  });

  it('renders zero correctly', () => {
    expect(formatFte(0)).toBe('0.0');
  });
});

// ── formatGapHours ───────────────────────────────────────────────────────────
describe('formatGapHours', () => {
  it('prefixes positive values with "+"', () => {
    expect(formatGapHours(160)).toBe('+160');
  });

  it('uses minus sign "−" (not hyphen) for negative values', () => {
    const result = formatGapHours(-80);
    expect(result).toMatch(/^−/);   // Unicode minus, not ASCII hyphen
    expect(result).toBe('−80');
  });

  it('returns plain number for zero', () => {
    expect(formatGapHours(0)).toBe('0');
  });

  it('rounds to nearest integer before formatting', () => {
    expect(formatGapHours(160.7)).toBe('+161');
    expect(formatGapHours(-80.3)).toBe('−80');
  });

  it('includes locale separators for large numbers', () => {
    expect(formatGapHours(10000)).toBe('+10,000');
  });
});

// ── formatGapFte ─────────────────────────────────────────────────────────────
describe('formatGapFte', () => {
  it('prefixes surplus with "+"', () => {
    expect(formatGapFte(1.5)).toBe('+1.5');
  });

  it('uses "−" for deficit', () => {
    expect(formatGapFte(-2.0)).toBe('−2.0');
  });

  it('returns plain value for zero', () => {
    expect(formatGapFte(0)).toBe('0.0');
  });
});

// ── formatPercent ────────────────────────────────────────────────────────────
describe('formatPercent', () => {
  it('rounds to nearest whole percent', () => {
    expect(formatPercent(75.4)).toBe('75%');
    expect(formatPercent(75.6)).toBe('76%');
  });

  it('renders zero and 100 correctly', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('100%');
  });
});

// ── formatMonth ──────────────────────────────────────────────────────────────
describe('formatMonth', () => {
  const labels: Record<number, string> = {
    1: 'Jan 2025',
    2: 'Feb 2025',
    12: 'Dec 2025',
  };

  it('returns the label for a known month index', () => {
    expect(formatMonth(1, labels)).toBe('Jan 2025');
    expect(formatMonth(12, labels)).toBe('Dec 2025');
  });

  it('falls back to "Mn" when the index is not in the map', () => {
    expect(formatMonth(99, labels)).toBe('M99');
  });

  it('works with an empty labels map', () => {
    expect(formatMonth(3, {})).toBe('M3');
  });
});

// ── formatResourceName ───────────────────────────────────────────────────────
describe('formatResourceName', () => {
  it('replaces TECH_LEAD with "Tech Lead"', () => {
    expect(formatResourceName('Alice TECH_LEAD')).toBe('Alice Tech Lead');
  });

  it('replaces DEVELOPER with "Developer"', () => {
    expect(formatResourceName('Bob DEVELOPER')).toBe('Bob Developer');
  });

  it('leaves unrecognised strings unchanged', () => {
    expect(formatResourceName('Alice QA')).toBe('Alice QA');
  });

  it('handles multiple replacements in one string', () => {
    expect(formatResourceName('DEVELOPER TECH_LEAD')).toBe('Developer Tech Lead');
  });
});

// ── formatProjectDate ────────────────────────────────────────────────────────
describe('formatProjectDate', () => {
  const monthLabels: Record<number, string> = { 3: 'Mar 2025' };

  it('formats a valid ISO date string', () => {
    const result = formatProjectDate('2025-06-15', 3, monthLabels);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  it('falls back to month label when isoDate is null', () => {
    expect(formatProjectDate(null, 3, monthLabels)).toBe('Mar 2025');
  });

  it('falls back to month label when isoDate is undefined', () => {
    expect(formatProjectDate(undefined, 3, monthLabels)).toBe('Mar 2025');
  });

  it('falls back to "Mn" when isoDate is null and month has no label', () => {
    expect(formatProjectDate(null, 99, monthLabels)).toBe('M99');
  });
});
