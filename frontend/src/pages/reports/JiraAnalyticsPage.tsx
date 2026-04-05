import { useState, useMemo, useCallback } from 'react';
import {
 Text, Badge, Group, SegmentedControl, SimpleGrid, Paper, ThemeIcon,
 MultiSelect, Button, Stack, Tooltip, ActionIcon,
 Drawer, Table, ScrollArea, Collapse,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
 IconRefresh, IconBug, IconClock, IconRocket, IconUsers,
 IconTrendingUp, IconCircleCheck, IconAlertTriangle, IconFlame,
 IconPackage, IconCloudDownload, IconFilter,
 IconX, IconArrowRight, IconCategory, IconLayoutBoard,
} from '@tabler/icons-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 ResponsiveContainer, Legend, PieChart, Pie, Cell,
 AreaChart, Area,
} from 'recharts';
import {
 useJiraAnalytics, useJiraAnalyticsFilters, useJiraSyncStatus, useTriggerJiraSync,
 type JiraAnalyticsData, type AnalyticsBreakdown,
} from '../../api/jira';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import ReportPageShell from '../../components/common/ReportPageShell';
import { EmptyState } from '../../components/ui';
import {
 DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, DEEP_BLUE_TINTS, AQUA_TINTS,
} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

/* ── Palette ──────────────────────────────────────────────────────────── */
const PIE_COLORS = [
 AQUA, '#7C3AED', DEEP_BLUE, '#DB2777', '#D97706',
 '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D',
 '#6366F1', '#F59E0B', '#EC4899', '#14B8A6',
];

const PRIORITY_COLORS: Record<string, string> = {
 Highest: '#DC2626', Critical: '#DC2626', Blocker: '#DC2626',
 High: '#F59E0B', Medium: '#3B82F6', Low: '#22C55E', Lowest: '#94A3B8',
};

const STATUS_CATEGORY_COLORS: Record<string, string> = {
 'To Do': '#94A3B8', 'In Progress': '#F59E0B', Done: '#22C55E',
 'In Review': '#7C3AED', Backlog: '#CBD5E1',
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
 borderLeft: `4px solid ${color}`,
 }}
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
 style={{ fontFamily: FONT_FAMILY, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
 {label}
 </Text>
 <Group gap={6} align="baseline" wrap="nowrap">
 <Text fw={800}
 style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE, lineHeight: 1.1, fontSize: '1.75rem' }}>
 {value}
 </Text>
 {unit && <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{unit}</Text>}
 </Group>
 {subtitle && <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>{subtitle}</Text>}
 </div>
 {onClick && (
 <Tooltip label="Click to drill down" withArrow>
 <IconArrowRight size={16} color={DEEP_BLUE_TINTS[30]} style={{ flexShrink: 0 }} />
 </Tooltip>
 )}
 </Group>
 </Paper>
 );
}

/* ── Interactive Donut chart ──────────────────────────────────────────── */
function DonutChart({ data, title, colorMap, onSliceClick, highlightNames }: {
 data: AnalyticsBreakdown[]; title: string;
 colorMap?: Record<string, string>;
 onSliceClick?: (name: string) => void;
 highlightNames?: string[];
}) {
 const chartData = data.slice(0, 10);
 const total = chartData.reduce((s, d) => s + d.count, 0);

 return (
 <ChartCard title={title} minHeight={280}>
 <ResponsiveContainer width="100%" height={260}>
 <PieChart>
 <Pie
 data={chartData}
 cx="50%" cy="50%"
 innerRadius={55} outerRadius={90}
 dataKey="count"
 nameKey="name"
 paddingAngle={2}
 style={{ fontFamily: FONT_FAMILY, fontSize: 10, cursor: onSliceClick ? 'pointer' : 'default' }}
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
 stroke="white"
 strokeWidth={2}
 opacity={isHighlighted ? 1 : 0.3}
 />
 );
 })}
 </Pie>
 <RTooltip
 contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }}
 formatter={(value: number, name: string) => [
 `${value} (${total > 0 ? Math.round(value * 100 / total) : 0}%)`, name,
 ]}
 />
 </PieChart>
 </ResponsiveContainer>
 </ChartCard>
 );
}

/* ── Horizontal bar chart ─────────────────────────────────────────────── */
function HorizontalBarChart({ data, title, dataKey, barColor, maxItems = 15, onBarClick }: {
 data: AnalyticsBreakdown[];
 title: string; dataKey: string; barColor?: string; maxItems?: number;
 onBarClick?: (name: string) => void;
}) {
 const sliced = data.slice(0, maxItems);
 const height = Math.max(200, sliced.length * 32 + 40);

 return (
 <ChartCard title={title} minHeight={height}>
 <ResponsiveContainer width="100%" height={height}>
 <BarChart data={sliced} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 120 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis
 type="category" dataKey="name" width={110}
 tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Bar
 dataKey={dataKey}
 fill={barColor ?? AQUA}
 radius={[0, 4, 4, 0]}
 cursor={onBarClick ? 'pointer' : 'default'}
 onClick={(d: { name: string }) => { if (onBarClick && d?.name) onBarClick(d.name); }}
 />
 </BarChart>
 </ResponsiveContainer>
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
 styles={{ title: { fontFamily: FONT_FAMILY, fontWeight: 700, color: dark ? '#fff' : DEEP_BLUE } }}>
 <Stack gap="sm">
 {/* Summary row */}
 <Group gap="lg">
 <Paper withBorder p="xs" radius="sm" style={{ borderLeft: `3px solid ${AQUA}` }}>
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Total Issues</Text>
 <Text fw={700} size="lg" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>{totalCount}</Text>
 </Paper>
 {hasSp && (
 <Paper withBorder p="xs" radius="sm" style={{ borderLeft: '3px solid #7C3AED' }}>
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Story Points</Text>
 <Text fw={700} size="lg" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>{totalSp}</Text>
 </Paper>
 )}
 {hasHours && (
 <Paper withBorder p="xs" radius="sm" style={{ borderLeft: '3px solid #059669' }}>
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Hours</Text>
 <Text fw={700} size="lg" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>{totalHrs.toFixed(1)}</Text>
 </Paper>
 )}
 </Group>

 {/* Tab selector */}
 <SegmentedControl
 size="xs"
 value={tab}
 onChange={(v) => setTab(v as DrillTab)}
 data={tabs.filter(t => (breakdowns[t.key]?.length ?? 0) > 0).map(t => ({ value: t.key, label: t.label }))}
 styles={{ root: { fontFamily: FONT_FAMILY } }}
 />

 <ScrollArea h="calc(100vh - 220px)">
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ fontFamily: FONT_FAMILY }}>Name</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>Issues</Table.Th>
 <Table.Th style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>%</Table.Th>
 {hasSp && <Table.Th style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>SP</Table.Th>}
 {hasHours && <Table.Th style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>Hours</Table.Th>}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sorted.map((row, i) => (
 <Table.Tr key={i}>
 <Table.Td style={{ fontFamily: FONT_FAMILY, fontWeight: 500 }}>{row.name}</Table.Td>
 <Table.Td style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>{row.count}</Table.Td>
 <Table.Td style={{ fontFamily: FONT_FAMILY, textAlign: 'right', color: DEEP_BLUE_TINTS[50] }}>
 {totalCount > 0 ? `${Math.round(row.count * 100 / totalCount)}%` : '–'}
 </Table.Td>
 {hasSp && (
 <Table.Td style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>{row.sp ?? '–'}</Table.Td>
 )}
 {hasHours && (
 <Table.Td style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>
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
 <Text size="xs" c="dimmed" fw={600} style={{ fontFamily: FONT_FAMILY }}>Active:</Text>
 {filters.flatMap(f =>
 f.values.map(v => (
 <Badge key={`${f.key}-${v}`} size="sm" variant="light" color="blue" radius="sm"
 rightSection={
 <ActionIcon size={14} variant="transparent" color="blue"
 onClick={() => onClear(f.key, v)}>
 <IconX size={10} />
 </ActionIcon>
 }
 styles={{ root: { fontFamily: FONT_FAMILY, cursor: 'default', paddingRight: 4 } }}>
 {f.label}: {v}
 </Badge>
 ))
 )}
 <Button variant="subtle" size="compact-xs" color="red" onClick={onClearAll}
 style={{ fontFamily: FONT_FAMILY }}>
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

 const activeFilterCount = selectedPods.length + selectedTypes.length
 + selectedReleases.length + selectedBoards.length;

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
 }, []);

 const clearAllFilters = useCallback(() => {
 setSelectedPods([]);
 setSelectedTypes([]);
 setSelectedReleases([]);
 setSelectedBoards([]);
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
 byPod: data.byPod,
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
 onAction={() => triggerSync.mutate(true)}
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
 <Text size="xs" c="dimmed" mb={4} style={{ fontFamily: FONT_FAMILY }}>Lookback</Text>
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
 styles={{ root: { fontFamily: FONT_FAMILY } }}
 />
 </div>

 <Tooltip label={`Covering ${data.projectKeys.length} Jira projects across ${data.podNames.length} PODs`}>
 <Badge size="lg" variant="light" color="blue" radius="sm"
 styles={{ root: { fontFamily: FONT_FAMILY, cursor: 'help' } }}>
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
 style={{ fontFamily: FONT_FAMILY }}>
 Filters
 </Button>

 <Button variant="light" size="sm"
 leftSection={<IconRefresh size={15} />}
 loading={isFetching}
 onClick={() => refetch()}
 style={{ fontFamily: FONT_FAMILY }}>
 Refresh
 </Button>
 <Tooltip label={syncStatus?.syncing ? 'Sync in progress…' : 'Sync Jira data to local DB'}>
 <Button variant="light" size="sm" color="teal"
 leftSection={<IconCloudDownload size={15} />}
 loading={syncStatus?.syncing || triggerSync.isPending}
 onClick={() => triggerSync.mutate(false)}
 style={{ fontFamily: FONT_FAMILY }}>
 {syncStatus?.syncing ? 'Syncing…' : 'Sync'}
 </Button>
 </Tooltip>
 {data?.lastSyncAt && (
 <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', fontFamily: FONT_FAMILY }}>
 Last synced: {data.lastSyncAt}
 </Text>
 )}
 </Group>

 {/* ── Expanded filters panel ── */}
 <Collapse in={filtersOpen}>
 <Paper withBorder p="sm" radius="md"
 style={{ background: DEEP_BLUE_TINTS[10] + '44', borderColor: DEEP_BLUE_TINTS[10] }}>
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
 <div>
 <Group gap={6} mb={4}>
 <IconUsers size={13} color={DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>POD / Team</Text>
 </Group>
 <MultiSelect
 data={podOptions}
 value={selectedPods}
 onChange={setSelectedPods}
 placeholder="All PODs"
 size="xs"
 clearable
 maxDropdownHeight={200}
 styles={{ input: { fontFamily: FONT_FAMILY } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconCategory size={13} color={DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Issue Type</Text>
 </Group>
 <MultiSelect
 data={typeOptions}
 value={selectedTypes}
 onChange={setSelectedTypes}
 placeholder="All types"
 size="xs"
 clearable
 maxDropdownHeight={200}
 styles={{ input: { fontFamily: FONT_FAMILY } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconPackage size={13} color={DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Release / Fix Version</Text>
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
 styles={{ input: { fontFamily: FONT_FAMILY } }}
 />
 </div>
 <div>
 <Group gap={6} mb={4}>
 <IconLayoutBoard size={13} color={DEEP_BLUE_TINTS[60]} />
 <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Jira Board</Text>
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
 styles={{ input: { fontFamily: FONT_FAMILY } }}
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
 icon={<IconAlertTriangle size={22} />} color="#F59E0B"
 subtitle={`${data.statusCategoryBreakdown?.['In Progress'] ?? 0} in progress`}
 onClick={() => openDrill('Open Issues Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.05s both' }}>
 <KpiCard label="Bug Ratio" value={`${k.bugRatio}%`}
 icon={<IconBug size={22} />} color="#DC2626"
 subtitle={`${k.bugCount} bugs of ${k.totalCreated} created`}
 onClick={() => openDrill('Bug Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.1s both' }}>
 <KpiCard label="Avg Cycle Time" value={k.avgCycleTimeDays} unit="days"
 icon={<IconClock size={22} />} color="#7C3AED"
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
 icon={<IconFlame size={22} />} color="#2563EB"
 subtitle="Total SP across resolved issues"
 onClick={() => openDrill('Story Points Breakdown')} />
 </div>
 <div style={{ animation: 'ja-pop 0.3s ease-out 0.25s both' }}>
 <KpiCard label="Hours Logged" value={k.totalHoursLogged} unit="hrs"
 icon={<IconUsers size={22} />} color="#059669"
 subtitle={`${(data.byWorklogAuthor ?? []).length} contributors`}
 onClick={() => openDrill('Hours Breakdown')} />
 </div>
 </SimpleGrid>

 {/* ── Row 2: Created vs Resolved Trend ───────────────────────── */}
 <div style={{ animation: 'ja-slide 0.35s ease-out 0.1s both' }}>
 <ChartCard title="Created vs Resolved — Weekly Trend" minHeight={300}>
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={data.createdVsResolved} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <defs>
 <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#fa5252" stopOpacity={0.2} />
 <stop offset="95%" stopColor="#fa5252" stopOpacity={0} />
 </linearGradient>
 <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={AQUA} stopOpacity={0.3} />
 <stop offset="95%" stopColor={AQUA} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Area type="monotone" dataKey="created" name="Created" stroke="#fa5252"
 strokeWidth={2} fill="url(#createdGrad)" dot={{ r: 3, fill: '#fa5252' }} />
 <Area type="monotone" dataKey="resolved" name="Resolved" stroke={AQUA}
 strokeWidth={2} fill="url(#resolvedGrad)" dot={{ r: 3, fill: AQUA }} />
 </AreaChart>
 </ResponsiveContainer>
 </ChartCard>
 </div>

 {/* ── Row 3: Distribution donuts (clickable slices) ──────────── */}
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
 <DonutChart data={data.byType} title="By Issue Type"
 highlightNames={selectedTypes.length > 0 ? selectedTypes : undefined}
 onSliceClick={(name) => setSelectedTypes(prev =>
 prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
 )} />
 <DonutChart data={data.byStatus} title="By Status"
 colorMap={STATUS_CATEGORY_COLORS}
 onSliceClick={() => openDrill('Issues by Status')} />
 <DonutChart data={data.byPriority} title="By Priority"
 colorMap={PRIORITY_COLORS}
 onSliceClick={() => openDrill('Issues by Priority')} />
 <DonutChart data={data.byPod} title="By POD / Team"
 onSliceClick={(name) => {
 const pod = podOptions.find(p => p.label === name);
 if (pod) setSelectedPods(prev =>
 prev.includes(pod.value) ? prev.filter(p => p !== pod.value) : [...prev, pod.value]
 );
 }} />
 </SimpleGrid>

 {/* ── Row 4: Workload + Cycle Time ───────────────────────────── */}
 <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
 <ChartCard title="Workload — Open Issues by Assignee" minHeight={Math.max(250, data.workload.length * 32 + 40)}>
 <ResponsiveContainer width="100%" height={Math.max(250, data.workload.length * 32 + 40)}>
 <BarChart data={data.workload.slice(0, 15)} layout="vertical"
 margin={{ top: 4, right: 30, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="assignee" width={95}
 tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
 <Bar dataKey="total" name="Total" fill={AQUA} radius={[0, 4, 4, 0]} stackId="a" />
 <Bar dataKey="bugs" name="Bugs" fill="#fa5252" radius={[0, 4, 4, 0]} stackId="b" />
 <Bar dataKey="highPriority" name="High Priority" fill="#F59E0B" radius={[0, 4, 4, 0]} stackId="c" />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>

 <ChartCard title="Cycle Time Distribution — Resolved Issues" minHeight={250}>
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={data.cycleTime} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Bar dataKey="count" name="Issues" fill="#7C3AED" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>
 </SimpleGrid>

 {/* ── Row 5: Aging + Bug Trend ───────────────────────────────── */}
 <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
 <ChartCard title="Issue Aging — Open Issues by Age" minHeight={250}>
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={data.aging} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Bar dataKey="count" name="Issues" fill="#F59E0B" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>

 <ChartCard title="Bug Trend — Monthly Created Bugs vs Total" minHeight={250}>
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={data.bugTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="month" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Bar dataKey="total" name="Total Created" fill={DEEP_BLUE_TINTS[30]} radius={[4, 4, 0, 0]} />
 <Bar dataKey="bugs" name="Bugs" fill="#fa5252" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>
 </SimpleGrid>

 {/* ── Row 6: Labels, Components, Fix Versions (clickable) ────── */}
 <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
 {data.byLabel.length > 0 && (
 <HorizontalBarChart data={data.byLabel} title="Top Labels"
 dataKey="count" barColor="#7C3AED" maxItems={10}
 onBarClick={() => openDrill('Issues by Label')} />
 )}
 {data.byComponent.length > 0 && (
 <HorizontalBarChart data={data.byComponent} title="Top Components"
 dataKey="count" barColor="#059669" maxItems={10}
 onBarClick={() => openDrill('Issues by Component')} />
 )}
 {filteredData.byFixVersion.length > 0 && (
 <HorizontalBarChart data={filteredData.byFixVersion} title="Top Fix Versions"
 dataKey="count" barColor={DEEP_BLUE} maxItems={10}
 onBarClick={(name) => setSelectedReleases(prev =>
 prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]
 )} />
 )}
 </SimpleGrid>

 {/* ── Row 7: Assignee Leaderboard ────────────────────────────── */}
 {data.byAssignee.length > 0 && (
 <ChartCard title="Assignee Leaderboard — Issues, Story Points & Hours"
 minHeight={Math.max(250, Math.min(data.byAssignee.length, 15) * 32 + 40)}>
 <ResponsiveContainer width="100%"
 height={Math.max(250, Math.min(data.byAssignee.length, 15) * 32 + 40)}>
 <BarChart data={data.byAssignee.slice(0, 15)} layout="vertical"
 margin={{ top: 4, right: 30, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={95}
 tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8, boxShadow: SHADOW.md }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
 <Bar dataKey="count" name="Issues" fill={AQUA} radius={[0, 4, 4, 0]} />
 <Bar dataKey="sp" name="Story Points" fill="#7C3AED" radius={[0, 4, 4, 0]} />
 <Bar dataKey="hours" name="Hours" fill="#F59E0B" radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
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
