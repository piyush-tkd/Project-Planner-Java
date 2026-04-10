/**
 * GHint — bottom-right toast showing G+letter shortcuts hint
 * Appears when G is pressed, shows available destinations
 */
import { useEffect, useState } from 'react';
import { Text, Group, Kbd, Paper, useComputedColorScheme } from '@mantine/core';
import { AQUA } from '../../brandTokens';

interface GHintProps {
  show: boolean;
}

const shortcuts = [
  { key: 'D', label: 'Dashboard' },
  { key: 'P', label: 'Projects' },
  { key: 'R', label: 'Resources' },
  { key: 'C', label: 'Capacity' },
  { key: 'O', label: 'Pods' },
  { key: 'J', label: 'Jira Actuals' },
  { key: 'S', label: 'Settings' },
  { key: 'K', label: 'Command Palette' },
];

export function GHint({ show }: GHintProps) {
  const [visible, setVisible] = useState(show);
  const isDark = useComputedColorScheme() === 'dark';

  useEffect(() => {
    if (!show) {
      const timer = setTimeout(() => setVisible(false), 150);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [show]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        animation: show ? 'ppGHintEnter 150ms cubic-bezier(0.4, 0, 0.2, 1)' : 'ppGHintExit 150ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Paper
        p="md"
        radius="md"
        style={{
          background: isDark
            ? 'rgba(19, 19, 30, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
          border: isDark
            ? '1px solid rgba(45, 204, 211, 0.2)'
            : '1px solid rgba(45, 204, 211, 0.3)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Group gap="xs" wrap="wrap">
          <Text size="xs" fw={600} c={isDark ? '#b0b3c1' : '#333'}>
            Press G then:
          </Text>
          <Group gap={6} wrap="wrap">
            {shortcuts.slice(0, 4).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Kbd
                  size="xs"
                  style={{
                    background: isDark ? 'rgba(45, 204, 211, 0.15)' : 'rgba(45, 204, 211, 0.1)',
                    border: isDark
                      ? '1px solid rgba(45, 204, 211, 0.3)'
                      : '1px solid rgba(45, 204, 211, 0.4)',
                    color: AQUA,
                    fontWeight: 600,
                  }}
                >
                  {key}
                </Kbd>
                <Text size="xs" c={isDark ? '#8b9ab3' : '#555'}>
                  {label}
                </Text>
              </div>
            ))}
          </Group>
        </Group>
      </Paper>

      <style>{`
        @keyframes ppGHintEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes ppGHintExit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}

export default GHint;
