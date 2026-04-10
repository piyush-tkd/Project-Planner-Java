/**
 * PPShortcutHint — renders a compact keyboard shortcut badge (DL-10)
 *
 * Usage:
 *   <PPShortcutHint keys={['⌘', 'K']} />
 *   <PPShortcutHint keys={['G', 'D']} size="xs" />
 */
import React from 'react';
import { Group } from '@mantine/core';
import { DARK_SURFACE_ALT, SIDEBAR_INACTIVE} from '../../brandTokens';

export interface PPShortcutHintProps {
  /** Each string is one key cap, e.g. ['⌘', 'K'] or ['G', 'D'] */
  keys: string[];
  /** Badge size (default 'sm') */
  size?: 'xs' | 'sm';
}

const SIZE_STYLES = {
  xs: { fontSize: 10, padding: '1px 4px', gap: 2 },
  sm: { fontSize: 11, padding: '2px 6px', gap: 4 },
} as const;

/** A single keycap pill */
function KeyCap({ label, size }: { label: string; size: 'xs' | 'sm' }) {
  const s = SIZE_STYLES[size];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: DARK_SURFACE_ALT,
        border: '1px solid #2e3346',
        borderRadius: 4,
        padding: s.padding,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: s.fontSize,
        fontWeight: 500,
        color: SIDEBAR_INACTIVE,
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

export function PPShortcutHint({ keys, size = 'sm' }: PPShortcutHintProps) {
  const s = SIZE_STYLES[size];
  return (
    <Group gap={s.gap} wrap="nowrap" style={{ display: 'inline-flex' }}>
      {keys.map((k, i) => (
        <KeyCap key={i} label={k} size={size} />
      ))}
    </Group>
  );
}

export default PPShortcutHint;
