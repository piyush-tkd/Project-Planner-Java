/**
 * Portfolio Planner — Slate Color System
 * Sprint 2: PP-201 — Replaces Baylor brand colors with neutral Slate palette
 * Compatible with Mantine v7 theme overrides
 */
import { MantineThemeOverride } from '@mantine/core';

export const SLATE = {
  light: {
    background:     '#f8fafc',   // slate-50
    surface:        '#ffffff',
    surfaceHover:   '#f1f5f9',   // slate-100
    border:         '#e2e8f0',   // slate-200
    textPrimary:    '#0f172a',   // slate-900
    textSecondary:  '#475569',   // slate-600
    textMuted:      '#94a3b8',   // slate-400
    primary:        '#0284c7',   // sky-600
    primaryHover:   '#0369a1',   // sky-700
    secondary:      '#db2777',   // pink-600
    success:        '#16a34a',   // green-600
    warning:        '#d97706',   // amber-600
    danger:         '#dc2626',   // red-600
  },
  dark: {
    background:     '#0f172a',   // slate-900
    surface:        '#1e293b',   // slate-800
    surfaceHover:   '#334155',   // slate-700
    border:         '#334155',   // slate-700
    textPrimary:    '#f1f5f9',   // slate-100
    textSecondary:  '#cbd5e1',   // slate-300
    textMuted:      '#64748b',   // slate-500
    primary:        '#38bdf8',   // sky-400
    primaryHover:   '#0ea5e9',   // sky-500
    secondary:      '#f472b6',   // pink-400
    success:        '#22c55e',   // green-500
    warning:        '#f59e0b',   // amber-500
    danger:         '#ef4444',   // red-500
  },
} as const;

/** Mantine v7 theme override using Slate palette */
export const slateTheme: MantineThemeOverride = {
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: "'Inter', 'system-ui', sans-serif",
  colors: {
    // Extend the sky color for primary actions
    sky: [
      '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
      '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e',
    ] as any,
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        overlayProps: { blur: 3, backgroundOpacity: 0.4 },
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
};

/** Type badge helper: returns Mantine color name for team type */
export function teamTypeColor(type: 'core' | 'project' | string): string {
  if (type === 'core') return 'blue';
  if (type === 'project') return 'pink';
  return 'gray';
}

/** Allocation status color based on percentage */
export function allocationStatusColor(pct: number): string {
  if (pct >= 100) return SLATE.light.danger;
  if (pct >= 80)  return SLATE.light.warning;
  return SLATE.light.success;
}
