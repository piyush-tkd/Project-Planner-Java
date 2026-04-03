import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Title, Stack, SimpleGrid, Text, Card, Group, Button, Table, Badge, Paper, ThemeIcon, ScrollArea} from '@mantine/core';
import {
 IconUsers, IconBriefcase, IconFlame, IconAlertTriangle,
 IconChartBar, IconChartAreaLine, IconUserPlus, IconCalendar,
 IconTag, IconHexagons, IconArrowRight, IconHeadset, IconSparkles,
 IconArrowsLeftRight,
} from '@tabler/icons-react';
import { usePodHours } from '../api/podHours';
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
import { DEEP_BLUE, AQUA, AQUA_TINTS, FONT_FAMILY, SHADOW } from '../brandTokens';

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

 // POD Hours for current month — used for buffer alert widget
 const now = new Date();
 const { data: podHoursData } = usePodHours(now.getFullYear(), 'MONTHLY', now.getMonth() + 1);

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
 <Stack pb="xl" style={{ position: 'relative' }}>
 <div className="dashboard-page">
 <Group align="center" gap="md" mb={4}>
 <Title order={2} style={{
 fontFamily: FONT_FAMILY,
 fontWeight: 700,
 letterSpacing: '-0.02em',
 color: dark ? '#fff' : DEEP_BLUE,
 }}>Dashboard</Title>
 <div style={{
 height: 3,
 flex: 1,
 background: `linear-gradient(90deg, ${AQUA}, transparent)`,
 borderRadius: 2,
 opacity: 0.6,
 }} />
 </Group>
 </div>

 <WidgetGrid pageKey="dashboard">

 {/* ── Portfolio Health ── */}
 <Widget id="portfolio-health" title="Portfolio Health">
 <Paper
 p="xl"
 radius="lg"
 className="health-card-modern"
 style={{
 border: `1px solid ${healthStatus.color}30`,
 background: dark
 ? `linear-gradient(135deg, ${healthStatus.color}15 0%, rgba(0, 0, 0, 0.3) 50%, ${healthStatus.color}08 100%)`
 : `linear-gradient(135deg, ${healthStatus.color}10 0%, rgba(255, 255, 255, 0.8) 50%, ${healthStatus.color}05 100%)`,
 backdropFilter: 'blur(12px)',
 }}
 >
 {/* Top gradient accent */}
 <div style={{
 position: 'absolute',
 top: 0,
 left: 0,
 right: 0,
 height: 4,
 background: `linear-gradient(90deg, ${healthStatus.color}, ${AQUA}, ${healthStatus.color})`,
 backgroundSize: '200% 100%',
 animation: 'gradient-shift 3s ease infinite',
 borderRadius: '16px 16px 0 0',
 }} />
 <Group align="flex-start" gap="lg">
 <div style={{ position: 'relative', width: 64, height: 64 }}>
 <ThemeIcon
 size={64}
 radius="100%"
 style={{
 backgroundColor: healthStatus.color,
 boxShadow: `0 0 30px ${healthStatus.color}40, 0 0 60px ${healthStatus.color}15`,
 position: 'relative',
 zIndex: 1,
 }}
 />
 <div style={{
 position: 'absolute',
 inset: -8,
 borderRadius: '50%',
 border: `2px solid ${healthStatus.color}40`,
 animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
 }} />
 <div style={{
 position: 'absolute',
 inset: -16,
 borderRadius: '50%',
 border: `1px solid ${healthStatus.color}20`,
 animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.5s',
 }} />
 </div>
 <Stack gap="xs" style={{ flex: 1 }}>
 <Group justify="space-between" align="center">
 <Text fw={800} size="lg" style={{ fontFamily: FONT_FAMILY, letterSpacing: '-0.01em' }}>
 Status: {healthStatus.status}
 </Text>
 <Badge
 variant="gradient"
 gradient={
 healthStatus.status === 'GREEN'
 ? { from: '#51cf66', to: '#40c057' }
 : healthStatus.status === 'AMBER'
 ? { from: '#fd7e14', to: '#f59f00' }
 : { from: '#fa5252', to: '#e03131' }
 }
 size="lg"
 style={{ boxShadow: `0 2px 8px ${healthStatus.color}30` }}
 >
 {healthStatus.status === 'GREEN' ? 'Healthy' : healthStatus.status === 'AMBER' ? 'Watch' : 'At Risk'}
 </Badge>
 </Group>
 <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY, lineHeight: 1.6 }}>
 {portfolioNarrative}
 </Text>
 </Stack>
 </Group>
 </Paper>
 </Widget>

 {/* ── KPI Summary ── */}
 <Widget id="kpi-cards" title="KPI Summary">
 <div className="section-header-modern" style={{ marginBottom: 16 }}>
 <ThemeIcon
 size={28}
 variant="gradient"
 gradient={{ from: AQUA, to: DEEP_BLUE, deg: 135 }}
 radius="lg"
 style={{ boxShadow: `0 2px 8px ${AQUA}30` }}
 >
 <IconSparkles size={16} />
 </ThemeIcon>
 <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE, letterSpacing: '-0.01em' }}>
 Key Performance Indicators
 </Text>
 </div>
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
 radius="lg"
 onClick={() => navigate('/jira-pods')}
 className="jira-card-modern"
 style={{
 cursor: 'pointer',
 borderLeft: `4px solid ${DEEP_BLUE}`,
 background: dark
 ? `linear-gradient(135deg, rgba(12, 35, 64, 0.15) 0%, rgba(45, 204, 211, 0.04) 100%)`
 : `linear-gradient(135deg, ${DEEP_BLUE}06 0%, rgba(255, 255, 255, 0.8) 100%)`,
 }}
 >
 <Group justify="space-between" align="flex-start">
 <Group gap="sm">
 <div
 style={{
 width: 44, height: 44, borderRadius: 12,
 background: `linear-gradient(135deg, ${DEEP_BLUE}, ${AQUA})`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0,
 boxShadow: `0 4px 12px ${DEEP_BLUE}30`,
 }}
 >
 <IconHexagons size={22} color="white" />
 </div>
 <div>
 <Text size="sm" c="dimmed" fw={500} style={{ fontFamily: FONT_FAMILY }}>
 POD Dashboard
 </Text>
 <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {activePodCount} Active POD{activePodCount !== 1 ? 's' : ''}
 </Text>
 </div>
 </Group>
 <Group gap="xs" align="center" mt={4}>
 {podConfig.length > 0 && (
 <Badge size="sm" variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}>
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
 radius="lg"
 onClick={() => navigate('/jira-releases')}
 className="jira-card-modern"
 style={{
 cursor: 'pointer',
 borderLeft: `4px solid ${AQUA}`,
 background: dark
 ? `linear-gradient(135deg, rgba(45, 204, 211, 0.06) 0%, rgba(0, 0, 0, 0.2) 100%)`
 : `linear-gradient(135deg, ${AQUA}06 0%, rgba(255, 255, 255, 0.8) 100%)`,
 }}
 >
 <Group justify="space-between" align="flex-start">
 <Group gap="sm">
 <div
 style={{
 width: 44, height: 44, borderRadius: 12,
 background: `linear-gradient(135deg, ${AQUA}, #40c9c0)`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0,
 boxShadow: `0 4px 12px ${AQUA}30`,
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
 radius="lg"
 onClick={() => navigate('/jira-support')}
 className="jira-card-modern"
 style={{
 cursor: 'pointer',
 borderLeft: `4px solid ${supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : supportHealth === 'green' ? '#51cf66' : '#adb5bd'}`,
 background: dark
 ? `linear-gradient(135deg, ${supportHealth === 'red' ? 'rgba(250, 82, 82, 0.06)' : supportHealth === 'orange' ? 'rgba(253, 126, 20, 0.06)' : 'rgba(81, 207, 102, 0.06)'} 0%, rgba(0, 0, 0, 0.2) 100%)`
 : `linear-gradient(135deg, ${supportHealth === 'red' ? '#fa525208' : supportHealth === 'orange' ? '#fd7e1408' : '#51cf6608'} 0%, rgba(255, 255, 255, 0.8) 100%)`,
 }}
 >
 <Group justify="space-between" align="flex-start">
 <Group gap="sm">
 <div
 style={{
 width: 44, height: 44, borderRadius: 12,
 background: `linear-gradient(135deg, ${supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : '#51cf66'}, ${supportHealth === 'red' ? '#e03131' : supportHealth === 'orange' ? '#f08c00' : '#40c057'})`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0,
 boxShadow: `0 4px 12px ${supportHealth === 'red' ? '#fa525230' : supportHealth === 'orange' ? '#fd7e1430' : '#51cf6630'}`,
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
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
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
 </ScrollArea>
 </ChartCard>
 )}
 </Widget>

 {/* ── Buffer Alert Widget ── */}
 {(() => {
 const highBufferPods = (podHoursData?.podSummaries ?? []).filter(pod => {
 if (pod.totalHours <= 0) return false;
 // Need to compute buffer hours for this pod from resources
 const bufferHours = (podHoursData?.resources ?? [])
 .flatMap(r => r.pods.filter(p => p.podName === pod.podName && p.buffer))
 .reduce((s, p) => s + p.hours, 0);
 return (bufferHours / pod.totalHours) > 0.5;
 });
 if (highBufferPods.length === 0) return null;
 return (
 <Widget id="buffer-alerts" title="Buffer Alerts">
 <Group mb="sm" gap="xs" align="center">
 <ThemeIcon size={28} radius="md" color="orange" variant="light">
 <IconArrowsLeftRight size={16} />
 </ThemeIcon>
 <div>
 <Text size="sm" fw={700} c="orange">High Buffer Contribution Alert</Text>
 <Text size="xs" c="dimmed">{podHoursData?.periodLabel ?? 'Current month'} · {highBufferPods.length} POD{highBufferPods.length > 1 ? 's' : ''} with &gt;50% buffer hours</Text>
 </div>
 </Group>
 <Stack gap="xs">
 {highBufferPods.map(pod => {
 const bufferHours = (podHoursData?.resources ?? [])
 .flatMap(r => r.pods.filter(p => p.podName === pod.podName && p.buffer))
 .reduce((s, p) => s + p.hours, 0);
 const bufferPct = Math.round((bufferHours / pod.totalHours) * 100);
 return (
 <Paper key={pod.podId} withBorder p="xs" radius="sm"
 style={{ borderLeft: '3px solid #fd7e14', background: dark ? 'rgba(253,126,20,0.05)' : '#fff8f0' }}>
 <Group justify="space-between" wrap="nowrap">
 <div>
 <Text size="sm" fw={600}>{pod.podName}</Text>
 <Text size="xs" c="dimmed">{bufferHours.toFixed(1)} h buffer / {pod.totalHours.toFixed(1)} h total</Text>
 </div>
 <Group gap="xs">
 <Badge color="orange" variant="filled" size="sm">{bufferPct}% buffer</Badge>
 <Button size="xs" variant="subtle" color="orange"
 rightSection={<IconArrowRight size={12} />}
 onClick={() => navigate('/reports/pod-hours')}>
 View
 </Button>
 </Group>
 </Group>
 </Paper>
 );
 })}
 </Stack>
 </Widget>
 );
 })()}

 {/* ── Quick Links ── */}
 <Widget id="quick-links" title="Quick Links">
 <Group wrap="wrap" gap="sm">
 {[
 { icon: IconChartBar, label: 'Capacity Gap', path: '/reports/capacity-gap' },
 { icon: IconFlame, label: 'Utilization', path: '/reports/utilization' },
 { icon: IconChartAreaLine, label: 'Capacity vs Demand', path: '/reports/capacity-demand' },
 { icon: IconAlertTriangle, label: 'Concurrency Risk', path: '/reports/concurrency' },
 { icon: IconUserPlus, label: 'Hiring Forecast', path: '/reports/hiring-forecast' },
 { icon: IconCalendar, label: 'Project Gantt', path: '/reports/gantt' },
 ].map(({ icon: Icon, label, path }) => (
 <Button
 key={path}
 onClick={() => navigate(path)}
 variant="light"
 radius="xl"
 size="sm"
 leftSection={<Icon size={16} className="quick-link-icon" />}
 className="quick-link-pill"
 style={{
 fontFamily: FONT_FAMILY,
 fontWeight: 600,
 border: `1px solid ${dark ? 'rgba(45, 204, 211, 0.15)' : `${AQUA}25`}`,
 background: dark
 ? 'linear-gradient(135deg, rgba(45, 204, 211, 0.08), rgba(12, 35, 64, 0.2))'
 : `linear-gradient(135deg, ${AQUA}10, ${DEEP_BLUE}05)`,
 color: dark ? AQUA : DEEP_BLUE,
 }}
 >
 {label}
 </Button>
 ))}
 </Group>
 </Widget>

 </WidgetGrid>
 </Stack>
 );
}
