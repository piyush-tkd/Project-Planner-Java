import { describe, it, expect } from 'vitest';
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
    expect(getUtilizationBgColor(50)).toBe('#d3f9d8');
  });

  it('light mode: 80–100% → yellow tint', () => {
    expect(getUtilizationBgColor(90)).toBe('#fff3bf');
  });

  it('light mode: 101–120% → orange tint', () => {
    expect(getUtilizationBgColor(110)).toBe('#ffe8cc');
  });

  it('light mode: > 120% → red tint', () => {
    expect(getUtilizationBgColor(150)).toBe('#ffe3e3');
  });

  it('dark mode: returns rgba strings', () => {
    expect(getUtilizationBgColor(50, true)).toMatch(/rgba/);
    expect(getUtilizationBgColor(150, true)).toMatch(/rgba/);
  });
});

// ── getConcurrencyColor ───────────────────────────────────────────────────────
describe('getConcurrencyColor', () => {
  it('≤ 2 projects → green', () => {
    expect(getConcurrencyColor(1)).toBe('#d3f9d8');
    expect(getConcurrencyColor(2)).toBe('#d3f9d8');
  });

  it('3–4 projects → yellow', () => {
    expect(getConcurrencyColor(3)).toBe('#fff3bf');
    expect(getConcurrencyColor(4)).toBe('#fff3bf');
  });

  it('> 4 projects → red', () => {
    expect(getConcurrencyColor(5)).toBe('#ffe3e3');
  });

  it('dark mode returns rgba strings', () => {
    expect(getConcurrencyColor(1, true)).toMatch(/rgba/);
  });
});

// ── getConcurrencyColorByLevel ────────────────────────────────────────────────
describe('getConcurrencyColorByLevel', () => {
  it('LOW → green', () => {
    expect(getConcurrencyColorByLevel('LOW')).toBe('#d3f9d8');
  });

  it('MEDIUM → yellow', () => {
    expect(getConcurrencyColorByLevel('MEDIUM')).toBe('#fff3bf');
  });

  it('HIGH or unknown → red', () => {
    expect(getConcurrencyColorByLevel('HIGH')).toBe('#ffe3e3');
    expect(getConcurrencyColorByLevel('CRITICAL')).toBe('#ffe3e3');
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
    expect(getGapCellColor(100)).toBe('#d3f9d8');
  });

  it('negative gap (deficit) → red tint', () => {
    expect(getGapCellColor(-100)).toBe('#ffe3e3');
  });

  it('zero gap → neutral', () => {
    expect(getGapCellColor(0)).toBe('#f8f9fa');
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
    expect(priorityColors['P0']).toBe('#fa5252');
  });
});

describe('Status colour map', () => {
  it('has entries for all four statuses', () => {
    ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].forEach(s => {
      expect(statusColors[s]).toBeDefined();
    });
  });
});
