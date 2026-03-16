import { Badge } from '@mantine/core';
import { Priority } from '../../types';

const priorityConfig: Record<string, { color: string }> = {
  [Priority.P0]: { color: 'red' },
  [Priority.P1]: { color: 'orange' },
  [Priority.P2]: { color: 'blue' },
  [Priority.P3]: { color: 'gray' },
};

interface PriorityBadgeProps {
  priority: string;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority] ?? { color: 'gray' };
  return <Badge color={config.color} variant="light">{priority}</Badge>;
}
