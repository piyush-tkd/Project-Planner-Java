import {
  IconChartBar, IconChartPie, IconChartLine, IconChartArea,
  IconTable, IconLayoutGrid, IconClock, IconCalendarStats, IconTimeline,
  IconFilter, IconClockHour4, IconNotes, IconHeadset, IconRadar,
  IconChartDots3, IconChartDots, IconSortDescending, IconTarget,
  IconDatabase, IconBrandSpeedtest, IconCalendar, IconChartTreemap,
  IconArrowsRightLeft, IconStars, IconTrendingUp, IconProgressCheck,
} from '@tabler/icons-react';
import {
  AQUA_HEX, COLOR_VIOLET, DEEP_BLUE_HEX, COLOR_AMBER_DARK, COLOR_BLUE_STRONG,
  COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_WARNING,
  } from '../../../../brandTokens';
import { ExtendedDashboardWidget, WidgetCatalogItem } from './types';

/* ── Palette ──────────────────────────────────────────────────────────── */
export const PIE_COLORS = [
  AQUA_HEX, COLOR_VIOLET, DEEP_BLUE_HEX, '#DB2777', COLOR_AMBER_DARK,
  COLOR_EMERALD, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, '#0891B2', '#65A30D',
  '#6366F1', COLOR_WARNING, '#EC4899', '#14B8A6',
];

export const DATA_KEY_OPTIONS = [
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

export const SIZE_OPTIONS = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half' },
  { value: 'third', label: 'Third' },
  { value: 'quarter', label: 'Quarter' },
];

export const SORT_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sp', label: 'Story Points' },
  { value: 'hours', label: 'Hours' },
  { value: 'name', label: 'Name' },
];

export const DIRECTION_OPTIONS = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

export const LIMIT_OPTIONS = [
  { value: '5', label: 'Top 5' },
  { value: '10', label: 'Top 10' },
  { value: '15', label: 'Top 15' },
  { value: '20', label: 'Top 20' },
  { value: '999', label: 'All' },
];

export const GAUGE_PRESETS = [
  { metric: 'bugRatio', label: 'Bug Ratio', unit: '%', greenUpper: 5, yellowUpper: 10, max: 20 },
  { metric: 'avgCycleTimeDays', label: 'Avg Cycle Time', unit: 'd', greenUpper: 5, yellowUpper: 10, max: 30 },
  { metric: 'throughputPerWeek', label: 'Weekly Throughput', unit: '', greenUpper: 10, yellowUpper: 5, max: 30 },
];

/* ── Available widget types for the "Add Widget" picker ──────────────── */
export const WIDGET_CATALOG: WidgetCatalogItem[] = [
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
  { type: 'heatmap', label: 'Activity Heatmap', description: 'Day-of-week × dimension heatmap showing issue concentration', icon: <IconFilter size={16} />, defaultSize: 'half', category: 'Charts' },
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

/* ── Pivot Builder dimension options (Power Query field IDs) ────────────── */
export const PIVOT_DIM_OPTIONS_FLAT = [
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

export const PIVOT_DIM_OPTIONS: ({ group: string; items: { value: string; label: string }[] } | { value: string; label: string })[] = [
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

export const PIVOT_METRIC_OPTIONS = [
  { value: 'count',         label: 'Issue Count' },
  { value: 'storyPoints',   label: 'Story Points' },
  { value: 'hours',         label: 'Hours Logged' },
  { value: 'cycleTimeDays', label: 'Avg Cycle Time (d)' },
];

export const PIVOT_VIEW_OPTIONS = [
  { value: 'table',   label: '⊞ Cross-tab' },
  { value: 'bar',     label: '▦ Bar Chart' },
  { value: 'heatmap', label: '▪ Heatmap' },
];

/* ── Dashboard Templates ───────────────────────────────────────────────── */
export const DASHBOARD_TEMPLATES = [
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
