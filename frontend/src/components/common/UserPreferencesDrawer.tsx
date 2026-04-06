/**
 * UserPreferencesDrawer — Sprint 7 S7.8
 *
 * Slide-in drawer for user-scoped display preferences:
 *   - Compact mode toggle (applies body class)
 *   - Default projects view (table / board / gantt)
 *   - Color scheme toggle
 *   - Table page size
 *
 * All preferences persist in localStorage under 'pp_user_prefs'.
 */
import { useState } from 'react';
import {
  Drawer, Stack, Group, Text, Switch, SegmentedControl,
  Divider, Badge, Select, Box,
} from '@mantine/core';
import {
  IconLayoutList, IconLayoutKanban, IconTimeline,
  IconSettings2, IconSun, IconMoon,
} from '@tabler/icons-react';
import { useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

// ── Preferences schema ────────────────────────────────────────────────────────
export interface UserPrefs {
  compactMode:         boolean;
  defaultProjectsView: 'table' | 'board' | 'gantt';
  animationsReduced:   boolean;
  tablePageSize:       number;
}

const PREFS_KEY = 'pp_user_prefs';

export const DEFAULT_PREFS: UserPrefs = {
  compactMode: false,
  defaultProjectsView: 'table',
  animationsReduced: false,
  tablePageSize: 25,
};

export function loadUserPrefs(): UserPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch { return DEFAULT_PREFS; }
}

export function saveUserPrefs(prefs: UserPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent('pp-prefs-changed', { detail: prefs }));
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const isDark = useDarkMode();
  return (
    <Box>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs"
        style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, fontSize: 10 }}>
        {title}
      </Text>
      <Box
        p="sm"
        style={{
          border: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)'}`,
          borderRadius: 8,
          background: isDark ? 'var(--mantine-color-dark-7)' : '#fff',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

// ── Pref row ─────────────────────────────────────────────────────────────────
function PrefRow({
  label,
  description,
  children,
}: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" py={6}>
      <div>
        <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
        {description && (
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{description}</Text>
        )}
      </div>
      {children}
    </Group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface UserPreferencesDrawerProps {
  opened: boolean;
  onClose: () => void;
}

export default function UserPreferencesDrawer({ opened, onClose }: UserPreferencesDrawerProps) {
  const isDark = useDarkMode();
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme('light');
  const [prefs, setPrefs] = useState<UserPrefs>(loadUserPrefs);

  function update<K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveUserPrefs(next);
    if (key === 'compactMode') {
      document.body.classList.toggle('pp-compact', !!value);
    }
    if (key === 'animationsReduced') {
      document.body.classList.toggle('pp-reduce-motion', !!value);
    }
  }

  function resetAll() {
    setPrefs(DEFAULT_PREFS);
    saveUserPrefs(DEFAULT_PREFS);
    setColorScheme('light');
    document.body.classList.remove('pp-compact', 'pp-reduce-motion');
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="sm"
      title={
        <Group gap="xs">
          <IconSettings2 size={18} color={isDark ? AQUA : DEEP_BLUE} />
          <Text fw={700} size="md" style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            Display Preferences
          </Text>
          <Badge size="xs" variant="light" color="teal">Sprint 7</Badge>
        </Group>
      }
      styles={{
        header: {
          borderBottom: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)'}`,
        },
      }}
    >
      <Stack gap="md" pt="sm">
        {/* ── Appearance ── */}
        <Section title="Appearance">
          <Stack gap={0}>
            <PrefRow label="Color scheme" description="Light or dark interface">
              <SegmentedControl
                size="xs"
                value={computedScheme}
                onChange={v => setColorScheme(v as 'light' | 'dark')}
                data={[
                  { value: 'light', label: <Group gap={4}><IconSun size={12} />Light</Group> },
                  { value: 'dark',  label: <Group gap={4}><IconMoon size={12} />Dark</Group> },
                ]}
              />
            </PrefRow>

            <Divider />

            <PrefRow label="Compact mode" description="Reduce padding and font sizes">
              <Switch
                size="sm"
                color="teal"
                checked={prefs.compactMode}
                onChange={e => update('compactMode', e.currentTarget.checked)}
              />
            </PrefRow>

            <Divider />

            <PrefRow label="Reduce animations" description="Disable transitions and animations">
              <Switch
                size="sm"
                color="teal"
                checked={prefs.animationsReduced}
                onChange={e => update('animationsReduced', e.currentTarget.checked)}
              />
            </PrefRow>
          </Stack>
        </Section>

        {/* ── Projects ── */}
        <Section title="Projects Page">
          <Stack gap={0}>
            <PrefRow label="Default view" description="Which view when opening Projects">
              <SegmentedControl
                size="xs"
                value={prefs.defaultProjectsView}
                onChange={v => update('defaultProjectsView', v as UserPrefs['defaultProjectsView'])}
                data={[
                  { value: 'table', label: <Group gap={4}><IconLayoutList size={12} />Table</Group> },
                  { value: 'board', label: <Group gap={4}><IconLayoutKanban size={12} />Board</Group> },
                  { value: 'gantt', label: <Group gap={4}><IconTimeline size={12} />Gantt</Group> },
                ]}
              />
            </PrefRow>

            <Divider />

            <PrefRow label="Rows per page" description="Default table page size">
              <Select
                size="xs"
                value={String(prefs.tablePageSize)}
                onChange={v => update('tablePageSize', Number(v ?? 25))}
                data={['10', '25', '50', '100'].map(v => ({ value: v, label: v }))}
                w={80}
              />
            </PrefRow>
          </Stack>
        </Section>

        {/* ── Reset ── */}
        <Text
          size="xs"
          c="dimmed"
          ta="center"
          style={{ fontFamily: FONT_FAMILY, cursor: 'pointer', textDecoration: 'underline' }}
          onClick={resetAll}
        >
          Reset to defaults
        </Text>

        <Text size="xs" c="dimmed" ta="center" style={{ fontFamily: FONT_FAMILY }}>
          Preferences are saved locally in your browser.
        </Text>
      </Stack>
    </Drawer>
  );
}
