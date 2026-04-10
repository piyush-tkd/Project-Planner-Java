/**
 * PPCard — S2-04 Design System Component
 *
 * Standardized card wrapper with consistent brand shadow, border, radius,
 * and padding. Replaces scattered Paper/Box with magic-number styles.
 *
 * Usage:
 *   <PPCard>…content…</PPCard>
 *   <PPCard accent>…highlighted card…</PPCard>
 *   <PPCard compact noPad>…custom padding…</PPCard>
 *   <PPCard header={<Text fw={700}>Title</Text>} action={<Button>Add</Button>}>…</PPCard>
 */
import React from 'react';
import { Box, Group, Stack, Divider } from '@mantine/core';
import {
  AQUA, CARD_PADDING, CARD_RADIUS, CARD_RADIUS_SM, CARD_RADIUS_LG,
  FONT_FAMILY,
} from '../../brandTokens';
import { useThemeTokens } from '../../hooks/useThemeTokens';

export interface PPCardProps {
  children?: React.ReactNode;
  /** Section header — rendered above content with divider */
  header?: React.ReactNode;
  /** Action slot — rendered top-right beside header */
  action?: React.ReactNode;
  /** Footer slot — rendered below content with divider */
  footer?: React.ReactNode;
  /** Accent left border (3px solid AQUA) */
  accent?: boolean;
  /** Compact: sm radius + tighter padding */
  compact?: boolean;
  /** Large: lg radius + extra padding */
  large?: boolean;
  /** Remove default padding entirely */
  noPad?: boolean;
  /** Make the card clickable with hover effect */
  clickable?: boolean;
  /** onClick handler — auto-enables clickable styling */
  onClick?: () => void;
  /** Stretch to full height of parent */
  fullHeight?: boolean;
  /** Extra className */
  className?: string;
  /** Extra inline style */
  style?: React.CSSProperties;
}

export function PPCard({
  children,
  header,
  action,
  footer,
  accent = false,
  compact = false,
  large = false,
  noPad = false,
  clickable = false,
  onClick,
  fullHeight = false,
  className,
  style,
}: PPCardProps) {
  const t = useThemeTokens();

  const radius = large ? CARD_RADIUS_LG : compact ? CARD_RADIUS_SM : CARD_RADIUS;
  const pad    = noPad ? 0 : large ? CARD_PADDING + 8 : compact ? 16 : CARD_PADDING;

  const isClickable = clickable || Boolean(onClick);

  const baseStyle: React.CSSProperties = {
    background:   t.cardBg,
    border:       `1px solid ${t.cardBorder}`,
    borderRadius: radius,
    boxShadow:    t.cardShadow,
    borderLeft:   accent ? `3px solid ${AQUA}` : undefined,
    height:       fullHeight ? '100%' : undefined,
    cursor:       isClickable ? 'pointer' : undefined,
    fontFamily:   FONT_FAMILY,
    transition:   'box-shadow 180ms ease, border-color 180ms ease',
    overflow:     'hidden',
    ...style,
  };

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (isClickable) {
      (e.currentTarget as HTMLDivElement).style.boxShadow = t.cardShadowHover;
      (e.currentTarget as HTMLDivElement).style.borderColor = t.borderStrong;
    }
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    if (isClickable) {
      (e.currentTarget as HTMLDivElement).style.boxShadow = t.cardShadow;
      (e.currentTarget as HTMLDivElement).style.borderColor = t.cardBorder;
    }
  }

  const hasHeaderRow = header || action;

  return (
    <Box
      className={className}
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Header row ────────────────────────────────────────────── */}
      {hasHeaderRow && (
        <>
          <Group
            justify="space-between"
            align="center"
            px={pad || 24}
            py={compact ? 10 : 14}
          >
            <Box style={{ flex: 1, minWidth: 0, color: t.textPrimary }}>
              {header}
            </Box>
            {action && (
              <Group gap={8} wrap="nowrap">
                {action}
              </Group>
            )}
          </Group>
          <Divider color={t.borderSubtle} />
        </>
      )}

      {/* ── Body ──────────────────────────────────────────────────── */}
      <Stack gap={0} style={{ padding: pad }}>
        {children}
      </Stack>

      {/* ── Footer ────────────────────────────────────────────────── */}
      {footer && (
        <>
          <Divider color={t.borderSubtle} />
          <Box
            px={pad || 24}
            py={compact ? 10 : 14}
            style={{ color: t.textSecondary }}
          >
            {footer}
          </Box>
        </>
      )}
    </Box>
  );
}

export default PPCard;
