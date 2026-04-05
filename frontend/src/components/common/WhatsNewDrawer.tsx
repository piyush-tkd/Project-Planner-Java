import { useEffect, useState } from 'react';
import {
  Drawer, Stack, Title, Text, Badge, Group, Divider, ScrollArea, Loader, Center,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { FONT_FAMILY } from '../../brandTokens';

interface ChangelogEntry {
  id: number; version: string; title: string; description: string;
  changeType: string; published: boolean; createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
  feature:     'blue',
  improvement: 'teal',
  fix:         'orange',
  breaking:    'red',
};

const LAST_SEEN_KEY = 'pp_changelog_last_seen';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export default function WhatsNewDrawer({ opened, onClose }: Props) {
  const { data: entries = [], isLoading } = useQuery<ChangelogEntry[]>({
    queryKey: ['changelog-published'],
    queryFn: async () => { const r = await apiClient.get('/changelog'); return r.data; },
    enabled: opened,
  });

  // Mark all as read when drawer opens
  useEffect(() => {
    if (opened) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    }
  }, [opened]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Title order={4} style={{ fontFamily: FONT_FAMILY }}>
          What's New
        </Title>
      }
      position="right"
      size="md"
      padding="lg"
    >
      <ScrollArea h="calc(100vh - 80px)">
        {isLoading ? (
          <Center h={200}><Loader /></Center>
        ) : entries.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>
              No announcements yet.
            </Text>
          </Center>
        ) : (
          <Stack gap="md">
            {entries.map((entry, i) => (
              <div key={entry.id}>
                <Group justify="space-between" align="flex-start" mb={4}>
                  <Group gap="xs">
                    <Badge size="xs" variant="outline" color="gray" style={{ fontFamily: FONT_FAMILY }}>
                      {entry.version}
                    </Badge>
                    <Badge size="xs" color={TYPE_COLOR[entry.changeType] ?? 'blue'} style={{ fontFamily: FONT_FAMILY }}>
                      {entry.changeType}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </Text>
                </Group>
                <Text size="sm" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY }}>
                  {entry.title}
                </Text>
                <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'pre-wrap' }}>
                  {entry.description}
                </Text>
                {i < entries.length - 1 && <Divider mt="md" />}
              </div>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Drawer>
  );
}

// ── Hook: how many unread entries ────────────────────────────────────────────
export function useUnreadChangelogCount(): number {
  const [count, setCount] = useState(0);
  const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
  const { data } = useQuery<{ count: number }>({
    queryKey: ['changelog-unread', lastSeen],
    queryFn: async () => {
      const params = lastSeen ? { since: lastSeen } : {};
      const r = await apiClient.get('/changelog/unread-count', { params });
      return r.data;
    },
    refetchInterval: 5 * 60 * 1000, // every 5 min
  });
  useEffect(() => { setCount(data?.count ?? 0); }, [data]);
  return count;
}
