import React, { useMemo } from 'react';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Stack,
  Table,
  ThemeIcon,
  Tooltip,
  ScrollArea,
  Alert,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { IconUsers, IconGitBranch, IconAlertTriangle, IconTrendingUp } from '@tabler/icons-react';
import { AQUA_HEX, DEEP_BLUE_HEX, AQUA, AQUA_TINTS, CHART_COLORS, DEEP_BLUE, DEEP_BLUE_TINTS, FONT_FAMILY, GRAY_200, SHADOW, SURFACE_SUBTLE} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { useResources } from '../../api/resources';
import { usePods } from '../../api/pods';
import { useProjects, useProjectPodMatrix } from '../../api/projects';
import { useCapacityGap } from '../../api/reports';

interface HeatmapCell {
  pod: string;
  role: string;
  count: number;
}

interface PodBottleneck {
  podName: string;
  teamSize: number;
  totalFte: number;
  projectCount: number;
  loadRatio: number;
  riskLevel: 'high' | 'medium' | 'low';
}

interface BlockedProjectChain {
  projectId: string | number;
  projectName: string;
  status: string;
  priority: string;
  blockedByName: string | null;
  blockedByStatus: string | null;
  isChainBlocked: boolean;
  owner: string;
  durationMonths: number;
}

const getPriorityColor = (priority: string | undefined) => {
  const lower = (priority || '').toLowerCase();
  if (lower === 'critical') return 'red';
  if (lower === 'high') return 'orange';
  if (lower === 'medium') return 'yellow';
  return 'blue';
};

const getStatusColor = (status: string | undefined) => {
  const lower = (status || '').toLowerCase();
  if (lower === 'completed' || lower === 'done') return 'green';
  if (lower === 'in progress') return 'blue';
  if (lower === 'blocked') return 'red';
  return 'gray';
};

export default function CrossTeamDependencyPage() {
  const { data: resources, isLoading: loadingResources, error: errorResources } = useResources();
  const { data: pods, isLoading: loadingPods, error: errorPods } = usePods();
  const { data: projects, isLoading: loadingProjects, error: errorProjects } = useProjects();
  const { data: podMatrix } = useProjectPodMatrix();
  const { data: gapData, isLoading: loadingGapData } = useCapacityGap('hours');

  const dark = useDarkMode();
  const headingColor = dark ? GRAY_200 : DEEP_BLUE;
  const sectionBg = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;
  const textColor = dark ? '#a0a0a0' : '#666';

  const isLoading =
    loadingResources || loadingPods || loadingProjects || loadingGapData;
  const error =
    errorResources || errorPods || errorProjects;

  const kpis = useMemo(() => {
    if (!resources || !pods || !projects) {
      return {
        totalPods: 0,
        sharedResources: 0,
        blockedProjects: 0,
        avgTeamSize: 0,
      };
    }

    const blockedCount = projects.filter(
      (p: any) => p.blockedById || p.blockedBy
    ).length;

    const resourceCountByName: Record<string, Set<string>> = {};
    resources.forEach((r: any) => {
      const key = (r.name || '').toLowerCase();
      if (!resourceCountByName[key]) {
        resourceCountByName[key] = new Set();
      }
      resourceCountByName[key].add(r.pod || '');
    });

    const sharedCount = Object.values(resourceCountByName).filter(
      (podsSet) => podsSet.size > 1
    ).length;

    return {
      totalPods: pods.length,
      sharedResources: sharedCount,
      blockedProjects: blockedCount,
      avgTeamSize: pods.length > 0 ? Math.round(resources.length / pods.length) : 0,
    };
  }, [resources, pods, projects]);

  const heatmapData = useMemo((): { heatmap: HeatmapCell[]; allRoles: string[] } => {
    if (!resources || !pods) return { heatmap: [], allRoles: [] };

    const rolesByPod: Record<string, Record<string, number>> = {};

    pods.forEach((p: any) => {
      rolesByPod[p.name] = {};
    });

    resources.forEach((r: any) => {
      const podName = r.podAssignment?.podName || 'Unassigned';
      const role = r.role || 'Unknown';

      if (!rolesByPod[podName]) {
        rolesByPod[podName] = {};
      }

      rolesByPod[podName][role] = (rolesByPod[podName][role] || 0) + 1;
    });

    const allRoles = new Set<string>();
    Object.values(rolesByPod).forEach((roles) => {
      Object.keys(roles).forEach((r) => allRoles.add(r));
    });

    const heatmap: HeatmapCell[] = [];
    Object.entries(rolesByPod).forEach(([pod, roles]) => {
      Array.from(allRoles).forEach((role) => {
        heatmap.push({
          pod,
          role,
          count: roles[role] || 0,
        });
      });
    });

    return { heatmap, allRoles: Array.from(allRoles).sort() };
  }, [resources, pods]);

  const podLoadData = useMemo((): {
    byTeamSize: Array<{ name: string; 'Team Size': number; 'Avg': number }>;
    byFte: Array<{ name: string; FTE: number; 'Avg': number }>;
  } => {
    if (!resources || !pods) return { byTeamSize: [], byFte: [] };

    const podStats: Record<
      string,
      { teamSize: number; totalFte: number }
    > = {};

    pods.forEach((p: any) => {
      podStats[p.name] = { teamSize: 0, totalFte: 0 };
    });

    resources.forEach((r: any) => {
      const podName = r.podAssignment?.podName || 'Unassigned';
      if (!podStats[podName]) {
        podStats[podName] = { teamSize: 0, totalFte: 0 };
      }
      podStats[podName].teamSize += 1;
      podStats[podName].totalFte += r.podAssignment?.capacityFte || 0;
    });

    const avgTeamSize = Object.values(podStats).reduce((s, p) => s + p.teamSize, 0) / Object.keys(podStats).length;
    const avgFte = Object.values(podStats).reduce((s, p) => s + p.totalFte, 0) / Object.keys(podStats).length;

    return {
      byTeamSize: Object.entries(podStats)
        .map(([name, stats]) => ({
          name,
          'Team Size': stats.teamSize,
          'Avg': Math.round(avgTeamSize),
        }))
        .sort((a, b) => b['Team Size'] - a['Team Size']),
      byFte: Object.entries(podStats)
        .map(([name, stats]) => ({
          name,
          FTE: Math.round(stats.totalFte * 10) / 10,
          'Avg': Math.round(avgFte * 10) / 10,
        }))
        .sort((a, b) => b.FTE - a.FTE),
    };
  }, [resources, pods]);

  const blockedProjects = useMemo(() => {
    if (!projects) return [];

    const projectMap: Record<string | number, any> = {};
    projects.forEach((p: any) => {
      projectMap[p.id] = p;
    });

    const blocked: BlockedProjectChain[] = [];

    projects.forEach((p: any) => {
      const blockedById = p.blockedById || p.blockedBy;
      if (blockedById) {
        const blockingProject = projectMap[blockedById];
        const blockingStatus = blockingProject?.status || 'Unknown';
        const isChainBlocked = blockingProject?.blockedById || blockingProject?.blockedBy;

        blocked.push({
          projectId: p.id,
          projectName: p.name || 'Unknown',
          status: p.status || 'Unknown',
          priority: p.priority || 'Medium',
          blockedByName: blockingProject?.name || 'Unknown',
          blockedByStatus: blockingStatus,
          isChainBlocked: !!isChainBlocked,
          owner: p.owner || 'Unknown',
          durationMonths: p.durationMonths || 0,
        });
      }
    });

    return blocked.sort((a, b) =>
      a.projectName.localeCompare(b.projectName)
    );
  }, [projects]);

  const bottlenecks = useMemo(() => {
    if (!resources || !pods) return [];

    const podStats: Record<
      string,
      { teamSize: number; totalFte: number; projectSet: Set<string> }
    > = {};

    pods.forEach((p: any) => {
      podStats[p.name] = { teamSize: 0, totalFte: 0, projectSet: new Set() };
    });

    resources.forEach((r: any) => {
      const podName = r.podAssignment?.podName || 'Unassigned';
      if (!podStats[podName]) {
        podStats[podName] = { teamSize: 0, totalFte: 0, projectSet: new Set() };
      }
      podStats[podName].teamSize += 1;
      podStats[podName].totalFte += r.podAssignment?.capacityFte || 0;
    });

    // Count projects per POD from the pod matrix
    if (podMatrix) {
      podMatrix.forEach((row: any) => {
        const podName = row.podName;
        if (podStats[podName]) {
          podStats[podName].projectSet.add(String(row.projectId));
        }
      });
    }

    const result: PodBottleneck[] = Object.entries(podStats)
      .map(([podName, stats]) => {
        const projectCount = stats.projectSet.size;
        const loadRatio = stats.teamSize > 0 ? projectCount / stats.teamSize : 0;

        let riskLevel: 'high' | 'medium' | 'low' = 'low';
        if (loadRatio > 3) riskLevel = 'high';
        else if (loadRatio > 2) riskLevel = 'medium';

        return {
          podName,
          teamSize: stats.teamSize,
          totalFte: Math.round(stats.totalFte * 10) / 10,
          projectCount,
          loadRatio: Math.round(loadRatio * 100) / 100,
          riskLevel,
        };
      })
      .sort((a, b) => b.loadRatio - a.loadRatio);

    return result;
  }, [resources, pods, projects]);

  if (isLoading) {
    return (
      <LoadingSpinner
        variant="table"
        message="Loading cross-team dependencies..."
      />
    );
  }

  if (error) {
    return (
      <PageError context="loading dependency data" error={error} />
    );
  }

  return (
    <Container size="xl" py="xl" className="page-enter stagger-children">
      <Stack gap="lg">
        <Group className="slide-in-left">
          <div>
            <Title
              order={2}
              style={{
                fontFamily: FONT_FAMILY,
                color: headingColor,
                fontWeight: 700,
              }}
            >
              Cross-Team Dependencies
            </Title>
            <Text c="dimmed" size="sm">
              Resource contention, POD load analysis, and bottleneck detection
            </Text>
          </div>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" className="stagger-children">
          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Total PODs
              </Text>
              <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                <IconUsers size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {kpis.totalPods}
            </Text>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Shared Resources
              </Text>
              <ThemeIcon size="lg" radius="md" variant="light" color="cyan">
                <IconGitBranch size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {kpis.sharedResources}
            </Text>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Blocked Projects
              </Text>
              <ThemeIcon size="lg" radius="md" variant="light" color="red">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {kpis.blockedProjects}
            </Text>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Avg Team Size
              </Text>
              <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                <IconTrendingUp size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">
              {kpis.avgTeamSize}
            </Text>
          </Card>
        </SimpleGrid>

        <ChartCard title="Resource Contention Heatmap" minHeight={400}>
          <Text size="xs" c="dimmed" mb="md">
            Rows = PODs, Columns = Roles. Cell intensity represents resource concentration.
          </Text>
          <ScrollArea>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: 'fit-content',
              }}
            >
              {heatmapData.heatmap.length > 0 ? (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `120px repeat(${heatmapData.allRoles.length}, 50px)`,
                      gap: '2px',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '12px',
                        paddingBottom: '8px',
                      }}
                    >
                      POD / Role
                    </div>
                    {heatmapData.allRoles.map((role) => (
                      <div
                        key={role}
                        style={{
                          fontWeight: 600,
                          fontSize: '11px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          writingMode: 'vertical-rl',
                          textOrientation: 'mixed',
                          transform: 'rotate(180deg)',
                          paddingBottom: '8px',
                          height: '120px',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                        }}
                      >
                        {role}
                      </div>
                    ))}

                    {Array.from(
                      new Set(heatmapData.heatmap.map((cell) => cell.pod))
                    )
                      .sort()
                      .map((pod) => (
                        <React.Fragment key={pod}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            {pod}
                          </div>
                          {heatmapData.allRoles.map((role) => {
                            const cell = heatmapData.heatmap.find(
                              (c) => c.pod === pod && c.role === role
                            );
                            const count = cell?.count || 0;
                            let bgColor = 'transparent';
                            if (count === 1)
                              bgColor = AQUA_TINTS[10];
                            else if (count === 2)
                              bgColor = AQUA_TINTS[30];
                            else if (count >= 3)
                              bgColor = AQUA_TINTS[50];

                            return (
                              <Tooltip
                                key={`${pod}-${role}`}
                                label={`${pod}, ${role}: ${count} ${count === 1 ? 'resource' : 'resources'}`}
                                position="top"
                              >
                                <div
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    backgroundColor: bgColor,
                                    border: `1px solid ${DEEP_BLUE_TINTS[20]}`,
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: count > 0 ? DEEP_BLUE : '#ccc',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {count > 0 ? count : ''}
                                </div>
                              </Tooltip>
                            );
                          })}
                        </React.Fragment>
                      ))}
                  </div>
                </>
              ) : (
                <Text c="dimmed" size="sm">
                  No resource data available
                </Text>
              )}
            </div>
          </ScrollArea>
        </ChartCard>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" className="stagger-children">
          <ChartCard title="Team Size by POD" minHeight={320}>
            <Text size="xs" c="dimmed" mb="md">
              Number of resources per POD with average line
            </Text>
            {podLoadData.byTeamSize.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={podLoadData.byTeamSize}
                  margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis fontSize={10} />
                  <RechartTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    y={
                      podLoadData.byTeamSize.length > 0
                        ? Math.round(
                            podLoadData.byTeamSize.reduce((sum, item) => sum + item['Team Size'], 0) /
                              podLoadData.byTeamSize.length
                          )
                        : 0
                    }
                    stroke={DEEP_BLUE_HEX}
                    strokeDasharray="5 5"
                    name="Average"
                  />
                  <Bar animationDuration={600} dataKey="Team Size" fill={AQUA_HEX} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Text c="dimmed" size="sm" ta="center" py="xl">
                No data available
              </Text>
            )}
          </ChartCard>

          <ChartCard title="FTE by POD" minHeight={320}>
            <Text size="xs" c="dimmed" mb="md">
              Total full-time equivalent per POD
            </Text>
            {podLoadData.byFte.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={podLoadData.byFte}
                  margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis fontSize={10} />
                  <RechartTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    y={
                      podLoadData.byFte.length > 0
                        ? Math.round(
                            (podLoadData.byFte.reduce((sum, item) => sum + item.FTE, 0) /
                              podLoadData.byFte.length) * 10
                          ) / 10
                        : 0
                    }
                    stroke={DEEP_BLUE_HEX}
                    strokeDasharray="5 5"
                    name="Average"
                  />
                  <Bar animationDuration={600} dataKey="FTE" fill={DEEP_BLUE_HEX} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Text c="dimmed" size="sm" ta="center" py="xl">
                No data available
              </Text>
            )}
          </ChartCard>
        </SimpleGrid>

        <ChartCard title="Blocked Project Chain" minHeight={400}>
          <Text size="xs" c="dimmed" mb="md">
            Projects blocked by others — chain indicates secondary blocking
          </Text>
          {blockedProjects.length > 0 ? (
            <ScrollArea>
              <Table fz="xs" withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Project Name</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Priority</Table.Th>
                    <Table.Th>Blocked By</Table.Th>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Duration (mo)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {blockedProjects.map((proj) => (
                    <Table.Tr key={proj.projectId}>
                      <Table.Td fw={600}>{proj.projectName}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={getStatusColor(proj.status)}>
                          {proj.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={getPriorityColor(proj.priority)}>
                          {proj.priority}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <span>{proj.blockedByName}</span>
                          {proj.isChainBlocked && (
                            <Tooltip label="This blocking project is also blocked">
                              <Text size="xs" fw={600} c="orange">
                                ⚠️
                              </Text>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{proj.owner}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {proj.durationMonths}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Alert icon={<IconGitBranch />} title="No Blocked Projects" color="green">
              All projects are proceeding without blocking dependencies.
            </Alert>
          )}
        </ChartCard>

        <ChartCard title="Critical Path Summary" minHeight={400}>
          <Text size="xs" c="dimmed" mb="md">
            PODs with high project-to-resource ratios — potential bottlenecks
          </Text>
          {bottlenecks.length > 0 ? (
            <ScrollArea>
              <Table fz="xs" withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>POD Name</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Team Size</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total FTE</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Projects</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Load Ratio</Table.Th>
                    <Table.Th>Risk Level</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {bottlenecks.map((pod) => {
                    const riskColor =
                      pod.riskLevel === 'high'
                        ? 'red'
                        : pod.riskLevel === 'medium'
                          ? 'orange'
                          : 'green';
                    return (
                      <Table.Tr key={pod.podName}>
                        <Table.Td fw={600}>{pod.podName}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {pod.teamSize}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {pod.totalFte}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {pod.projectCount}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {pod.loadRatio.toFixed(2)}
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" color={riskColor}>
                            {pod.riskLevel.charAt(0).toUpperCase() +
                              pod.riskLevel.slice(1)}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              No POD data available
            </Text>
          )}
        </ChartCard>
      </Stack>
    </Container>
  );
}
