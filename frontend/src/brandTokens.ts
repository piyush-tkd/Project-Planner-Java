/**
 * Baylor Genetics — Brand Design Tokens
 * Source: Brand Guidelines v01.1 (10.31.2025)
 *
 * These tokens are the single source of truth for all brand colours,
 * typography, spacing, and shadow definitions across the application.
 *
 * S3.3 — DEEP_BLUE and AQUA now use CSS custom properties that
 * automatically adapt to dark/light mode via global.css :root overrides.
 * Raw hex values (_HEX suffix) are kept for Mantine theme registration
 * in main.tsx and for chart/canvas contexts that can't use CSS vars.
 */

/* ── Raw hex (for theme registration + chart rendering) ───────────── */
export const DEEP_BLUE_HEX = '#0C2340';   // Primary navy — raw hex
export const AQUA_HEX      = '#2DCCD3';   // Primary teal — raw hex

/* ── Primary Palette ──────────────────────────────────────────────── */
// CSS-var versions: auto-switch between dark/light mode via global.css
export const DEEP_BLUE     = 'var(--pp-primary)';   // #0C2340 light / #7dd3fc dark
export const DEEP_BLUE_85  = '#30445D';              // 85% tint (static — mid-range)
export const AQUA          = 'var(--pp-accent)';    // #1FA8AE light / #2DCCD3 dark
export const AQUA_75       = '#61D9DE';              // 75% tint (static)

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
// Shadows use hardcoded rgba values (not CSS vars) for cross-browser shadow support
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
// S3.3 — CHART_COLORS keeps raw hex so recharts/d3 can interpolate colors
export const CHART_COLORS = [
  DEEP_BLUE_HEX,      // #0C2340
  AQUA_HEX,           // #2DCCD3
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

/* ── Extended Grays (second-pass additions) ───────────────────────── */
export const SLATE_700          = '#334155';   // slate-700
export const GRAY_400           = '#9ca3af';   // tailwind gray-400
export const GRAY_200           = '#e0e0e0';   // light gray
export const GRAY_BORDER        = '#dee2e6';   // mantine gray.3
export const SIDEBAR_INACTIVE   = '#8b8fa3';   // old inactive nav text

/* ── Extended Green / Emerald ─────────────────────────────────────── */
export const COLOR_GREEN_DARK   = '#2f9e44';   // mantine green-8
export const COLOR_GREEN_STRONG = '#16a34a';   // tailwind green-600
export const COLOR_EMERALD      = '#059669';   // tailwind emerald-600
export const COLOR_VIOLET_ALT   = '#8b5cf6';   // tailwind violet-500

/* ── Extended Surfaces (second-pass) ─────────────────────────────── */
export const SURFACE_BLUE_LIGHT = '#dbeafe';   // blue-100
export const SURFACE_VIOLET     = '#ede9fe';   // violet-100
export const SURFACE_ORANGE     = '#ffedd5';   // orange-100
export const SURFACE_RED_FAINT  = '#fff5f5';   // very light red

/* ── Extended Text Colours ────────────────────────────────────────── */
export const TEXT_SUBTLE        = '#94a3b8';   // slate-400  — dimmed labels
export const TEXT_GRAY          = '#64748b';   // slate-500  — secondary text
export const TEXT_DIM           = '#868e96';   // mantine gray.6
export const GRAY_300           = '#adb5bd';   // mantine gray.4
export const GRAY_100           = '#e9ecef';   // mantine gray.2 — light border

/* ── Semantic Colour Palette ──────────────────────────────────────── */
// Errors / Danger
export const COLOR_ERROR        = '#fa5252';   // mantine red.6
export const COLOR_ERROR_STRONG = '#ef4444';   // tailwind red-500
export const COLOR_ERROR_DARK   = '#dc2626';   // tailwind red-600
export const COLOR_ERROR_DEEP   = '#c92a2a';   // darker red
export const COLOR_ERROR_LIGHT  = '#ff6b6b';   // soft red

// Warnings / Amber
export const COLOR_WARNING      = '#f59e0b';   // amber-400
export const COLOR_AMBER        = '#fab005';   // mantine yellow
export const COLOR_AMBER_DARK   = '#d97706';   // amber-600
export const COLOR_ORANGE_DARK  = '#e67700';   // dark orange

// Oranges
export const COLOR_ORANGE       = '#fd7e14';   // mantine orange
export const COLOR_ORANGE_ALT   = '#f97316';   // tailwind orange-500
export const COLOR_ORANGE_DEEP  = '#ea580c';   // tailwind orange-600

// Greens / Success
export const COLOR_SUCCESS      = '#40c057';   // mantine green.6
export const COLOR_GREEN        = '#22c55e';   // tailwind green-500
export const COLOR_GREEN_LIGHT  = '#51cf66';   // mantine green.4
export const COLOR_TEAL         = '#10b981';   // tailwind emerald-500

// Blues / Info
export const COLOR_BLUE         = '#3b82f6';   // tailwind blue-500
export const COLOR_BLUE_STRONG  = '#2563eb';   // tailwind blue-600
export const COLOR_BLUE_LIGHT   = '#339af0';   // mantine blue.5
export const COLOR_BLUE_DARK    = '#228be6';   // mantine blue.6

// Violet / Purple
export const COLOR_VIOLET       = '#7c3aed';   // violet-600
export const COLOR_VIOLET_LIGHT = '#845ef7';   // mantine violet.5

/* ── Light Surfaces ───────────────────────────────────────────────── */
export const SURFACE_SUBTLE     = '#f8f9fa';   // near-white — mantine gray.0
export const SURFACE_LIGHT      = '#f1f5f9';   // slate-100
export const SURFACE_FAINT      = '#f8fafc';   // slate-50
export const SURFACE_GRAY       = '#f0f0f0';   // neutral gray
export const SURFACE_BLUE       = '#eff6ff';   // blue-50
export const SURFACE_SUCCESS_LIGHT = '#f0fdf4'; // green-50
export const SURFACE_SUCCESS    = '#d3f9d8';   // mantine green tint
export const SURFACE_WARNING    = '#fff3bf';   // amber-50
export const SURFACE_AMBER      = '#fef3c7';   // amber-100
export const SURFACE_ERROR      = '#ffe3e3';   // red tint
export const SURFACE_ERROR_LIGHT = '#fee2e2';  // red-100

/* ── Extended Borders ─────────────────────────────────────────────── */
export const BORDER_STRONG      = '#e2e8f0';   // slate-200
export const BORDER_SOFT        = '#e5e7eb';   // tailwind gray-200

/* ── Dark Mode Surfaces ───────────────────────────────────────────── */
export const DARK_BG            = '#1a1b1e';   // darkest background
export const DARK_SURFACE       = '#25262b';   // card / paper surface
export const DARK_SURFACE_ALT   = '#242836';   // alternate dark surface
export const DARK_ELEMENT       = '#2e3346';   // elevated element bg
export const DARK_BORDER        = '#373a40';   // border in dark mode
export const DARK_SIDEBAR       = '#1a1d27';   // sidebar bg in dark mode
export const DARK_TEXT          = '#1f2937';   // text region bg in dark
export const DARK_TEXT_PRIMARY  = '#1e293b';   // dark mode text primary
export const DARK_MUTED         = '#374151';   // muted dark element

/* ── S2 Design System: 8px Spacing Scale ─────────────────────────────── */
// Use these instead of magic numbers for all margin/padding/gap values.
export const SPACING = {
  2:  2,
  4:  4,
  6:  6,
  8:  8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
  80: 80,
} as const;

/* ── Table row height tokens ──────────────────────────────────────────── */
export const TABLE_ROW_HEIGHT = {
  compact:   32,   // compact density (user preference)
  default:   44,   // standard — Wrike-inspired generous rows
  spacious:  56,   // spacious density
} as const;

/* ── Card / Paper standardized tokens ────────────────────────────────── */
export const CARD_PADDING   = 24;   // px — standard card inner padding
export const CARD_RADIUS    = 12;   // px — standard card border-radius
export const CARD_RADIUS_SM = 8;    // px — small cards / inline panels
export const CARD_RADIUS_LG = 16;   // px — large modal panels

/* ── Typography scale ─────────────────────────────────────────────────── */
export const TEXT_SIZE = {
  label:   10,   // section label (uppercase, tracked)
  caption: 11,   // caption, meta info
  small:   12,   // table cell secondary text
  body:    13,   // default body
  md:      14,   // card body text
  lg:      16,   // card title
  xl:      20,   // page sub-heading
  h3:      22,   // section heading
  h2:      26,   // page heading
  h1:      32,   // hero / KPI number
} as const;

/* ── Standard section label style (use with Text component) ───────────── */
export const SECTION_LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
} as const;

