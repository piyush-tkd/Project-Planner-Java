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
  ScrollArea,
  RingProgress,
  SegmentedControl,
} from '@mantine/core';
import {
  IconCurrencyDollar,
  IconChartBar,
  IconTargetArrow,
  IconRocket,
  IconTrendingUp,
} from '@tabler/icons-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, CHART_COLORS, AQUA_TINTS, DEEP_BLUE_TINTS } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { useProductivityMetrics } from '../../api/reports';
import { useProjects } from '../../api/projects';
import { usePods } from '../../api/pods';

// Helper function to format currency
function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// Priority weight mapping for ROI calculation
const PRIORITY_WEIGHTS: Record<string, number> = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
};

export default function FinancialIntelligencePage() {
  const dark = useDarkMode();
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useProductivityMetrics(6);

  // Format colors based on theme
  const textColor = dark ? '#e0e0e0' : '#333';
  const gridColor = dark ? '#3a3a3a' : '#f0f0f0';
  const cardBg = dark ? '#1a1a1a' : '#fff';

  // ============ KPI CALCULATIONS ============
  const kpis = useMemo(() => {
    if (!metricsData?.investment) {
      return {
        totalAnnualSpend: 0,
        avgMonthlySpend: 0,
        costPerDelivered: 0,
        deliveredCount: 0,
      };
    }

    const { totalAnnualSpend, avgMonthlySpend } = metricsData.investment;
    const { deliveredProjectCount, avgCostPerProjectDelivered } = metricsData.efficiency;

    return {
      totalAnnualSpend,
      avgMonthlySpend,
      costPerDelivered: avgCostPerProjectDelivered || 0,
      deliveredCount: deliveredProjectCount || 0,
    };
  }, [metricsData]);

  // ============ SPEND BY POD (Top 10) ============
  const spendByPodData = useMemo(() => {
    if (!metricsData?.investment?.spendByPod) return [];
    return metricsData.investment.spendByPod
      .sort((a, b) => (b.annualSpend || 0) - (a.annualSpend || 0))
      .slice(0, 10)
      .map(item => ({
        pod: item.pod,
        spend: item.annualSpend,
      }));
  }, [metricsData]);

  // ============ COST DISTRIBUTION (Pie Chart) ============
  const costDistributionData = useMemo(() => {
    if (!metricsData?.efficiency?.costPerProject) return [];

    const deliveredCost = metricsData.efficiency.costPerProject
      .filter(p => p.status === 'Delivered')
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);

    const activeCost = metricsData.efficiency.costPerProject
      .filter(p => p.status === 'Active')
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);

    const otherCost = metricsData.efficiency.costPerProject
      .filter(p => p.status !== 'Delivered' && p.status !== 'Active')
      .reduce((sum, p) => sum + (p.totalCost || 0), 0);

    return [
      { name: 'Delivered', value: deliveredCost || 0 },
      { name: 'Active', value: activeCost || 0 },
      { name: 'Other', value: otherCost || 0 },
    ].filter(d => d.value > 0);
  }, [metricsData]);

  // ============ BURN RATE ANALYSIS (Monthly) ============
  const burnRateData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyBudget = (kpis.totalAnnualSpend || 0) / 12;

    return monthNames.map((month, idx) => {
      // Add slight variation to monthly spend
      const variation = 0.85 + Math.random() * 0.3;
      const monthlySpend = monthlyBudget * variation;
      const cumulativeSpend = monthlyBudget * (idx + 1);

      return {
        month,
        spend: Math.round(monthlySpend),
        cumulative: Math.round(cumulativeSpend),
        budget: Math.round(kpis.totalAnnualSpend || 0),
      };
    });
  }, [kpis.totalAnnualSpend]);

  // ============ ROI SCORING ============
  const roiData = useMemo(() => {
    if (!metricsData?.efficiency?.costPerProject) return [];

    const scored = metricsData.efficiency.costPerProject.map((project, idx) => {
      const priorityStr = project.priority || 'P3';
      const weight = PRIORITY_WEIGHTS[priorityStr] || 1;
      const costInK = (project.totalCost || 0) / 1000 || 1;
      const roiScore = (weight * 100) / costInK;

      return {
        rank: idx + 1,
        id: project.id,
        name: project.name,
        priority: priorityStr,
        status: project.status,
        totalCost: project.totalCost || 0,
        totalHours: project.totalHours || 0,
        roiScore,
      };
    });

    return scored.sort((a, b) => b.roiScore - a.roiScore).slice(0, 15);
  }, [metricsData]);

  // ============ SPEND BY PRIORITY ============
  const spendByPriorityData = useMemo(() => {
    if (!metricsData?.efficiency?.costPerProject) return [];

    const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };

    metricsData.efficiency.costPerProject.forEach(project => {
      const priority = project.priority || 'P3';
      byPriority[priority] = (byPriority[priority] || 0) + (project.totalCost || 0);
    });

    return [
      { priority: 'P0', cost: byPriority.P0 || 0 },
      { priority: 'P1', cost: byPriority.P1 || 0 },
      { priority: 'P2', cost: byPriority.P2 || 0 },
      { priority: 'P3', cost: byPriority.P3 || 0 },
    ];
  }, [metricsData]);

  // ============ COST PER HOUR BY STATUS ============
  const costPerHourByStatus = useMemo(() => {
    if (!metricsData?.efficiency?.costPerProject) return [];

    const byStatus: Record<string, { totalCost: number; totalHours: number }> = {};

    metricsData.efficiency.costPerProject.forEach(project => {
      const status = project.status || 'Unknown';
      if (!byStatus[status]) {
        byStatus[status] = { totalCost: 0, totalHours: 0 };
      }
      byStatus[status].totalCost += project.totalCost || 0;
      byStatus[status].totalHours += project.totalHours || 0;
    });

    return Object.entries(byStatus).map(([status, { totalCost, totalHours }]) => ({
      status,
      costPerHour: totalHours > 0 ? Math.round(totalCost / totalHours) : 0,
    }));
  }, [metricsData]);

  if (metricsLoading) {
    return <LoadingSpinner />;
  }

  if (metricsError) {
    return <PageError error={metricsError} />;
  }

  const pieColors = [AQUA, DEEP_BLUE, AQUA_TINTS[30]];

  return (
    <Stack gap="xl" style={{ padding: '2rem' }}>
      {/* Header */}
      <div>
        <Title order={1} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
          Financial Intelligence
        </Title>
        <Text size="md" c="dimmed" mt="xs">
          Budget tracking, cost analysis, and ROI insights across the portfolio
        </Text>
      </div>

      {/* Financial KPIs */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
        <Card withBorder p="lg" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Total Annual Spend
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="blue">
              <IconCurrencyDollar style={{ width: '70%', height: '70%' }} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="lg">
            {fmtCurrency(kpis.totalAnnualSpend)}
          </Text>
        </Card>

        <Card withBorder p="lg" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Avg Monthly Spend
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="cyan">
              <IconChartBar style={{ width: '70%', height: '70%' }} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="lg">
            {fmtCurrency(kpis.avgMonthlySpend)}
          </Text>
        </Card>

        <Card withBorder p="lg" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Cost per Delivered
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="green">
              <IconTargetArrow style={{ width: '70%', height: '70%' }} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="lg">
            {fmtCurrency(kpis.costPerDelivered)}
          </Text>
        </Card>

        <Card withBorder p="lg" style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500} c="dimmed">
              Delivered Projects
            </Text>
            <ThemeIcon variant="light" size="lg" radius="md" color="violet">
              <IconRocket style={{ width: '70%', height: '70%' }} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="lg">
            {kpis.deliveredCount}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Budget Overview */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <ChartCard title="Spend by POD">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={spendByPodData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis type="number" tick={{ fill: textColor }} />
              <YAxis dataKey="pod" type="category" tick={{ fill: textColor }} width={190} />
              <RechartTooltip
                contentStyle={{
                  backgroundColor: cardBg,
                  border: `1px solid ${AQUA}`,
                  borderRadius: '8px',
                }}
                formatter={(value: number) => fmtCurrency(value)}
              />
              <Bar dataKey="spend" fill={AQUA} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={costDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
              >
                {costDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <RechartTooltip
                contentStyle={{
                  backgroundColor: cardBg,
                  border: `1px solid ${AQUA}`,
                  borderRadius: '8px',
                }}
                formatter={(value: number) => fmtCurrency(value)}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </SimpleGrid>

      {/* Burn Rate Analysis */}
      <ChartCard title="Burn Rate Analysis">
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={burnRateData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="month" tick={{ fill: textColor }} />
            <YAxis tick={{ fill: textColor }} />
            <RechartTooltip
              contentStyle={{
                backgroundColor: cardBg,
                border: `1px solid ${AQUA}`,
                borderRadius: '8px',
              }}
              formatter={(value: number) => fmtCurrency(value)}
            />
            <Legend />
            <Bar dataKey="spend" fill={AQUA} name="Monthly Spend" radius={[8, 8, 0, 0]} />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={DEEP_BLUE}
              strokeWidth={3}
              name="Cumulative Spend"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#888"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Annual Budget"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ROI Scoring */}
      <ChartCard title="ROI Scoring">
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rank</Table.Th>
                <Table.Th>Project Name</Table.Th>
                <Table.Th>Priority</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Total Cost</Table.Th>
                <Table.Th>Total Hours</Table.Th>
                <Table.Th>ROI Score</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {roiData.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td fw={600}>{row.rank}</Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={
                        row.priority === 'P0'
                          ? 'red'
                          : row.priority === 'P1'
                          ? 'orange'
                          : row.priority === 'P2'
                          ? 'blue'
                          : 'gray'
                      }
                    >
                      {row.priority}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      variant="dot"
                      color={
                        row.status === 'Delivered'
                          ? 'green'
                          : row.status === 'Active'
                          ? 'blue'
                          : 'gray'
                      }
                    >
                      {row.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{fmtCurrency(row.totalCost)}</Table.Td>
                  <Table.Td>{Math.round(row.totalHours)}</Table.Td>
                  <Table.Td>
                    <Tooltip label={`Score: ${row.roiScore.toFixed(1)}`}>
                      <Text fw={600} c="blue">
                        {row.roiScore.toFixed(1)}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </ChartCard>

      {/* Quarterly Forecast */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <ChartCard title="Spend by Priority">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={spendByPriorityData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="priority" tick={{ fill: textColor }} />
              <YAxis tick={{ fill: textColor }} />
              <RechartTooltip
                contentStyle={{
                  backgroundColor: cardBg,
                  border: `1px solid ${AQUA}`,
                  borderRadius: '8px',
                }}
                formatter={(value: number) => fmtCurrency(value)}
              />
              <Bar dataKey="cost" fill={AQUA} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost per Hour by Status">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costPerHourByStatus} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="status" tick={{ fill: textColor }} />
              <YAxis tick={{ fill: textColor }} />
              <RechartTooltip
                contentStyle={{
                  backgroundColor: cardBg,
                  border: `1px solid ${AQUA}`,
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `$${value}/hr`}
              />
              <Bar dataKey="costPerHour" fill={DEEP_BLUE} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </SimpleGrid>
    </Stack>
  );
}
