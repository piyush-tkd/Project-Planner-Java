import { useState, useMemo } from 'react';
import {
 Stack, Title, Text, Group, Badge, Modal, Table, ScrollArea,
 Box, Paper, Tooltip, ThemeIcon, Anchor, MultiSelect, SegmentedControl,
} from '@mantine/core';
import {
 IconCalendarEvent, IconCircleFilled, IconExternalLink, IconCalendarStats,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUtilizationHeatmap } from '../api/reports';
import { useProjectPodMatrix } from '../api/projects';
import apiClient from '../api/client';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTimeline } from '../api/timeline';
import { useSprints } from '../api/sprints';
import { ProjectPodMatrixResponse } from '../types';
import { deriveTshirtSize } from '../types/project';
import type { SprintResponse } from '../types/project';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useDarkMode } from '../hooks/useDarkMode';
import { AQUA, COLOR_ERROR_DEEP, COLOR_GREEN_DARK, COLOR_ORANGE_DARK, DARK_BG, DARK_BORDER, DEEP_BLUE, FONT_FAMILY, GRAY_300, GRAY_BORDER, SURFACE_ERROR, SURFACE_SUBTLE, SURFACE_SUCCESS} from '../brandTokens';
import { PPPageLayout } from '../components/pp';

// ── Brand colours ────────────────────────────────────────────────────────────

// ── Threshold-based cell colours ─────────────────────────────────────────────
interface CellStyle { bg: string; text: string; label: string }

function getCellStyle(pct: number): CellStyle {
 if (pct <= 50) return { bg: SURFACE_SUCCESS, text: COLOR_GREEN_DARK, label: 'Slack' };
 if (pct <= 80) return { bg: '#fff9db', text: COLOR_ORANGE_DARK, label: 'Healthy' };
 if (pct <= 95) return { bg: '#ffe8cc', text: '#d9480f', label: 'Busy' };
 return { bg: SURFACE_ERROR, text: COLOR_ERROR_DEEP, label: 'Overloaded' };
}

// ── Legend items ──────────────────────────────────────────────────────────────
const LEGEND: { label: string; bg: string; text: string }[] = [
 { label: '≤50% Slack', bg: SURFACE_SUCCESS, text: COLOR_GREEN_DARK },
 { label: '51–80% Healthy', bg: '#fff9db', text: COLOR_ORANGE_DARK },
 { label: '81–95% Busy', bg: '#ffe8cc', text: '#d9480f' },
 { label: '>95% Overloaded', bg: SURFACE_ERROR, text: COLOR_ERROR_DEEP },
];

// ── Priority / status badge colours ──────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  HIGHEST: 'red', HIGH: 'orange', MEDIUM: 'blue', LOW: 'indigo', LOWEST: 'gray', BLOCKER: 'red', MINOR: 'gray',
};
const STATUS_COLOR: Record<string, string> = {
 ACTIVE: 'green', ON_HOLD: 'yellow', COMPLETED: 'blue', CANCELLED: 'gray',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function activeMonthsForPlanning(p: ProjectPodMatrixResponse): number[] {
 const start = p.podStartMonth ?? p.projectStartMonth;
 const duration = p.durationOverride ?? p.projectDurationMonths;
 const months: number[] = [];
 for (let m = start; m < start + duration; m++) months.push(m);
 return months;
}

/** Convert a sprint date string (YYYY-MM-DD) to a planning-horizon month index (1-based). */
function dateToMonthIndex(dateStr: string, startYear: number, startMonth: number): number {
 const d = new Date(dateStr + 'T00:00:00');
 return (d.getFullYear() - startYear) * 12 + (d.getMonth() + 1 - startMonth) + 1;
}

/** Compact sprint header label: "29 Oct\n11 Nov" */
function sprintHeaderLabel(s: SprintResponse): { line1: string; line2: string; type: string } {
 const fmt = (d: string) => {
 const dt = new Date(d + 'T00:00:00');
 return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
 };
 return {
 line1: fmt(s.startDate),
 line2: fmt(s.endDate),
 type: s.type === 'IP_WEEK' ? 'IP' : 'SPR',
 };
}

function todayStr() {
 return new Date().toISOString().slice(0, 10);
}

function classifySprint(s: SprintResponse, today: string): 'past' | 'current' | 'upcoming' {
 if (s.endDate < today) return 'past';
 if (s.startDate <= today && s.endDate >= today) return 'current';
 return 'upcoming';
}

// ── Types ────────────────────────────────────────────────────────────────────
interface CellDetail {
 podId: number;
 podName: string;
 monthIndex: number;
 label: string;
 utilizationPct: number;
 projects: ProjectPodMatrixResponse[];
 sprint?: SprintResponse;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamCalendarPage() {
 const isDark = useDarkMode();
 const { data: utilData, isLoading: utilLoading } = useUtilizationHeatmap();
 const { data: matrixData, isLoading: matrixLoading } = useProjectPodMatrix();
 // Fetch ALL pods so every team (even with no bookings) appears as a row
 const { data: allPods } = useQuery<{ id: number; name: string }[]>({
   queryKey: ['pods-all-names'],
   queryFn: () => apiClient.get('/pods/all').then(r => r.data),
 });
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const { data: timeline } = useTimeline();
 const { data: sprints, isLoading: sprintsLoading } = useSprints();
 const navigate = useNavigate();

 const [viewMode, setViewMode] = useState<'month' | 'sprint'>('month');
 const [selectedPods, setSelectedPods] = useState<string[]>([]);
 const [sortBy, setSortBy] = useState<'name' | 'peak' | 'avg'>('name');
 const [sprintFilter, setSprintFilter] = useState<'all' | 'current' | 'past'>('all');
 const [activeCell, setActiveCell] = useState<CellDetail | null>(null);

 // ── Month list (1-12) ─────────────────────────────────────────────────────
 const monthList = useMemo(
 () => Array.from({ length: 12 }, (_, i) => i + 1),
 [],
 );

 // ── All POD names for filter — union of heatmap data + every registered pod ──
 const allPodNames = useMemo(() => {
   const fromUtil = (utilData ?? []).map(u => u.podName);
   const fromPods = (allPods ?? []).map(p => p.name);
   return [...new Set([...fromUtil, ...fromPods])].sort();
 }, [utilData, allPods]);

 // ── Utilization lookup: podName → monthIndex → pct ───────────────────────
 const utilMap = useMemo(() => {
 const m = new Map<string, Map<number, number>>();
 (utilData ?? []).forEach(u => {
 if (!m.has(u.podName)) m.set(u.podName, new Map());
 m.get(u.podName)!.set(u.monthIndex, u.utilizationPct);
 });
 return m;
 }, [utilData]);

 // ── Project-by-pod-month lookup ───────────────────────────────────────────
 const projectMap = useMemo(() => {
 const m = new Map<string, Map<number, ProjectPodMatrixResponse[]>>();
 (matrixData ?? []).forEach(p => {
 if (!m.has(p.podName)) m.set(p.podName, new Map());
 const podM = m.get(p.podName)!;
 activeMonthsForPlanning(p).forEach(month => {
 if (!podM.has(month)) podM.set(month, []);
 podM.get(month)!.push(p);
 });
 });
 return m;
 }, [matrixData]);

 // ── Sprint columns (sorted chronologically) ───────────────────────────────
 const today = todayStr();
 const startYear = timeline?.startYear ?? new Date().getFullYear();
 const startMonth = timeline?.startMonth ?? (new Date().getMonth() + 1);

 const sprintColumns = useMemo(() => {
 const all = (sprints ?? [])
 .map(s => ({
 sprint: s,
 monthIndex: dateToMonthIndex(s.startDate, startYear, startMonth),
 classification: classifySprint(s, today),
 }))
 .sort((a, b) => a.sprint.startDate.localeCompare(b.sprint.startDate));

 if (sprintFilter === 'current') {
 return all.filter(s => s.classification === 'current' || s.classification === 'upcoming');
 }
 if (sprintFilter === 'past') {
 return all.filter(s => s.classification === 'past');
 }
 return all;
 }, [sprints, startYear, startMonth, sprintFilter, today]);

 // ── Sorted, filtered rows ─────────────────────────────────────────────────
 const rows = useMemo(() => {
 const pods = selectedPods.length > 0 ? selectedPods : allPodNames;
 const columns = viewMode === 'month' ? monthList : sprintColumns.map(sc => sc.monthIndex);

 return pods
 .map(podName => {
 const colData = columns.map(m => ({
 month: m,
 pct: utilMap.get(podName)?.get(m) ?? 0,
 }));
 return { podName, colData };
 })
 .sort((a, b) => {
 if (sortBy === 'name') return a.podName.localeCompare(b.podName);
 const pcts = (row: typeof a) => row.colData.map(d => d.pct);
 if (sortBy === 'peak') return Math.max(...pcts(b)) - Math.max(...pcts(a));
 const avg = (row: typeof a) =>
 pcts(row).reduce((s, v) => s + v, 0) / (row.colData.length || 1);
 return avg(b) - avg(a);
 });
 }, [allPodNames, selectedPods, utilMap, monthList, sprintColumns, sortBy, viewMode]);

 if (utilLoading || matrixLoading || sprintsLoading) return <LoadingSpinner variant="table" message="Loading calendar..." />;

 // ── Cell click handler ────────────────────────────────────────────────────
 function handleCellClick(
 podName: string,
 monthIndex: number,
 pct: number,
 label: string,
 sprint?: SprintResponse,
 ) {
 const podId = utilData?.find(u => u.podName === podName)?.podId ?? 0;
 const projects = projectMap.get(podName)?.get(monthIndex) ?? [];
 setActiveCell({ podId, podName, monthIndex, label, utilizationPct: pct, projects, sprint });
 }

 // ── Column header list ────────────────────────────────────────────────────
 const isMonthView = viewMode === 'month';

 return (
 <PPPageLayout title="Team Calendar" subtitle="Cross-team project timelines, sprints and milestones" animate>
 <Stack gap="md" className="page-enter stagger-children">
 {/* ── Header ──────────────────────────────────────────────────────── */}
 <Group gap="sm" align="center" className="slide-in-left">
 <ThemeIcon size={36} radius="md" style={{ background: DEEP_BLUE }}>
 <IconCalendarEvent size={20} color="white" />
 </ThemeIcon>
 <div>
 <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
 Team Calendar
 </Title>
 <Text size="sm" c="dimmed">
 POD utilisation heatmap
 </Text>
 </div>
 </Group>

 {/* ── Controls ────────────────────────────────────────────────────── */}
 <Group gap="md" align="flex-end" wrap="wrap">
 {/* View toggle */}
 <div>
 <Text size="xs" c="dimmed" mb={4}>View by</Text>
 <SegmentedControl
 value={viewMode}
 onChange={v => setViewMode(v as 'month' | 'sprint')}
 data={[
 { value: 'month', label: '📅 Month' },
 { value: 'sprint', label: '🏃 Sprint' },
 ]}
 size="sm"
 />
 </div>

 {/* Sprint filter (only in sprint mode) */}
 {!isMonthView && (
 <div>
 <Text size="xs" c="dimmed" mb={4}>Sprints</Text>
 <SegmentedControl
 value={sprintFilter}
 onChange={v => setSprintFilter(v as typeof sprintFilter)}
 data={[
 { value: 'all', label: 'All' },
 { value: 'current', label: '🟢 Current & Upcoming' },
 { value: 'past', label: '🕘 Past' },
 ]}
 size="sm"
 />
 </div>
 )}

 {/* POD filter */}
 <MultiSelect
 label="Filter PODs"
 placeholder={selectedPods.length === 0 ? 'All PODs' : undefined}
 data={allPodNames}
 value={selectedPods}
 onChange={setSelectedPods}
 clearable
 searchable
 style={{ minWidth: 260, maxWidth: 480 }}
 size="sm"
 />

 {/* Sort */}
 {isMonthView && (
 <div>
 <Text size="xs" c="dimmed" mb={4}>Sort rows by</Text>
 <SegmentedControl
 value={sortBy}
 onChange={v => setSortBy(v as typeof sortBy)}
 data={[
 { value: 'name', label: 'Name' },
 { value: 'peak', label: 'Peak %' },
 { value: 'avg', label: 'Avg %' },
 ]}
 size="sm"
 />
 </div>
 )}
 </Group>

 {/* ── Heatmap table ────────────────────────────────────────────────── */}
 <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
 <ScrollArea>
 <Box style={{ minWidth: isMonthView ? 1100 : Math.max(900, sprintColumns.length * 100 + 180) }}>
 <table style={{ borderCollapse: 'collapse', width: '100%' }}>
 {/* ── Column header row ──────────────────────────────────── */}
 <thead>
 <tr>
 <th style={{
 background: DEEP_BLUE, color: 'white',
 padding: '12px 16px', textAlign: 'left',
 fontFamily: FONT_FAMILY,
 fontSize: 13, fontWeight: 700,
 position: 'sticky', left: 0, zIndex: 2,
 minWidth: 160,
 }}>
 POD
 </th>

 {/* Month columns */}
 {isMonthView && monthList.map(m => {
 const isCurrent = m === currentMonthIndex;
 return (
 <th key={m} style={{
 background: isCurrent ? AQUA : DEEP_BLUE,
 color: 'white',
 padding: '12px 8px',
 textAlign: 'center',
 fontFamily: FONT_FAMILY,
 fontSize: 12, fontWeight: 700,
 minWidth: 90,
 borderLeft: isCurrent ? '2px solid #40c4c9' : '1px solid rgba(255,255,255,0.1)',
 }}>
 {monthLabels[m] ?? `M${m}`}
 </th>
 );
 })}

 {/* Sprint columns */}
 {!isMonthView && sprintColumns.map(({ sprint, classification }) => {
 const isCurrent = classification === 'current';
 const lbl = sprintHeaderLabel(sprint);
 return (
 <th key={sprint.id} style={{
 background: isCurrent ? AQUA : DEEP_BLUE,
 color: 'white',
 padding: '8px 6px',
 textAlign: 'center',
 fontFamily: FONT_FAMILY,
 fontSize: 11, fontWeight: 700,
 minWidth: 100,
 borderLeft: isCurrent ? '2px solid #40c4c9' : '1px solid rgba(255,255,255,0.1)',
 lineHeight: 1.35,
 }}>
 <div style={{
 fontSize: 9,
 fontWeight: 600,
 color: sprint.type === 'IP_WEEK' ? '#FFA94D' : 'rgba(255,255,255,0.7)',
 marginBottom: 2,
 textTransform: 'uppercase',
 letterSpacing: '0.05em',
 }}>
 {lbl.type}
 {isCurrent && (
 <span style={{
 marginLeft: 4, background: '#40c4c9', color: DEEP_BLUE,
 borderRadius: 3, padding: '1px 4px', fontSize: 8,
 }}>
 NOW
 </span>
 )}
 </div>
 <div>{lbl.line1}</div>
 <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 400 }}>
 {lbl.line2}
 </div>
 </th>
 );
 })}
 </tr>
 </thead>

 {/* ── Data rows ─────────────────────────────────────────── */}
 <tbody>
 {rows.map((row, ri) => (
 <tr key={row.podName} style={{ background: isDark ? (ri % 2 === 0 ? DARK_BG : '#222222') : (ri % 2 === 0 ? '#fff' : SURFACE_SUBTLE) }}>
 {/* POD name cell */}
 <td style={{
 padding: '10px 16px',
 fontWeight: 700, fontSize: 13,
 color: isDark ? '#fff' : DEEP_BLUE,
 fontFamily: FONT_FAMILY,
 borderRight: isDark ? '1px solid #373A40' : '1px solid #e9ecef',
 borderBottom: isDark ? '1px solid #373A40' : '1px solid #e9ecef',
 position: 'sticky', left: 0, zIndex: 1,
 background: isDark ? (ri % 2 === 0 ? DARK_BG : '#222222') : (ri % 2 === 0 ? '#fff' : SURFACE_SUBTLE),
 whiteSpace: 'nowrap',
 }}>
 {row.podName}
 </td>

 {/* Month cells */}
 {isMonthView && row.colData.map(({ month, pct }) => {
 const style = getCellStyle(pct);
 const projects = projectMap.get(row.podName)?.get(month) ?? [];
 const isCurrent = month === currentMonthIndex;
 const label = monthLabels[month] ?? `M${month}`;
 return (
 <HeatmapCell
 key={month}
 pct={pct}
 style={style}
 projects={projects}
 isCurrent={isCurrent}
 rowEven={ri % 2 === 0}
 tooltipTitle={`${row.podName} — ${label}`}
 onClick={() => (pct > 0 || projects.length > 0)
 ? handleCellClick(row.podName, month, pct, label)
 : undefined}
 isDark={isDark}
 />
 );
 })}

 {/* Sprint cells */}
 {!isMonthView && sprintColumns.map(({ sprint, monthIndex, classification }) => {
 const pct = utilMap.get(row.podName)?.get(monthIndex) ?? 0;
 const style = getCellStyle(pct);
 const projects = projectMap.get(row.podName)?.get(monthIndex) ?? [];
 const isCurrent = classification === 'current';
 const lbl = sprintHeaderLabel(sprint);
 const tooltipTitle = `${row.podName} — ${sprint.name}`;
 return (
 <HeatmapCell
 key={sprint.id}
 pct={pct}
 style={style}
 projects={projects}
 isCurrent={isCurrent}
 rowEven={ri % 2 === 0}
 tooltipTitle={tooltipTitle}
 tooltipExtra={`${lbl.line1} → ${lbl.line2}`}
 onClick={() => (pct > 0 || projects.length > 0)
 ? handleCellClick(row.podName, monthIndex, pct, sprint.name, sprint)
 : undefined}
 isDark={isDark}
 />
 );
 })}
 </tr>
 ))}

 {rows.length === 0 && (
 <tr>
 <td
 colSpan={isMonthView ? 13 : sprintColumns.length + 1}
 style={{ padding: 40, textAlign: 'center', color: GRAY_300 }}
 >
 {!isMonthView && sprintColumns.length === 0
 ? 'No sprints defined. Add sprints in Sprint Calendar.'
 : 'No data available'}
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </Box>
 </ScrollArea>

 {/* ── Legend ─────────────────────────────────────────────────────── */}
 <Group gap="lg" px="md" py="sm" style={{ borderTop: isDark ? '1px solid #373A40' : '1px solid #e9ecef', background: isDark ? DARK_BG : SURFACE_SUBTLE }} wrap="wrap">
 {LEGEND.map(l => (
 <Group key={l.label} gap={6} align="center">
 <Box style={{
 width: 14, height: 14, borderRadius: 3,
 background: l.bg, border: `1px solid ${l.text}44`,
 }} />
 <Text size="xs" c="dimmed">{l.label}</Text>
 </Group>
 ))}
 {!isMonthView && (
 <>
 <Box style={{ width: 1, height: 14, background: isDark ? DARK_BORDER : GRAY_BORDER }} />
 <Group gap={6} align="center">
 <Box style={{ width: 14, height: 14, borderRadius: 3, background: AQUA }} />
 <Text size="xs" c="dimmed">Current sprint</Text>
 </Group>
 <Group gap={6} align="center">
 <Box style={{ width: 14, height: 14, borderRadius: 3, background: '#fff4e6', border: '1px solid #fd7e1444' }} />
 <Text size="xs" c="dimmed">IP Week</Text>
 </Group>
 </>
 )}
 </Group>
 </Paper>

 {/* ── Cell detail modal ─────────────────────────────────────────────── */}
 <CellDetailModal
 cell={activeCell}
 onClose={() => setActiveCell(null)}
 monthLabels={monthLabels}
 onNavigate={projectId => { setActiveCell(null); navigate(`/projects/${projectId}`); }}
 />
 </Stack>
 </PPPageLayout>
 );
}

// ── Reusable heatmap cell ──────────────────────────────────────────────────────
function HeatmapCell({
 pct, style, projects, isCurrent, rowEven, tooltipTitle, tooltipExtra, onClick, isDark,
}: {
 pct: number;
 style: CellStyle;
 projects: ProjectPodMatrixResponse[];
 isCurrent: boolean;
 rowEven: boolean;
 tooltipTitle: string;
 tooltipExtra?: string;
 onClick?: () => void;
 isDark: boolean;
}) {
 const isEmpty = pct === 0 && projects.length === 0;
 return (
 <Tooltip
 label={
 <Stack gap={2}>
 <Text size="xs" fw={700}>{tooltipTitle}</Text>
 {tooltipExtra && <Text size="xs" c="dimmed">{tooltipExtra}</Text>}
 <Text size="xs">{Math.round(pct)}% utilisation · {style.label}</Text>
 <Text size="xs">{projects.length} active project{projects.length !== 1 ? 's' : ''}</Text>
 {projects.slice(0, 5).map(p => (
 <Text key={p.planningId} size="xs" c="dimmed">• {p.projectName}</Text>
 ))}
 {projects.length > 5 && (
 <Text size="xs" c="dimmed">…and {projects.length - 5} more</Text>
 )}
 </Stack>
 }
 withArrow
 position="top"
 multiline
 w={230}
 >
 <td
 onClick={onClick && !isEmpty ? onClick : undefined}
 style={{
 background: isEmpty ? (isDark ? (rowEven ? DARK_BG : '#222222') : (rowEven ? '#fff' : SURFACE_SUBTLE)) : style.bg,
 color: style.text,
 textAlign: 'center',
 padding: '8px 4px',
 cursor: (!isEmpty && onClick) ? 'pointer' : 'default',
 borderLeft: isCurrent ? '2px solid #40c4c9' : (isDark ? '1px solid #373A40' : '1px solid #e9ecef'),
 borderBottom: isDark ? '1px solid #373A40' : '1px solid #e9ecef',
 transition: 'filter 0.1s',
 userSelect: 'none',
 }}
 onMouseEnter={e => { if (!isEmpty) (e.currentTarget as HTMLElement).style.filter = 'brightness(0.92)'; }}
 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
 >
 {!isEmpty ? (
 <>
 <div style={{
 fontWeight: 700, fontSize: 14,
 fontFamily: FONT_FAMILY,
 lineHeight: 1.2,
 }}>
 {pct > 0 ? `${Math.round(pct)}%` : '—'}
 </div>
 <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
 {projects.length}
 <IconCalendarEvent size={10} style={{ marginLeft: 2, verticalAlign: 'middle' }} />
 </div>
 </>
 ) : (
 <Text size="xs" c="dimmed">—</Text>
 )}
 </td>
 </Tooltip>
 );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function CellDetailModal({
 cell, onClose, monthLabels, onNavigate,
}: {
 cell: CellDetail | null;
 onClose: () => void;
 monthLabels: Record<number, string>;
 onNavigate: (projectId: number) => void;
}) {
 if (!cell) return null;
 const style = getCellStyle(cell.utilizationPct);
 const isSprint = !!cell.sprint;

 const modalTitle = isSprint ? (
 <Group gap="sm" align="flex-start">
 <ThemeIcon size={28} radius="sm" style={{ background: DEEP_BLUE, flexShrink: 0, marginTop: 2 }}>
 <IconCalendarStats size={15} color="white" />
 </ThemeIcon>
 <div>
 <Text fw={700} size="sm" style={{ color: DEEP_BLUE }}>{cell.podName}</Text>
 <Text size="xs" c="dimmed" style={{ maxWidth: 360 }}>{cell.sprint!.name}</Text>
 <Group gap={6} mt={2}>
 <Badge size="xs" color={cell.sprint!.type === 'IP_WEEK' ? 'grape' : 'blue'} variant="light">
 {cell.sprint!.type === 'IP_WEEK' ? 'IP Week' : 'Sprint'}
 </Badge>
 <Text size="xs" c="dimmed">
 {new Date(cell.sprint!.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
 {' → '}
 {new Date(cell.sprint!.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
 </Text>
 </Group>
 </div>
 </Group>
 ) : (
 <Group gap="sm" align="center">
 <ThemeIcon size={28} radius="sm" style={{ background: DEEP_BLUE }}>
 <IconCalendarEvent size={15} color="white" />
 </ThemeIcon>
 <div>
 <Text fw={700} size="md" style={{ color: DEEP_BLUE }}>{cell.podName}</Text>
 <Text size="xs" c="dimmed">{cell.label}</Text>
 </div>
 </Group>
 );

 return (
 <Modal
 opened={!!cell}
 onClose={onClose}
 title={modalTitle}
 size="lg"
 scrollAreaComponent={ScrollArea.Autosize}
 >
 {/* ── Utilisation KPI ──────────────────────────────────────────────── */}
 <Group gap="md" mb="md" p="sm" style={{
 background: style.bg, borderRadius: 8, border: `1px solid ${style.text}33`,
 }}>
 <div>
 <Text size="xs" c="dimmed" fw={600}>UTILISATION</Text>
 <Text fw={800} size="xl" style={{ color: style.text, fontFamily: FONT_FAMILY }}>
 {cell.utilizationPct > 0 ? `${Math.round(cell.utilizationPct)}%` : '—'}
 </Text>
 {isSprint && (
 <Text size="xs" c="dimmed" mt={2}>
 Based on {monthLabels[cell.monthIndex] ?? `M${cell.monthIndex}`} monthly data
 </Text>
 )}
 </div>
 <Badge
 size="lg"
 variant="light"
 style={{ background: style.bg, color: style.text, border: `1px solid ${style.text}55` }}
 >
 <Group gap={4}>
 <IconCircleFilled size={8} />
 {style.label}
 </Group>
 </Badge>
 <div style={{ marginLeft: 'auto' }}>
 <Text size="xs" c="dimmed" fw={600}>ACTIVE PROJECTS</Text>
 <Text fw={700} size="lg" ta="right">{cell.projects.length}</Text>
 </div>
 </Group>

 {/* ── Project list ─────────────────────────────────────────────────── */}
 {cell.projects.length === 0 ? (
 <Text size="sm" c="dimmed" ta="center" py="xl">
 No projects planned for this POD in {isSprint ? 'this sprint period' : 'this month'}.
 </Text>
 ) : (
 <ScrollArea>
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Project</Table.Th>
 <Table.Th>Priority</Table.Th>
 <Table.Th>Status</Table.Th>
 <Table.Th>Owner</Table.Th>
 <Table.Th>Window</Table.Th>
 <Table.Th>Size</Table.Th>
 <Table.Th style={{ width: 40 }}></Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {cell.projects.map(p => {
 const start = p.podStartMonth ?? p.projectStartMonth;
 const duration = p.durationOverride ?? p.projectDurationMonths;
 const endMonth = start + duration - 1;
 return (
 <Table.Tr
 key={p.planningId}
 style={{ cursor: 'pointer' }}
 onClick={() => onNavigate(p.projectId)}
 >
 <Table.Td fw={600}>{p.projectName}</Table.Td>
 <Table.Td>
 <Badge size="xs" color={PRIORITY_COLOR[p.priority] ?? 'gray'} variant="filled">
 {p.priority}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" color={STATUS_COLOR[p.status] ?? 'gray'} variant="light">
 {p.status.replace('_', ' ')}
 </Badge>
 </Table.Td>
 <Table.Td c="dimmed">{p.owner}</Table.Td>
 <Table.Td style={{ whiteSpace: 'nowrap' }} c="dimmed" fz="xs">
 {monthLabels[start] ?? `M${start}`} → {monthLabels[endMonth] ?? `M${endMonth}`}
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="outline" color="gray">
 {deriveTshirtSize(p.totalHoursWithContingency ?? 0)}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Anchor
 size="xs"
 onClick={e => { e.stopPropagation(); onNavigate(p.projectId); }}
 >
 <IconExternalLink size={13} />
 </Anchor>
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 )}
 </Modal>
 );
}
