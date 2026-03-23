import { useState, useMemo } from 'react';
import {
  Title, Stack, Grid, Card, Text, Button, NumberInput, Group, Table, Badge,
} from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useSimulateTimeline } from '../../api/simulator';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getGapCellColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { formatHours } from '../../utils/formatting';
import type { TimelineOverride } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ProjectStatus } from '../../types';

export default function TimelineSimulatorPage() {
  const { data: projects, isLoading } = useProjects();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
  const simulate = useSimulateTimeline();

  const activeProjects = useMemo(
    () => (projects ?? []).filter(p => p.status === ProjectStatus.ACTIVE),
    [projects]
  );

  const [overrides, setOverrides] = useState<Record<number, { start: number; duration: number }>>({});

  const getOverride = (projectId: number) => {
    const proj = activeProjects.find(p => p.id === projectId);
    return overrides[projectId] ?? {
      start: proj?.startMonth ?? 1,
      duration: proj?.durationMonths ?? 3,
    };
  };

  const setOverride = (projectId: number, field: 'start' | 'duration', value: number) => {
    const current = getOverride(projectId);
    setOverrides(prev => ({
      ...prev,
      [projectId]: { ...current, [field]: value },
    }));
  };

  const handleSimulate = () => {
    const timelineOverrides: TimelineOverride[] = Object.entries(overrides).map(([id, o]) => ({
      projectId: Number(id),
      newStartMonth: o.start,
      newDurationMonths: o.duration,
    }));
    simulate.mutate({ overrides: timelineOverrides });
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (isLoading) return <LoadingSpinner variant="chart" message="Loading simulator..." />;

  return (
    <Stack className="page-enter stagger-children">
      <Title order={2} className="slide-in-left">Timeline Simulator</Title>

      <Grid>
        <Grid.Col span={5}>
          <Card withBorder padding="md">
            <Title order={4} mb="md">Project Timelines</Title>
            <Stack gap="sm">
              {activeProjects.map(p => {
                const o = getOverride(p.id);
                return (
                  <Card key={p.id} withBorder padding="xs">
                    <Text fw={500} size="sm" mb={4}>{p.name}</Text>
                    <Group grow>
                      <NumberInput
                        label="Start Month"
                        value={o.start}
                        onChange={v => setOverride(p.id, 'start', Number(v))}
                        min={1}
                        max={12}
                        size="xs"
                      />
                      <NumberInput
                        label="Duration"
                        value={o.duration}
                        onChange={v => setOverride(p.id, 'duration', Number(v))}
                        min={1}
                        max={12}
                        size="xs"
                      />
                    </Group>
                  </Card>
                );
              })}
              {activeProjects.length === 0 && (
                <Text c="dimmed" ta="center">No active projects</Text>
              )}
            </Stack>
            <Button
              mt="md"
              fullWidth
              leftSection={<IconPlayerPlay size={16} />}
              onClick={handleSimulate}
              loading={simulate.isPending}
              disabled={Object.keys(overrides).length === 0}
            >
              Simulate
            </Button>
          </Card>
        </Grid.Col>

        <Grid.Col span={7}>
          <Card withBorder padding="md">
            <Title order={4} mb="md">Simulation Results</Title>
            {simulate.data ? (
              <Table.ScrollContainer minWidth={600}>
                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>POD</Table.Th>
                      {months.map(m => (
                        <Table.Th key={m} style={{ textAlign: 'center', fontSize: 11, ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : {}) }}>
                          {monthLabels[m] ?? `M${m}`}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(() => {
                      const podMap = new Map<string, Map<number, number>>();
                      simulate.data.simulatedGaps.forEach(g => {
                        if (!podMap.has(g.podName)) podMap.set(g.podName, new Map());
                        podMap.get(g.podName)!.set(g.monthIndex, g.gapHours);
                      });
                      return Array.from(podMap.entries()).map(([pod, monthData]) => (
                        <Table.Tr key={pod}>
                          <Table.Td fw={500} style={{ fontSize: 12 }}>{pod}</Table.Td>
                          {months.map(m => {
                            const gap = monthData.get(m) ?? 0;
                            return (
                              <Table.Td key={m} style={{ textAlign: 'center', fontSize: 11, ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : { backgroundColor: getGapCellColor(gap, dark) }) }}>
                                {formatHours(gap)}
                              </Table.Td>
                            );
                          })}
                        </Table.Tr>
                      ));
                    })()}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Adjust project timelines and click Simulate to see results
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
