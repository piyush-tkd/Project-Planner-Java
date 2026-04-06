/**
 * ActivityFeedDrawer
 *
 * Slide-in panel (right side) showing a scrollable timeline of recent project
 * activity events. Consumes useActivityFeed which polls /api/activity every
 * 30 seconds and falls back to synthetic entries from the project cache.
 */
import {
  Drawer, Stack, Title, Text, Group, ScrollArea, Loader, Center,
  Badge, ActionIcon, Tooltip, ThemeIcon, Box, Divider,
} from '@mantine/core';
import {
  IconRefresh,
  IconBriefcase,
  IconUsers,
  IconHexagons,
  IconBolt,
  IconCirclePlus,
  IconEdit,
  IconTrash,
  IconFlag,
  IconAlertTriangle,
  IconPlayerPlay,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react';
import { useActivityFeed, ActivityItem } from '../../hooks/useActivityFeed';
import { FONT_FAMILY, AQUA, DEEP_BLUE } from '../../brandTokens';

// ── Type → icon mapping ────────────────────────────────────────────────────

const TYPE_ICON: Record<ActivityItem['type'], React.ReactNode> = {
  status_change:    <IconBolt size={14} />,
  created:          <IconCirclePlus size={14} />,
  updated:          <IconEdit size={14} />,
  deleted:          <IconTrash size={14} />,
  flagged:          <IconFlag size={14} />,
  risk_added:       <IconAlertTriangle size={14} />,
  automation_fired: <IconPlayerPlay size={14} />,
};

const TYPE_COLOR: Record<ActivityItem['type'], string> = {
  status_change:    'blue',
  created:          'teal',
  updated:          'cyan',
  deleted:          'red',
  flagged:          'orange',
  risk_added:       'yellow',
  automation_fired: 'violet',
};

const ENTITY_ICON: Record<ActivityItem['entityType'], React.ReactNode> = {
  project:  <IconBriefcase size={13} />,
  resource: <IconUsers size={13} />,
  pod:      <IconHexagons size={13} />,
  rule:     <IconBolt size={13} />,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Feed item row ──────────────────────────────────────────────────────────

function FeedRow({ item }: { item: ActivityItem }) {
  return (
    <Box>
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {/* Type indicator dot */}
        <ThemeIcon
          size={28}
          radius="xl"
          color={TYPE_COLOR[item.type]}
          variant="light"
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          {TYPE_ICON[item.type]}
        </ThemeIcon>

        {/* Content */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} mb={2} wrap="nowrap">
            <Text
              size="sm"
              fw={600}
              style={{
                fontFamily: FONT_FAMILY,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}
            >
              {item.entityName}
            </Text>
            <Group gap={4} style={{ flexShrink: 0 }}>
              {ENTITY_ICON[item.entityType]}
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                {item.entityType}
              </Text>
            </Group>
          </Group>

          <Text
            size="xs"
            c="dimmed"
            style={{ fontFamily: FONT_FAMILY, lineHeight: 1.4 }}
          >
            {item.message}
          </Text>

          <Group justify="space-between" mt={4}>
            <Text
              size="xs"
              c="dimmed"
              style={{ fontFamily: FONT_FAMILY, opacity: 0.7 }}
            >
              by {item.actor}
            </Text>
            <Text
              size="xs"
              c="dimmed"
              style={{ fontFamily: FONT_FAMILY, opacity: 0.7 }}
            >
              {relativeTime(item.timestamp)}
            </Text>
          </Group>
        </Box>
      </Group>
    </Box>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  opened: boolean;
  onClose: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ActivityFeedDrawer({ opened, onClose }: Props) {
  const { items, isLive, refetch } = useActivityFeed();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      padding="lg"
      title={
        <Group gap="xs" justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <Title order={4} style={{ fontFamily: FONT_FAMILY }}>
              Activity Feed
            </Title>
            <Tooltip
              label={isLive ? 'Live data from server' : 'Showing recent projects (live feed not yet available)'}
              withArrow
            >
              <ThemeIcon
                size={18}
                radius="xl"
                color={isLive ? 'teal' : 'gray'}
                variant="light"
              >
                {isLive ? <IconWifi size={11} /> : <IconWifiOff size={11} />}
              </ThemeIcon>
            </Tooltip>
            {!isLive && (
              <Badge size="xs" color="gray" variant="outline" style={{ fontFamily: FONT_FAMILY }}>
                synthetic
              </Badge>
            )}
          </Group>

          <Tooltip label="Refresh" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => refetch()}
              color="gray"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
    >
      <ScrollArea h="calc(100vh - 100px)">
        {items.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <Loader size="sm" color={AQUA} />
              <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                Loading activity…
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap={0}>
            {items.map((item, idx) => (
              <Box key={item.id}>
                <FeedRow item={item} />
                {idx < items.length - 1 && (
                  <Divider
                    my="sm"
                    style={{ borderColor: 'rgba(45, 204, 211, 0.12)' }}
                  />
                )}
              </Box>
            ))}

            {/* Footer note */}
            <Box pt="lg">
              <Text
                size="xs"
                c="dimmed"
                ta="center"
                style={{ fontFamily: FONT_FAMILY }}
              >
                {isLive
                  ? 'Refreshes every 30 seconds'
                  : `Showing ${items.length} most recent projects`}
              </Text>
            </Box>
          </Stack>
        )}
      </ScrollArea>
    </Drawer>
  );
}
