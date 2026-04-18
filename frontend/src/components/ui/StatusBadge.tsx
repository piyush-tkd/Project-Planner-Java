import _React from 'react';
import { Badge } from '@mantine/core';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

// Default color map for known statuses — any string not listed falls back to gray.
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE:       { color: 'teal.6',   label: 'Active' },
  AT_RISK:      { color: 'yellow.7', label: 'At Risk' },
  BLOCKED:      { color: 'red.6',    label: 'Blocked' },
  ON_HOLD:      { color: 'gray.6',   label: 'On Hold' },
  COMPLETED:    { color: 'blue.6',   label: 'Completed' },
  CANCELLED:    { color: 'gray.5',   label: 'Cancelled' },
  IN_DISCOVERY: { color: 'violet.6', label: 'In Discovery' },
  PAUSED:       { color: 'orange.6', label: 'Paused' },
  // Common Kanban lane names
  TODO:         { color: 'gray.5',   label: 'To Do' },
  IN_PROGRESS:  { color: 'blue.5',   label: 'In Progress' },
  IN_REVIEW:    { color: 'cyan.6',   label: 'In Review' },
  DONE:         { color: 'teal.6',   label: 'Done' },
};

/** Convert any raw status string to a display label.
 *  e.g. "MY_CUSTOM_STATUS" → "My Custom Status" */
function toLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const key = status?.toUpperCase().replace(/\s+/g, '_') ?? '';
  const config = STATUS_CONFIG[key] ?? { color: 'gray.5', label: toLabel(status) };

  const dotSize = size === 'sm' ? 6 : 8;

  const dot = (
    <span
      style={{
        display: 'inline-block',
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        flexShrink: 0,
      }}
    />
  );

  return (
    <Badge
      color={config.color}
      variant="light"
      size={size}
      leftSection={dot}
      styles={{ label: { display: 'flex', alignItems: 'center', gap: 4 } }}
    >
      {config.label}
    </Badge>
  );
}
