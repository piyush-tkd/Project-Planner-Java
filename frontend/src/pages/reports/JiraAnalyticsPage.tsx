import { useState, useMemo, useCallback } from 'react';
import {
 Text, Badge, Group, SegmentedControl, SimpleGrid, Paper, ThemeIcon,
 MultiSelect, Button, Stack, Tooltip, ActionIcon,
 Drawer, Table, ScrollArea, Collapse
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
 IconRefresh, IconBug, IconClock, IconRocket, IconUsers,
 IconAlertTriangle, IconFlame,
 IconPackage, IconCloudDownload, IconFilter,
 IconX, IconArrowRight, IconCategory, IconLayoutBoard
} from '@tabler/icons-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 ResponsiveContainer, Legend, PieChart, Pie, Cell,
 AreaChart, Area
} from 'recharts';
import {
 useJiraAnalytics, useJiraAnalyticsFilters, useJiraSyncStatus, useTriggerJiraSync,
 type AnalyticsBreakdown
} from '../../api/jira';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import ReportPageShell from '../../components/common/ReportPageShell';
import { EmptyState } from '../../components/ui';
import { AQUA_HEX, AQUA, COLOR_AMBER_DARK, COLOR_BLUE, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR, COLOR_ERROR_DARK, COLOR_GREEN, COLOR_VIOLET, COLOR_WARNING, DEEP_BLUE, DEEP_BLUE_TINTS, SHADOW, TEXT_SUBTLE} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

/* ── Palette ──────────────────────────────────────────────────────────── */
const PIE_COLORS = [
 AQUA, COLOR_VIOLET, DEEP_BLUE, '#DB2777', COLOR_AMBER_DARK,
 COLOR_EMERALD, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, '#0891B2', '#65A30D',
 '#6366F1', COLOR_WARNING, '#EC4899', '#14B8A6',
];

const PRIORITY_COLORS: Record<string, string> = {
 Highest: COLOR_ERROR_DARK, Critical: COLOR_ERROR_DARK, Blocker: COLOR_ERROR_DARK,
 High: COLOR_WARNING, Medium: COLOR_BLUE, Low: COLOR_GREEN, Lowest: TEXT_SUBTLE
};

const STATUS_CATEGORY_COLORS: Record<string, string> = {
 'To Do': TEXT_SUBTLE, 'In Progress': COLOR_WARNING, Done: COLOR_GREEN,
 'In Review': COLOR_VIOLET, Backlog: '#CBD5E1'
};

/* ── Keyframes ────────────────────────────────────────────────────────── */
const KF_ID = 'jira-analytics-kf';
if (typeof document !== 'undefined' && !document.getElementById(KF_ID)) {
 const s = document.createElement('style');
 s.id = KF_ID;
 s.textContent = `
 @keyframes ja-pop { from { opacity:0; transform:scale(.95) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
 @keyframes ja-slide { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
 `;
 document.head.appendChild(s);
}

/* ── Clickable KPI Card ───────────────────────────────────────────────── */
function KpiCard({ label, value, unit, icon, color, subtitle, onClick }: {
 label: string; value: string | number; unit?: string;
 icon: React.ReactNode; color: string; subtitle?: string;
 onClick?: () => void;
}) {
 const dark = useDarkMode();
 return (
 <Paper
 withBorder radius="md" p="lg"
 style={{
 boxShadow: SHADOW.card,
 cursor: onClick ? 'pointer' : 'default',
 transition: 'all 0.2s ease',
 borderLeft: `4px solid ${color}`}}
 onClick={onClick}
 onMouseEnter={(e) => {
 if (onClick) {
 e.currentTarget.style.boxShadow = SHADOW.cardHover;
 e.currentTarget.style.transform = 'translateY(-2px)';
 }
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.boxShadow = SHADOW.card;
 e.currentTarget.style.transform = '';
 }}
 >
 <Group gap="md" wrap="nowrap">
 <ThemeIcon size={48} radius="xl" variant="light" color={color}>
 {icon}
 </ThemeIcon>
 <div style={{ flex: 1, minWidth: 0 }}>
 <Text size="xs" c="dimmed" tt="uppercase" fw={600}
 style={{letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
 {label}
 </Text>
 <Group gap={6} align="baseline" wrap="nowrap">
 <Text fw={800}
 style={{color: 'var(--pp-text)', lineHeight: 1.1, fontSize: '1.75rem' }}>
 {value}
 </Text>
 {unit && <Text size="sm" c="dimmed" style={{ }}>{unit}</Text>}
 </Group>
 {subtitle && <Text size="xs" c="dimmed" mt={4} style={{ }}>{subtitle}</Text>}
 </div>
 {onClick && (
 <Tooltip label="Click to drill down" withArrow>
 <IconArrowRight size={16} color={dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[30]} style={{ flexShrink: 0 }} />
 </Tooltip>
 )}
 </Group>
 </Paper>
 );
}

/* ── Interactive Donut chart ──────────────────────────────────────────── */
function DonutChart({ data, title, colorMap, onSliceClick, highlightNames, dark }: {
 data: AnalyticsBreakdown[]; title: string;
 colorMap?: Record<string, string>;
 onSliceClick?: (name: string) => void;
 highlightNames?: string[];
 dark?: boolean;
}) {
 const chartData = data.slice(0, 10);
 const total = chartData.reduce((s, d) => s + d.count, 0);

 return (
 <ChartCard title={title} minHeight={280}>
 <div role="img" aria-label="Pie chart">
 <ResponsiveContainer width="100%" height={260}>
 <PieChart>
 <Pie
 data={chartData}
 cx="50%" cy="50%"
 innerRadius={55} outerRadius={90}
 dataKey="count"
 nameKey="name"
 paddingAngle={2}
 style={{fontSize: 10, cursor: onSliceClick ? 'pointer' : 'default' }}
 label={({ name, percent }) =>
 `${name.length > 12 ? name.slice(0, 12) + '…' : name} ${(percent * 100).toFixed(0)}%`
 }
 onClick={(_: unknown, idx: number) => {
 if (onSliceClick && chartData[idx]) onSliceClick(chartData[idx].name);
 }}
 >
 {chartData.map((d, i) => {
 const isHighlighted = !highlightNames?.length || highlightNames.includes(d.name);
 return (
 <Cell
 key={i}
 fill={colorMap?.[d.name] ?? PIE_COLORS[i % PIE_COLORS.length]}
 stroke={dark ? '#1a1b1e' : 'white'}
 strokeWidth={2}
 opacity={isHighlighted ? 1 : 0.3}
 />
 );
 })}
 </Pie>
 <RTooltip
 contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }}
 formatter={(value: number, name: string) => [
 `${value} (${total > 0 ? Math.round(value * 100 / total) : 0}%)`, name,
 ]}
 />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 );
}

/* ── Horizontal bar chart ─────────────────────────────────────────────── */
function HorizontalBarChart({ data, title, dataKey, barColor, maxItems = 15, onBarClick, dark }: {
 data: AnalyticsBreakdown[];
 title: string; dataKey: string; barColor?: string; maxItems?: number;
 onBarClick?: (name: string) => void;
 dark?: boolean;
}) {
 const sliced = data.slice(0, maxItems);
 const height = Math.max(200, sliced.length * 32 + 40);

 return (
 <ChartCard title={title} minHeight={height}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={height}>
 <BarChart data={sliced} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 120 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}} />
 <YAxis
 type="category" dataKey="name" width={110}
 tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Bar
 dataKey={dataKey}
 fill={barColor ?? AQUA}
 radius={[0, 4, 4, 0]}
 cursor={onBarClick ? 'pointer' : 'default'}
 onClick={(d: { name: string }) => { if (onBarClick && d?.name) onBarClick(d.name); }}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 );
}

/* ── Drill-down Drawer ────────────────────────────────────────────────── */
type DrillTab = 'byStatus' | 'byType' | 'byPriority' | 'byAssignee' | 'byPod';

function DrillDrawer({ opened, onClose, title, breakdowns }: {
 opened: boolean; onClose: () => void; title: string;
 breakdowns: Record<string, AnalyticsBreakdown[]>;
}) {
 const dark = useDarkMode();
 const [tab, setTab] = useState<DrillTab>('byAssignee');
 const current = breakdowns[tab] ?? [];
 const sorted = [...current].filter(d => d.count > 0).sort((a, b) => b.count - a.count);
 const hasSp = sorted.some(d => d.sp != null && d.sp > 0);
 const hasHours = sorted.some(d => d.hours != null && d.hours > 0);
 const totalCount = sorted.reduce((s, d) => s + d.count, 0);
 const totalSp = hasSp ? sorted.reduce((s, d) => s + (d.sp ?? 0), 0) : 0;
 const totalHrs = hasHours ? sorted.reduce((s, d) => s + (d.hours ?? 0), 0) : 0;

 const tabs: { key: DrillTab; label: string }[] = [
 { key: 'byAssignee', label: 'By Assignee' },
 { key: 'byType', label: 'By Type' },
 { key: 'byStatus', label: 'By Status' },
 { key: 'byPriority', label: 'By Priority' },
 { key: 'byPod', label: 'By POD' },
 ];

 return (
 <Drawer opened={opened} onClose={onClose} title={title} position="right"
 size="xl" overlayProps={{ blur: 2, backgroundOpacity: 0.15 }}
 styles={{ title: {fontWeight: 700, color: 'var(--pp-text)' } }}>
 <Stack gap="sm">
 {/* Summary row */}
 <Group gap="lg">
 <Paper withBorder p="xs" radius="sm" style={{ borderLeft: `3px solid ${AQUA}` }}>
 <Text size="xs" c="dimmed" style={{ }}>Total Issues</Text>
 <Text fw={700} size="lg" style={{color: 'var(--pp-text)' }}>{totalCount}</Text>
 </Paper>
 {hasSp && (
 <Paper withBorder p="xs" radius="sm" style={{ borderLeft: '3px solid #7C3AED' }}>
 <Text size="xs" c="dimmed" style={{ }}>Story Points</Text>
 <Text fw={700} size="lg" style={{color: dark ? '#fff' : DEEP_BLUE }}>{totalSp}</Text>
 </Paper>
 )}
 {hasHours && (
 <Paper withBorder p="xs" radius="sm" style={{ borderLeft: '3px solid #059669' }}>
 <Text size="xs" c="dimmed" style={{ }}>Hours</Text>
 <Text fw={700} size="lg" style={{color: dark ? '#fff' : DEEP_BLUE }}>{totalHrs.toFixed(1)}</Text>
 </Paper>
 )}
 </Group>

 {/* Tab selector */}
 <SegmentedControl
 size="xs"
 value={tab}
 onChange={(v) => setTab(v as DrillTab)}
 data={tabs.filter(t => (breakdowns[t.key]?.length ?? 0) > 0).map(t => ({ value: t.key, label: t.label }))}
 styles={{ root: { } }}
 />

 <ScrollArea h="calc(100vh - 220px)">
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ }}>Name</Table.Th>
 <Table.Th style={{textAlign: 'right' }}>Issues</Table.Th>
 <Table.Th style={{textAlign: 'right' }}>%</Table.Th>
 {hasSp && <Table.Th style={{textAlign: 'right' }}>SP</Table.Th>}
 {hasHours && <Table.Th style={{textAlign: 'right' }}>Hours</Table.Th>}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sorted.map((row, i) => (
 <Table.Tr key={i}>
 <Table.Td style={{fontWeight: 500 }}>{row.name}</Table.Td>
 <Table.Td style={{textAlign: 'right' }}>{row.count}</Table.Td>
 <Table.Td style={{textAlign: 'right', color: DEEP_BLUE_TINTS[50] }}>
 {totalCount > 0 ? `${Math.round(row.count * 100 / totalCount)}%` : '–'}
 </Table.Td>
 {hasSp && (
 <Table.Td style={{textAlign: 'right' }}>{row.sp ?? '–'}</Table.Td>
 )}
 {hasHours && (
 <Table.Td style={{textAlign: 'right' }}>
 {row.hours != null ? row.hours.toFixed(1) : '–'}
 </Table.Td>
 )}
 </Table.Tr>
 ))}
 {sorted.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={5}><Text c="dimmed" ta="center" py="lg">No data for this view</Text></Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Stack>
 </Drawer>
 );
}

/* ── Active Filter Chips ──────────────────────────────────────────────── */
function ActiveFilters({ filters, onClear, onClearAll }: {
 filters: { key: string; label: string; values: string[] }[];
 onClear: (key: string, value: string) => void;
 onClearAll: () => void;
}) {
 const hasAny = filters.some(f => f.values.length > 0);
 if (!hasAny) return null;
 return (
 <Group gap={6} mt="xs" style={{ animation: 'ja-slide 0.2s ease-out' }}>
 <Text size="xs" c="dimmed" fw={600} style={{ }}>Active:</Text>
 {filters.flatMap(f =>
 f.values.map(v => (
 <Badge key={`${f.key}-${v}`} size="sm" variant="light" color="blue" radius="sm"
 rightSection={
 <ActionIcon size={14} variant="transparent" color="blue"
 onClick={() => onClear(f.key, v)}
      aria-label="Close"
    >
 <IconX size={10} />
 </ActionIcon>
 }
 styles={{ root: {cursor: 'default', paddingRight: 4 } }}>
 {f.label}: {v}
 </Badge>
 ))
 )}
 <Button variant="subtle" size="compact-xs" color="red" onClick={onClearAll}
 style={{ }}>
 Clear all
 </Button>
 </Group>
 );
}

/* ════════════════════════════════════════════════════════════════════════════
 Main page
 ════════════════════════════════════════════════════════════════════════════ */
export default function JiraAnalyticsPage() {
 const dark = useDarkMode();
 /* ── State ── */
 const [months, setMonths] = useState(3);
 const [selectedPods, setSelectedPods] = useState<string[]>([]);
 const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
 const [selectedReleases, setSelectedReleases] = useState<string[]>([]);
 const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
 const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
 const [filtersOpen, { toggle: toggleFilters }] = useDisclosure(true);
 const [drillOpen, setDrillOpen] = useState(false);
 const [drillTitle, setDrillTitle] = useState('');

 /* ── Data hooks ── */
 const podsParam = selectedPods.length > 0 ? selectedPods.join(',') : undefined;
 const { data, isLoading, isFetching, error, refetch } = useJiraAnalytics(months, podsParam);
 const { data: filters } = useJiraAnalyticsFilters();
 const { data: syncStatus } = useJiraSyncStatus();
 const triggerSync = useTriggerJiraSync();

 /* ── Derived filter options ── */
 const podOptions = useMemo(() =>
 (filters?.pods ?? []).map(p => ({ value: String(p.id), label: p.name })),
 [filters],
 );

 const typeOptions = useMemo(() =>
 (data?.byType ?? []).map(t => ({ value: t.name, label: t.name })),
 [data?.byType],
 );

 const releaseOptions = useMemo(() =>
 (data?.byFixVersion ?? []).map(v => ({ value: v.name, label: v.name })),
 [data?.byFixVersion],
 );

 const boardOptions = useMemo(() => {
 const boards: { value: string; label: string }[] = [];
 (filters?.pods ?? []).forEach(pod => {
 pod.projectKeys.forEach(pk => {
 if (!boards.find(b => b.value === pk)) {
 boards.push({ value: pk, label: `${pk} (${pod.name})` });
 }
 });
 });
 return boards;
 }, [filters]);

 const sprintOptions = useMemo(() =>
 (data?.bySprint ?? []).map(s => ({ value: s.name, label: s.name })),
 [data?.bySprint],
 );

 const activeFilterCount = selectedPods.length + selectedTypes.length
 + selectedReleases.length + selectedBoards.length + selectedSprints.length;

 /* ── Client-side filtering: apply to ALL breakdown arrays ── */
 const fd = useMemo(() => {
 if (!data) return data;
 // Helper: filter a breakdown array by selected type names
 const matchType = (arr: AnalyticsBreakdown[]) =>
 selectedTypes.length > 0 ? arr.filter(d => selectedTypes.includes(d.name)) : arr;
 const matchRelease = (arr: AnalyticsBreakdown[]) =>
 selectedReleases.length > 0 ? arr.filter(d => selectedReleases.includes(d.name)) : arr;

 return {
 ...data,
 byType: matchType(data.byType),
 byFixVersion: matchRelease(data.byFixVersion),
 // Note: byStatus, byPriority, byAssignee, byPod etc. come pre-aggregated from the server.
 // We can't granularly cross-filter them client-side (e.g. "show only Bugs by Status"),
 // because the API returns independent aggregations, not a data cube.
 // The POD filter IS applied server-side via the podsParam. Type/release filters
 // highlight their respective donuts/bars. For full cross-filtering, the user
 // should use the Dashboard Builder which supports per-widget data keys.
 };
 }, [data, selectedTypes, selectedReleases]);

 /* ── Filter clearing helpers ── */
 const clearFilter = useCallback((key: string, value: string) => {
 if (key === 'pod') setSelectedPods(prev => prev.filter(v => v !== value));
 if (key === 'type') setSelectedTypes(prev => prev.filter(v => v !== value));
 if (key === 'release') setSelectedReleases(prev => prev.filter(v => v !== value));
 if (key === 'board') setSelectedBoards(prev => prev.filter(v => v !== value));
 if (key === 'sprint') setSelectedSprints(prev => prev.filter(v => v !== value));
 }, []);

 const clearAllFilters = useCallback(() => {
 setSelectedPods([]);
 setSelectedTypes([]);
 setSelectedReleases([]);
 setSelectedBoards([]);
 setSelectedSprints([]);
 }, []);

 /* ── Drill-down helpers ── */
 const drillBreakdowns = useMemo(() => {
 const empty: Record<string, AnalyticsBreakdown[]> = {};
 if (!data) return empty;
 return {
 byAssignee: data.byAssignee,
 byType: data.byType,
 byStatus: data.byStatus,
 byPriority: data.byPriority,
 byPod: data.byPod
 } as Record<string, AnalyticsBreakdown[]>;
 }, [data]);

 const openDrill = useCallback((title: string) => {
 setDrillTitle(title);
 setDrillOpen(true);
 }, []);

 /* ── Loading / error states ── */
 if (isLoading) return <LoadingSpinner variant="chart" message="Fetching Jira analytics..." />;
 if (error) return <PageError context="loading Jira analytics" error={error} onRetry={() => refetch()} />;
 if (!data || data.error) {
 if (data?.needsSync) {
 return (
 <EmptyState
 icon={<IconCloudDownload size={40} stroke={1.5} />}
 title="No synced data yet"
 description="Jira issues need to be synced to the local database before analytics can be displayed."
 actionLabel={syncStatus?.syncing ? 'Syncing…' : 'Start Full Sync'}
 onAction={() => triggerSync.mutate(true, { onSuccess: () => notifications.show({ title: 'Sync started', message: 'Full Jira sync is running.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Sync failed', message: (e as Error).message || 'Could not start sync.', color: 'red' }) })}
 />
 );
 }
 return (
 <PageError context="loading Jira analytics"
 error={new Error(data?.error ?? 'No data available')}
 onRetry={() => refetch()} />
 );
 }

 const k = data.kpis;
 const filteredData = fd!;

 /* ── Pod labels for active filter chips ── */
 const podLabels: Record<string, string> = {};
 podOptions.forEach(p => { podLabels[p.value] = p.label; });

 return (
 <>
 <ReportPageShell
 title="Jira Analytics"
 subtitle="Slice & dice all Jira data — issues, sprints, workload, releases, and more"
 filters={
 <Stack gap="xs" style={{ width: '100%' }}>
 {/* ── Primary controls row ── */}
 <Group gap="md" align="flex-end" wrap="wrap">
 <div>
 <Text size="xs" c="dimmed" mb={4} style={{ }}>Lookback</Text>
 <SegmentedControl
 value={String(months)}
 onChange={v => setMonths(Number(v))}
 data={[
 { value: '1', label: '1 mo' },
 { value: '3', label: '3 mo' },
 { value: '6', label: '6 mo' },
 { value: '12', label: '12 mo' },
 ]}
 size="sm"
 styles={{ root: { } }}
 />
 </div>

 <Tooltip label={`Covering ${data.projectKeys.length} Jira projects across ${data.podNames.length} PODs`}>
 <Badge size="lg" variant="light" color="blue" radius="sm"
 styles={{ root: {cursor: 'help' } }}>
 {data.projectKeys.length} Projects
 </Badge>
 </Tooltip>

 <Button
 variant={filtersOpen ? 'light' : 'subtle'}
 size="sm"
 color={activeFilterCount > 0 ? 'blue' : 'gray'}
 leftSection={<IconFilter size={15} />}
 rightSection={activeFilterCount > 0 ? (
 <Badge size="xs" circle color="blue" variant="filled">{activeFilterCount}</Badge>
 ) : undefined}
 onClick={toggleFilters}
 style={{ }}>
 Filters
 </Button>

 <Button variant="light" size="sm"
 leftSection={<IconRefresh size={15} />}
 loading={isFetching}
 onClick={() => refetch()}
 style={{ }}>
 Refresh
 </Button>
 <Tooltip label={syncStatus?.syncing ? 'Sync in progress…' : 'Sync Jira data to local DB'}>
 <Button variant="light" size="sm" color="teal"
 leftSection={<IconCloudDownload size={15} />}
 loading={syncStatus?.syncing || triggerSync.isPending}
 onClick={() => triggerSync.mutate(false, { onSuccess: () => notifications.show({ title: 'Sync started', message: 'Jira sync is running.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Sync failed', message: (e as Error).message || 'Could not start sync.', color: 'red' }) })}
 style={{ }}>
 {syncStatus?.syncing ? 'Syncing…' : 'Sync'}
 </Button>
 </Tooltip>
 {data?.lastSyncAt && (
 <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap'}}>
 Last synced: {data.lastSyncAt}
 </Text>
 )}
 </Group>

 {/* ── Expanded filters panel ── */}
 <Collapse in={filtersOpen}>
 <Paper withBorder p="sm" radius="md"
 style={{ background: dark ? 'rgba(255,255,255,0.04)' : DEEP_BLUE_TINTS[10] + '44', borderColor: dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10] }}>
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
 <div>
 <Group gap={6} mb={4}>
 <IconUsers size={13} color={dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ }}>POD / Team</Text>
 </Group>
 <MultiSelect
 data={podOptions}
 value={selectedPods}
 onChange={setSelectedPods}
 placeholder="All PODs"
 size="xs"
 clearable
 maxDropdownHeight={200}
 styles={{ input: { } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconCategory size={13} color={dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ }}>Issue Type</Text>
 </Group>
 <MultiSelect
 data={typeOptions}
 value={selectedTypes}
 onChange={setSelectedTypes}
 placeholder="All types"
 size="xs"
 clearable
 maxDropdownHeight={200}
 styles={{ input: { } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconPackage size={13} color={dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ }}>Release / Fix Version</Text>
 </Group>
 <MultiSelect
 data={releaseOptions}
 value={selectedReleases}
 onChange={setSelectedReleases}
 placeholder="All releases"
 size="xs"
 clearable
 searchable
 maxDropdownHeight={200}
 styles={{ input: { } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconLayoutBoard size={13} color={dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ }}>Jira Board</Text>
 </Group>
 <MultiSelect
 data={boardOptions}
 value={selectedBoards}
 onChange={setSelectedBoards}
 placeholder="All boards"
 size="xs"
 clearable
 searchable
 maxDropdownHeight={200}
 styles={{ input: { } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconRocket size={13} color={dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ }}>Sprint</Text>
 </Group>
 <MultiSelect
 data={sprintOptions}
 value={selectedSprints}
 onChange={setSelectedSprints}
 placeholder="All sprints"
 size="xs"
 clearable
 searchable
 maxDropdownHeight={200}
 styles={{ input: { } }}
 />
 </div>
 </SimpleGrid>
 </Paper>
 </Collapse>

 {/* ── Active filter chips ── */}
 <ActiveFilters
 filters={[
 { key: 'pod', label: 'POD', values: selectedPods.map(id => podLabels[id] || id) },
 { key: 'type', label: 'Type', values: selectedTypes },
 { key: 'release', label: 'Release', values: selectedReleases },
 { key: 'board', label: 'Board', values: selectedBoards },
 { key: 'sprint', label: 'Sprint', values: selectedSprints },
 ]}
 onClear={clearFilter}
 onClearAll={clearAllFilters}
 />
 </Stack>
 }
 >
 {/* ── Row 1: KPI Cards — 3 per row, 2 rows ──────────────────── */}
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.0s both' }}>
 <KpiCard label="Open Issues" value={k.totalOpen}
 icon={<IconAlertTriangle size={22} />} color={COLOR_WARNING}
 subtitle={`${data.statusCategoryBreakdown?.['In Progress'] ?? 0} in progress`}
 onClick={() => openDrill('Open Issues Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.05s both' }}>
 <KpiCard label="Bug Ratio" value={`${k.bugRatio}%`}
 icon={<IconBug size={22} />} color={COLOR_ERROR_DARK}
 subtitle={`${k.bugCount} bugs of ${k.totalCreated} created`}
 onClick={() => openDrill('Bug Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.1s both' }}>
 <KpiCard label="Avg Cycle Time" value={k.avgCycleTimeDays} unit="days"
 icon={<IconClock size={22} />} color={COLOR_VIOLET}
 subtitle="Mean time from created to resolved"
 onClick={() => openDrill('Cycle Time Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.15s both' }}>
 <KpiCard label="Throughput" value={k.throughputPerWeek} unit="/ week"
 icon={<IconRocket size={22} />} color={AQUA}
 subtitle="Average resolved issues per week"
 onClick={() => openDrill('Throughput Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.2s both' }}>
 <KpiCard label="Story Points Resolved" value={k.totalSPResolved}
 icon={<IconFlame size={22} />} color={COLOR_BLUE_STRONG}
 subtitle="Total SP across resolved issues"
 onClick={() => openDrill('Story Points Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.25s both' }}>
 <KpiCard label="Hours Logged" value={k.totalHoursLogged} unit="hrs"
 icon={<IconUsers size={22} />} color={COLOR_EMERALD}
 subtitle={`${(data.byWorklogAuthor ?? []).length} contributors`}
 onClick={() => openDrill('Hours Breakdown')} />
 </div>
 </SimpleGrid>

 {/* ── Row 2: Created vs Resolved Trend ───────────────────────── */}
 <div style={{ animation: 'ja-slide 0.35s ease-out 0.1s both' }}>
 <ChartCard title="Created vs Resolved — Weekly Trend" minHeight={300}>
 <div role="img" aria-label="Area chart">
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={data.createdVsResolved} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <defs>
 <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={COLOR_ERROR} stopOpacity={0.2} />
 <stop offset="95%" stopColor={COLOR_ERROR} stopOpacity={0} />
 </linearGradient>
 <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={AQUA_HEX} stopOpacity={0.3} />
 <stop offset="95%" stopColor={AQUA_HEX} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{fontSize: 12 }} />
 <Area animationDuration={600} type="monotone" dataKey="created" name="Created" stroke={COLOR_ERROR}
 strokeWidth={2} fill="url(#createdGrad)" dot={{ r: 3, fill: COLOR_ERROR }} />
 <Area animationDuration={600} type="monotone" dataKey="resolved" name="Resolved" stroke={AQUA_HEX}
 strokeWidth={2} fill="url(#resolvedGrad)" dot={{ r: 3, fill: AQUA }} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </div>

 {/* ── Row 2b: Sprint Comparison ────────────────────────────────── */}
 {data.bySprint && data.bySprint.length > 0 && (
 <div style={{ animation: 'ja-slide 0.35s ease-out 0.15s both' }}>
 <ChartCard title="Sprint Comparison — Planned vs Completed Story Points (Last 6 Sprints)" minHeight={300}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={data.bySprint.slice(-6).map(s => ({
 name: s.name,
 Planned: s.sp ?? 0,
 Completed: s.count ?? 0
 }))} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="name" tick={{ fontSize: 10, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} angle={-45} textAnchor="end" height={60} />
 <YAxis tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{fontSize: 12 }} />
 <Bar animationDuration={600} dataKey="Planned" fill={COLOR_BLUE} radius={[4, 4, 0, 0]} />
 <Bar animationDuration={600} dataKey="Completed" fill={COLOR_EMERALD} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </div>
 )}

 {/* ── Row 3: Distribution donuts (clickable slices) ──────────── */}
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
 <DonutChart data={data.byType} title="By Issue Type"
 highlightNames={selectedTypes.length > 0 ? selectedTypes : undefined}
 onSliceClick={(name) => setSelectedTypes(prev =>
 prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
 )} dark={dark} />
 <DonutChart data={data.byStatus} title="By Status"
 colorMap={STATUS_CATEGORY_COLORS}
 onSliceClick={() => openDrill('Issues by Status')} dark={dark} />
 <DonutChart data={data.byPriority} title="By Priority"
 colorMap={PRIORITY_COLORS}
 onSliceClick={() => openDrill('Issues by Priority')} dark={dark} />
 <DonutChart data={data.byPod} title="By POD / Team"
 onSliceClick={(name) => {
 const pod = podOptions.find(p => p.label === name);
 if (pod) setSelectedPods(prev =>
 prev.includes(pod.value) ? prev.filter(p => p !== pod.value) : [...prev, pod.value]
 );
 }} dark={dark} />
 </SimpleGrid>

 {/* ── Row 4: Workload + Cycle Time ───────────────────────────── */}
 <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
 <ChartCard title="Workload — Open Issues by Assignee" minHeight={Math.max(250, data.workload.length * 32 + 40)}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={Math.max(250, data.workload.length * 32 + 40)}>
 <BarChart data={data.workload.slice(0, 15)} layout="vertical"
 margin={{ top: 4, right: 30, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}} />
 <YAxis type="category" dataKey="assignee" width={95}
 tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{fontSize: 11 }} />
 <Bar animationDuration={600} dataKey="total" name="Total" fill={AQUA_HEX} radius={[0, 4, 4, 0]} stackId="a" />
 <Bar animationDuration={600} dataKey="bugs" name="Bugs" fill={COLOR_ERROR} radius={[0, 4, 4, 0]} stackId="b" />
 <Bar animationDuration={600} dataKey="highPriority" name="High Priority" fill={COLOR_WARNING} radius={[0, 4, 4, 0]} stackId="c" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>

 <ChartCard title="Cycle Time Distribution — Resolved Issues" minHeight={250}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={data.cycleTime} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={COLOR_VIOLET} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </SimpleGrid>

 {/* ── Row 5: Aging + Bug Trend ───────────────────────────────── */}
 <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
 <ChartCard title="Issue Aging — Open Issues by Age" minHeight={250}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={data.aging} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={COLOR_WARNING} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>

 <ChartCard title="Bug Trend — Monthly Created Bugs vs Total" minHeight={250}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={data.bugTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{fontSize: 12 }} />
 <Bar animationDuration={600} dataKey="total" name="Total Created" fill={DEEP_BLUE_TINTS[30]} radius={[4, 4, 0, 0]} />
 <Bar animationDuration={600} dataKey="bugs" name="Bugs" fill={COLOR_ERROR} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </SimpleGrid>

 {/* ── Row 6: Labels, Components, Fix Versions (clickable) ────── */}
 <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
 {data.byLabel.length > 0 && (
 <HorizontalBarChart data={data.byLabel} title="Top Labels"
 dataKey="count" barColor={COLOR_VIOLET} maxItems={10}
 onBarClick={() => openDrill('Issues by Label')} dark={dark} />
 )}
 {data.byComponent.length > 0 && (
 <HorizontalBarChart data={data.byComponent} title="Top Components"
 dataKey="count" barColor={COLOR_EMERALD} maxItems={10}
 onBarClick={() => openDrill('Issues by Component')} dark={dark} />
 )}
 {filteredData.byFixVersion.length > 0 && (
 <HorizontalBarChart data={filteredData.byFixVersion} title="Top Fix Versions"
 dataKey="count" barColor={DEEP_BLUE} maxItems={10}
 onBarClick={(name) => setSelectedReleases(prev =>
 prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]
 )} dark={dark} />
 )}
 </SimpleGrid>

 {/* ── Row 7: Assignee Leaderboard ────────────────────────────── */}
 {data.byAssignee.length > 0 && (
 <ChartCard title="Assignee Leaderboard — Issues, Story Points & Hours"
 minHeight={Math.max(250, Math.min(data.byAssignee.length, 15) * 32 + 40)}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%"
 height={Math.max(250, Math.min(data.byAssignee.length, 15) * 32 + 40)}>
 <BarChart data={data.byAssignee.slice(0, 15)} layout="vertical"
 margin={{ top: 4, right: 30, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? DEEP_BLUE_TINTS[30] : DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}} />
 <YAxis type="category" dataKey="name" width={95}
 tick={{ fontSize: 11, fill: dark ? DEEP_BLUE_TINTS[40] : DEEP_BLUE_TINTS[60]}} />
 <RTooltip contentStyle={{fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{fontSize: 11 }} />
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={AQUA_HEX} radius={[0, 4, 4, 0]} />
 <Bar animationDuration={600} dataKey="sp" name="Story Points" fill={COLOR_VIOLET} radius={[0, 4, 4, 0]} />
 <Bar animationDuration={600} dataKey="hours" name="Hours" fill={COLOR_WARNING} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 )}
 </ReportPageShell>

 {/* ── Drill-down drawer ── */}
 <DrillDrawer
 opened={drillOpen}
 onClose={() => setDrillOpen(false)}
 title={drillTitle}
 breakdowns={drillBreakdowns}
 />
 </>
 );
}
