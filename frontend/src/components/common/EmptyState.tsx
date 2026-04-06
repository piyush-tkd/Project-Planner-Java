/**
 * EmptyState — Sprint 7 S7.7
 *
 * Enhanced empty state with:
 *   - Multiple CTAs (primary + secondary action)
 *   - Contextual tips
 *   - Link support
 *   - Size variants (sm / md / lg)
 *   - Animated icon container
 */
import { ReactNode } from 'react';
import { Box, ThemeIcon, Text, Button, Stack, Group, Anchor, List, ThemeIcon as TI } from '@mantine/core';
import { IconMoodEmpty, IconInfoCircle, IconExternalLink } from '@tabler/icons-react';
import { AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface EmptyAction {
  label: string;
  onClick: () => void;
  variant?: 'filled' | 'light' | 'outline' | 'subtle';
  color?: string;
  icon?: ReactNode;
  href?: string;           // if set, renders as external link
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary CTA button */
  action?: EmptyAction;
  /** Secondary CTA (shown as outline/light beside primary) */
  secondaryAction?: EmptyAction;
  /** Tips shown below the actions */
  tips?: string[];
  /** Overall size of the empty state block */
  size?: 'sm' | 'md' | 'lg';
  /** Colour accent for the icon ThemeIcon */
  color?: string;
}

const SIZE_MAP = {
  sm: { iconSize: 36, iconBox: 52, py: 'md' as const, titleSize: 'xs' as const, descSize: 'xs' as const },
  md: { iconSize: 40, iconBox: 64, py: 'xl' as const, titleSize: 'sm' as const, descSize: 'xs' as const },
  lg: { iconSize: 52, iconBox: 80, py: 40,            titleSize: 'md' as const, descSize: 'sm' as const },
};

export default function EmptyState({
  icon = <IconMoodEmpty size={40} />,
  title,
  description,
  action,
  secondaryAction,
  tips,
  size = 'md',
  color = 'gray',
}: EmptyStateProps) {
  const isDark = useDarkMode();
  const s = SIZE_MAP[size];

  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)';
  const bgColor     = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(249,250,251,0.8)';

  function renderAction(act: EmptyAction, primary = true) {
    const btn = (
      <Button
        size="sm"
        variant={act.variant ?? (primary ? 'filled' : 'light')}
        color={act.color ?? (primary ? 'teal' : 'gray')}
        leftSection={act.icon}
        onClick={act.onClick}
        style={{ fontFamily: FONT_FAMILY }}
      >
        {act.label}
      </Button>
    );
    if (act.href) {
      return (
        <Anchor href={act.href} target="_blank" style={{ textDecoration: 'none' }}>
          {btn}
        </Anchor>
      );
    }
    return btn;
  }

  return (
    <Box
      py={s.py}
      px="xl"
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 12,
        textAlign: 'center',
        fontFamily: FONT_FAMILY,
        background: bgColor,
      }}
    >
      <Stack align="center" gap="md">
        {/* Icon with animated subtle pulse */}
        <ThemeIcon
          size={s.iconBox}
          variant="light"
          color={color}
          radius="xl"
          style={{
            animation: 'pp-empty-pulse 2.5s ease-in-out infinite',
          }}
        >
          {icon}
        </ThemeIcon>

        {/* Title */}
        <Text
          size={s.titleSize}
          fw={600}
          c="dimmed"
          style={{ fontFamily: FONT_FAMILY, maxWidth: 360 }}
        >
          {title}
        </Text>

        {/* Description */}
        {description && (
          <Text
            size={s.descSize}
            c="dimmed"
            style={{ fontFamily: FONT_FAMILY, maxWidth: 420, lineHeight: 1.6 }}
          >
            {description}
          </Text>
        )}

        {/* Actions */}
        {(action || secondaryAction) && (
          <Group gap="sm" justify="center" mt={4}>
            {action && renderAction(action, true)}
            {secondaryAction && renderAction(secondaryAction, false)}
          </Group>
        )}

        {/* Tips */}
        {tips && tips.length > 0 && (
          <Box
            mt={4}
            p="sm"
            style={{
              background: isDark ? 'rgba(45,204,211,0.06)' : 'rgba(45,204,211,0.05)',
              border: `1px solid ${isDark ? 'rgba(45,204,211,0.2)' : 'rgba(45,204,211,0.25)'}`,
              borderRadius: 8,
              textAlign: 'left',
              maxWidth: 420,
              width: '100%',
            }}
          >
            <Group gap="xs" mb={6}>
              <IconInfoCircle size={13} color="var(--mantine-color-teal-5)" />
              <Text size="xs" fw={600} c="teal" style={{ fontFamily: FONT_FAMILY }}>Tips</Text>
            </Group>
            <List
              size="xs"
              spacing={4}
              style={{ fontFamily: FONT_FAMILY }}
              icon={<span style={{ color: 'var(--mantine-color-teal-5)', fontSize: 10 }}>▸</span>}
            >
              {tips.map((tip, i) => (
                <List.Item key={i} style={{ color: 'var(--mantine-color-dimmed)', fontSize: 11 }}>
                  {tip}
                </List.Item>
              ))}
            </List>
          </Box>
        )}
      </Stack>

      {/* Inject pulse animation once */}
      <style>{`
        @keyframes pp-empty-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.85; }
        }
      `}</style>
    </Box>
  );
}
