import { Group, Badge, Tooltip } from '@mantine/core';
import {
  IconAlertTriangle, IconUnlink, IconClock, IconAlertCircle,
} from '@tabler/icons-react';
import type { ProjectResponse } from '../../types/project';

interface Props {
  project: ProjectResponse;
  /** Show only chips relevant to the compact table view (omit verbose ones) */
  compact?: boolean;
}

export default function ProjectFlagChips({ project, compact = false }: Props) {
  const chips: React.ReactNode[] = [];

  // 🔴 Sync error flag
  if (project.jiraSyncError) {
    chips.push(
      <Tooltip key="sync-error" label="Last Jira sync failed — check credentials in Admin Settings" withArrow>
        <Badge size="xs" color="red" variant="light" leftSection={<IconAlertCircle size={10} />}>
          Sync Error
        </Badge>
      </Tooltip>
    );
  }

  // 🟠 No Jira ticket (manual project older than threshold)
  if (
    project.sourceType === 'MANUAL' &&
    !project.jiraEpicKey &&
    project.createdAt &&
    Date.now() - new Date(project.createdAt).getTime() > 30 * 24 * 60 * 60 * 1000 // 30 days
  ) {
    chips.push(
      <Tooltip key="no-ticket" label="Manual project with no Jira epic — consider linking or pushing to Jira" withArrow>
        <Badge size="xs" color="orange" variant="light" leftSection={<IconUnlink size={10} />}>
          No Epic
        </Badge>
      </Tooltip>
    );
  }

  // 🟡 Stale sync (last synced > 24h ago)
  if (
    !compact &&
    project.jiraLastSyncedAt &&
    Date.now() - new Date(project.jiraLastSyncedAt).getTime() > 24 * 60 * 60 * 1000
  ) {
    chips.push(
      <Tooltip
        key="stale"
        label={`Last synced: ${new Date(project.jiraLastSyncedAt).toLocaleString()}`}
        withArrow
      >
        <Badge size="xs" color="yellow" variant="light" leftSection={<IconClock size={10} />}>
          Stale
        </Badge>
      </Tooltip>
    );
  }

  // 🔵 Archived
  if (project.archived) {
    chips.push(
      <Tooltip key="archived" label="This project is archived and hidden from most views" withArrow>
        <Badge size="xs" color="gray" variant="light" leftSection={<IconAlertTriangle size={10} />}>
          Archived
        </Badge>
      </Tooltip>
    );
  }

  if (chips.length === 0) return null;

  return (
    <Group gap={4} wrap="nowrap">
      {chips}
    </Group>
  );
}
