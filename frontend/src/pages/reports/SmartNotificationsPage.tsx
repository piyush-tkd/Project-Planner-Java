import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  Alert,
  Timeline,
  Divider,
  ScrollArea,
  Accordion,
  Button,
  ActionIcon,
  Skeleton,
  Center,
} from '@mantine/core';
import { notifications as notif } from '@mantine/notifications';
import {
  IconBell,
  IconAlertTriangle,
  IconClock,
  IconChecklist,
  IconFlame,
  IconCalendar,
  IconTrendingUp,
  IconUsers,
  IconRocket,
  IconCheck,
  IconRefresh,
  IconBrain,
} from '@tabler/icons-react';
import apiClient from '../../api/client';
import { AQUA, AQUA_TINTS, BORDER_SOFT, CHART_COLORS, COLOR_AMBER, COLOR_ERROR, COLOR_ERROR_LIGHT, COLOR_GREEN_LIGHT, DARK_MUTED, DARK_TEXT, DEEP_BLUE, DEEP_BLUE_TINTS, FONT_FAMILY, GRAY_300, GRAY_400, SHADOW, SURFACE_BLUE} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { EmptyState } from '../../components/ui';
import { useProjects } from '../../api/projects';
import { useResources } from '../../api/resources';
import { useProductivityMetrics, useCapacityDemandSummary } from '../../api/reports';
import { ProjectResponse } from '../../types/project';

interface Alert {
  type: 'critical' | 'warning' | 'info' | 'upcoming' | 'capacity';
  message: string;
  icon: React.ReactNode;
  color: string;
  timestamp: Date;
  projectName?: string;
}

const SmartNotificationsPage: React.FC = () => {
  const isDark = useDarkMode();
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: resources, isLoading: resourcesLoading } = useResources();
  const { data: metrics, isLoading: metricsLoading } = useProductivityMetrics();
  const { data: capacityData, isLoading: capacityLoading } = useCapacityDemandSummary();

  const today = useMemo(() => new Date(), []);
  const twoWeeksFromNow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 14);
    return d;
  }, [today]);

  const ninetyDaysAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 90);
    return d;
  }, [today]);

  // Compute all alerts
  const { alerts, criticalCount, warningCount, infoCount } = useMemo(() => {
    const allAlerts: Alert[] = [];

    if (!projects || projects.length === 0) {
      return { alerts: [], criticalCount: 0, warningCount: 0, infoCount: 0 };
    }

    // Overdue projects (red)
    projects.forEach((project: ProjectResponse) => {
      if (
        project.targetDate &&
        new Date(project.targetDate) < today &&
        project.status !== 'COMPLETED' &&
        project.status !== 'CANCELLED'
      ) {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(project.targetDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        allAlerts.push({
          type: 'critical',
          message: `🚨 ${project.name} is overdue by ${daysOverdue} days (Owner: ${project.owner || 'Unassigned'})`,
          icon: <IconAlertTriangle size={16} />,
          color: 'red',
          timestamp: new Date(project.targetDate),
          projectName: project.name,
        });
      }
    });

    // P0 still active (orange)
    projects.forEach((project: ProjectResponse) => {
      if (project.priority === 'P0' && project.status !== 'COMPLETED' && project.status !== 'CANCELLED') {
        allAlerts.push({
          type: 'warning',
          message: `⚠️ Critical project '${project.name}' still in ${project.status} (Owner: ${project.owner || 'Unassigned'})`,
          icon: <IconFlame size={16} />,
          color: 'orange',
          timestamp: new Date(),
          projectName: project.name,
        });
      }
    });

    // Stale projects (yellow)
    projects.forEach((project: ProjectResponse) => {
      if (project.status === 'ACTIVE' && project.createdAt) {
        const daysActive = Math.floor(
          (today.getTime() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysActive > 90) {
          allAlerts.push({
            type: 'warning',
            message: `⏰ '${project.name}' has been active for ${daysActive} days without completion`,
            icon: <IconClock size={16} />,
            color: 'yellow',
            timestamp: new Date(project.createdAt),
            projectName: project.name,
          });
        }
      }
    });

    // Capacity concerns (blue)
    if (capacityData && Array.isArray(capacityData)) {
      capacityData.forEach((item: any) => {
        if (item.gap !== undefined && item.gap < 0) {
          allAlerts.push({
            type: 'capacity',
            message: `📊 Capacity deficit detected in ${item.month || 'upcoming period'}`,
            icon: <IconUsers size={16} />,
            color: 'blue',
            timestamp: new Date(),
          });
        }
      });
    }

    // Upcoming deadlines (green)
    projects.forEach((project: ProjectResponse) => {
      if (project.targetDate) {
        const targetDate = new Date(project.targetDate);
        if (targetDate > today && targetDate <= twoWeeksFromNow && project.status !== 'COMPLETED') {
          const daysUntil = Math.floor(
            (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          allAlerts.push({
            type: 'upcoming',
            message: `📅 '${project.name}' due in ${daysUntil} days (Priority: ${project.priority || 'Medium'})`,
            icon: <IconCalendar size={16} />,
            color: 'green',
            timestamp: targetDate,
            projectName: project.name,
          });
        }
      }
    });

    // Sort alerts: red → orange → yellow → blue → green
    const colorOrder: Record<string, number> = { red: 0, orange: 1, yellow: 2, blue: 3, green: 4 };
    allAlerts.sort((a, b) => (colorOrder[a.color] || 5) - (colorOrder[b.color] || 5));

    // Limit to 20 alerts
    const limitedAlerts = allAlerts.slice(0, 20);

    // Count by type
    const critical = limitedAlerts.filter((a) => a.type === 'critical').length;
    const warning = limitedAlerts.filter((a) => a.type === 'warning' || a.type === 'capacity').length;
    const info = limitedAlerts.filter((a) => a.type === 'upcoming').length;

    return { alerts: limitedAlerts, criticalCount: critical, warningCount: warning, infoCount: info };
  }, [projects, today, twoWeeksFromNow, capacityData]);

  // Portfolio summary
  const portfolioSummary = useMemo(() => {
    if (!projects || projects.length === 0) {
      return { total: 0, active: 0, completed: 0, rate: 0, teams: 0, pods: 0 };
    }
    const active = projects.filter((p: ProjectResponse) => p.status === 'ACTIVE').length;
    const completed = projects.filter((p: ProjectResponse) => p.status === 'COMPLETED').length;
    const rate = projects.length > 0 ? Math.round((completed / projects.length) * 100) : 0;
    const teams = resources ? resources.length : 0;
    const pods = resources ? new Set(resources.map((r: any) => r.pod)).size : 0;

    return { total: projects.length, active, completed, rate, teams, pods };
  }, [projects, resources]);

  // Risk items
  const riskItems = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    return projects.filter(
      (p: ProjectResponse) =>
        (p.targetDate && new Date(p.targetDate) < today && p.status !== 'COMPLETED' && p.status !== 'CANCELLED') ||
        p.status === 'ON_HOLD' ||
        p.status === 'BLOCKED'
    );
  }, [projects, today]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (portfolioSummary.rate < 50) {
      recs.push('Consider reviewing project scoping — completion rate is below 50%');
    }
    const p0Count = projects?.filter((p: ProjectResponse) => p.priority === 'P0' && p.status !== 'COMPLETED').length || 0;
    if (p0Count > 3) {
      recs.push('Multiple critical projects in flight — consider priority triage');
    }
    const staleCount = projects?.filter(
      (p: ProjectResponse) =>
        p.status === 'ACTIVE' &&
        p.createdAt &&
        (today.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24) > 90
    ).length || 0;
    if (staleCount > 5) {
      recs.push('Several projects may need status updates');
    }
    const deficitMonths = capacityData ? capacityData.filter((d: any) => d.gap !== undefined && d.gap < 0).length : 0;
    if (deficitMonths > 0) {
      recs.push('Plan hiring or reallocation for deficit months');
    }
    if (recs.length === 0) {
      recs.push('Portfolio health looks good! Continue monitoring key metrics.');
    }
    return recs;
  }, [portfolioSummary, projects, capacityData, today]);

  // ── AI Insights state ────────────────────────────────────────────────────
  interface InsightDto {
    id: number; insightType: string; severity: string;
    title: string; description: string;
    entityType?: string; entityId?: number; entityName?: string;
    detectedAt: string; acknowledged: boolean;
  }
  const [insights, setInsights]       = useState<InsightDto[]>([]);
  const [insightsLoading, setIL]      = useState(true);
  const [runningDetectors, setRunning] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/insights');
      setInsights(data ?? []);
    } catch { /* silent — backend may not have data yet */ }
    finally { setIL(false); }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const handleRunDetectors = async () => {
    setRunning(true);
    try {
      const { data } = await apiClient.post('/insights/run');
      setInsights(data ?? []);
      notif.show({ title: 'Done', message: 'Insight detection complete', color: 'teal' });
    } catch {
      notif.show({ title: 'Error', message: 'Detection failed', color: 'red' });
    } finally { setRunning(false); }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await apiClient.put(`/insights/${id}/ack`);
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch {
      notif.show({ title: 'Error', message: 'Could not acknowledge insight', color: 'red' });
    }
  };

  const insightSeverityColor = (sev: string) =>
    sev === 'HIGH' ? 'red' : sev === 'MEDIUM' ? 'orange' : 'yellow';

  // ── Thresholds summary
  const thresholdStats = useMemo(() => {
    const overdueCount = projects?.filter(
      (p: ProjectResponse) =>
        p.targetDate &&
        new Date(p.targetDate) < today &&
        p.status !== 'COMPLETED' &&
        p.status !== 'CANCELLED'
    ).length || 0;
    const staleCount = projects?.filter(
      (p: ProjectResponse) =>
        p.status === 'ACTIVE' &&
        p.createdAt &&
        (today.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24) > 90
    ).length || 0;
    const capacityDeficitMonths = capacityData ? capacityData.filter((d: any) => d.gap !== undefined && d.gap < 0).length : 0;
    const p0Active = projects?.filter((p: ProjectResponse) => p.priority === 'P0' && p.status !== 'COMPLETED').length || 0;

    return { overdueCount, staleCount, capacityDeficitMonths, p0Active };
  }, [projects, capacityData, today]);

  // Loading and error states
  if (projectsLoading || metricsLoading || resourcesLoading || capacityLoading) {
    return <LoadingSpinner />;
  }

  if (projectsError) {
    return <PageError error={projectsError} />;
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={<IconBell size={40} stroke={1.5} />}
        title="No notifications yet"
        description="Add projects to your portfolio and Smart Notifications will automatically surface overdue deadlines, P0 risks, stale work, and capacity alerts."
      />
    );
  }

  const getAlertColor = (color: string) => {
    const colorMap: Record<string, string> = {
      red: CHART_COLORS[0] || COLOR_ERROR_LIGHT,
      orange: CHART_COLORS[1] || '#FFA94D',
      yellow: CHART_COLORS[2] || '#FFD93D',
      blue: DEEP_BLUE,
      green: CHART_COLORS[3] || COLOR_GREEN_LIGHT,
    };
    return colorMap[color] || DEEP_BLUE;
  };

  return (
    <Stack gap="lg" style={{ padding: '24px', fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <div>
        <Title order={1} style={{ color: isDark ? '#fff' : DEEP_BLUE, fontSize: '28px', fontWeight: 700 }}>
          Smart Notifications
        </Title>
        <Text size="md" style={{ color: isDark ? GRAY_300 : '#666', marginTop: '8px' }}>
          Automated alerts, weekly digest, and portfolio health monitoring
        </Text>
      </div>

      {/* ── AI Proactive Insights ── */}
      <Card
        p="lg"
        radius="md"
        style={{
          backgroundColor: isDark ? DARK_TEXT : '#fff',
          border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
          boxShadow: SHADOW.card,
        }}
      >
        <Card.Section inheritPadding py="md" style={{ borderBottom: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}` }}>
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon color="violet" variant="light" size="lg" radius="md">
                <IconBrain size={18} />
              </ThemeIcon>
              <div>
                <Title order={3} style={{ fontSize: '18px', fontWeight: 600, color: isDark ? '#fff' : DEEP_BLUE }}>
                  AI Proactive Insights
                </Title>
                <Text size="xs" c="dimmed">Automatically detected signals — refreshed daily at 07:00</Text>
              </div>
            </Group>
            <Group gap="xs">
              <Badge variant="light" color="violet">{insights.length} active</Badge>
              <Button
                size="xs"
                variant="light"
                color="violet"
                leftSection={<IconRefresh size={13} />}
                loading={runningDetectors}
                onClick={handleRunDetectors}
              >
                Run now
              </Button>
            </Group>
          </Group>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          {insightsLoading ? (
            <Skeleton height={120} radius="sm" />
          ) : insights.length === 0 ? (
            <Alert icon={<IconChecklist size={16} />} title="No active insights" color="teal">
              All clear! Run the detector to scan for new signals.
            </Alert>
          ) : (
            <Stack gap="sm">
              {insights.map(ins => (
                <Paper
                  key={ins.id}
                  p="sm"
                  radius="sm"
                  style={{
                    backgroundColor: isDark ? DARK_MUTED : '#f9fafb',
                    border: `1px solid ${isDark ? '#4b5563' : BORDER_SOFT}`,
                    borderLeft: `4px solid ${ins.severity === 'HIGH' ? COLOR_ERROR : ins.severity === 'MEDIUM' ? '#ff922b' : COLOR_AMBER}`,
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" mb={4}>
                        <Badge size="xs" color={insightSeverityColor(ins.severity)} variant="filled">
                          {ins.severity}
                        </Badge>
                        <Badge size="xs" color="gray" variant="light">{ins.insightType.replace(/_/g, ' ')}</Badge>
                        {ins.entityName && (
                          <Text size="xs" c="dimmed" truncate>{ins.entityName}</Text>
                        )}
                      </Group>
                      <Text size="sm" fw={600} style={{ color: isDark ? BORDER_SOFT : DARK_TEXT }}>
                        {ins.title}
                      </Text>
                      {ins.description && (
                        <Text size="xs" c="dimmed" mt={2}>{ins.description}</Text>
                      )}
                    </div>
                    <Tooltip label="Acknowledge — removes from active feed">
                      <ActionIcon
                        variant="light"
                        color="teal"
                        size="sm"
                        onClick={() => handleAcknowledge(ins.id)}
                        aria-label="Acknowledge"
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Card.Section>
      </Card>

      {/* Alert Summary */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        {/* Critical Alerts */}
        <Paper
          p="lg"
          radius="md"
          style={{
            backgroundColor: isDark ? DARK_TEXT : '#fff',
            border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
            boxShadow: SHADOW.card,
          }}
        >
          <Group justify="space-between" align="flex-start" mb="sm">
            <div>
              <Text size="sm" style={{ color: isDark ? GRAY_400 : '#666', fontWeight: 500 }}>
                Critical Alerts
              </Text>
              <Title order={2} style={{ fontSize: '32px', fontWeight: 700, color: COLOR_ERROR_LIGHT, marginTop: '8px' }}>
                {criticalCount}
              </Title>
            </div>
            <ThemeIcon radius="md" size="lg" style={{ backgroundColor: '#ffe0e0' }}>
              <IconAlertTriangle size={20} color={COLOR_ERROR_LIGHT} />
            </ThemeIcon>
          </Group>
          <Text size="xs" style={{ color: isDark ? '#6b7280' : '#999' }}>
            Overdue & P0 projects
          </Text>
        </Paper>

        {/* Warnings */}
        <Paper
          p="lg"
          radius="md"
          style={{
            backgroundColor: isDark ? DARK_TEXT : '#fff',
            border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
            boxShadow: SHADOW.card,
          }}
        >
          <Group justify="space-between" align="flex-start" mb="sm">
            <div>
              <Text size="sm" style={{ color: isDark ? GRAY_400 : '#666', fontWeight: 500 }}>
                Warnings
              </Text>
              <Title order={2} style={{ fontSize: '32px', fontWeight: 700, color: '#FFA94D', marginTop: '8px' }}>
                {warningCount}
              </Title>
            </div>
            <ThemeIcon radius="md" size="lg" style={{ backgroundColor: '#ffe4c4' }}>
              <IconClock size={20} color="#FFA94D" />
            </ThemeIcon>
          </Group>
          <Text size="xs" style={{ color: isDark ? '#6b7280' : '#999' }}>
            Stale & capacity concerns
          </Text>
        </Paper>

        {/* Info */}
        <Paper
          p="lg"
          radius="md"
          style={{
            backgroundColor: isDark ? DARK_TEXT : '#fff',
            border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
            boxShadow: SHADOW.card,
          }}
        >
          <Group justify="space-between" align="flex-start" mb="sm">
            <div>
              <Text size="sm" style={{ color: isDark ? GRAY_400 : '#666', fontWeight: 500 }}>
                Upcoming Deadlines
              </Text>
              <Title order={2} style={{ fontSize: '32px', fontWeight: 700, color: DEEP_BLUE, marginTop: '8px' }}>
                {infoCount}
              </Title>
            </div>
            <ThemeIcon radius="md" size="lg" style={{ backgroundColor: AQUA_TINTS[10] }}>
              <IconBell size={20} color={DEEP_BLUE} />
            </ThemeIcon>
          </Group>
          <Text size="xs" style={{ color: isDark ? '#6b7280' : '#999' }}>
            In next 14 days
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Active Alerts Timeline */}
      <Card
        p="lg"
        radius="md"
        style={{
          backgroundColor: isDark ? DARK_TEXT : '#fff',
          border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
          boxShadow: SHADOW.card,
        }}
      >
        <Card.Section inheritPadding py="md" style={{ borderBottom: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}` }}>
          <Group justify="space-between">
            <Title order={3} style={{ fontSize: '18px', fontWeight: 600, color: isDark ? '#fff' : DEEP_BLUE }}>
              Active Alerts
            </Title>
            <Badge variant="light" color="blue">
              {alerts.length} alerts
            </Badge>
          </Group>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          {alerts.length === 0 ? (
            <Alert icon={<IconChecklist size={16} />} title="All clear!" color="green" style={{ fontFamily: FONT_FAMILY }}>
              No critical issues detected. Keep up the great work!
            </Alert>
          ) : (
            <Timeline active={-1} bulletSize={24} lineWidth={2}>
              {alerts.map((alert, idx) => (
                <Timeline.Item
                  key={idx}
                  bullet={
                    <ThemeIcon color={alert.color} size={24} radius="xl">
                      {alert.icon}
                    </ThemeIcon>
                  }
                >
                  <Text style={{ color: isDark ? BORDER_SOFT : DARK_TEXT, fontWeight: 500 }}>{alert.message}</Text>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Card.Section>
      </Card>

      {/* Weekly Digest */}
      <Card
        p="lg"
        radius="md"
        style={{
          backgroundColor: isDark ? DARK_TEXT : '#fff',
          border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
          boxShadow: SHADOW.card,
        }}
      >
        <Card.Section inheritPadding py="md" style={{ borderBottom: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}` }}>
          <Title order={3} style={{ fontSize: '18px', fontWeight: 600, color: isDark ? '#fff' : DEEP_BLUE }}>
            Weekly Digest
          </Title>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          <Accordion variant="contained">
            {/* Portfolio Summary */}
            <Accordion.Item value="portfolio">
              <Accordion.Control>
                <Text style={{ fontWeight: 600 }}>Portfolio Summary</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text style={{ color: isDark ? '#d1d5db' : '#444', lineHeight: 1.8 }}>
                  Total: {portfolioSummary.total} projects | Active: {portfolioSummary.active} | Completed:{' '}
                  {portfolioSummary.completed} | Completion Rate: {portfolioSummary.rate}%
                  <br />
                  Resources: {portfolioSummary.teams} team members across {portfolioSummary.pods} PODs
                </Text>
              </Accordion.Panel>
            </Accordion.Item>

            {/* This Week's Focus */}
            <Accordion.Item value="focus">
              <Accordion.Control>
                <Text style={{ fontWeight: 600 }}>This Week's Focus</Text>
              </Accordion.Control>
              <Accordion.Panel>
              <ScrollArea>
                <Table striped highlightOnHover style={{ fontSize: '14px' }}>
                  <Table.Thead style={{ backgroundColor: isDark ? DARK_MUTED : '#f3f4f6' }}>
                    <Table.Tr>
                      <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Project</Table.Th>
                      <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Priority</Table.Th>
                      <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Owner</Table.Th>
                      <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Status</Table.Th>
                      <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Target Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {projects
                      ?.filter(
                        (p) =>
                          (p.priority === 'P0' || p.priority === 'P1') &&
                          p.status === 'ACTIVE'
                      )
                      .slice(0, 10)
                      .map((project, idx) => (
                        <Table.Tr key={idx}>
                          <Table.Td style={{ color: isDark ? BORDER_SOFT : DARK_TEXT }}>
                            {project.name}
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="sm"
                              color={project.priority === 'P0' ? 'red' : 'orange'}
                              variant="light"
                            >
                              {project.priority}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ color: isDark ? '#d1d5db' : '#666' }}>
                            {project.owner || 'Unassigned'}
                          </Table.Td>
                          <Table.Td>
                            <Badge size="sm" variant="light" color="blue">
                              {project.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ color: isDark ? '#d1d5db' : '#666' }}>
                            {project.targetDate
                              ? new Date(project.targetDate).toLocaleDateString()
                              : 'N/A'}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              </Accordion.Panel>
            </Accordion.Item>

            {/* Risk Items */}
            <Accordion.Item value="risks">
              <Accordion.Control>
                <Text style={{ fontWeight: 600 }}>Risk Items ({riskItems.length})</Text>
              </Accordion.Control>
              <Accordion.Panel>
              <Stack gap="sm">
                {riskItems.length === 0 ? (
                  <Text style={{ color: isDark ? GRAY_400 : '#999' }}>No risk items detected.</Text>
                ) : (
                  riskItems.slice(0, 15).map((project, idx) => (
                    <Paper
                      key={idx}
                      p="sm"
                      radius="sm"
                      style={{
                        backgroundColor: isDark ? DARK_MUTED : '#f9fafb',
                        border: `1px solid ${isDark ? '#4b5563' : BORDER_SOFT}`,
                      }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Text style={{ fontWeight: 600, color: isDark ? '#fff' : DARK_TEXT }}>
                          {project.name}
                        </Text>
                        <Badge
                          size="sm"
                          color={
                            project.status === 'BLOCKED'
                              ? 'red'
                              : project.status === 'ON_HOLD'
                                ? 'yellow'
                                : 'orange'
                          }
                          variant="light"
                        >
                          {project.status}
                        </Badge>
                      </Group>
                      <Text size="sm" style={{ color: isDark ? '#d1d5db' : '#666' }}>
                        Owner: {project.owner || 'Unassigned'} | Priority: {project.priority || 'Medium'} |
                        Target: {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'N/A'}
                      </Text>
                    </Paper>
                  ))
                )}
              </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* Recommendations */}
            <Accordion.Item value="recommendations">
              <Accordion.Control>
                <Text style={{ fontWeight: 600 }}>Recommendations</Text>
              </Accordion.Control>
              <Accordion.Panel>
              <Stack gap="sm">
                {recommendations.map((rec, idx) => (
                  <Paper
                    key={idx}
                    p="sm"
                    radius="sm"
                    style={{
                      backgroundColor: isDark ? DARK_MUTED : SURFACE_BLUE,
                      border: `1px solid ${isDark ? '#4b5563' : '#bfdbfe'}`,
                      borderLeft: `4px solid ${DEEP_BLUE}`,
                    }}
                  >
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                        <IconRocket size={16} />
                      </ThemeIcon>
                      <Text style={{ color: isDark ? BORDER_SOFT : DARK_TEXT, flex: 1 }}>
                        {rec}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Card.Section>
      </Card>

      {/* Threshold Settings */}
      <Card
        p="lg"
        radius="md"
        style={{
          backgroundColor: isDark ? DARK_TEXT : '#fff',
          border: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}`,
          boxShadow: SHADOW.card,
        }}
      >
        <Card.Section inheritPadding py="md" style={{ borderBottom: `1px solid ${isDark ? DARK_MUTED : BORDER_SOFT}` }}>
          <Title order={3} style={{ fontSize: '18px', fontWeight: 600, color: isDark ? '#fff' : DEEP_BLUE }}>
            Threshold Settings
          </Title>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          <ScrollArea>
            <Table striped style={{ fontSize: '14px' }}>
              <Table.Thead style={{ backgroundColor: isDark ? DARK_MUTED : '#f3f4f6' }}>
                <Table.Tr>
                  <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Alert Type</Table.Th>
                  <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Threshold</Table.Th>
                  <Table.Th style={{ color: isDark ? '#fff' : DEEP_BLUE, fontWeight: 600 }}>Current Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td style={{ color: isDark ? BORDER_SOFT : DARK_TEXT, fontWeight: 500 }}>Overdue</Table.Td>
                  <Table.Td style={{ color: isDark ? '#d1d5db' : '#666' }}>targetDate &lt; today</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={thresholdStats.overdueCount > 0 ? 'red' : 'green'}>
                      {thresholdStats.overdueCount} projects
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td style={{ color: isDark ? BORDER_SOFT : DARK_TEXT, fontWeight: 500 }}>Stale</Table.Td>
                  <Table.Td style={{ color: isDark ? '#d1d5db' : '#666' }}>Active &gt; 90 days</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={thresholdStats.staleCount > 0 ? 'yellow' : 'green'}>
                      {thresholdStats.staleCount} projects
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td style={{ color: isDark ? BORDER_SOFT : DARK_TEXT, fontWeight: 500 }}>Capacity</Table.Td>
                  <Table.Td style={{ color: isDark ? '#d1d5db' : '#666' }}>gap &lt; 0</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={thresholdStats.capacityDeficitMonths > 0 ? 'orange' : 'green'}>
                      {thresholdStats.capacityDeficitMonths} months
                    </Badge>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td style={{ color: isDark ? BORDER_SOFT : DARK_TEXT, fontWeight: 500 }}>P0 Active</Table.Td>
                  <Table.Td style={{ color: isDark ? '#d1d5db' : '#666' }}>P0 + ACTIVE</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={thresholdStats.p0Active > 3 ? 'orange' : 'green'}>
                      {thresholdStats.p0Active} projects
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card.Section>
      </Card>
    </Stack>
  );
};

export default SmartNotificationsPage;
