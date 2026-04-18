import {
  Paper, Group, Badge, Text, Box, ThemeIcon, Anchor,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconExternalLink, IconNotes,   } from '@tabler/icons-react';
import { AQUA, DEEP_BLUE, DEEP_BLUE_TINTS, BORDER_DEFAULT, FONT_FAMILY } from '../../../brandTokens';
import {
  ROLE_BADGE_COLORS,
  WITTY_EMPTY_STATES,
} from '../constants';
import { str } from '../utils';

// ── Info Tile ──
export function InfoTile({
  icon, label, value, accent, highlight,
}: {
  icon: React.ReactNode; label: string; value: string; accent: string; highlight?: boolean;
}) {
  return (
    <Paper
      p="xs"
      radius="md"
      withBorder
      className="nlp-info-tile"
      style={{
        borderLeft: `3px solid var(--mantine-color-${accent}-5)`,
        backgroundColor: highlight ? `var(--mantine-color-${accent}-0)` : undefined,
      }}
    >
      <Group gap={8} wrap="nowrap">
        <ThemeIcon size={26} variant="light" color={accent} radius="md">
          {icon}
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" lh={1.2} tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>{label}</Text>
          <Text size="sm" fw={600} lh={1.3} truncate style={{ fontFamily: FONT_FAMILY }}>
            {value}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

// ── Drill-down button ──
export function DrillDownButton({
  route, onNavigate, label,
}: {
  route: string | null | undefined; onNavigate: (route: string) => void; label: string;
}) {
  if (!route) return null;
  return (
    <Anchor
      size="sm"
      fw={500}
      onClick={() => onNavigate(route)}
      style={{ cursor: 'pointer', color: AQUA, fontFamily: FONT_FAMILY, display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {label} <IconExternalLink size={14} />
    </Anchor>
  );
}

// ── Section label ──
export function SectionLabel({ text }: { text: string }) {
  return (
    <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={4} style={{ letterSpacing: '0.06em' }}>{text}</Text>
  );
}

// ── Count header ──
export function CountHeader({ title, count, unit, color }: { title: string; count: unknown; unit: string; color?: string }) {
  return (
    <Group gap="xs">
      <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{title}</Text>
      <Badge className="nlp-count-animate" variant="filled" size="sm" radius="sm" style={{ backgroundColor: color === 'orange' ? 'var(--mantine-color-orange-6)' : AQUA }}>
        {str(count)} {unit}(s)
      </Badge>
    </Group>
  );
}

// ── Role badge ──
export function RoleBadge({ role, value }: { role: string; value: string }) {
  return (
    <Badge variant="light" size="xs" radius="sm" color={ROLE_BADGE_COLORS[role] ?? 'gray'} style={{ fontFamily: FONT_FAMILY }}>
      {role}: {value}h
    </Badge>
  );
}

// ── Badge list section ──
export function BadgeListSection({ label, items, color }: { label: string; items: string; color: string }) {
  if (!items || items === '–') return null;
  const names = items.split(', ').filter(Boolean);
  if (names.length === 0) return null;
  return (
    <Box>
      <SectionLabel text={label} />
      <Group gap={6}>
        {names.map((name) => (
          <Badge key={name} variant="light" color={color} size="sm" radius="sm" style={{ textTransform: 'none' }}>
            {name}
          </Badge>
        ))}
      </Group>
    </Box>
  );
}

// ── Summary row ──
export function SummaryRow({ data, excludeKeys }: { data: Record<string, unknown>; excludeKeys: string[] }) {
  const colorScheme = useComputedColorScheme('light');
  const dark = colorScheme === 'dark';
  const keyColor = dark ? '#9ca3af' : DEEP_BLUE_TINTS[60];
  const valColor = dark ? '#e9ecef' : DEEP_BLUE;
  const altRowBg = dark ? 'rgba(255,255,255,0.025)' : 'rgba(12,35,64,0.018)';

  const entries = Object.entries(data)
    .filter(([k]) => !k.startsWith('_') && !k.startsWith('#') && !excludeKeys.includes(k))
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
  if (entries.length === 0) return null;
  return (
    <Paper p={0} radius="md" withBorder style={{ overflow: 'hidden' }}>
      {entries.map(([key, val], idx) => (
        <Group
          key={key}
          gap="sm"
          justify="space-between"
          wrap="nowrap"
          px="sm"
          py={8}
          style={{
            borderBottom: idx < entries.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.08)' : BORDER_DEFAULT}` : undefined,
            background: idx % 2 === 1 ? altRowBg : undefined,
            alignItems: 'flex-start',
          }}
        >
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            style={{ fontFamily: FONT_FAMILY, color: keyColor, letterSpacing: '0.04em', flexShrink: 0, paddingTop: 1 }}
          >
            {key}
          </Text>
          <Text
            size="sm"
            fw={500}
            ta="right"
            style={{ fontFamily: FONT_FAMILY, color: valColor, maxWidth: '65%', wordBreak: 'break-word' }}
          >
            {String(val)}
          </Text>
        </Group>
      ))}
    </Paper>
  );
}

// ── Witty Empty State ──
export function WittyEmptyState({ message, searchTerm }: { message?: string | null; searchTerm?: string }) {
  const idx = (searchTerm ?? message ?? '').length % WITTY_EMPTY_STATES.length;
  const wit = WITTY_EMPTY_STATES[idx];

  const entity = searchTerm
    ?? message?.match(/(?:named|called|about|for)\s+"?([A-Z][a-zA-Z\s]+)"?/)?.[1]?.trim()
    ?? null;

  const personalTitle = entity
    ? `No "${entity}" found anywhere.`
    : wit.title;

  return (
    <Paper p="lg" radius="md" withBorder style={{
      textAlign: 'center',
      borderStyle: 'dashed',
      borderColor: 'var(--mantine-color-gray-4)',
      background: 'linear-gradient(135deg, rgba(45,204,211,0.02) 0%, rgba(12,35,64,0.02) 100%)',
    }}>
      <Text size="xl" style={{ margin: '0 auto 4px', lineHeight: 1 }}>{wit.emoji}</Text>
      <Text size="sm" fw={700} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
        {personalTitle}
      </Text>
      <Text size="xs" c="dimmed" mt={2} style={{ fontStyle: 'italic' }}>
        {wit.sub}
      </Text>
      <Text size="xs" c="dimmed" mt={8} style={{ fontFamily: FONT_FAMILY }}>
        Try a different spelling, or explore using the suggestions below.
      </Text>
    </Paper>
  );
}

// ── Notes box ──
export function NotesBox({ text }: { text: string }) {
  return (
    <Paper p="xs" radius="md" withBorder style={{ borderLeft: `3px solid var(--mantine-color-gray-5)` }}>
      <Group gap={6} wrap="nowrap" align="flex-start">
        <ThemeIcon size={24} variant="light" color="gray" radius="sm"><IconNotes size={16} /></ThemeIcon>
        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Notes</Text>
          <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{text}</Text>
        </div>
      </Group>
    </Paper>
  );
}
