import { Group, Badge } from '@mantine/core';
import { IconPencil, IconTicket, IconCloudUpload } from '@tabler/icons-react';
import type { SourceType } from '../../../types/project';

interface SourceFilterPillsProps {
  sourceFilter: SourceType | 'ALL' | 'ARCHIVED';
  onSourceFilterChange: (value: SourceType | 'ALL' | 'ARCHIVED') => void;
}

export default function SourceFilterPills(props: SourceFilterPillsProps) {
  const { sourceFilter, onSourceFilterChange } = props;

  const pills = [
    { key: 'ALL' as const, label: 'All Sources', color: 'gray', icon: null },
    { key: 'MANUAL' as const, label: 'Manual', color: 'blue', icon: <IconPencil size={11} /> },
    { key: 'JIRA_SYNCED' as const, label: 'Jira Synced', color: 'teal', icon: <IconTicket size={11} /> },
    { key: 'PUSHED_TO_JIRA' as const, label: 'Pushed to Jira', color: 'violet', icon: <IconCloudUpload size={11} /> },
    { key: 'ARCHIVED' as const, label: 'Archived', color: 'gray', icon: null },
  ];

  return (
    <Group gap="xs">
      {pills.map(pill => (
        <Badge
          key={pill.key}
          size="sm"
          color={pill.color}
          variant={sourceFilter === pill.key ? 'filled' : 'light'}
          leftSection={pill.icon}
          style={{ cursor: 'pointer' }}
          onClick={() => onSourceFilterChange(pill.key)}
        >
          {pill.label}
        </Badge>
      ))}
    </Group>
  );
}
