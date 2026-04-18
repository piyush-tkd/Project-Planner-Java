import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import {
 Box, Text, Group, Stack, Badge, Button, Grid, Paper,
 Progress, Alert, ThemeIcon, Tooltip, Collapse,
 TextInput, SegmentedControl, Divider, ActionIcon, Skeleton,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
 IconTicket, IconRefresh, IconAlertTriangle, IconCircleCheck,
 IconChevronDown, IconChevronUp, IconClockHour4,
 IconChartBar, IconSearch, IconTrendingUp, IconList,
 IconCircleDot, IconSquareCheck, IconSettings,
 IconInfoCircle, IconExternalLink, IconUsers,
 IconArrowRight, IconCloudDownload,
} from '@tabler/icons-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 ResponsiveContainer, Legend, Cell, LabelList,
} from 'recharts';
import {
 useJiraStatus, useJiraPods, useClearJiraCache,
 usePodWatchConfig, usePodVelocity,
 PodMetrics,
} from '../api/jira';
import WidgetGrid, { Widget } from '../components/layout/WidgetGrid';
import ChartCard from '../components/common/ChartCard';
import { AQUA_HEX, AQUA, BORDER_STRONG, COLOR_AMBER_DARK, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_VIOLET, COLOR_WARNING, DEEP_BLUE, SLATE_700, SURFACE_GRAY, TEXT_GRAY, TEXT_SUBTLE } from '../brandTokens';

const AMBER = COLOR_WARNING;
const GREEN = COLOR_GREEN;
const RED = COLOR_ERROR_STRONG;
const GRAY = TEXT_SUBTLE;

const POD_COLORS = [
 DEEP_BLUE, AQUA, COLOR_VIOLET, '#DB2777', COLOR_AMBER_DARK,
 COLOR_EMERALD, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, '#0891B2', '#65A30D',
];

export default function PodDashboardPage() {
 const isDark = useDarkMode();
 const navigate = useNavigate();
 const [search, setSearch] = useState('');
 const [view, setView] = useState<'cards' | 'table' | 'heatmap'>('cards');

 const { data: status, isLoading: statusLoading } = useJiraStatus();
 const { data: pods = [], isLoading, refetch, error } = useJiraPods();
 const { data: watchConfig = [] } = usePodWatchConfig();
 const clearCache = useClearJiraCache();

 const jiraBaseUrl = status?.baseUrl ?? '';

 const handleRefresh = () => {
 clearCache.mutate(undefined, { onSettled: () => refetch() });
 };

 const triggerSync = useMutation({
 mutationFn: () => apiClient.post('/jira/sync/trigger', null, { params: { fullSync: true } }),
 onSuccess: () => {
  notifications.show({ color: 'teal', title: 'Sync started', message: 'Jira sync is running in the background. Refresh in ~30 seconds to see updated sprint data.' });
 },
 onError: () => notifications.show({ color: 'red', message: 'Failed to trigger sync' }),
 });

 if (statusLoading) return <LoadingSpinner variant="cards" message="Loading Jira POD dashboard..." />;

 if (!status?.configured) {
 return (
 <Box p="xl">
 <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
 Add your Jira credentials to{' '}
 <code>backend/src/main/resources/application-local.yml</code> and restart
 the backend with <code>-Dspring.profiles.active=local</code>.
 </Alert>
 </Box>
 );
 }

 const filtered = pods.filter(p =>
 p.podDisplayName.toLowerCase().includes(search.toLowerCase()) ||
 p.boardKeys.some(k => k.toLowerCase().includes(search.toLowerCase()))
 );

 const totalActiveSprints = pods.filter(p => p.activeSprint).length;
 const totalHours = pods.reduce((s, p) => s + (p.activeSprint?.hoursLogged ?? 0), 0);
 const totalSP = pods.reduce((s, p) => s + (p.activeSprint?.totalSP ?? 0), 0);
 const totalDoneSP = pods.reduce((s, p) => s + (p.activeSprint?.doneSP ?? 0), 0);
 const overallPct = totalSP > 0 ? (totalDoneSP / totalSP) * 100 : 0;

 const isConfigured = watchConfig.some(w => w.enabled);

 // Cross-pod SP comparison data for heatmap view
 const spCompareData = pods
 .filter(p => p.activeSprint && p.activeSprint.totalSP > 0)
 .map((p, i) => ({
 name: p.podDisplayName.length > 16 ? p.podDisplayName.slice(0, 14) + '…' : p.podDisplayName,
 fullName: p.podDisplayName,
 Done: Math.round(p.activeSprint!.doneSP),
 Remaining: Math.round(p.activeSprint!.totalSP - p.activeSprint!.doneSP),
 pct: Math.round(p.activeSprint!.spProgressPct),
 color: POD_COLORS[i % POD_COLORS.length],
 }))
 .sort((a, b) => b.pct - a.pct);

 // Team workload aggregation across all pods
 const teamHours: Record<string, number> = {};
 pods.forEach(p => {
 Object.entries(p.hoursByMember ?? {}).forEach(([name, h]) => {
 teamHours[name] = (teamHours[name] ?? 0) + h;
 });
 });
 const topTeam = Object.entries(teamHours)
 .sort(([, a], [, b]) => b - a)
 .slice(0, 12)
 .map(([name, hours]) => ({ name: name.split(' ')[0], hours: Math.round(hours) }));

 return (
 <PPPageLayout
   title="POD Dashboard"
   subtitle="Sprint progress, velocity and issue analytics per POD"
   animate
 >
 <Group justify="flex-end" mb="lg" gap="xs">
 <SegmentedControl
 size="xs" value={view}
 onChange={v => setView(v as 'cards' | 'table' | 'heatmap')}
 data={[
 { label: 'Cards', value: 'cards' },
 { label: 'Table', value: 'table' },
 { label: 'Compare', value: 'heatmap' },
 ]}
 />
 <Button
 size="xs" variant="light"
 leftSection={<IconSettings size={14} />}
 onClick={() => navigate('/settings/jira')}
 >
 Configure
 </Button>
 <Button
 size="xs" variant="light"
 color="blue"
 leftSection={<IconCloudDownload size={14} />}
 loading={triggerSync.isPending}
 onClick={() => triggerSync.mutate()}
 >
 Trigger Sync
 </Button>
 <Button
 size="xs" variant="light"
 leftSection={<IconRefresh size={14} />}
 loading={clearCache.isPending || isLoading}
 onClick={handleRefresh}
 >
 {clearCache.isPending ? 'Clearing…' : 'Refresh'}
 </Button>
 </Group>

 {/* ── Company Summary Bar ── */}
 {pods.length > 0 && (
 <Paper withBorder p="md" mb="lg" radius="md"
 style={{ background: isDark ? `rgba(255,255,255,0.04)` : `linear-gradient(135deg, ${DEEP_BLUE}08, ${AQUA}12)` }}>
 <Group grow>
 <CompanyStat label="Active Sprints" value={String(totalActiveSprints)}
 sub={`of ${pods.length} PODs`} color={DEEP_BLUE} icon={<IconChartBar size={18} />} />
 <CompanyStat label="Sprint Progress" value={`${Math.round(overallPct)}%`}
 sub={`${Math.round(totalDoneSP)} / ${Math.round(totalSP)} SP`}
 color={AQUA} icon={<IconTrendingUp size={18} />} />
 <CompanyStat label="Hours Logged" value={`${Math.round(totalHours).toLocaleString()} h`}
 sub="this sprint" color={COLOR_VIOLET} icon={<IconClockHour4 size={18} />} />
 <CompanyStat label="Backlog Items" value={String(pods.reduce((s, p) => s + p.backlogSize, 0))}
 sub={`${pods.filter(p => p.backlogSize > 0).length} PODs with backlog`}
 color={AMBER} icon={<IconList size={18} />} />
 </Group>
 {totalSP > 0 && (
 <Box mt="sm">
 <Progress
 value={overallPct}
 color={overallPct >= 80 ? 'teal' : overallPct >= 50 ? 'yellow' : 'red'}
 size="sm" radius="xl"
 />
 </Box>
 )}
 </Paper>
 )}

 {!isConfigured && !isLoading && (
 <Alert icon={<IconInfoCircle />} color="blue" mb="md" title="No boards configured yet">
 Go to{' '}
 <Text component="span" size="sm" fw={600}
 style={{ cursor: 'pointer', textDecoration: 'underline' }}
 onClick={() => navigate('/settings/jira')}
 >
 Settings → Jira Boards
 </Text>{' '}
 to select which Jira project spaces to track.
 </Alert>
 )}

 <Group mb="md" gap="sm">
 <TextInput
 placeholder="Search PODs…"
 leftSection={<IconSearch size={14} />}
 value={search} onChange={e => setSearch(e.currentTarget.value)}
 size="sm" style={{ width: 240 }}
 />
 <Text size="sm" c="dimmed">{filtered.length} PODs</Text>
 </Group>

 {error && (
 <Alert icon={<IconAlertTriangle />} color="red" mb="md">
 {(error as any)?.message ?? String(error)}
 </Alert>
 )}

 {isLoading && (
 <Stack gap="sm">
 {[...Array(6)].map((_, i) => (
 <Skeleton key={i} height={100} radius="sm" />
 ))}
 </Stack>
 )}

 {/* ── Cards view ── */}
 {!isLoading && view === 'cards' && (
 <Grid gutter="md">
 {filtered.map((pod, idx) => (
 <Grid.Col key={pod.podId ?? pod.podDisplayName} span={{ base: 12, sm: 6, lg: 4 }}>
 <PodCard
 pod={pod}
 color={POD_COLORS[idx % POD_COLORS.length]}
 jiraBaseUrl={jiraBaseUrl}
 onNavigate={() => pod.podId && navigate(`/jira-pods/${pod.podId}`)}
 />
 </Grid.Col>
 ))}
 </Grid>
 )}

 {/* ── Table view ── */}
 {!isLoading && view === 'table' && (
 <PodTable pods={filtered} jiraBaseUrl={jiraBaseUrl}
 onRowClick={(pod) => pod.podId && navigate(`/jira-pods/${pod.podId}`)} />
 )}

 {/* ── Compare view ── */}
 {!isLoading && view === 'heatmap' && (
 <WidgetGrid pageKey="pod-compare">
 {/* SP comparison */}
 <Widget id="sprint-sp" title="Sprint Story Points">
 {spCompareData.length > 0 && (
 <ChartCard title="Sprint Story Points — All PODs" minHeight={Math.max(200, spCompareData.length * 36)}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={Math.max(200, spCompareData.length * 36)}>
 <BarChart
 data={spCompareData}
 layout="vertical"
 margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
 >
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} horizontal={false} />
 <XAxis type="number" tick={{ fontSize: 11 }} />
 <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
 <RTooltip
 contentStyle={{ fontSize: 11 }}
 formatter={(v: number, n: string) => [`${v} SP`, n]}
 />
 <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
 <Bar animationDuration={600} dataKey="Done" stackId="a" fill={GREEN} radius={[0, 0, 0, 0]} />
 <Bar animationDuration={600} dataKey="Remaining" stackId="a" fill={BORDER_STRONG} radius={[0, 3, 3, 0]}>
 <LabelList
 dataKey="pct"
 position="right"
 style={{ fontSize: 11, fill: TEXT_GRAY, fontWeight: 600 }}
 formatter={(v: number) => `${v}%`}
 />
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 )}

 </Widget>

 {/* Hours by issue type across pods */}
 <Widget id="issue-types" title="Issue Types Across PODs">
 {pods.some(p => Object.keys(p.issueTypeBreakdown ?? {}).length > 0) && (
 <ChartCard title="Issue Types Across PODs (Active Sprint)" minHeight={300}>
 <Grid>
 {filtered
 .filter(p => p.activeSprint && Object.keys(p.issueTypeBreakdown ?? {}).length > 0)
 .map((pod, i) => {
 const typeData = Object.entries(pod.issueTypeBreakdown ?? {})
 .map(([name, value]) => ({ name, value }));
 return (
 <Grid.Col key={pod.podDisplayName} span={{ base: 12, sm: 6, lg: 4 }}>
 <Paper withBorder p="xs" radius="sm"
 style={{ cursor: 'pointer', borderTop: `3px solid ${POD_COLORS[i % POD_COLORS.length]}` }}
 onClick={() => pod.podId && navigate(`/jira-pods/${pod.podId}`)}
 >
 <Group justify="space-between" mb={6}>
 <Text size="xs" fw={600}>{pod.podDisplayName}</Text>
 <ActionIcon size="xs" variant="subtle" color="gray"
      aria-label="Go forward"
    >
 <IconArrowRight size={12} />
 </ActionIcon>
 </Group>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={100}>
 <BarChart data={typeData} margin={{ top: 16, right: 4, left: -28, bottom: 0 }}>
 <XAxis dataKey="name" tick={{ fontSize: 8 }} />
 <YAxis tick={{ fontSize: 8 }} allowDecimals={false} />
 <RTooltip contentStyle={{ fontSize: 10 }} />
 <Bar animationDuration={600} dataKey="value" radius={[2, 2, 0, 0]}>
 {typeData.map((_, j) => (
 <Cell key={j} fill={POD_COLORS[(i + j + 1) % POD_COLORS.length]} />
 ))}
 <LabelList
 dataKey="value"
 position="top"
 style={{ fontSize: 9, fontWeight: 700, fill: SLATE_700 }}
 />
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </Paper>
 </Grid.Col>
 );
 })}
 </Grid>
 </ChartCard>
 )}

 </Widget>

 {/* Team workload across all pods */}
 <Widget id="team-hours" title="Team Hours">
 {topTeam.length > 0 && (
 <ChartCard
 title="Team Hours Logged This Sprint (All PODs)"
 minHeight={180}
 headerRight={
 <Badge size="sm" variant="light" color="teal" leftSection={<IconUsers size={11} />}>
 {topTeam.length} contributors
 </Badge>
 }
 >
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={180}>
 <BarChart data={topTeam} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} />
 <XAxis dataKey="name" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} />
 <RTooltip contentStyle={{ fontSize: 11 }}
 formatter={(v: number) => [`${v}h`, 'Hours']} />
 <Bar animationDuration={600} dataKey="hours" fill={AQUA_HEX} radius={[3, 3, 0, 0]}>
 {topTeam.map((_, i) => (
 <Cell key={i} fill={POD_COLORS[i % POD_COLORS.length]} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 )}
 </Widget>

 </WidgetGrid>
 )}
 </PPPageLayout>
 );
}

// ── POD Card ──────────────────────────────────────────────────────────

function PodCard({
 pod, color, jiraBaseUrl, onNavigate,
}: {
 pod: PodMetrics;
 color: string;
 jiraBaseUrl: string;
 onNavigate: () => void;
}) {
 const [expanded, setExpanded] = useState(false);
 const [showAllTeam, setShowAllTeam] = useState(false);
 const { data: velocity = [], isLoading: loadingVelocity } =
 usePodVelocity(pod.podId, expanded);

 const sprint = pod.activeSprint;

 const allMembers = useMemo(() =>
 Object.entries(pod.hoursByMember).sort(([, a], [, b]) => b - a),
 [pod.hoursByMember]
 );
 const spEntries = useMemo(() =>
 Object.entries(pod.spByMember).sort(([, a], [, b]) => b - a),
 [pod.spByMember]
 );

 const displayMembers = showAllTeam ? allMembers : allMembers.slice(0, 5);

 const velocityData = velocity.map(v => ({
 sprint: v.sprintName.length > 14 ? '…' + v.sprintName.slice(-12) : v.sprintName,
 Committed: v.committedSP,
 Completed: v.completedSP,
 }));

 // Build Jira backlog URL
 const boardUrl = jiraBaseUrl && pod.boardKeys[0]
 ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${pod.boardKeys[0]}?backlog`
 : null;

 const todoCount = sprint
 ? sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues
 : 0;

 return (
 <Paper withBorder radius="md" style={{ borderTop: `4px solid ${color}`, height: '100%' }}>
 {/* Header — clickable to POD detail */}
 <Box
 p="md" pb="xs"
 style={{ cursor: 'pointer' }}
 onClick={onNavigate}
 >
 <Group justify="space-between" mb={4}>
 <Group gap="xs">
 <ThemeIcon size={28} radius="sm" style={{ backgroundColor: color }}>
 <IconTicket size={15} color="white" />
 </ThemeIcon>
 <div>
 <Group gap={4}>
 <Text fw={700} size="sm" style={{ lineHeight: 1.2 }}>
 {pod.podDisplayName}
 </Text>
 <IconArrowRight size={12} color={GRAY} />
 </Group>
 <Group gap={4}>
 {pod.boardKeys.slice(0, 3).map(k => (
 <Badge key={k} size="xs" variant="outline" color="gray">{k}</Badge>
 ))}
 {pod.boardKeys.length > 3 && (
 <Badge size="xs" variant="outline" color="gray">+{pod.boardKeys.length - 3}</Badge>
 )}
 </Group>
 </div>
 </Group>
 <Group gap={4}>
 {boardUrl && (
 <Tooltip label="Open Jira backlog">
 <ActionIcon
 size="sm" variant="subtle" color="gray"
 component="a" href={boardUrl} target="_blank" rel="noreferrer"
 onClick={e => e.stopPropagation()}
 aria-label="Open in new tab"
>
 <IconExternalLink size={13} />
 </ActionIcon>
 </Tooltip>
 )}
 {pod.errorMessage
 ? <Tooltip label={pod.errorMessage}><IconAlertTriangle size={16} color={RED} /></Tooltip>
 : sprint ? <IconCircleCheck size={16} color={GREEN} /> : null}
 </Group>
 </Group>
 {pod.boardName && <Text size="xs" c="dimmed">Board: {pod.boardName}</Text>}
 </Box>

 <Divider />

 <Box p="md">
 {!sprint ? (
 <Text size="sm" c="dimmed" ta="center" py="sm">
 {pod.errorMessage ? 'Error loading data'
 : !pod.boardName ? 'No Scrum board'
 : 'No active sprint'}
 </Text>
 ) : (
 <Stack gap="xs">
 <Group justify="space-between">
 <Text size="xs" fw={600} tt="uppercase" c="dimmed">Active Sprint</Text>
 {(() => {
   // Use SP-based % when SP are assigned; fall back to issue-count % when no SP
   const displayPct = sprint.totalSP > 0 ? sprint.spProgressPct : sprint.progressPct;
   return (
     <Badge size="xs"
       color={displayPct >= 80 ? 'teal' : displayPct >= 50 ? 'yellow' : 'red'}>
       {Math.round(displayPct)}% done
     </Badge>
   );
 })()}
 </Group>
 <Text size="sm" fw={600} c={AQUA}>{sprint.name}</Text>
 {sprint.startDate && (
 <Text size="xs" c="dimmed">
 {fmt(sprint.startDate)} → {fmt(sprint.endDate)}
 </Text>
 )}
 <Box>
 <Group justify="space-between" mb={4}>
 <Text size="xs" c="dimmed">
 {sprint.totalSP > 0 ? 'Story Points' : 'Issues Done'}
 </Text>
 <Text size="xs" fw={600}>
 {sprint.totalSP > 0
   ? `${Math.round(sprint.doneSP)} / ${Math.round(sprint.totalSP)} SP`
   : `${sprint.doneIssues} / ${sprint.totalIssues}`}
 </Text>
 </Group>
 {(() => {
   const displayPct = sprint.totalSP > 0 ? sprint.spProgressPct : sprint.progressPct;
   return (
     <Progress value={displayPct} size="md" radius="xs"
       color={displayPct >= 80 ? 'teal' : displayPct >= 50 ? 'yellow' : 'orange'} />
   );
 })()}
 </Box>

 {/* Issue counts — clicking opens Jira sprint board */}
 <Group gap="xs" mt={2}>
 <StatPill
 icon={<IconSquareCheck size={11} />}
 label={String(sprint.doneIssues)}
 tip={`${sprint.doneIssues} Done — click to open Jira backlog`}
 color={GREEN}
 href={boardUrl}
 />
 <StatPill
 icon={<IconCircleDot size={11} />}
 label={String(sprint.inProgressIssues)}
 tip={`${sprint.inProgressIssues} In Progress`}
 color={AMBER}
 href={boardUrl}
 />
 <StatPill
 icon={<IconList size={11} />}
 label={String(todoCount)}
 tip={`${todoCount} To Do`}
 color={GRAY}
 href={boardUrl}
 />
 {sprint.hoursLogged > 0 && (
 <StatPill
 icon={<IconClockHour4 size={11} />}
 label={`${Math.round(sprint.hoursLogged)}h`}
 tip="Hours Logged this sprint"
 color={AQUA}
 />
 )}
 </Group>
 </Stack>
 )}
 </Box>

 {pod.backlogSize > 0 && (
 <Box px="md" pb="xs">
 {boardUrl ? (
 <Text
 size="xs" c="dimmed"
 component="a"
 href={`${jiraBaseUrl.replace(/\/$/, '')}/browse/${pod.boardKeys[0]}?backlog`}
 target="_blank"
 rel="noreferrer"
 style={{ textDecoration: 'none', cursor: 'pointer' }}
 >
 Backlog: <strong>{pod.backlogSize}</strong> items{' '}
 <IconExternalLink size={10} style={{ verticalAlign: 'middle' }} />
 </Text>
 ) : (
 <Text size="xs" c="dimmed">Backlog: <strong>{pod.backlogSize}</strong> items</Text>
 )}
 </Box>
 )}

 {/* Expand for velocity + team */}
 <Divider />
 <Box px="md" py="xs" style={{ cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
 <Group justify="space-between">
 <Text size="xs" c="dimmed">
 {expanded ? 'Hide details' : 'Velocity & team breakdown'}
 </Text>
 {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
 </Group>
 </Box>

 <Collapse in={expanded}>
 <Box px="md" pb="md">
 {loadingVelocity ? (
 <Skeleton height={110} radius="sm" mt="xs" />
 ) : velocityData.length > 0 ? (
 <>
 <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
 Velocity (last {velocityData.length} sprints)
 </Text>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={110}>
 <BarChart data={velocityData} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} />
 <XAxis dataKey="sprint" tick={{ fontSize: 9 }} />
 <YAxis tick={{ fontSize: 9 }} />
 <RTooltip formatter={(v: number, n: string) => [`${v} SP`, n]} contentStyle={{ fontSize: 11 }} />
 <Bar animationDuration={600} dataKey="Committed" fill={GRAY} radius={[2, 2, 0, 0]} />
 <Bar animationDuration={600} dataKey="Completed" fill={color} radius={[2, 2, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </>
 ) : (
 <Text size="xs" c="dimmed" ta="center">No closed sprints found</Text>
 )}

 {/* Issue type breakdown for active sprint */}
 {Object.keys(pod.issueTypeBreakdown ?? {}).length > 0 && (
 <>
 <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs" mt="sm">
 Issue Types (current sprint)
 </Text>
 <Group gap="xs" wrap="wrap">
 {Object.entries(pod.issueTypeBreakdown).map(([type, count], i) => (
 <Badge
 key={type} size="xs" variant="light"
 style={{ backgroundColor: `${POD_COLORS[i % POD_COLORS.length]}18`,
 color: POD_COLORS[i % POD_COLORS.length] }}
 >
 {type}: {count}
 </Badge>
 ))}
 </Group>
 </>
 )}

 {/* Team members — all of them */}
 {(allMembers.length > 0 || spEntries.length > 0) && (
 <>
 <Group justify="space-between" mt="sm" mb="xs">
 <Text size="xs" fw={600} tt="uppercase" c="dimmed">
 Team ({allMembers.length} members)
 </Text>
 {allMembers.length > 5 && (
 <Text
 size="xs" c="teal" style={{ cursor: 'pointer' }}
 onClick={() => setShowAllTeam(s => !s)}
 >
 {showAllTeam ? 'Show less' : `+${allMembers.length - 5} more`}
 </Text>
 )}
 </Group>
 <Stack gap={4}>
 {(displayMembers.length > 0 ? displayMembers : spEntries.slice(0, showAllTeam ? undefined : 5)).map(([name, val]) => {
 const isHours = allMembers.length > 0;
 const maxVal = (allMembers.length > 0 ? allMembers : spEntries)[0]?.[1] ?? 1;
 return (
 <Group key={name} gap="xs" wrap="nowrap">
 <Text size="xs" style={{ width: 130, flexShrink: 0 }} truncate>{name}</Text>
 <Box style={{ flex: 1 }}>
 <Progress value={(Number(val) / Number(maxVal)) * 100} color={color} size="xs" />
 </Box>
 <Text size="xs" c="dimmed" style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>
 {isHours ? `${Math.round(val as number)}h` : `${val} SP`}
 </Text>
 </Group>
 );
 })}
 </Stack>
 </>
 )}
 </Box>
 </Collapse>
 </Paper>
 );
}

// ── Table view ────────────────────────────────────────────────────────

function PodTable({
 pods, jiraBaseUrl, onRowClick,
}: {
 pods: PodMetrics[];
 jiraBaseUrl: string;
 onRowClick: (pod: PodMetrics) => void;
}) {
 const isDark = useDarkMode();
 return (
 <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse' }}>
 <thead>
 <tr style={{ backgroundColor: isDark ? DEEP_BLUE : '#E7E9EC' }}>
 {['POD', 'Sprint', 'Progress', 'SP Done/Total', 'Hours', 'Issues', 'Backlog'].map(h => (
 <th key={h} style={{ color: isDark ? 'white' : DEEP_BLUE, padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {pods.map((pod, idx) => {
 const sprint = pod.activeSprint;
 const boardUrl = jiraBaseUrl && pod.boardKeys[0]
 ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${pod.boardKeys[0]}?backlog`
 : null;
 return (
 <tr
 key={pod.podDisplayName + idx}
 style={{ backgroundColor: idx % 2 === 0 ? 'var(--mantine-color-body)' : 'var(--mantine-color-default-hover)', cursor: 'pointer' }}
 onClick={() => onRowClick(pod)}
 >
 <td style={{ padding: '10px 12px' }}>
 <Group gap={4}>
 <div>
 <Text size="sm" fw={600}>{pod.podDisplayName}</Text>
 <Group gap={4} mt={2}>
 {pod.boardKeys.slice(0, 4).map(k => (
 <Badge key={k} size="xs" variant="outline">{k}</Badge>
 ))}
 {pod.boardKeys.length > 4 && (
 <Badge size="xs" variant="outline">+{pod.boardKeys.length - 4}</Badge>
 )}
 </Group>
 </div>
 <IconArrowRight size={12} color={GRAY} />
 </Group>
 </td>
 <td style={{ padding: '10px 12px' }}>
 {sprint ? (
 <Group gap={4}>
 <Text size="sm">{sprint.name}</Text>
 {boardUrl && (
 <ActionIcon
 size="xs" variant="subtle" color="gray"
 component="a" href={boardUrl} target="_blank" rel="noreferrer"
 onClick={e => e.stopPropagation()}
 aria-label="Open in new tab"
>
 <IconExternalLink size={11} />
 </ActionIcon>
 )}
 </Group>
 ) : <Text size="sm" c="dimmed">—</Text>}
 </td>
 <td style={{ padding: '10px 12px', minWidth: 120 }}>
 {sprint ? (
 <Box>
 {(() => {
   const dp = sprint.totalSP > 0 ? sprint.spProgressPct : sprint.progressPct;
   return (
     <>
       <Progress value={dp} size="sm"
         color={dp >= 80 ? 'teal' : dp >= 50 ? 'yellow' : 'orange'} />
       <Text size="xs" c="dimmed" mt={2}>
         {Math.round(dp)}%{sprint.totalSP === 0 ? ' (issues)' : ''}
       </Text>
     </>
   );
 })()}
 </Box>
 ) : <Text size="sm" c="dimmed">—</Text>}
 </td>
 <td style={{ padding: '10px 12px' }}>
 {sprint ? <Text size="sm">{sprint.totalSP > 0 ? `${Math.round(sprint.doneSP)} / ${Math.round(sprint.totalSP)} SP` : `${sprint.doneIssues} / ${sprint.totalIssues} issues`}</Text>
 : <Text size="sm" c="dimmed">—</Text>}
 </td>
 <td style={{ padding: '10px 12px' }}>
 {sprint?.hoursLogged ? <Text size="sm">{Math.round(sprint.hoursLogged)} h</Text>
 : <Text size="sm" c="dimmed">—</Text>}
 </td>
 <td style={{ padding: '10px 12px' }}>
 {sprint ? (
 <Group gap={4}>
 <Badge size="xs" color="teal">{sprint.doneIssues}✓</Badge>
 <Badge size="xs" color="yellow">{sprint.inProgressIssues}⟳</Badge>
 <Badge size="xs" color="gray">{sprint.todoIssues ?? (sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues)}</Badge>
 </Group>
 ) : <Text size="sm" c="dimmed">—</Text>}
 </td>
 <td style={{ padding: '10px 12px' }}>
 <Text size="sm">{pod.backlogSize || '—'}</Text>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </Paper>
 );
}

// ── Helper components ─────────────────────────────────────────────────

function CompanyStat({ label, value, sub, color, icon }: {
 label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
 const isDark = useDarkMode();
 return (
 <Group gap="sm">
 <ThemeIcon size={40} radius="md" style={{ backgroundColor: isDark ? `${color}22` : `${color}18` }}>
 <span style={{ color }}>{icon}</span>
 </ThemeIcon>
 <div>
 <Text size="xs" tt="uppercase" c="dimmed" fw={600}>{label}</Text>
 <Text size="xl" fw={800} style={{ color, lineHeight: 1.1 }}>{value}</Text>
 <Text size="xs" c="dimmed">{sub}</Text>
 </div>
 </Group>
 );
}

function StatPill({ icon, label, tip, color, href }: {
 icon: React.ReactNode;
 label: string;
 tip: string;
 color: string;
 href?: string | null;
}) {
 const isDark = useDarkMode();
 const content = (
 <Badge
 size="sm" variant="light" leftSection={icon}
 style={{ backgroundColor: isDark ? `${color}22` : `${color}18`, color, borderColor: isDark ? `${color}44` : `${color}30`, cursor: href ? 'pointer' : 'default' }}
 >
 {label}
 </Badge>
 );

 return (
 <Tooltip label={tip}>
 {href ? (
 <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}
 onClick={e => e.stopPropagation()}>
 {content}
 </a>
 ) : content}
 </Tooltip>
 );
}

function fmt(iso: string | null): string {
 if (!iso) return '?';
 try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
 catch { return iso.slice(0, 10); }
}
