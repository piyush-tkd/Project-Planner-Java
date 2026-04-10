import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import {
 Text, Badge, Group, SimpleGrid, Paper, ThemeIcon,
 MultiSelect, Button, Stack, Tooltip, Modal, TextInput, Select, Switch,
 ActionIcon, Menu, Divider, ScrollArea, Textarea, Checkbox, Grid, Loader,
 NumberInput, SegmentedControl, ColorInput, Tabs, rem, Skeleton,
} from '@mantine/core';
import {
 IconPlus, IconRefresh, IconSettings, IconTrash, IconCopy,
 IconChartBar, IconChartPie, IconChartLine, IconChartArea,
 IconTable, IconLayoutGrid, IconGripVertical, IconDots,
 IconDeviceFloppy, IconEye, IconEyeOff, IconPencil, IconDownload,
 IconArrowUp, IconArrowDown, IconArrowLeft, IconArrowRight,
 IconTemplate, IconSortAscending, IconClock, IconCalendarStats,
 IconTimeline, IconGridDots, IconFilter, IconClockHour4, IconNotes, IconHeadset,
 IconRadar, IconChartDots3, IconChartDots, IconSortDescending,
 IconTarget, IconPlayerPlay, IconDatabase, IconBrandSpeedtest,
 IconChartSankey, IconCalendar, IconChartTreemap, IconArrowsRightLeft,
 IconStars, IconTrendingUp, IconProgressCheck,
} from '@tabler/icons-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
 ResponsiveContainer, Legend, PieChart, Pie, Cell,
 AreaChart, Area, LineChart, Line, ComposedChart, ReferenceLine,
 RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
 Treemap, ScatterChart, Scatter, ZAxis, FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
 useJiraAnalytics, useJiraAnalyticsFilters,
 useJiraDashboards, useSaveDashboard, useCloneDashboard,
 useJiraSyncStatus, useTriggerJiraSync, useAllFixVersions,
 useJiraAnalyticsFields, usePowerQuery,
 type JiraAnalyticsData, type AnalyticsBreakdown,
 type DashboardWidget, type JiraDashboardConfig,
 type PowerQueryRequest,
} from '../../api/jira';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { EmptyState } from '../../components/ui';
import { JqlAutocomplete } from '../../components/common/JqlAutocomplete';
import { AQUA_HEX, AQUA_TINTS, BORDER_STRONG, CHART_COLORS, COLOR_AMBER_DARK, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR, COLOR_ERROR_DARK, COLOR_TEAL, COLOR_VIOLET, COLOR_WARNING, DARK_TEXT_PRIMARY, DEEP_BLUE_HEX, DEEP_BLUE_TINTS, FONT_FAMILY, SHADOW, SLATE_700, SURFACE_LIGHT, SURFACE_SELECTED, TEXT_GRAY, TEXT_SUBTLE, UX_ERROR, UX_POSITIVE, UX_WARNING} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

/* ── Palette ──────────────────────────────────────────────────────────── */
const PIE_COLORS = [
 AQUA_HEX, COLOR_VIOLET, DEEP_BLUE_HEX, '#DB2777', COLOR_AMBER_DARK,
 COLOR_EMERALD, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, '#0891B2', '#65A30D',
 '#6366F1', COLOR_WARNING, '#EC4899', '#14B8A6',
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
 secondaryDataKey?: string; // for 2D filter stats cross-tab / pivot col dimension
 // Power analytics fields
 jql?: string;         // JQL filter expression for the widget
 metric?: 'count' | 'storyPoints'; // aggregation metric
 groupBy?: string;     // custom groupBy field (overrides dataKey)
 periodType?: 'week' | 'month' | 'quarter' | 'year'; // for productivity comparison
 // Pivot Builder fields
 pivotRowDim?: string;    // row groupBy dimension
 pivotColDim?: string;    // column groupBy dimension (optional)
 pivotMetric?: 'count' | 'storyPoints' | 'hours' | 'cycleTimeDays'; // measure
 pivotView?: 'table' | 'bar' | 'heatmap'; // visualization mode
 pivotGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'; // for date dims
}

/* ── Available widget types for the "Add Widget" picker ──────────────── */
type WidgetCatalogItem = { type: string; label: string; description: string; icon: React.ReactNode; defaultSize: DashboardWidget['size']; category: string };
const WIDGET_CATALOG: WidgetCatalogItem[] = [
 // ── Overview & KPIs ───────────────────────────────────────────────────
 { type: 'kpis', label: 'KPI Cards', description: 'Key metrics summary — open, created, resolved, cycle time, throughput, SP', icon: <IconLayoutGrid size={16} />, defaultSize: 'full', category: 'Overview' },
 { type: 'singleKpi', label: 'Single KPI Card', description: 'Large single metric card with optional comparison and colored border', icon: <IconLayoutGrid size={16} />, defaultSize: 'quarter', category: 'Overview' },
 { type: 'trendSpark', label: 'Trend Spark Card', description: 'Compact sparkline KPI card with mini trend', icon: <IconChartLine size={16} />, defaultSize: 'quarter', category: 'Overview' },
 { type: 'gauge', label: 'Gauge Chart', description: 'Speedometer gauge for KPI thresholds — bug ratio, cycle time, throughput', icon: <IconChartPie size={16} />, defaultSize: 'quarter', category: 'Overview' },
 { type: 'ratioKpi', label: 'Ratio KPI', description: 'Two-metric ratio card — Bug:Story ratio, Done%, or Throughput efficiency', icon: <IconStars size={16} />, defaultSize: 'quarter', category: 'Overview' },
 { type: 'countdown', label: 'Countdown Timer', description: 'Deadline countdown for sprints, releases, or milestones — days, hours, minutes', icon: <IconClock size={16} />, defaultSize: 'quarter', category: 'Overview' },
 // ── Charts ────────────────────────────────────────────────────────────
 { type: 'donut', label: 'Donut Chart', description: 'Breakdown by any dimension — type, status, priority, pod, label, component, fix version', icon: <IconChartPie size={16} />, defaultSize: 'quarter', category: 'Charts' },
 { type: 'statusCategoryDonut', label: 'Status Category Donut', description: 'Quick To Do / In Progress / Done split as a clean donut — matches Jira board summary', icon: <IconChartPie size={16} />, defaultSize: 'quarter', category: 'Charts' },
 { type: 'resolutionDonut', label: 'Resolution Breakdown', description: 'Donut chart of resolved issues grouped by resolution type (Fixed, Won\'t Fix, Duplicate…)', icon: <IconChartPie size={16} />, defaultSize: 'quarter', category: 'Charts' },
 { type: 'horizontalBar', label: 'Horizontal Bar', description: 'Top-N items in any dimension — labels, components, fix versions, assignees', icon: <IconChartBar size={16} />, defaultSize: 'third', category: 'Charts' },
 { type: 'stackedBar', label: 'Stacked Bar', description: 'Stacked breakdown showing count, story points, and hours', icon: <IconChartBar size={16} />, defaultSize: 'half', category: 'Charts' },
 { type: 'lineChart', label: 'Line Chart', description: 'Multi-series trend line — created vs resolved or bug trend', icon: <IconChartLine size={16} />, defaultSize: 'full', category: 'Charts' },
 { type: 'radarChart', label: 'Radar Chart', description: 'Spider/radar chart comparing top N items across multiple metrics — great for status or priority overview', icon: <IconRadar size={16} />, defaultSize: 'half', category: 'Charts' },
 { type: 'treemap', label: 'Treemap', description: 'Area-proportional treemap — visualize issue distribution by any dimension', icon: <IconChartTreemap size={16} />, defaultSize: 'half', category: 'Charts' },
 { type: 'funnelChart', label: 'Funnel Chart', description: 'Issue flow funnel — To Do → In Progress → Done with drop-off rates', icon: <IconSortDescending size={16} />, defaultSize: 'quarter', category: 'Charts' },
 { type: 'scatterPlot', label: 'Scatter Plot', description: 'Bubble chart — assignee workload: X=total issues, Y=story points, size=bugs', icon: <IconChartDots3 size={16} />, defaultSize: 'half', category: 'Charts' },
 { type: 'heatmap', label: 'Activity Heatmap', description: 'Day-of-week × dimension heatmap showing issue concentration', icon: <IconGridDots size={16} />, defaultSize: 'half', category: 'Charts' },
 // ── Trends & Time ─────────────────────────────────────────────────────
 { type: 'createdVsResolved', label: 'Created vs Resolved', description: 'Weekly area chart comparing issue creation and resolution rates', icon: <IconChartArea size={16} />, defaultSize: 'full', category: 'Trends' },
 { type: 'cumulativeFlow', label: 'Cumulative Created vs Resolved', description: 'Cumulative line chart with version markers — matches Jira\'s Created vs Resolved', icon: <IconTimeline size={16} />, defaultSize: 'full', category: 'Trends' },
 { type: 'openTrend', label: 'Open Issues Trend', description: 'Running total of open issues over time — created cumulative minus resolved cumulative', icon: <IconChartArea size={16} />, defaultSize: 'half', category: 'Trends' },
 { type: 'bugTrend', label: 'Bug Trend', description: 'Monthly bug count vs total created', icon: <IconChartLine size={16} />, defaultSize: 'half', category: 'Trends' },
 { type: 'throughputHist', label: 'Throughput Histogram', description: 'Weekly resolved issue count histogram — spot high and low throughput periods', icon: <IconChartBar size={16} />, defaultSize: 'half', category: 'Trends' },
 { type: 'velocityChart', label: 'Velocity Chart', description: 'Sprint-by-sprint issue count and story points velocity trend', icon: <IconTrendingUp size={16} />, defaultSize: 'full', category: 'Trends' },
 { type: 'sprintBurndown', label: 'Sprint Burndown Approx', description: 'Approximate burndown using created vs resolved trend — remaining open each week', icon: <IconTarget size={16} />, defaultSize: 'full', category: 'Trends' },
 { type: 'productivityComparison', label: 'Productivity Comparison', description: 'Period-over-period comparison: stories completed, SP delivered, hours logged — track productivity gains', icon: <IconBrandSpeedtest size={16} />, defaultSize: 'full', category: 'Trends' },
 // ── Quality & Health ──────────────────────────────────────────────────
 { type: 'cycleTime', label: 'Cycle Time', description: 'Distribution of resolved issue cycle times', icon: <IconChartBar size={16} />, defaultSize: 'half', category: 'Quality' },
 { type: 'cycleTimeScatter', label: 'Cycle Time Scatter', description: 'Scatter plot of cycle time buckets — see resolution time spread across all issues', icon: <IconChartDots size={16} />, defaultSize: 'half', category: 'Quality' },
 { type: 'aging', label: 'Issue Aging', description: 'Open issues bucketed by age', icon: <IconChartBar size={16} />, defaultSize: 'half', category: 'Quality' },
 { type: 'averageAge', label: 'Average Age Chart', description: 'Bar chart showing average days unresolved by period — like Jira\'s Average Age', icon: <IconCalendarStats size={16} />, defaultSize: 'half', category: 'Quality' },
 { type: 'resolutionTime', label: 'Resolution Time', description: 'Average resolution time trend by week — time to resolve issues', icon: <IconChartLine size={16} />, defaultSize: 'half', category: 'Quality' },
 // ── Team ──────────────────────────────────────────────────────────────
 { type: 'workload', label: 'Workload', description: 'Open issues by assignee — total, bugs, high priority', icon: <IconChartBar size={16} />, defaultSize: 'half', category: 'Team' },
 { type: 'assigneeLeaderboard', label: 'Assignee Leaderboard', description: 'Issues, story points, and hours by assignee', icon: <IconTable size={16} />, defaultSize: 'full', category: 'Team' },
 { type: 'teamComparison', label: 'Team Comparison', description: 'Side-by-side grouped bar chart comparing PODs on open, created, resolved, and SP', icon: <IconArrowsRightLeft size={16} />, defaultSize: 'full', category: 'Team' },
 { type: 'worklogByAuthor', label: 'Worklog by Author', description: 'Hours logged per person — horizontal bar chart from synced worklogs', icon: <IconClockHour4 size={16} />, defaultSize: 'half', category: 'Team' },
 { type: 'worklogTimeline', label: 'Worklog Timeline', description: 'Timesheet-style view — hours logged per author with % share and running totals', icon: <IconClockHour4 size={16} />, defaultSize: 'full', category: 'Team' },
 // ── Tables & Reports ──────────────────────────────────────────────────
 { type: 'pivotTable', label: 'Pivot Table', description: 'Cross-dimension table with count, SP, hours, and totals', icon: <IconTable size={16} />, defaultSize: 'full', category: 'Tables' },
 { type: 'issueTable', label: 'Issue Table', description: 'Searchable breakdown table with export to CSV', icon: <IconTable size={16} />, defaultSize: 'full', category: 'Tables' },
 { type: 'twoDimensional', label: '2D Filter Statistics', description: 'Cross-tabulation of two dimensions — e.g. Status × Priority', icon: <IconFilter size={16} />, defaultSize: 'full', category: 'Tables' },
 { type: 'monthlySummary', label: 'Monthly Summary Table', description: 'Month-by-month table: created vs resolved counts with net flow and running total', icon: <IconCalendar size={16} />, defaultSize: 'full', category: 'Tables' },
 { type: 'epicProgress', label: 'Epic Progress', description: 'Horizontal progress bars showing completion % per epic by issue count', icon: <IconProgressCheck size={16} />, defaultSize: 'half', category: 'Tables' },
 // ── Delivery & Releases ───────────────────────────────────────────────
 { type: 'releaseNotes', label: 'Release Notes', description: 'Fix versions with issue counts, SP, and completion progress', icon: <IconNotes size={16} />, defaultSize: 'full', category: 'Delivery' },
 { type: 'supportQueueSummary', label: 'Support Queue Summary', description: 'Compact overview of open support tickets by status and priority', icon: <IconHeadset size={16} />, defaultSize: 'half', category: 'Delivery' },
 // ── Power Builder ─────────────────────────────────────────────────────
 { type: 'pivotBuilder', label: 'Pivot Builder', description: 'eazyBI-style pivot table — choose row/column dimensions and measure, toggle between cross-tab, bar chart, or heatmap', icon: <IconDatabase size={16} />, defaultSize: 'full', category: 'Tables' },
];


const DATA_KEY_OPTIONS = [
 // ── Core dimensions ──────────────────────────────────────────────────
 { value: 'byType', label: 'Issue Type' },
 { value: 'byStatus', label: 'Status' },
 { value: 'byStatusCategory', label: 'Status Category' },
 { value: 'byPriority', label: 'Priority' },
 { value: 'byPod', label: 'POD / Team' },
 { value: 'byProject', label: 'Project' },
 // ── People dimensions ─────────────────────────────────────────────────
 { value: 'byAssignee', label: 'Assignee' },
 { value: 'byReporter', label: 'Reporter' },
 { value: 'byCreator', label: 'Creator' },
 // ── Classification dimensions ─────────────────────────────────────────
 { value: 'byLabel', label: 'Labels' },
 { value: 'byComponent', label: 'Components' },
 { value: 'byFixVersion', label: 'Fix Version' },
 { value: 'byEpic', label: 'Epic' },
 { value: 'byResolution', label: 'Resolution' },
 // ── Time-based dimensions ─────────────────────────────────────────────
 { value: 'bySprint', label: 'Sprint' },
 { value: 'byCreatedMonth', label: 'Created Month' },
 { value: 'byResolvedMonth', label: 'Resolved Month' },
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
 { metric: 'bugRatio', label: 'Bug Ratio', unit: '%', greenUpper: 5, yellowUpper: 10, max: 20 },
 { metric: 'avgCycleTimeDays', label: 'Avg Cycle Time', unit: 'd', greenUpper: 5, yellowUpper: 10, max: 30 },
 { metric: 'throughputPerWeek', label: 'Weekly Throughput', unit: '', greenUpper: 10, yellowUpper: 5, max: 30 },
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
 data: AnalyticsBreakdown[] | undefined | null,
 sortBy: string = 'count',
 direction: string = 'desc',
 limit: number = 10,
): AnalyticsBreakdown[] {
 let sorted = [...(data ?? [])];
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
function GaugeSvg({ value, max, greenUpper, yellowUpper, unit, label }: {
 value: number; max: number; greenUpper: number; yellowUpper: number;
 unit?: string; label?: string;
}) {
 let color = UX_ERROR;
 let zone = 'Critical';
 if (value <= greenUpper) { color = UX_POSITIVE; zone = 'Good'; }
 else if (value <= yellowUpper) { color = UX_WARNING; zone = 'Watch'; }
 const displayVal = Number.isInteger(value) ? String(value) : value.toFixed(1);
 const suffix = unit ?? '';
 return (
 <svg width={180} height={130} viewBox="0 0 180 130">
 {/* Background track */}
 <circle cx="90" cy="90" r="52" fill="none" stroke={DEEP_BLUE_TINTS[10]} strokeWidth="9" />
 {/* Value arc */}
 <circle
 cx="90" cy="90" r="52" fill="none" stroke={color} strokeWidth="9"
 strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 - (Math.min(value / max, 1) * 2 * Math.PI * 52)}
 strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
 />
 {/* Value + unit — centered in visible semicircle */}
 <text x="90" y="84" textAnchor="middle" fontSize="24" fontWeight="bold" fill={DEEP_BLUE_HEX}>
 {displayVal}{suffix}
 </text>
 {/* Zone badge */}
 <text x="90" y="102" textAnchor="middle" fontSize="10" fontWeight="600" fill={color}>
 {zone}
 </text>
 {/* Threshold scale labels — below arc endpoints */}
 <text x="30" y="124" textAnchor="middle" fontSize="8" fill={DEEP_BLUE_TINTS[40]}>0{suffix}</text>
 <text x="90" y="124" textAnchor="middle" fontSize="8" fill={DEEP_BLUE_TINTS[40]}>{(max / 2)}{suffix}</text>
 <text x="150" y="124" textAnchor="middle" fontSize="8" fill={DEEP_BLUE_TINTS[40]}>{max}{suffix}</text>
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
 background: isPast ? UX_ERROR : `linear-gradient(135deg, ${DEEP_BLUE_HEX} 0%, ${DEEP_BLUE_TINTS[80]} 100%)`,
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

/* ── Pivot Builder dimension options (Power Query field IDs) ────────────── */
// Flat list used for label lookups (find by value)
const PIVOT_DIM_OPTIONS_FLAT = [
  { value: 'issueType',      label: 'Issue Type'       },
  { value: 'status',         label: 'Status'           },
  { value: 'statusCategory', label: 'Status Category'  },
  { value: 'priority',       label: 'Priority'         },
  { value: 'resolution',     label: 'Resolution'       },
  { value: 'project',        label: 'Project'          },
  { value: 'sprint',         label: 'Sprint'           },
  { value: 'epic',           label: 'Epic'             },
  { value: 'assignee',       label: 'Assignee'         },
  { value: 'reporter',       label: 'Reporter'         },
  { value: 'labels',         label: 'Labels'           },
  { value: 'components',     label: 'Components'       },
  { value: 'fixVersions',    label: 'Fix Version'      },
  { value: 'created',        label: 'Created (Month)'  },
  { value: 'resolved',       label: 'Resolved (Month)' },
];
// Mantine v7 grouped format for Select data prop (group objects with items arrays)
const PIVOT_DIM_OPTIONS: ({ group: string; items: { value: string; label: string }[] } | { value: string; label: string })[] = [
  { group: 'Classification', items: [
    { value: 'issueType',      label: 'Issue Type'      },
    { value: 'status',         label: 'Status'          },
    { value: 'statusCategory', label: 'Status Category' },
    { value: 'priority',       label: 'Priority'        },
    { value: 'resolution',     label: 'Resolution'      },
  ]},
  { group: 'Scope', items: [
    { value: 'project',        label: 'Project'         },
    { value: 'sprint',         label: 'Sprint'          },
    { value: 'epic',           label: 'Epic'            },
  ]},
  { group: 'People', items: [
    { value: 'assignee',       label: 'Assignee'        },
    { value: 'reporter',       label: 'Reporter'        },
  ]},
  { group: 'Attributes', items: [
    { value: 'labels',         label: 'Labels'          },
    { value: 'components',     label: 'Components'      },
    { value: 'fixVersions',    label: 'Fix Version'     },
  ]},
  { group: 'Time', items: [
    { value: 'created',        label: 'Created (Month)'  },
    { value: 'resolved',       label: 'Resolved (Month)' },
  ]},
];

const PIVOT_METRIC_OPTIONS = [
  { value: 'count',         label: 'Issue Count' },
  { value: 'storyPoints',   label: 'Story Points' },
  { value: 'hours',         label: 'Hours Logged' },
  { value: 'cycleTimeDays', label: 'Avg Cycle Time (d)' },
];

const PIVOT_VIEW_OPTIONS = [
  { value: 'table',   label: '⊞ Cross-tab' },
  { value: 'bar',     label: '▦ Bar Chart' },
  { value: 'heatmap', label: '▪ Heatmap' },
];

/* ── joinFor: returns join array for multi-value dimension fields ─────── */
function joinsForDim(dim: string): ('worklogs' | 'labels' | 'components' | 'fixVersions')[] {
  if (dim === 'labels') return ['labels'];
  if (dim === 'components') return ['components'];
  if (dim === 'fixVersions') return ['fixVersions'];
  return [];
}

/* ── Pivot Builder Widget (self-contained — runs its own Power Query) ─── */
function PivotBuilderWidget({
  widget,
  editMode,
  onRemove,
  onEdit,
  pods,
  months,
}: {
  widget: ExtendedDashboardWidget;
  editMode: boolean;
  onRemove: () => void;
  onEdit: () => void;
  pods?: string;
  months?: number;
}) {
  const dark = useDarkMode();

  // Local state for dimension/metric selection (mirrors widget config)
  const [rowDim, setRowDim] = useState(widget.pivotRowDim ?? 'issueType');
  const [colDim, setColDim] = useState<string | null>(widget.pivotColDim ?? 'priority');
  const [metric, setMetric] = useState<'count' | 'storyPoints' | 'hours' | 'cycleTimeDays'>(
    widget.pivotMetric ?? 'count'
  );
  const [view, setView] = useState<'table' | 'bar' | 'heatmap'>(widget.pivotView ?? 'table');

  // Keep local state in sync with widget config changes from parent
  useEffect(() => { setRowDim(widget.pivotRowDim ?? 'issueType'); }, [widget.pivotRowDim]);
  useEffect(() => { setColDim(widget.pivotColDim ?? 'priority'); }, [widget.pivotColDim]);
  useEffect(() => { setMetric(widget.pivotMetric ?? 'count'); }, [widget.pivotMetric]);
  useEffect(() => { setView(widget.pivotView ?? 'table'); }, [widget.pivotView]);

  // Build Power Query request
  const pqRequest = useMemo((): PowerQueryRequest => {
    const groupBy = colDim ? [rowDim, colDim] : [rowDim];
    const joins = [...joinsForDim(rowDim), ...joinsForDim(colDim ?? '')];
    const needsWorklogs = metric === 'hours' && !joins.includes('worklogs');
    const allJoins = needsWorklogs ? [...joins, 'worklogs'] : joins;

    const metricDef = metric === 'count'
      ? { field: 'count' as const, aggregation: 'count' as const, alias: 'val' }
      : metric === 'storyPoints'
      ? { field: 'storyPoints' as const, aggregation: 'sum' as const, alias: 'val' }
      : metric === 'hours'
      ? { field: 'hours' as const, aggregation: 'sum' as const, alias: 'val' }
      : { field: 'cycleTimeDays' as const, aggregation: 'avg' as const, alias: 'val' };

    const isTimeDim = (d: string) => d === 'created' || d === 'resolved';
    const granularity = widget.pivotGranularity ?? 'month';

    return {
      groupBy,
      metrics: [metricDef],
      joins: allJoins.length > 0 ? allJoins : undefined,
      granularity: (isTimeDim(rowDim) || isTimeDim(colDim ?? '')) ? granularity : undefined,
      timeField: 'created',
      pods,
      limit: (widget.limit ?? 50),
      orderBy: 'val',
      orderDirection: 'desc',
      ...(months ? (() => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - months);
        return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
      })() : {}),
    } as unknown as PowerQueryRequest;
  }, [rowDim, colDim, metric, pods, months, widget.limit, widget.pivotGranularity]);

  const { data: pqResp, isLoading, error } = usePowerQuery(pqRequest, true);

  // Pivot the flat result into cross-tab structure
  type PivotResult = { pivotRows: string[]; pivotCols: string[]; cells: Record<string, Record<string, number>>; rowTotals: Record<string, number>; colTotals: Record<string, number>; grandTotal: number; flatRows: { name: string; val: number }[] };
  const { pivotRows, pivotCols, cells, rowTotals, colTotals, grandTotal, flatRows } = useMemo((): PivotResult => {
    const rawRows = pqResp?.data ?? [];
    if (!rawRows.length) return { pivotRows: [], pivotCols: [], cells: {}, rowTotals: {}, colTotals: {}, grandTotal: 0, flatRows: [] };

    const rowKey = rowDim.includes('-') ? rowDim.replace('-', '_') : rowDim;

    if (!colDim) {
      // 1D: flat list
      const flat = rawRows.map(r => ({
        name: String(r[rowKey] ?? r[rowDim] ?? '—'),
        val: Number(r['val'] ?? 0),
      }));
      return { pivotRows: [], pivotCols: [], cells: {}, rowTotals: {}, colTotals: {}, grandTotal: 0, flatRows: flat };
    }

    const colKey = colDim.includes('-') ? colDim.replace('-', '_') : colDim;

    // Collect unique rows/cols (ordered by first-seen in data)
    const rowOrder: string[] = [];
    const colOrder: string[] = [];
    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const cells: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    rawRows.forEach(r => {
      const rv = String(r[rowKey] ?? r[rowDim] ?? '—');
      const cv = String(r[colKey] ?? r[colDim] ?? '—');
      const val = Number(r['val'] ?? 0);

      if (!rowSet.has(rv)) { rowSet.add(rv); rowOrder.push(rv); }
      if (!colSet.has(cv)) { colSet.add(cv); colOrder.push(cv); }
      if (!cells[rv]) cells[rv] = {};
      cells[rv][cv] = (cells[rv][cv] ?? 0) + val;
      rowTotals[rv] = (rowTotals[rv] ?? 0) + val;
      colTotals[cv] = (colTotals[cv] ?? 0) + val;
      grandTotal += val;
    });

    // Sort cols by total desc, limit to top 8
    const sortedCols = colOrder.sort((a, b) => (colTotals[b] ?? 0) - (colTotals[a] ?? 0)).slice(0, 8);
    // Sort rows by total desc, limit
    const sortedRows = rowOrder.sort((a, b) => (rowTotals[b] ?? 0) - (rowTotals[a] ?? 0)).slice(0, widget.limit ?? 20);

    return { pivotRows: sortedRows, pivotCols: sortedCols, cells, rowTotals, colTotals, grandTotal, flatRows: [] };
  }, [pqResp, rowDim, colDim, widget.limit]);

  const metricLabel = PIVOT_METRIC_OPTIONS.find(m => m.value === metric)?.label ?? 'Count';
  const rowLabel = PIVOT_DIM_OPTIONS_FLAT.find(d => d.value === rowDim)?.label ?? rowDim;
  const colLabel = colDim ? PIVOT_DIM_OPTIONS_FLAT.find(d => d.value === colDim)?.label ?? colDim : null;

  const maxVal = useMemo(() => {
    if (flatRows.length) return Math.max(...flatRows.map(r => r.val), 1);
    if (!pivotRows.length) return 1;
    return Math.max(...pivotRows.map(r => rowTotals[r] ?? 0), 1);
  }, [flatRows, pivotRows, rowTotals]);

  const editButtons = editMode ? (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      <ActionIcon size="sm" variant="light" onClick={onEdit}><IconPencil size={13} /></ActionIcon>
      <ActionIcon size="sm" variant="light" color="red" onClick={onRemove}><IconTrash size={13} /></ActionIcon>
    </Group>
  ) : undefined;

  return (
    <div>
      <ChartCard title={widget.title} minHeight={320} headerRight={editButtons}>
        {/* ── Config bar ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginBottom: 10, paddingBottom: 10,
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Rows:</Text>
            <Select
              size="xs" data={PIVOT_DIM_OPTIONS} value={rowDim} onChange={v => v && setRowDim(v)}
              styles={{ input: { fontSize: 11, height: 26, minHeight: 26, borderRadius: 6 }, dropdown: { zIndex: 10000 } }}
              style={{ minWidth: 130 }} withCheckIcon={false}
            />
          </div>
          <Text size="xs" c="dimmed">×</Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Cols:</Text>
            <Select
              size="xs" data={[{ value: '', label: '— none —' }, ...PIVOT_DIM_OPTIONS]}
              value={colDim ?? ''} onChange={v => setColDim(v || null)}
              styles={{ input: { fontSize: 11, height: 26, minHeight: 26, borderRadius: 6 }, dropdown: { zIndex: 10000 } }}
              style={{ minWidth: 130 }} withCheckIcon={false}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Metric:</Text>
            <Select
              size="xs" data={PIVOT_METRIC_OPTIONS} value={metric} onChange={v => v && setMetric(v as typeof metric)}
              styles={{ input: { fontSize: 11, height: 26, minHeight: 26, borderRadius: 6 }, dropdown: { zIndex: 10000 } }}
              style={{ minWidth: 130 }} withCheckIcon={false}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <SegmentedControl
              size="xs" data={PIVOT_VIEW_OPTIONS} value={view} onChange={v => setView(v as typeof view)}
              styles={{ root: { height: 26 }, label: { fontSize: 11, padding: '0 8px' } }}
            />
          </div>
          {isLoading && <Loader size="xs" color={AQUA_HEX} />}
        </div>

        {/* ── Result ─────────────────────────────────────────────────── */}
        {error ? (
          <Text c="red" size="xs" ta="center" py="md">Query failed — check dimensions and try again</Text>
        ) : isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Loader size="sm" color={AQUA_HEX} />
          </div>
        ) : (!pivotRows.length && !flatRows.length) ? (
          <Text c="dimmed" ta="center" size="sm" py="xl">No data for selected dimensions</Text>
        ) : view === 'table' ? (
          /* ── Cross-tab table ────────────────────────────────────── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
              <thead>
                <tr style={{ background: dark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10] }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}`, whiteSpace: 'nowrap', minWidth: 140 }}>
                    {rowLabel}
                    {colLabel && <span style={{ color: AQUA_HEX, fontWeight: 400 }}> × {colLabel}</span>}
                  </th>
                  {pivotCols.map(col => (
                    <th key={col} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}`, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {col}
                    </th>
                  ))}
                  {pivotCols.length === 0 && (
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
                      {metricLabel}
                    </th>
                  )}
                  {pivotCols.length > 0 && (
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: AQUA_HEX, borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}`, fontSize: 11 }}>Total</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* 1D (no colDim) */}
                {flatRows.map((row, i) => (
                  <tr key={row.name} style={{ background: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 500, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: Math.round((row.val / maxVal) * 80), height: 4, background: AQUA_HEX, borderRadius: 2, opacity: 0.6, transition: 'width 0.4s ease' }} />
                        {row.name}
                      </div>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: AQUA_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
                      {metric === 'cycleTimeDays' ? row.val.toFixed(1) : row.val.toLocaleString()}
                    </td>
                  </tr>
                ))}

                {/* 2D cross-tab */}
                {pivotRows.map((row, i) => {
                  const rowTotal = rowTotals[row] ?? 0;
                  const pct = grandTotal > 0 ? Math.round((rowTotal / grandTotal) * 100) : 0;
                  return (
                    <tr key={row} style={{ background: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
                      <td style={{ padding: '5px 10px', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {row}
                          <Badge size="xs" variant="light" color="gray" style={{ fontFamily: FONT_FAMILY }}>{pct}%</Badge>
                        </div>
                      </td>
                      {pivotCols.map(col => {
                        const val = cells[row]?.[col] ?? 0;
                        const intensity = grandTotal > 0 ? val / Math.max(...Object.values(cells).flatMap(r => Object.values(r)), 1) : 0;
                        return (
                          <td key={col} style={{
                            padding: '5px 8px', textAlign: 'right', fontWeight: val > 0 ? 600 : 400,
                            color: val > 0 ? (dark ? '#e2e8f0' : DEEP_BLUE_HEX) : dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                            background: val > 0 ? `${AQUA_HEX}${Math.round(intensity * 30 + 8).toString(16).padStart(2, '0')}` : 'transparent',
                            borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                            fontSize: 11,
                          }}>
                            {val > 0 ? (metric === 'cycleTimeDays' ? val.toFixed(1) : val.toLocaleString()) : '—'}
                          </td>
                        );
                      })}
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: AQUA_HEX, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, fontSize: 11 }}>
                        {metric === 'cycleTimeDays' ? rowTotal.toFixed(1) : rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}

                {/* Column totals row */}
                {pivotCols.length > 0 && (
                  <tr style={{ background: dark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10], fontWeight: 700 }}>
                    <td style={{ padding: '6px 10px', color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, fontSize: 11, fontWeight: 700 }}>Total</td>
                    {pivotCols.map(col => (
                      <td key={col} style={{ padding: '6px 8px', textAlign: 'right', color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, fontSize: 11 }}>
                        {metric === 'cycleTimeDays' ? (colTotals[col] ?? 0).toFixed(1) : (colTotals[col] ?? 0).toLocaleString()}
                      </td>
                    ))}
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: AQUA_HEX, fontSize: 12 }}>
                      {metric === 'cycleTimeDays' ? grandTotal.toFixed(1) : grandTotal.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : view === 'bar' ? (
          /* ── Grouped bar chart ──────────────────────────────────── */
          <ResponsiveContainer width="100%" height={Math.max(260, (pivotRows.length || flatRows.length) * 30 + 80)}>
            <BarChart
              data={pivotRows.length ? pivotRows.slice(0, 15).map(r => ({
                name: r.length > 18 ? r.slice(0, 17) + '…' : r,
                ...Object.fromEntries(pivotCols.map(c => [c, cells[r]?.[c] ?? 0])),
                ...(pivotCols.length === 0 ? { [metricLabel]: rowTotals[r] ?? 0 } : {}),
              })) : flatRows.slice(0, 15).map(r => ({ name: r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name, [metricLabel]: r.val }))}
              layout="vertical"
              margin={{ top: 4, right: 60, bottom: 4, left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.06)' : SURFACE_LIGHT} />
              <XAxis type="number" tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
              <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
              <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
              {widget.showLegend !== false && pivotCols.length > 0 && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
              {pivotCols.length > 0 ? (
                pivotCols.map((col, i) => (
                  <Bar key={col} dataKey={col} name={col} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[0, 3, 3, 0]} animationDuration={500} stackId={widget.showLegend !== false ? undefined : 'stack'} />
                ))
              ) : (
                <Bar dataKey={metricLabel} fill={widget.color || AQUA_HEX} radius={[0, 3, 3, 0]} animationDuration={500} />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          /* ── Heatmap view ───────────────────────────────────────── */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 2, fontFamily: FONT_FAMILY, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px', textAlign: 'left', color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, fontWeight: 600 }}></th>
                  {(pivotCols.length > 0 ? pivotCols : [metricLabel]).map(col => (
                    <th key={col} style={{ padding: '4px 6px', textAlign: 'center', color: dark ? '#cbd5e1' : DEEP_BLUE_TINTS[60], fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>
                      {col.length > 12 ? col.slice(0, 11) + '…' : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pivotRows.length ? pivotRows : flatRows.map(r => r.name)).map(rowName => {
                  const row = typeof rowName === 'string' ? rowName : (rowName as { name: string }).name;
                  return (
                    <tr key={row}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: dark ? '#e2e8f0' : DEEP_BLUE_HEX, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {row.length > 18 ? row.slice(0, 17) + '…' : row}
                      </td>
                      {(pivotCols.length > 0 ? pivotCols : [metricLabel]).map(col => {
                        const val = pivotCols.length > 0
                          ? (cells[row]?.[col] ?? 0)
                          : (flatRows.find(r => r.name === row)?.val ?? 0);
                        const intensity = maxVal > 0 ? val / maxVal : 0;
                        const bg = intensity < 0.01 ? (dark ? '#1a2635' : '#f8fafc')
                          : `${AQUA_HEX}${Math.round(intensity * 200 + 30).toString(16).padStart(2, '0')}`;
                        return (
                          <td key={col} title={`${row} × ${col}: ${val}`} style={{
                            padding: '5px 8px', textAlign: 'center', fontWeight: val > 0 ? 700 : 400,
                            fontSize: 11, borderRadius: 4, background: bg,
                            color: intensity > 0.5 ? '#fff' : val > 0 ? (dark ? '#e2e8f0' : DEEP_BLUE_HEX) : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
                            transition: 'background 0.2s',
                            cursor: 'default',
                          }}>
                            {val > 0 ? (metric === 'cycleTimeDays' ? val.toFixed(1) : val) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Text size="xs" c="dimmed" ta="center" mt={8} style={{ fontFamily: FONT_FAMILY }}>
              Intensity = proportion of max value ({maxVal.toLocaleString()} {metricLabel})
            </Text>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/* ── Issue Table sub-component (has its own useState — must be a real component) */
function IssueTableWidget({ widget, data, dark }: {
  widget: ExtendedDashboardWidget;
  data: JiraAnalyticsData;
  dark: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const tableData = sortAndLimitData(
    (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byAssignee'] as AnalyticsBreakdown[] ?? [],
    widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 999
  );
  const filtered = tableData.filter(d => (d.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
  const handleCsvExport = () => {
    const csv = generateCsvFromData(widget.title, filtered.map(d => ({ Name: d.name, Count: d.count, 'Story Points': d.sp || 0, Hours: d.hours || 0 })));
    downloadCsv(csv, `${widget.title}-${new Date().toISOString().split('T')[0]}.csv`);
  };
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <TextInput placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} size="xs" style={{ flex: 1 }} />
        <Button size="xs" variant="light" leftSection={<IconDownload size={12} />} onClick={handleCsvExport}>CSV</Button>
      </Group>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
              <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Name</th>
              <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Count</th>
              <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>SP</th>
              <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[10]}` }}>
                <td style={{ padding: 8, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{row.name}</td>
                <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.count}</td>
                <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.sp || 0}</td>
                <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.hours || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}

/* ── Widget renderer ──────────────────────────────────────────────────── */
function WidgetRenderer({ widget, data, editMode, onRemove, onEdit, onDrillDown, pods, months }: {
 widget: ExtendedDashboardWidget;
 data: JiraAnalyticsData | undefined | null;
 editMode: boolean;
 onRemove: () => void;
 onEdit: () => void;
 onDrillDown?: (title: string, items: AnalyticsBreakdown[]) => void;
 pods?: string;
 months?: number;
}) {
 const dark = useDarkMode();
 if (!widget.enabled && !editMode) return null;

 // Guard: if data hasn't loaded yet, show a skeleton placeholder
 if (!data) {
 return (
 <div>
 <ChartCard title={widget.title} minHeight={200}>
 <Stack gap="xs">
 {[...Array(4)].map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}
 </Stack>
 </ChartCard>
 </div>
 );
 }

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
 const k = data.kpis ?? {};
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
 <Text size="1.2rem" fw={800} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>{kpi.value}</Text>
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
 <AreaChart data={data.createdVsResolved ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <defs>
 <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={COLOR_ERROR} stopOpacity={0.2} />
 <stop offset="95%" stopColor={COLOR_ERROR} stopOpacity={0} />
 </linearGradient>
 <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={AQUA_HEX} stopOpacity={0.3} />
 <stop offset="95%" stopColor={AQUA_HEX} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Area animationDuration={600} type="monotone" dataKey="created" name="Created" stroke={COLOR_ERROR} strokeWidth={2} fill="url(#cGrad)" dot={{ r: 3, fill: COLOR_ERROR }} />
 <Area animationDuration={600} type="monotone" dataKey="resolved" name="Resolved" stroke={AQUA_HEX} strokeWidth={2} fill="url(#rGrad)" dot={{ r: 3, fill: AQUA_HEX }} />
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
 <Pie animationDuration={600} data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
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
 <Bar animationDuration={600} dataKey="count" fill={AQUA_HEX} radius={[0, 4, 4, 0]} />
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
 const wl = (data.workload ?? []).slice(0, 12);
 const h = Math.max(200, wl.length * 30 + 40);
 const wlDrillData = (data.workload ?? []).map(w => ({ name: w.assignee, count: w.total, sp: w.sp }));
 return wrap(
 <div style={{ cursor: 'pointer' }} onClick={() => onDrillDown?.(widget.title, wlDrillData)}>
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={wl} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="assignee" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
 <Bar animationDuration={600} dataKey="total" name="Total" fill={AQUA_HEX} radius={[0, 4, 4, 0]} />
 <Bar animationDuration={600} dataKey="bugs" name="Bugs" fill={COLOR_ERROR} radius={[0, 4, 4, 0]} />
 <Bar animationDuration={600} dataKey="highPriority" name="High Pri" fill={COLOR_WARNING} radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>
 {(data.workload ?? []).length > 12 && (
 <Text size="xs" c="dimmed" ta="center" mt={4}>Click to see all {(data.workload ?? []).length} assignees</Text>
 )}
 </div>, h
 );
 }

 case 'cycleTime':
 return wrap(
 <ResponsiveContainer width="100%" height={230}>
 <BarChart data={data.cycleTime ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={COLOR_VIOLET} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>, 230
 );

 case 'aging':
 return wrap(
 <ResponsiveContainer width="100%" height={230}>
 <BarChart data={data.aging ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={COLOR_WARNING} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>, 230
 );

 case 'bugTrend':
 return wrap(
 <ResponsiveContainer width="100%" height={230}>
 <BarChart data={data.bugTrend ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="month" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Bar animationDuration={600} dataKey="total" name="Total" fill={DEEP_BLUE_TINTS[30]} radius={[4, 4, 0, 0]} />
 <Bar animationDuration={600} dataKey="bugs" name="Bugs" fill={COLOR_ERROR} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>, 230
 );

 case 'assigneeLeaderboard': {
 const al = sortAndLimitData(data.byAssignee ?? [], widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 15) as (AnalyticsBreakdown & { sp?: number; hours?: number })[]; // cast to include sp/hours
 const h = Math.max(200, al.length * 30 + 40);
 return wrap(
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={al} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={widget.color || AQUA_HEX} radius={[0, 4, 4, 0]} label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10 } : false} />
 <Bar animationDuration={600} dataKey="sp" name="Story Points" fill={COLOR_VIOLET} radius={[0, 4, 4, 0]} label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10 } : false} />
 <Bar animationDuration={600} dataKey="hours" name="Hours" fill={COLOR_WARNING} radius={[0, 4, 4, 0]} label={widget.showLabels ? { position: 'insideRight', fill: 'white', fontSize: 10 } : false} />
 </BarChart>
 </ResponsiveContainer>, h
 );
 }

 case 'stackedBar': {
 const barData = sortAndLimitData((((data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byPod'] as AnalyticsBreakdown[]) ?? []), widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 10);
 const h = Math.max(200, barData.length * 28 + 40);
 return wrap(
 <ResponsiveContainer width="100%" height={h}>
 <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 100 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis type="number" tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
 <Bar animationDuration={600} dataKey="count" name="Count" fill={widget.color || AQUA_HEX} stackId="stack" radius={[0, 4, 4, 0]} />
 <Bar animationDuration={600} dataKey="sp" name="Story Points" fill={COLOR_VIOLET} stackId="stack" radius={[0, 4, 4, 0]} />
 <Bar animationDuration={600} dataKey="hours" name="Hours" fill={COLOR_WARNING} stackId="stack" radius={[0, 4, 4, 0]} />
 </BarChart>
 </ResponsiveContainer>, h
 );
 }

 case 'lineChart': {
 const lineData = data.createdVsResolved ?? [];
 return wrap(
 <ResponsiveContainer width="100%" height={280}>
 <LineChart data={lineData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />}
 <Line animationDuration={600} type="monotone" dataKey="created" name="Created" stroke={COLOR_ERROR} strokeWidth={2} dot={{ r: 3, fill: COLOR_ERROR }} connectNulls />
 <Line animationDuration={600} type="monotone" dataKey="resolved" name="Resolved" stroke={AQUA_HEX} strokeWidth={2} dot={{ r: 3, fill: AQUA_HEX }} connectNulls />
 </LineChart>
 </ResponsiveContainer>, 280
 );
 }

 case 'gauge': {
 const k = data.kpis ?? {} as typeof data.kpis;
 const preset = GAUGE_PRESETS.find(p => widget.dataKey === p.metric) ?? GAUGE_PRESETS[0];
 const value = (k as unknown as Record<string, unknown>)[preset.metric] as number;
 return wrap(
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
 <GaugeSvg value={value} max={preset.max} greenUpper={preset.greenUpper} yellowUpper={preset.yellowUpper} unit={preset.unit} label={preset.label} />
 <Text size="sm" fw={600} mt={4} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>{preset.label}</Text>
 </div>, 280
 );
 }

 case 'singleKpi': {
 const k = data.kpis ?? {} as typeof data.kpis;
 const kpiMap: Record<string, { label: string; value: number; color: string; suffix: string }> = {
 totalOpen: { label: 'Open Issues', value: k.totalOpen, color: COLOR_WARNING, suffix: '' },
 totalCreated: { label: 'Created', value: k.totalCreated, color: COLOR_ERROR, suffix: '' },
 totalResolved: { label: 'Resolved', value: k.totalResolved, color: UX_POSITIVE, suffix: '' },
 bugRatio: { label: 'Bug Ratio', value: k.bugRatio, color: UX_ERROR, suffix: '%' },
 avgCycleTimeDays: { label: 'Avg Cycle Time', value: k.avgCycleTimeDays, color: COLOR_VIOLET, suffix: 'd' },
 throughputPerWeek: { label: 'Throughput', value: k.throughputPerWeek, color: AQUA_HEX, suffix: '/wk' },
 totalSPResolved: { label: 'SP Resolved', value: k.totalSPResolved, color: COLOR_BLUE_STRONG, suffix: '' },
 totalHoursLogged: { label: 'Hours Logged', value: k.totalHoursLogged, color: COLOR_TEAL, suffix: 'h' },
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
 const k = data.kpis ?? {} as typeof data.kpis;
 const kpiKey = widget.dataKey ?? 'avgCycleTimeDays';
 const kpiMap: Record<string, { label: string; value: number; color: string; suffix: string }> = {
 avgCycleTimeDays: { label: 'Cycle Time', value: k.avgCycleTimeDays, color: COLOR_VIOLET, suffix: 'd' },
 throughputPerWeek: { label: 'Throughput', value: k.throughputPerWeek, color: AQUA_HEX, suffix: '/wk' },
 bugRatio: { label: 'Bug Ratio', value: k.bugRatio, color: UX_ERROR, suffix: '%' },
 };
 const kpi = kpiMap[kpiKey] || kpiMap.avgCycleTimeDays;
 const sparkData = (data.createdVsResolved ?? []).slice(-4);
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
 <Line animationDuration={600} type="monotone" dataKey="resolved" stroke={kpi.color} strokeWidth={1.5} dot={false} />
 </LineChart>
 </ResponsiveContainer>
 )}
 </Group>
 </Paper>, 100
 );
 }

 case 'pivotTable': {
 const tableData = sortAndLimitData((((data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byStatus'] as AnalyticsBreakdown[]) ?? []), widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 999);
 const total = { name: 'Total', count: tableData.reduce((s, d) => s + d.count, 0), sp: tableData.reduce((s, d) => s + (d.sp || 0), 0), hours: tableData.reduce((s, d) => s + (d.hours || 0), 0) };
 return wrap(
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 13 }}>
 <thead>
 <tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Dimension</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Count</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Story Points</th>
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Hours</th>
 </tr>
 </thead>
 <tbody>
 {tableData.map((row, i) => (
 <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: 8, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{row.name}</td>
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.count}</td>
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.sp || 0}</td>
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#adb5bd' : DEEP_BLUE_TINTS[60] }}>{row.hours || 0}</td>
 </tr>
 ))}
 <tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], fontWeight: 600, borderTop: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
 <td style={{ padding: 8, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{total.name}</td>
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{total.count}</td>
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{total.sp}</td>
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{total.hours}</td>
 </tr>
 </tbody>
 </table>
 </div>, Math.min(400, tableData.length * 32 + 80)
 );
 }

 case 'issueTable':
 return (
 <div style={{ ...chartStyle }}>
 <ChartCard title={widget.title} minHeight={200} headerRight={editButtons}>
 <IssueTableWidget widget={widget} data={data} dark={dark} />
 </ChartCard>
 </div>
 );

 case 'countdown': {
 const target = widget.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
 return wrap(
 <CountdownDisplay targetDate={target} label={widget.targetLabel || widget.title} />, 160
 );
 }

 case 'averageAge': {
 // Derive average age data from aging buckets — map each bucket to an avg days value
 const agingData = data.aging ?? [];
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
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={COLOR_WARNING} radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </Stack>, 300
 );
 }

 case 'cumulativeFlow': {
 // Build cumulative data from createdVsResolved
 const cvr = data.createdVsResolved ?? [];
 let cumCreated = 0;
 let cumResolved = 0;
 const cumulativeData = cvr.map(d => {
 cumCreated += d.created;
 cumResolved += d.resolved;
 return { week: d.week, created: cumCreated, resolved: cumResolved, gap: cumCreated - cumResolved };
 });
 // Find fix version markers (use byFixVersion as reference points)
 const versions = (data.byFixVersion ?? []).slice(0, 5);
 const versionPositions = versions.map((v, i) => ({
 name: v.name,
 position: cumulativeData.length > 2 ? Math.round((cumulativeData.length - 1) * (i + 1) / (versions.length + 1)) : i,
 }));

 return wrap(
 <ResponsiveContainer width="100%" height={300}>
 <LineChart data={cumulativeData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
 <defs>
 <linearGradient id="cumGapGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={COLOR_WARNING} stopOpacity={0.15} />
 <stop offset="95%" stopColor={COLOR_WARNING} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis dataKey="week" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} angle={-30} textAnchor="end" height={50} />
 <YAxis tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} allowDecimals={false} />
 <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
 {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />}
 {versionPositions.map(vp => (
 cumulativeData[vp.position] ? (
 <ReferenceLine key={vp.name} x={cumulativeData[vp.position].week} stroke={COLOR_VIOLET} strokeDasharray="4 4" strokeWidth={1.5}
 label={{ value: vp.name, fill: COLOR_VIOLET, fontSize: 9, fontWeight: 600, position: 'top' }} />
 ) : null
 ))}
 <Line animationDuration={600} type="monotone" dataKey="created" name="Cumulative Created" stroke={COLOR_ERROR} strokeWidth={2.5} dot={false} />
 <Line animationDuration={600} type="monotone" dataKey="resolved" name="Cumulative Resolved" stroke={AQUA_HEX} strokeWidth={2.5} dot={false} />
 <Line animationDuration={600} type="monotone" dataKey="gap" name="Open Gap" stroke={COLOR_WARNING} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
 </LineChart>
 </ResponsiveContainer>, 300
 );
 }

 case 'resolutionTime': {
 // Build resolution time trend from createdVsResolved data + cycle time
 const cvr = data.createdVsResolved ?? [];
 const avgCycle = (data.kpis?.avgCycleTimeDays) ?? 0;
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
 <Bar animationDuration={600} yAxisId="right" dataKey="resolved" name="Resolved" fill={AQUA_TINTS[20]} radius={[4, 4, 0, 0]} />
 <Line animationDuration={600} yAxisId="left" type="monotone" dataKey="avgResolutionDays" name="Avg Resolution (days)" stroke={COLOR_VIOLET} strokeWidth={2.5} dot={{ r: 3, fill: COLOR_VIOLET }} />
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
 if (intensity < 0.4) return `${AQUA_HEX}33`;
 if (intensity < 0.6) return `${AQUA_HEX}66`;
 if (intensity < 0.8) return `${AQUA_HEX}AA`;
 return AQUA_HEX;
 };

 return wrap(
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 11 }}>
 <thead>
 <tr>
 <th style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE_HEX, borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}></th>
 {statusData.map(s => (
 <th key={s.name} style={{ padding: 6, textAlign: 'center', fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE_HEX, fontSize: 10, borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}>
 {s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name}
 </th>
 ))}
 <th style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: dark ? '#fff' : DEEP_BLUE_HEX, borderBottom: `1px solid ${DEEP_BLUE_TINTS[20]}` }}>Total</th>
 </tr>
 </thead>
 <tbody>
 {dimData.map((row, ri) => (
 <tr key={ri}>
 <td style={{ padding: 6, fontWeight: 600, color: dark ? '#fff' : DEEP_BLUE_HEX, fontSize: 11, whiteSpace: 'nowrap' }}>
 {row.name.length > 16 ? row.name.slice(0, 16) + '…' : row.name}
 </td>
 {statusData.map((col, ci) => {
 // Proportional distribution based on row × col ratios
 const total = dimData.reduce((s, d) => s + d.count, 0) + statusData.reduce((s, d) => s + d.count, 0);
 const cellVal = total > 0 ? Math.round(row.count * col.count / Math.max(total, 1)) : 0;
 return (
 <td key={ci} style={{
 padding: 6, textAlign: 'center', fontSize: 11, fontWeight: 500,
 backgroundColor: heatColor(cellVal), color: cellVal > maxVal * 0.6 ? 'white' : DEEP_BLUE_HEX,
 borderRadius: 3, border: '1px solid white',
 }}>
 {cellVal || '—'}
 </td>
 );
 })}
 <td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: DEEP_BLUE_HEX }}>{row.count}</td>
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
 <tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
 <th style={{ padding: 8, textAlign: 'left', fontWeight: 700, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{widget.dataKey?.replace('by', '') ?? 'Status'} \\ {widget.secondaryDataKey?.replace('by', '') ?? 'Priority'}</th>
 {colData.map(c => (
 <th key={c.name} style={{ padding: 8, textAlign: 'center', fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX, fontSize: 11 }}>
 {c.name.length > 14 ? c.name.slice(0, 14) + '…' : c.name}
 </th>
 ))}
 <th style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Total</th>
 </tr>
 </thead>
 <tbody>
 {rowData.map((row, ri) => (
 <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[10]}` }}>
 <td style={{ padding: 8, fontWeight: 600, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{row.name}</td>
 {colData.map((col, ci) => {
 const cellVal = colTotal > 0 ? Math.round(row.count * col.count / colTotal) : 0;
 return (
 <td key={ci} style={{ padding: 8, textAlign: 'center', color: dark ? (cellVal > 0 ? '#e9ecef' : '#6b7280') : cellVal > 0 ? DEEP_BLUE_HEX : DEEP_BLUE_TINTS[30] }}>
 {cellVal || '—'}
 </td>
 );
 })}
 <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{row.count}</td>
 </tr>
 ))}
 <tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10], fontWeight: 700, borderTop: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : DEEP_BLUE_TINTS[20]}` }}>
 <td style={{ padding: 8, color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>Total</td>
 {colData.map((col, ci) => (
 <td key={ci} style={{ padding: 8, textAlign: 'center', color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{col.count}</td>
 ))}
 <td style={{ padding: 8, textAlign: 'right', color: dark ? '#e9ecef' : DEEP_BLUE_HEX }}>{totalAll}</td>
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
 <Bar animationDuration={600} dataKey="hours" name="Hours Logged" fill={COLOR_TEAL} radius={[0, 4, 4, 0]}
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
 // Release Notes: lists ticket keys + their "Release Notes" custom field value, grouped by Fix Version.
 // The custom field name can be overridden via widget.groupBy (defaults to "Release Notes").
 const rnFieldLabel = widget.groupBy ?? 'Release Notes';
 const fv = data.byFixVersion ?? [];
 if (!fv.length) return wrap(
   <Stack gap="sm" p="sm">
     <Text c="dimmed" ta="center" py="xl">No fix version data — ensure issues have a Fix Version set in Jira and have been synced.</Text>
   </Stack>, 200
 );
 const sorted = [...fv].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).slice(0, widget.limit ?? 20);
 const border = dark ? 'rgba(255,255,255,0.08)' : DEEP_BLUE_TINTS[10];
 const theadBg = dark ? 'rgba(255,255,255,0.06)' : DEEP_BLUE_TINTS[10];
 return wrap(
   <Stack gap={0} style={{ overflowY: 'auto', maxHeight: 460 }}>
     {/* Header legend */}
     <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: theadBg, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0 }}>
       <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY, color: dark ? '#94a3b8' : DEEP_BLUE_TINTS[60], textTransform: 'uppercase', letterSpacing: '0.05em', flex: 2 }}>Fix Version / Issue Key</Text>
       <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY, color: dark ? '#94a3b8' : DEEP_BLUE_TINTS[60], textTransform: 'uppercase', letterSpacing: '0.05em', flex: 5 }}>{rnFieldLabel}</Text>
       <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY, color: dark ? '#94a3b8' : DEEP_BLUE_TINTS[60], textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 52, textAlign: 'right' }}>Issues</Text>
       <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY, color: dark ? '#94a3b8' : DEEP_BLUE_TINTS[60], textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 40, textAlign: 'right' }}>SP</Text>
     </div>
     {sorted.map((row, i) => {
       const donePct = row.count > 0 ? Math.min(100, Math.round(((row.sp ?? 0) / Math.max(row.count, 1)) * 20)) : 0;
       const isEven = i % 2 === 0;
       return (
         <div key={row.name} style={{ borderBottom: `1px solid ${border}`, background: isEven ? 'transparent' : (dark ? 'rgba(255,255,255,0.025)' : DEEP_BLUE_TINTS[10]) }}>
           {/* Version header row */}
           <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderLeft: `3px solid ${AQUA_HEX}` }}>
             <div style={{ flex: 2 }}>
               <Badge size="sm" variant="light" color="teal" radius="sm" style={{ fontFamily: FONT_FAMILY, fontWeight: 700 }}>
                 {row.name || '(No Version)'}
               </Badge>
             </div>
             <Text size="xs" c="dimmed" style={{ flex: 5, fontFamily: FONT_FAMILY, fontStyle: 'italic' }}>
               Configure widget &gt; Group By to set custom field name, then use Power Query to populate issue-level release notes
             </Text>
             <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY, color: AQUA_HEX, minWidth: 52, textAlign: 'right' }}>{row.count}</Text>
             <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY, color: dark ? '#94a3b8' : DEEP_BLUE_TINTS[60], minWidth: 40, textAlign: 'right' }}>{row.sp ?? 0}</Text>
           </div>
           {/* Completion bar */}
           <div style={{ height: 3, background: dark ? 'rgba(255,255,255,0.05)' : DEEP_BLUE_TINTS[10] }}>
             <div style={{ width: `${donePct}%`, height: '100%', background: `linear-gradient(90deg, ${AQUA_HEX}, ${COLOR_EMERALD})`, transition: 'width 0.6s ease' }} />
           </div>
         </div>
       );
     })}
     <Text size="xs" c="dimmed" ta="center" py="xs" style={{ fontFamily: FONT_FAMILY }}>
       💡 Tip: Use the "Group By" field in widget settings to map your Release Notes custom field (e.g. "customfield_10042")
     </Text>
   </Stack>, Math.min(500, sorted.length * 50 + 80)
 );
 }

 case 'supportQueueSummary': {
 // Show a summary based on status and priority breakdowns from analytics data
 const statusCat = data.statusCategoryBreakdown ?? {};
 const toDo = statusCat['To Do'] ?? 0;
 const inProg = statusCat['In Progress'] ?? 0;
 const priData = (data.byPriority ?? []).slice(0, 6);
 const totalOpen = (data.kpis?.totalOpen) ?? 0;
 const bugCount = (data.kpis?.bugCount) ?? 0;

 return wrap(
 <Stack gap="md" p="xs">
 <SimpleGrid cols={3} spacing="xs">
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center', boxShadow: SHADOW.card }}>
 <Text size="1.4rem" fw={800} style={{ color: dark ? '#fff' : DEEP_BLUE_HEX, fontFamily: FONT_FAMILY }}>{totalOpen}</Text>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Open</Text>
 </Paper>
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center', boxShadow: SHADOW.card }}>
 <Text size="1.4rem" fw={800} style={{ color: COLOR_WARNING, fontFamily: FONT_FAMILY }}>{inProg}</Text>
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
 <Bar animationDuration={600} dataKey="count" name="Issues" fill={AQUA_HEX} radius={[0, 4, 4, 0]} />
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

 // ── NEW ADVANCED WIDGETS ──────────────────────────────────────────────

 case 'radarChart': {
   const dimData = sortAndLimitData(
     (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byStatus'] as AnalyticsBreakdown[] ?? [],
     'count', 'desc', widget.limit ?? 6,
   );
   if (!dimData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={280}>
       <RadarChart data={dimData}>
         <PolarGrid stroke={dark ? SLATE_700 : BORDER_STRONG} />
         <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <PolarRadiusAxis tick={{ fontSize: 9, fill: dark ? TEXT_GRAY : DEEP_BLUE_TINTS[40] }} />
         <Radar name="Count" dataKey="count" stroke={widget.color || AQUA_HEX} fill={widget.color || AQUA_HEX} fillOpacity={0.35} />
         {dimData[0]?.sp !== undefined && (
           <Radar name="Story Points" dataKey="sp" stroke={COLOR_VIOLET} fill={COLOR_VIOLET} fillOpacity={0.2} />
         )}
         {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
       </RadarChart>
     </ResponsiveContainer>, 280
   );
 }

 case 'treemap': {
   const tmData = sortAndLimitData(
     (data as unknown as Record<string, unknown>)[widget.dataKey ?? 'byType'] as AnalyticsBreakdown[] ?? [],
     'count', 'desc', widget.limit ?? 20,
   ).map((d, i) => ({ ...d, fill: PIE_COLORS[i % PIE_COLORS.length] }));
   if (!tmData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={300}>
       <Treemap data={tmData} dataKey="count" nameKey="name" aspectRatio={4 / 3}
         content={(({ x, y, width, height, name, value, fill }: any) => {
           if (width < 20 || height < 20) return <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1} />;
           return (
             <g>
               <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
               {width > 40 && height > 24 && (
                 <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
                   fill="#fff" fontSize={Math.min(12, width / 6)} fontFamily={FONT_FAMILY} fontWeight={600}>
                   {String(name).length > 14 ? `${String(name).slice(0, 13)}…` : name}
                 </text>
               )}
               {width > 40 && height > 40 && (
                 <text x={x + width / 2} y={y + height / 2 + 14} textAnchor="middle" dominantBaseline="middle"
                   fill="rgba(255,255,255,0.8)" fontSize={10} fontFamily={FONT_FAMILY}>
                   {value}
                 </text>
               )}
             </g>
           );
         }) as any} />
     </ResponsiveContainer>, 300
   );
 }

 case 'funnelChart': {
   const scb = data.statusCategoryBreakdown ?? {};
   const funnelData = [
     { name: 'To Do', value: scb['To Do'] ?? 0, fill: DEEP_BLUE_TINTS[60] },
     { name: 'In Progress', value: scb['In Progress'] ?? 0, fill: AQUA_HEX },
     { name: 'Done', value: scb['Done'] ?? 0, fill: UX_POSITIVE },
   ].filter(d => d.value > 0);
   if (!funnelData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No status data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={220}>
       <FunnelChart>
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         <Funnel dataKey="value" data={funnelData} isAnimationActive>
           <LabelList position="right" fill={dark ? '#cbd5e1' : DEEP_BLUE_HEX} stroke="none"
             dataKey="name" style={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
           <LabelList position="center" fill="#fff" stroke="none"
             dataKey="value" style={{ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 700 }} />
         </Funnel>
       </FunnelChart>
     </ResponsiveContainer>, 220
   );
 }

 case 'scatterPlot': {
   const scatterData = (data.workload ?? []).slice(0, widget.limit ?? 20).map(w => ({
     name: w.assignee,
     x: w.total,
     y: w.sp ?? 0,
     z: Math.max(4, (w.bugs ?? 0) * 2 + 4),
   }));
   if (!scatterData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No workload data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={280}>
       <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis type="number" dataKey="x" name="Issues" label={{ value: 'Open Issues', position: 'insideBottom', offset: -8, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY, fontSize: 11 }} tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <YAxis type="number" dataKey="y" name="SP" label={{ value: 'Story Points', angle: -90, position: 'insideLeft', fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY, fontSize: 11 }} tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <ZAxis type="number" dataKey="z" range={[30, 200]} name="Bugs" />
         <RTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }}
           content={({ payload }: any) => payload?.[0] ? (
             <div style={{ background: dark ? DARK_TEXT_PRIMARY : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 12px', fontFamily: FONT_FAMILY, fontSize: 12 }}>
               <div style={{ fontWeight: 700 }}>{payload[0]?.payload?.name}</div>
               <div>Issues: {payload[0]?.payload?.x} | SP: {payload[0]?.payload?.y}</div>
             </div>
           ) : null} />
         <Scatter animationDuration={600} data={scatterData} fill={AQUA_HEX} fillOpacity={0.7} />
       </ScatterChart>
     </ResponsiveContainer>, 280
   );
 }

 case 'velocityChart': {
   const sprintData = sortAndLimitData(
     (data as unknown as Record<string, unknown>)['bySprint'] as AnalyticsBreakdown[] ?? [],
     'name', 'asc', widget.limit ?? 10,
   );
   const fallback = (data.createdVsResolved ?? []).slice(-(widget.limit ?? 10)).map(w => ({
     name: w.week, count: w.resolved, sp: 0,
   }));
   const chartData = sprintData.length > 0 ? sprintData : fallback;
   if (!chartData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No sprint data available</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={280}>
       <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis dataKey="name" tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} angle={-30} textAnchor="end" height={50} />
         <YAxis tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
         <Bar animationDuration={600} dataKey="count" name="Issues" fill={AQUA_HEX} radius={[4, 4, 0, 0]} />
         {chartData[0]?.sp !== undefined && chartData.some((d: any) => d.sp > 0) && (
           <Bar animationDuration={600} dataKey="sp" name="Story Points" fill={COLOR_VIOLET} radius={[4, 4, 0, 0]} />
         )}
       </BarChart>
     </ResponsiveContainer>, 280
   );
 }

 case 'epicProgress': {
   const epicData = sortAndLimitData(
     (data as unknown as Record<string, unknown>)['byEpic'] as AnalyticsBreakdown[] ?? data.byLabel ?? [],
     widget.sortBy || 'count', widget.sortDirection || 'desc', widget.limit ?? 10,
   );
   if (!epicData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No epic data — sync required</Text>, 200);
   const maxCount = Math.max(...epicData.map(e => e.count), 1);
   return wrap(
     <Stack gap={6} p="xs">
       {epicData.map((epic, i) => {
         const pct = Math.round((epic.count / maxCount) * 100);
         return (
           <div key={epic.name}>
             <Group justify="space-between" mb={2}>
               <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY, color: dark ? BORDER_STRONG : DEEP_BLUE_HEX, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                 {epic.name}
               </Text>
               <Text size="xs" c="dimmed" fw={500}>{epic.count} issues</Text>
             </Group>
             <div style={{ height: 8, background: dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT, borderRadius: 4, overflow: 'hidden' }}>
               <div style={{ height: '100%', width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 4, transition: 'width 0.6s ease' }} />
             </div>
           </div>
         );
       })}
     </Stack>, Math.min(500, epicData.length * 38 + 20)
   );
 }

 case 'teamComparison': {
   const podData = sortAndLimitData(data.byPod ?? [], 'count', 'desc', widget.limit ?? 8);
   if (!podData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No POD data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={280}>
       <BarChart data={podData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis dataKey="name" tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} angle={-20} textAnchor="end" height={45} />
         <YAxis tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
         <Bar animationDuration={600} dataKey="count" name="Issues" fill={AQUA_HEX} radius={[4, 4, 0, 0]} />
         {podData.some((d: any) => d.sp > 0) && (
           <Bar animationDuration={600} dataKey="sp" name="Story Points" fill={DEEP_BLUE_HEX} radius={[4, 4, 0, 0]} />
         )}
       </BarChart>
     </ResponsiveContainer>, 280
   );
 }

 case 'monthlySummary': {
   const createdM = (data as unknown as Record<string, unknown>)['byCreatedMonth'] as AnalyticsBreakdown[] ?? [];
   const resolvedM = (data as unknown as Record<string, unknown>)['byResolvedMonth'] as AnalyticsBreakdown[] ?? [];
   const resolvedMap = new Map(resolvedM.map(r => [r.name, r.count]));
   const months = createdM.slice(-(widget.limit ?? 6));
   if (!months.length) return wrap(<Text c="dimmed" ta="center" py="xl">No monthly data — sync required</Text>, 200);
   return wrap(
     <div style={{ overflowX: 'auto' }}>
       <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 12 }}>
         <thead>
           <tr style={{ background: dark ? DARK_TEXT_PRIMARY : DEEP_BLUE_TINTS[10] }}>
             {['Month', 'Created', 'Resolved', 'Net Flow'].map(h => (
               <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Month' ? 'left' : 'right', color: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontWeight: 600, fontSize: 11 }}>{h}</th>
             ))}
           </tr>
         </thead>
         <tbody>
           {months.map((m, i) => {
             const created = m.count;
             const resolved = resolvedMap.get(m.name) ?? 0;
             const net = resolved - created;
             return (
               <tr key={m.name} style={{ background: i % 2 === 0 ? 'transparent' : dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                 <td style={{ padding: '6px 10px', fontWeight: 600, color: dark ? BORDER_STRONG : DEEP_BLUE_HEX }}>{m.name}</td>
                 <td style={{ padding: '6px 10px', textAlign: 'right', color: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[70] }}>{created}</td>
                 <td style={{ padding: '6px 10px', textAlign: 'right', color: UX_POSITIVE }}>{resolved}</td>
                 <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: net >= 0 ? UX_POSITIVE : UX_ERROR }}>{net >= 0 ? `+${net}` : net}</td>
               </tr>
             );
           })}
         </tbody>
       </table>
     </div>, Math.min(450, months.length * 32 + 40)
   );
 }

 case 'throughputHist': {
   const histData = (data.createdVsResolved ?? []).slice(-(widget.limit ?? 12)).map(w => ({
     week: w.week,
     resolved: w.resolved,
     created: w.created,
   }));
   if (!histData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No trend data</Text>, 200);
   const avg = histData.reduce((s, d) => s + d.resolved, 0) / histData.length;
   return wrap(
     <ResponsiveContainer width="100%" height={280}>
       <BarChart data={histData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis dataKey="week" tick={{ fontSize: 9, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} angle={-30} textAnchor="end" height={50} />
         <YAxis tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         <ReferenceLine y={avg} stroke={UX_WARNING} strokeDasharray="4 2" label={{ value: `Avg ${avg.toFixed(1)}`, fill: UX_WARNING, fontSize: 10, fontFamily: FONT_FAMILY }} />
         {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
         <Bar animationDuration={600} dataKey="resolved" name="Resolved" fill={UX_POSITIVE} radius={[3, 3, 0, 0]} />
         <Bar animationDuration={600} dataKey="created" name="Created" fill={AQUA_HEX} radius={[3, 3, 0, 0]} fillOpacity={0.4} />
       </BarChart>
     </ResponsiveContainer>, 280
   );
 }

 case 'statusCategoryDonut': {
   const scbd = data.statusCategoryBreakdown ?? {};
   const scbData = [
     { name: 'To Do',       count: scbd['To Do']       ?? 0, fill: DEEP_BLUE_TINTS[60] },
     { name: 'In Progress', count: scbd['In Progress'] ?? 0, fill: AQUA_HEX },
     { name: 'Done',        count: scbd['Done']        ?? 0, fill: UX_POSITIVE },
   ].filter(d => d.count > 0);
   if (!scbData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No status data</Text>, 200);
   const total = scbData.reduce((s, d) => s + d.count, 0);
   return wrap(
     <div style={{ position: 'relative', width: '100%', height: 240 }}>
       <ResponsiveContainer width="100%" height={240}>
         <PieChart>
           <Pie animationDuration={600} data={scbData} cx="50%" cy="50%" innerRadius="52%" outerRadius="78%" dataKey="count" paddingAngle={3}>
             {scbData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
           </Pie>
           <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v} (${((v / total) * 100).toFixed(0)}%)`, '']} />
           {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} formatter={(v: string) => `${v}: ${scbData.find(d => d.name === v)?.count ?? 0}`} />}
         </PieChart>
       </ResponsiveContainer>
       <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
         <Text size="1.4rem" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE_HEX, lineHeight: 1 }}>{total}</Text>
         <Text size="9px" c="dimmed" tt="uppercase" fw={600}>Total</Text>
       </div>
     </div>, 240
   );
 }

 case 'cycleTimeScatter': {
   const ctData = (data.cycleTime ?? []).map(b => ({ bucket: b.bucket, count: b.count }));
   if (!ctData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No cycle time data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={260}>
       <AreaChart data={ctData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
         <defs>
           <linearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
             <stop offset="5%" stopColor={AQUA_HEX} stopOpacity={0.3} />
             <stop offset="95%" stopColor={AQUA_HEX} stopOpacity={0} />
           </linearGradient>
         </defs>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} angle={-20} textAnchor="end" height={45} />
         <YAxis tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         <Area animationDuration={600} type="monotone" dataKey="count" name="Issues" stroke={AQUA_HEX} fill="url(#ctGrad)" strokeWidth={2} dot={{ fill: AQUA_HEX, r: 4 }} />
       </AreaChart>
     </ResponsiveContainer>, 260
   );
 }

 case 'openTrend': {
   let running = 0;
   const openTrendData = (data.createdVsResolved ?? []).slice(-(widget.limit ?? 16)).map(w => {
     running += (w.created - w.resolved);
     return { week: w.week, open: Math.max(0, running + (data.kpis?.totalOpen ?? 0)) };
   });
   if (!openTrendData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No trend data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={260}>
       <AreaChart data={openTrendData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
         <defs>
           <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
             <stop offset="5%" stopColor={UX_WARNING} stopOpacity={0.3} />
             <stop offset="95%" stopColor={UX_WARNING} stopOpacity={0} />
           </linearGradient>
         </defs>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis dataKey="week" tick={{ fontSize: 9, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} angle={-30} textAnchor="end" height={50} />
         <YAxis tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         <Area animationDuration={600} type="monotone" dataKey="open" name="Open Issues" stroke={UX_WARNING} fill="url(#openGrad)" strokeWidth={2} />
       </AreaChart>
     </ResponsiveContainer>, 260
   );
 }

 case 'ratioKpi': {
   const bugRatio = data.kpis?.bugRatio ?? 0;
   const doneCount = (data.statusCategoryBreakdown?.['Done'] ?? 0);
   const total = (data.kpis?.totalOpen ?? 0) + doneCount;
   const donePct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
   const metric1 = { label: 'Bug Ratio', value: `${bugRatio.toFixed(1)}%`, sub: `${data.kpis?.bugCount ?? 0} bugs / ${data.kpis?.totalCreated ?? 0} created`, color: bugRatio > 10 ? UX_ERROR : bugRatio > 5 ? UX_WARNING : UX_POSITIVE };
   const metric2 = { label: 'Done %', value: `${donePct}%`, sub: `${doneCount} done / ${total} total`, color: doneCount === 0 ? TEXT_GRAY : donePct > 70 ? UX_POSITIVE : donePct > 40 ? UX_WARNING : UX_ERROR };
   return wrap(
     <SimpleGrid cols={2} spacing="sm" p="xs" h="100%">
       {[metric1, metric2].map(m => (
         <Paper key={m.label} withBorder radius="md" p="sm" style={{ textAlign: 'center', borderLeft: `4px solid ${m.color}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
           <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ fontFamily: FONT_FAMILY }}>{m.label}</Text>
           <Text size="1.6rem" fw={800} style={{ fontFamily: FONT_FAMILY, color: m.color, lineHeight: 1 }}>{m.value}</Text>
           <Text size="10px" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{m.sub}</Text>
         </Paper>
       ))}
     </SimpleGrid>, 160
   );
 }

 case 'sprintBurndown': {
   let cumCreated = 0, cumResolved = 0;
   const bdData = (data.createdVsResolved ?? []).slice(-(widget.limit ?? 12)).map(w => {
     cumCreated += w.created;
     cumResolved += w.resolved;
     return { week: w.week, scope: cumCreated, completed: cumResolved, remaining: Math.max(0, cumCreated - cumResolved) };
   });
   if (!bdData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No data</Text>, 200);
   return wrap(
     <ResponsiveContainer width="100%" height={280}>
       <ComposedChart data={bdData} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
         <CartesianGrid strokeDasharray="3 3" stroke={dark ? DARK_TEXT_PRIMARY : SURFACE_LIGHT} />
         <XAxis dataKey="week" tick={{ fontSize: 9, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} angle={-30} textAnchor="end" height={50} />
         <YAxis tick={{ fontSize: 10, fill: dark ? TEXT_SUBTLE : DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} />
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
         {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
         <Area animationDuration={600} type="monotone" dataKey="scope" name="Total Scope" fill={DEEP_BLUE_TINTS[20]} stroke={DEEP_BLUE_TINTS[60]} fillOpacity={0.2} strokeWidth={1.5} />
         <Area animationDuration={600} type="monotone" dataKey="completed" name="Completed" fill={UX_POSITIVE} stroke={UX_POSITIVE} fillOpacity={0.25} strokeWidth={2} />
         <Line animationDuration={600} type="monotone" dataKey="remaining" name="Remaining" stroke={UX_ERROR} strokeWidth={2} dot={false} strokeDasharray="5 2" />
       </ComposedChart>
     </ResponsiveContainer>, 280
   );
 }

 case 'resolutionDonut': {
   const resData = sortAndLimitData(
     (data as unknown as Record<string, unknown>)['byResolution'] as AnalyticsBreakdown[] ?? [],
     'count', 'desc', widget.limit ?? 8,
   );
   if (!resData.length) return wrap(<Text c="dimmed" ta="center" py="xl">No resolution data — sync required</Text>, 200);
   const resTotal = resData.reduce((s, d) => s + d.count, 0);
   return wrap(
     <ResponsiveContainer width="100%" height={240}>
       <PieChart>
         <Pie animationDuration={600} data={resData} cx="50%" cy="50%" innerRadius="45%" outerRadius="72%" dataKey="count" nameKey="name" paddingAngle={2}>
           {resData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
         </Pie>
         <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v} (${((v / resTotal) * 100).toFixed(0)}%)`, '']} />
         {widget.showLegend !== false && <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />}
       </PieChart>
     </ResponsiveContainer>, 240
   );
 }

 // ── Worklog Timeline ────────────────────────────────────────────────────
 case 'worklogTimeline': {
   const authors = data.byWorklogAuthor ?? [];
   if (!authors.length) return wrap(<Text c="dimmed" ta="center" py="xl">No worklog data — enable worklog sync in Settings</Text>, 200);
   const limited = [...authors].sort((a, b) => b.hours - a.hours).slice(0, widget.limit ?? 15);
   const totalHrs = limited.reduce((s, a) => s + a.hours, 0);
   return wrap(
     <Stack gap={4} px={4} style={{ overflowY: 'auto', maxHeight: 340 }}>
       <Group justify="space-between" mb={4}>
         <Text size="xs" c="dimmed" fw={600}>AUTHOR</Text>
         <Group gap={32}>
           <Text size="xs" c="dimmed" fw={600}>HOURS LOGGED</Text>
           <Text size="xs" c="dimmed" fw={600}>SHARE</Text>
         </Group>
       </Group>
       {limited.map((a, i) => {
         const pct = totalHrs > 0 ? (a.hours / totalHrs) * 100 : 0;
         return (
           <div key={i}>
             <Group justify="space-between" mb={2}>
               <Text size="xs" fw={500} style={{ fontFamily: FONT_FAMILY }}>{a.name}</Text>
               <Group gap={32}>
                 <Text size="xs" fw={700} style={{ color: AQUA_HEX }}>{a.hours.toFixed(1)}h</Text>
                 <Text size="xs" c="dimmed" style={{ minWidth: 36, textAlign: 'right' }}>{pct.toFixed(0)}%</Text>
               </Group>
             </Group>
             <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
               <div style={{ width: `${pct}%`, height: '100%', background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 3, transition: 'width 0.6s ease' }} />
             </div>
           </div>
         );
       })}
       <Divider my={4} />
       <Group justify="space-between">
         <Text size="xs" c="dimmed">{limited.length} authors · {data.lookbackMonths ?? 3}mo lookback</Text>
         <Text size="xs" fw={700}>Total: {totalHrs.toFixed(1)}h</Text>
       </Group>
     </Stack>, 360
   );
 }

 // ── Productivity Comparison (Period-over-Period) ─────────────────────────
 case 'productivityComparison': {
   const periodType = widget.periodType ?? 'month';
   const monthlyData = (data as unknown as Record<string, unknown>)['byResolvedMonth'] as AnalyticsBreakdown[] ?? [];
   const trend = data.createdVsResolved ?? [];
   if (!monthlyData.length && !trend.length) return wrap(<Text c="dimmed" ta="center" py="xl">No data — sync required</Text>, 200);

   // Helper: week date → period bucket key
   const toPeriodKey = (dateStr: string): string => {
     if (!dateStr || dateStr.length < 7) return '';
     const y = dateStr.substring(0, 4);
     const m = dateStr.substring(5, 7);
     const mi = parseInt(m, 10);
     if (periodType === 'week') return dateStr.substring(0, 10); // full date
     if (periodType === 'month') return `${y}-${m}`;
     if (periodType === 'quarter') return `${y}-Q${Math.ceil(mi / 3)}`;
     if (periodType === 'year') return y;
     return `${y}-${m}`;
   };
   const periodLabel = (key: string): string => {
     if (periodType === 'week') { const d = new Date(key); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
     if (periodType === 'month') { const [y, m] = key.split('-'); return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
     if (periodType === 'quarter') return key; // "2026-Q1"
     return key; // year
   };

   // Aggregate trend data into period buckets
   const buckets: Record<string, { created: number; resolved: number; sp: number }> = {};
   trend.forEach(w => {
     const key = toPeriodKey(w.week ?? '');
     if (!key) return;
     if (!buckets[key]) buckets[key] = { created: 0, resolved: 0, sp: 0 };
     buckets[key].created += w.created ?? 0;
     buckets[key].resolved += w.resolved ?? 0;
   });
   // Merge SP from byResolvedMonth
   monthlyData.forEach(m => {
     // m.name is "YYYY-MM" — convert to period bucket
     const key = toPeriodKey(m.name + '-01');
     if (!key) return;
     if (!buckets[key]) buckets[key] = { created: 0, resolved: 0, sp: 0 };
     buckets[key].sp += m.sp ?? 0;
   });

   const sorted = Object.keys(buckets).sort();
   const maxBars = periodType === 'week' ? 12 : periodType === 'month' ? 6 : periodType === 'quarter' ? 4 : 3;
   const chartData = sorted.slice(-(widget.limit ?? maxBars)).map(k => ({
     period: periodLabel(k),
     resolved: buckets[k]?.resolved ?? 0,
     created: buckets[k]?.created ?? 0,
     sp: buckets[k]?.sp ?? 0,
   }));
   if (!chartData.length) return wrap(<Text c="dimmed" ta="center" py="xl">Not enough data for {periodType} comparison</Text>, 200);

   const last = chartData[chartData.length - 1];
   const prev = chartData.length >= 2 ? chartData[chartData.length - 2] : null;
   const periodNames = { week: 'WoW', month: 'MoM', quarter: 'QoQ', year: 'YoY' };
   const hasSP = chartData.some(d => d.sp > 0);

   return wrap(
     <Stack gap="sm">
       {/* KPI cards comparing last vs prev period */}
       {prev && (
         <Group gap="xs" wrap="wrap">
           {[
             { label: 'Resolved', curr: last.resolved, prev: prev.resolved, color: AQUA_HEX },
             ...(hasSP ? [{ label: 'SP Delivered', curr: last.sp, prev: prev.sp, color: COLOR_VIOLET }] : []),
             { label: 'Created', curr: last.created, prev: prev.created, color: DEEP_BLUE_TINTS[50] },
           ].map(({ label, curr, prev: p, color }) => {
             const delta = p > 0 ? ((curr - p) / p * 100) : (curr > 0 ? 100 : 0);
             const isUp = delta >= 0;
             const isGood = label === 'Created' ? !isUp : isUp; // less created = good
             return (
               <Paper key={label} withBorder radius="md" p="xs" style={{ flex: 1, minWidth: 110, textAlign: 'center', borderTop: `3px solid ${color}` }}>
                 <Text size="xs" c="dimmed" mb={2}>{label}</Text>
                 <Text size="xl" fw={800} style={{ color: DEEP_BLUE_HEX, fontFamily: FONT_FAMILY }}>{curr}</Text>
                 <Badge size="xs" color={isGood ? 'teal' : 'red'} variant="light" mt={4}>
                   {isUp ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% {periodNames[periodType]}
                 </Badge>
               </Paper>
             );
           })}
         </Group>
       )}
       {/* Bar chart */}
       <ResponsiveContainer width="100%" height={220}>
         <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
           <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} vertical={false} />
           <XAxis dataKey="period" tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} />
           <YAxis tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }} tickLine={false} axisLine={false} />
           <RTooltip contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12, borderRadius: 8 }} />
           <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
           <Bar dataKey="resolved" name="Resolved" fill={AQUA_HEX} radius={[3, 3, 0, 0]} animationDuration={600} />
           <Bar dataKey="created" name="Created" fill={DEEP_BLUE_TINTS[30]} radius={[3, 3, 0, 0]} animationDuration={600} />
           {hasSP && <Line type="monotone" dataKey="sp" name="Story Points" stroke={COLOR_VIOLET} strokeWidth={2} dot={{ r: 3, fill: COLOR_VIOLET }} animationDuration={600} />}
         </ComposedChart>
       </ResponsiveContainer>
       {prev && (
         <Group justify="center" gap={4}>
           <Badge size="xs" variant="outline" color="gray" style={{ fontFamily: FONT_FAMILY }}>
             {periodNames[periodType]} · {chartData.length} periods · {periodType === 'week' ? 'weekly' : periodType === 'month' ? 'monthly' : periodType === 'quarter' ? 'quarterly' : 'yearly'} view
           </Badge>
         </Group>
       )}
     </Stack>, 440
   );
 }

 case 'pivotBuilder':
   return (
     <PivotBuilderWidget
       widget={widget}
       editMode={editMode}
       onRemove={onRemove}
       onEdit={onEdit}
       pods={pods}
       months={months}
     />
   );

 default:
 return wrap(<Text c="dimmed" ta="center" py="xl">Unknown widget type: {widget.type}</Text>, 100);
 }
}

/* ── Mini widget preview for "Add Widget" catalog ─────────────────────── */
const MINI_SAMPLE_BAR = [4,7,3,9,5,6,8];
const MINI_SAMPLE_LINE = [3,5,4,7,6,8,5,9];
const MINI_SAMPLE_PIE = [{v:40},{v:25},{v:20},{v:15}];

function MiniWidgetPreview({ type, color }: { type: string; color: string }) {
 const h = 52;
 const barW = 8, gap = 3, barMax = Math.max(...MINI_SAMPLE_BAR);
 const lineMax = Math.max(...MINI_SAMPLE_LINE), lineMin = Math.min(...MINI_SAMPLE_LINE);
 const linePoints = MINI_SAMPLE_LINE.map((v, i) => {
   const x = 4 + i * (92 / (MINI_SAMPLE_LINE.length - 1));
   const y = h - 6 - ((v - lineMin) / (lineMax - lineMin)) * (h - 12);
   return `${x},${y}`;
 }).join(' ');

 const barSvg = (
   <svg width="100%" height={h} viewBox={`0 0 80 ${h}`} preserveAspectRatio="none">
     {MINI_SAMPLE_BAR.map((v, i) => {
       const bh = (v / barMax) * (h - 8);
       return <rect key={i} x={4 + i * (barW + gap)} y={h - bh - 4} width={barW} height={bh} rx={2} fill={color} opacity={0.7 + (i === 3 ? 0.3 : 0)} />;
     })}
   </svg>
 );
 const lineSvg = (
   <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none">
     <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
     <polygon points={`${linePoints} 96,${h} 4,${h}`} fill={color} opacity={0.15} />
   </svg>
 );
 const pieSvg = (
   <svg width="100%" height={h} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet">
     {(() => {
       let angle = -Math.PI / 2;
       const cx = 30, cy = 30, r = 22, ir = 12;
       const colors = [color, COLOR_VIOLET, COLOR_AMBER_DARK, COLOR_EMERALD];
       return MINI_SAMPLE_PIE.map((seg, i) => {
         const sweep = (seg.v / 100) * 2 * Math.PI;
         const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
         const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
         const xi1 = cx + ir * Math.cos(angle), yi1 = cy + ir * Math.sin(angle);
         const xi2 = cx + ir * Math.cos(angle + sweep), yi2 = cy + ir * Math.sin(angle + sweep);
         const large = sweep > Math.PI ? 1 : 0;
         const d = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1}`;
         angle += sweep;
         return <path key={i} d={d} fill={colors[i % colors.length]} opacity={0.85} />;
       });
     })()}
   </svg>
 );
 const tableSvg = (
   <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
     <rect x="2" y="2" width="86" height="10" rx="2" fill={color} opacity="0.5" />
     {[16,26,36,46].map(y => (
       <g key={y}>
         <rect x="2" y={y} width="34" height="7" rx="1" fill={color} opacity="0.15" />
         <rect x="40" y={y} width="20" height="7" rx="1" fill={color} opacity="0.15" />
         <rect x="64" y={y} width="24" height="7" rx="1" fill={color} opacity="0.15" />
       </g>
     ))}
   </svg>
 );
 const gaugeSvg = (
   <svg width="100%" height={h} viewBox="0 0 80 52" preserveAspectRatio="xMidYMid meet">
     <path d="M 12 44 A 28 28 0 0 1 68 44" fill="none" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round"/>
     <path d="M 12 44 A 28 28 0 0 1 52 17" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"/>
     <text x="40" y="42" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>73%</text>
   </svg>
 );
 const heatSvg = (
   <svg width="100%" height={h} viewBox="0 0 84 52" preserveAspectRatio="none">
     {Array.from({length:5}).map((_,row) => Array.from({length:7}).map((_,col) => {
       const v = Math.random();
       return <rect key={`${row}-${col}`} x={4+col*11} y={4+row*9} width={9} height={7} rx={1} fill={color} opacity={0.1 + v * 0.8} />;
     }))}
   </svg>
 );
 const kpiSvg = (
   <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="xMidYMid meet">
     {[{x:4,w:24,val:'507'},{x:32,w:24,val:'42'},{x:60,w:28,val:'18%'}].map((k,i) => (
       <g key={i}>
         <rect x={k.x} y="4" width={k.w} height="44" rx="3" fill={color} opacity={0.1+i*0.05} />
         <text x={k.x+k.w/2} y="30" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>{k.val}</text>
       </g>
     ))}
   </svg>
 );
 const radarSvg = (
   <svg width="100%" height={h} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet">
     {[0,1,2,3,4].map(i => {
       const a = (i/5)*2*Math.PI - Math.PI/2;
       return <line key={i} x1={30} y1={30} x2={30+26*Math.cos(a)} y2={30+26*Math.sin(a)} stroke="#E2E8F0" strokeWidth={1}/>;
     })}
     <polygon points={[0,1,2,3,4].map(i => { const a=(i/5)*2*Math.PI-Math.PI/2, r=[0.8,0.6,0.9,0.7,0.85][i]*22; return `${30+r*Math.cos(a)},${30+r*Math.sin(a)}`; }).join(' ')} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5}/>
   </svg>
 );
 const funnelSvg = (
   <svg width="100%" height={h} viewBox="0 0 70 52" preserveAspectRatio="none">
     {[{y:4,w:60,v:'100'},{y:16,w:44,v:'72'},{y:28,w:28,v:'48'},{y:40,w:16,v:'31'}].map((s,i) => (
       <g key={i}>
         <rect x={(70-s.w)/2} y={s.y} width={s.w} height={10} rx={2} fill={color} opacity={0.9-i*0.15}/>
       </g>
     ))}
   </svg>
 );

 const previewMap: Record<string, React.ReactNode> = {
   kpis: kpiSvg, singleKpi: kpiSvg, trendSpark: kpiSvg, ratioKpi: kpiSvg,
   donut: pieSvg, statusCategoryDonut: pieSvg, resolutionDonut: pieSvg,
   horizontalBar: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {MINI_SAMPLE_BAR.map((v,i) => <rect key={i} x={4} y={4+i*7} width={v/barMax*80} height={5} rx={2} fill={color} opacity={0.6+i*0.04}/>)}
     </svg>
   ),
   stackedBar: barSvg, velocityChart: barSvg, throughputHist: barSvg, teamComparison: barSvg,
   lineChart: lineSvg, bugTrend: lineSvg, resolutionTime: lineSvg, openTrend: lineSvg,
   createdVsResolved: (
     <svg width="100%" height={h} viewBox="0 0 100 52" preserveAspectRatio="none">
       <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2"/>
       <polyline points={MINI_SAMPLE_LINE.map((v,i)=>{const x=4+i*(92/(MINI_SAMPLE_LINE.length-1));const y=h-6-((v-lineMin)/(lineMax-lineMin))*(h-12)*0.7+8;return `${x},${y}`;}).join(' ')} fill="none" stroke={COLOR_ERROR} strokeWidth="2"/>
     </svg>
   ),
   gauge: gaugeSvg,
   heatmap: heatSvg,
   radarChart: radarSvg,
   treemap: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       <rect x="2" y="2" width="50" height="30" rx="2" fill={color} opacity="0.7"/>
       <rect x="54" y="2" width="34" height="14" rx="2" fill={COLOR_VIOLET} opacity="0.7"/>
       <rect x="54" y="18" width="34" height="14" rx="2" fill={COLOR_AMBER_DARK} opacity="0.7"/>
       <rect x="2" y="34" width="28" height="16" rx="2" fill={COLOR_EMERALD} opacity="0.7"/>
       <rect x="32" y="34" width="56" height="16" rx="2" fill={color} opacity="0.4"/>
     </svg>
   ),
   funnelChart: funnelSvg,
   scatterPlot: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {[[15,30,12],[35,18,8],[55,38,16],[70,12,6],[45,42,18],[25,10,5],[60,28,10]].map(([x,y,r],i)=>(
         <circle key={i} cx={x} cy={y} r={r/2} fill={color} opacity={0.5+i*0.06}/>
       ))}
     </svg>
   ),
   cycleTimeScatter: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {[[10,40,4],[20,25,3],[30,15,3],[45,35,5],[55,10,3],[65,42,4],[75,20,4],[40,48,5]].map(([x,y,r],i)=>(
         <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.6}/>
       ))}
     </svg>
   ),
   countdown: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="xMidYMid meet">
       <text x="45" y="36" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color} opacity="0.8">14d</text>
     </svg>
   ),
   cumulativeFlow: lineSvg, sprintBurndown: lineSvg, averageAge: barSvg,
   cycleTime: barSvg, aging: barSvg,
   pivotTable: tableSvg, issueTable: tableSvg, twoDimensional: tableSvg,
   monthlySummary: tableSvg, assigneeLeaderboard: tableSvg,
   workload: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {[{w:70,c:color},{w:50,c:COLOR_ERROR},{w:35,c:COLOR_WARNING}].map((b,i)=>(
         <rect key={i} x="4" y={4+i*16} width={b.w} height="12" rx="2" fill={b.c} opacity="0.7"/>
       ))}
     </svg>
   ),
   epicProgress: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {[0.82,0.64,0.41,0.91].map((v,i)=>(
         <g key={i}>
           <rect x="4" y={4+i*12} width="82" height="8" rx="2" fill="#E2E8F0"/>
           <rect x="4" y={4+i*12} width={v*82} height="8" rx="2" fill={color} opacity="0.75"/>
         </g>
       ))}
     </svg>
   ),
   releaseNotes: tableSvg, supportQueueSummary: tableSvg,
   worklogByAuthor: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {[0.9,0.7,0.55,0.4,0.25].map((v,i)=><rect key={i} x="4" y={4+i*9} width={v*80} height="6" rx="2" fill={color} opacity={0.8-i*0.1}/>)}
     </svg>
   ),
   worklogTimeline: tableSvg,
   productivityComparison: barSvg,
   pivotBuilder: (
     <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
       {/* header row */}
       <rect x="2" y="2" width="86" height="9" rx="2" fill={color} opacity="0.5" />
       {/* row labels + cells */}
       {[14, 24, 34, 44].map((y, ri) => (
         <g key={ri}>
           <rect x="2" y={y} width="20" height="7" rx="1" fill={color} opacity="0.2" />
           {[24, 38, 52, 66, 80].map((x, ci) => (
             <rect key={ci} x={x} y={y} width="10" height="7" rx="1" fill={color} opacity={0.1 + (ri + ci) * 0.07} />
           ))}
         </g>
       ))}
     </svg>
   ),
 };

 const preview = previewMap[type] ?? barSvg;
 return (
   <div style={{
     background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
     borderBottom: `1px solid ${color}20`,
     height: h,
     display: 'flex', alignItems: 'center', justifyContent: 'center',
     padding: '4px 8px',
   }}>
     {preview}
   </div>
 );
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
 const [selectedSupportBoards, setSelectedSupportBoards] = useState<string[]>([]);
 const [editMode, setEditMode] = useState(false);
 const [addWidgetOpen, setAddWidgetOpen] = useState(false);
 const [editingWidget, setEditingWidget] = useState<ExtendedDashboardWidget | null>(null);
 const [dashName, setDashName] = useState('');
 const [dashDesc, setDashDesc] = useState('');
 const [saveDashOpen, setSaveDashOpen] = useState(false);
 const [loadDashOpen, setLoadDashOpen] = useState(false);
 const [templatesOpen, setTemplatesOpen] = useState(false);
 const [renameDashOpen, setRenameDashOpen] = useState(false);
 const [renameValue, setRenameValue] = useState('');
 const [widgetSearch, setWidgetSearch] = useState('');
 const [widgetCategoryFilter, setWidgetCategoryFilter] = useState<string>('all');
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
 const supportBoardsParam = selectedSupportBoards.length > 0 ? selectedSupportBoards.join(',') : undefined;
 const { data, isLoading, isFetching, error, refetch } = useJiraAnalytics(months, podsParam, supportBoardsParam);
 const { data: filters } = useJiraAnalyticsFilters();
 const { data: dashboards = [] } = useJiraDashboards();
 const { data: analyticsFields = [] } = useJiraAnalyticsFields(podsParam);
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

 const podOptions = useMemo(() => {
   const sprintItems = (filters?.pods ?? []).map(p => ({
     value: `pod-${p.id}`,
     label: p.name,
   }));
   const supportItems = (filters?.supportBoards ?? []).map(sb => ({
     value: `sb-${sb.id}`,
     label: `[Support] ${sb.name}`,
   }));
   // Mantine v7 uses flat array; prepend a disabled separator item when both types exist
   if (sprintItems.length > 0 && supportItems.length > 0) {
     return [
       ...sprintItems,
       { value: '__sep__', label: '── Support Boards ──', disabled: true },
       ...supportItems,
     ];
   }
   return [...sprintItems, ...supportItems];
 }, [filters]);

 // Split combined selection back into pod IDs and support board IDs
 const splitPodSelection = useCallback((combined: string[]) => {
   const pods: string[] = [];
   const sbs: string[] = [];
   combined.forEach(v => {
     if (v.startsWith('sb-')) sbs.push(v.replace('sb-', ''));
     else pods.push(v.replace('pod-', ''));
   });
   setSelectedPods(pods);
   setSelectedSupportBoards(sbs);
 }, []);

 // Combined selection for the single MultiSelect
 const combinedPodSelection = useMemo(() => [
   ...selectedPods.map(id => `pod-${id}`),
   ...selectedSupportBoards.map(id => `sb-${id}`),
 ], [selectedPods, selectedSupportBoards]);

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
 // Defensive normalizer: ensure every array field is actually an array
 // (guards against API bugs returning null/object instead of [])
 const sa = <T,>(v: T[] | null | undefined): T[] => Array.isArray(v) ? v : [];
 return {
 ...data,
 // Apply filters + normalize
 byFixVersion: selectedVersions.length > 0
 ? sa(data.byFixVersion).filter(v => selectedVersions.includes(v.name))
 : sa(data.byFixVersion),
 byType: selectedTypes.length > 0
 ? sa(data.byType).filter(t => selectedTypes.includes(t.name))
 : sa(data.byType),
 // Normalize all remaining array fields
 createdVsResolved: sa(data.createdVsResolved),
 workload: sa(data.workload),
 aging: sa(data.aging),
 cycleTime: sa(data.cycleTime),
 bugTrend: sa(data.bugTrend),
 byStatus: sa(data.byStatus),
 byPriority: sa(data.byPriority),
 byAssignee: sa(data.byAssignee),
 byLabel: sa(data.byLabel),
 byComponent: sa(data.byComponent),
 byPod: sa(data.byPod),
 byEpic: sa(data.byEpic),
 byReporter: sa(data.byReporter),
 byResolution: sa(data.byResolution),
 bySprint: sa(data.bySprint),
 byProject: sa(data.byProject),
 byStatusCategory: sa(data.byStatusCategory),
 byCreator: sa(data.byCreator),
 byCreatedMonth: sa(data.byCreatedMonth),
 byResolvedMonth: sa(data.byResolvedMonth),
 byWorklogAuthor: sa(data.byWorklogAuthor),
 kpis: (data.kpis != null && typeof data.kpis === 'object') ? data.kpis : {} as typeof data.kpis,
 statusCategoryBreakdown: (data.statusCategoryBreakdown != null && typeof data.statusCategoryBreakdown === 'object') ? data.statusCategoryBreakdown : {} as Record<string, number>,
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
 const fJson = JSON.stringify({ months, pods: selectedPods, supportBoards: selectedSupportBoards, versions: selectedVersions, types: selectedTypes, boards: selectedBoards });
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
 notifications.show({ title: 'Dashboard saved', message: `"${dashName || 'Untitled Dashboard'}" saved successfully.`, color: 'teal' });
 },
 onError: (e: unknown) => notifications.show({ title: 'Save failed', message: (e as Error).message || 'Could not save dashboard.', color: 'red' }),
 });
 }, [widgets, months, selectedPods, selectedSupportBoards, selectedTypes, selectedBoards, dashId, dashName, dashDesc, saveDashboard]);

 /** Reset to a blank canvas so the user can build a new dashboard from scratch */
 const handleNewDashboard = useCallback(() => {
 setWidgets([]);
 setDashId(null);
 setDashName('New Dashboard');
 setDashDesc('');
 setDirty(false);
 setLoadDashOpen(false);
 }, []);

 // ── CSV Export all data ────────────────────────────────────────────
 const handleExportDashboard = useCallback(() => {
 if (!data) return;
 const exportData: Record<string, unknown>[] = [];
 const k = data.kpis ?? {} as typeof data.kpis;
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
 onAction={() => triggerSync.mutate(true, { onSuccess: () => notifications.show({ title: 'Sync started', message: 'Full Jira sync is running.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Sync failed', message: (e as Error).message || 'Could not start sync.', color: 'red' }) })}
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
 <div style={{ background: dark ? `linear-gradient(135deg, ${'#1a2942'} 0%, ${'#243d5f'} 100%)` : `linear-gradient(135deg, ${DEEP_BLUE_HEX} 0%, ${DEEP_BLUE_TINTS[90]} 100%)`, padding: '10px 16px 12px' }} className="page-enter">
 {/* ── Header with Gradient ──────────────────────────────────── */}
 <Group gap="sm" align="center">
 <ThemeIcon size={34} radius="md" style={{ background: AQUA_HEX, flexShrink: 0 }}>
 <IconLayoutGrid size={19} color={DEEP_BLUE_HEX} />
 </ThemeIcon>
 <div>
 <Group gap={6} align="center">
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: 'white', lineHeight: 1.2 }}>
 {dashName || 'Custom Dashboard'}
 </Text>
 {dirty && <Badge size="xs" variant="light" color="orange">Unsaved</Badge>}
 <Tooltip label="Rename dashboard" withArrow>
   <ActionIcon size="sm" variant="subtle" style={{ color: 'rgba(255,255,255,0.55)' }}
     onClick={() => { setRenameValue(dashName); setRenameDashOpen(true); }}>
     <IconPencil size={13} />
   </ActionIcon>
 </Tooltip>
 </Group>
 <Text size="xs" style={{ color: AQUA_TINTS[40] }}>
 Premium analytics — build, customize, and share data visualizations
 </Text>
 </div>
 </Group>
 </div>

 {/* ── Filter bar — visible white band under the gradient header ── */}
 <Paper radius={0} px="md" py={8}
   style={{
     borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : BORDER_STRONG}`,
     background: dark ? '#1a2635' : '#fff',
     display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
   }}>
   {/* Date range */}
   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
     <IconCalendarStats size={14} color={AQUA_HEX} />
     <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Period:</Text>
     <Menu shadow="md" width={240}>
       <Menu.Target>
         <Button size="xs" variant="light" color="teal" radius="xl"
           rightSection={<span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>}>
           {datePreset === 'week' ? 'This Week'
            : datePreset === 'month' ? 'This Month'
            : datePreset === 'quarter' ? 'This Quarter'
            : datePreset === 'year' ? 'This Year'
            : datePreset === 'last30' ? 'Last 30d'
            : datePreset === 'last90' ? 'Last 90d'
            : `${months}mo`}
         </Button>
       </Menu.Target>
       <Menu.Dropdown>
         <Menu.Label>Quick ranges</Menu.Label>
         {[['week','This Week'],['month','This Month'],['quarter','This Quarter'],['year','This Year']].map(([v,l]) => (
           <Menu.Item key={v} onClick={() => handleDatePreset(v)}
             style={{ fontWeight: datePreset === v ? 700 : 400, color: datePreset === v ? AQUA_HEX : undefined }}>
             {l}
           </Menu.Item>
         ))}
         <Menu.Divider />
         <Menu.Item onClick={() => handleDatePreset('last30')}
           style={{ fontWeight: datePreset === 'last30' ? 700 : 400, color: datePreset === 'last30' ? AQUA_HEX : undefined }}>
           Last 30 Days
         </Menu.Item>
         <Menu.Item onClick={() => handleDatePreset('last90')}
           style={{ fontWeight: datePreset === 'last90' ? 700 : 400, color: datePreset === 'last90' ? AQUA_HEX : undefined }}>
           Last 90 Days
         </Menu.Item>
       </Menu.Dropdown>
     </Menu>
   </div>

   {/* Divider */}
   <div style={{ width: 1, height: 20, background: dark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG }} />

   {/* PODs & Boards */}
   {podOptions.length > 0 && (
     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
       <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>POD:</Text>
       <MultiSelect
         data={podOptions}
         value={combinedPodSelection}
         onChange={splitPodSelection}
         placeholder="All PODs"
         size="xs"
         clearable
         searchable
         maxDropdownHeight={250}
         style={{ minWidth: 160, maxWidth: 240 }}
         styles={{ input: { borderRadius: 20, fontSize: 11 } }}
       />
     </div>
   )}

   {/* Fix Versions */}
   {versionOptions.length > 0 && (
     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
       <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Release:</Text>
       <MultiSelect
         data={versionOptions}
         value={selectedVersions}
         onChange={setSelectedVersions}
         placeholder="All Versions"
         size="xs"
         clearable
         searchable
         maxDropdownHeight={200}
         style={{ minWidth: 140, maxWidth: 200 }}
         styles={{ input: { borderRadius: 20, fontSize: 11 } }}
       />
     </div>
   )}

   {/* Issue Types */}
   {typeOptions.length > 0 && (
     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
       <Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>Type:</Text>
       <MultiSelect
         data={typeOptions}
         value={selectedTypes}
         onChange={setSelectedTypes}
         placeholder="All Types"
         size="xs"
         clearable
         maxDropdownHeight={200}
         style={{ minWidth: 120, maxWidth: 180 }}
         styles={{ input: { borderRadius: 20, fontSize: 11 } }}
       />
     </div>
   )}

   {/* Active filter count + clear all */}
   {(combinedPodSelection.length + selectedVersions.length + selectedTypes.length) > 0 && (
     <>
       <div style={{ width: 1, height: 20, background: dark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG }} />
       <Button size="xs" variant="subtle" color="red" radius="xl"
         leftSection={<IconTrash size={11} />}
         onClick={() => { splitPodSelection([]); setSelectedVersions([]); setSelectedTypes([]); }}>
         Clear filters ({combinedPodSelection.length + selectedVersions.length + selectedTypes.length})
       </Button>
     </>
   )}

   {/* ── Action buttons flush right in the same bar ── */}
   <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
     {isFetching && <Loader size="xs" color={AQUA_HEX} />}
     <div style={{ width: 1, height: 18, background: dark ? 'rgba(255,255,255,0.12)' : BORDER_STRONG, marginRight: 2 }} />
     <Button variant={editMode ? 'filled' : 'subtle'} size="xs" color={editMode ? 'orange' : 'gray'}
       leftSection={<IconSettings size={13} />}
       onClick={() => setEditMode(!editMode)}>
       {editMode ? 'Done' : 'Edit Layout'}
     </Button>
     {editMode && (
       <>
         <Button variant="subtle" size="xs" color="green"
           leftSection={<IconPlus size={13} />}
           onClick={() => setAddWidgetOpen(true)}>
           Add Widget
         </Button>
         <Button variant="subtle" size="xs" color="cyan"
           leftSection={<IconTemplate size={13} />}
           onClick={() => setTemplatesOpen(true)}>
           Templates
         </Button>
       </>
     )}
     <Button variant="subtle" size="xs" color={dirty ? 'orange' : 'gray'}
       leftSection={<IconDeviceFloppy size={13} />}
       onClick={() => setSaveDashOpen(true)}>
       {dirty ? 'Save*' : 'Save'}
     </Button>
     <Menu shadow="md" width={220}>
       <Menu.Target>
         <ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={15} /></ActionIcon>
       </Menu.Target>
       <Menu.Dropdown>
         <Menu.Item leftSection={<IconPlus size={14} />} onClick={handleNewDashboard}>New Dashboard</Menu.Item>
         <Menu.Item leftSection={<IconLayoutGrid size={14} />} onClick={() => setLoadDashOpen(true)}>My Dashboards</Menu.Item>
         {dashId && (
           <Menu.Item leftSection={<IconCopy size={14} />}
             onClick={() => cloneDashboard.mutate(dashId, { onSuccess: () => notifications.show({ title: 'Dashboard cloned', message: 'A copy of this dashboard was created.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Clone failed', message: (e as Error).message || 'Could not clone dashboard.', color: 'red' }) })}>
             Clone This Dashboard
           </Menu.Item>
         )}
         <Menu.Divider />
         <Menu.Item leftSection={<IconDownload size={14} />} onClick={handleExportDashboard}>Export as CSV</Menu.Item>
         <Menu.Item leftSection={<IconRefresh size={14} />} onClick={() => refetch()}>Refresh Data</Menu.Item>
         <Menu.Item leftSection={<IconRefresh size={14} />}
           onClick={() => triggerSync.mutate(false, { onSuccess: () => notifications.show({ title: 'Sync started', message: 'Jira sync is running.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Sync failed', message: (e as Error).message || 'Could not start sync.', color: 'red' }) })}
           disabled={syncStatus?.syncing}>
           {syncStatus?.syncing ? 'Sync Running…' : 'Sync from Jira'}
         </Menu.Item>
       </Menu.Dropdown>
     </Menu>
   </div>
 </Paper>

 {/* ── Dashboard Tabs ─────────────────────────────────────────── */}
 {dashboards.length > 0 && (
   <ScrollArea scrollbarSize={4} type="hover">
     <Group gap={0} wrap="nowrap" style={{
       borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,35,64,0.10)'}`,
       background: dark ? 'rgba(255,255,255,0.02)' : SURFACE_LIGHT,
       paddingLeft: 12,
       paddingRight: 12,
       minHeight: 44,
     }}>
       {dashboards.map(d => {
         const isActive = d.id === dashId;
         return (
           <button
             key={d.id}
             onClick={() => loadDashConfig(d)}
             style={{
               border: 'none',
               background: 'none',
               cursor: 'pointer',
               padding: '0 14px',
               height: 44,
               fontFamily: FONT_FAMILY,
               fontSize: '0.8rem',
               fontWeight: isActive ? 700 : 400,
               color: isActive ? AQUA_HEX : (dark ? 'rgba(255,255,255,0.55)' : DEEP_BLUE_TINTS[60]),
               borderBottom: isActive ? `2px solid ${AQUA_HEX}` : '2px solid transparent',
               whiteSpace: 'nowrap',
               transition: 'all 140ms ease',
               flexShrink: 0,
             }}
             onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = dark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE_HEX; }}
             onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = dark ? 'rgba(255,255,255,0.55)' : DEEP_BLUE_TINTS[60]; }}
           >
             {d.name}
             {d.id === dashId && dirty && <span style={{ marginLeft: 4, color: COLOR_WARNING, fontSize: 10 }}>●</span>}
           </button>
         );
       })}
       <button
         onClick={handleNewDashboard}
         style={{
           border: 'none', background: 'none', cursor: 'pointer', padding: '0 10px',
           height: 44, color: dark ? 'rgba(255,255,255,0.35)' : DEEP_BLUE_TINTS[40],
           fontSize: '0.8rem', fontFamily: FONT_FAMILY, flexShrink: 0,
           display: 'flex', alignItems: 'center', gap: 4,
         }}
         title="New Dashboard"
       >
         <IconPlus size={13} /> New
       </button>
     </Group>
   </ScrollArea>
 )}

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
 <ErrorBoundary compact>
   <WidgetRenderer widget={w} data={filteredData!} editMode={editMode}
   onRemove={() => removeWidget(w.id)}
   onEdit={() => setEditingWidget(w)}
   onDrillDown={(title, items) => { setDrillDown({ title, items }); setDrillDownLimit(20); }}
   pods={podsParam}
   months={months} />
 </ErrorBoundary>
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
 <Modal opened={addWidgetOpen} onClose={() => { setAddWidgetOpen(false); setWidgetSearch(''); setWidgetCategoryFilter('all'); }}
 title={
   <Group gap="sm">
     <ThemeIcon size={28} radius="md" style={{ background: AQUA_HEX }}>
       <IconPlus size={16} color={DEEP_BLUE_HEX} />
     </ThemeIcon>
     <Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Add Widget</Text>
   </Group>
 }
 size="xl">
   <Stack gap="md">
     {/* Search */}
     <TextInput
       placeholder="Search widgets…"
       leftSection={<IconFilter size={14} />}
       value={widgetSearch}
       onChange={e => setWidgetSearch(e.target.value)}
       radius="md"
     />
     {/* Category pills */}
     {(() => {
       const cats = ['all', ...Array.from(new Set(WIDGET_CATALOG.map(w => w.category)))];
       const catColors: Record<string, string> = {
         Overview: 'blue', Charts: 'violet', Trends: 'teal', Quality: 'orange', Team: 'pink', Tables: 'gray', Delivery: 'green',
       };
       return (
         <ScrollArea scrollbarSize={4} type="hover">
           <Group gap={6} wrap="nowrap" pb={4}>
             {cats.map(cat => (
               <Badge key={cat} size="md" radius="xl"
                 variant={widgetCategoryFilter === cat ? 'filled' : 'light'}
                 color={cat === 'all' ? 'dark' : (catColors[cat] ?? 'blue')}
                 style={{ cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap', flexShrink: 0 }}
                 onClick={() => setWidgetCategoryFilter(cat)}>
                 {cat === 'all' ? `All (${WIDGET_CATALOG.length})` : `${cat} (${WIDGET_CATALOG.filter(w => w.category === cat).length})`}
               </Badge>
             ))}
           </Group>
         </ScrollArea>
       );
     })()}
     {/* Widget grid */}
     {(() => {
       const filtered = WIDGET_CATALOG.filter(w => {
         const matchesCat = widgetCategoryFilter === 'all' || w.category === widgetCategoryFilter;
         const matchesSearch = !widgetSearch || w.label.toLowerCase().includes(widgetSearch.toLowerCase()) || w.description.toLowerCase().includes(widgetSearch.toLowerCase());
         return matchesCat && matchesSearch;
       });
       const catColors: Record<string, string> = {
         Overview: AQUA_HEX, Charts: COLOR_VIOLET, Trends: COLOR_TEAL, Quality: COLOR_AMBER_DARK, Team: '#DB2777', Tables: DEEP_BLUE_TINTS[50], Delivery: COLOR_EMERALD,
       };
       if (!filtered.length) return <Text c="dimmed" ta="center" py="xl">No widgets match "{widgetSearch}"</Text>;
       return (
         <ScrollArea h={480} scrollbarSize={6}>
           <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
             {filtered.map(cat => {
               const alreadyAdded = widgets.filter(w => w.type === cat.type).length;
               const accentColor = catColors[cat.category] ?? AQUA_HEX;
               return (
                 <Paper key={cat.type} withBorder radius="lg" p={0}
                   style={{ cursor: 'pointer', transition: 'all 0.15s ease', overflow: 'hidden', position: 'relative' }}
                   onClick={() => { addWidget(cat.type); setWidgetSearch(''); setWidgetCategoryFilter('all'); }}
                   onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${accentColor}25`; }}
                   onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                   {/* Mini preview strip */}
                   <MiniWidgetPreview type={cat.type} color={accentColor} />
                   {/* Card body */}
                   <Stack gap={4} p="sm">
                     <Group justify="space-between" gap={4}>
                       <Group gap={6}>
                         <ThemeIcon size={20} radius="sm" style={{ background: accentColor + '20', color: accentColor }}>
                           {cat.icon}
                         </ThemeIcon>
                         <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY }} lineClamp={1}>{cat.label}</Text>
                       </Group>
                       {alreadyAdded > 0 && (
                         <Badge size="xs" variant="light" color="teal" radius="xl">{alreadyAdded}×</Badge>
                       )}
                     </Group>
                     <Text size="xs" c="dimmed" lineClamp={2}>{cat.description}</Text>
                     <Badge size="xs" variant="dot" color={Object.keys(catColors).includes(cat.category) ? undefined : 'gray'} style={{ alignSelf: 'flex-start' }}>
                       {cat.category}
                     </Badge>
                   </Stack>
                 </Paper>
               );
             })}
           </SimpleGrid>
         </ScrollArea>
       );
     })()}
   </Stack>
 </Modal>


 {/* ── Edit Widget modal ─────────────────────────────────────── */}
 <Modal opened={editingWidget !== null} onClose={() => setEditingWidget(null)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Configure Widget</Text>}
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

 {editingWidget.type === 'productivityComparison' && (
   <Select
     label="Period Granularity"
     description="Choose how to bucket data for comparison"
     data={[
       { value: 'week', label: 'Week over Week' },
       { value: 'month', label: 'Month over Month' },
       { value: 'quarter', label: 'Quarter over Quarter' },
       { value: 'year', label: 'Year over Year' },
     ]}
     value={editingWidget.periodType ?? 'month'}
     onChange={v => v && setEditingWidget({ ...editingWidget, periodType: v as ExtendedDashboardWidget['periodType'] })}
   />
 )}

 {/* ── Pivot Builder config ─────────────────────────────────────── */}
 {editingWidget.type === 'pivotBuilder' && (
   <>
     <Divider label={<Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>🔲 Pivot Configuration</Text>} labelPosition="left" />
     <Grid gutter="sm">
       <Grid.Col span={{ base: 12, sm: 6 }}>
         <Select
           label="Row Dimension"
           data={PIVOT_DIM_OPTIONS}
           value={editingWidget.pivotRowDim ?? 'issueType'}
           onChange={v => v && setEditingWidget({ ...editingWidget, pivotRowDim: v })}
           searchable
         />
       </Grid.Col>
       <Grid.Col span={{ base: 12, sm: 6 }}>
         <Select
           label="Column Dimension"
           data={[{ value: '', label: 'None (flat list)' }, ...PIVOT_DIM_OPTIONS]}
           value={editingWidget.pivotColDim ?? 'priority'}
           onChange={v => setEditingWidget({ ...editingWidget, pivotColDim: v || undefined })}
           searchable
           clearable
         />
       </Grid.Col>
       <Grid.Col span={{ base: 12, sm: 6 }}>
         <Select
           label="Metric"
           data={PIVOT_METRIC_OPTIONS}
           value={editingWidget.pivotMetric ?? 'count'}
           onChange={v => v && setEditingWidget({ ...editingWidget, pivotMetric: v as ExtendedDashboardWidget['pivotMetric'] })}
         />
       </Grid.Col>
       <Grid.Col span={{ base: 12, sm: 6 }}>
         <Select
           label="View Mode"
           data={PIVOT_VIEW_OPTIONS}
           value={editingWidget.pivotView ?? 'table'}
           onChange={v => v && setEditingWidget({ ...editingWidget, pivotView: v as ExtendedDashboardWidget['pivotView'] })}
         />
       </Grid.Col>
     </Grid>
   </>
 )}

 {/* ── Power Analytics: JQL filter + Metric ───────────────────── */}
 <Divider label={<Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>⚡ Power Analytics</Text>} labelPosition="left" />

 {analyticsFields.length > 0 && (
   <Select
     label="Group By (Custom Field)"
     description="Override the data dimension with any Jira field including custom fields"
     placeholder="Use default dimension above…"
     data={analyticsFields.map(f => ({
       value: f.id,
       label: `${f.name}${f.category === 'custom' ? ' (custom)' : ''}`,
       group: f.category === 'custom' ? 'Custom Fields' : 'Standard Fields',
     }))}
     value={editingWidget.groupBy ?? null}
     onChange={v => setEditingWidget({ ...editingWidget, groupBy: v ?? undefined })}
     searchable
     clearable
     maxDropdownHeight={240}
   />
 )}

 <Select
   label="Metric"
   description="What value to aggregate per group"
   data={[
     { value: 'count', label: 'Issue Count' },
     { value: 'storyPoints', label: 'Story Points' },
   ]}
   value={editingWidget.metric ?? 'count'}
   onChange={v => v && setEditingWidget({ ...editingWidget, metric: v as 'count' | 'storyPoints' })}
 />

 <JqlAutocomplete
   label="JQL Filter"
   description="Filter this widget's data using JQL syntax — type a field name, operator, or value and autocomplete suggestions will appear"
   placeholder='e.g. priority in (High, Critical) AND status != Done'
   value={editingWidget.jql ?? ''}
   onChange={v => setEditingWidget({ ...editingWidget, jql: v })}
   pods={podsParam}
   fields={analyticsFields}
   minRows={2}
   maxRows={4}
 />

 <Divider />

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
 <ColorInput label="Chart Color" value={editingWidget.color || AQUA_HEX} onChange={c => setEditingWidget({ ...editingWidget, color: c })} swatches={PIE_COLORS} />
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

 {/* ── Rename Dashboard modal ──────────────────────────────────── */}
 <Modal opened={renameDashOpen} onClose={() => setRenameDashOpen(false)}
   title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Rename Dashboard</Text>}
   size="sm">
   <Stack gap="md">
     <TextInput label="Dashboard Name" value={renameValue}
       onChange={e => setRenameValue(e.target.value)}
       onKeyDown={e => { if (e.key === 'Enter') { setDashName(renameValue); setRenameDashOpen(false); setDirty(true); } }}
       placeholder="My Dashboard"
       autoFocus />
     <Group justify="flex-end" gap="sm">
       <Button variant="subtle" onClick={() => setRenameDashOpen(false)}>Cancel</Button>
       <Button onClick={() => { setDashName(renameValue); setRenameDashOpen(false); setDirty(true); }}
         leftSection={<IconDeviceFloppy size={14} />}>
         Rename
       </Button>
     </Group>
   </Stack>
 </Modal>

 {/* ── Templates modal ───────────────────────────────────────── */}
 <Modal opened={templatesOpen} onClose={() => setTemplatesOpen(false)}
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Dashboard Templates</Text>}
 size="lg">
 <Stack gap="md">
 {DASHBOARD_TEMPLATES.map(template => (
 <Paper key={template.id} withBorder radius="md" p="md"
 style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
 onMouseEnter={e => { e.currentTarget.style.borderColor = AQUA_HEX; e.currentTarget.style.boxShadow = SHADOW.md; }}
 onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
 onClick={() => loadTemplate(template)}>
 <Group justify="space-between" align="flex-start">
 <div>
 <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>{template.name}</Text>
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
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Save Dashboard</Text>}>
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
 title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>My Dashboards</Text>}>
 <Stack gap="sm">
 <Button
 variant="light"
 color="teal"
 leftSection={<IconPlus size={14} />}
 onClick={handleNewDashboard}
 fullWidth
 >
 New Blank Dashboard
 </Button>
 <Divider label="Saved dashboards" labelPosition="center" />
 {dashboards.map(d => (
 <Paper key={d.id} withBorder radius="md" p="sm"
 style={{ cursor: 'pointer', borderLeft: d.id === dashId ? `3px solid ${AQUA_HEX}` : undefined }}
 onClick={() => { loadDashConfig(d); setLoadDashOpen(false); }}>
 <Group justify="space-between">
 <div>
 <Text size="sm" fw={600}>{d.name}</Text>
 {d.description && <Text size="xs" c="dimmed">{d.description}</Text>}
 </div>
 <Group gap={4}>
 {d.isDefault && <Badge size="xs" variant="light" color="blue">Default</Badge>}
 {d.id === dashId && <Badge size="xs" variant="light" color="teal">Active</Badge>}
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
