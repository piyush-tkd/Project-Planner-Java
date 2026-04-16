import { useState, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import {
 Title, Stack, Group, Select, Text, Badge, Box, SimpleGrid, Alert,
 Progress, ThemeIcon, Center, Loader, Paper, Tooltip,
 Table, Anchor, Divider, Button, SegmentedControl, TextInput,
 NumberInput, Slider, Collapse, ActionIcon,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
 IconBrain, IconAlertTriangle, IconCheck, IconInfoCircle,
 IconChevronDown, IconChevronUp, IconExternalLink, IconTrendingUp,
 IconTrendingDown, IconEqual, IconRocket, IconBulb, IconTarget,
 IconArrowRight, IconSearch, IconSortAscending, IconSortDescending,
 IconFilter, IconSubtask, IconAdjustments, IconChartBar, IconDownload,
} from '@tabler/icons-react';

// ── Scope Recommender types ───────────────────────────────────────────────────
interface ScopeRecommendRequest {
 avgVelocity: number;
 backlogPoints: number | null;
 teamCapacity: number;
 projectKey?: string;
}
interface ScopeRecommendResponse {
 recommendedPoints: number;
 confidence: 'HIGH' | 'MEDIUM' | 'LOW';
 riskLevel: 'GREEN' | 'AMBER' | 'RED';
 rationale: string;
 historicalBaseline: number | null;
 sprintsAnalyzed: number | null;
}
import { useSprints } from '../api/sprints';
import { useSprintCalendarIssues, useJiraStatus, type ReleaseMetrics, type IssueRow } from '../api/jira';
import { useCapacityGap } from '../api/reports';
import { useProjectPodMatrix } from '../api/projects';
import { useTimeline } from '../api/timeline';
import { useBauAssumptions } from '../api/pods';
import { COLOR_BLUE, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_ORANGE_ALT, COLOR_ORANGE_DEEP, COLOR_VIOLET, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY, SURFACE_BLUE, SURFACE_BLUE_LIGHT, SURFACE_ERROR_LIGHT, SURFACE_FAINT, SURFACE_LIGHT, SURFACE_ORANGE, SURFACE_VIOLET, TEXT_GRAY, TEXT_SUBTLE} from '../brandTokens';
import type { SprintResponse } from '../types/project';
import type { PodMonthGap, BauAssumptionResponse } from '../types';
import { useDarkMode } from '../hooks/useDarkMode';
import { PPPageLayout } from '../components/pp';

// ── Colour tokens ─────────────────────────────────────────────────────────────

const ISSUE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
 'Story': { bg: SURFACE_VIOLET, text: COLOR_VIOLET },
 'Bug': { bg: SURFACE_ERROR_LIGHT, text: COLOR_ERROR_DARK },
 'Task': { bg: SURFACE_BLUE_LIGHT, text: COLOR_BLUE_STRONG },
 'Sub-task': { bg: SURFACE_LIGHT, text: TEXT_GRAY },
 'Subtask': { bg: SURFACE_LIGHT, text: TEXT_GRAY },
 'Epic': { bg: SURFACE_ORANGE, text: COLOR_ORANGE_DEEP },
 'Improvement': { bg: '#CCFBF1', text: '#0D9488' },
 'New Feature': { bg: '#E0F2FE', text: '#0284C7' },
};

const STATUS_CAT_COLOR: Record<string, string> = {
 'To Do': TEXT_SUBTLE, 'In Progress': COLOR_WARNING, 'Done': COLOR_GREEN,
};

const PRIORITY_ORDER: Record<string, number> = {
 CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4,
};
const PRIORITY_COLORS: Record<string, string> = {
 CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'yellow', LOW: 'gray',
};

const SUBTASK_TYPES = new Set(['Sub-task', 'Subtask', 'Sub-Task']);

// ── Utility helpers ───────────────────────────────────────────────────────────
function businessDays(startDate: string, endDate: string): number {
 let count = 0;
 const current = new Date(startDate + 'T00:00:00');
 const end = new Date(endDate + 'T00:00:00');
 while (current <= end) {
 const day = current.getDay();
 if (day !== 0 && day !== 6) count++;
 current.setDate(current.getDate() + 1);
 }
 return count;
}

function getMonthIndex(
 sprintStartDate: string,
 timelineStartYear: number,
 timelineStartMonth: number,
): number {
 const [yearStr, monthStr] = sprintStartDate.split('-');
 const year = parseInt(yearStr, 10);
 const month = parseInt(monthStr, 10);
 return (year - timelineStartYear) * 12 + (month - timelineStartMonth) + 1;
}

/** Converts a timeline monthIndex (1-based) to a readable label like "Mar 2026". */
function monthIndexToLabel(
 monthIndex: number,
 timelineStartYear: number,
 timelineStartMonth: number,
): string {
 const totalMonths = (timelineStartMonth - 1) + (monthIndex - 1);
 const year = timelineStartYear + Math.floor(totalMonths / 12);
 const month = (totalMonths % 12); // 0-indexed
 const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 return `${monthNames[month]} ${year}`;
}

interface HealthInfo {
 grade: string;
 color: string;
 label: string;
 ringColor: string;
}

function healthScore(utilization: number): HealthInfo {
 if (utilization < 0.6) return { grade: 'A+', color: 'blue', label: 'Under-utilized', ringColor: COLOR_BLUE };
 if (utilization < 0.85) return { grade: 'A', color: 'green', label: 'Healthy', ringColor: COLOR_GREEN };
 if (utilization < 1.0) return { grade: 'B', color: 'teal', label: 'Good', ringColor: '#14B8A6' };
 if (utilization < 1.1) return { grade: 'C', color: 'yellow', label: 'At Capacity', ringColor: COLOR_WARNING };
 if (utilization < 1.25) return { grade: 'D', color: 'orange', label: 'Over Capacity', ringColor: COLOR_ORANGE_ALT };
 return { grade: 'F', color: 'red', label: 'Critical', ringColor: COLOR_ERROR_STRONG };
}

/** Groups issues so subtasks appear immediately after their parent story. */
function groupIssuesWithSubtasks(issues: IssueRow[]): Array<IssueRow & { _isSubtask?: boolean; _depth?: number }> {
 // Separate parents (stories/tasks/bugs) from subtasks
 const parentIssues: IssueRow[] = [];
 const subtasksByParent = new Map<string, IssueRow[]>();
 const orphanSubtasks: IssueRow[] = [];

 for (const issue of issues) {
 if (SUBTASK_TYPES.has(issue.issueType) && issue.parentKey) {
 const subs = subtasksByParent.get(issue.parentKey) ?? [];
 subs.push(issue);
 subtasksByParent.set(issue.parentKey, subs);
 } else {
 parentIssues.push(issue);
 }
 }

 // Build grouped list: parent, then its subtasks
 const result: Array<IssueRow & { _isSubtask?: boolean; _depth?: number }> = [];
 const usedSubtaskKeys = new Set<string>();

 for (const parent of parentIssues) {
 result.push({ ...parent, _isSubtask: false, _depth: 0 });
 const subs = subtasksByParent.get(parent.key);
 if (subs) {
 for (const sub of subs) {
 result.push({ ...sub, _isSubtask: true, _depth: 1 });
 usedSubtaskKeys.add(sub.key);
 }
 }
 }

 // Any subtasks whose parent isn't in this sprint (orphans) go at the end
 subtasksByParent.forEach((subs) => {
 for (const sub of subs) {
 if (!usedSubtaskKeys.has(sub.key)) {
 result.push({ ...sub, _isSubtask: true, _depth: 1 });
 }
 }
 });

 return result;
}

// ── POD recommendation card ───────────────────────────────────────────────────
interface PodCardProps {
 podId: number;
 podName: string;
 monthGap: PodMonthGap | null;
 sprintFraction: number;
 jiraMetrics: ReleaseMetrics | undefined;
 plannedProjects: Array<{
 projectId: number;
 projectName: string;
 priority: string;
 totalHoursWithContingency: number;
 targetReleaseName: string | null;
 status: string;
 }>;
 jiraBaseUrl: string;
 avgBauPct: number; // average BAU percentage for this POD (0–100)
}

function PodRecommenderCard({
 podName, monthGap, sprintFraction, jiraMetrics, plannedProjects, jiraBaseUrl, avgBauPct,
}: PodCardProps) {
 const isDark = useDarkMode();
 const [expanded, setExpanded] = useState(true);
 const [issueFilter, setIssueFilter] = useState<'All' | 'Story' | 'Bug' | 'Task' | 'Sub-task'>('Story');
 const [issueSort, setIssueSort] = useState<'grouped' | 'status' | 'sp' | 'assignee'>('grouped');
 const [issueSearch, setIssueSearch] = useState('');

 // ── Capacity numbers ────────────────────────────────────────────────────────
 const sprintCapacity = monthGap ? monthGap.capacityHours * sprintFraction : 0;
 const sprintDemand = monthGap ? monthGap.demandHours * sprintFraction : 0;
 const utilization = sprintCapacity > 0 ? sprintDemand / sprintCapacity : 0;
 const health = healthScore(utilization);

 // ── Jira issue stats ────────────────────────────────────────────────────────
 const issues: IssueRow[] = Array.isArray(jiraMetrics?.issues) ? jiraMetrics.issues : [];
 const totalSP = jiraMetrics?.totalSP ?? 0;
 const doneSP = jiraMetrics?.doneSP ?? 0;
 const bugs = issues.filter(i => i.issueType === 'Bug').length;
 const stories = issues.filter(i => i.issueType === 'Story').length;
 const tasks = issues.filter(i => i.issueType === 'Task').length;
 const subtasks = issues.filter(i => SUBTASK_TYPES.has(i.issueType)).length;
 const doneCount = issues.filter(i => i.statusCategory === 'Done').length;
 const donePct = issues.length > 0 ? Math.round((doneCount / issues.length) * 100) : 0;

 // Filter first, then sort/group
 const filteredIssues = useMemo(() => {
 let filtered = issues;

 // Type filter
 if (issueFilter === 'Story') filtered = filtered.filter(i => i.issueType === 'Story');
 else if (issueFilter === 'Bug') filtered = filtered.filter(i => i.issueType === 'Bug');
 else if (issueFilter === 'Task') filtered = filtered.filter(i => i.issueType === 'Task');
 else if (issueFilter === 'Sub-task') filtered = filtered.filter(i => SUBTASK_TYPES.has(i.issueType));

 // Text search
 if (issueSearch.trim()) {
 const q = issueSearch.trim().toLowerCase();
 filtered = filtered.filter(i =>
 i.key.toLowerCase().includes(q) ||
 (i.summary ?? '').toLowerCase().includes(q) ||
 (i.assignee ?? '').toLowerCase().includes(q)
 );
 }

 return filtered;
 }, [issues, issueFilter, issueSearch]);

 // Sort & group
 const visibleIssues = useMemo(() => {
 if (issueSort === 'grouped') {
 // Group subtasks under their parents
 // First sort parents: Bugs first, then by SP desc
 const parentFirst = [...filteredIssues].sort((a, b) => {
 if (SUBTASK_TYPES.has(a.issueType) && !SUBTASK_TYPES.has(b.issueType)) return 1;
 if (!SUBTASK_TYPES.has(a.issueType) && SUBTASK_TYPES.has(b.issueType)) return -1;
 if (a.issueType === 'Bug' && b.issueType !== 'Bug') return -1;
 if (b.issueType === 'Bug' && a.issueType !== 'Bug') return 1;
 return b.storyPoints - a.storyPoints;
 });
 return groupIssuesWithSubtasks(parentFirst);
 }

 const sorted = [...filteredIssues] as Array<IssueRow & { _isSubtask?: boolean; _depth?: number }>;
 sorted.forEach(i => { i._isSubtask = SUBTASK_TYPES.has(i.issueType); i._depth = 0; });

 if (issueSort === 'status') {
 const statusOrder: Record<string, number> = { 'In Progress': 0, 'To Do': 1, 'Done': 2 };
 sorted.sort((a, b) => (statusOrder[a.statusCategory] ?? 3) - (statusOrder[b.statusCategory] ?? 3));
 } else if (issueSort === 'sp') {
 sorted.sort((a, b) => b.storyPoints - a.storyPoints);
 } else if (issueSort === 'assignee') {
 sorted.sort((a, b) => (a.assignee ?? '').localeCompare(b.assignee ?? ''));
 }

 return sorted;
 }, [filteredIssues, issueSort]);

 // Sort projects by priority
 const sortedProjects = useMemo(() =>
 [...(plannedProjects ?? [])].sort((a, b) =>
 (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
 ), [plannedProjects]);

 // ── Recommendations ─────────────────────────────────────────────────────────
 const recommendations: Array<{ icon: React.ReactNode; text: string; color: string }> = [];

 if (sprintCapacity > 0) {
 const overHours = sprintDemand - sprintCapacity;
 if (overHours > 5) {
 recommendations.push({
 icon: <IconAlertTriangle size={14} />,
 text: `Over capacity by ~${Math.round(overHours)} hrs — consider deferring lower-priority stories to the next sprint.`,
 color: 'red',
 });
 } else if (utilization < 0.65) {
 const spare = sprintCapacity - sprintDemand;
 recommendations.push({
 icon: <IconBulb size={14} />,
 text: `~${Math.round(spare)} hrs of spare capacity — consider pulling in backlog stories or technical debt.`,
 color: 'blue',
 });
 } else if (utilization >= 0.8 && utilization < 1.0) {
 recommendations.push({
 icon: <IconCheck size={14} />,
 text: 'Sprint load looks well-balanced. Great planning!',
 color: 'green',
 });
 }
 }

 const highPriorityNoIssues = sortedProjects.filter(
 p => (p.priority === 'HIGH' || p.priority === 'CRITICAL') && issues.length === 0,
 );
 if (highPriorityNoIssues.length > 0) {
 recommendations.push({
 icon: <IconTarget size={14} />,
 text: `${highPriorityNoIssues.length} high-priority project(s) planned but no Jira sprint issues found — verify sprint scope in Jira.`,
 color: 'orange',
 });
 }

 if (bugs >= 5) {
 recommendations.push({
 icon: <IconAlertTriangle size={14} />,
 text: `High bug count (${bugs}) — consider dedicating time to bug resolution before adding new stories.`,
 color: 'orange',
 });
 }

 if (issues.length === 0 && plannedProjects.length > 0) {
 recommendations.push({
 icon: <IconInfoCircle size={14} />,
 text: 'No Jira sprint issues found for this sprint window. This POD may be on IP week, or sprint dates may not align.',
 color: 'gray',
 });
 }

 const progressColor =
 utilization > 1.1 ? 'red' :
 utilization > 1.0 ? 'orange' :
 utilization > 0.85 ? 'teal' :
 utilization > 0.6 ? 'green' : 'blue';

 return (
 <Paper withBorder mb="md" style={{ overflow: 'hidden' }}>
 {/* ── Header ─────────────────────────────────────────────────────────── */}
 <Box
 onClick={() => setExpanded(e => !e)}
 style={{ background: DEEP_BLUE, padding: '12px 16px', cursor: 'pointer' }}
 >
 <Group justify="space-between" wrap="nowrap">
 <Group gap="sm" wrap="nowrap">
 <Text fw={700} c="white" size="sm">{podName}</Text>
 {jiraMetrics?.notes && (
 <Text size="xs" c="rgba(255,255,255,0.55)">· {jiraMetrics.notes}</Text>
 )}
 </Group>
 <Group gap="xs" wrap="nowrap">
 <Badge size="sm" color={health.color} variant="filled" fw={800}>
 {health.grade}
 </Badge>
 <Text size="xs" c="rgba(255,255,255,0.75)">{health.label}</Text>
 {expanded ? <IconChevronUp size={14} color="white" /> : <IconChevronDown size={14} color="white" />}
 </Group>
 </Group>
 </Box>

 {expanded && (
 <Box p="md">
 {/* ── Capacity gauge row ─────────────────────────────────────────── */}
 {(() => {
 // Compute raw hours (before BAU) from the BAU-deducted capacity
 const bauFraction = avgBauPct / 100;
 const rawMonthlyHours = monthGap && bauFraction < 1
 ? monthGap.capacityHours / (1 - bauFraction)
 : monthGap?.capacityHours ?? 0;
 const bauMonthlyHours = rawMonthlyHours - (monthGap?.capacityHours ?? 0);
 const rawSprintHours = rawMonthlyHours * sprintFraction;
 const bauSprintHours = bauMonthlyHours * sprintFraction;
 const availableBandwidth = sprintCapacity - sprintDemand;
 const totalJiraHours = jiraMetrics?.totalHoursLogged ?? 0;

 return (
 <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
 {/* Total resource hours (before BAU) */}
 <Box style={{ textAlign: 'center' }}>
 <Tooltip
 label={`Total resource hours: ${Math.round(rawSprintHours)} hrs → BAU (${Math.round(avgBauPct)}%): −${Math.round(bauSprintHours)} hrs → Project available: ${Math.round(sprintCapacity)} hrs`}
 withArrow position="top" multiline w={300}
 >
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>
 Project Bandwidth
 </Text>
 </Tooltip>
 <Text fw={800} size="xl" style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
 {monthGap ? `${Math.round(sprintCapacity)} hrs` : '—'}
 </Text>
 {monthGap && (
 <Text size="xs" c="dimmed">
 of {Math.round(rawSprintHours)} total · {Math.round(avgBauPct)}% BAU
 </Text>
 )}
 </Box>
 {/* Sprint demand (planning matrix) */}
 <Box style={{ textAlign: 'center' }}>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Plan Demand</Text>
 <Text fw={800} size="xl" style={{ color: utilization > 1.0 ? COLOR_ERROR_STRONG : (isDark ? '#fff' : DEEP_BLUE) }}>
 {monthGap ? `${Math.round(sprintDemand)} hrs` : '—'}
 </Text>
 <Text size="xs" c="dimmed">{sortedProjects.length} project(s)</Text>
 </Box>
 {/* Jira sprint load */}
 <Box style={{ textAlign: 'center' }}>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Jira Sprint Load</Text>
 <Text fw={800} size="xl" style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
 {totalSP > 0 ? `${doneSP}/${totalSP} SP` : `${issues.length} issues`}
 </Text>
 <Text size="xs" c="dimmed">
 {donePct}% done · {bugs} bugs
 {totalJiraHours > 0 && ` · ${Math.round(totalJiraHours)}h logged`}
 </Text>
 </Box>
 {/* Available bandwidth */}
 <Box style={{ textAlign: 'center' }}>
 <Tooltip
 label="Project bandwidth minus planned demand. Represents hours not yet allocated to projects."
 withArrow position="top" multiline w={260}
 >
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Available</Text>
 </Tooltip>
 <Text fw={800} size="xl" style={{
 color: availableBandwidth < 0 ? COLOR_ERROR_STRONG : availableBandwidth > sprintCapacity * 0.35 ? COLOR_BLUE : COLOR_GREEN,
 }}>
 {monthGap ? `${Math.round(availableBandwidth)} hrs` : '—'}
 </Text>
 {monthGap && sprintCapacity > 0 && (
 <Text size="xs" c="dimmed">
 {availableBandwidth < 0 ? 'over-committed' : `${Math.round((availableBandwidth / sprintCapacity) * 100)}% free`}
 </Text>
 )}
 </Box>
 </SimpleGrid>
 );
 })()}

 {/* ── Progress bar ───────────────────────────────────────────────── */}
 {monthGap && sprintCapacity > 0 && utilization > 0.01 && (
 <Box mb="md">
 <Group justify="space-between" mb={4}>
 <Text size="xs" c="dimmed">Sprint utilization</Text>
 <Text size="xs" fw={700} c={progressColor}>
 {Math.round(utilization * 100)}%
 {utilization > 1.0 && <span> ⚠ Over capacity</span>}
 </Text>
 </Group>
 <Progress
 value={Math.min(utilization * 100, 100)}
 color={progressColor}
 size="lg"
 radius="sm"
 />
 {utilization > 1.0 && (
 <Progress
 value={Math.min((utilization - 1.0) * 100 / 0.25, 100)}
 color="red"
 size="sm"
 radius="sm"
 mt={2}
 />
 )}
 </Box>
 )}

 {/* ── Recommendations ────────────────────────────────────────────── */}
 {recommendations.length > 0 && (
 <Stack gap="xs" mb="md">
 {recommendations.map((r, i) => (
 <Alert key={i} icon={r.icon} color={r.color} variant="light" py={6} px="sm">
 <Text size="xs">{r.text}</Text>
 </Alert>
 ))}
 </Stack>
 )}

 <Divider mb="sm" />

 {/* ── Planned projects ───────────────────────────────────────────── */}
 {sortedProjects.length > 0 && (
 <Box mb="md">
 <Text size="sm" fw={700} mb="xs" c="dimmed">📋 Planned Projects this Sprint</Text>
 <Table fz="xs" withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Project</Table.Th>
 <Table.Th>Priority</Table.Th>
 <Table.Th>Status</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Sprint Hrs (est.)</Table.Th>
 <Table.Th>Target Release</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sortedProjects.map((p, i) => (
 <Table.Tr key={i}>
 <Table.Td fw={500}>{p.projectName}</Table.Td>
 <Table.Td>
 <Badge size="xs" color={PRIORITY_COLORS[p.priority] ?? 'gray'} variant="filled">
 {p.priority}
 </Badge>
 </Table.Td>
 <Table.Td c="dimmed">{p.status}</Table.Td>
 <Table.Td ta="right" fw={600}>
 {Math.round(p.totalHoursWithContingency * sprintFraction)} hrs
 </Table.Td>
 <Table.Td c="dimmed"><Text size="xs">{p.targetReleaseName ?? '—'}</Text></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </Box>
 )}

 {/* ── Jira sprint issues ─────────────────────────────────────────── */}
 {issues.length > 0 && (
 <Box>
 <Group justify="space-between" mb="xs" align="center">
 <Text size="sm" fw={700} c="dimmed">🎯 Jira Sprint Issues</Text>
 <SegmentedControl
 size="xs"
 value={issueFilter}
 onChange={v => setIssueFilter(v as typeof issueFilter)}
 data={[
 { value: 'All', label: `All (${issues.length})` },
 { value: 'Story', label: `Stories (${stories})` },
 { value: 'Bug', label: `Bugs (${bugs})` },
 { value: 'Task', label: `Tasks (${tasks})` },
 ...(subtasks > 0 ? [{ value: 'Sub-task', label: `Sub-tasks (${subtasks})` }] : []),
 ]}
 />
 </Group>

 {/* Search and sort bar */}
 <Group mb="xs" gap="xs">
 <TextInput
 placeholder="Search by key, summary, assignee…"
 size="xs"
 leftSection={<IconSearch size={12} />}
 value={issueSearch}
 onChange={e => setIssueSearch(e.currentTarget.value)}
 style={{ flex: 1, maxWidth: 280 }}
 />
 <SegmentedControl
 size="xs"
 value={issueSort}
 onChange={v => setIssueSort(v as typeof issueSort)}
 data={[
 { value: 'grouped', label: 'Grouped' },
 { value: 'status', label: 'Status' },
 { value: 'sp', label: 'SP' },
 { value: 'assignee', label: 'Assignee' },
 ]}
 />
 </Group>

 <Table fz="xs" withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 90 }}>Key</Table.Th>
 <Table.Th style={{ minWidth: 70 }}>Type</Table.Th>
 <Table.Th style={{ minWidth: 280 }}>Summary</Table.Th>
 <Table.Th style={{ minWidth: 80 }}>Status</Table.Th>
 <Table.Th style={{ minWidth: 110 }}>Assignee</Table.Th>
 <Table.Th style={{ minWidth: 40, textAlign: 'right' }}>SP</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {visibleIssues.map((issue) => {
 const ts = ISSUE_TYPE_COLORS[issue.issueType] ?? { bg: SURFACE_BLUE, text: COLOR_BLUE };
 const sc = STATUS_CAT_COLOR[issue.statusCategory] ?? TEXT_SUBTLE;
 const done = issue.statusCategory === 'Done';
 const isChild = issue._isSubtask && issue._depth === 1;
 return (
 <Table.Tr
 key={issue.key}
 style={{
 opacity: done ? 0.7 : 1,
 background: isChild ? (isDark ? 'rgba(255,255,255,0.04)' : SURFACE_FAINT) : undefined,
 }}
 >
 <Table.Td>
 <Group gap={3} wrap="nowrap">
 {isChild && (
 <Text c="dimmed" size="xs" style={{ userSelect: 'none' }}>↳</Text>
 )}
 <Anchor href={`${jiraBaseUrl}/browse/${issue.key}`} target="_blank" fw={600} size="xs">
 {issue.key}
 </Anchor>
 <IconExternalLink size={10} color={TEXT_SUBTLE} />
 </Group>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" style={{
   background: isDark ? `${ts.text}22` : ts.bg,
   color: ts.text,
   border: `1px solid ${ts.text}33`,
 }}>
 {issue.issueType}
 </Badge>
 </Table.Td>
 <Table.Td style={{ maxWidth: 320 }}>
 <Tooltip label={issue.summary ?? ''} disabled={(issue.summary?.length ?? 0) < 60} withArrow multiline w={320}>
 <Text
 size="xs"
 style={{
 overflow: 'hidden',
 textOverflow: 'ellipsis',
 whiteSpace: 'nowrap',
 maxWidth: 300,
 paddingLeft: isChild ? 8 : 0,
 }}
 >
 {done && <IconCheck size={10} style={{ marginRight: 3, color: COLOR_GREEN, display: 'inline', verticalAlign: 'middle' }} />}
 {issue.summary}
 </Text>
 </Tooltip>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="dot" style={{ '--badge-dot-color': sc } as React.CSSProperties}>
 {issue.statusName}
 </Badge>
 </Table.Td>
 <Table.Td c="dimmed"><Text size="xs">{issue.assignee}</Text></Table.Td>
 <Table.Td ta="right">
 {issue.storyPoints > 0
 ? <Badge size="xs" variant="outline" color="violet">{issue.storyPoints}</Badge>
 : <Text size="xs" c="dimmed">—</Text>}
 </Table.Td>
 </Table.Tr>
 );
 })}
 {visibleIssues.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={6}>
 <Text ta="center" c="dimmed" py="sm" size="xs">No issues match filter.</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </Box>
 )}

 {issues.length === 0 && (
 <Center py="sm">
 <Text size="sm" c="dimmed">No Jira sprint issues found for this sprint window.</Text>
 </Center>
 )}
 </Box>
 )}
 </Paper>
 );
}

// ── Page-level filter/sort types ──────────────────────────────────────────────
type PodHealthFilter = 'all' | 'over' | 'under' | 'healthy' | 'at-capacity';
type PodSortBy = 'name' | 'utilization-asc' | 'utilization-desc' | 'issues-desc' | 'capacity-desc';

/** Unified pod that merges planning Pod (capacity) and JiraPod (Jira issues) by name. */
interface UnifiedPod {
 podName: string;
 capacityPodId: number | null; // planning Pod.id (for gap / projects / BAU lookups)
 jiraPodId: number | null; // JiraPod.id (for jira metrics lookups)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SprintPlanningRecommenderPage() {
 const isDark = useDarkMode();
 const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

 // ── Scope Recommender state ─────────────────────────────────────────────────
 const [recOpen, setRecOpen] = useState(false);
 const [recVelocity, setRecVelocity] = useState<number | string>(40);
 const [recBacklog, setRecBacklog] = useState<number | string>('');
 const [recCapacity, setRecCapacity] = useState<number>(100);
 const [recProjectKey, setRecProjectKey] = useState('');
 const [recResult, setRecResult] = useState<ScopeRecommendResponse | null>(null);

 const recommendMutation = useMutation<ScopeRecommendResponse, Error, ScopeRecommendRequest>({
   mutationFn: (body) => apiClient.post('/sprints/recommend', body).then(r => r.data),
   onSuccess: (data) => setRecResult(data),
   onError: (e: unknown) => notifications.show({ title: 'Recommendation failed', message: (e as Error).message || 'Could not generate recommendation.', color: 'red' }),
  });
 const [podHealthFilter, setPodHealthFilter] = useState<PodHealthFilter>('all');
 const [podSortBy, setPodSortBy] = useState<PodSortBy>('name');
 const [podSearch, setPodSearch] = useState('');

 const { data: sprints = [], isLoading: sprintsLoading } = useSprints();
 const { data: capacityGap } = useCapacityGap('hours');
 const { data: matrix = [] } = useProjectPodMatrix();
 const { data: timeline } = useTimeline();
 const { data: jiraStatus } = useJiraStatus();
 const { data: bauAssumptions = [] } = useBauAssumptions();
 const jiraBaseUrl = jiraStatus?.baseUrl ?? '';

 // Compute average BAU % per POD (average across roles)
 const bauByPodId = useMemo(() => {
 const map = new Map<number, number>();
 const podRoles = new Map<number, number[]>();
 for (const bau of bauAssumptions) {
 if (!podRoles.has(bau.podId)) podRoles.set(bau.podId, []);
 podRoles.get(bau.podId)!.push(bau.bauPct);
 }
 podRoles.forEach((pcts, podId) => {
 const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length;
 map.set(podId, avg);
 });
 return map;
 }, [bauAssumptions]);

 // Find the selected sprint
 const selectedSprint = useMemo(
 () => (sprints ?? []).find(s => String(s.id) === selectedSprintId) ?? null,
 [sprints, selectedSprintId],
 );

 // Auto-select the current/next upcoming sprint on load
 const today = new Date().toISOString().slice(0, 10);
 const defaultSprint = useMemo(() => {
 if (selectedSprintId !== null) return null;
 const safeSprints = sprints ?? [];
 const current = safeSprints.find(s => s.startDate && s.endDate && s.startDate <= today && s.endDate >= today);
 if (current) return current;
 return safeSprints
 .filter(s => s.startDate && s.startDate > today)
 .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0] ?? null;
 }, [sprints, today, selectedSprintId]);

 const activeSprint = selectedSprint ?? defaultSprint;

 // Sprint business days and fraction of month
 const sprintDays = useMemo(() =>
 activeSprint ? businessDays(activeSprint.startDate, activeSprint.endDate) : 0,
 [activeSprint],
 );
 const BUSINESS_DAYS_PER_MONTH = 22;
 const sprintFraction = sprintDays / BUSINESS_DAYS_PER_MONTH;

 // Month index for this sprint
 const sprintMonthIndex = useMemo(() => {
 if (!activeSprint || !timeline) return null;
 return getMonthIndex(activeSprint.startDate, timeline.startYear, timeline.startMonth);
 }, [activeSprint, timeline]);

 // Readable month label (e.g. "Mar 2026")
 const sprintMonthLabel = useMemo(() => {
 if (sprintMonthIndex === null || !timeline) return null;
 return monthIndexToLabel(sprintMonthIndex, timeline.startYear, timeline.startMonth);
 }, [sprintMonthIndex, timeline]);

 // Load Jira issues for the selected sprint
 const jiraEnabled = !!activeSprint;
 const { data: jiraData = [], isLoading: jiraLoading, isFetching: jiraFetching } =
 useSprintCalendarIssues(
 activeSprint?.startDate ?? '',
 activeSprint?.endDate ?? '',
 jiraEnabled,
 );

 // ── Unified POD list ─────────────────────────────────────────────────────
 // Planning (capacity) and Jira use DIFFERENT pod tables with different IDs.
 // We merge by normalised pod name so each pod appears exactly once.
 const allPods = useMemo<UnifiedPod[]>(() => {
 const byName = new Map<string, UnifiedPod>();

 // Add capacity-based pods
 if (capacityGap) {
 const seen = new Set<number>();
 (capacityGap.gaps ?? []).forEach(g => {
 if (!seen.has(g.podId)) {
 seen.add(g.podId);
 const key = g.podName.trim().toLowerCase();
 const existing = byName.get(key);
 if (existing) {
 existing.capacityPodId = g.podId;
 } else {
 byName.set(key, { podName: g.podName, capacityPodId: g.podId, jiraPodId: null });
 }
 }
 });
 }

 // Merge in Jira pods by name
 (jiraData ?? []).forEach(m => {
 if (m.podId != null) {
 const key = m.podDisplayName.trim().toLowerCase();
 const existing = byName.get(key);
 if (existing) {
 existing.jiraPodId = m.podId;
 } else {
 byName.set(key, { podName: m.podDisplayName, capacityPodId: null, jiraPodId: m.podId });
 }
 }
 });

 return Array.from(byName.values()).sort((a, b) => a.podName.localeCompare(b.podName));
 }, [capacityGap, jiraData]);

 // Get month gap for each POD (keyed by planning podId)
 const gapByPod = useMemo(() => {
 const map = new Map<number, PodMonthGap>();
 if (capacityGap && sprintMonthIndex !== null) {
 (capacityGap.gaps ?? [])
 .filter(g => g.monthIndex === sprintMonthIndex)
 .forEach(g => map.set(g.podId, g));
 }
 return map;
 }, [capacityGap, sprintMonthIndex]);

 // Jira metrics by POD (keyed by jira podId)
 const jiraByPod = useMemo(() => {
 const map = new Map<number, ReleaseMetrics>();
 (jiraData ?? []).forEach(m => {
 if (m.podId != null) map.set(m.podId, m);
 });
 return map;
 }, [jiraData]);

 // Planned projects by POD for the sprint's month (keyed by planning podId)
 const projectsByPod = useMemo(() => {
 const map = new Map<number, typeof matrix>();
 if (!sprintMonthIndex) return map;
 (matrix ?? [])
 .filter(m => {
 if (m.status === 'COMPLETED' || m.status === 'CANCELLED') return false;
 const startM = m.podStartMonth ?? m.projectStartMonth;
 const endM = startM + (m.durationOverride ?? m.projectDurationMonths) - 1;
 return sprintMonthIndex >= startM && sprintMonthIndex <= endM;
 })
 .forEach(m => {
 if (!map.has(m.podId)) map.set(m.podId, []);
 map.get(m.podId)!.push(m);
 });
 return map;
 }, [matrix, sprintMonthIndex]);

 // Compute utilization per unified pod (used for filtering & sorting)
 const podUtilization = useMemo(() => {
 const map = new Map<string, number>(); // keyed by podName
 allPods.forEach(p => {
 if (p.capacityPodId != null) {
 const gap = gapByPod.get(p.capacityPodId);
 if (gap && gap.capacityHours > 0) {
 map.set(p.podName, gap.demandHours / gap.capacityHours);
 return;
 }
 }
 map.set(p.podName, 0);
 });
 return map;
 }, [allPods, gapByPod]);

 // Count pods that are jira-only (no capacity data)
 const jiraOnlyCount = allPods.filter(p => p.capacityPodId === null).length;

 // Summary stats (only count pods that have capacity data)
 const capacityPods = allPods.filter(p => p.capacityPodId !== null);
 const overCount = capacityPods.filter(p => {
 const gap = gapByPod.get(p.capacityPodId!);
 if (!gap || sprintFraction === 0) return false;
 return (gap.demandHours * sprintFraction) > (gap.capacityHours * sprintFraction);
 }).length;

 const underCount = capacityPods.filter(p => {
 const gap = gapByPod.get(p.capacityPodId!);
 if (!gap || sprintFraction === 0) return false;
 const util = gap.demandHours / (gap.capacityHours || 1);
 return util < 0.65;
 }).length;

 const healthyCount = capacityPods.length - overCount - underCount;

 // Sprint select options
 const sprintOptions = useMemo(() => {
 const safeSprints = sprints ?? [];
 const grouped = {
 current: safeSprints.filter(s => s.type !== 'IP_WEEK' && s.startDate && s.endDate && s.startDate <= today && s.endDate >= today),
 upcoming: safeSprints.filter(s => s.type !== 'IP_WEEK' && s.startDate && s.startDate > today).slice(0, 8),
 past: safeSprints.filter(s => s.type !== 'IP_WEEK' && s.endDate && s.endDate < today).slice(-5).reverse(),
 };
 const opts: Array<{ group: string; items: Array<{ value: string; label: string }> }> = [];
 if (grouped.current.length > 0)
 opts.push({ group: 'Current', items: grouped.current.map(s => ({ value: String(s.id), label: `🟢 ${s.name} (current)` })) });
 if (grouped.upcoming.length > 0)
 opts.push({ group: 'Upcoming', items: grouped.upcoming.map(s => ({ value: String(s.id), label: `📅 ${s.name}` })) });
 if (grouped.past.length > 0)
 opts.push({ group: 'Past', items: grouped.past.map(s => ({ value: String(s.id), label: `🕘 ${s.name}` })) });
 return opts;
 }, [sprints, today]);

 const isLoading = sprintsLoading || jiraLoading || jiraFetching;

 function formatDate(d: string) {
 return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
 }

 // Filter & sort PODs at the page level
 const filteredSortedPods = useMemo(() => {
 let result = [...allPods];

 // Text search
 if (podSearch.trim()) {
 const q = podSearch.trim().toLowerCase();
 result = result.filter(p => p.podName.toLowerCase().includes(q));
 }

 // Health filter
 if (podHealthFilter !== 'all') {
 result = result.filter(p => {
 const util = podUtilization.get(p.podName) ?? 0;
 switch (podHealthFilter) {
 case 'over': return util >= 1.0;
 case 'under': return util < 0.65;
 case 'healthy': return util >= 0.65 && util < 1.0;
 case 'at-capacity': return util >= 0.85 && util < 1.1;
 default: return true;
 }
 });
 }

 // Sort
 result.sort((a, b) => {
 const utilA = podUtilization.get(a.podName) ?? 0;
 const utilB = podUtilization.get(b.podName) ?? 0;
 const issuesA = (a.jiraPodId != null ? jiraByPod.get(a.jiraPodId)?.totalIssues : 0) ?? 0;
 const issuesB = (b.jiraPodId != null ? jiraByPod.get(b.jiraPodId)?.totalIssues : 0) ?? 0;
 const capA = (a.capacityPodId != null ? gapByPod.get(a.capacityPodId)?.capacityHours : 0) ?? 0;
 const capB = (b.capacityPodId != null ? gapByPod.get(b.capacityPodId)?.capacityHours : 0) ?? 0;

 switch (podSortBy) {
 case 'utilization-desc': return utilB - utilA;
 case 'utilization-asc': return utilA - utilB;
 case 'issues-desc': return issuesB - issuesA;
 case 'capacity-desc': return capB - capA;
 default: return a.podName.localeCompare(b.podName);
 }
 });

 return result;
 }, [allPods, podSearch, podHealthFilter, podSortBy, podUtilization, jiraByPod, gapByPod]);

 // CSV export function
 const exportSprintCsv = () => {
 const headers = ['POD Name', 'Project Capacity (hrs)', 'Plan Demand (hrs)', 'Utilization', 'Health Grade', 'Status'];
 const rows = filteredSortedPods.map(pod => {
 const gap = pod.capacityPodId != null ? gapByPod.get(pod.capacityPodId) : null;
 const util = podUtilization.get(pod.podName) ?? 0;
 const health = healthScore(util);
 const capacity = gap ? Math.round(gap.capacityHours * sprintFraction) : 0;
 const demand = gap ? Math.round(gap.demandHours * sprintFraction) : 0;
 const utilPct = (util * 100).toFixed(1);
 return [
 pod.podName,
 capacity,
 demand,
 `${utilPct}%`,
 health.grade,
 health.label,
 ].map(v => `"${v}"`).join(',');
 });
 const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `sprint-plan-${activeSprint?.name || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 notifications.show({ title: 'Export complete', message: `CSV exported with ${filteredSortedPods.length} POD(s).`, color: 'green' });
 };

 return (
 <PPPageLayout title="Sprint Planning" subtitle="AI-powered scope recommendations based on team capacity" animate>
 <Stack className="page-enter stagger-children">
 {/* ── Header ─────────────────────────────────────────────────────────── */}
 <Group justify="space-between" align="flex-start" className="slide-in-left">
 <Group gap="sm">
 </Group>
 <Select
 w={320}
 placeholder="Select a sprint to analyse…"
 data={sprintOptions}
 value={selectedSprintId ?? (defaultSprint ? String(defaultSprint.id) : null)}
 onChange={setSelectedSprintId}
 searchable
 clearable
 />
 </Group>

 {/* ── Sprint info banner ─────────────────────────────────────────────── */}
 {activeSprint && (
 <Alert icon={<IconRocket size={16} />} color="violet" variant="light">
 <Group gap="xl" wrap="wrap">
 <Box>
 <Text size="xs" fw={600} tt="uppercase" c="dimmed">Sprint</Text>
 <Text size="sm" fw={700}>{activeSprint.name}</Text>
 </Box>
 <Box>
 <Text size="xs" fw={600} tt="uppercase" c="dimmed">Dates</Text>
 <Text size="sm">{formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)}</Text>
 </Box>
 <Box>
 <Text size="xs" fw={600} tt="uppercase" c="dimmed">Business Days</Text>
 <Text size="sm" fw={700}>{sprintDays} days ({Math.round(sprintFraction * 100)}% of month)</Text>
 </Box>
 {sprintMonthIndex !== null && (
 <Box>
 <Text size="xs" fw={600} tt="uppercase" c="dimmed">Timeline Month</Text>
 <Text size="sm" fw={700}>{sprintMonthLabel} — {gapByPod.size > 0 ? 'capacity data loaded' : 'no capacity data'}</Text>
 </Box>
 )}
 </Group>
 </Alert>
 )}

 {/* ── Scope Recommender panel ───────────────────────────────────────── */}
 <Paper withBorder radius="md" p="md">
   <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => setRecOpen(o => !o)}>
     <Group gap="sm">
       <ThemeIcon size="md" radius="sm" color="indigo" variant="light">
         <IconChartBar size={16} />
       </ThemeIcon>
       <Box>
         <Text size="sm" fw={700}>Scope Recommender</Text>
         <Text size="xs" c="dimmed">Get an AI-assisted story-point target based on velocity, backlog, and team capacity</Text>
       </Box>
     </Group>
     <ActionIcon variant="subtle" color="dimmed" size="sm">
       {recOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
     </ActionIcon>
   </Group>

   <Collapse in={recOpen}>
     <Divider my="sm" />
     <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
       <NumberInput
         label="Avg velocity (pts/sprint)"
         description="Last 3 sprints average"
         placeholder="e.g. 40"
         min={0}
         max={500}
         value={recVelocity}
         onChange={setRecVelocity}
         size="sm"
       />
       <NumberInput
         label="Backlog size (pts)"
         description="Ready backlog — optional"
         placeholder="e.g. 120"
         min={0}
         max={9999}
         value={recBacklog}
         onChange={setRecBacklog}
         size="sm"
       />
       <Box>
         <Text size="sm" fw={500} mb={4}>Team capacity: <b>{recCapacity}%</b></Text>
         <Text size="xs" c="dimmed" mb="xs">Adjust for PTO, ceremonies, on-call</Text>
         <Slider
           min={10}
           max={100}
           step={5}
           value={recCapacity}
           onChange={setRecCapacity}
           marks={[
             { value: 50, label: '50%' },
             { value: 75, label: '75%' },
             { value: 100, label: '100%' },
           ]}
           color="indigo"
         />
       </Box>
       <TextInput
         label="Project key (optional)"
         description="Enriches with Jira sprint history"
         placeholder="e.g. PROJ"
         value={recProjectKey}
         onChange={e => setRecProjectKey(e.currentTarget.value)}
         size="sm"
       />
     </SimpleGrid>

     <Group mt="md" justify="flex-end">
       <Button
         size="sm"
         color="indigo"
         leftSection={<IconAdjustments size={14} />}
         loading={recommendMutation.isPending}
         onClick={() => recommendMutation.mutate({
           avgVelocity: Number(recVelocity) || 0,
           backlogPoints: recBacklog !== '' ? Number(recBacklog) : null,
           teamCapacity: recCapacity / 100,
           projectKey: recProjectKey.trim() || undefined,
         })}
       >
         Get Recommendation
       </Button>
     </Group>

     {recommendMutation.isError && (
       <Alert color="red" icon={<IconAlertTriangle size={14} />} mt="sm">
         Failed to get recommendation. Please try again.
       </Alert>
     )}

     {recResult && !recommendMutation.isPending && (
       <Paper
         withBorder
         radius="md"
         p="md"
         mt="sm"
         style={{
           borderColor: recResult.riskLevel === 'GREEN' ? 'var(--mantine-color-green-4)'
             : recResult.riskLevel === 'AMBER' ? 'var(--mantine-color-yellow-4)'
             : 'var(--mantine-color-red-4)',
           borderWidth: 2,
         }}
       >
         <Group justify="space-between" align="flex-start" wrap="nowrap">
           <Box>
             <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={2}>Recommended Scope</Text>
             <Group gap="sm" align="baseline">
               <Text size="xl" fw={900} style={{ fontSize: 36, lineHeight: 1 }}>
                 {recResult.recommendedPoints}
               </Text>
               <Text size="sm" c="dimmed">story points</Text>
             </Group>
           </Box>
           <Stack gap="xs" align="flex-end">
             <Badge
               size="lg"
               variant="filled"
               color={recResult.confidence === 'HIGH' ? 'green' : recResult.confidence === 'MEDIUM' ? 'yellow' : 'gray'}
             >
               {recResult.confidence} confidence
             </Badge>
             <Badge
               size="sm"
               variant="light"
               color={recResult.riskLevel === 'GREEN' ? 'green' : recResult.riskLevel === 'AMBER' ? 'yellow' : 'red'}
             >
               Risk: {recResult.riskLevel}
             </Badge>
           </Stack>
         </Group>
         <Text size="sm" c="dimmed" mt="sm">{recResult.rationale}</Text>
         {recResult.sprintsAnalyzed != null && recResult.sprintsAnalyzed > 0 && (
           <Text size="xs" c="dimmed" mt={4}>
             Based on {recResult.sprintsAnalyzed} closed sprint{recResult.sprintsAnalyzed !== 1 ? 's' : ''} from Jira history.
           </Text>
         )}
       </Paper>
     )}
   </Collapse>
 </Paper>

 {/* ── Summary stats row ──────────────────────────────────────────────── */}
 {allPods.length > 0 && activeSprint && (
 <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
 <Paper
 withBorder p="sm" ta="center"
 style={{ cursor: 'pointer', borderColor: podHealthFilter === 'all' ? (isDark ? 'rgba(255,255,255,0.55)' : DEEP_BLUE) : undefined }}
 onClick={() => setPodHealthFilter('all')}
 >
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">PODs</Text>
 <Text fw={800} size="xl" style={{ color: isDark ? '#fff' : DEEP_BLUE }}>{allPods.length}</Text>
 {jiraOnlyCount > 0 && (
 <Text size="xs" c="dimmed">{capacityPods.length} with capacity · {jiraOnlyCount} Jira only</Text>
 )}
 </Paper>
 <Paper
 withBorder p="sm" ta="center"
 style={{ cursor: 'pointer', borderColor: podHealthFilter === 'over' ? COLOR_ERROR_STRONG : overCount > 0 ? '#EF444433' : undefined }}
 onClick={() => setPodHealthFilter(f => f === 'over' ? 'all' : 'over')}
 >
 <Group gap="xs" justify="center" mb={2}>
 <IconTrendingUp size={14} color={COLOR_ERROR_STRONG} />
 <Text size="xs" c="red" fw={600} tt="uppercase">Over Capacity</Text>
 </Group>
 <Text fw={800} size="xl" c={overCount > 0 ? 'red' : 'dimmed'}>{overCount}</Text>
 </Paper>
 <Paper
 withBorder p="sm" ta="center"
 style={{ cursor: 'pointer', borderColor: podHealthFilter === 'under' ? COLOR_BLUE : underCount > 0 ? '#3B82F633' : undefined }}
 onClick={() => setPodHealthFilter(f => f === 'under' ? 'all' : 'under')}
 >
 <Group gap="xs" justify="center" mb={2}>
 <IconTrendingDown size={14} color={COLOR_BLUE} />
 <Text size="xs" c="blue" fw={600} tt="uppercase">Under-utilized</Text>
 </Group>
 <Text fw={800} size="xl" c={underCount > 0 ? 'blue' : 'dimmed'}>{underCount}</Text>
 </Paper>
 <Paper
 withBorder p="sm" ta="center"
 style={{ cursor: 'pointer', borderColor: podHealthFilter === 'healthy' ? COLOR_GREEN : '#22C55E33' }}
 onClick={() => setPodHealthFilter(f => f === 'healthy' ? 'all' : 'healthy')}
 >
 <Group gap="xs" justify="center" mb={2}>
 <IconEqual size={14} color={COLOR_GREEN} />
 <Text size="xs" c="green" fw={600} tt="uppercase">Healthy</Text>
 </Group>
 <Text fw={800} size="xl" c="green">{healthyCount}</Text>
 </Paper>
 </SimpleGrid>
 )}

 {/* ── Page-level filter bar ──────────────────────────────────────────── */}
 {!isLoading && activeSprint && allPods.length > 0 && (
 <Group gap="sm">
 <TextInput
 placeholder="Search PODs…"
 size="xs"
 leftSection={<IconSearch size={12} />}
 value={podSearch}
 onChange={e => setPodSearch(e.currentTarget.value)}
 style={{ flex: 1, maxWidth: 240 }}
 />
 <Select
 size="xs"
 placeholder="Sort by…"
 value={podSortBy}
 onChange={v => setPodSortBy((v as PodSortBy) ?? 'name')}
 data={[
 { value: 'name', label: 'Name (A→Z)' },
 { value: 'utilization-desc', label: 'Utilization (High→Low)' },
 { value: 'utilization-asc', label: 'Utilization (Low→High)' },
 { value: 'issues-desc', label: 'Jira Issues (Most)' },
 { value: 'capacity-desc', label: 'Capacity (Largest)' },
 ]}
 w={200}
 />
 {podHealthFilter !== 'all' && (
 <Badge
 size="sm"
 variant="light"
 color="violet"
 style={{ cursor: 'pointer' }}
 rightSection={<Text size="xs" ml={2}>✕</Text>}
 onClick={() => setPodHealthFilter('all')}
 >
 {podHealthFilter === 'over' ? 'Over Capacity' :
 podHealthFilter === 'under' ? 'Under-utilized' :
 podHealthFilter === 'at-capacity' ? 'At Capacity' : 'Healthy'}
 </Badge>
 )}
 <Text size="xs" c="dimmed">{filteredSortedPods.length} of {allPods.length} PODs</Text>
 <Button
 variant="light"
 color="teal"
 size="xs"
 leftSection={<IconDownload size={14} />}
 onClick={exportSprintCsv}
 disabled={filteredSortedPods.length === 0}
 >
 Export CSV
 </Button>
 </Group>
 )}

 {/* ── Loading ────────────────────────────────────────────────────────── */}
 {isLoading && activeSprint && (
 <LoadingSpinner variant="cards" message="Loading sprint planner..." />
 )}

 {/* ── No sprint selected ─────────────────────────────────────────────── */}
 {!activeSprint && !sprintsLoading && (
 <Center py="xl">
 <Stack align="center" gap="md">
 <ThemeIcon size={60} radius="xl" color="violet" variant="light">
 <IconBrain size={32} />
 </ThemeIcon>
 <Text fw={700} size="lg">Select a sprint to begin</Text>
 <Text c="dimmed" size="sm" ta="center" maw={400}>
 Choose a calendar sprint from the dropdown above to see a full capacity vs demand analysis
 with Jira sprint data, planning matrix demand, health scores, and smart recommendations for each POD.
 </Text>
 </Stack>
 </Center>
 )}

 {/* ── No capacity data warning ───────────────────────────────────────── */}
 {activeSprint && !isLoading && gapByPod.size === 0 && sprintMonthIndex !== null && (
 <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
 No capacity data found for sprint month ({sprintMonthLabel ?? `M${sprintMonthIndex}`}). This sprint may be outside the configured timeline window.
 Jira sprint issues are still shown below if available.
 </Alert>
 )}

 {/* ── POD cards (filtered & sorted) ─────────────────────────────────── */}
 {!isLoading && activeSprint && filteredSortedPods.map(pod => (
 <PodRecommenderCard
 key={pod.podName}
 podId={pod.capacityPodId ?? pod.jiraPodId ?? 0}
 podName={pod.podName}
 monthGap={pod.capacityPodId != null ? (gapByPod.get(pod.capacityPodId) ?? null) : null}
 sprintFraction={sprintFraction}
 jiraMetrics={pod.jiraPodId != null ? jiraByPod.get(pod.jiraPodId) : undefined}
 plannedProjects={(pod.capacityPodId != null ? (projectsByPod.get(pod.capacityPodId) ?? []) : []).map(m => ({
 projectId: m.projectId,
 projectName: m.projectName,
 priority: m.priority,
 totalHoursWithContingency: m.totalHoursWithContingency,
 targetReleaseName: m.targetReleaseName,
 status: m.status,
 }))}
 jiraBaseUrl={jiraBaseUrl}
 avgBauPct={pod.capacityPodId != null ? (bauByPodId.get(pod.capacityPodId) ?? 20) : 20}
 />
 ))}

 {/* ── No results after filter ────────────────────────────────────────── */}
 {!isLoading && activeSprint && filteredSortedPods.length === 0 && allPods.length > 0 && (
 <Center py="lg">
 <Stack align="center" gap="xs">
 <IconFilter size={24} color={TEXT_SUBTLE} />
 <Text size="sm" c="dimmed">No PODs match the current filter.</Text>
 <Button variant="subtle" size="xs" onClick={() => { setPodHealthFilter('all'); setPodSearch(''); }}>
 Clear filters
 </Button>
 </Stack>
 </Center>
 )}
 </Stack>
 </PPPageLayout>
 );
}
