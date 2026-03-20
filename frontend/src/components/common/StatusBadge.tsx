import { Badge } from '@mantine/core';
import { ProjectStatus } from '../../types';

const statusConfig: Record<string, { color: string; label: string }> = {
  [ProjectStatus.NOT_STARTED]: { color: 'gray', label: 'Not Started' },
  [ProjectStatus.IN_DISCOVERY]: { color: 'violet', label: 'In Discovery' },
  [ProjectStatus.ACTIVE]: { color: 'green', label: 'Active' },
  [ProjectStatus.ON_HOLD]: { color: 'yellow', label: 'On Hold' },
  [ProjectStatus.COMPLETED]: { color: 'blue', label: 'Completed' },
  [ProjectStatus.CANCELLED]: { color: 'red', label: 'Cancelled' },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { color: 'gray', label: status };
  return <Badge color={config.color} variant="light">{config.label}</Badge>;
}
