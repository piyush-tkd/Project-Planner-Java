/**
 * KeyboardShortcutsModal — comprehensive shortcuts help modal
 * Triggered by ? key or a help button
 * Shows all available shortcuts organized by category
 */
import { Modal, Group, Text, Stack, Grid, Paper, Badge, useComputedColorScheme, Kbd } from '@mantine/core';
import { AQUA } from '../../brandTokens';

interface KeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
    note?: string;
  }>;
}

const SHORTCUTS_DATA: ShortcutGroup[] = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'P'], description: 'Go to Projects' },
      { keys: ['G', 'R'], description: 'Go to Resources' },
      { keys: ['G', 'C'], description: 'Go to Capacity' },
      { keys: ['G', 'O'], description: 'Go to Pods' },
      { keys: ['G', 'J'], description: 'Go to Jira Actuals' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
      { keys: ['G', 'I'], description: 'Go to Ask AI' },
    ],
  },
  {
    category: 'Global Actions',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open Command Palette', note: 'Ctrl+K on Windows' },
      { keys: ['G', 'K'], description: 'Open Command Palette (via G+letter)' },
      { keys: ['?'], description: 'Show Keyboard Shortcuts' },
      { keys: ['⌘', '\\'], description: 'Toggle Sidebar', note: 'Ctrl+\\ on Windows' },
    ],
  },
  {
    category: 'Inline Editing',
    shortcuts: [
      { keys: ['Enter'], description: 'Save edited cell', note: 'When cell is in edit mode' },
      { keys: ['Escape'], description: 'Cancel edit', note: 'When cell is in edit mode' },
      { keys: ['Tab'], description: 'Move to next cell', note: 'When cell is in edit mode' },
    ],
  },
];

export function KeyboardShortcutsModal({ opened, onClose }: KeyboardShortcutsModalProps) {
  const isDark = useComputedColorScheme() === 'dark';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} size="lg">
          Keyboard Shortcuts
        </Text>
      }
      size="lg"
      centered
      styles={{
        header: {
          borderBottom: isDark ? '1px solid rgba(45, 204, 211, 0.1)' : '1px solid rgba(45, 204, 211, 0.2)',
        },
      }}
    >
      <Stack gap="xl">
        {SHORTCUTS_DATA.map(group => (
          <div key={group.category}>
            <Group gap="xs" mb="sm">
              <Badge
                size="sm"
                variant="light"
                style={{ background: isDark ? `${AQUA}20` : `${AQUA}15` }}
              >
                {group.category}
              </Badge>
            </Group>
            <Grid gutter="md">
              {group.shortcuts.map((shortcut, idx) => (
                <Grid.Col key={idx} span={{ base: 12, sm: 6 }}>
                  <Paper
                    p="sm"
                    radius="md"
                    style={{
                      background: isDark ? 'rgba(45, 204, 211, 0.05)' : 'rgba(45, 204, 211, 0.03)',
                      border: isDark
                        ? '1px solid rgba(45, 204, 211, 0.1)'
                        : '1px solid rgba(45, 204, 211, 0.15)',
                    }}
                  >
                    <Group gap="xs" justify="space-between" mb={6}>
                      <Group gap={4}>
                        {shortcut.keys.map((key, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Kbd size="xs">
                              {key}
                            </Kbd>
                            {i < shortcut.keys.length - 1 && (
                              <Text
                                span
                                size="xs"
                                c="dimmed"
                              >
                                +
                              </Text>
                            )}
                          </div>
                        ))}
                      </Group>
                    </Group>
                    <Text size="sm" fw={500} mb={4}>
                      {shortcut.description}
                    </Text>
                    {shortcut.note && (
                      <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                        {shortcut.note}
                      </Text>
                    )}
                  </Paper>
                </Grid.Col>
              ))}
            </Grid>
          </div>
        ))}
      </Stack>
    </Modal>
  );
}

export default KeyboardShortcutsModal;
