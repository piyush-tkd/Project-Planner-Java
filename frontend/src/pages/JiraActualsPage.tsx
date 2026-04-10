import { useState, useMemo } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import {
 Box, Title, Text, Group, Stack, Badge, Button, Select, Table,
 Tabs, Alert, Loader, Tooltip, ActionIcon, Modal, NumberInput, Skeleton,
 SegmentedControl, Progress, Paper, Divider, ThemeIcon, SimpleGrid,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/ui';
import {
 IconTicket, IconLink, IconLinkOff, IconRefresh, IconCheck,
 IconAlertTriangle, IconPlus, IconTrash, IconChartBar, IconSettings,
 IconCircleCheck, IconCircleX, IconInfoCircle, IconDownload, IconChevronDown,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 Legend, ResponsiveContainer, ReferenceLine, LineChart, Line,
} from 'recharts';
import ChartCard from '../components/common/ChartCard';
import {
 useJiraStatus, useJiraProjects, useJiraMappings, useJiraActuals,
 useSaveMapping, useSaveMappingsBulk, useDeleteMapping,
 usePodWatchConfig, useTriggerJiraSync,
 JiraProjectInfo, MappingResponse, ActualsRow, PodConfigResponse,
} from '../api/jira';
import { useProjects } from '../api/projects';
import { ProjectResponse } from '../types/project';
import { AQUA_HEX, AQUA, AQUA_TINTS, DEEP_BLUE, FONT_FAMILY, SURFACE_GRAY } from '../brandTokens';
import {
 InlineTextCell, InlineNumberCell, InlineSelectCell,
} from '../components/common/InlineCell';
import { useInlineEdit } from '../hooks/useInlineEdit';

// ── Override data structure for inline editing ────────────────────
interface RowOverrides {
 sprintOverride?: string;
 storyPointsOverride?: number;
 statusOverride?: string;
 categoryOverride?: string;
 resourceOverride?: string;
}

// ── Month ordering helper ─────────────────────────────────────────────
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ── CSV Export helper ────────────────────────────────────────────────
function exportCsv(actuals: ActualsRow[]) {
 if (!actuals || actuals.length === 0) return;
 const headers = ['Project', 'Jira Key', 'Match', 'Issues', 'Story Pts', 'Actual Hrs', 'Planned Hrs', 'Variance', 'Budget Burn %'];
 const rows = actuals.map(row => {
 const variance = row.hasTimeData ? (row.storyPointHours - row.plannedHours) : 0;
 const burnPct = row.plannedHours > 0 ? Math.min(150, (row.storyPointHours / row.plannedHours) * 100).toFixed(1) : '—';
 return [
 row.ppProjectName,
 row.jiraProjectKey,
 row.matchValue,
 row.issueCount,
 row.totalStoryPoints.toFixed(1),
 row.storyPointHours.toFixed(1),
 row.plannedHours > 0 ? row.plannedHours.toFixed(1) : '—',
 row.plannedHours > 0 ? variance.toFixed(1) : '—',
 burnPct,
 ].join(',');
 });
 const csv = [headers.join(','), ...rows].join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `jira-actuals-${new Date().toISOString().slice(0, 10)}.csv`;
 a.click();
 URL.revokeObjectURL(url);
}

export default function JiraActualsPage() {
 const isDark = useDarkMode();
 const [activeTab, setActiveTab] = useState<string | null>('actuals');
 const [unit, setUnit] = useState<'hours' | 'sp'>('hours');

 const { data: status, isLoading: statusLoading } = useJiraStatus();
 const { data: projects = [] } = useProjects();
 const { data: jiraProjects = [], isLoading: jiraLoading, refetch: refetchJira, error: jiraError } = useJiraProjects();
 const { data: mappings = [], refetch: refetchMappings } = useJiraMappings();
 const { data: actuals = [], isLoading: actualsLoading, refetch: refetchActuals } = useJiraActuals();
 const { data: watchConfig = [] } = usePodWatchConfig();

 const saveMapping = useSaveMapping();
 const saveBulk = useSaveMappingsBulk();
 const deleteMapping = useDeleteMapping();
 const triggerSync = useTriggerJiraSync();

 if (statusLoading) return <LoadingSpinner variant="table" message="Loading Jira actuals..." />;

 if (!status?.configured) {
 return (
 <Box p="xl">
 <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
 Add your Jira credentials to{' '}
 <code>backend/src/main/resources/application-local.yml</code> and restart
 the backend with <code>-Dspring.profiles.active=local</code>.
 <br /><br />
 Required fields: <code>jira.base-url</code>, <code>jira.email</code>, <code>jira.api-token</code>
 </Alert>
 </Box>
 );
 }

 return (
 <PPPageLayout title="Jira Actuals" subtitle="Compare planned vs actual hours from Jira worklogs" animate>
 <Box className="page-enter stagger-children">
 {/* Toolbar */}
 <Group justify="flex-end" mb="lg" className="slide-in-left">
 <Group gap="xs">
 <SegmentedControl
 size="xs"
 value={unit}
 onChange={v => setUnit(v as 'hours' | 'sp')}
 data={[
 { label: 'Hours', value: 'hours' },
 { label: 'Story Pts', value: 'sp' },
 ]}
 />
 <Button
 size="xs"
 variant="light"
 color="teal"
 leftSection={<IconDownload size={14} />}
 onClick={() => exportCsv(actuals)}
 >
 Export CSV
 </Button>
 <Button
 size="xs"
 variant="light"
 leftSection={<IconRefresh size={14} />}
 loading={actualsLoading}
 onClick={() => { refetchActuals(); refetchMappings(); }}
 >
 Sync
 </Button>
 <Button
 size="xs"
 variant="light"
 color="blue"
 leftSection={<IconRefresh size={14} />}
 loading={triggerSync.isPending}
 onClick={() => {
 triggerSync.mutate(false, {
 onSuccess: (result) => {
 notifications.show({
 title: 'Jira Sync',
 message: result.message,
 color: 'teal',
 autoClose: 4000,
 });
 },
 onError: (error) => {
 notifications.show({
 title: 'Jira Sync Error',
 message: error.message,
 color: 'red',
 autoClose: 4000,
 });
 },
 });
 }}
 >
 Run Sync Now
 </Button>
 </Group>
 </Group>

 <Tabs value={activeTab} onChange={setActiveTab}>
 <Tabs.List mb="md">
 <Tabs.Tab value="actuals" leftSection={<IconChartBar size={15} />}>
 Actuals vs Plan
 </Tabs.Tab>
 <Tabs.Tab value="mapper" leftSection={<IconSettings size={15} />}>
 Project Mapper
 {mappings.length > 0 && (
 <Badge size="xs" ml={6} color="teal">{mappings.length}</Badge>
 )}
 </Tabs.Tab>
 </Tabs.List>

 {/* ── Actuals Tab ─────────────────────────────────────────── */}
 <Tabs.Panel value="actuals">
 {mappings.length === 0 ? (
 <EmptyState
 icon={<IconLink size={40} />}
 title="No project mappings yet"
 description="Link your Jira epics or labels to Portfolio Planner projects in the Project Mapper tab to start tracking actuals."
 actionLabel="Go to Project Mapper"
 onAction={() => document.querySelector<HTMLButtonElement>('[data-value="mapper"]')?.click()}
 />
 ) : actualsLoading ? (
 <Stack gap="sm" py="sm">
 <SimpleGrid cols={4} spacing="sm">{[1,2,3,4].map(i => <Skeleton key={i} height={80} radius="md" />)}</SimpleGrid>
 <Skeleton height={300} radius="md" />
 </Stack>
 ) : (
 <ActualsView
 actuals={actuals}
 projects={projects}
 unit={unit}
 />
 )}
 </Tabs.Panel>

 {/* ── Mapper Tab ──────────────────────────────────────────── */}
 <Tabs.Panel value="mapper">
 <MapperView
 jiraProjects={jiraProjects}
 jiraLoading={jiraLoading}
 jiraError={jiraError}
 ppProjects={projects}
 mappings={mappings}
 watchConfig={watchConfig}
 onSave={async (req) => {
 await saveMapping.mutateAsync(req);
 notifications.show({ message: 'Mapping saved', color: 'teal', icon: <IconCheck size={16} /> });
 }}
 onDelete={async (id) => {
 await deleteMapping.mutateAsync(id);
 notifications.show({ message: 'Mapping removed', color: 'gray' });
 }}
 onBulkSave={async (reqs) => {
 await saveBulk.mutateAsync(reqs);
 notifications.show({
 message: `${reqs.length} mappings saved`,
 color: 'teal',
 icon: <IconCheck size={16} />,
 });
 }}
 onRefreshJira={() => refetchJira()}
 />
 </Tabs.Panel>
 </Tabs>
 </Box>
 </PPPageLayout>
 );
}

// ── Actuals View ──────────────────────────────────────────────────────

function ActualsView({
 actuals,
 projects,
 unit,
}: {
 actuals: ActualsRow[];
 projects: ProjectResponse[];
 unit: 'hours' | 'sp';
}) {
 const isDark = useDarkMode();
 const [selectedProject, setSelectedProject] = useState<string | null>(null);
 const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
 const [overrides, setOverrides] = useState<Record<number, RowOverrides>>({});

 const projectOptions = actuals.map(a => ({
 value: String(a.ppProjectId),
 label: a.ppProjectName,
 }));

 const filtered = selectedProject
 ? actuals.filter(a => String(a.ppProjectId) === selectedProject)
 : actuals;

 // Build chart data: one bar per month showing actual vs estimated
 const chartData = useMemo(() => {
 if (filtered.length === 0) return [];

 // Aggregate across all selected projects
 const monthTotals: Record<number, { actual: number; label: string }> = {};
 for (const row of filtered) {
 if (row.errorMessage) continue;
 for (const m of MONTHS) {
 const label = row.monthLabels?.[m] ?? `M${m}`;
 const hrs = unit === 'hours'
 ? (row.actualHoursByMonth?.[m] ?? 0)
 : (row.totalStoryPoints > 0 ? (row.actualHoursByMonth?.[m] ?? 0) / 4 : 0);
 if (!monthTotals[m]) monthTotals[m] = { actual: 0, label };
 monthTotals[m].actual += hrs;
 }
 }
 return MONTHS
 .filter(m => monthTotals[m])
 .map(m => ({
 month: monthTotals[m].label,
 actual: Math.round(monthTotals[m].actual * 10) / 10,
 }));
 }, [filtered, unit]);

 // Aggregate sprint breakdown across all actuals rows
 const sprintVelocityData = useMemo(() => {
 if (!actuals) return [];
 const sprintMap: Record<string, number> = {};
 actuals.forEach(row => {
 if (row.sprintBreakdown) {
 Object.entries(row.sprintBreakdown).forEach(([sprint, hours]) => {
 sprintMap[sprint] = (sprintMap[sprint] ?? 0) + hours;
 });
 }
 });
 return Object.entries(sprintMap)
 .filter(([sprint]) => sprint && sprint !== 'null' && sprint !== 'undefined')
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([sprint, hours]) => ({ sprint: sprint.length > 20 ? sprint.slice(0, 18) + '…' : sprint, hours: Math.round(hours * 10) / 10 }));
 }, [actuals]);

 const totalActual = filtered.reduce((s, r) => {
 if (r.errorMessage) return s;
 const hrs = unit === 'hours'
 ? Object.values(r.actualHoursByMonth ?? {}).reduce((a, b) => a + b, 0)
 : r.storyPointHours;
 return s + hrs;
 }, 0);

 const totalPlanned = filtered.reduce((s, r) => s + (r.plannedHours ?? 0), 0);
 const totalVariance = totalActual - totalPlanned;
 const totalIssues = filtered.reduce((s, r) => s + (r.issueCount ?? 0), 0);
 const totalSP = filtered.reduce((s, r) => s + (r.totalStoryPoints ?? 0), 0);

 return (
 <Stack gap="md">
 {/* Summary cards */}
 <Group grow>
 <SummaryCard label="Total Issues" value={String(totalIssues)} color={DEEP_BLUE} />
 <SummaryCard
 label={unit === 'hours' ? 'Actual Hours' : 'Story Points'}
 value={unit === 'hours' ? `${Math.round(totalActual).toLocaleString()} h` : `${Math.round(totalSP)} SP`}
 color={AQUA}
 />
 {totalPlanned > 0 && (
 <SummaryCard
 label="Planned Hours"
 value={`${Math.round(totalPlanned).toLocaleString()} h`}
 color="#1565C0"
 />
 )}
 {totalPlanned > 0 && (
 <SummaryCard
 label="Variance"
 value={`${totalVariance >= 0 ? '+' : ''}${Math.round(totalVariance).toLocaleString()} h`}
 color={totalVariance > 0 ? '#d32f2f' : '#2e7d32'}
 subtitle={totalVariance > 0 ? 'over budget' : 'under budget'}
 />
 )}
 <SummaryCard label="Mapped" value={String(actuals.filter(a => !a.errorMessage).length)} color="#2e7d32" />
 <SummaryCard
 label="Errors"
 value={String(actuals.filter(a => !!a.errorMessage).length)}
 color={actuals.some(a => a.errorMessage) ? '#d32f2f' : '#9e9e9e'}
 />
 </Group>

 {/* Filter */}
 <Group>
 <Select
 placeholder="All projects"
 clearable
 data={projectOptions}
 value={selectedProject}
 onChange={setSelectedProject}
 style={{ width: 280 }}
 size="sm"
 />
 <Text size="sm" c="dimmed">
 Showing {filtered.length} of {actuals.length} projects
 </Text>
 </Group>

 {/* Chart */}
 {chartData.length > 0 && (
 <ChartCard title={`${unit === 'hours' ? 'Actual Hours' : 'Story Points'} by Month`} minHeight={220}>
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} />
 <XAxis dataKey="month" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} />
 <RTooltip
 formatter={(v: number) =>
 unit === 'hours' ? [`${v} hrs`, 'Actual'] : [`${v} SP`, 'Actual']}
 />
 <Bar animationDuration={600} dataKey="actual" fill={AQUA_HEX} radius={[3, 3, 0, 0]} name="Actual" />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>
 )}

 {/* Sprint Velocity Trend Chart */}
 {sprintVelocityData.length > 1 && (
 <Paper p="md" radius="lg" withBorder mt="md">
 <Text size="sm" fw={600} mb="sm" style={{ fontFamily: FONT_FAMILY }}>
 Sprint Velocity Trend
 </Text>
 <ResponsiveContainer width="100%" height={180}>
 <LineChart data={sprintVelocityData}>
 <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2a2a3a' : '#f0f0f0'} />
 <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} unit="h" />
 <RTooltip formatter={(v: number) => [`${v}h`, 'Hours']} />
 <Line type="monotone" dataKey="hours" stroke={AQUA_HEX} strokeWidth={2} dot={{ fill: AQUA, r: 3 }} />
 </LineChart>
 </ResponsiveContainer>
 </Paper>
 )}

 {/* Per-project breakdown table */}
 <Paper withBorder radius="md">
 <Table fz="xs" highlightOnHover>
 <Table.Thead style={{ backgroundColor: isDark ? '#2d2d2d' : DEEP_BLUE }}>
 <Table.Tr>
 <Table.Th style={{ color: 'white' }}>Project</Table.Th>
 <Table.Th style={{ color: 'white' }}>Jira Key</Table.Th>
 <Table.Th style={{ color: 'white' }}>Match</Table.Th>
 <Table.Th style={{ color: 'white', textAlign: 'right' }}>Issues</Table.Th>
 <Table.Th style={{ color: 'white', textAlign: 'right' }}>Story Pts</Table.Th>
 <Table.Th style={{ color: 'white', textAlign: 'right' }}>Actual Hrs</Table.Th>
 <Table.Th style={{ color: 'white', textAlign: 'right' }}>Planned Hrs</Table.Th>
 <Table.Th style={{ color: 'white', textAlign: 'right' }}>Variance</Table.Th>
 <Table.Th style={{ color: 'white' }}>Budget Burn</Table.Th>
 <Table.Th style={{ color: 'white' }}>Data Source</Table.Th>
 <Table.Th style={{ color: 'white' }}>Status</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {filtered.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={11} style={{ textAlign: 'center', color: '#999', padding: '24px' }}>
 No actuals data yet
 </Table.Td>
 </Table.Tr>
 )}
 {filtered.map(row => {
 const totalHrs = Object.values(row.actualHoursByMonth ?? {})
 .reduce((a, b) => a + b, 0);
 const planned = row.plannedHours ?? 0;
 const variance = totalHrs - planned;
 const burnPct = planned > 0 ? Math.min(150, Math.round((totalHrs / planned) * 100)) : 0;
 const burnColor = burnPct > 110 ? '#d32f2f' : burnPct > 90 ? '#ed6c02' : '#2e7d32';
 const isExpanded = expandedRows.has(row.ppProjectId);
 const rowOverrides = overrides[row.ppProjectId] || {};
 return (
 <>
 <Table.Tr key={row.ppProjectId}>
 <Table.Td fw={500}>
 <Group gap="xs" wrap="nowrap">
 <ActionIcon
 size="xs"
 variant="subtle"
 onClick={() => {
 const newSet = new Set(expandedRows);
 if (isExpanded) newSet.delete(row.ppProjectId);
 else newSet.add(row.ppProjectId);
 setExpandedRows(newSet);
 }}
 style={{
 transition: 'transform 0.2s',
 transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
 }}
 >
 <IconChevronDown size={14} />
 </ActionIcon>
 {row.ppProjectName}
 </Group>
 </Table.Td>
 <Table.Td>
 <Badge size="sm" variant="outline">{row.jiraProjectKey}</Badge>
 </Table.Td>
 <Table.Td>
 <Tooltip label={row.matchValue}>
 <Badge size="xs" color={row.matchType === 'EPIC_NAME' ? 'blue' : 'violet'}>
 {row.matchType?.replace('_', ' ')}
 </Badge>
 </Tooltip>
 </Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{row.issueCount ?? 0}</Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{row.totalStoryPoints ?? 0}</Table.Td>
 <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
 {Math.round(totalHrs).toLocaleString()} h
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', color: '#1565C0' }}>
 {planned > 0 ? `${Math.round(planned).toLocaleString()} h` : '—'}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', color: variance > 0 ? '#d32f2f' : '#2e7d32', fontWeight: 600 }}>
 {planned > 0 ? `${variance >= 0 ? '+' : ''}${Math.round(variance).toLocaleString()} h` : '—'}
 </Table.Td>
 <Table.Td style={{ minWidth: 100 }}>
 {planned > 0 ? (
 <Tooltip label={`${burnPct}% of planned budget used`}>
 <div>
 <Progress value={Math.min(100, burnPct)} color={burnColor} size="sm" radius="sm" />
 <Text size="xs" c="dimmed" ta="right">{burnPct}%</Text>
 </div>
 </Tooltip>
 ) : <Text size="xs" c="dimmed">—</Text>}
 </Table.Td>
 <Table.Td>
 {row.hasTimeData
 ? <Badge size="xs" color="teal">Time Logged</Badge>
 : <Badge size="xs" color="gray">Story Points</Badge>}
 </Table.Td>
 <Table.Td>
 {row.errorMessage ? (
 <Tooltip label={row.errorMessage}>
 <IconCircleX size={18} color="#d32f2f" />
 </Tooltip>
 ) : <IconCircleCheck size={18} color="#2e7d32" />}
 </Table.Td>
 </Table.Tr>
 {isExpanded && (
 <Table.Tr style={{ backgroundColor: isDark ? '#1f1f2e' : '#f9f9f9' }}>
 <Table.Td colSpan={11} style={{ padding: '16px' }}>
 <OverrideForm
 row={row}
 overrides={rowOverrides}
 onUpdate={(field, value) => {
 setOverrides(prev => ({
 ...prev,
 [row.ppProjectId]: { ...prev[row.ppProjectId], [field]: value },
 }));
 }}
 />
 </Table.Td>
 </Table.Tr>
 )}
 </>
 );
 })}
 </Table.Tbody>
 </Table>
 </Paper>

 {/* Per-project drilldown: resource breakdown + sprint breakdown */}
 {selectedProject && filtered[0] && !filtered[0].errorMessage && (
 <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
 <ResourceBreakdown row={filtered[0]} />
 <SprintBreakdown row={filtered[0]} />
 </SimpleGrid>
 )}
 </Stack>
 );
}

function ResourceBreakdown({ row }: { row: ActualsRow }) {
 const entries = Object.entries(row.actualHoursByResource ?? {})
 .sort(([, a], [, b]) => b - a);

 if (entries.length === 0) return null;
 const max = entries[0][1];

 return (
 <ChartCard title={`Hours by Team Member — ${row.ppProjectName}`} minHeight={180}>
 <Stack gap="xs">
 {entries.map(([name, hours]) => (
 <Group key={name} gap="sm">
 <Text size="sm" style={{ width: 180, flexShrink: 0 }}>{name}</Text>
 <Box style={{ flex: 1 }}>
 <Progress
 value={(hours / max) * 100}
 color={AQUA}
 size="sm"
 radius="xs"
 />
 </Box>
 <Text size="sm" c="dimmed" style={{ width: 60, textAlign: 'right' }}>
 {Math.round(hours)} h
 </Text>
 </Group>
 ))}
 </Stack>
 </ChartCard>
 );
}

// ── Sprint Breakdown ──────────────────────────────────────────────────

function SprintBreakdown({ row }: { row: ActualsRow }) {
 const entries = Object.entries(row.sprintBreakdown ?? {})
 .sort(([, a], [, b]) => b - a);

 if (entries.length === 0) {
 return (
 <ChartCard title={`Sprint Breakdown — ${row.ppProjectName}`} minHeight={120}>
 <Text size="sm" c="dimmed">No sprint-level time data logged in Jira for this project.</Text>
 </ChartCard>
 );
 }
 const max = entries[0][1];
 const total = entries.reduce((s, [, h]) => s + h, 0);

 return (
 <ChartCard title={`Hours by Sprint — ${row.ppProjectName}`} minHeight={180}>
 <Stack gap="xs">
 {entries.map(([sprint, hours]) => (
 <Group key={sprint} gap="sm">
 <Text size="sm" style={{ flex: 1, minWidth: 0 }} lineClamp={1}>{sprint}</Text>
 <Box style={{ width: 120 }}>
 <Progress value={(hours / max) * 100} color="#1565C0" size="sm" radius="xs" />
 </Box>
 <Text size="sm" c="dimmed" style={{ width: 48, textAlign: 'right' }}>
 {Math.round(hours)} h
 </Text>
 <Badge size="xs" variant="light" color="blue">
 {Math.round((hours / total) * 100)}%
 </Badge>
 </Group>
 ))}
 </Stack>
 </ChartCard>
 );
}

// ── SummaryCard subtitle support ──────────────────────────────────────

// ── Override Form (inline editing for Jira actuals) ────────────────────────

function OverrideForm({
 row,
 overrides,
 onUpdate,
}: {
 row: ActualsRow;
 overrides: RowOverrides;
 onUpdate: (field: string, value: any) => void;
}) {
 const { editingCell, startEdit, stopEdit, isEditing } = useInlineEdit();

 const statusOptions = [
 { value: 'TODO', label: 'To Do' },
 { value: 'IN_PROGRESS', label: 'In Progress' },
 { value: 'DONE', label: 'Done' },
 { value: 'BLOCKED', label: 'Blocked' },
 ];

 return (
 <Stack gap="md">
 <Group align="flex-start" grow>
 {/* Sprint Override */}
 <Box>
 <Text size="sm" fw={600} mb="xs" c="dimmed">Sprint Override</Text>
 <InlineTextCell
 value={overrides.sprintOverride ?? ''}
 onSave={async (v) => { onUpdate('sprintOverride', v || undefined); }}
 placeholder="Enter sprint name"
 isEditing={isEditing(row.ppProjectId, 'sprintOverride')}
 onStartEdit={() => startEdit(row.ppProjectId, 'sprintOverride')}
 onCancel={() => stopEdit()}
 />
 </Box>

 {/* Story Points Override */}
 <Box>
 <Text size="sm" fw={600} mb="xs" c="dimmed">Story Points Override</Text>
 <InlineNumberCell
 value={overrides.storyPointsOverride ?? null}
 onSave={async (v) => { onUpdate('storyPointsOverride', v || undefined); }}
 min={0}
 max={1000}
 step={0.5}
 isEditing={isEditing(row.ppProjectId, 'storyPointsOverride')}
 onStartEdit={() => startEdit(row.ppProjectId, 'storyPointsOverride')}
 onCancel={() => stopEdit()}
 />
 </Box>

 {/* Status Override */}
 <Box>
 <Text size="sm" fw={600} mb="xs" c="dimmed">Status Override</Text>
 <InlineSelectCell
 value={overrides.statusOverride ?? null}
 options={statusOptions}
 onSave={async (v) => { onUpdate('statusOverride', v || undefined); }}
 placeholder="Select status"
 isEditing={isEditing(row.ppProjectId, 'statusOverride')}
 onStartEdit={() => startEdit(row.ppProjectId, 'statusOverride')}
 onCancel={() => stopEdit()}
 />
 </Box>

 {/* Category Override */}
 <Box>
 <Text size="sm" fw={600} mb="xs" c="dimmed">Category Override</Text>
 <InlineTextCell
 value={overrides.categoryOverride ?? ''}
 onSave={async (v) => { onUpdate('categoryOverride', v || undefined); }}
 placeholder="Enter category"
 isEditing={isEditing(row.ppProjectId, 'categoryOverride')}
 onStartEdit={() => startEdit(row.ppProjectId, 'categoryOverride')}
 onCancel={() => stopEdit()}
 />
 </Box>

 {/* Resource Mapping Override */}
 <Box>
 <Text size="sm" fw={600} mb="xs" c="dimmed">Resource Override</Text>
 <InlineTextCell
 value={overrides.resourceOverride ?? ''}
 onSave={async (v) => { onUpdate('resourceOverride', v || undefined); }}
 placeholder="Enter resource name"
 isEditing={isEditing(row.ppProjectId, 'resourceOverride')}
 onStartEdit={() => startEdit(row.ppProjectId, 'resourceOverride')}
 onCancel={() => stopEdit()}
 />
 </Box>
 </Group>

 <Text size="xs" c="dimmed">
 Edit fields above to override Jira data. Changes are tracked locally.
 </Text>
 </Stack>
 );
}

// ── Mapper View ───────────────────────────────────────────────────────

function MapperView({
 jiraProjects,
 jiraLoading,
 jiraError,
 ppProjects,
 mappings,
 watchConfig,
 onSave,
 onDelete,
 onBulkSave,
 onRefreshJira,
}: {
 jiraProjects: JiraProjectInfo[];
 jiraLoading: boolean;
 jiraError: unknown;
 ppProjects: ProjectResponse[];
 mappings: MappingResponse[];
 watchConfig: PodConfigResponse[];
 onSave: (req: any) => Promise<void>;
 onDelete: (id: number) => Promise<void>;
 onBulkSave: (reqs: any[]) => Promise<void>;
 onRefreshJira: () => void;
}) {
 const isDark = useDarkMode();
 const [addModal, setAddModal] = useState(false);
 const [form, setForm] = useState({
 ppProjectId: '',
 jiraProjectKey: '',
 matchType: 'EPIC_NAME',
 matchValue: '',
 });

 // Board keys that belong to any configured POD — used to filter the Jira Space picker
 const podBoardKeys = useMemo(() =>
 new Set(watchConfig.flatMap(p => p.boardKeys)),
 [watchConfig]
 );

 // Only show boards that are assigned to a POD; fall back to all if none configured
 const pickerProjects = useMemo(() =>
 podBoardKeys.size > 0
 ? jiraProjects.filter(p => podBoardKeys.has(p.key))
 : jiraProjects,
 [jiraProjects, podBoardKeys]
 );

 const selectedJiraProject = jiraProjects.find(p => p.key === form.jiraProjectKey);
 const matchOptions = useMemo(() => {
 if (!selectedJiraProject) return [];
 if (form.matchType === 'EPIC_NAME')
 return selectedJiraProject.epics.map(e => ({ value: e.name, label: `${e.name} (${e.key})` }));
 if (form.matchType === 'LABEL')
 return selectedJiraProject.labels.map(l => ({ value: l, label: l }));
 return [];
 }, [selectedJiraProject, form.matchType]);

 const unmappedProjects = ppProjects.filter(
 p => !['COMPLETED', 'CANCELLED'].includes(p.status) && !mappings.some(m => m.ppProjectId === p.id)
 );

 const enabledPods = watchConfig.filter(p => p.enabled && p.boardKeys.length > 0);

 return (
 <Stack gap="sm">
 {/* ── Toolbar ── */}
 <Group justify="space-between">
 <Group gap="xs" wrap="wrap">
 {/* POD badges — show configured PODs instead of raw Jira spaces */}
 {jiraError ? (
 <Tooltip label={`${(jiraError as any)?.message} — test: /api/jira/test`}>
 <Badge color="red" leftSection={<IconAlertTriangle size={10} />}>
 Jira unreachable
 </Badge>
 </Tooltip>
 ) : enabledPods.length > 0 ? (
 <>
 <Text size="xs" c="dimmed" fw={600}>PODs:</Text>
 {enabledPods.map(pod => (
 <Tooltip
 key={pod.id}
 label={`Boards: ${pod.boardKeys.join(', ')}`}
 >
 <Badge size="sm" variant="dot" color="blue">{pod.podDisplayName}</Badge>
 </Tooltip>
 ))}
 </>
 ) : (
 <>
 <Text size="xs" c="dimmed" fw={600}>Jira spaces:</Text>
 {jiraLoading ? (
 <Skeleton height={20} width={80} radius="sm" />
 ) : jiraProjects.length === 0 ? (
 <Badge color="orange" size="sm">0 projects</Badge>
 ) : (
 jiraProjects.map(jp => (
 <Tooltip key={jp.key} label={`${jp.name} · ${jp.epics.length} epics`}>
 <Badge size="sm" variant="dot" color="blue">{jp.key}</Badge>
 </Tooltip>
 ))
 )}
 </>
 )}
 </Group>
 <Group gap="xs">
 {unmappedProjects.length > 0 && (
 <Tooltip label={`Unmapped: ${unmappedProjects.map(p => p.name).join(', ')}`}>
 <Badge color="orange" size="sm" variant="light"
 leftSection={<IconInfoCircle size={11} />}>
 {unmappedProjects.length} unmapped
 </Badge>
 </Tooltip>
 )}
 <ActionIcon
 variant="subtle"
 size="sm"
 loading={jiraLoading}
 onClick={onRefreshJira}
 title="Refresh Jira projects & epics"
 >
 <IconRefresh size={15} />
 </ActionIcon>
 <Button
 size="xs"
 leftSection={<IconPlus size={13} />}
 style={{ backgroundColor: isDark ? '#4a5568' : DEEP_BLUE }}
 onClick={() => setAddModal(true)}
 >
 Add Mapping
 </Button>
 </Group>
 </Group>

 {/* ── Mappings table ── */}
 <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
 <Table fz="xs" highlightOnHover verticalSpacing={6}>
 <Table.Thead style={{ backgroundColor: isDark ? '#2d2d2d' : DEEP_BLUE }}>
 <Table.Tr>
 <Table.Th style={{ color: 'white', fontSize: 12 }}>PP Project</Table.Th>
 <Table.Th style={{ color: 'white', fontSize: 12 }}>Jira Space</Table.Th>
 <Table.Th style={{ color: 'white', fontSize: 12 }}>Type</Table.Th>
 <Table.Th style={{ color: 'white', fontSize: 12 }}>Match Value</Table.Th>
 <Table.Th style={{ color: 'white', fontSize: 12, width: 40 }} />
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {mappings.length === 0 ? (
 <Table.Tr>
 <Table.Td colSpan={5}
 style={{ textAlign: 'center', color: '#aaa', padding: '20px', fontSize: 13 }}>
 No mappings yet — click <strong>Add Mapping</strong> to link a project
 </Table.Td>
 </Table.Tr>
 ) : mappings.map(m => (
 <Table.Tr key={m.id}>
 <Table.Td>
 <Text size="sm" fw={500}>{m.ppProjectName}</Text>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="outline" color="blue">{m.jiraProjectKey}</Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" color={m.matchType === 'EPIC_NAME' ? 'indigo' : m.matchType === 'LABEL' ? 'violet' : 'gray'}>
 {m.matchType?.replace(/_/g, ' ')}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c="dimmed" truncate maw={220}>{m.matchValue}</Text>
 </Table.Td>
 <Table.Td>
 <ActionIcon color="red" variant="subtle" size="xs" onClick={() => onDelete(m.id)}>
 <IconTrash size={13} />
 </ActionIcon>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </Paper>

 {/* ── Add Mapping Modal ── */}
 <Modal
 opened={addModal}
 onClose={() => setAddModal(false)}
 title={<Text fw={700} style={{ color: isDark ? '#fff' : DEEP_BLUE }}>Add Jira Mapping</Text>}
 size="xl"
 >
 <Stack gap="sm">
 <Select
 label="Portfolio Planner Project"
 placeholder="Pick a project"
 required
 searchable
 data={ppProjects
 .filter(p => !['COMPLETED', 'CANCELLED'].includes(p.status))
 .map(p => ({ value: String(p.id), label: `${p.name}${p.status !== 'ACTIVE' ? ` (${p.status.replace('_', ' ')})` : ''}` }))}
 value={form.ppProjectId}
 onChange={v => setForm(f => ({ ...f, ppProjectId: v ?? '' }))}
 />
 <Select
 label={podBoardKeys.size > 0 ? 'Jira Board (from configured PODs)' : 'Jira Space'}
 placeholder={
 jiraLoading ? 'Loading boards…' :
 pickerProjects.length === 0 ? 'No boards available — configure PODs in Settings' :
 'Pick a board'
 }
 required
 searchable
 data={pickerProjects.map(p => ({ value: p.key, label: `${p.key} — ${p.name}` }))}
 value={form.jiraProjectKey}
 onChange={v => setForm(f => ({ ...f, jiraProjectKey: v ?? '', matchValue: '' }))}
 disabled={jiraLoading && pickerProjects.length === 0}
 description={
 podBoardKeys.size > 0
 ? `Showing ${pickerProjects.length} board(s) from your configured PODs`
 : undefined
 }
 />
 <SegmentedControl
 fullWidth
 size="xs"
 value={form.matchType}
 onChange={v => setForm(f => ({ ...f, matchType: v, matchValue: '' }))}
 data={[
 { label: 'Epic Name', value: 'EPIC_NAME' },
 { label: 'Label', value: 'LABEL' },
 { label: 'Whole Project', value: 'PROJECT_NAME' },
 ]}
 />
 {form.matchType === 'PROJECT_NAME' ? (
 <Text size="xs" c="dimmed" ta="center">
 All issues in the Jira project will count for this PP project.
 </Text>
 ) : (
 <Select
 label={form.matchType === 'EPIC_NAME' ? 'Epic' : 'Label'}
 placeholder={
 !form.jiraProjectKey ? 'Select a Jira space first' :
 matchOptions.length === 0 ? `No ${form.matchType === 'EPIC_NAME' ? 'epics' : 'labels'} found` :
 `Select ${form.matchType === 'EPIC_NAME' ? 'epic' : 'label'}`
 }
 required
 searchable
 nothingFoundMessage={
 jiraLoading ? 'Loading…' :
 !form.jiraProjectKey ? 'Select a Jira space first' :
 `No ${form.matchType === 'EPIC_NAME' ? 'epics' : 'labels'} found — try "Whole Project"`
 }
 data={matchOptions}
 value={form.matchValue}
 onChange={v => setForm(f => ({ ...f, matchValue: v ?? '' }))}
 disabled={!form.jiraProjectKey}
 />
 )}
 <Button
 fullWidth
 style={{ backgroundColor: isDark ? '#4a5568' : DEEP_BLUE }}
 mt={4}
 disabled={!form.ppProjectId || !form.jiraProjectKey ||
 (form.matchType !== 'PROJECT_NAME' && !form.matchValue)}
 onClick={async () => {
 await onSave({
 ppProjectId: Number(form.ppProjectId),
 jiraProjectKey: form.jiraProjectKey,
 matchType: form.matchType,
 matchValue: form.matchType === 'PROJECT_NAME' ? form.jiraProjectKey : form.matchValue,
 });
 setAddModal(false);
 setForm({ ppProjectId: '', jiraProjectKey: '', matchType: 'EPIC_NAME', matchValue: '' });
 }}
 >
 Save Mapping
 </Button>
 </Stack>
 </Modal>
 </Stack>
 );
}

// ── Small summary card ────────────────────────────────────────────────

function SummaryCard({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
 return (
 <Paper
 withBorder
 p="md"
 radius="md"
 style={{ borderLeft: `4px solid ${color}` }}
 >
 <Text size="xs" tt="uppercase" fw={600} c="dimmed">{label}</Text>
 <Text size="xl" fw={700} style={{ color }}>{value}</Text>
 {subtitle && <Text size="xs" c="dimmed" mt={2}>{subtitle}</Text>}
 </Paper>
 );
}
