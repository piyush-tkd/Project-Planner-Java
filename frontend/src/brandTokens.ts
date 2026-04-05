/**
 * Baylor Genetics — Brand Design Tokens
 * Source: Brand Guidelines v01.1 (10.31.2025)
 *
 * These tokens are the single source of truth for all brand colours,
 * typography, spacing, and shadow definitions across the application.
 */

/* ── Primary Palette ──────────────────────────────────────────────── */
export const DEEP_BLUE     = '#0C2340';   // Primary navy
export const DEEP_BLUE_85  = '#30445D';   // 85% tint
export const AQUA          = '#2DCCD3';   // Primary teal (replaces legacy sky blue)
export const AQUA_75       = '#61D9DE';   // 75% tint

/* ── Secondary Palette ────────────────────────────────────────────── */
export const LEGACY_BLUE   = '#002F6C';
export const MAUVE         = '#D7A9E3';
export const BEIGE         = '#F1E6B2';

/* ── Deep Blue Tint Scale (10% increments) ────────────────────────── */
export const DEEP_BLUE_TINTS = {
  100: DEEP_BLUE,
  90:  '#243953',
  80:  '#3D4F66',
  70:  '#556579',
  60:  '#6D7B8C',
  50:  '#85919F',
  40:  '#9EA7B3',
  30:  '#B6BDC6',
  20:  '#CED3D9',
  10:  '#E7E9EC',
} as const;

/* ── Aqua Tint Scale (10% increments) ─────────────────────────────── */
export const AQUA_TINTS = {
  100: AQUA,
  90:  '#42D1D7',
  80:  '#57D6DC',
  70:  '#6CDBE0',
  60:  '#81E0E5',
  50:  '#96E5E9',
  40:  '#ABEBED',
  30:  '#C0F0F2',
  20:  '#D5F5F6',
  10:  '#EAFAFB',
} as const;

/* ── Legacy Blue Tint Scale ───────────────────────────────────────── */
export const LEGACY_BLUE_TINTS = {
  100: LEGACY_BLUE,
  90:  '#0F407B',
  80:  '#355389',
  70:  '#4F6697',
  60:  '#687AA6',
  50:  '#808EB4',
  40:  '#99A4C3',
  30:  '#B2B9D1',
  20:  '#CBD0E0',
  10:  '#E4E6EF',
} as const;

/* ── UX-Only: Alerts & Notifications ──────────────────────────────── */
export const UX_ERROR        = '#CC071E';
export const UX_POSITIVE     = '#007D3E';
export const UX_WARNING      = '#FFC731';
export const UX_NOTIFICATION = '#0065CB';

/* ── Neutral Surfaces ─────────────────────────────────────────────── */
export const SURFACE_BG      = '#FFFFFF';
export const SURFACE_SIDEBAR  = '#F7F9FB';
export const SURFACE_CARD     = '#FFFFFF';
export const SURFACE_HOVER    = AQUA_TINTS[10];   // #EAFAFB
export const SURFACE_SELECTED = AQUA_TINTS[20];   // #D5F5F6
export const BORDER_DEFAULT   = DEEP_BLUE_TINTS[10]; // #E7E9EC
export const BORDER_SUBTLE    = '#EDF0F3';
export const TEXT_PRIMARY     = DEEP_BLUE;
export const TEXT_SECONDARY   = DEEP_BLUE_TINTS[60]; // #6D7B8C
export const TEXT_MUTED       = DEEP_BLUE_TINTS[50]; // #85919F

/* ── Typography ───────────────────────────────────────────────────── */
// Primary: Inter (Wrike-inspired) — loaded via Google Fonts in index.html
export const FONT_FAMILY       = "'Inter', system-ui, -apple-system, sans-serif";
export const FONT_FAMILY_MONO  = "'SF Mono', 'Fira Code', 'Consolas', monospace";

// Type scale (from brand guidelines p.28)
export const TYPE_SCALE = {
  h1: { size: 48, lineHeight: 1.1, weight: 300 },   // DIN Next Light
  h2: { size: 36, lineHeight: 1.1, weight: 300 },   // DIN Next Light
  h3: { size: 24, lineHeight: 1.1, weight: 400 },   // DIN Next Regular
  h4: { size: 18, lineHeight: 1.1, weight: 400 },   // DIN Next Regular
  body: { size: 14, lineHeight: 1.1, weight: 400 },  // DIN Next Regular
} as const;

/* ── Spacing & Radius ─────────────────────────────────────────────── */
export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
} as const;

/* ── Shadows ──────────────────────────────────────────────────────── */
export const SHADOW = {
  sm:   '0 1px 3px rgba(12, 35, 64, 0.06), 0 1px 2px rgba(12, 35, 64, 0.04)',
  md:   '0 4px 12px rgba(12, 35, 64, 0.08), 0 2px 4px rgba(12, 35, 64, 0.04)',
  lg:   '0 8px 24px rgba(12, 35, 64, 0.10), 0 4px 8px rgba(12, 35, 64, 0.06)',
  xl:   '0 16px 48px rgba(12, 35, 64, 0.14), 0 8px 16px rgba(12, 35, 64, 0.08)',
  header: '0 2px 12px rgba(12, 35, 64, 0.20)',
  card:   '0 1px 4px rgba(12, 35, 64, 0.06)',
  cardHover: '0 6px 20px rgba(12, 35, 64, 0.10)',
} as const;

/* ── Data Visualization Palette ───────────────────────────────────── */
// For charts, use this ordered sequence of colours.
// On dark backgrounds, use the "light" variants.
export const CHART_COLORS = [
  DEEP_BLUE,          // #0C2340
  AQUA,               // #2DCCD3
  LEGACY_BLUE,        // #002F6C
  AQUA_75,            // #61D9DE
  DEEP_BLUE_85,       // #30445D
  MAUVE,              // #D7A9E3
  BEIGE,              // #F1E6B2
  DEEP_BLUE_TINTS[60],// #6D7B8C
  AQUA_TINTS[50],     // #96E5E9
  LEGACY_BLUE_TINTS[50], // #808EB4
] as const;

// Alternate row fill for tables (brand spec: Deep Blue 10% tint)
export const TABLE_STRIPE = DEEP_BLUE_TINTS[10]; // #E7E9EC

/* ── Wrike-Inspired Design Tokens (v10.0) ────────────────────────── */
// Use AQUA as the primary CTA color (Wrike uses green; we use our brand teal)
export const CTA_PRIMARY     = AQUA;           // #2DCCD3
export const CTA_HOVER       = '#28B8BF';
export const CTA_TEXT        = DEEP_BLUE;      // text on CTA button
export const CTA_BG_TINT     = AQUA_TINTS[10]; // #EAFAFB — hover bg

// Table design tokens
export const TABLE_ROW_HOVER = AQUA_TINTS[10]; // #EAFAFB — no zebra, hover only
export const TABLE_HEADER_BG = DEEP_BLUE_TINTS[10]; // #E7E9EC
export const TABLE_ROW_HEIGHT_PX = 44; // Wrike-style generous row height

// Card accent border
export const CARD_ACCENT_BORDER = `3px solid ${AQUA}`;

// Status colors (Wrike-style with border polish)
export const STATUS_ACTIVE      = { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
export const STATUS_IN_PROGRESS = { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
export const STATUS_ON_HOLD     = { bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
export const STATUS_NOT_STARTED = { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
export const STATUS_COMPLETED   = { bg: '#f0fdf4', text: '#15803d', border: '#86efac' };
export const STATUS_CANCELLED   = { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };

