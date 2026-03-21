/**
 * KeyboardShortcutsPanel — Modal showing all keyboard shortcuts
 *
 * Opens when user presses "?" key (but not when typing in an input/textarea/select).
 * Also handles G-then-X navigation shortcuts with 500ms timeout.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Group, Stack, Text, Kbd, SimpleGrid, Box } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';

interface Shortcut {
  keys: string;
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: '⌘K', description: 'Search' },
  { keys: '?', description: 'Keyboard shortcuts' },
  { keys: 'G then D', description: 'Go to Dashboard' },
  { keys: 'G then P', description: 'Go to Projects' },
  { keys: 'G then R', description: 'Go to Resources' },
  { keys: 'G then O', description: 'Go to PODs' },
  { keys: 'G then A', description: 'Go to Ask AI' },
];

export function useShortcutsPanel() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const pendingGRef = { value: false, timeoutId: null as NodeJS.Timeout | null };

    function handler(e: KeyboardEvent) {
      // Check if user is typing in an input, textarea, or select
      const target = e.target as HTMLElement;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (isTyping) return;

      // Handle "?" to open shortcuts panel
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setOpened(o => !o);
      }

      // Handle "G" key to start g-pending state
      if (e.key.toLowerCase() === 'g' && !isTyping) {
        e.preventDefault();

        // Clear any existing timeout
        if (pendingGRef.timeoutId) {
          clearTimeout(pendingGRef.timeoutId);
        }

        pendingGRef.value = true;

        // Reset g-pending after 500ms
        pendingGRef.timeoutId = setTimeout(() => {
          pendingGRef.value = false;
        }, 500);
      }

      // Handle second key in G-then-X sequence
      if (pendingGRef.value && !isTyping) {
        const secondKey = e.key.toLowerCase();

        // Clear timeout since we're handling the second key
        if (pendingGRef.timeoutId) {
          clearTimeout(pendingGRef.timeoutId);
        }
        pendingGRef.value = false;

        // Map second key to navigation
        const routeMap: Record<string, string> = {
          d: '/',
          p: '/projects',
          r: '/resources',
          o: '/pods',
          a: '/nlp',
        };

        if (secondKey in routeMap) {
          e.preventDefault();
          // Navigation will happen in the Modal component
          // For now, we'll dispatch a custom event
          window.dispatchEvent(
            new CustomEvent('navigate-shortcut', { detail: { path: routeMap[secondKey] } })
          );
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (pendingGRef.timeoutId) {
        clearTimeout(pendingGRef.timeoutId);
      }
    };
  }, []);

  return { opened, setOpened };
}

export default function KeyboardShortcutsPanel({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleNavigate(e: Event) {
      const customEvent = e as CustomEvent<{ path: string }>;
      navigate(customEvent.detail.path);
      onClose();
    }

    window.addEventListener('navigate-shortcut', handleNavigate);
    return () => window.removeEventListener('navigate-shortcut', handleNavigate);
  }, [navigate, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Keyboard Shortcuts"
      centered
      size="md"
      styles={{
        title: {
          fontFamily: FONT_FAMILY,
          fontWeight: 700,
          fontSize: 18,
          color: DEEP_BLUE,
        },
      }}
    >
      <Stack gap="md">
        <SimpleGrid cols={1} spacing="md">
          {SHORTCUTS.map((shortcut, idx) => (
            <Group key={idx} justify="space-between" align="center">
              <Box>
                {shortcut.keys.includes('then') ? (
                  // Multi-key shortcut like "G then D"
                  <Group gap="xs">
                    {shortcut.keys.split(' then ').map((key, i) => (
                      <Group key={i} gap={4}>
                        {i > 0 && <Text size="sm" c="dimmed">then</Text>}
                        <Kbd
                          size="sm"
                          style={{
                            background: AQUA,
                            color: '#fff',
                            border: `1px solid ${AQUA}`,
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {key}
                        </Kbd>
                      </Group>
                    ))}
                  </Group>
                ) : (
                  // Single key shortcut
                  <Kbd
                    size="sm"
                    style={{
                      background: AQUA,
                      color: '#fff',
                      border: `1px solid ${AQUA}`,
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {shortcut.keys}
                  </Kbd>
                )}
              </Box>
              <Text size="sm" style={{ fontFamily: FONT_FAMILY, flex: 1, textAlign: 'right' }}>
                {shortcut.description}
              </Text>
            </Group>
          ))}
        </SimpleGrid>
      </Stack>
    </Modal>
  );
}
