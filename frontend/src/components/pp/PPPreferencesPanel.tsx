/**
 * PPPreferencesPanel — DL-15
 *
 * Slide-in preferences drawer. Rendered inside a Mantine Drawer.
 * Controls the full UserPreferences schema via useUserPreferences.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <PPPreferencesPanel opened={open} onClose={() => setOpen(false)} />
 */
import React from 'react';
import {
  Drawer, Stack, Text, SegmentedControl, Switch, Select,
  Group, Divider, Button, Badge, useMantineColorScheme,
} from '@mantine/core';
import {
  IconSun, IconMoon, IconDeviceLaptop,
  IconLayoutRows, IconAdjustments, IconRefresh,
} from '@tabler/icons-react';
import {
  useUserPreferences,
  type ColorScheme,
  type TableDensity,
  type SidebarWidth,
} from '../../hooks/useUserPreferences';
import { useToast } from '../../hooks/useToast';
import { AQUA, DARK_ELEMENT, DARK_SIDEBAR, DARK_SURFACE_ALT, SIDEBAR_INACTIVE} from '../../brandTokens';

export interface PPPreferencesPanelProps {
  opened: boolean;
  onClose: () => void;
}

// ── Section label helper ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      size="11px"
      fw={700}
      tt="uppercase"
      style={{
        letterSpacing: '0.06em',
        color: '#5a5e70',
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function PPPreferencesPanel({ opened, onClose }: PPPreferencesPanelProps) {
  const {
    prefs,
    setColorScheme,
    setTableDensity,
    setAnimations,
    setSidebarWidth,
    setShowSparklines,
    setSidebarCompact,
    reset,
  } = useUserPreferences();
  const { colorScheme: mantineScheme, setColorScheme: setMantineScheme } = useMantineColorScheme();
  const toast = useToast();

  // Derive the panel's active segment from Mantine's actual stored value
  // ('auto' in Mantine = 'system' in our panel)
  const activeScheme: ColorScheme = mantineScheme === 'auto' ? 'system'
    : mantineScheme === 'light' ? 'light'
    : 'dark';

  const handleColorSchemeChange = (v: string) => {
    const scheme = v as ColorScheme;
    setColorScheme(scheme);                                    // persists to pp_prefs_v1
    setMantineScheme(scheme === 'system' ? 'auto' : scheme);  // persists to mantine-color-scheme + updates UI
  };

  const handleReset = () => {
    reset();
    toast.info('Preferences reset', 'All settings restored to defaults');
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconAdjustments size={18} color={AQUA} />
          <Text fw={600} size="sm" c="#e2e4eb">Preferences</Text>
          <Badge size="xs" color="teal" variant="light">v1</Badge>
        </Group>
      }
      position="right"
      size={360}
      zIndex={300}
      lockScroll={false}
      styles={{
        root:    {},
        content: { background: DARK_SIDEBAR, borderLeft: '1px solid #2e3346' },
        header:  { background: DARK_SIDEBAR, borderBottom: '1px solid #2e3346' },
        title:   { color: '#e2e4eb' },
        close:   { color: SIDEBAR_INACTIVE },
        body:    { paddingTop: 16 },
      }}
    >
      <Stack gap="lg">

        {/* ── Appearance ── */}
        <div>
          <SectionLabel>Appearance</SectionLabel>
          <Text size="xs" c={SIDEBAR_INACTIVE} mb={8}>Color scheme</Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={activeScheme}
            onChange={handleColorSchemeChange}
            data={[
              { value: 'dark',   label: (
                <Group gap={4} justify="center">
                  <IconMoon size={13} />
                  <span>Dark</span>
                </Group>
              )},
              { value: 'system', label: (
                <Group gap={4} justify="center">
                  <IconDeviceLaptop size={13} />
                  <span>System</span>
                </Group>
              )},
              { value: 'light',  label: (
                <Group gap={4} justify="center">
                  <IconSun size={13} />
                  <span>Light</span>
                </Group>
              )},
            ]}
            styles={{
              root:     { background: DARK_SURFACE_ALT },
              indicator:{ background: AQUA, borderRadius: 6 },
              label:    { color: SIDEBAR_INACTIVE, fontSize: 12 },
              control:  {},
            }}
          />
        </div>

        <Divider color={DARK_ELEMENT} />

        {/* ── Tables ── */}
        <div>
          <SectionLabel>Tables</SectionLabel>
          <Text size="xs" c={SIDEBAR_INACTIVE} mb={8}>Row density</Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={prefs.tableDensity}
            onChange={v => setTableDensity(v as TableDensity)}
            data={[
              { value: 'compact',     label: (
                <Group gap={4} justify="center">
                  <IconLayoutRows size={13} />
                  <span>Compact</span>
                </Group>
              )},
              { value: 'comfortable', label: 'Default' },
              { value: 'spacious',    label: 'Spacious' },
            ]}
            styles={{
              root:     { background: DARK_SURFACE_ALT },
              indicator:{ background: AQUA, borderRadius: 6 },
              label:    { color: SIDEBAR_INACTIVE, fontSize: 12 },
              control:  {},
            }}
          />
        </div>

        <Divider color={DARK_ELEMENT} />

        {/* ── Sidebar ── */}
        <div>
          <SectionLabel>Sidebar</SectionLabel>
          <Select
            label="Width"
            size="xs"
            value={prefs.sidebarWidth}
            onChange={v => v && setSidebarWidth(v as SidebarWidth)}
            data={[
              { value: 'narrow',  label: 'Narrow (200px)' },
              { value: 'default', label: 'Default (240px)' },
              { value: 'wide',    label: 'Wide (280px)'   },
            ]}
            styles={{
              input:    { background: DARK_SURFACE_ALT, borderColor: DARK_ELEMENT, color: '#e2e4eb' },
              dropdown: { background: DARK_SIDEBAR, borderColor: DARK_ELEMENT },
              label:    { color: SIDEBAR_INACTIVE, marginBottom: 6 },
              option:   { color: '#e2e4eb' },
            }}
            mb={12}
          />
          <Switch
            label="Compact mode (icon-only)"
            size="xs"
            checked={prefs.sidebarCompact}
            onChange={e => setSidebarCompact(e.currentTarget.checked)}
            styles={{
              label: { color: '#b0b3c1', fontSize: 13 },
              track: { backgroundColor: prefs.sidebarCompact ? AQUA : DARK_ELEMENT },
            }}
          />
        </div>

        <Divider color={DARK_ELEMENT} />

        {/* ── Animations & display ── */}
        <div>
          <SectionLabel>Display</SectionLabel>
          <Stack gap="sm">
            <Switch
              label="Page entrance animations"
              size="xs"
              checked={prefs.animations}
              onChange={e => setAnimations(e.currentTarget.checked)}
              styles={{
                label: { color: '#b0b3c1', fontSize: 13 },
                track: { backgroundColor: prefs.animations ? AQUA : DARK_ELEMENT },
              }}
            />
            <Switch
              label="Show sparklines in metric cards"
              size="xs"
              checked={prefs.showSparklines}
              onChange={e => setShowSparklines(e.currentTarget.checked)}
              styles={{
                label: { color: '#b0b3c1', fontSize: 13 },
                track: { backgroundColor: prefs.showSparklines ? AQUA : DARK_ELEMENT },
              }}
            />
          </Stack>
        </div>

        <Divider color={DARK_ELEMENT} />

        {/* ── Reset ── */}
        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<IconRefresh size={13} />}
            onClick={handleReset}
          >
            Reset to defaults
          </Button>
        </Group>

      </Stack>
    </Drawer>
  );
}

export default PPPreferencesPanel;
