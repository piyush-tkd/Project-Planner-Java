import { Badge, Tooltip } from '@mantine/core';
import { IconTicket, IconPencil, IconCloudUpload } from '@tabler/icons-react';
import type { SourceType } from '../../types/project';

interface Props {
  sourceType: SourceType;
  jiraEpicKey?: string | null;
  size?: 'xs' | 'sm' | 'md';
}

const CONFIG: Record<SourceType, { color: string; label: string; icon: React.ReactNode; tooltip: string }> = {
  MANUAL: {
    color: 'blue',
    label: 'Manual',
    icon: <IconPencil size={10} />,
    tooltip: 'Created manually in Portfolio Planner',
  },
  JIRA_SYNCED: {
    color: 'teal',
    label: 'Jira Synced',
    icon: <IconTicket size={10} />,
    tooltip: 'Auto-discovered from Jira and kept in sync',
  },
  PUSHED_TO_JIRA: {
    color: 'violet',
    label: 'Pushed to Jira',
    icon: <IconCloudUpload size={10} />,
    tooltip: 'Started as Manual, then pushed to Jira as an Epic',
  },
};

export default function ProjectSourceBadge({ sourceType, jiraEpicKey, size = 'xs' }: Props) {
  const cfg = CONFIG[sourceType] ?? CONFIG.MANUAL;
  const tooltipLabel = jiraEpicKey
    ? `${cfg.tooltip} — ${jiraEpicKey}`
    : cfg.tooltip;

  return (
    <Tooltip label={tooltipLabel} withArrow position="top">
      <Badge
        size={size}
        color={cfg.color}
        variant="light"
        leftSection={cfg.icon}
        style={{ cursor: 'default' }}
      >
        {cfg.label}
      </Badge>
    </Tooltip>
  );
}
