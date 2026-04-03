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
  Select,
  Tooltip,
  ScrollArea,
  SegmentedControl,
  Box,
  ActionIcon,
} from '@mantine/core';
import { IconLink } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { useProjects } from '../../api/projects';
import { useCapacityDemandSummary } from '../../api/reports';
import { ProjectResponse } from '../../types/project';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#40c057',
  ACTIVE: '#228be6',
  IN_DISCOVERY: '#7950f2',
  NOT_STARTED: '#868e96',
  ON_HOLD: '#fd7e14',
  CANCELLED: '#fa5252',
};

interface GanttProject {
  id: string;
  name: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: string;
  owner: string;
  startMonth?: number;
  targetEndMonth?: number;
  durationMonths: number;
  targetDate?: string;
  startDate?: string;
  client?: string;
  blockedById?: string;
}

const RoadmapTimelinePage: React.FC = () => {
  const { data: projects, isLoading, error } = useProjects();
  const dark = useDarkMode();
  const [groupBy, setGroupBy] = React.useState<'all' | 'priority' | 'owner' | 'status'>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');

  // Calculate date range for timeline
  const dateRange = useMemo(() => {
    if (!projects || projects.length === 0) {
      const today = new Date();
      const year = today.getFullYear();
      return {
        startMonth: 0,
        endMonth: 11,
        year,
        monthCount: 12,
      };
    }

    let minMonth = 0;
    let maxMonth = 11;
    let year = new Date().getFullYear();

    projects.forEach((p) => {
      if (p.startMonth !== undefined && p.startMonth !== null) {
        minMonth = Math.min(minMonth, (p.startMonth ?? 0) - 1);
      }
      if (p.targetEndMonth !== undefined && p.targetEndMonth !== null) {
        maxMonth = Math.max(maxMonth, (p.targetEndMonth ?? 0) - 1);
      }
    });

    return {
      startMonth: Math.max(0, minMonth),
      endMonth: Math.min(11, maxMonth),
      year,
      monthCount: Math.min(11, maxMonth) - Math.max(0, minMonth) + 1,
    };
  }, [projects]);

  // Filter and group projects
  const filteredAndGroupedProjects = useMemo(() => {
    if (!projects) return {};

    let filtered = projects;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((p) => p.priority === priorityFilter);
    }

    if (groupBy === 'all') {
      return { All: filtered };
    }

    if (groupBy === 'priority') {
      const grouped: Record<string, typeof filtered> = {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      };
      filtered.forEach((p) => {
        grouped[p.priority]?.push(p);
      });
      return Object.fromEntries(Object.entries(grouped).filter(([, v]) => v.length > 0));
    }

    if (groupBy === 'owner') {
      const grouped: Record<string, typeof filtered> = {};
      filtered.forEach((p) => {
        if (!grouped[p.owner]) grouped[p.owner] = [];
        grouped[p.owner].push(p);
      });
      return grouped;
    }

    if (groupBy === 'status') {
      const grouped: Record<string, typeof filtered> = {};
      filtered.forEach((p) => {
        if (!grouped[p.status]) grouped[p.status] = [];
        grouped[p.status].push(p);
      });
      return grouped;
    }

    return { All: filtered };
  }, [projects, statusFilter, priorityFilter, groupBy]);

  // Calculate milestone data
  const upcomingMilestones = useMemo(() => {
    if (!projects) return [];

    const today = new Date();
    const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    return projects
      .filter((p) => {
        if (!p.targetDate) return false;
        const targetDate = new Date(p.targetDate);
        return targetDate >= today && targetDate <= in90Days;
      })
      .map((p) => {
        const targetDate = new Date(p.targetDate!);
        const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysRemaining, targetDate };
      })
      .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
  }, [projects]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!projects) return { total: 0, avgDuration: 0, thisQuarter: 0, blocked: 0 };

    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3) + 1;
    const quarterStart = new Date(today.getFullYear(), (quarter - 1) * 3, 1);
    const quarterEnd = new Date(today.getFullYear(), quarter * 3, 0);

    const total = projects.length;
    const avgDuration = Math.round(
      projects.reduce((sum, p) => sum + p.durationMonths, 0) / Math.max(1, projects.length)
    );
    const thisQuarter = projects.filter((p) => {
      if (!p.targetDate) return false;
      const targetDate = new Date(p.targetDate);
      return targetDate >= quarterStart && targetDate <= quarterEnd;
    }).length;
    const blocked = projects.filter((p) => p.blockedById).length;

    return { total, avgDuration, thisQuarter, blocked };
  }, [projects]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <PageError error={error} />;

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const bgColor = dark ? '#1a1b1e' : '#ffffff';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const borderColor = dark ? '#373a40' : '#e9ecef';
  const headerBgColor = dark ? '#25262b' : '#f8f9fa';

  const monthLabels = [];
  for (let i = dateRange.startMonth; i <= dateRange.endMonth; i++) {
    monthLabels.push(months[i]);
  }

  const monthWidth = 80;
  const totalWidth = monthLabels.length * monthWidth;

  // Calculate today's position
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayPosition = todayMonth >= dateRange.startMonth && todayMonth <= dateRange.endMonth
    ? (todayMonth - dateRange.startMonth) * monthWidth + monthWidth / 2
    : -100;

  return (
    <Stack gap="lg" style={{ fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <div>
        <Title order={1} size="h2" c={dark ? AQUA : DEEP_BLUE}>
          Roadmap Timeline
        </Title>
        <Text size="sm" c="dimmed" mt="xs">
          Visual timeline of all projects with dependencies and milestones
        </Text>
      </div>

      {/* Filters Row */}
      <Card shadow={SHADOW.card} padding="md" radius="md" style={{ backgroundColor: bgColor }}>
        <Group justify="space-between" wrap="wrap">
          <div style={{ flex: 1, minWidth: 250 }}>
            <Text size="sm" fw={500} mb="xs">
              Group By
            </Text>
            <SegmentedControl
              value={groupBy}
              onChange={(value) => setGroupBy(value as typeof groupBy)}
              data={[
                { label: 'All', value: 'all' },
                { label: 'By Priority', value: 'priority' },
                { label: 'By Owner', value: 'owner' },
                { label: 'By Status', value: 'status' },
              ]}
              fullWidth
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text size="sm" fw={500} mb="xs">
              Status
            </Text>
            <Select
              placeholder="All statuses"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'all')}
              data={['all', 'ACTIVE', 'NOT_STARTED', 'ON_HOLD', 'COMPLETED', 'CANCELLED']}
              searchable
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Text size="sm" fw={500} mb="xs">
              Priority
            </Text>
            <Select
              placeholder="All priorities"
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value || 'all')}
              data={['all', 'P0', 'P1', 'P2', 'P3']}
            />
          </div>
        </Group>
      </Card>

      {/* Custom Gantt Chart */}
      <ChartCard title="Project Timeline">
        <ScrollArea>
          <div
            style={{
              backgroundColor: bgColor,
              borderRadius: 8,
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
            }}
          >
            {/* Gantt Header */}
            <div
              style={{
                display: 'flex',
                backgroundColor: headerBgColor,
                borderBottom: `1px solid ${borderColor}`,
                minWidth: totalWidth,
              }}
            >
              <div
                style={{
                  width: 200,
                  minWidth: 200,
                  padding: '12px 8px',
                  fontWeight: 500,
                  borderRight: `1px solid ${borderColor}`,
                  color: textColor,
                }}
              >
                Project
              </div>
              {monthLabels.map((month, idx) => (
                <div
                  key={idx}
                  style={{
                    width: monthWidth,
                    minWidth: monthWidth,
                    padding: '12px 4px',
                    textAlign: 'center',
                    borderRight: `1px solid ${borderColor}`,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: textColor,
                  }}
                >
                  {month}
                </div>
              ))}
            </div>

            {/* Today Marker */}
            {todayPosition >= 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${200 + todayPosition}px`,
                  top: 0,
                  width: 2,
                  height: '100%',
                  backgroundColor: '#fa5252',
                  borderStyle: 'dashed',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Gantt Rows */}
            {Object.entries(filteredAndGroupedProjects).map(([groupName, groupProjects]) => (
              <div key={groupName}>
                {groupBy !== 'all' && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: dark ? '#2c2e31' : '#efefef',
                      borderBottom: `1px solid ${borderColor}`,
                      fontWeight: 600,
                      fontSize: '13px',
                      color: DEEP_BLUE,
                      minWidth: totalWidth,
                      display: 'flex',
                    }}
                  >
                    {groupName}
                  </div>
                )}
                {groupProjects.map((project: ProjectResponse) => {
                  const startCol = (project.startMonth || 1) - 1 - dateRange.startMonth;
                  const endCol = (project.targetEndMonth || 12) - 1 - dateRange.startMonth;
                  const barStart = Math.max(0, startCol) * monthWidth;
                  const barWidth = Math.max(1, (endCol - Math.max(0, startCol) + 1)) * monthWidth;
                  const statusColor = STATUS_COLORS[project.status] || '#868e96';

                  return (
                    <div
                      key={project.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: totalWidth,
                        borderBottom: `1px solid ${borderColor}`,
                        backgroundColor: bgColor,
                      }}
                    >
                      <div
                        style={{
                          width: 200,
                          minWidth: 200,
                          padding: '8px',
                          borderRight: `1px solid ${borderColor}`,
                          fontSize: '12px',
                          color: textColor,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {project.name.substring(0, 20)}
                        </span>
                        <Badge size="xs" variant="light" color={project.priority === 'P0' ? 'red' : 'gray'}>
                          {project.priority}
                        </Badge>
                      </div>

                      {/* Timeline area */}
                      <div
                        style={{
                          flex: 1,
                          position: 'relative',
                          height: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          paddingRight: '8px',
                        }}
                      >
                        <Tooltip
                          label={
                            <Stack gap={4}>
                              <Text size="xs" fw={500}>
                                {project.name}
                              </Text>
                              {project.startDate && (
                                <Text size="xs">
                                  Start: {new Date(project.startDate).toLocaleDateString()}
                                </Text>
                              )}
                              {project.targetDate && (
                                <Text size="xs">
                                  Target: {new Date(project.targetDate).toLocaleDateString()}
                                </Text>
                              )}
                              {project.owner && <Text size="xs">Owner: {project.owner}</Text>}
                              <Text size="xs">Status: {project.status}</Text>
                              {project.durationMonths && (
                                <Text size="xs">Duration: {project.durationMonths} months</Text>
                              )}
                            </Stack>
                          }
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: `${barStart}px`,
                              width: `${barWidth}px`,
                              height: '32px',
                              backgroundColor: statusColor,
                              borderRadius: '4px',
                              border: `1px solid ${dark ? '#1a1b1e' : '#ddd'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: '8px',
                              minWidth: '40px',
                              opacity: 0.85,
                              transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.opacity = '0.85';
                            }}
                          >
                            {project.blockedById && (
                              <Tooltip label={`Blocked by: ${project.blockedById}`}>
                                <ActionIcon
                                  variant="transparent"
                                  size="xs"
                                  color="white"
                                  style={{ cursor: 'help' }}
                                >
                                  <IconLink size={14} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </ChartCard>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card shadow={SHADOW.card} padding="md" radius="md" style={{ backgroundColor: bgColor }}>
          <Stack gap={4}>
            <Text size="sm" c="dimmed" fw={500}>
              Total Projects
            </Text>
            <Text size="xl" fw={700} c={DEEP_BLUE}>
              {summaryStats.total}
            </Text>
          </Stack>
        </Card>

        <Card shadow={SHADOW.card} padding="md" radius="md" style={{ backgroundColor: bgColor }}>
          <Stack gap={4}>
            <Text size="sm" c="dimmed" fw={500}>
              Avg Duration
            </Text>
            <Text size="xl" fw={700} c={DEEP_BLUE}>
              {summaryStats.avgDuration}
            </Text>
            <Text size="xs" c="dimmed">
              months
            </Text>
          </Stack>
        </Card>

        <Card shadow={SHADOW.card} padding="md" radius="md" style={{ backgroundColor: bgColor }}>
          <Stack gap={4}>
            <Text size="sm" c="dimmed" fw={500}>
              This Quarter
            </Text>
            <Text size="xl" fw={700} c={AQUA}>
              {summaryStats.thisQuarter}
            </Text>
            <Text size="xs" c="dimmed">
              projects ending
            </Text>
          </Stack>
        </Card>

        <Card shadow={SHADOW.card} padding="md" radius="md" style={{ backgroundColor: bgColor }}>
          <Stack gap={4}>
            <Text size="sm" c="dimmed" fw={500}>
              Blocked
            </Text>
            <Text size="xl" fw={700} c="#fd7e14">
              {summaryStats.blocked}
            </Text>
            <Text size="xs" c="dimmed">
              projects
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Upcoming Milestones Table */}
      <ChartCard title="Upcoming Milestones">
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: `2px solid ${borderColor}` }}>
                <th
                  style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  Project
                </th>
                <th
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  Priority
                </th>
                <th
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  Target Date
                </th>
                <th
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  Days Remaining
                </th>
                <th
                  style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  Owner
                </th>
                <th
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {upcomingMilestones.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#868e96' }}>
                    No milestones in the next 90 days
                  </td>
                </tr>
              ) : (
                upcomingMilestones.map((milestone) => (
                  <tr
                    key={milestone.id}
                    style={{
                      borderBottom: `1px solid ${borderColor}`,
                      backgroundColor: bgColor,
                    }}
                  >
                    <td style={{ padding: '12px 8px', color: textColor }}>
                      {milestone.name}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <Badge
                        size="sm"
                        variant="light"
                        color={milestone.priority === 'P0' ? 'red' : 'gray'}
                      >
                        {milestone.priority}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: textColor }}>
                      {milestone.targetDate.toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: textColor }}>
                      <Badge
                        size="sm"
                        variant="dot"
                        color={milestone.daysRemaining <= 7 ? 'red' : milestone.daysRemaining <= 30 ? 'yellow' : 'green'}
                      >
                        {milestone.daysRemaining} days
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 8px', color: textColor }}>
                      {milestone.owner}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <Badge size="sm" variant="light" color="blue">
                        {milestone.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </Stack>
  );
};

export default RoadmapTimelinePage;
