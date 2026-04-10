import React, { useMemo } from 'react';
import {
  Container,
  Title,
  Stack,
  SimpleGrid,
  Card,
  Text,
  Group,
  Badge,
  Progress,
  ThemeIcon,
  Paper,
  Table,
  Tooltip,
  ScrollArea,
} from '@mantine/core';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  IconBriefcase,
  IconCircleCheck,
  IconAlertCircle,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useResources } from '../../api/resources';
import { usePods } from '../../api/pods';
import { useCapacityDemandSummary } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA_HEX, AQUA, AQUA_TINTS, BORDER_STRONG, CHART_COLORS, COLOR_BLUE_DARK, COLOR_ERROR, COLOR_ORANGE, COLOR_ORANGE_ALT, COLOR_SUCCESS, DARK_TEXT_PRIMARY, DEEP_BLUE, DEEP_BLUE_TINTS, FONT_FAMILY, SHADOW, SLATE_700, SURFACE_LIGHT, TEXT_DIM, TEXT_GRAY, TEXT_SUBTLE} from '../../brandTokens';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import { ProjectResponse } from '../../types/project';

// ── Status and Priority Colors ──

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: COLOR_SUCCESS,
  ACTIVE: COLOR_BLUE_DARK,
  IN_DISCOVERY: '#7950f2',
  NOT_STARTED: TEXT_DIM,
  ON_HOLD: COLOR_ORANGE,
  CANCELLED: COLOR_ERROR,
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: COLOR_ERROR,
  P1: COLOR_ORANGE,
  P2: COLOR_BLUE_DARK,
  P3: TEXT_DIM,
};

// ── Type Definitions ──

interface AtRiskProject {
  id: number;
  name: string;
  priority: string;
  status: string;
  owner: string;
  targetDate?: string | null;
  riskReason: string;
}

interface ProjectStatusData {
  status: string;
  count: number;
  fill: string;
}

interface PriorityData {
  priority: string;
  count: number;
  fill: string;
}

interface OwnerWorkloadData {
  owner: string;
  activeProjects: number;
}

// ── Helper Functions ──

const getProjectsCount = (
  projects: ProjectResponse[] | undefined,
  status?: string
): number => {
  if (!projects) return 0;
  if (!status) return projects.length;
  return projects.filter(
    (p) => p.status.toUpperCase() === status.toUpperCase()
  ).length;
};

const isProjectAtRisk = (project: ProjectResponse): boolean => {
  const status = project.status?.toUpperCase();
  if (status === 'ON_HOLD') return true;

  if (project.targetDate) {
    const targetDate = new Date(project.targetDate);
    const today = new Date();
    if (targetDate < today) return true;
  }

  if (project.priority?.toUpperCase() === 'P0') return true;

  return false;
};

const getRiskReason = (project: ProjectResponse): string => {
  const status = project.status?.toUpperCase();
  if (status === 'ON_HOLD') return 'Project on hold';

  if (project.targetDate) {
    const targetDate = new Date(project.targetDate);
    const today = new Date();
    if (targetDate < today) return 'Past target date';
  }

  if (project.priority?.toUpperCase() === 'P0') return 'Critical priority';

  return 'Unknown risk';
};

// ── Main Component ──

export default function PortfolioHealthDashboardPage() {
  const dark = useDarkMode();
  const { data: projects, isLoading: projectsLoading, error: projectsError } =
    useProjects();
  const { data: resources, isLoading: resourcesLoading } = useResources();
  const { data: pods, isLoading: podsLoading } = usePods();
  const { data: capacityDemand, isLoading: capacityLoading } =
    useCapacityDemandSummary();
  const { monthLabels } = useMonthLabels();

  const isLoading =
    projectsLoading || resourcesLoading || podsLoading || capacityLoading;
  const error = projectsError;

  // ── Grid stroke for dark mode ──
  const gridStroke = dark ? '#333' : '#eee';

  // ── KPI Calculations ──
  const kpiData = useMemo(() => {
    if (!projects) {
      return {
        totalProjects: 0,
        activeProjects: 0,
        atRiskProjects: 0,
        completionRate: 0,
      };
    }

    const total = projects.length;
    const active = getProjectsCount(projects, 'ACTIVE');
    const atRisk = projects.filter(isProjectAtRisk).length;
    const completed = getProjectsCount(projects, 'COMPLETED');
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalProjects: total,
      activeProjects: active,
      atRiskProjects: atRisk,
      completionRate: rate,
    };
  }, [projects]);

  // ── Status Distribution ──
  const statusDistribution = useMemo((): ProjectStatusData[] => {
    if (!projects) return [];

    const statusMap: Record<string, number> = {};
    projects.forEach((p) => {
      const status = p.status?.toUpperCase() || 'UNKNOWN';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });

    return Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
      fill: STATUS_COLORS[status] || '#999',
    }));
  }, [projects]);

  // ── Priority Distribution ──
  const priorityDistribution = useMemo((): PriorityData[] => {
    if (!projects) return [];

    const priorityMap: Record<string, number> = {};
    projects.forEach((p) => {
      const priority = p.priority?.toUpperCase() || 'UNKNOWN';
      priorityMap[priority] = (priorityMap[priority] || 0) + 1;
    });

    return Object.entries(priorityMap).map(([priority, count]) => ({
      priority,
      count,
      fill: PRIORITY_COLORS[priority] || '#999',
    }));
  }, [projects]);

  // ── At Risk Projects ──
  const atRiskProjects = useMemo((): AtRiskProject[] => {
    if (!projects) return [];

    return projects
      .filter(isProjectAtRisk)
      .map((p) => ({
        id: p.id,
        name: p.name,
        priority: p.priority || 'UNKNOWN',
        status: p.status || 'UNKNOWN',
        owner: p.owner || 'Unassigned',
        targetDate: p.targetDate,
        riskReason: getRiskReason(p),
      }))
      .sort((a, b) => {
        // Sort by priority: P0, P1, P2, P3
        const priorityOrder: Record<string, number> = {
          P0: 0,
          P1: 1,
          P2: 2,
          P3: 3,
        };
        const aPrio = priorityOrder[a.priority] ?? 4;
        const bPrio = priorityOrder[b.priority] ?? 4;
        return aPrio - bPrio;
      });
  }, [projects]);

  // ── Projects by Status Chart Data ──
  const projectsByStatusChartData = useMemo(() => {
    return statusDistribution.map((item) => ({
      name: item.status,
      value: item.count,
      fill: item.fill,
    }));
  }, [statusDistribution]);

  // ── Capacity Trend Chart Data ──
  const capacityTrendData = useMemo(() => {
    if (!capacityDemand || !monthLabels) return [];

    return capacityDemand.slice(0, 12).map((month, idx) => ({
      month: monthLabels[idx + 1] || `M${idx + 1}`,
      capacity: month.totalCapacityHours || 0,
      demand: month.totalDemandHours || 0,
    }));
  }, [capacityDemand, monthLabels]);

  // ── Owner Workload Chart Data ──
  const ownerWorkloadData = useMemo((): OwnerWorkloadData[] => {
    if (!projects) return [];

    const ownerMap: Record<string, number> = {};
    projects.forEach((p) => {
      if (p.status?.toUpperCase() === 'ACTIVE') {
        const owner = p.owner || 'Unassigned';
        ownerMap[owner] = (ownerMap[owner] || 0) + 1;
      }
    });

    return Object.entries(ownerMap)
      .map(([owner, activeProjects]) => ({
        owner,
        activeProjects,
      }))
      .sort((a, b) => b.activeProjects - a.activeProjects)
      .slice(0, 10); // Top 10 owners
  }, [projects]);

  if (isLoading)
    return (
      <LoadingSpinner
        variant="cards"
        message="Loading portfolio health dashboard..."
      />
    );
  if (error)
    return (
      <PageError context="loading portfolio data" error={error} />
    );

  return (
    <Container size="xl" py="xl" className="page-enter stagger-children">
      <Stack gap="lg">
        {/* ── Header ── */}
        <Group className="slide-in-left">
          <div>
            <Title
              order={2}
              style={{
                fontFamily: FONT_FAMILY,
                color: dark ? '#fff' : DEEP_BLUE,
                fontWeight: 700,
              }}
            >
              Portfolio Health Dashboard
            </Title>
            <Text c="dimmed" size="sm">
              Executive overview of portfolio status, risks, and delivery pipeline
            </Text>
          </div>
        </Group>

        {/* ── KPI Cards Row ── */}
        <SimpleGrid
          cols={{ base: 2, sm: 4 }}
          spacing="md"
          className="stagger-grid"
        >
          {/* Total Projects */}
          <Card withBorder p="md" radius="md" className="chart-reveal">
            <Group gap="md" justify="space-between" mb="xs">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Total Projects
                </Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY }}>
                  {kpiData.totalProjects}
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="blue">
                <IconBriefcase size={22} />
              </ThemeIcon>
            </Group>
          </Card>

          {/* Active Projects */}
          <Card withBorder p="md" radius="md" className="chart-reveal">
            <Group gap="md" justify="space-between" mb="xs">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Active Projects
                </Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY }}>
                  {kpiData.activeProjects}
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="teal">
                <IconCircleCheck size={22} />
              </ThemeIcon>
            </Group>
          </Card>

          {/* At Risk */}
          <Card withBorder p="md" radius="md" className="chart-reveal">
            <Group gap="md" justify="space-between" mb="xs">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  At Risk
                </Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY }}>
                  {kpiData.atRiskProjects}
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="orange">
                <IconAlertCircle size={22} />
              </ThemeIcon>
            </Group>
          </Card>

          {/* Completion Rate */}
          <Card withBorder p="md" radius="md" className="chart-reveal">
            <Group gap="md" justify="space-between" mb="xs">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Completion Rate
                </Text>
                <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY }}>
                  {kpiData.completionRate}%
                </Text>
              </div>
              <ThemeIcon size={40} radius="md" variant="light" color="green">
                <IconTrendingUp size={22} />
              </ThemeIcon>
            </Group>
            <Progress value={kpiData.completionRate} size="sm" color="green" />
          </Card>
        </SimpleGrid>

        {/* ── RAG Status Overview ── */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="stagger-grid">
          {/* Project Status Distribution */}
          <ChartCard title="Project Status Distribution">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={projectsByStatusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value, x, y, textAnchor }) => (
                    <text x={x} y={y} textAnchor={textAnchor} fill={dark ? TEXT_SUBTLE : '#475569'} fontSize={11}>
                      {`${name}: ${value}`}
                    </text>
                  )}
                  labelLine={{ stroke: dark ? '#475569' : TEXT_SUBTLE }}
                >
                  {projectsByStatusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartTooltip
                  contentStyle={{
                    backgroundColor: dark ? DARK_TEXT_PRIMARY : '#fff',
                    border: `1px solid ${dark ? SLATE_700 : BORDER_STRONG}`,
                    borderRadius: '8px',
                    color: dark ? SURFACE_LIGHT : '#0f172a',
                    fontSize: 13,
                  }}
                  formatter={(value) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Priority Distribution */}
          <ChartCard title="Priority Distribution">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={priorityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="count"
                  label={({ priority, count, x, y, textAnchor }) => (
                    <text x={x} y={y} textAnchor={textAnchor} fill={dark ? TEXT_SUBTLE : '#475569'} fontSize={11}>
                      {`${priority}: ${count}`}
                    </text>
                  )}
                  labelLine={{ stroke: dark ? '#475569' : TEXT_SUBTLE }}
                >
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartTooltip
                  contentStyle={{
                    backgroundColor: dark ? DARK_TEXT_PRIMARY : '#fff',
                    border: `1px solid ${dark ? SLATE_700 : BORDER_STRONG}`,
                    borderRadius: '8px',
                    color: dark ? SURFACE_LIGHT : '#0f172a',
                    fontSize: 13,
                  }}
                  formatter={(value) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </SimpleGrid>

        {/* ── Risk Register ── */}
        <ChartCard title="Risk Register">
          <ScrollArea>
            <Table fz="xs" highlightOnHover striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ backgroundColor: dark ? '#1f2937' : DEEP_BLUE, color: 'white' }}>
                    Project Name
                  </Table.Th>
                  <Table.Th style={{ backgroundColor: dark ? '#1f2937' : DEEP_BLUE, color: 'white' }}>
                    Priority
                  </Table.Th>
                  <Table.Th style={{ backgroundColor: dark ? '#1f2937' : DEEP_BLUE, color: 'white' }}>
                    Status
                  </Table.Th>
                  <Table.Th style={{ backgroundColor: dark ? '#1f2937' : DEEP_BLUE, color: 'white' }}>
                    Owner
                  </Table.Th>
                  <Table.Th style={{ backgroundColor: dark ? '#1f2937' : DEEP_BLUE, color: 'white' }}>
                    Target Date
                  </Table.Th>
                  <Table.Th style={{ backgroundColor: dark ? '#1f2937' : DEEP_BLUE, color: 'white' }}>
                    Risk Reason
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {atRiskProjects.length > 0 ? (
                  atRiskProjects.map((project) => (
                    <Table.Tr key={project.id}>
                      <Table.Td fw={600}>{project.name}</Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          color={PRIORITY_COLORS[project.priority] || '#999'}
                        >
                          {project.priority}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          color={STATUS_COLORS[project.status] || '#999'}
                        >
                          {project.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{project.owner}</Table.Td>
                      <Table.Td>
                        {project.targetDate
                          ? new Date(project.targetDate).toLocaleDateString()
                          : '–'}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="orange" fw={500}>
                          {project.riskReason}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                      <Text c="dimmed" size="sm">
                        No at-risk projects
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </ChartCard>

        {/* ── Delivery Pipeline ── */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="stagger-grid">
          {/* Projects by Status */}
          <ChartCard title="Projects by Status">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={projectsByStatusChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : TEXT_GRAY }}
                  tickLine={false}
                  axisLine={{ stroke: dark ? SLATE_700 : BORDER_STRONG }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : TEXT_GRAY }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartTooltip
                  contentStyle={{
                    backgroundColor: dark ? DARK_TEXT_PRIMARY : '#fff',
                    border: `1px solid ${dark ? SLATE_700 : BORDER_STRONG}`,
                    borderRadius: '8px',
                    color: dark ? SURFACE_LIGHT : '#0f172a',
                    fontSize: 13,
                  }}
                />
                <Bar animationDuration={600} dataKey="value" fill={AQUA_HEX} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Capacity Trend */}
          <ChartCard title="Capacity Trend">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={capacityTrendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="capacityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AQUA_HEX} stopOpacity={dark ? 0.35 : 0.45} />
                    <stop offset="95%" stopColor={AQUA_HEX} stopOpacity={dark ? 0.05 : 0.1} />
                  </linearGradient>
                  <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_ORANGE_ALT} stopOpacity={dark ? 0.5 : 0.4} />
                    <stop offset="95%" stopColor={COLOR_ORANGE_ALT} stopOpacity={dark ? 0.05 : 0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : TEXT_GRAY, fontFamily: 'inherit' }}
                  tickLine={false}
                  axisLine={{ stroke: dark ? SLATE_700 : BORDER_STRONG }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : TEXT_GRAY, fontFamily: 'inherit' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <RechartTooltip
                  contentStyle={{
                    backgroundColor: dark ? DARK_TEXT_PRIMARY : '#fff',
                    border: `1px solid ${dark ? SLATE_700 : BORDER_STRONG}`,
                    borderRadius: '8px',
                    color: dark ? SURFACE_LIGHT : '#0f172a',
                    fontSize: 13,
                  }}
                  formatter={(value: number) =>
                    value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: dark ? TEXT_SUBTLE : TEXT_GRAY }}
                />
                <Area
                  type="monotone"
                  dataKey="capacity"
                  fill="url(#capacityGrad)"
                  stroke={AQUA_HEX}
                  strokeWidth={2}
                  name="Capacity"
                  dot={false}
                  activeDot={{ r: 4, fill: AQUA }}
                />
                <Area
                  type="monotone"
                  dataKey="demand"
                  fill="url(#demandGrad)"
                  stroke={COLOR_ORANGE_ALT}
                  strokeWidth={2}
                  name="Demand"
                  dot={false}
                  activeDot={{ r: 4, fill: COLOR_ORANGE_ALT }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </SimpleGrid>

        {/* ── Owner Workload ── */}
        <ChartCard title="Owner Workload (Active Projects)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={ownerWorkloadData}
              margin={{ top: 5, right: 16, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="owner"
                angle={-35}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : TEXT_GRAY }}
                tickLine={false}
                axisLine={{ stroke: dark ? SLATE_700 : BORDER_STRONG }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : TEXT_GRAY }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <RechartTooltip
                contentStyle={{
                  backgroundColor: dark ? DARK_TEXT_PRIMARY : '#fff',
                  border: `1px solid ${dark ? SLATE_700 : BORDER_STRONG}`,
                  borderRadius: '8px',
                  color: dark ? SURFACE_LIGHT : '#0f172a',
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: dark ? TEXT_SUBTLE : TEXT_GRAY }} />
              <Bar animationDuration={600} dataKey="activeProjects" fill={AQUA_HEX} name="Active Projects" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Stack>
    </Container>
  );
}
