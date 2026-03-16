import { useMemo, useState } from 'react';
import { Title, Stack, Text, Card, SimpleGrid, Table, SegmentedControl, Group } from '@mantine/core';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { IconClock, IconFlame, IconCalendarStats, IconTrendingUp } from '@tabler/icons-react';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { formatHours, formatPercent } from '../../utils/formatting';
import { getUtilizationBgColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import SummaryCard from '../../components/charts/SummaryCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ExportableChart from '../../components/common/ExportableChart';

export default function PodCapacityPage() {
  const { data: gapData, isLoading } = useCapacityGap('hours');
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const dark = useDarkMode();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const pods = useMemo(() => {
    if (!gapData?.gaps) return [];
    const names = new Set(gapData.gaps.map(g => g.podName));
    return Array.from(names).sort();
  }, [gapData]);

  const [selectedPod, setSelectedPod] = useState<string>('');
  const activePod = selectedPod || pods[0] || '';

  const podMonthData = useMemo(() => {
    if (!gapData?.gaps || !activePod) return [];
    return months.map(m => {
      const row = gapData.gaps.find(g => g.podName === activePod && g.monthIndex === m);
      const cap = row?.capacityHours ?? 0;
      const dem = row?.demandHours ?? 0;
      const util = cap > 0 ? (dem / cap) * 100 : 0;
      return {
        month: monthLabels[m] ?? `M${m}`,
        monthIndex: m,
        capacity: Math.round(cap),
        demand: Math.round(dem),
        utilization: Math.round(util),
      };
    });
  }, [gapData, activePod, monthLabels, months]);

  const stats = useMemo(() => {
    if (podMonthData.length === 0) return { totalCap: 0, totalDem: 0, avgUtil: 0, peakMonth: '', peakUtil: 0 };
    const totalCap = podMonthData.reduce((s, d) => s + d.capacity, 0);
    const totalDem = podMonthData.reduce((s, d) => s + d.demand, 0);
    const avgUtil = totalCap > 0 ? (totalDem / totalCap) * 100 : 0;
    const peakIdx = podMonthData.reduce((pi, d, i) => d.utilization > podMonthData[pi].utilization ? i : pi, 0);
    return {
      totalCap,
      totalDem,
      avgUtil: Math.round(avgUtil),
      peakMonth: podMonthData[peakIdx]?.month ?? '',
      peakUtil: podMonthData[peakIdx]?.utilization ?? 0,
    };
  }, [podMonthData]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <Stack>
      <Title order={2}>POD Capacity</Title>
      <Text size="sm" c="dimmed">Per-POD capacity vs demand detail — select a POD to drill in</Text>

      {pods.length > 0 && (
        <SegmentedControl
          value={activePod}
          onChange={setSelectedPod}
          data={pods.map(p => ({ value: p, label: p }))}
        />
      )}

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <SummaryCard title="Annual Capacity" value={formatHours(stats.totalCap)} icon={<IconClock size={20} color="#339af0" />} />
        <SummaryCard title="Annual Demand" value={formatHours(stats.totalDem)} icon={<IconTrendingUp size={20} color="#845ef7" />} />
        <SummaryCard
          title="Avg Utilization"
          value={formatPercent(stats.avgUtil)}
          icon={<IconFlame size={20} color={stats.avgUtil > 100 ? '#fa5252' : stats.avgUtil > 80 ? '#fd7e14' : '#40c057'} />}
          color={stats.avgUtil > 100 ? 'red' : stats.avgUtil > 80 ? 'orange' : 'green'}
        />
        <SummaryCard
          title="Peak Month"
          value={`${stats.peakMonth} (${formatPercent(stats.peakUtil)})`}
          icon={<IconCalendarStats size={20} color="#fd7e14" />}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="md">
          <ExportableChart title={`Capacity vs Demand - ${activePod}`}>
            <Title order={4} mb={4}>Capacity vs Demand — {activePod}</Title>
            <Text size="xs" c="dimmed" mb="sm">Total hours per month</Text>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={podMonthData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(value: number) => formatHours(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="capacity" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth={2} name="Capacity" />
                <Bar dataKey="demand" fill="rgba(239,68,68,0.6)" stroke="#ef4444" strokeWidth={2} name="Demand" />
              </BarChart>
            </ResponsiveContainer>
          </ExportableChart>
        </Card>

        <Card withBorder padding="md">
          <ExportableChart title={`Utilization - ${activePod}`}>
            <Title order={4} mb={4}>Utilization % — {activePod}</Title>
            <Text size="xs" c="dimmed" mb="sm">Demand / capacity per month</Text>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={podMonthData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <ReferenceLine y={100} stroke="rgba(220,38,38,0.5)" strokeDasharray="5 4" label={{ value: '100%', position: 'right', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  stroke="#8b5cf6"
                  fill="rgba(139,92,246,0.1)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#8b5cf6' }}
                  name="Utilization %"
                />
              </LineChart>
            </ResponsiveContainer>
          </ExportableChart>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Title order={4} mb={4}>Monthly Detail — {activePod}</Title>
        <Text size="xs" c="dimmed" mb="sm">Capacity, demand, and utilization per month</Text>
        <Table.ScrollContainer minWidth={800}>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Capacity (hrs)</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Demand (hrs)</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Gap (hrs)</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Utilization</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {podMonthData.map(d => {
                const gap = d.capacity - d.demand;
                return (
                  <Table.Tr key={d.monthIndex} style={d.monthIndex < currentMonthIndex ? { opacity: 0.5 } : {}}>
                    <Table.Td fw={500}>{d.month}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatHours(d.capacity)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatHours(d.demand)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: gap < 0 ? '#fa5252' : '#40c057', fontWeight: 600 }}>
                      {formatHours(gap)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', backgroundColor: getUtilizationBgColor(d.utilization, dark) }}>
                      {formatPercent(d.utilization)}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
