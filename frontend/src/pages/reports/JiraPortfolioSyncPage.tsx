import React, { useMemo } from 'react';
import {
  Title,
  Stack,
  SimpleGrid,
  Card,
  Text,
  Group,
  Badge,
  Paper,
  Table,
  Tooltip,
  ThemeIcon,
  Progress,
  Alert,
  ScrollArea,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconTrendingUp,
  IconAlertTriangle,
  IconPackage,
  IconLink,
} from '@tabler/icons-react';

import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, CHART_COLORS, AQUA_TINTS, DEEP_BLUE_TINTS } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { EmptyState } from '../../components/ui';
import { useProjects } from '../../api/projects';
import { useProductivityMetrics } from '../../api/reports';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#51cf66',
  ACTIVE: DEEP_BLUE,
  IN_DISCOVERY: '#b197fc',
  NOT_STARTED: '#a6adba',
  ON_HOLD: '#ff922b',
  CANCELLED: '#ff6b6b',
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#ff6b6b',
  P1: '#ff922b',
  P2: DEEP_BLUE,
  P3: '#a6adba',
};

export default function JiraPortfolioSyncPage() {
  const dark = useDarkMode();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useProductivityMetrics();

  const isLoading = projectsLoading || metricsLoading;
  const error = projectsError || metricsError;

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!projects) return null;

    const totalProjects = projects.length;
    const activeInFlight = projects.filter(
      (p) => p.status === 'ACTIVE' || p.status === 'IN_DISCOVERY'
    ).length;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const staleProjects = projects.filter(
      (p) =>
        (p.status === 'ACTIVE' || p.status === 'IN_DISCOVERY') &&
        p.createdAt &&
        new Date(p.createdAt) < ninetyDaysAgo
    ).length;

    const completionRate = metrics?.output?.completedProjects
      ? (metrics.output.completedProjects / metrics.output.totalProjects) * 100
      : 0;

    return {
      totalProjects,
      activeInFlight,
      staleProjects,
      completionRate,
    };
  }, [projects, metrics]);

  // Prepare Status Breakdown data for pie chart
  const statusBreakdownData = useMemo(() => {
    if (!metrics?.output?.statusBreakdown) return [];
    return Object.entries(metrics.output.statusBreakdown).map(([status, count]) => ({
      name: status,
      value: count as number,
    }));
  }, [metrics]);

  // Prepare Priority Breakdown data for pie chart
  const priorityBreakdownData = useMemo(() => {
    if (!metrics?.output?.priorityBreakdown) return [];
    return Object.entries(metrics.output.priorityBreakdown).map(([priority, count]) => ({
      name: priority,
      value: count as number,
    }));
  }, [metrics]);

  // Detect stale projects
  const staleProjectsList = useMemo(() => {
    if (!projects) return [];

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    return projects
      .filter(
        (p) =>
          (p.status === 'ACTIVE' || p.status === 'IN_DISCOVERY') &&
          p.createdAt &&
          new Date(p.createdAt) < sixtyDaysAgo
      )
      .map((p) => {
        const daysCreated = Math.floor(
          (Date.now() - new Date(p.createdAt!).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          ...p,
          daysCreated,
        };
      })
      .sort((a, b) => b.daysCreated - a.daysCreated);
  }, [projects]);

  // Prepare delivery tracker data (projects by owner)
  const deliveryTrackerData = useMemo(() => {
    if (!projects) return [];

    const ownerMap: Record<
      string,
      {
        COMPLETED: number;
        ACTIVE: number;
        other: number;
      }
    > = {};

    projects.forEach((p) => {
      if (!ownerMap[p.owner]) {
        ownerMap[p.owner] = { COMPLETED: 0, ACTIVE: 0, other: 0 };
      }

      if (p.status === 'COMPLETED') {
        ownerMap[p.owner].COMPLETED += 1;
      } else if (p.status === 'ACTIVE') {
        ownerMap[p.owner].ACTIVE += 1;
      } else {
        ownerMap[p.owner].other += 1;
      }
    });

    return Object.entries(ownerMap).map(([owner, counts]) => ({
      owner,
      ...counts,
    }));
  }, [projects]);

  // Prepare freshness timeline data (projects by creation month)
  const freshnessTimelineData = useMemo(() => {
    if (!projects) return [];

    const monthMap: Record<string, number> = {};

    projects.forEach((p) => {
      if (p.createdAt) {
        const date = new Date(p.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
      }
    });

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month,
        projects: count,
      }));
  }, [projects]);

  if (isLoading) {
    return (
      <Stack align="center" justify="center" style={{ minHeight: '60vh' }}>
        <LoadingSpinner />
      </Stack>
    );
  }

  if (error) {
    return <PageError error="Failed to load portfolio sync data" />;
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={<IconLink size={40} stroke={1.5} />}
        title="No projects to sync"
        description="Add projects to the portfolio to see Jira sync status, coverage metrics, and delivery analytics."
      />
    );
  }

  return (
    <Stack gap="xl" p="lg" style={{ fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <div>
        <Title order={1} size="h1" fw={700}>
          Jira ↔ Portfolio Sync
        </Title>
        <Text c="dimmed" size="sm" mt="xs">
          Track planned vs actual delivery, detect stale projects, and monitor sync health
        </Text>
      </div>

      {/* Sync Health KPIs */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {/* Projects Tracked */}
        <Card withBorder p="md" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Projects Tracked
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="blue">
              <IconPackage size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} style={{ color: DEEP_BLUE }}>
            {kpis?.totalProjects || 0}
          </Text>
        </Card>

        {/* Active / In Flight */}
        <Card withBorder p="md" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Active / In Flight
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="cyan">
              <IconTrendingUp size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} style={{ color: AQUA }}>
            {kpis?.activeInFlight || 0}
          </Text>
        </Card>

        {/* Stale Projects */}
        <Card withBorder p="md" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Stale Projects
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="orange">
              <IconAlertTriangle size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} style={{ color: '#ff922b' }}>
            {kpis?.staleProjects || 0}
          </Text>
        </Card>

        {/* Completion Rate */}
        <Card withBorder p="md" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Completion Rate
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="green">
              <IconCircleCheck size={18} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} style={{ color: '#51cf66' }}>
            {Math.round(kpis?.completionRate || 0)}%
          </Text>
        </Card>
      </SimpleGrid>

      {/* Planned vs Actual */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {/* Status Breakdown */}
        <ChartCard title="Status Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusBreakdownData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {statusBreakdownData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={STATUS_COLORS[entry.name] || '#999'} />
                ))}
              </Pie>
              <RechartTooltip />
            </PieChart>
          </ResponsiveContainer>
          <Group justify="center" mt="md" gap="lg" wrap="wrap">
            {statusBreakdownData.map((entry) => (
              <Group key={entry.name} gap="xs">
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[entry.name] || '#999',
                  }}
                />
                <Text size="xs">{entry.name}</Text>
              </Group>
            ))}
          </Group>
        </ChartCard>

        {/* Priority Mix */}
        <ChartCard title="Priority Mix">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={priorityBreakdownData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {priorityBreakdownData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={PRIORITY_COLORS[entry.name] || '#999'} />
                ))}
              </Pie>
              <RechartTooltip />
            </PieChart>
          </ResponsiveContainer>
          <Group justify="center" mt="md" gap="lg" wrap="wrap">
            {priorityBreakdownData.map((entry) => (
              <Group key={entry.name} gap="xs">
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: PRIORITY_COLORS[entry.name] || '#999',
                  }}
                />
                <Text size="xs">{entry.name}</Text>
              </Group>
            ))}
          </Group>
        </ChartCard>
      </SimpleGrid>

      {/* Stale Project Detection */}
      <ChartCard title="Stale Project Detection">
        <Stack gap="md">
          {staleProjectsList.length > 5 && (
            <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Warning">
              ⚠️ {staleProjectsList.length} projects may need status updates
            </Alert>
          )}

          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Project Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Owner</Table.Th>
                  <Table.Th>Created Date</Table.Th>
                  <Table.Th>Days Since Creation</Table.Th>
                  <Table.Th>Client</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {staleProjectsList.length > 0 ? (
                  staleProjectsList.map((project) => (
                    <Table.Tr key={project.id}>
                      <Table.Td fw={500}>{project.name}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={project.status === 'ACTIVE' ? 'blue' : 'violet'}>
                          {project.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light">
                          {project.priority}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{project.owner}</Table.Td>
                      <Table.Td>
                        {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={`Created on ${project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}`}>
                          <Text size="sm">{project.daysCreated} days</Text>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>{project.client || 'N/A'}</Table.Td>
                    </Table.Tr>
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={7} ta="center">
                      <Text c="dimmed" size="sm">
                        No stale projects detected
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </ChartCard>

      {/* Delivery Tracker */}
      <ChartCard title="Delivery Tracker">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={deliveryTrackerData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="owner"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis label={{ value: 'Project Count', angle: -90, position: 'insideLeft' }} />
            <RechartTooltip />
            <Bar dataKey="COMPLETED" stackId="a" fill="#51cf66" name="Completed" />
            <Bar dataKey="ACTIVE" stackId="a" fill={DEEP_BLUE} name="Active" />
            <Bar dataKey="other" stackId="a" fill="#a6adba" name="Other" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Project Freshness Timeline */}
      <ChartCard title="Project Freshness Timeline">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={freshnessTimelineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis label={{ value: 'Projects Created', angle: -90, position: 'insideLeft' }} />
            <RechartTooltip />
            <Bar dataKey="projects" fill={AQUA} name="Projects Created" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </Stack>
  );
}
