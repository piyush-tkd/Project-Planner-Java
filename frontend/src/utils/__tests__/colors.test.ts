import { describe, it, expect } from 'vitest';
import { COLOR_ERROR, SURFACE_ERROR, SURFACE_SUBTLE, SURFACE_SUCCESS, SURFACE_WARNING } from '../../brandTokens';
import {
  getUtilizationColor,
  getUtilizationBgColor,
  getConcurrencyColor,
  getConcurrencyColorByLevel,
  getGapCellColor,
  utilizationColors,
  priorityColors,
  statusColors,
} from '../colors';

// ── getUtilizationColor ──────────────────────────────────────────────────────
describe('getUtilizationColor', () => {
  it('returns green for < 80%', () => {
    expect(getUtilizationColor(0)).toBe(utilizationColors.under);
    expect(getUtilizationColor(79)).toBe(utilizationColors.under);
  });

  it('returns amber for 80–100%', () => {
    expect(getUtilizationColor(80)).toBe(utilizationColors.normal);
    expect(getUtilizationColor(100)).toBe(utilizationColors.normal);
  });

  it('returns orange for 101–120%', () => {
    expect(getUtilizationColor(101)).toBe(utilizationColors.over);
    expect(getUtilizationColor(120)).toBe(utilizationColors.over);
  });

  it('returns red for > 120%', () => {
    expect(getUtilizationColor(121)).toBe(utilizationColors.critical);
    expect(getUtilizationColor(200)).toBe(utilizationColors.critical);
  });
});

// ── getUtilizationBgColor ────────────────────────────────────────────────────
describe('getUtilizationBgColor', () => {
  it('light mode: under 80% → green tint', () => {
    expect(getUtilizationBgColor(50)).toBe(SURFACE_SUCCESS);
  });

  it('light mode: 80–100% → yellow tint', () => {
    expect(getUtilizationBgColor(90)).toBe(SURFACE_WARNING);
  });

  it('light mode: 101–120% → orange tint', () => {
    expect(getUtilizationBgColor(110)).toBe('#ffe8cc');
  });

  it('light mode: > 120% → red tint', () => {
    expect(getUtilizationBgColor(150)).toBe(SURFACE_ERROR);
  });

  it('dark mode: returns rgba strings', () => {
    expect(getUtilizationBgColor(50, true)).toMatch(/rgba/);
    expect(getUtilizationBgColor(150, true)).toMatch(/rgba/);
  });
});

// ── getConcurrencyColor ───────────────────────────────────────────────────────
describe('getConcurrencyColor', () => {
  it('≤ 2 projects → green', () => {
    expect(getConcurrencyColor(1)).toBe(SURFACE_SUCCESS);
    expect(getConcurrencyColor(2)).toBe(SURFACE_SUCCESS);
  });

  it('3–4 projects → yellow', () => {
    expect(getConcurrencyColor(3)).toBe(SURFACE_WARNING);
    expect(getConcurrencyColor(4)).toBe(SURFACE_WARNING);
  });

  it('> 4 projects → red', () => {
    expect(getConcurrencyColor(5)).toBe(SURFACE_ERROR);
  });

  it('dark mode returns rgba strings', () => {
    expect(getConcurrencyColor(1, true)).toMatch(/rgba/);
  });
});

// ── getConcurrencyColorByLevel ────────────────────────────────────────────────
describe('getConcurrencyColorByLevel', () => {
  it('LOW → green', () => {
    expect(getConcurrencyColorByLevel('LOW')).toBe(SURFACE_SUCCESS);
  });

  it('MEDIUM → yellow', () => {
    expect(getConcurrencyColorByLevel('MEDIUM')).toBe(SURFACE_WARNING);
  });

  it('HIGH or unknown → red', () => {
    expect(getConcurrencyColorByLevel('HIGH')).toBe(SURFACE_ERROR);
    expect(getConcurrencyColorByLevel('CRITICAL')).toBe(SURFACE_ERROR);
  });

  it('dark mode returns rgba strings for each level', () => {
    expect(getConcurrencyColorByLevel('LOW', true)).toMatch(/rgba/);
    expect(getConcurrencyColorByLevel('MEDIUM', true)).toMatch(/rgba/);
    expect(getConcurrencyColorByLevel('HIGH', true)).toMatch(/rgba/);
  });
});

// ── getGapCellColor ───────────────────────────────────────────────────────────
describe('getGapCellColor', () => {
  it('positive gap (surplus) → green tint', () => {
    expect(getGapCellColor(100)).toBe(SURFACE_SUCCESS);
  });

  it('negative gap (deficit) → red tint', () => {
    expect(getGapCellColor(-100)).toBe(SURFACE_ERROR);
  });

  it('zero gap → neutral', () => {
    expect(getGapCellColor(0)).toBe(SURFACE_SUBTLE);
  });

  it('dark mode returns rgba strings', () => {
    expect(getGapCellColor(100, true)).toMatch(/rgba/);
    expect(getGapCellColor(-100, true)).toMatch(/rgba/);
  });
});

// ── Static colour maps ────────────────────────────────────────────────────────
describe('Priority colour map', () => {
  it('has entries for P0–P3', () => {
    expect(priorityColors['P0']).toBeDefined();
    expect(priorityColors['P1']).toBeDefined();
    expect(priorityColors['P2']).toBeDefined();
    expect(priorityColors['P3']).toBeDefined();
  });

  it('P0 is the most urgent (red)', () => {
    expect(priorityColors['P0']).toBe(COLOR_ERROR);
  });
});

describe('Status colour map', () => {
  it('has entries for all four statuses', () => {
    ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].forEach(s => {
      expect(statusColors[s]).toBeDefined();
    });
  });
});
