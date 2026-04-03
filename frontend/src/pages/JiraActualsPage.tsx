import { useState, useMemo } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import {
 Box, Title, Text, Group, Stack, Badge, Button, Select, Table,
 Tabs, Alert, Loader, Tooltip, ActionIcon, Modal, NumberInput,
 SegmentedControl, Progress, Paper, Divider, ThemeIcon,
} from '@mantine/core';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
 IconTicket, IconLink, IconLinkOff, IconRefresh, IconCheck,
 IconAlertTriangle, IconPlus, IconTrash, IconChartBar, IconSettings,
 IconCircleCheck, IconCircleX, IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import ChartCard from '../components/common/ChartCard';
import {
 useJiraStatus, useJiraProjects, useJiraMappings, useJiraActuals,
 useSaveMapping, useSaveMappingsBulk, useDeleteMapping,
 usePodWatchConfig,
 JiraProjectInfo, MappingResponse, ActualsRow, PodConfigResponse,
} from '../api/jira';
import { useProjects } from '../api/projects';
import { ProjectResponse } from '../types/project';
import { DEEP_BLUE, AQUA, AQUA_TINTS, FONT_FAMILY } from '../brandTokens';

// ── Month ordering helper ─────────────────────────────────────────────
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
 <Box p="md" className="page-enter stagger-children">
 {/* Header */}
 <Group justify="space-between" mb="lg" className="slide-in-left">
 <Group gap="sm">
 <ThemeIcon size={38} radius="md" style={{ backgroundColor: isDark ? '#4a5568' : DEEP_BLUE }}>
 <IconTicket size={22} color="white" />
 </ThemeIcon>
 <div>
 <Title order={3} style={{ color: isDark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
 Jira Actuals
 </Title>
 <Text size="sm" c="dimmed">
 Compare planned estimates against actual Jira activity · {status.baseUrl}
 </Text>
 </div>
 </Group>
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
 leftSection={<IconRefresh size={14} />}
 loading={actualsLoading}
 onClick={() => { refetchActuals(); refetchMappings(); }}
 >
 Sync
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
 <Alert icon={<IconInfoCircle />} color="blue">
 No project mappings configured yet. Go to the{' '}
 <strong>Project Mapper</strong> tab to link your Jira epics/labels
 to Portfolio Planner projects.
 </Alert>
 ) : actualsLoading ? (
 <Stack align="center" py="xl">
 <Loader />
 <Text size="sm" c="dimmed">Fetching data from Jira…</Text>
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

 const totalActual = filtered.reduce((s, r) => {
 if (r.errorMessage) return s;
 const hrs = unit === 'hours'
 ? Object.values(r.actualHoursByMonth ?? {}).reduce((a, b) => a + b, 0)
 : r.storyPointHours;
 return s + hrs;
 }, 0);

 const totalIssues = filtered.reduce((s, r) => s + (r.issueCount ?? 0), 0);
 const totalSP = filtered.reduce((s, r) => s + (r.totalStoryPoints ?? 0), 0);

 return (
 <Stack gap="md">
 {/* Summary cards */}
 <Group grow>
 <SummaryCard
 label="Total Issues"
 value={String(totalIssues)}
 color={DEEP_BLUE}
 />
 <SummaryCard
 label={unit === 'hours' ? 'Actual Hours' : 'Story Points'}
 value={unit === 'hours'
 ? `${Math.round(totalActual).toLocaleString()} h`
 : `${Math.round(totalSP)} SP`}
 color={AQUA}
 />
 <SummaryCard
 label="Mapped Projects"
 value={String(actuals.filter(a => !a.errorMessage).length)}
 color="#2e7d32"
 />
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
 <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
 <XAxis dataKey="month" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} />
 <RTooltip
 formatter={(v: number) =>
 unit === 'hours' ? [`${v} hrs`, 'Actual'] : [`${v} SP`, 'Actual']}
 />
 <Bar dataKey="actual" fill={AQUA} radius={[3, 3, 0, 0]} name="Actual" />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>
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
 <Table.Th style={{ color: 'white' }}>Data Source</Table.Th>
 <Table.Th style={{ color: 'white' }}>Status</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {filtered.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={8} style={{ textAlign: 'center', color: '#999', padding: '24px' }}>
 No actuals data yet
 </Table.Td>
 </Table.Tr>
 )}
 {filtered.map(row => {
 const totalHrs = Object.values(row.actualHoursByMonth ?? {})
 .reduce((a, b) => a + b, 0);
 return (
 <Table.Tr key={row.ppProjectId}>
 <Table.Td fw={500}>{row.ppProjectName}</Table.Td>
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
 <Table.Td style={{ textAlign: 'right' }}>
 {Math.round(totalHrs).toLocaleString()} h
 </Table.Td>
 <Table.Td>
 {row.hasTimeData
 ? <Badge size="xs" color="teal">Time Logged</Badge>
 : <Badge size="xs" color="gray">Story Points</Badge>}
 </Table.Td>
 <Table.Td>
 {row.errorMessage
 ? (
 <Tooltip label={row.errorMessage}>
 <IconCircleX size={18} color="#d32f2f" />
 </Tooltip>
 )
 : <IconCircleCheck size={18} color="#2e7d32" />}
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </Paper>

 {/* Per-resource breakdown for selected project */}
 {selectedProject && filtered[0] && !filtered[0].errorMessage && (
 <ResourceBreakdown row={filtered[0]} />
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
 <Loader size="xs" />
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

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
 return (
 <Paper
 withBorder
 p="md"
 radius="md"
 style={{ borderLeft: `4px solid ${color}` }}
 >
 <Text size="xs" tt="uppercase" fw={600} c="dimmed">{label}</Text>
 <Text size="xl" fw={700} style={{ color }}>{value}</Text>
 </Paper>
 );
}
