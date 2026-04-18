import React, { useMemo } from 'react';
import {
  Title,
  Stack,
  SimpleGrid,
  Card,
  Text,
  Group,
  Badge,
  Table,
  Tooltip,
  ThemeIcon,
  RingProgress,
  ScrollArea,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { IconCircleCheck, IconCircleX, IconAlertCircle, IconCircle, IconChartBar } from '@tabler/icons-react';
import { AQUA_HEX, DEEP_BLUE_HEX, COLOR_ERROR, COLOR_SUCCESS, COLOR_ORANGE, DARK_CARD, DEEP_BLUE, SHADOW } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { EmptyState } from '../../components/ui';
import { useProjects } from '../../api/projects';
import { useProductivityMetrics, useDoraMetrics } from '../../api/reports';
import { ProjectResponse } from '../../types/project';

// Mantine color names — used for Badge color prop so variant="light" tinting works correctly
const LEVEL_BADGE_COLORS: Record<string, string> = {
  elite: 'teal',
  high:  'blue',
  medium:'yellow',
  low:   'red',
};

// Hex values — used for Recharts Cell fill and RingProgress
const STATUS_COLORS: Record<string, string> = {
  COMPLETED:    AQUA_HEX,     // teal  — done
  ACTIVE:       '#228be6',    // blue  — in flight
  IN_DISCOVERY: '#7950f2',    // violet — scoping
  NOT_STARTED:  '#adb5bd',    // mid-gray — not yet started (was TEXT_DIM = too light)
  ON_HOLD:      COLOR_ORANGE, // orange
  CANCELLED:    COLOR_ERROR,  // red
};

// Mantine color names for Badge
const STATUS_BADGE_COLORS: Record<string, string> = {
  COMPLETED:    'teal',
  ACTIVE:       'blue',
  IN_DISCOVERY: 'violet',
  NOT_STARTED:  'gray',
  ON_HOLD:      'orange',
  CANCELLED:    'red',
};

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  P0: 'red',
  P1: 'orange',
  P2: 'yellow',
  P3: 'blue',
};

interface DoraMetric {
  value: number | string;
  level: string;
  unit: string;
}

// @ts-expect-error -- unused
interface _DoraMetrics {
  deploymentFrequency: DoraMetric;
  leadTimeForChanges: DoraMetric;
  changeFailureRate: DoraMetric;
  meanTimeToRecovery: DoraMetric;
}

// @ts-expect-error -- unused
interface _ProductivityMetrics {
  output?: {
    completionRate?: number;
    statusBreakdown?: Record<string, number>;
  };
}

export const DeliveryPredictabilityPage: React.FC = () => {
  const isDark = useDarkMode();
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: _productivityData, isLoading: productivityLoading } = useProductivityMetrics(6);
  const { data: doraData, isLoading: doraLoading } = useDoraMetrics(6);

  const isLoading = projectsLoading || productivityLoading || doraLoading;
  const error = projectsError;

  const projects = useMemo(() => (Array.isArray(projectsData) ? projectsData : []), [projectsData]);

  // Derived data
  const completionStats = useMemo(() => {
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const total = projects.length;
    const rate = total > 0 ? (completed / total) * 100 : 0;
    return { completed, total, rate };
  }, [projects]);

  const statusBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    projects.forEach((p) => {
      breakdown[p.status] = (breakdown[p.status] || 0) + 1;
    });
    return Object.entries(breakdown).map(([status, count]) => ({
      name: status,
      value: count,
      fill: STATUS_COLORS[status] || '#999',
    }));
  }, [projects]);

  const durationDistribution = useMemo(() => {
    const buckets = {
      '1-3mo': 0,
      '4-6mo': 0,
      '7-9mo': 0,
      '10-12mo': 0,
      '12+mo': 0,
    };
    projects.forEach((p) => {
      const dur = p.durationMonths || 0;
      if (dur <= 3) buckets['1-3mo']++;
      else if (dur <= 6) buckets['4-6mo']++;
      else if (dur <= 9) buckets['7-9mo']++;
      else if (dur <= 12) buckets['10-12mo']++;
      else buckets['12+mo']++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [projects]);

  const projectsByClient = useMemo(() => {
    const clientMap: Record<string, number> = {};
    projects.forEach((p) => {
      if (p.client) {
        clientMap[p.client] = (clientMap[p.client] || 0) + 1;
      }
    });
    return Object.entries(clientMap).map(([client, count]) => ({ client, count }));
  }, [projects]);

  const deliveryTrend = useMemo(() => {
    const monthMap: Record<string, { created: number; completed: number }> = {};

    projects.forEach((p) => {
      const createdMonth = p.createdAt ? new Date(p.createdAt).toISOString().substring(0, 7) : null;
      const completedMonth =
        p.status === 'COMPLETED' && p.targetDate ? new Date(p.targetDate).toISOString().substring(0, 7) : null;

      if (createdMonth) {
        if (!monthMap[createdMonth]) monthMap[createdMonth] = { created: 0, completed: 0 };
        monthMap[createdMonth].created++;
      }

      if (completedMonth) {
        if (!monthMap[completedMonth]) monthMap[completedMonth] = { created: 0, completed: 0 };
        monthMap[completedMonth].completed++;
      }
    });

    return Object.entries(monthMap)
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { year: '2-digit', month: 'short' }),
        created: data.created,
        completed: data.completed,
      }));
  }, [projects]);

  const sortedProjects = useMemo(() => {
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return [...projects].sort((a, b) => {
      const priorityDiff = (priorityOrder[a.priority] ?? 999) - (priorityOrder[b.priority] ?? 999);
      if (priorityDiff !== 0) return priorityDiff;
      const dateA = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
      const dateB = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [projects]);

  const getDeliveryStatus = (project: ProjectResponse) => {
    if (project.status === 'COMPLETED') {
      return { icon: IconCircleCheck, label: 'On Track', color: 'green' };
    }
    if (project.status === 'CANCELLED') {
      return { icon: IconCircleX, label: 'Cancelled', color: 'red' };
    }
    if (project.targetDate) {
      const targetTime = new Date(project.targetDate).getTime();
      const now = Date.now();
      if (targetTime < now && project.status !== 'COMPLETED') {
        return { icon: IconAlertCircle, label: 'Late', color: 'yellow' };
      }
    }
    return { icon: IconCircle, label: 'On Track', color: 'blue' };
  };

  const completionRateColor = useMemo(() => {
    if (completionStats.rate > 70) return COLOR_SUCCESS;
    if (completionStats.rate > 40) return '#fcc419';
    return COLOR_ERROR;
  }, [completionStats.rate]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <PageError error={error} />;
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<IconChartBar size={40} stroke={1.5} />}
        title="No projects to analyse"
        description="Add projects to your portfolio to see delivery predictability, commitment tracking, and trend analytics here."
      />
    );
  }

  return (
    <Stack gap="lg" p="xl">
      {/* Header */}
      <div>
        <Title order={1} mb="xs" style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
          Delivery Predictability
        </Title>
        <Text size="sm" c="dimmed">
          Confidence scoring, commitment tracking, and delivery analytics
        </Text>
      </div>

      {/* DORA Snapshot */}
      {doraData && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Card shadow={SHADOW.card} padding="lg" radius="md" bg={isDark ? DARK_CARD : 'white'}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Deployment Frequency
              </Text>
              <Group justify="space-between" align="flex-end">
                <div>
                  <Text size="lg" fw={700}>
                    {doraData.deploymentFrequency.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {doraData.deploymentFrequency.unit}
                  </Text>
                </div>
                <Badge color={LEVEL_BADGE_COLORS[doraData.deploymentFrequency.level] ?? 'gray'} variant="light">
                  {doraData.deploymentFrequency.level}
                </Badge>
              </Group>
            </Stack>
          </Card>

          <Card shadow={SHADOW.card} padding="lg" radius="md" bg={isDark ? DARK_CARD : 'white'}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Lead Time
              </Text>
              <Group justify="space-between" align="flex-end">
                <div>
                  <Text size="lg" fw={700}>
                    {doraData.leadTimeForChanges.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {doraData.leadTimeForChanges.unit}
                  </Text>
                </div>
                <Badge color={LEVEL_BADGE_COLORS[doraData.leadTimeForChanges.level] ?? 'gray'} variant="light">
                  {doraData.leadTimeForChanges.level}
                </Badge>
              </Group>
            </Stack>
          </Card>

          <Card shadow={SHADOW.card} padding="lg" radius="md" bg={isDark ? DARK_CARD : 'white'}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Change Failure Rate
              </Text>
              <Group justify="space-between" align="flex-end">
                <div>
                  <Text size="lg" fw={700}>
                    {doraData.changeFailureRate.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {doraData.changeFailureRate.unit}
                  </Text>
                </div>
                <Badge color={LEVEL_BADGE_COLORS[doraData.changeFailureRate.level] ?? 'gray'} variant="light">
                  {doraData.changeFailureRate.level}
                </Badge>
              </Group>
            </Stack>
          </Card>

          <Card shadow={SHADOW.card} padding="lg" radius="md" bg={isDark ? DARK_CARD : 'white'}>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                MTTR
              </Text>
              <Group justify="space-between" align="flex-end">
                <div>
                  <Text size="lg" fw={700}>
                    {doraData.meanTimeToRecovery.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {doraData.meanTimeToRecovery.unit}
                  </Text>
                </div>
                <Badge color={LEVEL_BADGE_COLORS[doraData.meanTimeToRecovery.level] ?? 'gray'} variant="light">
                  {doraData.meanTimeToRecovery.level}
                </Badge>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>
      )}

      {/* Delivery Confidence */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ChartCard title="Completion Rate">
          <Group justify="center" py={40}>
            <RingProgress
              sections={[{ value: completionStats.rate, color: completionRateColor }]}
              label={
                <Stack gap={2} align="center">
                  <Text fw={700} size="xl">
                    {completionStats.rate.toFixed(0)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    {completionStats.completed}/{completionStats.total}
                  </Text>
                </Stack>
              }
              size={200}
              thickness={8}
            />
          </Group>
        </ChartCard>

        <ChartCard title="Status Distribution">
          <div role="img" aria-label="Pie chart">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusBreakdown}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {statusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartTooltip formatter={(value) => `${value} projects`} />
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(value) => value.replace(/_/g, ' ')}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>
        </ChartCard>
      </SimpleGrid>

      {/* Commitment Tracking */}
      <ChartCard title="Commitment Tracking">
        <ScrollArea>
          <Table striped highlightOnHover miw={800}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                <Table.Th>Priority</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Target Date</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>On Track</Table.Th>
                <Table.Th>Duration</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedProjects.map((project) => {
                const deliveryStatus = getDeliveryStatus(project);
                const Icon = deliveryStatus.icon;
                return (
                  <Table.Tr key={project.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">
                        {project.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={PRIORITY_BADGE_COLORS[project.priority] ?? 'gray'} variant="light">
                        {project.priority}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{project.owner || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_BADGE_COLORS[project.status] ?? 'gray'} variant="light">
                        {project.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={deliveryStatus.label}>
                        <ThemeIcon color={deliveryStatus.color} variant="light" radius="md">
                          <Icon size={16} />
                        </ThemeIcon>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{project.durationMonths}mo</Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </ChartCard>

      {/* Lead Time Analytics */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ChartCard title="Duration Distribution">
          <div role="img" aria-label="Bar chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={durationDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#ddd'} />
              <XAxis dataKey="range" stroke={isDark ? '#999' : '#666'} />
              <YAxis stroke={isDark ? '#999' : '#666'} />
              <RechartTooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}` }} />
              <Bar animationDuration={600} dataKey="count" fill={AQUA_HEX} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Projects by Client">
          <div role="img" aria-label="Area chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectsByClient} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#ddd'} />
              <XAxis type="number" stroke={isDark ? '#999' : '#666'} />
              <YAxis dataKey="client" type="category" width={100} stroke={isDark ? '#999' : '#666'} />
              <RechartTooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}` }} />
              <Bar animationDuration={600} dataKey="count" fill={DEEP_BLUE_HEX} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </ChartCard>
      </SimpleGrid>

      {/* Delivery Trend */}
      <ChartCard title="Delivery Trend">
        <div role="img" aria-label="Area chart">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={deliveryTrend}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={AQUA_HEX} stopOpacity={0.8} />
                <stop offset="95%" stopColor={AQUA_HEX} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={DEEP_BLUE_HEX} stopOpacity={0.8} />
                <stop offset="95%" stopColor={DEEP_BLUE_HEX} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#ddd'} />
            <XAxis dataKey="month" stroke={isDark ? '#999' : '#666'} />
            <YAxis stroke={isDark ? '#999' : '#666'} />
            <RechartTooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#333' : '#ddd'}` }} />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              stroke={AQUA_HEX}
              fillOpacity={1}
              fill="url(#colorCreated)"
              name="Created"
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke={DEEP_BLUE_HEX}
              fillOpacity={1}
              fill="url(#colorCompleted)"
              name="Completed"
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>
    </Stack>
  );
};

export default DeliveryPredictabilityPage;
