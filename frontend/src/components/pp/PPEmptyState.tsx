/**
 * PPEmptyState — S2-16 Design System Component
 *
 * Standardized empty state with SVG illustration, title, body, and CTA.
 * Replaces bare "No data" strings across 10+ pages.
 *
 * Usage:
 *   <PPEmptyState variant="no-data" title="No projects yet" body="Create your first project to get started." action={<Button>New Project</Button>} />
 *   <PPEmptyState variant="no-results" />
 *   <PPEmptyState variant="first-use" title="Welcome!" body="Let's set up your portfolio." action={<Button>Get started</Button>} />
 */
import React from 'react';
import { Stack, Text, Box, Group } from '@mantine/core';
import { AQUA, AQUA_HEX, AQUA_TINTS, DEEP_BLUE, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';
import { useThemeTokens } from '../../hooks/useThemeTokens';

export type PPEmptyStateVariant =
  | 'no-data'
  | 'no-results'
  | 'first-use'
  | 'no-connection'
  | 'error'
  | 'no-access'
  | 'coming-soon'
  | 'custom';

export interface PPEmptyStateProps {
  /** Visual theme — determines icon, default title & body */
  variant?: PPEmptyStateVariant;
  /** Override title */
  title?: string;
  /** Override body text */
  body?: string;
  /** Primary CTA button (any ReactNode) */
  action?: React.ReactNode;
  /** Secondary action link/button */
  secondaryAction?: React.ReactNode;
  /** Override icon size (default 64) */
  iconSize?: number;
  /** Compact mode — reduces padding */
  compact?: boolean;
}

// ── SVG illustrations ────────────────────────────────────────────────────────

function IconNoData({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="8" y="16" width="48" height="36" rx="6" stroke={color} strokeWidth="2" opacity="0.3" />
      <rect x="8" y="16" width="48" height="10" rx="6" fill={color} opacity="0.15" />
      <line x1="18" y1="35" x2="46" y2="35" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="18" y1="43" x2="36" y2="43" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.25" />
      <circle cx="48" cy="48" r="12" fill={AQUA_HEX} opacity="0.15" />
      <line x1="48" y1="44" x2="48" y2="52" stroke={AQUA_HEX} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="44" y1="48" x2="52" y2="48" stroke={AQUA_HEX} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconNoResults({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="28" cy="28" r="16" stroke={color} strokeWidth="2" opacity="0.4" />
      <line x1="40" y1="40" x2="52" y2="52" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <line x1="23" y1="28" x2="33" y2="28" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="28" y1="23" x2="28" y2="33" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

function IconFirstUse({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="12" y="20" width="40" height="28" rx="6" fill={color} stroke={color} strokeWidth="2" opacity="0.25" />
      <circle cx="32" cy="34" r="8" fill={AQUA_HEX} opacity="0.2" stroke={AQUA_HEX} strokeWidth="2" />
      <line x1="32" y1="30" x2="32" y2="38" stroke={AQUA_HEX} strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="34" x2="36" y2="34" stroke={AQUA_HEX} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 20 L32 12 L44 20" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
    </svg>
  );
}

function IconNoConnection({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M8 32 C8 19 19 8 32 8 C45 8 56 19 56 32" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.25" />
      <path d="M16 40 C16 31 23 24 32 24 C41 24 48 31 48 40" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="12" y1="12" x2="52" y2="52" stroke="#f25c54" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="32" cy="50" r="4" fill={color} opacity="0.6" />
    </svg>
  );
}

function IconError({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="22" stroke="#f25c54" strokeWidth="2" opacity="0.4" />
      <line x1="32" y1="20" x2="32" y2="36" stroke="#f25c54" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="44" r="2" fill="#f25c54" opacity="0.8" />
    </svg>
  );
}

function IconNoAccess({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="18" y="28" width="28" height="22" rx="4" stroke={color} strokeWidth="2" opacity="0.4" />
      <path d="M24 28 V22 C24 16 40 16 40 22 V28" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="32" cy="38" r="4" fill={color} opacity="0.4" />
      <line x1="32" y1="38" x2="32" y2="44" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function IconComingSoon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="22" stroke={AQUA_HEX} strokeWidth="2" opacity="0.3" />
      <path d="M32 18 L35 28 L46 28 L37 35 L40 46 L32 40 L24 46 L27 35 L18 28 L29 28 Z" fill={AQUA_HEX} opacity="0.2" stroke={AQUA_HEX} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Default copy per variant ──────────────────────────────────────────────────

const VARIANT_DEFAULTS: Record<PPEmptyStateVariant, { title: string; body: string }> = {
  'no-data':       { title: 'No data yet',            body: 'Data will appear here once it\'s available.' },
  'no-results':    { title: 'No results found',        body: 'Try adjusting your filters or search term.' },
  'first-use':     { title: 'Nothing here yet',        body: 'Get started by creating your first item.' },
  'no-connection': { title: 'Connection error',        body: 'Could not reach the server. Check your connection and try again.' },
  'error':         { title: 'Something went wrong',    body: 'An unexpected error occurred. Try refreshing the page.' },
  'no-access':     { title: 'Access restricted',       body: 'You don\'t have permission to view this content.' },
  'coming-soon':   { title: 'Coming soon',             body: 'This feature is in development and will be available shortly.' },
  'custom':        { title: '',                         body: '' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PPEmptyState({
  variant = 'no-data',
  title,
  body,
  action,
  secondaryAction,
  iconSize = 72,
  compact = false,
}: PPEmptyStateProps) {
  const t = useThemeTokens();
  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedTitle = title ?? defaults.title;
  const resolvedBody  = body  ?? defaults.body;

  const iconColor = t.isDark ? 'rgba(255,255,255,0.25)' : DEEP_BLUE_TINTS[30];

  function renderIcon() {
    switch (variant) {
      case 'no-data':       return <IconNoData size={iconSize} color={iconColor} />;
      case 'no-results':    return <IconNoResults size={iconSize} color={iconColor} />;
      case 'first-use':     return <IconFirstUse size={iconSize} color={iconColor} />;
      case 'no-connection': return <IconNoConnection size={iconSize} color={iconColor} />;
      case 'error':         return <IconError size={iconSize} />;
      case 'no-access':     return <IconNoAccess size={iconSize} color={iconColor} />;
      case 'coming-soon':   return <IconComingSoon size={iconSize} color={iconColor} />;
      default:              return <IconNoData size={iconSize} color={iconColor} />;
    }
  }

  return (
    <Stack
      align="center"
      justify="center"
      gap={compact ? 12 : 16}
      py={compact ? 24 : 48}
      px={compact ? 16 : 32}
      style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}
    >
      {/* Illustration */}
      <Box
        style={{
          width: iconSize + 32,
          height: iconSize + 32,
          borderRadius: '50%',
          background: t.isDark
            ? 'rgba(255,255,255,0.04)'
            : `${AQUA_TINTS[10]}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${t.borderSubtle}`,
        }}
      >
        {renderIcon()}
      </Box>

      {/* Copy */}
      <Stack gap={6} align="center">
        {resolvedTitle && (
          <Text
            fw={700}
            size={compact ? 'sm' : 'md'}
            style={{ color: t.textPrimary, fontFamily: FONT_FAMILY, letterSpacing: '-0.01em' }}
          >
            {resolvedTitle}
          </Text>
        )}
        {resolvedBody && (
          <Text
            size={compact ? 'xs' : 'sm'}
            style={{ color: t.textSecondary, fontFamily: FONT_FAMILY, lineHeight: 1.6, maxWidth: 320 }}
          >
            {resolvedBody}
          </Text>
        )}
      </Stack>

      {/* CTAs */}
      {(action || secondaryAction) && (
        <Group gap={8} justify="center" mt={compact ? 4 : 8}>
          {action}
          {secondaryAction}
        </Group>
      )}
    </Stack>
  );
}

export default PPEmptyState;
