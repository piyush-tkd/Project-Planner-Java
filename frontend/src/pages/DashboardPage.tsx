import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Stack, SimpleGrid, Text, Card, Group, Button, Table, Badge, Paper, ThemeIcon,
} from '@mantine/core';
import {
  IconUsers, IconBriefcase, IconFlame, IconAlertTriangle,
  IconChartBar, IconChartAreaLine, IconUserPlus, IconCalendar,
  IconTag, IconHexagons, IconArrowRight, IconHeadset,
} from '@tabler/icons-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  useExecutiveSummary, useUtilizationHeatmap, useHiringForecast, useCapacityDemandSummary,
} from '../api/reports';
import { useSupportSnapshot, useSupportBoards } from '../api/jira';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../utils/colors';
import { formatPercent, formatHours } from '../utils/formatting';
import { formatRole } from '../types';
import SummaryCard from '../components/charts/SummaryCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ExportableChart from '../components/common/ExportableChart';
import ChartCard from '../components/common/ChartCard';
import WidgetGrid, { Widget } from '../components/layout/WidgetGrid';
import { useDarkMode } from '../hooks/useDarkMode';
import { useJiraStatus, usePodWatchConfig, useReleaseConfig } from '../api/jira';
import { DEEP_BLUE, AQUA, AQUA_TINTS, FONT_FAMILY } from '../brandTokens';

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

  // Jira integration summary (cheap DB-backed calls — no Jira API hits)
  const { data: jiraStatus } = useJiraStatus();
  const { data: podConfig = [] } = usePodWatchConfig();
  const { data: releaseConfig = [] } = useReleaseConfig();

  const activePodCount = podConfig.filter(p => p.enabled).length;
  const trackedReleaseCount = releaseConfig.reduce((sum, c) => sum + c.versions.length, 0);

  // Support Queue summary (only fetch when Jira is configured)
  const { data: supportBoards = [] } = useSupportBoards();
  const hasConfiguredBoards = supportBoards.some(b => b.enabled);
  const { data: supportSnapshot } = useSupportSnapshot(jiraStatus?.configured && hasConfiguredBoards);
  const supportAllTickets = (supportSnapshot?.boards ?? []).flatMap(b => b.tickets);
  const supportStale = supportAllTickets.filter(t => t.stale).length;
  const supportTotal = supportAllTickets.length;
  const supportHealth = supportTotal === 0 ? 'gray'
    : (supportStale / supportTotal) > 0.3 ? 'red'
    : (supportStale / supportTotal) > 0.1 ? 'orange'
    : 'green';

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

  // Compute portfolio health status
  const healthStatus = useMemo(() => {
    if (!summary) return { color: 'gray', status: 'UNKNOWN' };
    const utilizationOverburdened = (summary.overallUtilizationPct ?? 0) > 100;
    const deficitMonths = summary.podMonthsInDeficit ?? 0;

    if (utilizationOverburdened || deficitMonths > 3) {
      return { color: '#fa5252', status: 'RED' };
    }
    if (deficitMonths > 0) {
      return { color: '#fd7e14', status: 'AMBER' };
    }
    return { color: '#51cf66', status: 'GREEN' };
  }, [summary]);

  // Generate portfolio narrative summary
  const portfolioNarrative = useMemo(() => {
    if (!summary || !capDemData) return '';
    const lines: string[] = [];

    // Line 1: P0 projects at risk
    const p0AtRisk = summary?.podMonthsInDeficit ?? 0;
    if (p0AtRisk > 0) {
      lines.push(`${p0AtRisk} POD-month${p0AtRisk !== 1 ? 's' : ''} in deficit`);
    }

    // Line 2: Utilization status
    const util = summary?.overallUtilizationPct ?? 0;
    if (util > 100) {
      lines.push(`Utilization at ${Math.round(util)}% (${Math.round(util - 100)}% overburdened)`);
    } else if (util < 70) {
      lines.push(`Utilization at ${Math.round(util)}% (capacity available)`);
    }

    // Line 3: Hiring needs
    if (hiringData && hiringData.length > 0) {
      const nextThreeMonths = hiringData.slice(0, 3);
      const totalNeeded = nextThreeMonths.reduce((sum, d) => sum + d.ftesNeeded, 0);
      if (totalNeeded > 0) {
        lines.push(`${Math.round(totalNeeded)} new hires recommended in next 3 months`);
      }
    }

    return lines.length > 0 ? lines.join('. ') + '.' : 'Portfolio is healthy.';
  }, [summary, capDemData, hiringData]);

  // Sparkline data for Overall Utilization (per month)
  const utilizationSparkline = useMemo(() => {
    if (!capDemData || capDemData.length === 0) return undefined;
    return capDemData.map(d => d.totalCapacityHours > 0
      ? Math.round((d.totalDemandHours / d.totalCapacityHours) * 100)
      : 0
    );
  }, [capDemData]);

  // Sparkline data for POD-Months in Deficit (deficit hours per month, abs value)
  const deficitSparkline = useMemo(() => {
    if (!capDemData || capDemData.length === 0) return undefined;
    return capDemData.map(d => d.netGapHours < 0 ? Math.abs(d.netGapHours) : 0);
  }, [capDemData]);

  if (summaryLoading) return <LoadingSpinner variant="dashboard" message="Loading dashboard..." />;

  return (
    <Stack pb="xl">
      <Title order={2}>Dashboard</Title>

      <WidgetGrid pageKey="dashboard">

        {/* ── Portfolio Health ── */}
        <Widget id="portfolio-health" title="Portfolio Health">
          <Paper
            p="lg"
            radius="md"
            withBorder
            style={{
              borderLeft: `4px solid ${healthStatus.color}`,
              background: dark ? 'rgba(0, 0, 0, 0.15)' : AQUA_TINTS[10],
            }}
          >
            <Group align="flex-start" gap="md">
              <ThemeIcon
                size={56}
                radius="100%"
                style={{
                  backgroundColor: healthStatus.color,
                  flexShrink: 0,
                }}
              />
              <Stack gap="xs" style={{ flex: 1 }}>
                <Group justify="space-between" align="center">
                  <Text fw={700} size="md" style={{ fontFamily: FONT_FAMILY }}>
                    Status: {healthStatus.status}
                  </Text>
                  <Badge
                    variant="light"
                    color={
                      healthStatus.status === 'RED' ? 'red'
                        : healthStatus.status === 'AMBER' ? 'orange'
                          : 'green'
                    }
                  >
                    {healthStatus.status === 'GREEN' ? 'Healthy' : healthStatus.status === 'AMBER' ? 'Watch' : 'At Risk'}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY, lineHeight: 1.5 }}>
                  {portfolioNarrative}
                </Text>
              </Stack>
            </Group>
          </Paper>
        </Widget>

        {/* ── KPI Summary ── */}
        <Widget id="kpi-cards" title="KPI Summary">
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
              sparkData={utilizationSparkline}
            />
            <SummaryCard
              title="POD-Months in Deficit"
              value={summary?.podMonthsInDeficit ?? 0}
              icon={<IconAlertTriangle size={20} color="#fa5252" />}
              color={(summary?.podMonthsInDeficit ?? 0) > 0 ? 'red' : 'green'}
              onClick={() => navigate('/reports/capacity-gap')}
              sparkData={deficitSparkline}
            />
          </SimpleGrid>
        </Widget>

        {/* ── Integrations quick-access widgets ── */}
        {jiraStatus?.configured && (
        <Widget id="jira-integrations" title="Jira Integrations">
        <SimpleGrid cols={{ base: 1, sm: hasConfiguredBoards ? 3 : 2 }}>
          {/* POD Dashboard widget */}
          <Card
            withBorder
            padding="lg"
            radius="md"
            onClick={() => navigate('/jira-pods')}
            style={{
              cursor: 'pointer',
              borderLeft: `4px solid ${DEEP_BLUE}`,
              transition: 'box-shadow 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '';
              (e.currentTarget as HTMLElement).style.transform = '';
            }}
          >
            <Group justify="space-between" align="flex-start">
              <Group gap="sm">
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    backgroundColor: DEEP_BLUE,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconHexagons size={22} color="white" />
                </div>
                <div>
                  <Text size="sm" c="dimmed" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                    POD Dashboard
                  </Text>
                  <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                    {activePodCount} Active POD{activePodCount !== 1 ? 's' : ''}
                  </Text>
                </div>
              </Group>
              <Group gap="xs" align="center" mt={4}>
                {podConfig.length > 0 && (
                  <Badge size="sm" variant="light" color="teal">
                    {podConfig.length} configured
                  </Badge>
                )}
                <IconArrowRight size={16} color={AQUA} />
              </Group>
            </Group>
            <Text size="xs" c="dimmed" mt="sm" style={{ fontFamily: FONT_FAMILY }}>
              Sprint progress, velocity, team utilization &amp; Jira board metrics
            </Text>
          </Card>

          {/* Release Tracker widget */}
          <Card
            withBorder
            padding="lg"
            radius="md"
            onClick={() => navigate('/jira-releases')}
            style={{
              cursor: 'pointer',
              borderLeft: `4px solid ${AQUA}`,
              transition: 'box-shadow 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '';
              (e.currentTarget as HTMLElement).style.transform = '';
            }}
          >
            <Group justify="space-between" align="flex-start">
              <Group gap="sm">
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    backgroundColor: AQUA,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconTag size={22} color="white" />
                </div>
                <div>
                  <Text size="sm" c="dimmed" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                    Release Tracker
                  </Text>
                  <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: AQUA }}>
                    {trackedReleaseCount} Version{trackedReleaseCount !== 1 ? 's' : ''}
                  </Text>
                </div>
              </Group>
              <Group gap="xs" align="center" mt={4}>
                {releaseConfig.length > 0 && (
                  <Badge size="sm" variant="light" color="cyan">
                    {releaseConfig.filter(c => c.versions.length > 0).length} PODs tracked
                  </Badge>
                )}
                <IconArrowRight size={16} color={AQUA} />
              </Group>
            </Group>
            <Text size="xs" c="dimmed" mt="sm" style={{ fontFamily: FONT_FAMILY }}>
              Fix version progress, issue types, hours logged &amp; release notes per POD
            </Text>
          </Card>

          {/* Support Queue widget */}
          {hasConfiguredBoards && (
            <Card
              withBorder
              padding="lg"
              radius="md"
              onClick={() => navigate('/jira-support')}
              style={{
                cursor: 'pointer',
                borderLeft: `4px solid ${supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : supportHealth === 'green' ? '#51cf66' : '#adb5bd'}`,
                transition: 'box-shadow 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '';
                (e.currentTarget as HTMLElement).style.transform = '';
              }}
            >
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      backgroundColor: supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : '#51cf66',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconHeadset size={22} color="white" />
                  </div>
                  <div>
                    <Text size="sm" c="dimmed" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                      Support Queue
                    </Text>
                    <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : '#2f9e44' }}>
                      {supportTotal} Open
                    </Text>
                  </div>
                </Group>
                <Group gap="xs" align="center" mt={4}>
                  {supportStale > 0 && (
                    <Badge size="sm" variant="light" color={supportHealth === 'red' ? 'red' : 'orange'}>
                      {supportStale} stale
                    </Badge>
                  )}
                  {supportStale === 0 && supportTotal > 0 && (
                    <Badge size="sm" variant="light" color="green">All active</Badge>
                  )}
                  <IconArrowRight size={16} color={supportHealth === 'red' ? '#fa5252' : AQUA} />
                </Group>
              </Group>
              <Text size="xs" c="dimmed" mt="sm" style={{ fontFamily: FONT_FAMILY }}>
                {supportBoards.filter(b => b.enabled).length} board{supportBoards.filter(b => b.enabled).length !== 1 ? 's' : ''} monitored — ticket health &amp; stale tracking
              </Text>
            </Card>
          )}
        </SimpleGrid>
        </Widget>
        )}

        {/* ── Capacity & Hiring Charts ── */}
        <Widget id="charts-capacity" title="Capacity & Hiring">
          {!capDemLoading && capDemChart.length > 0 && (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
          <ChartCard title="Capacity vs Demand — Full Year" minHeight={250}>
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
          </ChartCard>

          {hireChart.length > 0 && (
            <ChartCard title="New Hires Needed — Full Year" minHeight={250}>
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
            </ChartCard>
          )}
        </SimpleGrid>
          )}
        </Widget>

        {/* ── Utilization Heatmap ── */}
        <Widget id="heatmap" title="Utilization Overview">
          {!heatmapLoading && miniHeatmap.length > 0 && (
        <ChartCard title="Utilization Overview" minHeight={0}>
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
        </ChartCard>
          )}
        </Widget>

        {/* ── Quick Links ── */}
        <Widget id="quick-links" title="Quick Links">
          <Group>
            <Button variant="light" leftSection={<IconChartBar size={16} />} onClick={() => navigate('/reports/capacity-gap')}>Capacity Gap</Button>
            <Button variant="light" leftSection={<IconFlame size={16} />} onClick={() => navigate('/reports/utilization')}>Utilization Heatmap</Button>
            <Button variant="light" leftSection={<IconChartAreaLine size={16} />} onClick={() => navigate('/reports/capacity-demand')}>Capacity vs Demand</Button>
            <Button variant="light" leftSection={<IconAlertTriangle size={16} />} onClick={() => navigate('/reports/concurrency')}>Concurrency Risk</Button>
            <Button variant="light" leftSection={<IconUserPlus size={16} />} onClick={() => navigate('/reports/hiring-forecast')}>Hiring Forecast</Button>
            <Button variant="light" leftSection={<IconCalendar size={16} />} onClick={() => navigate('/reports/gantt')}>Project Gantt</Button>
          </Group>
        </Widget>

      </WidgetGrid>
    </Stack>
  );
}
