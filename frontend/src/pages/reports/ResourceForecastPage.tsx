import React, { useMemo } from 'react';
import {
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
  RingProgress,
  ScrollArea,
} from '@mantine/core';
import {
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
  ComposedChart,
  Line,
} from 'recharts';
import {
  IconUsers,
  IconBriefcase,
  IconTarget,
  IconAlertTriangle,
  IconTrendingUp,
} from '@tabler/icons-react';

import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, CHART_COLORS, AQUA_TINTS, DEEP_BLUE_TINTS } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';

import { useResources } from '../../api/resources';
import { usePods } from '../../api/pods';
import { useProjects } from '../../api/projects';
import { useCapacityGap, useCapacityDemandSummary, useHiringForecast } from '../../api/reports';

export default function ResourceForecastPage() {
  const dark = useDarkMode();
  const { data: resources, isLoading: resourcesLoading, error: resourcesError } = useResources();
  const { data: pods, isLoading: podsLoading, error: podsError } = usePods();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: capacityDemandData, isLoading: capacityLoading, error: capacityError } = useCapacityDemandSummary();
  const { data: hiringForecastData, isLoading: hiringLoading, error: hiringError } = useHiringForecast();

  const isLoading = resourcesLoading || podsLoading || projectsLoading || capacityLoading || hiringLoading;
  const error = resourcesError || podsError || projectsError || capacityError || hiringError;

  // Derived data
  const { kpiData, fteByRole, resourcesByPod, singlePersonPods, roleConcentration } = useMemo(() => {
    if (!resources || !pods) {
      return {
        kpiData: { totalHeadcount: 0, totalFte: 0, avgFte: 0, uniqueRoles: 0 },
        fteByRole: [],
        resourcesByPod: [],
        singlePersonPods: [],
        roleConcentration: [],
      };
    }

    // KPI calculations
    const totalHeadcount = resources.length;
    const totalFte = resources.reduce((sum, r) => sum + (r.podAssignment?.capacityFte || 0), 0);
    const avgFte = totalHeadcount > 0 ? (totalFte / totalHeadcount).toFixed(2) : '0';
    const uniqueRoles = new Set(resources.map(r => r.role)).size;

    // FTE by Role
    const roleMap = new Map<string, number>();
    resources.forEach(r => {
      const current = roleMap.get(r.role) || 0;
      roleMap.set(r.role, current + (r.podAssignment?.capacityFte || 0));
    });
    const fteByRole = Array.from(roleMap.entries()).map(([role, fte]) => ({
      name: role,
      value: parseFloat(fte.toFixed(2)),
    }));

    // Resources per Pod
    const podMap = new Map<string, number>();
    resources.forEach(r => {
      const podName = r.podAssignment?.podName || 'Unassigned';
      const current = podMap.get(podName) || 0;
      podMap.set(podName, current + 1);
    });
    const resourcesByPod = Array.from(podMap.entries()).map(([pod, count]) => ({
      name: pod,
      value: count,
    }));

    // Single-Person Pods (Bus Factor Risk)
    const podsWithResources = new Map<string, Array<typeof resources[0]>>();
    resources.forEach(r => {
      const podName = r.podAssignment?.podName || 'Unassigned';
      if (!podsWithResources.has(podName)) {
        podsWithResources.set(podName, []);
      }
      podsWithResources.get(podName)!.push(r);
    });
    const singlePersonPods = Array.from(podsWithResources.entries())
      .filter(([_, podResources]) => podResources.length === 1)
      .map(([pod, podResources]) => ({
        pod,
        resource: podResources[0].name,
      }));

    // Role Concentration (>50% of role FTE in single pod)
    const roleByPodFte = new Map<string, Map<string, number>>();
    resources.forEach(r => {
      const role = r.role;
      const pod = r.podAssignment?.podName || 'Unassigned';
      if (!roleByPodFte.has(role)) {
        roleByPodFte.set(role, new Map());
      }
      const podMap = roleByPodFte.get(role)!;
      podMap.set(pod, (podMap.get(pod) || 0) + (r.podAssignment?.capacityFte || 0));
    });

    const roleConcentration: Array<{ role: string; dominantPod: string; percentage: number }> = [];
    roleByPodFte.forEach((podFteMap, role) => {
      const totalRoleFte = Array.from(podFteMap.values()).reduce((a, b) => a + b, 0);
      const entries = Array.from(podFteMap.entries()).sort((a, b) => b[1] - a[1]);
      if (entries.length > 0) {
        const [dominantPod, dominantFte] = entries[0];
        const percentage = (dominantFte / totalRoleFte) * 100;
        if (percentage > 50) {
          roleConcentration.push({
            role,
            dominantPod,
            percentage: parseFloat(percentage.toFixed(1)),
          });
        }
      }
    });

    return {
      kpiData: { totalHeadcount, totalFte: parseFloat(totalFte.toFixed(2)), avgFte: parseFloat(avgFte), uniqueRoles },
      fteByRole: fteByRole.sort((a, b) => b.value - a.value),
      resourcesByPod: resourcesByPod.sort((a, b) => b.value - a.value),
      singlePersonPods,
      roleConcentration,
    };
  }, [resources, pods]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <PageError error={error} />;

  const textColor = dark ? '#E9ECEF' : '#2C3E50';
  const gridColor = dark ? '#373A40' : '#E9ECEF';
  const bgColor = dark ? '#1A1B1E' : '#FFFFFF';

  return (
    <Stack gap="lg" p="lg">
      {/* Header */}
      <div>
        <Title order={1} fw={700} size="h1" c={dark ? '#FFF' : '#1A1B1E'}>
          Resource Forecasting
        </Title>
        <Text c="dimmed" size="sm" mt={4}>
          Workforce planning, utilization trends, and capacity projections
        </Text>
      </div>

      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder p="lg" radius="md" bg={bgColor} style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600} c="dimmed">
              Total Headcount
            </Text>
            <ThemeIcon size="lg" variant="light" color="blue" radius="md">
              <IconUsers size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl">
            {kpiData.totalHeadcount}
          </Text>
        </Card>

        <Card withBorder p="lg" radius="md" bg={bgColor} style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600} c="dimmed">
              Total FTE
            </Text>
            <ThemeIcon size="lg" variant="light" color="cyan" radius="md">
              <IconTrendingUp size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl">
            {kpiData.totalFte}
          </Text>
        </Card>

        <Card withBorder p="lg" radius="md" bg={bgColor} style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600} c="dimmed">
              Avg FTE per Person
            </Text>
            <ThemeIcon size="lg" variant="light" color="teal" radius="md">
              <IconBriefcase size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl">
            {kpiData.avgFte}
          </Text>
        </Card>

        <Card withBorder p="lg" radius="md" bg={bgColor} style={{ boxShadow: SHADOW.card }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600} c="dimmed">
              Roles Represented
            </Text>
            <ThemeIcon size="lg" variant="light" color="grape" radius="md">
              <IconTarget size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl">
            {kpiData.uniqueRoles}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Utilization Distribution */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <ChartCard title="FTE Distribution by Role">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fteByRole}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} tick={{ fill: textColor, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} />
              <RechartTooltip
                contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}`, borderRadius: 8 }}
                labelStyle={{ color: textColor }}
                formatter={(value) => [parseFloat(String(value)).toFixed(2), 'FTE']}
              />
              <Bar dataKey="value" fill={AQUA} name="FTE" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Resources per POD">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={resourcesByPod}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} tick={{ fill: textColor, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} />
              <RechartTooltip
                contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}`, borderRadius: 8 }}
                labelStyle={{ color: textColor }}
                formatter={(value) => [value, 'Resources']}
              />
              <Bar dataKey="value" fill={dark ? AQUA : DEEP_BLUE} name="Resources" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </SimpleGrid>

      {/* Capacity Projection */}
      {capacityDemandData && capacityDemandData.length > 0 && (
        <ChartCard title="Capacity vs Demand Forecast">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={capacityDemandData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="monthLabel" stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} />
              <YAxis stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: textColor }} />
              <RechartTooltip
                contentStyle={{ backgroundColor: bgColor, border: `1px solid ${gridColor}`, borderRadius: 8 }}
                labelStyle={{ color: textColor }}
                formatter={(value, name) => [Number(value).toLocaleString() + 'h', name]}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', color: textColor }} />
              <Area
                type="monotone"
                dataKey="totalCapacityHours"
                fill={AQUA}
                stroke={AQUA}
                fillOpacity={dark ? 0.25 : 0.35}
                name="Capacity"
              />
              <Area
                type="monotone"
                dataKey="totalDemandHours"
                fill="#f97316"
                stroke="#f97316"
                fillOpacity={dark ? 0.3 : 0.25}
                name="Demand"
              />
              <Line type="monotone" dataKey="netGapHours" stroke="#a3e635" strokeWidth={2} dot={false} name="Net Gap" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Hiring Forecast */}
      <ChartCard title="Hiring Forecast">
        {hiringForecastData && hiringForecastData.length > 0 ? (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>POD</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Month</Table.Th>
                  <Table.Th>FTE Needed</Table.Th>
                  <Table.Th>Deficit Hours</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hiringForecastData.map((forecast, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td fw={600}>{forecast.podName}</Table.Td>
                    <Table.Td>{forecast.role}</Table.Td>
                    <Table.Td>{forecast.monthLabel}</Table.Td>
                    <Table.Td>{forecast.ftesNeeded}</Table.Td>
                    <Table.Td>{forecast.deficitHours}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text c="dimmed" ta="center" py="lg">
            No hiring recommendations at this time
          </Text>
        )}
      </ChartCard>

      {/* Bus Factor Analysis */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Single-Person Pods */}
        <ChartCard
          title="Single-Person Pods"
          headerRight={
            singlePersonPods.length > 0 ? (
              <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                {singlePersonPods.length} at risk
              </Badge>
            ) : undefined
          }
        >
          {singlePersonPods.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>POD</Table.Th>
                    <Table.Th>Resource</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {singlePersonPods.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={600}>{item.pod}</Table.Td>
                      <Table.Td>
                        <Tooltip label="Only team member in this pod">
                          <Text>{item.resource}</Text>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" ta="center" py="lg">
              All pods have multiple team members
            </Text>
          )}
        </ChartCard>

        {/* Role Concentration */}
        <ChartCard
          title="Role Concentration"
          headerRight={
            roleConcentration.length > 0 ? (
              <Badge color="orange" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                {roleConcentration.length} risks
              </Badge>
            ) : undefined
          }
        >
          {roleConcentration.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Dominant POD</Table.Th>
                    <Table.Th>% of Role FTE</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {roleConcentration.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={600}>{item.role}</Table.Td>
                      <Table.Td>{item.dominantPod}</Table.Td>
                      <Table.Td>
                        <Group gap={8}>
                          <Text>{item.percentage}%</Text>
                          <Progress value={item.percentage} size="sm" style={{ flex: 1 }} color={item.percentage > 75 ? 'red' : 'orange'} />
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" ta="center" py="lg">
              No significant concentration risks detected
            </Text>
          )}
        </ChartCard>
      </SimpleGrid>
    </Stack>
  );
}
