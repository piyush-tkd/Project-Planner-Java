import { useMemo } from 'react';
import {
  Title,
  Text,
  Stack,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Progress,
  Table,
  Skeleton,
  Center,
  ThemeIcon,
  Alert,
  RingProgress,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconAlertCircle,
  IconChartAreaLine,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useCapacityGap } from '../../api/reports';
import { COLOR_ERROR_DEEP, COLOR_ORANGE_DARK, DEEP_BLUE, FONT_FAMILY, SURFACE_ERROR_LIGHT, SURFACE_ORANGE, SURFACE_SELECTED } from '../../brandTokens';
import { PodMonthGap } from '../../types/report';
import { useDarkMode } from '../../hooks/useDarkMode';

// Traffic-light classification
function classify(gapHours: number): 'critical' | 'warning' | 'healthy' {
  if (gapHours < -40) return 'critical';
  if (gapHours < -10) return 'warning';
  return 'healthy';
}

const STATUS_CONFIG = {
  critical: { color: 'red',    label: 'Critical Gap',  icon: IconAlertTriangle,  badgeColor: 'red'    },
  warning:  { color: 'yellow', label: 'At Risk',       icon: IconAlertCircle,    badgeColor: 'yellow' },
  healthy:  { color: 'teal',   label: 'Healthy',       icon: IconCircleCheck,    badgeColor: 'teal'   },
};

interface PodForecast {
  podId: number;
  podName: string;
  months: Array<{
    monthIndex: number;
    monthLabel: string;
    demandHours: number;
    capacityHours: number;
    gapHours: number;
    gapFte: number;
    status: 'critical' | 'warning' | 'healthy';
  }>;
  worstStatus: 'critical' | 'warning' | 'healthy';
}

function utilizationPct(demand: number, capacity: number): number {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(200, Math.round((demand / capacity) * 100));
}

// Dark-mode-safe background and text per traffic-light status
const DARK_CARD_STYLES = {
  critical: { bg: 'rgba(250,82,82,0.12)',  border: 'rgba(250,82,82,0.4)',  labelColor: '#ff8787', valueColor: '#fff' },
  warning:  { bg: 'rgba(245,159,0,0.12)',  border: 'rgba(245,159,0,0.4)',  labelColor: '#fcc419', valueColor: '#fff' },
  healthy:  { bg: 'rgba(45,204,211,0.10)', border: 'rgba(45,204,211,0.35)',labelColor: '#63e6be', valueColor: '#fff' },
};
const LIGHT_CARD_STYLES = {
  critical: { bg: SURFACE_ERROR_LIGHT, border: 'rgba(250,82,82,0.3)',  labelColor: COLOR_ERROR_DEEP, valueColor: 'var(--pp-text)' },
  warning:  { bg: SURFACE_ORANGE, border: 'rgba(245,159,0,0.35)', labelColor: COLOR_ORANGE_DARK, valueColor: 'var(--pp-text)' },
  healthy:  { bg: SURFACE_SELECTED, border: 'rgba(45,204,211,0.3)', labelColor: '#087f5b', valueColor: 'var(--pp-text)' },
};

export default function CapacityForecastPage() {
  const isDark = useDarkMode();
  const { data, isLoading, isError } = useCapacityGap('hours');

  // Pick the 3 lowest month indices present in data (= current planning window)
  const forecastData = useMemo<PodForecast[]>(() => {
    if (!data?.gaps?.length) return [];

    const allMonths = [...new Set(data.gaps.map(g => g.monthIndex))].sort((a, b) => a - b);
    const forecastMonths = allMonths.slice(0, 3);

    // Group by pod
    const podMap = new Map<number, PodMonthGap[]>();
    for (const gap of data.gaps) {
      if (forecastMonths.includes(gap.monthIndex)) {
        if (!podMap.has(gap.podId)) podMap.set(gap.podId, []);
        podMap.get(gap.podId)!.push(gap);
      }
    }

    return Array.from(podMap.entries()).map(([podId, gaps]) => {
      const months = forecastMonths.map(mi => {
        const g = gaps.find(x => x.monthIndex === mi);
        const gapHours = g ? Number(g.gapHours) : 0;
        return {
          monthIndex: mi,
          monthLabel: g?.monthLabel ?? `M${mi}`,
          demandHours: g ? Number(g.demandHours) : 0,
          capacityHours: g ? Number(g.capacityHours) : 0,
          gapHours,
          gapFte: g ? Number(g.gapFte) : 0,
          status: classify(gapHours),
        };
      });

      const statusPriority = { critical: 2, warning: 1, healthy: 0 } as const;
      const worstStatus = months.reduce<'critical' | 'warning' | 'healthy'>(
        (acc, m) => statusPriority[m.status] > statusPriority[acc] ? m.status : acc,
        'healthy'
      );

      return { podId, podName: gaps[0].podName, months, worstStatus };
    }).sort((a, b) => {
      const p = { critical: 2, warning: 1, healthy: 0 } as const;
      return p[b.worstStatus] - p[a.worstStatus];
    });
  }, [data]);

  const summary = useMemo(() => {
    const critical = forecastData.filter(p => p.worstStatus === 'critical').length;
    const warning  = forecastData.filter(p => p.worstStatus === 'warning').length;
    const healthy  = forecastData.filter(p => p.worstStatus === 'healthy').length;
    return { critical, warning, healthy, total: forecastData.length };
  }, [forecastData]);

  if (isLoading) {
    return (
      <Stack gap="xs" p="md">{[...Array(6)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>
    );
  }

  if (isError || !data) {
    return (
      <Alert color="red" icon={<IconAlertTriangle />} mt="md">
        Failed to load capacity forecast data. Check backend connectivity.
      </Alert>
    );
  }

  const monthLabels = forecastData[0]?.months.map(m => m.monthLabel) ?? [];

  return (
    <Stack gap="lg" p="md">
      {/* Header */}
      <div>
        <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 600 }}>
          Capacity Forecast — Next 3 Months
        </Title>
        <Text c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
          Traffic-light view of upcoming capacity gaps per POD.
          🔴 &gt;40h deficit · 🟡 10–40h deficit · 🟢 Healthy
        </Text>
      </div>

      {/* Summary KPI strip */}
      <SimpleGrid cols={{ base: 3, sm: 3 }} spacing="md">
        <Card withBorder radius="md" p="md" style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}>
          <Group gap="sm">
            <ThemeIcon color="red" variant="light" size={40} radius="md">
              <IconTrendingDown size={20} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{summary.critical}</Text>
              <Text size="xs" c="dimmed">Critical PODs</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder radius="md" p="md" style={{ borderLeft: '4px solid var(--mantine-color-yellow-6)' }}>
          <Group gap="sm">
            <ThemeIcon color="yellow" variant="light" size={40} radius="md">
              <IconAlertCircle size={20} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{summary.warning}</Text>
              <Text size="xs" c="dimmed">At-Risk PODs</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder radius="md" p="md" style={{ borderLeft: '4px solid var(--mantine-color-teal-6)' }}>
          <Group gap="sm">
            <ThemeIcon color="teal" variant="light" size={40} radius="md">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{summary.healthy}</Text>
              <Text size="xs" c="dimmed">Healthy PODs</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Month header cards */}
      {monthLabels.length > 0 && (
        <SimpleGrid cols={3} spacing="sm">
          {monthLabels.map((label, i) => (
            <Card
              key={i}
              withBorder
              radius="sm"
              p="xs"
              ta="center"
              style={{ background: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)' }}
            >
              <Group justify="center" gap={6}>
                <IconChartAreaLine size={14} color={isDark ? 'rgba(255,255,255,0.4)' : 'gray'} />
                <Text fw={600} size="sm" c="dimmed">{label}</Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* POD forecast cards */}
      {forecastData.length === 0 ? (
        <Center py={80}>
          <Stack align="center" gap="sm">
            <ThemeIcon size={64} radius="md" variant="light" color="blue">
              <IconChartAreaLine size={32} stroke={1.5} />
            </ThemeIcon>
            <Text fw={600} c="dimmed">No capacity data available</Text>
            <Text size="sm" c="dimmed">Configure PODs and resources to see the 3-month forecast.</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {forecastData.map(pod => (
            <Card key={pod.podId} withBorder radius="md" p="md">
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>{pod.podName}</Text>
                  <Badge
                    color={STATUS_CONFIG[pod.worstStatus].badgeColor}
                    variant="light"
                    size="sm"
                  >
                    {STATUS_CONFIG[pod.worstStatus].label}
                  </Badge>
                </Group>
              </Group>

              <SimpleGrid cols={3} spacing="sm">
                {pod.months.map(m => {
                  const cfg = STATUS_CONFIG[m.status];
                  const Icon = cfg.icon;
                  const util = utilizationPct(m.demandHours, m.capacityHours);

                  const cardStyle = isDark
                    ? DARK_CARD_STYLES[m.status]
                    : LIGHT_CARD_STYLES[m.status];

                  return (
                    <Card
                      key={m.monthIndex}
                      withBorder
                      radius="sm"
                      p="sm"
                      style={{
                        borderColor: cardStyle.border,
                        backgroundColor: cardStyle.bg,
                      }}
                    >
                      <Group justify="space-between" mb={4}>
                        <Text size="xs" fw={600} style={{ color: cardStyle.labelColor }}>{m.monthLabel}</Text>
                        <Icon size={14} color={cardStyle.labelColor} />
                      </Group>
                      <Group gap="xs" mb={6} align="flex-end">
                        <RingProgress
                          size={44}
                          thickness={4}
                          sections={[{ value: Math.min(100, util), color: cfg.color }]}
                          label={<Text ta="center" size="9px" fw={700} style={{ color: cardStyle.valueColor }}>{util}%</Text>}
                        />
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            Demand: <Text span fw={600} style={{ color: cardStyle.valueColor }}>{Math.round(m.demandHours)}h</Text>
                          </Text>
                          <Text size="xs" c="dimmed">
                            Capacity: <Text span fw={600} style={{ color: cardStyle.valueColor }}>{Math.round(m.capacityHours)}h</Text>
                          </Text>
                          <Text size="xs" fw={700} style={{ color: cardStyle.labelColor }}>
                            Gap: {m.gapHours >= 0 ? '+' : ''}{Math.round(m.gapHours)}h
                          </Text>
                        </Stack>
                      </Group>
                      <Progress
                        value={Math.min(100, util)}
                        color={cfg.color}
                        size={4}
                        radius="xl"
                      />
                    </Card>
                  );
                })}
              </SimpleGrid>
            </Card>
          ))}
        </Stack>
      )}

      {/* Detail table */}
      {forecastData.length > 0 && (
        <Card withBorder radius="md" p="md" mt="md">
          <Text fw={600} mb="sm" size="sm" style={{ fontFamily: FONT_FAMILY }}>Full Forecast Table</Text>
          <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>POD</Table.Th>
                {monthLabels.map(l => (
                  <>
                    <Table.Th key={`${l}-demand`}>{l} Demand (h)</Table.Th>
                    <Table.Th key={`${l}-capacity`}>{l} Capacity (h)</Table.Th>
                    <Table.Th key={`${l}-gap`}>{l} Gap (h)</Table.Th>
                  </>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {forecastData.map(pod => (
                <Table.Tr key={pod.podId}>
                  <Table.Td fw={600}>{pod.podName}</Table.Td>
                  {pod.months.map(m => (
                    <>
                      <Table.Td key={`${m.monthIndex}-d`}>{Math.round(m.demandHours)}</Table.Td>
                      <Table.Td key={`${m.monthIndex}-c`}>{Math.round(m.capacityHours)}</Table.Td>
                      <Table.Td
                        key={`${m.monthIndex}-g`}
                        style={{ color: m.gapHours < -10 ? 'var(--mantine-color-red-7)' : 'inherit', fontWeight: 600 }}
                      >
                        {m.gapHours >= 0 ? '+' : ''}{Math.round(m.gapHours)}
                      </Table.Td>
                    </>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
