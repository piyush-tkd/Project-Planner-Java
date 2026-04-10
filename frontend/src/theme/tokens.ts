import { AQUA, DARK_ELEMENT, DARK_SIDEBAR, DARK_SURFACE_ALT, SIDEBAR_INACTIVE} from '../brandTokens';
/**
 * Portfolio Planner — Design Language Tokens (DL-1)
 *
 * Single source of truth for the dark-theme colour palette,
 * extended spacing scale, and CSS variable helpers.
 * Import from here rather than hard-coding values in components.
 */

// ── Dark-theme colour palette ───────────────────────────────────────────
export const ppColors = {
  // Background levels (darkest → lightest)
  pageBg:          '#0a0a0f',
  sidebarBg:       '#0f1117',
  surface:         DARK_SIDEBAR,
  surfaceElevated: DARK_SURFACE_ALT,

  // Borders
  border:          DARK_ELEMENT,
  borderHover:     '#3d4260',

  // Text
  text:            '#e2e4eb',
  textSecondary:   '#b0b3c1',
  textMuted:       SIDEBAR_INACTIVE,

  // Accent (brand teal)
  accent:          AQUA,
  accentHover:     '#24A8AE',
  accentPressed:   '#1D8A8F',

  // Status
  active:          '#2E7D32',
  risk:            '#FF8F00',
  blocked:         '#D32F2F',
  completed:       '#1565C0',
  discovery:       '#7C4DFF',
} as const;

export type PpColor = keyof typeof ppColors;

// ── Extended spacing scale (use in sx / style props) ───────────────────
// Mantine theme only accepts xs/sm/md/lg/xl; the larger steps live here.
export const ppSpacing = {
  xs:  '4px',
  sm:  '8px',
  md:  '12px',
  lg:  '16px',
  xl:  '24px',
  '2xl': '32px',
  '3xl': '48px',
} as const;

// ── CSS variable map (injected via global.css) ──────────────────────────
// Usage in CSS: var(--pp-surface), var(--pp-accent), etc.
export const ppCssVars: Record<string, string> = {
  '--pp-page-bg':          ppColors.pageBg,
  '--pp-sidebar-bg':       ppColors.sidebarBg,
  '--pp-surface':          ppColors.surface,
  '--pp-surface-elevated': ppColors.surfaceElevated,
  '--pp-border':           ppColors.border,
  '--pp-border-hover':     ppColors.borderHover,
  '--pp-text':             ppColors.text,
  '--pp-text-secondary':   ppColors.textSecondary,
  '--pp-text-muted':       ppColors.textMuted,
  '--pp-accent':           ppColors.accent,
  '--pp-accent-hover':     ppColors.accentHover,
  '--pp-accent-pressed':   ppColors.accentPressed,
  '--pp-active':           ppColors.active,
  '--pp-risk':             ppColors.risk,
  '--pp-blocked':          ppColors.blocked,
  '--pp-completed':        ppColors.completed,
  '--pp-discovery':        ppColors.discovery,
};
