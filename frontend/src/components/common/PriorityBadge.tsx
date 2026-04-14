import { Group, Text } from '@mantine/core';
import {
  IconChevronsUp,
  IconChevronUp,
  IconEqual,
  IconChevronDown,
  IconChevronsDown,
  IconCircleMinus,
  IconCircle,
} from '@tabler/icons-react';

interface PriorityConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
}

export const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  HIGHEST: {
    icon: <IconChevronsUp size={14} />,
    color: '#ef4444',
    label: 'Highest',
  },
  HIGH: {
    icon: <IconChevronUp size={14} />,
    color: '#f97316',
    label: 'High',
  },
  MEDIUM: {
    icon: <IconEqual size={14} />,
    color: '#f59e0b',
    label: 'Medium',
  },
  LOW: {
    icon: <IconChevronDown size={14} />,
    color: '#3b82f6',
    label: 'Low',
  },
  LOWEST: {
    icon: <IconChevronsDown size={14} />,
    color: '#6366f1',
    label: 'Lowest',
  },
  BLOCKER: {
    icon: <IconCircleMinus size={14} />,
    color: '#dc2626',
    label: 'Blocker',
  },
  MINOR: {
    icon: <IconCircle size={14} />,
    color: '#9ca3af',
    label: 'Minor',
  },
};

const FALLBACK: PriorityConfig = {
  icon: <IconEqual size={14} />,
  color: '#9ca3af',
  label: 'Unknown',
};

interface PriorityBadgeProps {
  priority: string;
  showLabel?: boolean;
}

export default function PriorityBadge({ priority, showLabel = true }: PriorityBadgeProps) {
  const cfg = PRIORITY_CONFIG[priority?.toUpperCase()] ?? FALLBACK;
  return (
    <Group gap={4} wrap="nowrap" align="center" style={{ color: cfg.color }}>
      {cfg.icon}
      {showLabel && (
        <Text size="xs" fw={600} style={{ color: cfg.color, whiteSpace: 'nowrap' }}>
          {cfg.label}
        </Text>
      )}
    </Group>
  );
}
