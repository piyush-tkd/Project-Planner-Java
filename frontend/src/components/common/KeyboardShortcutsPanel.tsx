/**
 * KeyboardShortcutsPanel — Modal showing all keyboard shortcuts
 *
 * Opens when user presses "?" key (but not when typing in an input/textarea/select).
 * Handles G-then-X navigation shortcuts with 500ms timeout.
 * Sprint 7: expanded to 30+ shortcuts, grouped by category.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Group, Stack, Text, Kbd, Box, SimpleGrid, Divider, Badge } from '@mantine/core';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  label: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'General',
    shortcuts: [
      { keys: ['⌘K'],  description: 'Open command palette / search' },
      { keys: ['⌘J'],  description: 'Ask AI assistant' },
      { keys: ['⌘\\'], description: 'Toggle sidebar' },
      { keys: ['?'],   description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / cancel' },
    ],
  },
  {
    label: 'Navigation — G then…',
    shortcuts: [
      { keys: ['G', 'D'],  description: 'Dashboard' },
      { keys: ['G', 'P'],  description: 'Projects' },
      { keys: ['G', 'R'],  description: 'Resources' },
      { keys: ['G', 'O'],  description: 'PODs' },
      { keys: ['G', 'A'],  description: 'Ask AI' },
      { keys: ['G', 'I'],  description: 'Inbox' },
      { keys: ['G', 'C'],  description: 'Calendar' },
      { keys: ['G', 'L'],  description: 'Leave & Holidays' },
      { keys: ['G', 'E'],  description: 'Engineering Intelligence' },
      { keys: ['G', 'S'],  description: 'Admin Settings' },
      { keys: ['G', 'N'],  description: 'Smart Notifications' },
      { keys: ['G', 'T'],  description: 'Portfolio Timeline' },
    ],
  },
  {
    label: 'Portfolio & Projects',
    shortcuts: [
      { keys: ['G', 'K'],  description: 'Risk & Issues' },
      { keys: ['G', 'B'],  description: 'Ideas Board' },
      { keys: ['G', 'J'],  description: 'Objectives (OKRs)' },
      { keys: ['G', 'H'],  description: 'Portfolio Health' },
      { keys: ['G', 'G'],  description: 'Gantt & Dependencies' },
    ],
  },
  {
    label: 'Delivery & Integrations',
    shortcuts: [
      { keys: ['G', 'Z'],  description: 'POD Dashboard' },
      { keys: ['G', 'X'],  description: 'Releases' },
      { keys: ['G', 'W'],  description: 'Worklog' },
      { keys: ['G', 'U'],  description: 'Support Queue' },
    ],
  },
  {
    label: 'Reports & Analysis',
    shortcuts: [
      { keys: ['G', 'Q'],  description: 'DORA Metrics' },
      { keys: ['G', 'F'],  description: 'Capacity Hub' },
      { keys: ['G', 'V'],  description: 'Project Health' },
      { keys: ['G', 'Y'],  description: 'Delivery Predictability' },
      { keys: ['G', 'M'],  description: 'Dependency Map' },
    ],
  },
];

// Flat route map for all G-then-X shortcuts
const G_ROUTE_MAP: Record<string, string> = {
  d: '/',
  p: '/projects',
  r: '/resources',
  o: '/pods',
  a: '/nlp',
  i: '/inbox',
  c: '/calendar',
  l: '/leave',
  e: '/reports/engineering-intelligence',
  s: '/settings/org',
  n: '/reports/smart-notifications',
  t: '/reports/portfolio-timeline',
  k: '/risk-register',
  b: '/ideas',
  j: '/objectives',
  h: '/reports/portfolio-health-dashboard',
  g: '/reports/gantt-dependencies',
  z: '/jira-pods',
  x: '/jira-releases',
  w: '/jira-worklog',
  u: '/jira-support',
  q: '/reports/dora',
  f: '/capacity',
  v: '/reports/project-health',
  y: '/reports/delivery-predictability',
  m: '/reports/dependency-map',
};

export function useShortcutsPanel() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const pendingGRef = { value: false, timeoutId: null as ReturnType<typeof setTimeout> | null };

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      // ⌘J — Ask AI (fires even when typing, like ⌘K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('navigate-shortcut', { detail: { path: '/nlp' } }));
        return;
      }

      // ⌘\ — Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('pp-toggle-sidebar'));
        return;
      }

      if (isTyping) return;

      // "?" or ⌘. toggles shortcuts panel (DL-10)
      const isDotShortcut = e.key === '.' && (e.metaKey || e.ctrlKey);
      if ((e.key === '?' && !e.metaKey && !e.ctrlKey) || isDotShortcut) {
        e.preventDefault();
        setOpened(o => !o);
        return;
      }

      // G-then-X two-key navigation
      if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (pendingGRef.timeoutId) clearTimeout(pendingGRef.timeoutId);
        pendingGRef.value = true;
        pendingGRef.timeoutId = setTimeout(() => { pendingGRef.value = false; }, 500);
        return;
      }

      if (pendingGRef.value) {
        const second = e.key.toLowerCase();
        if (pendingGRef.timeoutId) clearTimeout(pendingGRef.timeoutId);
        pendingGRef.value = false;
        if (second in G_ROUTE_MAP) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('navigate-shortcut', { detail: { path: G_ROUTE_MAP[second] } }));
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (pendingGRef.timeoutId) clearTimeout(pendingGRef.timeoutId);
    };
  }, []);

  return { opened, setOpened };
}

function KeyRow({ shortcut, dark }: { shortcut: Shortcut; dark: boolean }) {
  return (
    <Group justify="space-between" wrap="nowrap" py={4}>
      <Group gap={4} wrap="nowrap">
        {shortcut.keys.map((k, i) => (
          <Group key={i} gap={4} wrap="nowrap">
            {i > 0 && <Text size="xs" c="dimmed">then</Text>}
            <Kbd
              size="sm"
              style={{
                background: dark ? 'rgba(45,204,211,0.15)' : AQUA,
                color: dark ? AQUA : '#fff',
                border: `1px solid ${dark ? 'rgba(45,204,211,0.3)' : AQUA}`,
                borderRadius: 4,
                padding: '3px 7px',
                fontSize: 12,
                fontWeight: 600,
                minWidth: 28,
                textAlign: 'center',
              }}
            >
              {k}
            </Kbd>
          </Group>
        ))}
      </Group>
      <Text size="xs" c="dimmed" style={{ textAlign: 'right', flex: 1, marginLeft: 12 }}>
        {shortcut.description}
      </Text>
    </Group>
  );
}

export default function KeyboardShortcutsPanel({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const dark = useDarkMode();

  useEffect(() => {
    function handleNavigate(e: Event) {
      const customEvent = e as CustomEvent<{ path: string }>;
      navigate(customEvent.detail.path);
      onClose();
    }
    window.addEventListener('navigate-shortcut', handleNavigate);
    return () => window.removeEventListener('navigate-shortcut', handleNavigate);
  }, [navigate, onClose]);

  // Separate navigation groups (the big ones) from general groups
  const generalGroups = SHORTCUT_GROUPS.filter(g => !g.label.startsWith('Navigation') && !['Portfolio & Projects', 'Delivery & Integrations', 'Reports & Analysis'].includes(g.label));
  const navGroups = SHORTCUT_GROUPS.filter(g => g.label.startsWith('Navigation') || ['Portfolio & Projects', 'Delivery & Integrations', 'Reports & Analysis'].includes(g.label));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} size="lg" style={{ color: dark ? '#fff' : DEEP_BLUE }}>
            Keyboard Shortcuts
          </Text>
          <Badge size="sm" variant="light" color="teal">{
            SHORTCUT_GROUPS.reduce((sum, g) => sum + g.shortcuts.length, 0)
          } shortcuts</Badge>
        </Group>
      }
      centered
      size="xl"
      styles={{
        content: { fontFamily: FONT_FAMILY },
      }}
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {/* Left column: General shortcuts */}
        <Stack gap="md">
          {generalGroups.map(group => (
            <Box key={group.label}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                {group.label}
              </Text>
              <Stack gap={0}>
                {group.shortcuts.map((s, i) => <KeyRow key={i} shortcut={s} dark={dark} />)}
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Right column: Navigation shortcuts */}
        <Stack gap="md">
          {navGroups.map((group, gi) => (
            <Box key={group.label}>
              {gi > 0 && <Divider mb="md" />}
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs"
                style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY }}>
                {group.label}
              </Text>
              <SimpleGrid cols={2} spacing={0}>
                {group.shortcuts.map((s, i) => <KeyRow key={i} shortcut={s} dark={dark} />)}
              </SimpleGrid>
            </Box>
          ))}
        </Stack>
      </SimpleGrid>

      <Divider mt="lg" mb="sm" />
      <Text size="xs" c="dimmed" ta="center" style={{ fontFamily: FONT_FAMILY }}>
        Press <Kbd size="xs">?</Kbd> to toggle this panel · <Kbd size="xs">⌘K</Kbd> to search · <Kbd size="xs">Esc</Kbd> to close
      </Text>
    </Modal>
  );
}
