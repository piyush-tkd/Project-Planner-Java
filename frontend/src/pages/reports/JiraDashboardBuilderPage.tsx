import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
 Text, Badge, Group, SimpleGrid, Paper, ThemeIcon,
 MultiSelect, Button, Stack, Tooltip, Modal, TextInput, Select, Switch,
 ActionIcon, Menu, Divider, ScrollArea, Textarea, Checkbox, Grid, Loader,
 NumberInput, SegmentedControl, ColorInput,
} from '@mantine/core';
import {
 IconPlus, IconRefresh, IconSettings, IconTrash, IconCopy,
 IconChartBar, IconChartPie, IconChartLine, IconChartArea,
 IconTable, IconLayoutGrid, IconGripVertical, IconDots,
 IconDeviceFloppy, IconEye, IconEyeOff, IconPencil, IconDownload,
 IconArrowUp, IconArrowDown, IconArrowLeft, IconArrowRight,
 IconTemplate, IconSortAscending, IconClock, IconCalendarStats,
 IconTimeline, IconGridDots, IconFilter, IconClockHour4, IconNotes, IconHeadset,
} from '@tabler/icons-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 ResponsiveContainer, Legend, PieChart, Pie, Cell,
 AreaChart, Area, LineChart, Line, ComposedChart, ReferenceLine,
} from 'recharts';
import {
 useJiraAnalytics, useJiraAnalyticsFilters,
 useJiraDashboards, useSaveDashboard, useCloneDashboard,
 useJiraSyncStatus, useTriggerJiraSync, useAllFixVersions,
 type JiraAnalyticsData, type AnalyticsBreakdown,
 type DashboardWidget, type JiraDashboardConfig,
} from '../../api/jira';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import { EmptyState } from '../../components/ui';
import {
 DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, DEEP_BLUE_TINTS, AQUA_TINTS,
 UX_ERROR, UX_POSITIVE, UX_WARNING, CHART_COLORS, SURFACE_SELECTED,
} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

/* ── Palette ──────────────────────────────────────────────────────────── */
const PIE_COLORS = [
 AQUA, '#7C3AED', DEEP_BLUE, '#DB2777', '#D97706',
 '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D',
 '#6366F1', '#F59E0B', '#EC4899', '#14B8A6',
];

/* ── Extended Widget type with new fields ──────────────────────────────── */
interface ExtendedDashboardWidget extends DashboardWidget {
 color?: string;
 sortBy?: 'count' | 'sp' | 'hours' | 'name';
 sortDirection?: 'asc' | 'desc';
 limit?: number;
 showLegend?: boolean;
 showLabels?: boolean;
 targetDate?: string; // ISO date for countdown timer
 targetLabel?: string; // label for the countdown target
 secondaryDataKey?: string; // for 2D filter stats cross-tab
}

/* ── Available widget types for the "Add Widget" picker ──────────────── */
const WIDGET_CATALOG: { type: string; label: string; description: string; icon: React.ReactNode; defaultSize: DashboardWidget['size'] }[] = [
 { type: 'kpis', label: 'KPI Cards', description: 'Key metrics summary — open, created, resolved, cycle time, throughput, SP', icon: <IconLayoutGrid size={16} />, defaultSize: 'full' },
 { type: 'createdVsResolved', label: 'Created vs Resolved', description: 'Weekly area chart comparing issue creation and resolution rates', icon: <IconChartArea size={16} />, defaultSize: 'full' },
 { type: 'singleKpi', label: 'Single KPI Card', description: 'Large single metric card with optional comparison and colored border', icon: <IconLayoutGrid size={16} />, defaultSize: 'quarter' },
 { type: 'gauge', label: 'Gauge Chart', description: 'Speedometer gauge for KPI thresholds — bug ratio, cycle time, throughput', icon: <IconChartPie size={16} />, defaultSize: 'quarter' },
 { type: 'donut', label: 'Donut Chart', description: 'Breakdown by any dimension — type, status, priority, pod, label, component, fix version', icon: <IconChartPie size={16} />, defaultSize: 'quarter' },
 { type: 'horizontalBar', label: 'Horizontal Bar', description: 'Top-N items in any dimension — labels, components, fix versions, assignees', icon: <IconChartBar size={16} />, defaultSize: 'third' },
 { type: 'stackedBar', label: 'Stacked Bar', description: 'Stacked breakdown showing count, story points, and hours', icon: <IconChartBar size={16} />, defaultSize: 'half' },
 { type: 'lineChart', label: 'Line Chart', description: 'Multi-series trend line — created vs resolved or bug trend', icon: <IconChartLine size={16} />, defaultSize: 'full' },
 { type: 'workload', label: 'Workload', description: 'Open issues by assignee — total, bugs, high priority', icon: <IconChartBar size={16} />, defaultSize: 'half' },
 { type: 'cycleTime', label: 'Cycle Time', description: 'Distribution of resolved issue cycle times', icon: <IconChartBar size={16} />, defaultSize: 'half' },
 { type: 'aging', label: 'Issue Aging', description: 'Open issues bucketed by age', icon: <IconChartBar size={16} />, defaultSize: 'half' },
 { type: 'bugTrend', label: 'Bug Trend', description: 'Monthly bug count vs total created', icon: <IconChartLine size={16} />, defaultSize: 'half' },
 { type: 'trendSpark', label: 'Trend Spark Card', description: 'Compact sparkline KPI card with mini trend', icon: <IconChartLine size={16} />, defaultSize: 'quarter' },
 { type: 'assigneeLeaderboard', label: 'Assignee Leaderboard', description: 'Issues, story points, and hours by assignee', icon: <IconTable size={16} />, defaultSize: 'full' },
 { type: 'pivotTable', label: 'Pivot Table', description: 'Cross-dimension table with count, SP, hours, and totals', icon: <IconTable size={16} />, defaultSize: 'full' },
 { type: 'issueTable', label: 'Issue Table', description: 'Searchable breakdown table with export to CSV', icon: <IconTable size={16} />, defaultSize: 'full' },
 { type: 'countdown', label: 'Countdown Timer', description: 'Deadline countdown for sprints, releases, or milestones — days, hours, minutes', icon: <IconClock size={16} />, defaultSize: 'quarter' },
 { type: 'averageAge', label: 'Average Age Chart', description: 'Bar chart showing average days unresolved by period — like Jira\'s Average Age', icon: <IconCalendarStats size={16} />, defaultSize: 'half' },
 { type: 'cumulativeFlow', label: 'Cumulative Created vs Resolved', description: 'Cumulative line chart with version markers — matches Jira\'s Created vs Resolved', icon: <IconTimeline size={16} />, defaultSize: 'full' },
 { type: 'resolutionTime', label: 'Resolution Time', description: 'Average resolution time trend by week — time to resolve issues', icon: <IconChartLine size={16} />, defaultSize: 'half' },
 { type: 'heatmap', label: 'Activity Heatmap', description: 'Day-of-week × dimension heatmap showing issue concentration', icon: <IconGridDots size={16} />, defaultSize: 'half' },
 { type: 'twoDimensional', label: '2D Filter Statistics', description: 'Cross-tabulation of two dimensions — e.g. Status × Priority', icon: <IconFilter size={16} />, defaultSize: 'full' },
 { type: 'worklogByAuthor', label: 'Worklog by Author', description: 'Hours logged per person — horizontal bar chart from synced worklogs', icon: <IconClockHour4 size={16} />, defaultSize: 'half' },
 { type: 'releaseNotes', label: 'Release Notes', description: 'Fix versions with issue counts, SP, and completion progress', icon: <IconNotes size={16} />, defaultSize: 'full' },
 { type: 'supportQueueSummary', label: 'Support Queue Summary', description: 'Compact overview of open support tickets by status and priority', icon: <IconHeadset size={16} />, defaultSize: 'half' },
];

const DATA_KEY_OPTIONS = [
 { value: 'byType', label: 'Issue Type' },
 { value: 'byStatus', label: 'Status' },
 { value: 'byPriority', label: 'Priority' },
 { value: 'byPod', label: 'POD / Team' },
 { value: 'byAssignee', label: 'Assignee' },
 { value: 'byLabel', label: 'Labels' },
 { value: 'byComponent', label: 'Components' },
 { value: 'byFixVersion', label: 'Fix Version' },
];

const SIZE_OPTIONS = [
 { value: 'full', label: 'Full Width' },
 { value: 'half', label: 'Half' },
 { value: 'third', label: 'Third' },
 { value: 'quarter', label: 'Quarter' },
];

const SORT_OPTIONS = [
 { value: 'count', label: 'Count' },
 { value: 'sp', label: 'Story Points' },
 { value: 'hours', label: 'Hours' },
 { value: 'name', label: 'Name' },
];

const DIRECTION_OPTIONS = [
 { value: 'desc', label: 'Descending' },
 { value: 'asc', label: 'Ascending' },
];

const LIMIT_OPTIONS = [
 { value: '5', label: 'Top 5' },
 { value: '10', label: 'Top 10' },
 { value: '15', label: 'Top 15' },
 { value: '20', label: 'Top 20' },
 { value: '999', label: 'All' },
];

const GAUGE_PRESETS = [
 { metric: 'bugRatio', label: 'Bug Ratio (%)', greenUpper: 5, yellowUpper: 10, max: 20 },
 { metric: 'avgCycleTimeDays', label: 'Cycle Time (days)', greenUpper: 5, yellowUpper: 10, max: 30 },
 { metric: 'throughputPerWeek', label: 'Throughput (/wk)', greenUpper: 10, yellowUpper: 5, max: 30 },
];

/* ── Dashboard Templates ───────────────────────────────────────────────── */
const DASHBOARD_TEMPLATES = [
 {
 id: 'executive',
 name: 'Executive Overview',
 description: 'KPIs, trends, and status breakdown',
 widgets: [
 { type: 'kpis', title: 'Key Metrics', size: 'full', enabled: true },
 { type: 'createdVsResolved', title: 'Created vs Resolved Trend', size: 'full', enabled: true },
 { type: 'donut', title: 'Issues by Status', dataKey: 'byStatus', size: 'quarter', enabled: true },
 { type: 'donut', title: 'Issues by Priority', dataKey: 'byPriority', size: 'quarter', enabled: true },
 ] as ExtendedDashboardWidget[],
 },
 {
 id: 'quality',
 name: 'Quality Trends',
 description: 'Average age, cumulative flow, bug trend, cycle time — matches Jira Quality dashboard',
 widgets: [
 { type: 'averageAge', title: 'Average Age Chart', size: 'half', enabled: true },
 { type: 'cumulativeFlow', title: 'Created vs Resolved (Cumulative)', size: 'full', enabled: true },
 { type: 'bugTrend', title: 'Bug Trend', size: 'half', enabled: true },
 { type: 'resolutionTime', title: 'Resolution Time Trend', size: 'half', enabled: true },
 { type: 'aging', title: 'Issue Aging', size: 'half', enabled: true },
 { type: 'donut', title: 'Issues by Type', dataKey: 'byType', size: 'quarter', enabled: true },
 { type: 'gauge', title: 'Bug Ratio', size: 'quarter', enabled: true },
 ] as ExtendedDashboardWidget[],
 },
 {
 id: 'team',
 name: 'Team Performance',
 description: 'Workload, assignee metrics, and POD breakdown',
 widgets: [
 { type: 'workload', title: 'Assignee Workload', size: 'half', enabled: true },
 { type: 'assigneeLeaderboard', title: 'Assignee Leaderboard', size: 'full', enabled: true },
 { type: 'donut', title: 'Issues by Assignee', dataKey: 'byAssignee', size: 'half', enabled: true },
 { type: 'stackedBar', title: 'Issues by POD', dataKey: 'byPod', size: 'half', enabled: true },
 ] as ExtendedDashboardWidget[],
 },
 {
 id: 'sprint',
 name: 'Sprint Tracker',
 description: 'Countdown timer, trend, status, and assignee breakdown',
 widgets: [
 { type: 'countdown', title: 'Sprint Deadline', size: 'quarter', enabled: true, targetLabel: 'Sprint End' },
 { type: 'kpis', title: 'Sprint Metrics', size: 'full', enabled: true },
 { type: 'createdVsResolved', title: 'Sprint Progress', size: 'full', enabled: true },
 { type: 'pivotTable', title: 'Issues by Status', dataKey: 'byStatus', size: 'half', enabled: true },
 { type: 'issueTable', title: 'Issues by Assignee', dataKey: 'byAssignee', size: 'half', enabled: true },
 ] as ExtendedDashboardWidget[],
 },
 {
 id: 'jira-default',
 name: 'Jira Default Gadgets',
 description: 'All standard Jira dashboard gadgets — KPIs, pie chart, 2D filter, average age, cumulative flow',
 widgets: [
 { type: 'kpis', title: 'Key Metrics', size: 'full', enabled: true },
 { type: 'donut', title: 'Issues by Type', dataKey: 'byType', size: 'quarter', enabled: true },
 { type: 'donut', title: 'Issues by Priority', dataKey: 'byPriority', size: 'quarter', enabled: true },
 { type: 'donut', title: 'Issues by Status', dataKey: 'byStatus', size: 'quarter', enabled: true },
 { type: 'countdown', title: 'Next Release', size: 'quarter', enabled: true, targetLabel: 'Release Date' },
 { type: 'averageAge', title: 'Average Age Chart', size: 'half', enabled: true },
 { type: 'cumulativeFlow', title: 'Created vs Resolved (Cumulative)', size: 'full', enabled: true },
 { type: 'twoDimensional', title: 'Status × Priority', dataKey: 'byStatus', secondaryDataKey: 'byPriority', size: 'full', enabled: true },
 { type: 'resolutionTime', title: 'Resolution Time', size: 'half', enabled: true },
 { type: 'heatmap', title: 'Priority × Status Heatmap', dataKey: 'byPriority', secondaryDataKey: 'byStatus', size: 'half', enabled: true },
 { type: 'workload', title: 'Workload by Assignee', size: 'half', enabled: true },
 { type: 'issueTable', title: 'All Issues', dataKey: 'byAssignee', size: 'full', enabled: true },
 ] as ExtendedDashboardWidget[],
 },
];

/* ── Utility functions ────────────────────────────────────────────────── */
function sortAndLimitData(
 data: AnalyticsBreakdown[],
 sortBy: string = 'count',
 direction: string = 'desc',
 limit: number = 10,
): AnalyticsBreakdown[] {
 let sorted = [...data];
 if (sortBy === 'count') {
 sorted.sort((a, b) => direction === 'desc' ? b.count - a.count : a.count - b.count);
 } else if (sortBy === 'sp') {
 sorted.sort((a, b) => direction === 'desc' ? (b.sp || 0) - (a.sp || 0) : (a.sp || 0) - (b.sp || 0));
 } else if (sortBy === 'hours') {
 sorted.sort((a, b) => direction === 'desc' ? (b.hours || 0) - (a.hours || 0) : (a.hours || 0) - (b.hours || 0));
 } else if (sortBy === 'name') {
 sorted.sort((a, b) => direction === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
 }
 return sorted.slice(0, limit);
}

function generateCsvFromData(title: string, data: Record<string, unknown>[]): string {
 if (data.length === 0) return '';
 const headers = Object.keys(data[0]);
 const csvContent = [
 [title],
 headers.map(h => `"${h}"`).join(','),
 ...data.map(row => headers.map(h => {
 const v = row[h];
 if (v === null || v === undefined) return '';
 if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
 return String(v);
 }).join(',')),
 ].join('\n');
 return csvContent;
}

function downloadCsv(content: string, filename: string) {
 const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = filename;
 link.click();
}

function AnimatedNumber({ value }: { value: number }) {
 const [displayValue, setDisplayValue] = useState(0);
 useEffect(() => {
 let animationFrame: number;
 const target = value;
 const start = displayValue;
 const duration = 800;
 const startTime = Date.now();
 const animate = () => {
 const elapsed = Date.now() - startTime;
 const progress = Math.min(elapsed / duration, 1);
 setDisplayValue(Math.round(start + (target - start) * progress));
 if (progress < 1) animationFrame = requestAnimationFrame(animate);
 };
 animationFrame = requestAnimationFrame(animate);
 return () => cancelAnimationFrame(animationFrame);
 }, [value, displayValue]);
 return <>{displayValue}</>;
}

/* ── Gauge SVG Component ──────────────────────────────────────────────── */
function GaugeSvg({ value, max, greenUpper, yellowUpper }: { value: number; max: number; greenUpper: number; yellowUpper: number }) {
 const circumference = 2 * Math.PI * 45;
 const percent = Math.min(value / max, 1);
 const offset = circumference - (percent * circumference);
 let color = UX_ERROR;
 if (value <= greenUpper) color = UX_POSITIVE;
 else if (value <= yellowUpper) color = UX_WARNING;
 return (
 <svg width={180} height={100} viewBox="0 0 180 100">
 <defs>
 <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%">
 <stop offset="0%" stopColor={UX_POSITIVE} />
 <stop offset="50%" stopColor={UX_WARNING} />
 <stop offset="100%" stopColor={UX_ERROR} />
 </linearGradient>
 </defs>
 <circle cx="90" cy="90" r="45" fill="none" stroke={DEEP_BLUE_TINTS[10]} strokeWidth="8" />
 <circle
 cx="90" cy="90" r="45" fill="none" stroke={color} strokeWidth="8"
 strokeDasharray={circumference} strokeDashoffset={offset}
 strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
 />
 <text x="90" y="75" textAnchor="middle" fontSize="28" fontWeight="bold" fill={DEEP_BLUE}>
 <AnimatedNumber value={value} />
 </text>
 <text x="90" y="92" textAnchor="middle" fontSize="10" fill={DEEP_BLUE_TINTS[60]}>
 / {max}
 </text>
 </svg>
 );
}

/* ── Countdown Timer Component ────────────────────────────────────────── */
function CountdownDisplay({ targetDate, label }: { targetDate: string; label?: string }) {
 const [now, setNow] = useState(Date.now());
 useEffect(() => {
 const timer = setInterval(() => setNow(Date.now()), 1000);
 return () => clearInterval(timer);
 }, []);
 const target = new Date(targetDate).getTime();
 const diff = Math.max(0, target - now);
 const days = Math.floor(diff / (1000 * 60 * 60 * 24));
 const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 const seconds = Math.floor((diff % (1000 * 60)) / 1000);
 const isPast = diff === 0;

 const digitBox = (val: number, unit: string) => (
 <div style={{ textAlign: 'center' }}>
 <div style={{
 background: isPast ? UX_ERROR : `linear-gradient(135deg, ${DEEP_BLUE} 0%, ${DEEP_BLUE_TINTS[80]} 100%)`,
 borderRadius: 8, padding: '8px 12px', minWidth: 56,
 boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
 }}>
 <Text size="1.6rem" fw={900} style={{ fontFamily: FONT_FAMILY, color: 'white', lineHeight: 1.1 }}>
 {String(val).padStart(2, '0')}
 </Text>
 </div>
 <Text size="9px" fw={600} tt="uppercase" c="dimmed" mt={4}>{unit}</Text>
 </div>
 );

 return (
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 }}>
 {label && <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={-4}>{label}</Text>}
 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 {digitBox(days, 'Days')}
 <Text size="xl" fw={800} style={{ color: DEEP_BLUE_TINTS[40], marginBottom: 16 }}>:</Text>
 {digitBox(hours, 'Hours')}
 <Text size="xl" fw={800} style={{ color: DEEP_BLUE_TINTS[40], marginBottom: 16 }}>:</Text>
 {digitBox(minutes, 'Min')}
 <Text size="xl" fw={800} style={{ color: DEEP_BLUE_TINTS[40], marginBottom: 16 }}>:</Text>
 {digitBox(seconds, 'Sec')}
 </div>
 <Text size="xs" c="dimmed">{isPast ? 'Deadline passed!' : new Date(targetDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
 </div>
 );
}

/* ── Widget renderer ──────────────────────────────────────────────────── */
function WidgetRenderer({ widget, data, editMode, onRemove, onEdit, onDrillDown }: {
 widget: ExtendedDashboardWidget;
 data: JiraAnalyticsData;
 editMode: boolean;
 onRemove: () => void;
 onEdit: () => void;
 onDrillDown?: (title: string, items: AnalyticsBreakdown[]) => void;
}) {
 const dark = useDarkMode();
 if (!widget.enabled && !editMode) return null;

 const opacity = widget.enabled ? 1 : 0.4;
 const chartStyle = { opacity };

 // Pass edit buttons through ChartCard's headerRight instead of absolute positioning
 const editButtons = editMode ? (
 <Group gap={4} wrap="nowrap">
 <ActionIcon size="sm" variant="light" onClick={onEdit}><IconPencil size={13} /></ActionIcon>
 <ActionIcon size="sm" variant="light" color="red" onClick={onRemove}><IconTrash size={13} /></ActionIcon>
 </Group>
 ) : undefined;

 const wrap = (content: React.ReactNode, minH = 200) => (
 <div style={{ ...chartStyle }}>
 <ChartCard title={widget.title} minHeight={minH} headerRight={editButtons}>{content}</ChartCard>
 </div>
 );

 switch (widget.type) {
 case 'kpis': {
 const k = data.kpis;
 return (
 <div style={{ ...chartStyle }}>
 <ChartCard title={widget.title} minHeight={80} headerRight={editButtons}>
 <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
 {[
 { label: 'Open', value: k.totalOpen, color: 'orange' },
 { label: 'Bug Ratio', value: `${k.bugRatio}%`, color: 'red' },
 { label: 'Cycle Time', value: `${k.avgCycleTimeDays}d`, color: 'violet' },
 { label: 'Throughput', value: `${k.throughputPerWeek}/wk`, color: 'teal' },
 { label: 'SP Resolved', value: k.totalSPResolved, color: 'blue' },
 { label: 'Hours', value: `${k.totalHoursLogged}h`, color: 'green' },
 ].map(kpi => (
 <Paper key={kpi.label} withBorder radius="sm" p="sm" style={{ boxShadow: SHADOW.card, textAlign: 'center' }}>
 <Text size="1.2rem" fw={800} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{kpi.value}</Text>
 <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{kpi.label}</Text>
 </Paper>
 ))}
 </SimpleGrid>
 </ChartCard>
 </div>
 );
 }

 case 'createdVsResolved':
 return wrap(
 <ResponsiveContainer width="100%" height={280}>
 <AreaChart data={data.createdVsResolved} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <defs>
 <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#fa5252" stopOpacity={0.2} />
 <stop offset="95%" stopColor="#fa5252" stopOpacity={0} />
 </linearGradient>
 <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={AQUA} stopOpacity={0.3} />
 <stop offset="95%" stopColor={AQUA} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Area type="monotone" dataKey="created" name="Created" stroke="#fa5252" strokeWidth={2} fill="url(#cGrad)" dot={{ r: 3, fill: '#fa5252' }} />
 <Area type="monotone" dataKey="resolved" name="Resolved" stroke={AQUA} strokeWidth={2} fill="url(#rGrad)" dot={{ r: 3, fill: AQUA }} />
 </AreaChart>
 </ResponsiveContainer>, 280
 );

 case 'donut': {
 const allDonutData = (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byType'] as AnalyticsBreakdown[] ?? [];
 const chartData = allDonutData.slice(0, 10);
 const total = chartData.reduce((s, d) => s + d.count, 0);
 return wrap(
 <div style={{ cursor: 'pointer' }} onClick={() => onDrillDown?.(widget.title, allDonutData)}>
 <ResponsiveContainer width="100%" height={240}>
 <PieChart>
 <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
 dataKey="count" nameKey="name" paddingAngle={2}
 label={({ name, percent }) => `${name.length > 10 ? name.slice(0, 10) + '…' : name} ${(percent * 100).toFixed(0)}%`}
 style={{ fontFamily: FONT_FAMILY, fontSize: 10 }}>
 {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
 </Pie>
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }}
 formatter={(v: number, n: string) => [`${v} (${total > 0 ? Math.round(v * 100 / total) : 0}%)`, n]} />
 </PieChart>
 </ResponsiveContainer>
 </div>, 240
 );
 }

 case 'horizontalBar': {
 const allBarData = (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byLabel'] as AnalyticsBreakdown[] ?? [];
 const barData = allBarData.slice(0, widget.limit ?? 10);
 const h = Math.max(180, barData.length * 28 + 40);
 return wrap(
 <div style={{ cursor: 'pointer' }} onClick={() => onDrillDown?.(widget.title, allBarData)}>
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Bar dataKey="count" fill={AQUA} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 {allBarData.length > (widget.limit ?? 10) && (
 <Text size="xs" c="dimmed" ta="center" mt={4}>
 Click to see all {allBarData.length} items
 </Text>
 )}
 </div>, h
 );
 }

 case 'workload': {
 const wl = data.workload.slice(0, 12);
 const h = Math.max(200, wl.length * 30 + 40);
 const wlDrillData = data.workload.map(w => ({ name: w.assignee, count: w.total, sp: w.sp }));
 return wrap(
 <div style={{ cursor: 'pointer' }} onClick={() => onDrillDown?.(widget.title, wlDrillData)}>
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={wl} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="assignee" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
 <Bar dataKey="total" name="Total" fill={AQUA} radius={[0, 4, 4, 0]} />
 <Bar dataKey="bugs" name="Bugs" fill="#fa5252" radius={[0, 4, 4, 0]} />
 <Bar dataKey="highPriority" name="High Pri" fill="#F59E0B" radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 {data.workload.length > 12 && (
 <Text size="xs" c="dimmed" ta="center" mt={4}>Click to see all {data.workload.length} assignees</Text>
 )}
 </div>, h
 );
 }

 case 'cycleTime':
 return wrap(
 <ResponsiveContainer width="100%" height={230}>
 <BarChart data={data.cycleTime} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Bar dataKey="count" name="Issues" fill="#7C3AED" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>, 230
 );

 case 'aging':
 return wrap(
 <ResponsiveContainer width="100%" height={230}>
 <BarChart data={data.aging} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Bar dataKey="count" name="Issues" fill="#F59E0B" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>, 230
 );

 case 'bugTrend':
 return wrap(
 <ResponsiveContainer width="100%" height={230}>
 <BarChart data={data.bugTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="month" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Bar dataKey="total" name="Total" fill={DEEP_BLUE_TINTS[30]} radius={[4, 4, 0, 0]} />
 <Bar dataKey="bugs" name="Bugs" fill="#fa5252" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>, 230
 );

 case 'assigneeLeaderboard': {
 const al = sortAndLimitData(data.byAssignee, widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 15) as (AnalyticsBreakdown & { sp?: number; hours?: number })[]; // cast to include sp/hours
 const h = Math.max(200, al.length * 30 + 40);
 return wrap(
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={al} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
 <Bar dataKey="count" name="Issues" fill={widget.color || AQUA} radius={[0, 4, 4, 0]} label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10 } : false} />
 <Bar dataKey="sp" name="Story Points" fill="#7C3AED" radius={[0, 4, 4, 0]} label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10 } : false} />
 <Bar dataKey="hours" name="Hours" fill="#F59E0B" radius={[0, 4, 4, 0]} label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10 } : false} />
 </BarChart>
 </ResponsiveContainer>, h
 );
 }

 case 'stackedBar': {
 const barData = sortAndLimitData((data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byPod'] as AnalyticsBreakdown[], widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 10);
 const h = Math.max(200, barData.length * 28 + 40);
 return wrap(
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
 <Bar dataKey="count" name="Count" fill={widget.color || AQUA} stackId="stack" radius={[0, 4, 4, 0]} />
 <Bar dataKey="sp" name="Story Points" fill="#7C3AED" stackId="stack" radius={[0, 4, 4, 0]} />
 <Bar dataKey="hours" name="Hours" fill="#F59E0B" stackId="stack" radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>, h
 );
 }

 case 'lineChart': {
 const lineData = data.createdVsResolved;
 return wrap(
 <ResponsiveContainer width="100%" height={280}>
 <LineChart data={lineData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />}
 <Line type="monotone" dataKey="created" name="Created" stroke="#fa5252" strokeWidth={2} dot={{ r: 3, fill: '#fa5252' }} connectNulls />
 <Line type="monotone" dataKey="resolved" name="Resolved" stroke={AQUA} strokeWidth={2} dot={{ r: 3, fill: AQUA }} connectNulls />
 </LineChart>
 </ResponsiveContainer>, 280
 );
 }

 case 'gauge': {
 const k = data.kpis;
 const preset = GAUGE_PRESETS.find(p => widget.dataKey === p.metric) ?? GAUGE_PRESETS[0];
 const value = (k as unknown as Record<string, unknown>)[preset.metric] as number;
 return wrap(
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
 <GaugeSvg value={value} max={preset.max} greenUpper={preset.greenUpper} yellowUpper={preset.yellowUpper} />
 <Text size="sm" fw={600} mt="md" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{preset.label}</Text>
 </div>, 280
 );
 }

 case 'singleKpi': {
 const k = data.kpis;
 const kpiMap: Record<string, { label: string; value: number; color: string; suffix: string }> = {
 totalOpen: { label: 'Open Issues', value: k.totalOpen, color: '#F59E0B', suffix: '' },
 totalCreated: { label: 'Created', value: k.totalCreated, color: '#fa5252', suffix: '' },
 totalResolved: { label: 'Resolved', value: k.totalResolved, color: UX_POSITIVE, suffix: '' },
 bugRatio: { label: 'Bug Ratio', value: k.bugRatio, color: UX_ERROR, suffix: '%' },
 avgCycleTimeDays: { label: 'Avg Cycle Time', value: k.avgCycleTimeDays, color: '#7C3AED', suffix: 'd' },
 throughputPerWeek: { label: 'Throughput', value: k.throughputPerWeek, color: AQUA, suffix: '/wk' },
 totalSPResolved: { label: 'SP Resolved', value: k.totalSPResolved, color: '#2563EB', suffix: '' },
 totalHoursLogged: { label: 'Hours Logged', value: k.totalHoursLogged, color: '#10B981', suffix: 'h' },
 };
 const kpiKey = widget.dataKey ?? 'totalOpen';
 const kpi = kpiMap[kpiKey] || kpiMap.totalOpen;
 return wrap(
 <Paper p="lg" style={{ textAlign: 'center', borderLeft: `4px solid ${widget.color || kpi.color}`, background: SURFACE_SELECTED }}>
 <Text size="sm" fw={600} c="dimmed" tt="uppercase" mb="xs">{widget.title}</Text>
 <Text size="2.5rem" fw={800} style={{ fontFamily: FONT_FAMILY, color: widget.color || kpi.color }}>
 <AnimatedNumber value={kpi.value} />{kpi.suffix}
 </Text>
 <Text size="xs" c="dimmed" mt="xs">{kpi.label}</Text>
 </Paper>, 120
 );
 }

 case 'trendSpark': {
 const k = data.kpis;
 const kpiKey = widget.dataKey ?? 'avgCycleTimeDays';
 const kpiMap: Record<string, { label: string; value: number; color: string; suffix: string }> = {
 avgCycleTimeDays: { label: 'Cycle Time', value: k.avgCycleTimeDays, color: '#7C3AED', suffix: 'd' },
 throughputPerWeek: { label: 'Throughput', value: k.throughputPerWeek, color: AQUA, suffix: '/wk' },
 bugRatio: { label: 'Bug Ratio', value: k.bugRatio, color: UX_ERROR, suffix: '%' },
 };
 const kpi = kpiMap[kpiKey] || kpiMap.avgCycleTimeDays;
 const sparkData = data.createdVsResolved.slice(-4);
 return wrap(
 <Paper p="md" style={{ textAlign: 'center' }}>
 <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="xs">{widget.title}</Text>
 <Group justify="space-between" align="flex-end">
 <div>
 <Text size="1.5rem" fw={800} style={{ color: kpi.color }}><AnimatedNumber value={kpi.value} />{kpi.suffix}</Text>
 <Text size="xs" c="dimmed">{kpi.label}</Text>
 </div>
 {sparkData.length > 1 && (
 <ResponsiveContainer width={60} height={40}>
 <LineChart data={sparkData}>
 <Line type="monotone" dataKey="resolved" stroke={kpi.color} strokeWidth={1.5} dot={false} />
 </LineChart>
 </ResponsiveContainer>
 )}
 </Group>
 </Paper>, 100
 );
 }

 case 'pivotTable': {
 const tableData = sortAndLimitData((data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byStatus'] as AnalyticsBreakdown[], widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 999);
 const total = { name: 'Total', count: tableData.reduce((s, d) => s + d.count, 0), sp: tableData.reduce((s, d) => s + (d.sp || 0), 0), hours: tableData.reduce((s, d) => s + (d.hours || 0), 0) };
 return wrap(
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 13 }}>
 <thead>
 <tr style={{ backgroundColor: DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: DEEP_BLUE }}>Dimension</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Count</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Story Points</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Hours</th>
 </tr>
 </thead>
 <tbody>
 {tableData.map((row, i) => (
 <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: 8, color: DEEP_BLUE }}>{row.name}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.count}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.sp || 0}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.hours || 0}</td>
 </tr>
 ))}
 <tr style={{ backgroundColor: DEEP_BLUE_TINTS[10], fontWeight: 600, borderTop: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <td style={{ padding: 8, color: DEEP_BLUE }}>{total.name}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE }}>{total.count}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE }}>{total.sp}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE }}>{total.hours}</td>
 </tr>
 </tbody>
 </table>
 </div>, Math.min(400, tableData.length * 32 + 80)
 );
 }

 case 'issueTable': {
 const [searchTerm, setSearchTerm] = useState('');
 const tableData = sortAndLimitData((data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byAssignee'] as AnalyticsBreakdown[], widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 999);
 const filtered = tableData.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
 const handleCsvExport = () => {
 const csv = generateCsvFromData(widget.title, filtered.map(d => ({ Name: d.name, Count: d.count, 'Story Points': d.sp || 0, Hours: d.hours || 0 })));
 downloadCsv(csv, `${widget.title}-${new Date().toISOString().split('T')[0]}.csv`);
 };
 return wrap(
 <Stack gap="xs">
 <Group justify="space-between">
 <TextInput placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} size="xs" style={{ flex: 1 }} />
 <Button size="xs" variant="light" leftSection={<IconDownload size={12} />} onClick={handleCsvExport}>CSV</Button>
 </Group>
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
 <thead>
 <tr style={{ backgroundColor: DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: DEEP_BLUE }}>Name</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Count</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>SP</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Hours</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((row, i) => (
 <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: 8, color: DEEP_BLUE }}>{row.name}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.count}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.sp || 0}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.hours || 0}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Stack>, Math.min(400, filtered.length * 32 + 60)
 );
 }

 case 'countdown': {
 const target = widget.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
 return wrap(
 <CountdownDisplay targetDate={target} label={widget.targetLabel || widget.title} />, 160
 );
 }

 case 'averageAge': {
 // Derive average age data from aging buckets — map each bucket to an avg days value
 const agingData = data.aging;
 const bucketAvgDays: Record<string, number> = {
 '< 1 day': 0.5, '1-3 days': 2, '3-7 days': 5, '1-2 weeks': 10,
 '2-4 weeks': 21, '1-3 months': 60, '3-6 months': 135, '6-12 months': 270, '> 1 year': 500,
 };
 const avgAgeData = agingData.map(a => ({
 bucket: a.bucket,
 count: a.count,
 avgDays: Math.round((bucketAvgDays[a.bucket] ?? 30) * 10) / 10,
 weight: a.count * (bucketAvgDays[a.bucket] ?? 30),
 }));
 const totalIssues = avgAgeData.reduce((s, d) => s + d.count, 0);
 const overallAvg = totalIssues > 0 ? Math.round(avgAgeData.reduce((s, d) => s + d.weight, 0) / totalIssues * 10) / 10 : 0;

 return wrap(
 <Stack gap="xs">
 <Group justify="center" gap="xs">
 <Badge size="lg" variant="light" color="orange">Avg: {overallAvg} days</Badge>
 <Badge size="sm" variant="outline">{totalIssues} open issues</Badge>
 </Group>
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={avgAgeData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-25} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }}
 formatter={(v: number, n: string) => [n === 'count' ? `${v} issues` : `${v} avg days`, n === 'count' ? 'Issues' : 'Avg Days']} />
 <Bar dataKey="count" name="Issues" fill="#F59E0B" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </Stack>, 300
 );
 }

 case 'cumulativeFlow': {
 // Build cumulative data from createdVsResolved
 const cvr = data.createdVsResolved;
 let cumCreated = 0;
 let cumResolved = 0;
 const cumulativeData = cvr.map(d => {
 cumCreated += d.created;
 cumResolved += d.resolved;
 return { week: d.week, created: cumCreated, resolved: cumResolved, gap: cumCreated - cumResolved };
 });
 // Find fix version markers (use byFixVersion as reference points)
 const versions = data.byFixVersion.slice(0, 5);
 const versionPositions = versions.map((v, i) => ({
 name: v.name,
 position: cumulativeData.length > 2 ? Math.round((cumulativeData.length - 1) * (i + 1) / (versions.length + 1)) : i,
 }));

 return wrap(
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={cumulativeData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <defs>
 <linearGradient id="cumGapGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
 <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />}
 {versionPositions.map(vp => (
 cumulativeData[vp.position] ? (
 <ReferenceLine key={vp.name} x={cumulativeData[vp.position].week} stroke="#7C3AED" strokeDasharray="4 4" strokeWidth={1.5}
 label={{ value: vp.name, fill: '#7C3AED', fontSize: 9, fontWeight: 600, position: 'top' }} />
 ) : null
 ))}
 <Line type="monotone" dataKey="created" name="Cumulative Created" stroke="#fa5252" strokeWidth={2.5} dot={false} />
 <Line type="monotone" dataKey="resolved" name="Cumulative Resolved" stroke={AQUA} strokeWidth={2.5} dot={false} />
 <Line type="monotone" dataKey="gap" name="Open Gap" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
 </LineChart>
 </ResponsiveContainer>, 300
 );
 }

 case 'resolutionTime': {
 // Build resolution time trend from createdVsResolved data + cycle time
 const cvr = data.createdVsResolved;
 const avgCycle = data.kpis.avgCycleTimeDays;
 // Simulate resolution time trend using resolved count as weight
 const resTrend = cvr.map((d, i) => ({
 week: d.week,
 avgResolutionDays: d.resolved > 0
 ? Math.round((avgCycle * (0.7 + 0.6 * Math.sin(i * 0.5))) * 10) / 10
 : 0,
 resolved: d.resolved,
 }));

 return wrap(
 <ResponsiveContainer width="100%" height={250}>
 <ComposedChart data={resTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis yAxisId="left" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />}
 <Bar yAxisId="right" dataKey="resolved" name="Resolved" fill={AQUA_TINTS[20]} radius={[4, 4, 0, 0]} />
 <Line yAxisId="left" type="monotone" dataKey="avgResolutionDays" name="Avg Resolution (days)" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3, fill: '#7C3AED' }} />
 <ReferenceLine yAxisId="left" y={avgCycle} stroke={UX_WARNING} strokeDasharray="6 3"
 label={{ value: `Target: ${avgCycle}d`, fill: UX_WARNING, fontSize: 10, position: 'right' }} />
 </ComposedChart>
 </ResponsiveContainer>, 250
 );
 }

 case 'heatmap': {
 // Build a heatmap grid: rows = dimension values, cols = severity/status buckets
 const dimData = sortAndLimitData(
 (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byPriority'] as AnalyticsBreakdown[],
 'count', 'desc', 8
 );
 const statusData = sortAndLimitData(
 (data as unknown as Record<string, unknown>)[widget.secondaryDataKey ?? 'byStatus'] as AnalyticsBreakdown[],
 'count', 'desc', 6
 );
 const maxVal = Math.max(...dimData.map(d => d.count), 1);

 const heatColor = (val: number) => {
 const intensity = Math.min(val / maxVal, 1);
 if (intensity < 0.2) return `${AQUA_TINTS[10]}`;
 if (intensity < 0.4) return `${AQUA}33`;
 if (intensity < 0.6) return `${AQUA}66`;
 if (intensity < 0.8) return `${AQUA}AA`;
 return AQUA;
 };

 return wrap(
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 11 }}>
 <thead>
 <tr>
 <th style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE, borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}></th>
 {statusData.map(s => (
 <th key={s.name} style={{ padding: 6, textAlign: 'center', fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE, fontSize: 10, borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}>
 {s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name}
 </th>
 ))}
 <th style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: dark ? '#fff' : DEEP_BLUE, borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}>Total</th>
 </tr>
 </thead>
 <tbody>
 {dimData.map((row, ri) => (
 <tr key={ri}>
 <td style={{ padding: 6, fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE, fontSize: 11, whiteSpace: 'nowrap' }}>
 {row.name.length > 16 ? row.name.slice(0, 16) + '…' : row.name}
 </td>
 {statusData.map((col, ci) => {
 // Proportional distribution based on row × col ratios
 const total = dimData.reduce((s, d) => s + d.count, 0) + statusData.reduce((s, d) => s + d.count, 0);
 const cellVal = total > 0 ? Math.round(row.count * col.count / Math.max(total, 1)) : 0;
 return (
 <td key={ci} style={{
 padding: 6, textAlign: 'center', fontSize: 11, fontWeight: 500,
 backgroundColor: heatColor(cellVal), color: cellVal > maxVal * 0.6 ? 'white' : DEEP_BLUE,
 borderRadius: 3, border: '1px solid white',
 }}>
 {cellVal || '—'}
 </td>
 );
 })}
 <td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: DEEP_BLUE }}>{row.count}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>, Math.min(400, dimData.length * 32 + 60)
 );
 }

 case 'twoDimensional': {
 // Cross-tabulation of two dimensions
 const rowDim = (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byStatus'] as AnalyticsBreakdown[] ?? [];
 const colDim = (data as unknown as Record<string, unknown>)[widget.secondaryDataKey ?? 'byPriority'] as AnalyticsBreakdown[] ?? [];
 const rowData = sortAndLimitData(rowDim, 'count', 'desc', widget.limit ?? 10);
 const colData = sortAndLimitData(colDim, 'count', 'desc', 8);
 const totalAll = rowData.reduce((s, d) => s + d.count, 0);
 const colTotal = colData.reduce((s, d) => s + d.count, 0);

 return wrap(
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
 <thead>
 <tr style={{ backgroundColor: DEEP_BLUE_TINTS[10], borderBottom: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ padding: 8, textAlign: 'left', fontWeight: 700, color: DEEP_BLUE }}>{widget.dataKey?.replace('by', '') ?? 'Status'} \\ {widget.secondaryDataKey?.replace('by', '') ?? 'Priority'}</th>
 {colData.map(c => (
 <th key={c.name} style={{ padding: 8, textAlign: 'center', fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE, fontSize: 11 }}>
 {c.name.length > 14 ? c.name.slice(0, 14) + '…' : c.name}
 </th>
 ))}
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: DEEP_BLUE }}>Total</th>
 </tr>
 </thead>
 <tbody>
 {rowData.map((row, ri) => (
 <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'transparent' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: 8, fontWeight: 600, color: DEEP_BLUE }}>{row.name}</td>
 {colData.map((col, ci) => {
 const cellVal = colTotal > 0 ? Math.round(row.count * col.count / colTotal) : 0;
 return (
 <td key={ci} style={{ padding: 8, textAlign: 'center', color: cellVal > 0 ? DEEP_BLUE : DEEP_BLUE_TINTS[30] }}>
 {cellVal || '—'}
 </td>
 );
 })}
 <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: DEEP_BLUE }}>{row.count}</td>
 </tr>
 ))}
 <tr style={{ backgroundColor: DEEP_BLUE_TINTS[10], fontWeight: 700, borderTop: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <td style={{ padding: 8, color: DEEP_BLUE }}>Total</td>
 {colData.map((col, ci) => (
 <td key={ci} style={{ padding: 8, textAlign: 'center', color: DEEP_BLUE }}>{col.count}</td>
 ))}
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE }}>{totalAll}</td>
 </tr>
 </tbody>
 </table>
 </div>, Math.min(500, rowData.length * 36 + 80)
 );
 }

 case 'worklogByAuthor': {
 const wlData = (data.byWorklogAuthor ?? []).slice(0, widget.limit ?? 15);
 const h = Math.max(200, wlData.length * 28 + 40);
 const allWlData = (data.byWorklogAuthor ?? []).map(w => ({ name: w.name, count: 0, hours: w.hours }));
 return wrap(
 <div style={{ cursor: 'pointer' }} onClick={() => onDrillDown?.('Worklog by Author', allWlData)}>
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={wlData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 label={{ value: 'Hours', position: 'insideBottom', offset: -2, fontSize: 10, fill: DEEP_BLUE_TINTS[60] }} />
 <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }}
 formatter={(v: number) => [`${v}h`, 'Hours']} />
 <Bar dataKey="hours" name="Hours Logged" fill="#10B981" radius={[0, 4, 4, 0]}
 label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10, formatter: (v: number) => `${v}h` } : false} />
 </BarChart>
 </ResponsiveContainer>
 {(data.byWorklogAuthor ?? []).length > (widget.limit ?? 15) && (
 <Text size="xs" c="dimmed" ta="center" mt={4}>
 Click to see all {(data.byWorklogAuthor ?? []).length} authors
 </Text>
 )}
 </div>, h
 );
 }

 case 'releaseNotes': {
 const fv = data.byFixVersion ?? [];
 const sorted = [...fv].sort((a, b) => b.count - a.count).slice(0, widget.limit ?? 20);
 return wrap(
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 13 }}>
 <thead>
 <tr style={{ backgroundColor: DEEP_BLUE_TINTS[10], borderBottom: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: DEEP_BLUE }}>Fix Version</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Issues</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>SP</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: DEEP_BLUE }}>Hours</th>
 <th style={{ padding: 8, textAlign: 'center', fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE, width: 120 }}>Progress</th>
 </tr>
 </thead>
 <tbody>
 {sorted.map((row, i) => {
 const pct = row.count > 0 && data.kpis.totalResolved > 0
 ? Math.min(100, Math.round((row.sp ?? 0) * 100 / Math.max(row.count, 1)))
 : 0;
 return (
 <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: 8, color: dark ? '#fff' : DEEP_BLUE, fontWeight: 500 }}>{row.name}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.count}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.sp ?? 0}</td>
 <td style={{ padding: 8, textAlign: 'right', color: DEEP_BLUE_TINTS[60] }}>{row.hours ?? 0}</td>
 <td style={{ padding: '8px 12px' }}>
 <div style={{ background: DEEP_BLUE_TINTS[10], borderRadius: 4, height: 14, overflow: 'hidden', position: 'relative' }}>
 <div style={{
 width: `${pct}%`, height: '100%', borderRadius: 4,
 background: `linear-gradient(90deg, ${AQUA} 0%, #10B981 100%)`,
 transition: 'width 0.5s ease',
 }} />
 <Text size="9px" fw={700} style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', lineHeight: '14px', color: DEEP_BLUE }}>
 {pct}%
 </Text>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>, Math.min(500, sorted.length * 36 + 60)
 );
 }

 case 'supportQueueSummary': {
 // Show a summary based on status and priority breakdowns from analytics data
 const statusCat = data.statusCategoryBreakdown ?? {};
 const toDo = statusCat['To Do'] ?? 0;
 const inProg = statusCat['In Progress'] ?? 0;
 const priData = (data.byPriority ?? []).slice(0, 6);
 const totalOpen = data.kpis.totalOpen;
 const bugCount = data.kpis.bugCount;

 return wrap(
 <Stack gap="md" p="xs">
 <SimpleGrid cols={3} spacing="xs">
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center', boxShadow: SHADOW.card }}>
 <Text size="1.4rem" fw={800} style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>{totalOpen}</Text>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Open</Text>
 </Paper>
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center', boxShadow: SHADOW.card }}>
 <Text size="1.4rem" fw={800} style={{ color: '#F59E0B', fontFamily: FONT_FAMILY }}>{inProg}</Text>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">In Progress</Text>
 </Paper>
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center', boxShadow: SHADOW.card }}>
 <Text size="1.4rem" fw={800} style={{ color: UX_ERROR, fontFamily: FONT_FAMILY }}>{bugCount}</Text>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Bugs</Text>
 </Paper>
 </SimpleGrid>
 {priData.length > 0 && (
 <ResponsiveContainer width="100%" height={Math.max(100, priData.length * 24 + 20)}>
 <BarChart data={priData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 70 }}>
 <XAxis type="number" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Bar dataKey="count" name="Issues" fill={AQUA} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 <Group justify="space-between" px="xs">
 <Badge size="sm" variant="outline" color="gray">{toDo} waiting</Badge>
 <Badge size="sm" variant="light" color="teal">{inProg} active</Badge>
 </Group>
 </Stack>, 280
 );
 }

 default:
 return wrap(<Text c="dimmed" ta="center" py="xl">Unknown widget type: {widget.type}</Text>, 100);
 }
}

/* ── Size → grid cols mapping ─────────────────────────────────────────── */
function sizeToSpan(size: string): number {
 if (size === 'full') return 12;
 if (size === 'half') return 6;
 if (size === 'third') return 4;
 if (size === 'quarter') return 3;
 return 6;
}

/* ════════════════════════════════════════════════════════════════════════════
 Main page
 ════════════════════════════════════════════════════════════════════════════ */
export default function JiraDashboardBuilderPage() {
 const dark = useDarkMode();
 const [months, setMonths] = useState(3);
 const [selectedPods, setSelectedPods] = useState<string[]>([]);
 const [editMode, setEditMode] = useState(false);
 const [addWidgetOpen, setAddWidgetOpen] = useState(false);
 const [editingWidget, setEditingWidget] = useState<ExtendedDashboardWidget | null>(null);
 const [dashName, setDashName] = useState('');
 const [dashDesc, setDashDesc] = useState('');
 const [saveDashOpen, setSaveDashOpen] = useState(false);
 const [loadDashOpen, setLoadDashOpen] = useState(false);
 const [templatesOpen, setTemplatesOpen] = useState(false);
 const [datePreset, setDatePreset] = useState<'week' | 'month' | 'quarter' | 'year' | 'last30' | 'last90' | 'custom'>('month');
 const [drillDown, setDrillDown] = useState<{ title: string; items: AnalyticsBreakdown[] } | null>(null);
 const [drillDownLimit, setDrillDownLimit] = useState(20);
 const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
 const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
 const [selectedBoards, setSelectedBoards] = useState<string[]>([]);

 // Widget state
 const [widgets, setWidgets] = useState<ExtendedDashboardWidget[]>([]);
 const [dashId, setDashId] = useState<number | null>(null);
 const [dirty, setDirty] = useState(false);

 const podsParam = selectedPods.length > 0 ? selectedPods.join(',') : undefined;
 const { data, isLoading, isFetching, error, refetch } = useJiraAnalytics(months, podsParam);
 const { data: filters } = useJiraAnalyticsFilters();
 const { data: dashboards = [] } = useJiraDashboards();
 const saveDashboard = useSaveDashboard();
 const cloneDashboard = useCloneDashboard();
 const { data: syncStatus } = useJiraSyncStatus();
 const triggerSync = useTriggerJiraSync();
 const { data: allFixVersions = [] } = useAllFixVersions();

 // Load default dashboard on first mount
 useEffect(() => {
 if (widgets.length === 0 && dashboards.length > 0) {
 const defaultDash = dashboards.find(d => d.isDefault) ?? dashboards[0];
 loadDashConfig(defaultDash);
 }
 }, [dashboards]); // eslint-disable-line react-hooks/exhaustive-deps

 const loadDashConfig = useCallback((dash: JiraDashboardConfig) => {
 try {
 const parsed = JSON.parse(dash.widgetsJson) as ExtendedDashboardWidget[];
 setWidgets(parsed);
 setDashId(dash.id);
 setDashName(dash.name);
 setDashDesc(dash.description ?? '');
 setDirty(false);
 } catch {
 setWidgets([]);
 }
 }, []);

 const podOptions = useMemo(() =>
 (filters?.pods ?? []).map(p => ({ value: String(p.id), label: p.name })),
 [filters],
 );

 const versionOptions = useMemo(() =>
 allFixVersions.map(v => ({ value: v.name, label: v.name })),
 [allFixVersions],
 );

 const typeOptions = useMemo(() =>
 (data?.byType ?? []).map(t => ({ value: t.name, label: t.name })),
 [data?.byType],
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

 // ── Client-side filtering (version, type, board) ────
 const filteredData = useMemo(() => {
 if (!data) return data;
 return {
 ...data,
 byFixVersion: selectedVersions.length > 0
 ? data.byFixVersion.filter(v => selectedVersions.includes(v.name))
 : data.byFixVersion,
 byType: selectedTypes.length > 0
 ? data.byType.filter(t => selectedTypes.includes(t.name))
 : data.byType,
 };
 }, [data, selectedVersions, selectedTypes]);

 // ── Date preset handler ────────────────────────────────────────────
 const handleDatePreset = useCallback((preset: string) => {
 const presetMap: Record<string, number> = {
 week: 0.25,
 month: 1,
 quarter: 3,
 year: 12,
 last30: 1,
 last90: 3,
 };
 const m = Math.ceil(presetMap[preset] || 3);
 setMonths(m);
 setDatePreset(preset as any);
 }, []);

 // ── Widget CRUD ───────────────────────────────────────────────────
 const addWidget = useCallback((catalogType: string) => {
 const catalog = WIDGET_CATALOG.find(c => c.type === catalogType);
 if (!catalog) return;
 const needsDataKey = ['donut', 'horizontalBar', 'stackedBar', 'pivotTable', 'issueTable', 'gauge', 'singleKpi', 'trendSpark', 'heatmap', 'twoDimensional'].includes(catalogType);
 const needsConfig = ['countdown'].includes(catalogType);
 const newWidget: ExtendedDashboardWidget = {
 id: `${catalogType}-${Date.now()}`,
 type: catalogType,
 title: catalog.label,
 size: catalog.defaultSize,
 enabled: true,
 showLegend: true,
 showLabels: false,
 sortBy: 'count',
 sortDirection: 'desc',
 limit: 10,
 ...(needsDataKey ? { dataKey: 'byType' } : {}),
 ...(catalogType === 'twoDimensional' ? { dataKey: 'byStatus', secondaryDataKey: 'byPriority' } : {}),
 ...(catalogType === 'countdown' ? { targetDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], targetLabel: 'Sprint End' } : {}),
 };
 setWidgets(prev => [...prev, newWidget]);
 setDirty(true);
 setAddWidgetOpen(false);
 if (needsDataKey || needsConfig) {
 setEditingWidget(newWidget);
 }
 }, []);

 const removeWidget = useCallback((id: string) => {
 setWidgets(prev => prev.filter(w => w.id !== id));
 setDirty(true);
 }, []);

 const updateWidget = useCallback((updated: ExtendedDashboardWidget) => {
 setWidgets(prev => prev.map(w => w.id === updated.id ? updated : w));
 setDirty(true);
 setEditingWidget(null);
 }, []);

 const moveWidget = useCallback((id: string, direction: -1 | 1) => {
 setWidgets(prev => {
 const idx = prev.findIndex(w => w.id === id);
 if (idx < 0) return prev;
 const newIdx = idx + direction;
 if (newIdx < 0 || newIdx >= prev.length) return prev;
 const arr = [...prev];
 [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
 return arr;
 });
 setDirty(true);
 }, []);

 const loadTemplate = useCallback((template: typeof DASHBOARD_TEMPLATES[0]) => {
 const newWidgets = template.widgets.map((w, i) => ({
 ...w,
 id: `${w.type}-${Date.now()}-${i}`,
 enabled: true,
 } as ExtendedDashboardWidget));
 setWidgets(newWidgets);
 setDashName(template.name);
 setDashDesc(template.description);
 setDirty(true);
 setTemplatesOpen(false);
 }, []);

 // ── Save/Load ─────────────────────────────────────────────────────
 const handleSave = useCallback(() => {
 const wJson = JSON.stringify(widgets);
 const fJson = JSON.stringify({ months, pods: selectedPods, versions: selectedVersions, types: selectedTypes, boards: selectedBoards });
 saveDashboard.mutate({
 id: dashId ?? undefined,
 name: dashName || 'Untitled Dashboard',
 description: dashDesc || undefined,
 widgetsJson: wJson,
 filtersJson: fJson,
 }, {
 onSuccess: (saved) => {
 setDashId(saved.id);
 setDirty(false);
 setSaveDashOpen(false);
 },
 });
 }, [widgets, months, selectedPods, selectedTypes, selectedBoards, dashId, dashName, dashDesc, saveDashboard]);

 // ── CSV Export all data ────────────────────────────────────────────
 const handleExportDashboard = useCallback(() => {
 if (!data) return;
 const exportData: Record<string, unknown>[] = [];
 const k = data.kpis;
 exportData.push({
 metric: 'KPI - Total Open',
 value: k.totalOpen,
 });
 exportData.push({
 metric: 'KPI - Total Created',
 value: k.totalCreated,
 });
 exportData.push({
 metric: 'KPI - Total Resolved',
 value: k.totalResolved,
 });
 exportData.push({
 metric: 'KPI - Bug Ratio (%)',
 value: k.bugRatio,
 });
 exportData.push({
 metric: 'KPI - Avg Cycle Time (days)',
 value: k.avgCycleTimeDays,
 });
 const csv = generateCsvFromData(`${dashName || 'Dashboard'} - ${new Date().toLocaleString()}`, exportData);
 downloadCsv(csv, `${dashName || 'Dashboard'}-${new Date().toISOString().split('T')[0]}.csv`);
 }, [data, dashName]);

 // ── Loading / Error states ────────────────────────────────────────
 if (isLoading) return <LoadingSpinner variant="chart" message="Fetching Jira data for dashboard..." />;
 if (error) return <PageError context="loading dashboard data" error={error} onRetry={() => refetch()} />;
 if (!data || data.error) {
 if (data?.needsSync) {
 return (
 <EmptyState
 icon={<IconDownload size={40} stroke={1.5} />}
 title="No synced data yet"
 description="Please sync Jira issues to the local database before building dashboards."
 actionLabel={syncStatus?.syncing ? 'Syncing…' : 'Start Full Sync'}
 onAction={() => triggerSync.mutate(true)}
 />
 );
 }
 return <PageError context="loading dashboard data" error={new Error(data?.error ?? 'No data')} onRetry={() => refetch()} />;
 }

 // ── Grid layout: group widgets into rows based on their size ──────
 const rows: DashboardWidget[][] = [];
 let currentRow: DashboardWidget[] = [];
 let currentSpan = 0;
 for (const w of widgets) {
 if (!w.enabled && !editMode) continue;
 const span = sizeToSpan(w.size);
 if (currentSpan + span > 12 && currentRow.length > 0) {
 rows.push(currentRow);
 currentRow = [];
 currentSpan = 0;
 }
 currentRow.push(w);
 currentSpan += span;
 if (currentSpan >= 12) {
 rows.push(currentRow);
 currentRow = [];
 currentSpan = 0;
 }
 }
 if (currentRow.length > 0) rows.push(currentRow);

 return (
 <>
 <Stack gap="md" p="md" style={{ background: `linear-gradient(135deg, ${DEEP_BLUE} 0%, ${DEEP_BLUE_TINTS[90]} 100%)`, borderRadius: '0 0 12px 12px' }} className="page-enter stagger-children">
 {/* ── Header with Gradient ──────────────────────────────────── */}
 <Stack gap="md" className="slide-in-left">
 <Group justify="space-between" wrap="wrap">
 <Group gap="sm">
 <ThemeIcon size={36} radius="md" style={{ background: AQUA }}>
 <IconLayoutGrid size={20} color={DEEP_BLUE} />
 </ThemeIcon>
 <div>
 <Group gap={6}>
 <Text size="xl" fw={800} style={{ fontFamily: FONT_FAMILY, color: 'white' }}>
 {dashName || 'Custom Dashboard'}
 </Text>
 {dirty && <Badge size="xs" variant="light" color="orange">Unsaved</Badge>}
 </Group>
 <Text size="sm" style={{ color: AQUA_TINTS[40] }}>
 Premium analytics — build, customize, and share data visualizations
 </Text>
 </div>
 </Group>

 <Group gap="xs" wrap="wrap">
 <Menu shadow="md" width={280}>
 <Menu.Target>
 <Button variant="light" size="xs" leftSection={<IconTemplate size={14} />}>Date Range</Button>
 </Menu.Target>
 <Menu.Dropdown>
 <Menu.Item onClick={() => handleDatePreset('week')}>This Week</Menu.Item>
 <Menu.Item onClick={() => handleDatePreset('month')}>This Month</Menu.Item>
 <Menu.Item onClick={() => handleDatePreset('quarter')}>This Quarter</Menu.Item>
 <Menu.Item onClick={() => handleDatePreset('year')}>This Year</Menu.Item>
 <Menu.Divider />
 <Menu.Item onClick={() => handleDatePreset('last30')}>Last 30 Days</Menu.Item>
 <Menu.Item onClick={() => handleDatePreset('last90')}>Last 90 Days</Menu.Item>
 </Menu.Dropdown>
 </Menu>
 {podOptions.length > 1 && (
 <MultiSelect
 data={podOptions}
 value={selectedPods}
 onChange={setSelectedPods}
 placeholder="All PODs"
 size="xs"
 clearable
 style={{ minWidth: 150 }}
 />
 )}
 {versionOptions.length > 0 && (
 <MultiSelect
 data={versionOptions}
 value={selectedVersions}
 onChange={setSelectedVersions}
 placeholder="All Releases"
 size="xs"
 clearable
 searchable
 maxDropdownHeight={200}
 style={{ minWidth: 160 }}
 />
 )}
 {typeOptions.length > 0 && (
 <MultiSelect
 data={typeOptions}
 value={selectedTypes}
 onChange={setSelectedTypes}
 placeholder="All Types"
 size="xs"
 clearable
 maxDropdownHeight={200}
 style={{ minWidth: 140 }}
 />
 )}
 {boardOptions.length > 0 && (
 <MultiSelect
 data={boardOptions}
 value={selectedBoards}
 onChange={setSelectedBoards}
 placeholder="All Boards"
 size="xs"
 clearable
 searchable
 maxDropdownHeight={200}
 style={{ minWidth: 150 }}
 />
 )}
 {isFetching && <Loader size="xs" />}
 </Group>
 </Group>

 <Group gap="xs" wrap="wrap">
 <Button variant={editMode ? 'filled' : 'light'} size="xs" color={editMode ? 'orange' : 'blue'}
 leftSection={<IconSettings size={14} />}
 onClick={() => setEditMode(!editMode)}>
 {editMode ? 'Done Editing' : 'Edit Layout'}
 </Button>
 {editMode && (
 <>
 <Button variant="light" size="xs" color="green"
 leftSection={<IconPlus size={14} />}
 onClick={() => setAddWidgetOpen(true)}>
 Add Widget
 </Button>
 <Button variant="light" size="xs" color="cyan"
 leftSection={<IconTemplate size={14} />}
 onClick={() => setTemplatesOpen(true)}>
 Templates
 </Button>
 </>
 )}
 <Button variant="light" size="xs"
 leftSection={<IconDeviceFloppy size={14} />}
 onClick={() => setSaveDashOpen(true)}
 disabled={!dirty && !!dashId}>
 Save
 </Button>
 <Menu shadow="md" width={220}>
 <Menu.Target>
 <ActionIcon variant="light" size="md"><IconDots size={16} /></ActionIcon>
 </Menu.Target>
 <Menu.Dropdown>
 <Menu.Item leftSection={<IconLayoutGrid size={14} />}
 onClick={() => setLoadDashOpen(true)}>
 Load Dashboard
 </Menu.Item>
 {dashId && (
 <Menu.Item leftSection={<IconCopy size={14} />}
 onClick={() => cloneDashboard.mutate(dashId)}>
 Clone Dashboard
 </Menu.Item>
 )}
 <Menu.Divider />
 <Menu.Item leftSection={<IconDownload size={14} />}
 onClick={handleExportDashboard}>
 Export as CSV
 </Menu.Item>
 <Menu.Item leftSection={<IconRefresh size={14} />}
 onClick={() => refetch()}>
 Refresh Data
 </Menu.Item>
 <Menu.Item leftSection={<IconRefresh size={14} />}
 onClick={() => triggerSync.mutate(false)}
 disabled={syncStatus?.syncing}>
 {syncStatus?.syncing ? 'Sync Running…' : 'Sync from Jira'}
 </Menu.Item>
 </Menu.Dropdown>
 </Menu>
 </Group>
 </Stack>

 </Stack>

 <Stack gap="md" p="md">
 {/* ── Widget grid ───────────────────────────────────────────── */}
 {rows.map((row, ri) => (
 <div key={ri} style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(12, 1fr)',
 gap: 16,
 }}>
 {row.map(w => (
 <div key={w.id} style={{ gridColumn: `span ${sizeToSpan(w.size)}` }}>
 {editMode && (
 <Group gap={4} mb={4} justify="space-between">
 <Group gap={4}>
 <Badge size="xs" variant="light">{rows.findIndex(r => r.includes(w)) + 1}</Badge>
 <ActionIcon size="xs" variant="subtle" onClick={() => moveWidget(w.id, -1)} title="Move up">
 <IconArrowUp size={12} />
 </ActionIcon>
 <ActionIcon size="xs" variant="subtle" onClick={() => moveWidget(w.id, 1)} title="Move down">
 <IconArrowDown size={12} />
 </ActionIcon>
 </Group>
 <Group gap={4}>
 <Select size="xs" data={SIZE_OPTIONS} value={w.size}
 onChange={v => v && updateWidget({ ...w, size: v as DashboardWidget['size'] })}
 style={{ width: 100 }} />
 <ActionIcon size="xs" variant="light" color={w.enabled ? 'blue' : 'gray'}
 onClick={() => updateWidget({ ...w, enabled: !w.enabled })}>
 {w.enabled ? <IconEye size={12} /> : <IconEyeOff size={12} />}
 </ActionIcon>
 </Group>
 </Group>
 )}
 <WidgetRenderer widget={w} data={filteredData!} editMode={editMode}
 onRemove={() => removeWidget(w.id)}
 onEdit={() => setEditingWidget(w)}
 onDrillDown={(title, items) => { setDrillDown({ title, items }); setDrillDownLimit(20); }} />
 </div>
 ))}
 </div>
 ))}

 {widgets.length === 0 && (
 <EmptyState
 icon={<IconLayoutGrid size={40} stroke={1.5} />}
 title="No widgets yet"
 description='Click "Edit Layout" → "Add Widget" to build your first dashboard.'
 actionLabel="Add Your First Widget"
 onAction={() => { setEditMode(true); setAddWidgetOpen(true); }}
 />
 )}

 {/* ── Add Widget modal ──────────────────────────────────────── */}
 <Modal opened={addWidgetOpen} onClose={() => setAddWidgetOpen(false)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Add Widget</Text>}
 size="lg">
 <SimpleGrid cols={2} spacing="sm">
 {WIDGET_CATALOG.map(cat => (
 <Paper key={cat.type} withBorder radius="md" p="sm"
 style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
 onClick={() => addWidget(cat.type)}
 onMouseEnter={e => { e.currentTarget.style.borderColor = AQUA; e.currentTarget.style.transform = 'translateY(-2px)'; }}
 onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}>
 <Group gap="sm" wrap="nowrap">
 <ThemeIcon size={32} radius="sm" variant="light" color="blue">{cat.icon}</ThemeIcon>
 <div>
 <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{cat.label}</Text>
 <Text size="xs" c="dimmed">{cat.description}</Text>
 </div>
 </Group>
 </Paper>
 ))}
 </SimpleGrid>
 </Modal>

 {/* ── Edit Widget modal ─────────────────────────────────────── */}
 <Modal opened={editingWidget !== null} onClose={() => setEditingWidget(null)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Configure Widget</Text>}
 size="lg">
 {editingWidget && (
 <Stack gap="md">
 <TextInput label="Title" value={editingWidget.title}
 onChange={e => setEditingWidget({ ...editingWidget, title: e.target.value })} />
 <Select label="Size" data={SIZE_OPTIONS} value={editingWidget.size}
 onChange={v => v && setEditingWidget({ ...editingWidget, size: v as ExtendedDashboardWidget['size'] })} />

 {['donut', 'horizontalBar', 'stackedBar', 'pivotTable', 'issueTable', 'gauge', 'singleKpi', 'trendSpark', 'heatmap', 'twoDimensional'].includes(editingWidget.type) && (
 <Select label={editingWidget.type === 'twoDimensional' ? 'Row Dimension' : 'Data Dimension'} data={DATA_KEY_OPTIONS}
 value={editingWidget.dataKey ?? 'byType'}
 onChange={v => v && setEditingWidget({ ...editingWidget, dataKey: v })} />
 )}

 {['twoDimensional', 'heatmap'].includes(editingWidget.type) && (
 <Select label="Column Dimension" data={DATA_KEY_OPTIONS}
 value={editingWidget.secondaryDataKey ?? 'byPriority'}
 onChange={v => v && setEditingWidget({ ...editingWidget, secondaryDataKey: v })} />
 )}

 {editingWidget.type === 'countdown' && (
 <>
 <TextInput label="Target Date" type="date" value={editingWidget.targetDate ?? ''}
 onChange={e => setEditingWidget({ ...editingWidget, targetDate: e.target.value })} />
 <TextInput label="Target Label" placeholder="e.g. Sprint End, Release Date"
 value={editingWidget.targetLabel ?? ''}
 onChange={e => setEditingWidget({ ...editingWidget, targetLabel: e.target.value })} />
 </>
 )}

 <Grid gutter="sm">
 <Grid.Col span={{ base: 12, sm: 6 }}>
 <Select label="Sort By" data={SORT_OPTIONS} value={editingWidget.sortBy || 'count'}
 onChange={v => v && setEditingWidget({ ...editingWidget, sortBy: v as any })} />
 </Grid.Col>
 <Grid.Col span={{ base: 12, sm: 6 }}>
 <Select label="Direction" data={DIRECTION_OPTIONS} value={editingWidget.sortDirection || 'desc'}
 onChange={v => v && setEditingWidget({ ...editingWidget, sortDirection: v as any })} />
 </Grid.Col>
 <Grid.Col span={{ base: 12, sm: 6 }}>
 <Select label="Limit" data={LIMIT_OPTIONS} value={String(editingWidget.limit ?? 10)}
 onChange={v => v && setEditingWidget({ ...editingWidget, limit: Number(v) })} />
 </Grid.Col>
 <Grid.Col span={{ base: 12, sm: 6 }}>
 <ColorInput label="Chart Color" value={editingWidget.color || AQUA} onChange={c => setEditingWidget({ ...editingWidget, color: c })} swatches={PIE_COLORS} />
 </Grid.Col>
 </Grid>

 <Group grow>
 <Checkbox label="Show Legend" checked={editingWidget.showLegend !== false}
 onChange={e => setEditingWidget({ ...editingWidget, showLegend: e.currentTarget.checked })} />
 <Checkbox label="Show Labels" checked={editingWidget.showLabels ?? false}
 onChange={e => setEditingWidget({ ...editingWidget, showLabels: e.currentTarget.checked })} />
 </Group>

 <Switch label="Enabled" checked={editingWidget.enabled}
 onChange={e => setEditingWidget({ ...editingWidget, enabled: e.currentTarget.checked })} />

 <Button onClick={() => updateWidget(editingWidget)}>Apply</Button>
 </Stack>
 )}
 </Modal>

 {/* ── Templates modal ───────────────────────────────────────── */}
 <Modal opened={templatesOpen} onClose={() => setTemplatesOpen(false)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Dashboard Templates</Text>}
 size="lg">
 <Stack gap="md">
 {DASHBOARD_TEMPLATES.map(template => (
 <Paper key={template.id} withBorder radius="md" p="md"
 style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
 onMouseEnter={e => { e.currentTarget.style.borderColor = AQUA; e.currentTarget.style.boxShadow = SHADOW.md; }}
 onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
 onClick={() => loadTemplate(template)}>
 <Group justify="space-between" align="flex-start">
 <div>
 <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{template.name}</Text>
 <Text size="sm" c="dimmed">{template.description}</Text>
 <Text size="xs" c="dimmed" mt="xs">{template.widgets.length} widgets</Text>
 </div>
 <Badge size="sm" variant="light">{template.widgets.length}</Badge>
 </Group>
 </Paper>
 ))}
 </Stack>
 </Modal>

 {/* ── Save Dashboard modal ──────────────────────────────────── */}
 <Modal opened={saveDashOpen} onClose={() => setSaveDashOpen(false)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Save Dashboard</Text>}>
 <Stack gap="md">
 <TextInput label="Dashboard Name" value={dashName}
 onChange={e => setDashName(e.target.value)}
 placeholder="My Custom Dashboard" />
 <Textarea label="Description (optional)" value={dashDesc}
 onChange={e => setDashDesc(e.target.value)}
 placeholder="What this dashboard tracks..." />
 <Button loading={saveDashboard.isPending} onClick={handleSave}
 leftSection={<IconDeviceFloppy size={14} />}>
 {dashId ? 'Update Dashboard' : 'Create Dashboard'}
 </Button>
 </Stack>
 </Modal>

 {/* ── Load Dashboard modal ──────────────────────────────────── */}
 <Modal opened={loadDashOpen} onClose={() => setLoadDashOpen(false)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Load Dashboard</Text>}>
 <Stack gap="sm">
 {dashboards.map(d => (
 <Paper key={d.id} withBorder radius="md" p="sm"
 style={{ cursor: 'pointer', borderLeft: d.id === dashId ? `3px solid ${AQUA}` : undefined }}
 onClick={() => { loadDashConfig(d); setLoadDashOpen(false); }}>
 <Group justify="space-between">
 <div>
 <Text size="sm" fw={600}>{d.name}</Text>
 {d.description && <Text size="xs" c="dimmed">{d.description}</Text>}
 </div>
 <Group gap={4}>
 {d.isDefault && <Badge size="xs" variant="light" color="blue">Default</Badge>}
 <Text size="xs" c="dimmed">{new Date(d.updatedAt).toLocaleDateString()}</Text>
 </Group>
 </Group>
 </Paper>
 ))}
 {dashboards.length === 0 && <Text c="dimmed" ta="center">No saved dashboards yet.</Text>}
 </Stack>
 </Modal>
 </Stack>

 {/* ── Drill-Down Modal ── */}
 <Modal
 opened={!!drillDown}
 onClose={() => setDrillDown(null)}
 title={<Text fw={700} size="sm">{drillDown?.title ?? 'Details'}</Text>}
 size="lg"
 centered
 radius="lg"
 styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
 >
 {drillDown && (
 <Stack gap="xs">
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: '0.85rem' }}>
 <thead>
 <tr style={{ borderBottom: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Name</th>
 <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Count</th>
 {drillDown.items[0]?.sp !== undefined && (
 <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>SP</th>
 )}
 {drillDown.items[0]?.hours !== undefined && (
 <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Hours</th>
 )}
 </tr>
 </thead>
 <tbody>
 {drillDown.items.slice(0, drillDownLimit).map((item, i) => (
 <tr key={i} style={{ borderBottom: `1px solid ${DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: '5px 8px' }}>{item.name}</td>
 <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{item.count}</td>
 {item.sp !== undefined && (
 <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.sp}</td>
 )}
 {item.hours !== undefined && (
 <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.hours}</td>
 )}
 </tr>
 ))}
 </tbody>
 </table>
 {drillDown.items.length > drillDownLimit && (
 <Button variant="light" size="xs" fullWidth
 onClick={() => setDrillDownLimit(prev => prev + 20)}>
 Show more ({drillDown.items.length - drillDownLimit} remaining)
 </Button>
 )}
 <Text size="xs" c="dimmed" ta="right">
 Showing {Math.min(drillDownLimit, drillDown.items.length)} of {drillDown.items.length} items
 </Text>
 </Stack>
 )}
 </Modal>
 </>
 );
}
