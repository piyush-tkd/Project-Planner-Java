/**
 * useThemeTokens — S2-07 Design System Hook
 *
 * Single source of truth for all theme-aware color tokens.
 * Replaces hundreds of scattered `isDark ? '#xxx' : '#yyy'` expressions.
 *
 * Usage:
 *   const t = useThemeTokens();
 *   <Text style={{ color: t.textPrimary }}>Hello</Text>
 *   <Paper style={{ background: t.surfaceBg, border: `1px solid ${t.borderColor}` }}>
 */
import { useComputedColorScheme } from '@mantine/core';
import {
  AQUA, AQUA_TINTS, DEEP_BLUE, DEEP_BLUE_TINTS,
  BORDER_DEFAULT, FONT_FAMILY,
} from '../brandTokens';

export interface ThemeTokens {
  isDark: boolean;

  // ── Surfaces ────────────────────────────────────────────────────────
  /** Main page/card background */
  surfaceBg:     string;
  /** Slightly elevated surface (inner panels, inputs) */
  surfaceCard:   string;
  /** Alternate row / subtle background */
  surfaceAlt:    string;
  /** Hover state background */
  surfaceHover:  string;
  /** Selected / active state background */
  surfaceActive: string;
  /** Overlay / modal backdrop */
  surfaceOverlay: string;

  // ── Text ─────────────────────────────────────────────────────────────
  /** Main body text — high contrast */
  textPrimary:   string;
  /** Secondary labels, descriptions */
  textSecondary: string;
  /** Muted / placeholder text */
  textMuted:     string;
  /** Disabled text */
  textDisabled:  string;

  // ── Borders ──────────────────────────────────────────────────────────
  /** Default 1px border */
  borderColor:  string;
  /** Stronger border (active inputs, focused elements) */
  borderStrong: string;
  /** Very subtle border (dividers within cards) */
  borderSubtle: string;

  // ── Accent / Brand ────────────────────────────────────────────────────
  /** Primary accent — AQUA teal */
  accentColor:   string;
  /** Light tint background for accent elements */
  accentBg:      string;
  /** Accent text that works on accentBg */
  accentText:    string;

  // ── Table ─────────────────────────────────────────────────────────────
  /** Table header background */
  tableHeaderBg:   string;
  /** Table header text color */
  tableHeaderText: string;
  /** Table row text */
  tableCellText:   string;
  /** Table row hover */
  tableRowHover:   string;
  /** Table alt row (zebra) */
  tableRowAlt:     string;
  /** Table border between rows */
  tableRowBorder:  string;

  // ── Cards ─────────────────────────────────────────────────────────────
  /** Card background */
  cardBg:        string;
  /** Card border color */
  cardBorder:    string;
  /** Card shadow */
  cardShadow:    string;
  /** Card hover shadow */
  cardShadowHover: string;

  // ── Inputs ────────────────────────────────────────────────────────────
  /** Input background */
  inputBg:          string;
  /** Input border */
  inputBorder:      string;
  /** Input text */
  inputText:        string;
  /** Placeholder text */
  inputPlaceholder: string;

  // ── Utilities ─────────────────────────────────────────────────────────
  /** Standard font family */
  fontFamily: string;
}

export function useThemeTokens(): ThemeTokens {
  const scheme = useComputedColorScheme('light');
  const isDark = scheme === 'dark';

  if (isDark) {
    return {
      isDark: true,

      // Surfaces
      surfaceBg:      'var(--mantine-color-dark-7)',        // #1a1b1e
      surfaceCard:    'var(--mantine-color-dark-6)',        // #25262b
      surfaceAlt:     'var(--mantine-color-dark-6)',        // slightly elevated
      surfaceHover:   'rgba(45,204,211,0.08)',
      surfaceActive:  'rgba(45,204,211,0.14)',
      surfaceOverlay: 'rgba(0,0,0,0.55)',

      // Text
      textPrimary:   '#e9ecef',
      textSecondary: '#9ca3af',
      textMuted:     '#6b7280',
      textDisabled:  '#4b5563',

      // Borders
      borderColor:  'var(--mantine-color-dark-4)',          // #373a40
      borderStrong: 'var(--mantine-color-dark-3)',          // #2c2e33
      borderSubtle: 'rgba(255,255,255,0.06)',

      // Accent
      accentColor: AQUA,
      accentBg:    'rgba(45,204,211,0.15)',
      accentText:  AQUA,

      // Table
      tableHeaderBg:   'rgba(255,255,255,0.04)',
      tableHeaderText: 'rgba(255,255,255,0.70)',
      tableCellText:   '#e9ecef',
      tableRowHover:   'rgba(45,204,211,0.07)',
      tableRowAlt:     'rgba(255,255,255,0.025)',
      tableRowBorder:  'rgba(255,255,255,0.06)',

      // Cards
      cardBg:          'var(--mantine-color-dark-6)',
      cardBorder:      'rgba(255,255,255,0.08)',
      cardShadow:      '0 1px 4px rgba(0,0,0,0.4)',
      cardShadowHover: '0 6px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(45,204,211,0.2)',

      // Inputs
      inputBg:          'rgba(255,255,255,0.05)',
      inputBorder:      'rgba(255,255,255,0.12)',
      inputText:        '#e9ecef',
      inputPlaceholder: 'rgba(255,255,255,0.35)',

      fontFamily: FONT_FAMILY,
    };
  }

  return {
    isDark: false,

    // Surfaces
    surfaceBg:      '#ffffff',
    surfaceCard:    '#ffffff',
    surfaceAlt:     '#f8fafc',
    surfaceHover:   AQUA_TINTS[10],
    surfaceActive:  AQUA_TINTS[20],
    surfaceOverlay: 'rgba(12,35,64,0.45)',

    // Text
    textPrimary:   DEEP_BLUE,
    textSecondary: DEEP_BLUE_TINTS[60],
    textMuted:     DEEP_BLUE_TINTS[50],
    textDisabled:  DEEP_BLUE_TINTS[30],

    // Borders
    borderColor:  BORDER_DEFAULT,
    borderStrong: DEEP_BLUE_TINTS[20],
    borderSubtle: '#f1f5f9',

    // Accent
    accentColor: AQUA,
    accentBg:    AQUA_TINTS[10],
    accentText:  DEEP_BLUE,

    // Table
    tableHeaderBg:   DEEP_BLUE_TINTS[10],
    tableHeaderText: DEEP_BLUE_TINTS[60],
    tableCellText:   DEEP_BLUE,
    tableRowHover:   AQUA_TINTS[10],
    tableRowAlt:     '#fafbfc',
    tableRowBorder:  BORDER_DEFAULT,

    // Cards
    cardBg:          '#ffffff',
    cardBorder:      BORDER_DEFAULT,
    cardShadow:      '0 1px 3px rgba(12,35,64,0.06), 0 1px 2px rgba(12,35,64,0.04)',
    cardShadowHover: '0 6px 20px rgba(12,35,64,0.10), 0 2px 6px rgba(12,35,64,0.06)',

    // Inputs
    inputBg:          '#ffffff',
    inputBorder:      BORDER_DEFAULT,
    inputText:        DEEP_BLUE,
    inputPlaceholder: DEEP_BLUE_TINTS[40],

    fontFamily: FONT_FAMILY,
  };
}

export default useThemeTokens;
