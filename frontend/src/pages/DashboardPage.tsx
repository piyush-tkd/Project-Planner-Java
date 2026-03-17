import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Stack, SimpleGrid, Text, Card, Group, Button, Table,
} from '@mantine/core';
import {
  IconUsers, IconBriefcase, IconFlame, IconAlertTriangle,
  IconChartBar, IconChartAreaLine, IconUserPlus, IconCalendar,
} from '@tabler/icons-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  useExecutiveSummary, useUtilizationHeatmap, useHiringForecast, useCapacityDemandSummary,
} from '../api/reports';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../utils/colors';
import { formatPercent, formatHours } from '../utils/formatting';
import { formatRole } from '../types';
import SummaryCard from '../components/charts/SummaryCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ExportableChart from '../components/common/ExportableChart';
import { useDarkMode } from '../hooks/useDarkMode';

const ROLE_COLORS: Record<string, string> = {
  DEVELOPER: '#3b82f6',
  QA: '#8b5cf6',
  BSA: '#f59e0b',
  TECH_LEAD: '#ef4444',
};

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useExecutiveSummary();
  const { data: heatmapCells, isLoading: heatmapLoading } = useUtilizationHeatmap();
  const { data: hiringData, isLoading: hiringLoading } = useHiringForecast();
  const { data: capDemData, isLoading: capDemLoading } = useCapacityDemandSummary();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const navigate = useNavigate();
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';

  const miniHeatmap = useMemo(() => {
    if (!heatmapCells) return [];
    const podMap = new Map<string, Map<number, number>>();
    heatmapCells.forEach(u => {
      if (!podMap.has(u.podName)) podMap.set(u.podName, new Map());
      podMap.get(u.podName)!.set(u.monthIndex, u.utilizationPct);
    });
    return Array.from(podMap.entries()).slice(0, 7).map(([name, data]) => ({ name, data }));
  }, [heatmapCells]);

  const capDemChart = useMemo(() => {
    return (capDemData ?? []).map(d => ({
      month: d.monthLabel,
      capacity: Math.round(d.totalCapacityHours),
      demand: Math.round(d.totalDemandHours),
    }));
  }, [capDemData]);

  const hireChart = useMemo(() => {
    if (!hiringData) return [];
    const monthMap = new Map<string, Record<string, number>>();
    hiringData.forEach(d => {
      const label = d.monthLabel;
      if (!monthMap.has(label)) monthMap.set(label, {});
      const row = monthMap.get(label)!;
      row[d.role] = (row[d.role] ?? 0) + d.ftesNeeded;
    });
    return Array.from(monthMap.entries()).map(([month, roles]) => ({ month, ...roles }));
  }, [hiringData]);

  const hireRoles = useMemo(() => {
    if (!hiringData) return [];
    return Array.from(new Set(hiringData.map(d => d.role)));
  }, [hiringData]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (summaryLoading) return <LoadingSpinner />;

  const isEmpty = !summary ||
    (summary.totalResources === 0 && summary.activeProjects === 0);

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>

      {isEmpty && (
        <Card withBorder padding="lg" radius="md"
          style={{ borderLeft: '4px solid #339af0', background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)' }}>
          <Group gap="sm" mb="sm">
            <IconUsers size={22} color="#339af0" />
            <Title order={4} style={{ color: '#1e40af' }}>Welcome — let's get started</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Your Portfolio Planner is set up but has no data yet. Add resources and projects to start
            tracking utilization, capacity, and demand across your organization.
          </Text>
          <Group gap="sm">
            <Button size="xs" variant="light" leftSection={<IconUsers size={13} />}
              onClick={() => navigate('/resources')}>
              Add Resources
            </Button>
            <Button size="xs" variant="light" leftSection={<IconBriefcase size={13} />}
              onClick={() => navigate('/projects')}>
              Add Projects
            </Button>
          </Group>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <SummaryCard
          title="Total Resources"
          value={summary?.totalResources ?? 0}
          icon={<IconUsers size={20} color="#339af0" />}
          onClick={() => navigate('/resources')}
        />
        <SummaryCard
          title="Active Projects"
          value={summary?.activeProjects ?? 0}
          icon={<IconBriefcase size={20} color="#845ef7" />}
          onClick={() => navigate('/projects')}
        />
        <SummaryCard
          title="Overall Utilization"
          value={formatPercent(summary?.overallUtilizationPct ?? 0)}
          icon={<IconFlame size={20} color="#fd7e14" />}
          color={(summary?.overallUtilizationPct ?? 0) > 100 ? 'red' : undefined}
          onClick={() => navigate('/reports/utilization')}
        />
        <SummaryCard
          title="POD-Months in Deficit"
          value={summary?.podMonthsInDeficit ?? 0}
          icon={<IconAlertTriangle size={20} color="#fa5252" />}
          color={(summary?.podMonthsInDeficit ?? 0) > 0 ? 'red' : 'green'}
          onClick={() => navigate('/reports/capacity-gap')}
        />
      </SimpleGrid>

      {!capDemLoading && capDemChart.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card withBorder padding="md">
            <ExportableChart title="Capacity vs Demand - Full Year">
              <Title order={4} mb={4}>Capacity vs Demand — Full Year</Title>
              <Text size="xs" c="dimmed" mb="sm">All PODs combined — hours</Text>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={capDemChart} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(value: number) => formatHours(value)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="capacity" stroke="#1e40af" strokeWidth={2.5} dot={{ r: 3 }} name="Capacity" />
                  <Line type="monotone" dataKey="demand" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} name="Demand" />
                </LineChart>
              </ResponsiveContainer>
            </ExportableChart>
          </Card>

          {hireChart.length > 0 && (
            <Card withBorder padding="md">
              <ExportableChart title="New Hires Needed - Full Year">
                <Title order={4} mb={4}>New Hires Needed — Full Year</Title>
                <Text size="xs" c="dimmed" mb="sm">Incremental FTE per month by role</Text>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hireChart} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(value: number, name: string) => [`${(value as number).toFixed(1)} FTE`, formatRole(name as string)]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value: string) => formatRole(value)} />
                    {hireRoles.map(role => (
                      <Bar key={role} dataKey={role} stackId="s" fill={ROLE_COLORS[role] ?? '#94a3b8'} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ExportableChart>
            </Card>
          )}
        </SimpleGrid>
      )}

      {!heatmapLoading && miniHeatmap.length > 0 && (
        <Card withBorder padding="md">
          <ExportableChart title="Utilization Overview">
          <Title order={4} mb="sm">Utilization Overview</Title>
          <Table.ScrollContainer minWidth={800}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 120 }}>POD</Table.Th>
                  {months.map(m => (
                    <Table.Th key={m} style={{ textAlign: 'center', fontSize: 11, ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : {}) }}>
                      {monthLabels[m] ?? `M${m}`}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {miniHeatmap.map(row => (
                  <Table.Tr key={row.name}>
                    <Table.Td fw={500} style={{ fontSize: 12 }}>{row.name}</Table.Td>
                    {months.map(m => {
                      const val = row.data.get(m) ?? 0;
                      return (
                        <Table.Td
                          key={m}
                          style={{
                            textAlign: 'center',
                            ...(m < currentMonthIndex
                              ? { opacity: 0.5, backgroundColor: pastBg }
                              : { backgroundColor: val > 0 ? getUtilizationBgColor(val, dark) : undefined }),
                          }}
                        >
                          <Text size="xs">{val > 0 ? formatPercent(val) : '-'}</Text>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          </ExportableChart>
        </Card>
      )}

      <Title order={4}>Quick Links</Title>
      <Group>
        <Button variant="light" leftSection={<IconChartBar size={16} />} onClick={() => navigate('/reports/capacity-gap')}>Capacity Gap</Button>
        <Button variant="light" leftSection={<IconFlame size={16} />} onClick={() => navigate('/reports/utilization')}>Utilization Heatmap</Button>
        <Button variant="light" leftSection={<IconChartAreaLine size={16} />} onClick={() => navigate('/reports/capacity-demand')}>Capacity vs Demand</Button>
        <Button variant="light" leftSection={<IconAlertTriangle size={16} />} onClick={() => navigate('/reports/concurrency')}>Concurrency Risk</Button>
        <Button variant="light" leftSection={<IconUserPlus size={16} />} onClick={() => navigate('/reports/hiring-forecast')}>Hiring Forecast</Button>
        <Button variant="light" leftSection={<IconCalendar size={16} />} onClick={() => navigate('/reports/gantt')}>Project Gantt</Button>
      </Group>
    </Stack>
  );
}
