import { SimpleGrid, Paper, Text, Group, Stack } from '@mantine/core';
import type { ProjectStats } from '../types';

interface MetricsCardsProps {
  stats: ProjectStats;
  cardFilter: string | null;
  statusFilter: string;
  onCardFilterChange: (filter: string) => void;
}

const CARDS = [
  { key: 'total',      label: 'Total',    getVal: (s: ProjectStats) => s.total      },
  { key: 'active',     label: 'Active',   getVal: (s: ProjectStats) => s.active     },
  { key: 'onHold',     label: 'On Hold',  getVal: (s: ProjectStats) => s.onHold     },
  { key: 'p0p1',       label: 'P0/P1',    getVal: (s: ProjectStats) => s.p0p1       },
];

export default function MetricsCards({ stats, cardFilter, onCardFilterChange }: MetricsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      {CARDS.map(({ key, label, getVal }) => {
        const isActive = cardFilter === key;
        return (
          <Paper
            key={key}
            p="sm"
            radius="md"
            withBorder
            style={{
              cursor: 'pointer',
              outline: isActive ? '2px solid var(--mantine-color-blue-5)' : undefined,
            }}
            onClick={() => onCardFilterChange(key)}
          >
            <Stack gap={2}>
              <Group justify="space-between" align="flex-start">
                <Text size="xs" c="dimmed">{label}</Text>
              </Group>
              <Text fw={700} size="xl">{getVal(stats)}</Text>
            </Stack>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}
