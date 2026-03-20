import React, { useMemo, useState } from 'react';
import {
  Box,
  Group,
  Modal,
  MultiSelect,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Badge,
  SimpleGrid,
  Paper,
  Center,
  Loader,
} from '@mantine/core';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { formatGapHours, formatGapFte } from '../../utils/formatting';
import LoadingSpinner from '../../components/common/LoadingSpinner';

interface PodMonthGap {
  podId: number;
  podName: string;
  monthIndex: number;
  monthLabel: string;
  demandHours: number;
  capacityHours: number;
  gapHours: number;
  gapFte: number;
}

interface CapacityGapData {
  gaps: PodMonthGap[];
}

const DEEP_BLUE = '#0C2340';
const AGUA = '#1F9196';

// Color thresholds (in hours, assuming 160h per month full capacity)
const getGapColors = (
  gapHours: number
): { bg: string; text: string } => {
  if (gapHours > 160) {
    return { bg: '#d3f9d8', text: '#2f9e44' }; // Comfortable surplus
  }
  if (gapHours > 0) {
    return { bg: '#ebfbee', text: '#40c057' }; // Slight surplus
  }
  if (Math.abs(gapHours) <= 8) {
    return { bg: '#f8f9fa', text: '#868e96' }; // Balanced
  }
  if (gapHours < 0 && gapHours > -160) {
    return { bg: '#fff3bf', text: '#e67700' }; // Slight deficit
  }
  return { bg: '#ffe3e3', text: '#c92a2a' }; // Significant deficit
};

export default function SlackBufferPage() {
  const { data: capacityData, isLoading, isError } = useCapacityGap();
  const { monthLabels, currentMonthIndex } = useMonthLabels();

  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'hours' | 'fte'>('hours');
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedCell, setSelectedCell] = useState<PodMonthGap | null>(null);

  const gaps = capacityData?.gaps ?? [];

  // Extract unique PODs and months from data
  const { pods, months } = useMemo(() => {
    const podMap = new Map<number, string>();
    const monthSet = new Set<number>();

    gaps.forEach((gap) => {
      podMap.set(gap.podId, gap.podName);
      monthSet.add(gap.monthIndex);
    });

    const podList = Array.from(podMap.values()).sort();
    const monthList = Array.from(monthSet).sort((a, b) => a - b);

    return { pods: podList, months: monthList };
  }, [gaps]);

  // Filter data
  const filteredGaps = useMemo(() => {
    return gaps.filter((gap) => {
      const podMatch =
        selectedPods.length === 0 || selectedPods.includes(gap.podName);
      return podMatch;
    });
  }, [gaps, selectedPods]);

  // Build lookup map
  const gapMap = useMemo(() => {
    const map = new Map<string, PodMonthGap>();
    filteredGaps.forEach((gap) => {
      const key = `${gap.podId}:${gap.monthIndex}`;
      map.set(key, gap);
    });
    return map;
  }, [filteredGaps]);

  // Calculate totals per month
  const monthTotals = useMemo(() => {
    const totals = new Map<number, { hours: number; fte: number }>();
    filteredGaps.forEach((gap) => {
      const current = totals.get(gap.monthIndex) || { hours: 0, fte: 0 };
      current.hours += gap.gapHours;
      current.fte += gap.gapFte;
      totals.set(gap.monthIndex, current);
    });
    return totals;
  }, [filteredGaps]);

  const podOptions = pods.map((p) => ({ value: p, label: p }));

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <Text color="red">Failed to load capacity data</Text>;

  const handleCellClick = (gap: PodMonthGap) => {
    setSelectedCell(gap);
    setModalOpened(true);
  };

  const getDisplayValue = (gap: PodMonthGap): string => {
    if (viewMode === 'hours') {
      return formatGapHours(gap.gapHours);
    }
    return formatGapFte(gap.gapFte);
  };

  const getDisplaySecondary = (gap: PodMonthGap): string => {
    if (viewMode === 'hours') {
      return formatGapFte(gap.gapFte);
    }
    return formatGapHours(gap.gapHours);
  };

  const getGapValueForColor = (gap: PodMonthGap): number => {
    return viewMode === 'hours' ? gap.gapHours : gap.gapFte * 160;
  };

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={1}>Slack & Buffer</Title>
        <Text size="sm" c="dimmed">
          Available capacity per POD per month — green = surplus, red = deficit
        </Text>
      </div>

      <Group gap="md">
        <MultiSelect
          label="Filter PODs"
          placeholder="Select PODs..."
          data={podOptions}
          value={selectedPods}
          onChange={setSelectedPods}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <SegmentedControl
          label="View"
          data={[
            { value: 'hours', label: 'Hours' },
            { value: 'fte', label: 'FTE' },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as 'hours' | 'fte')}
        />
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Legend
          </Text>
          <Group gap="lg">
            {[
              { range: '>160h', color: '#d3f9d8', text: '#2f9e44' },
              { range: '0-160h', color: '#ebfbee', text: '#40c057' },
              { range: '±0-8h', color: '#f8f9fa', text: '#868e96' },
              { range: '-160 to 0h', color: '#fff3bf', text: '#e67700' },
              { range: '<-160h', color: '#ffe3e3', text: '#c92a2a' },
            ].map((item) => (
              <Group key={item.range} gap="xs">
                <Box
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: item.color,
                    border: `1px solid ${item.text}`,
                    borderRadius: 4,
                  }}
                />
                <Text size="xs">{item.range}</Text>
              </Group>
            ))}
          </Group>
        </Stack>
      </Paper>

      <ScrollArea>
        <table
          style={{
            borderCollapse: 'collapse',
            fontFamily: 'Barlow, system-ui',
            fontSize: '13px',
            minWidth: '100%',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  backgroundColor: DEEP_BLUE,
                  color: 'white',
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  minWidth: 120,
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                }}
              >
                POD
              </th>
              {months.map((monthIdx) => {
                const isCurrentMonth = monthIdx === currentMonthIndex;
                return (
                  <th
                    key={monthIdx}
                    style={{
                      backgroundColor: isCurrentMonth ? AGUA : DEEP_BLUE,
                      color: 'white',
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: 600,
                      minWidth: 90,
                    }}
                  >
                    <Stack gap={0}>
                      <Text size="xs" fw={600}>
                        {monthLabels[monthIdx] || `M${monthIdx}`}
                      </Text>
                      {isCurrentMonth && (
                        <Badge size="xs" color="white" c={AGUA}>
                          Current
                        </Badge>
                      )}
                    </Stack>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pods.map((podName) => (
              <tr key={podName}>
                <td
                  style={{
                    backgroundColor: DEEP_BLUE,
                    color: 'white',
                    padding: '12px',
                    fontWeight: 600,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                  }}
                >
                  {podName}
                </td>
                {months.map((monthIdx) => {
                  const gap = filteredGaps.find(
                    (g) => g.podName === podName && g.monthIndex === monthIdx
                  );

                  if (!gap) {
                    return (
                      <td
                        key={monthIdx}
                        style={{
                          backgroundColor: '#f8f9fa',
                          padding: '12px',
                          textAlign: 'center',
                          borderBottom: '1px solid #e9ecef',
                        }}
                      >
                        —
                      </td>
                    );
                  }

                  const gapValue = getGapValueForColor(gap);
                  const colors = getGapColors(gapValue);

                  return (
                    <td
                      key={monthIdx}
                      onClick={() => handleCellClick(gap)}
                      style={{
                        backgroundColor: colors.bg,
                        padding: '12px',
                        textAlign: 'center',
                        borderBottom: '1px solid #e9ecef',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <Stack gap={2}>
                        <Text
                          fw={700}
                          size="sm"
                          c={colors.text}
                          style={{ lineHeight: 1 }}
                        >
                          {getDisplayValue(gap)}
                        </Text>
                        <Text
                          size="xs"
                          c={colors.text}
                          style={{ opacity: 0.7, lineHeight: 1 }}
                        >
                          {getDisplaySecondary(gap)}
                        </Text>
                      </Stack>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Summary row */}
            <tr>
              <td
                style={{
                  backgroundColor: DEEP_BLUE,
                  color: 'white',
                  padding: '12px',
                  fontWeight: 600,
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              >
                Total
              </td>
              {months.map((monthIdx) => {
                const total = monthTotals.get(monthIdx) || {
                  hours: 0,
                  fte: 0,
                };
                const gapValue = viewMode === 'hours' ? total.hours : total.fte * 160;
                const colors = getGapColors(gapValue);

                return (
                  <td
                    key={monthIdx}
                    style={{
                      backgroundColor: colors.bg,
                      padding: '12px',
                      textAlign: 'center',
                      borderBottom: '1px solid #e9ecef',
                      fontWeight: 600,
                    }}
                  >
                    <Stack gap={2}>
                      <Text
                        fw={700}
                        size="sm"
                        c={colors.text}
                        style={{ lineHeight: 1 }}
                      >
                        {viewMode === 'hours'
                          ? formatGapHours(total.hours)
                          : formatGapFte(total.fte)}
                      </Text>
                      <Text
                        size="xs"
                        c={colors.text}
                        style={{ opacity: 0.7, lineHeight: 1 }}
                      >
                        {viewMode === 'hours'
                          ? formatGapFte(total.fte)
                          : formatGapHours(total.hours)}
                      </Text>
                    </Stack>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </ScrollArea>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Capacity Detail"
        size="sm"
      >
        {selectedCell && (
          <Stack gap="lg">
            <div>
              <Text fw={600} size="lg">
                {selectedCell.podName}
              </Text>
              <Text size="sm" c="dimmed">
                {selectedCell.monthLabel}
              </Text>
            </div>

            <SimpleGrid cols={2} spacing="md">
              <Paper p="md" radius="md" withBorder>
                <Stack gap="xs">
                  <Text size="xs" fw={500} c="dimmed">
                    Capacity
                  </Text>
                  <Text fw={700} size="lg">
                    {formatGapHours(selectedCell.capacityHours)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatGapFte(selectedCell.capacityHours / 160)}
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" radius="md" withBorder>
                <Stack gap="xs">
                  <Text size="xs" fw={500} c="dimmed">
                    Demand
                  </Text>
                  <Text fw={700} size="lg">
                    {formatGapHours(selectedCell.demandHours)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatGapFte(selectedCell.demandHours / 160)}
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>

            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                backgroundColor: getGapColors(selectedCell.gapHours).bg,
              }}
            >
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">
                  Gap (Available Capacity)
                </Text>
                <Group gap="lg">
                  <div>
                    <Text
                      fw={700}
                      size="xl"
                      c={getGapColors(selectedCell.gapHours).text}
                    >
                      {formatGapHours(selectedCell.gapHours)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Hours
                    </Text>
                  </div>
                  <div>
                    <Text
                      fw={700}
                      size="xl"
                      c={getGapColors(selectedCell.gapHours).text}
                    >
                      {formatGapFte(selectedCell.gapFte)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      FTE
                    </Text>
                  </div>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
