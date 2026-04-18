import React, { useMemo, useRef, useEffect } from 'react';
import {
 Title, Stack, SimpleGrid, Card, Text, Group, Badge, Select,
 Tooltip, ScrollArea, SegmentedControl, ActionIcon, ThemeIcon, Divider
} from '@mantine/core';
import {
 IconLink, IconCalendarStats, IconClock, IconFlag,
 IconAlertTriangle, IconFilter
} from '@tabler/icons-react';
import SavedViews from '../../components/common/SavedViews';
import {
 AQUA, COLOR_ERROR, COLOR_ORANGE, COLOR_SUCCESS,
 DARK_BG, DARK_BORDER, DARK_SURFACE, DEEP_BLUE, GRAY_100, SURFACE_SUBTLE, TEXT_DIM, DEEP_BLUE_TINTS
} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { useProjects } from '../../api/projects';
import { ProjectResponse } from '../../types/project';

/* ─── Status colours ─────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
 COMPLETED: COLOR_SUCCESS,
 ACTIVE: AQUA,
 IN_DISCOVERY: '#7950f2',
 NOT_STARTED: TEXT_DIM,
 ON_HOLD: COLOR_ORANGE,
 CANCELLED: COLOR_ERROR
};

const STATUS_LABELS: Record<string, string> = {
 ACTIVE: 'Active', NOT_STARTED: 'Not Started', ON_HOLD: 'On Hold',
 COMPLETED: 'Done', CANCELLED: 'Cancelled', IN_DISCOVERY: 'Discovery'
};

const PRIORITY_COLORS: Record<string, string> = {
 P0: 'red', P1: 'orange', P2: 'blue', P3: 'gray'
};

/* ─── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({
 label, value, sub, color, icon, dark, bgColor
}: {
 label: string; value: number | string; sub?: string;
 color: string; icon: React.ReactNode; dark: boolean; bgColor: string;
}) {
 return (
 <Card
 shadow="sm"
 padding="lg"
 radius="md"
 style={{
 backgroundColor: bgColor,
 borderLeft: `4px solid ${color}`,
 transition: 'box-shadow 0.2s'}}
 >
 <Group justify="space-between" wrap="nowrap">
 <Stack gap={2}>
 <Text size="xs" tt="uppercase" fw={600} c="dimmed" style={{ letterSpacing: '0.05em' }}>
 {label}
 </Text>
 <Text size="xl" fw={800} style={{ color: dark ? '#e9ecef' : DEEP_BLUE, lineHeight: 1.1 }}>
 {value}
 </Text>
 {sub && <Text size="xs" c="dimmed">{sub}</Text>}
 </Stack>
 <ThemeIcon size={44} radius="md" style={{ backgroundColor: `${color}18`, color }}>
 {icon}
 </ThemeIcon>
 </Group>
 </Card>
 );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
const RoadmapTimelinePage: React.FC = () => {
 const { data: projects, isLoading, error } = useProjects();
 const dark = useDarkMode();
 const [groupBy, setGroupBy] = React.useState<'all' | 'priority' | 'owner' | 'status'>('all');
 const [statusFilter, setStatusFilter] = React.useState<string>('all');
 const [priorityFilter,setPriorityFilter]= React.useState<string>('all');
 const [savedViewId, setSavedViewId] = React.useState<string | null>(null);

 const currentFilters = { groupBy, statusFilter, priorityFilter };
 const applyView = (filters: Record<string, string | null>) => {
 if (filters.groupBy) setGroupBy((filters.groupBy as typeof groupBy) ?? 'all');
 if (filters.statusFilter) setStatusFilter(filters.statusFilter ?? 'all');
 if (filters.priorityFilter) setPriorityFilter(filters.priorityFilter ?? 'all');
 };

 /* ref for auto-scroll to today */
 const ganttViewportRef = useRef<HTMLDivElement>(null);

 /* drag-to-reorder */
 const draggingRowRef = React.useRef<number | null>(null);
 const [draggingRowId, setDraggingRowId] = React.useState<number | null>(null);
 const [rowOrders, setRowOrders] = React.useState<Record<string, number[]>>({});
 const [insertAfterRow,setInsertAfterRow]= React.useState<{ groupName: string; afterId: number | null } | null>(null);

 /* ── Absolute-month helpers (months since year 2000) ──────────────────
 * This lets us handle cross-year date ranges (e.g. Dec 2025 → May 2026)
 * without being locked to a single calendar year.
 * absMonth(2026, 0) = 312, absMonth(2025, 11) = 311, etc.
 */
 const REF_YEAR = 2000;
 const toAbsMonth = (year: number, month0: number) => (year - REF_YEAR) * 12 + month0;

 /* date range — driven by actual startDate/targetDate first, month indices as fallback */
 const dateRange = useMemo(() => {
 const refYear = new Date().getFullYear();
 let minAbs = toAbsMonth(refYear, 0); // Jan of current year (default)
 let maxAbs = toAbsMonth(refYear, 11); // Dec of current year (default)

 projects?.forEach(p => {
 if (p.startDate) {
 const d = new Date(p.startDate);
 minAbs = Math.min(minAbs, toAbsMonth(d.getFullYear(), d.getMonth()));
 } else if (p.startMonth != null) {
 minAbs = Math.min(minAbs, toAbsMonth(refYear, p.startMonth - 1));
 }
 if (p.targetDate) {
 const d = new Date(p.targetDate);
 maxAbs = Math.max(maxAbs, toAbsMonth(d.getFullYear(), d.getMonth()));
 } else if (p.targetEndMonth != null) {
 maxAbs = Math.max(maxAbs, toAbsMonth(refYear, p.targetEndMonth - 1));
 }
 });

 return { minAbs, maxAbs, refYear, monthCount: maxAbs - minAbs + 1 };
 }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps

 /** Convert an absolute month + optional fractional day (0–1) to a pixel X offset */
 const absToX = (abs: number, frac = 0) => (abs - dateRange.minAbs + frac) * COL_W;

 /** Convert a date string to a pixel X position (day-accurate) */
 const dateToX = (dateStr: string) => {
 const d = new Date(dateStr);
 const abs = toAbsMonth(d.getFullYear(), d.getMonth());
 const daysInMo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
 return absToX(abs, (d.getDate() - 1) / daysInMo);
 };

 /* filter + group */
 const filteredAndGrouped = useMemo(() => {
 if (!projects) return {};
 let f = projects;
 if (statusFilter !== 'all') f = f.filter(p => p.status === statusFilter);
 if (priorityFilter !== 'all') f = f.filter(p => p.priority === priorityFilter);
 if (groupBy === 'priority') {
 const g: Record<string, typeof f> = { P0: [], P1: [], P2: [], P3: [] };
 f.forEach(p => { g[p.priority]?.push(p); });
 return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length > 0));
 }
 if (groupBy === 'owner') {
 const g: Record<string, typeof f> = {};
 f.forEach(p => { if (!g[p.owner]) g[p.owner] = []; g[p.owner].push(p); });
 return g;
 }
 if (groupBy === 'status') {
 const g: Record<string, typeof f> = {};
 f.forEach(p => { if (!g[p.status]) g[p.status] = []; g[p.status].push(p); });
 return g;
 }
 return { All: f };
 }, [projects, statusFilter, priorityFilter, groupBy]);

 /* milestones */
 const upcomingMilestones = useMemo(() => {
 if (!projects) return [];
 const now = new Date();
 const in90 = new Date(now.getTime() + 90 * 86400000);
 return projects
 .filter(p => { if (!p.targetDate) return false; const d = new Date(p.targetDate); return d >= now && d <= in90; })
 .map(p => {
 const td = new Date(p.targetDate!);
 return { ...p, daysRemaining: Math.ceil((td.getTime() - now.getTime()) / 86400000), targetDate: td };
 })
 .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
 }, [projects]);

 /* summary stats */
 const stats = useMemo(() => {
 if (!projects) return { total: 0, avgDuration: 0, thisQuarter: 0, blocked: 0 };
 const now = new Date();
 const q = Math.floor(now.getMonth() / 3);
 const qStart = new Date(now.getFullYear(), q * 3, 1);
 const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
 return {
 total: projects.length,
 avgDuration: Math.round(projects.reduce((s, p) => s + p.durationMonths, 0) / Math.max(1, projects.length)),
 thisQuarter: projects.filter(p => { if (!p.targetDate) return false; const d = new Date(p.targetDate); return d >= qStart && d <= qEnd; }).length,
 blocked: projects.filter(p => p.blockedById).length
 };
 }, [projects]);

 if (isLoading) return <LoadingSpinner />;
 if (error) return <PageError error={error} />;

 const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const bgColor = dark ? DARK_BG : '#ffffff';
 const textColor = dark ? '#c1c2c5' : DEEP_BLUE;
 const borderColor = dark ? DARK_BORDER : GRAY_100;
 const hdrBg = dark ? DARK_SURFACE : SURFACE_SUBTLE;

 const COL_W = 80;
 const ROW_H = 52;
 const LABEL_W = 220;

 // Build column headers — show "Jan '26" style when range spans multiple years
 const spansMultipleYears = (dateRange.maxAbs - dateRange.minAbs) >= 12;
 const monthLabels: Array<{ label: string; absMonth: number }> = [];
 for (let abs = dateRange.minAbs; abs <= dateRange.maxAbs; abs++) {
 const mo = ((abs % 12) + 12) % 12;
 const yr = REF_YEAR + Math.floor(abs / 12);
 const label = spansMultipleYears ? `${MONTHS[mo]} '${String(yr).slice(2)}` : MONTHS[mo];
 monthLabels.push({ label, absMonth: abs });
 }
 const totalW = monthLabels.length * COL_W;

 // Today marker
 const today = new Date();
 const todayAbs = toAbsMonth(today.getFullYear(), today.getMonth());
 const todayFrac = today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
 const todayPx = (todayAbs >= dateRange.minAbs && todayAbs <= dateRange.maxAbs)
 ? absToX(todayAbs, todayFrac) : -999;

 // B-02: Auto-scroll the Gantt to show the current month centred in the viewport
 useEffect(() => {
 if (todayPx > 0 && ganttViewportRef.current) {
 const viewportWidth = ganttViewportRef.current.clientWidth;
 const scrollTarget = Math.max(0, todayPx - viewportWidth / 2 + LABEL_W);
 ganttViewportRef.current.scrollLeft = scrollTarget;
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [todayPx]);

 return (
 <Stack gap="xl" style={{ }}>

 {/* ── Page Header ─────────────────────────────────────────────────── */}
 <div>
 <Group gap="sm" align="center" mb={4}>
 <ThemeIcon size={36} radius="md" style={{ background: `linear-gradient(135deg, ${DEEP_BLUE}, ${AQUA})` }}>
 <IconCalendarStats size={20} color="#fff" />
 </ThemeIcon>
 <Title order={2} style={{ color: dark ? '#e9ecef' : DEEP_BLUE }}>
 Roadmap Timeline
 </Title>
 </Group>
 <Text size="sm" c="dimmed" ml={44}>
 Visual timeline of all projects with dependencies and milestones
 </Text>
 </div>

 {/* ── Filter Bar ──────────────────────────────────────────────────── */}
 <Card
 shadow="sm"
 padding="lg"
 radius="md"
 style={{
 backgroundColor: bgColor,
 border: `1px solid ${borderColor}`}}
 >
 <Group gap={6} mb="md" align="center">
 <IconFilter size={15} color={TEXT_DIM} />
 <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.06em' }}>
 Filters
 </Text>
 </Group>
 <Group align="flex-end" gap="lg" wrap="wrap">
 {/* Group By */}
 <div style={{ flex: '1 1 260px', minWidth: 220 }}>
 <Text size="xs" fw={600} mb={6} c={dark ? '#aaa' : DEEP_BLUE_TINTS[70 as keyof typeof DEEP_BLUE_TINTS] ?? DEEP_BLUE}>
 Group By
 </Text>
 <SegmentedControl
 value={groupBy}
 onChange={(v) => setGroupBy(v as typeof groupBy)}
 size="sm"
 radius="md"
 data={[
 { label: 'All', value: 'all' },
 { label: 'Priority', value: 'priority' },
 { label: 'Owner', value: 'owner' },
 { label: 'Status', value: 'status' },
 ]}
 styles={{
 root: { backgroundColor: dark ? '#2c2e31' : '#f1f3f5' },
 indicator: { backgroundColor: dark ? '#373A40' : '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },
 label: { fontSize: 13, fontWeight: 500 }}}
 />
 </div>

 <Divider orientation="vertical" style={{ alignSelf: 'stretch', margin: '0 4px' }} />

 {/* Status */}
 <div style={{ flex: '1 1 180px', minWidth: 160 }}>
 <Text size="xs" fw={600} mb={6} c={dark ? '#aaa' : DEEP_BLUE_TINTS[70 as keyof typeof DEEP_BLUE_TINTS] ?? DEEP_BLUE}>
 Status
 </Text>
 <Select
 size="sm"
 radius="md"
 placeholder="All statuses"
 value={statusFilter}
 onChange={(v) => setStatusFilter(v || 'all')}
 data={[
 { value: 'all', label: 'All Statuses' },
 { value: 'ACTIVE', label: 'Active' },
 { value: 'NOT_STARTED', label: 'Not Started' },
 { value: 'IN_DISCOVERY', label: 'In Discovery' },
 { value: 'ON_HOLD', label: 'On Hold' },
 { value: 'COMPLETED', label: 'Completed' },
 { value: 'CANCELLED', label: 'Cancelled' },
 ]}
 searchable
 styles={{ input: { fontWeight: 500 } }}
 />
 </div>

 {/* Priority */}
 <div style={{ flex: '1 1 160px', minWidth: 140 }}>
 <Text size="xs" fw={600} mb={6} c={dark ? '#aaa' : DEEP_BLUE_TINTS[70 as keyof typeof DEEP_BLUE_TINTS] ?? DEEP_BLUE}>
 Priority
 </Text>
 <Select
 size="sm"
 radius="md"
 placeholder="All priorities"
 value={priorityFilter}
 onChange={(v) => setPriorityFilter(v || 'all')}
 data={[
 { value: 'all', label: 'All Priorities' },
 { value: 'HIGHEST', label: '🔴 Highest' },
 { value: 'HIGH', label: '🟠 High' },
 { value: 'MEDIUM', label: '🔵 Medium' },
 { value: 'LOW', label: '🟣 Low' },
 { value: 'LOWEST', label: '⚪ Lowest' },
 { value: 'BLOCKER', label: '🔴 Blocker' },
 { value: 'MINOR', label: '⚫ Minor' },
 ]}
 styles={{ input: { fontWeight: 500 } }}
 />
 </div>

 <Divider orientation="vertical" style={{ alignSelf: 'stretch', margin: '0 4px' }} />

 {/* Saved Views */}
 <div style={{ flex: '0 0 auto', minWidth: 140 }}>
 <Text size="xs" fw={600} mb={6} c={dark ? '#aaa' : DEEP_BLUE_TINTS[70 as keyof typeof DEEP_BLUE_TINTS] ?? DEEP_BLUE}>
 Saved Views
 </Text>
 <SavedViews
 pageKey="roadmap_timeline"
 currentFilters={currentFilters}
 onApply={applyView}
 activeViewId={savedViewId}
 onActiveViewChange={setSavedViewId}
 />
 </div>
 </Group>
 </Card>

 {/* ── Summary Stats ────────────────────────────────────────────────── */}
 <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
 <StatCard label="Total Projects" value={stats.total} color={DEEP_BLUE} icon={<IconCalendarStats size={22}/>} dark={dark} bgColor={bgColor} />
 <StatCard label="Avg Duration" value={stats.avgDuration} sub="months" color={AQUA} icon={<IconClock size={22}/>} dark={dark} bgColor={bgColor} />
 <StatCard label="This Quarter" value={stats.thisQuarter} sub="projects ending" color={COLOR_SUCCESS} icon={<IconFlag size={22}/>} dark={dark} bgColor={bgColor} />
 <StatCard label="Blocked" value={stats.blocked} sub="projects" color={COLOR_ERROR} icon={<IconAlertTriangle size={22}/>} dark={dark} bgColor={bgColor} />
 </SimpleGrid>

 {/* ── Gantt Chart ──────────────────────────────────────────────────── */}
 <ChartCard title="Project Timeline">
 <ScrollArea viewportRef={ganttViewportRef}>
 <div style={{ position: 'relative', backgroundColor: bgColor, borderRadius: 8, border: `1px solid ${borderColor}`, overflow: 'hidden', minWidth: LABEL_W + totalW }}>

 {/* Header row */}
 <div style={{ display: 'flex', backgroundColor: hdrBg, borderBottom: `2px solid ${borderColor}` }}>
 <div style={{
 width: LABEL_W, minWidth: LABEL_W, padding: '10px 14px',
 fontWeight: 700, fontSize: 12, color: textColor,
 borderRight: `1px solid ${borderColor}`, textTransform: 'uppercase', letterSpacing: '0.06em'}}>
 Project
 </div>
 {monthLabels.map(({ label, absMonth }, i) => {
 const isToday = absMonth === todayAbs;
 return (
 <div key={absMonth} style={{
 width: COL_W, minWidth: COL_W, padding: '10px 4px',
 textAlign: 'center', borderRight: `1px solid ${borderColor}`,
 fontSize: 11, fontWeight: isToday ? 800 : 700,
 color: isToday ? AQUA : textColor,
 textTransform: 'uppercase', letterSpacing: '0.05em',
 backgroundColor: isToday
 ? (dark ? 'rgba(45,204,211,0.12)' : 'rgba(45,204,211,0.10)')
 : (i % 2 === 0 ? 'transparent' : (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.012)')),
 borderBottom: isToday ? `2px solid ${AQUA}` : undefined}}>
 {label}
 </div>
 );
 })}
 </div>

 {/* Today line */}
 {todayPx >= 0 && (
 <div style={{
 position: 'absolute', left: LABEL_W + todayPx, top: 0,
 width: 2, height: '100%',
 background: `linear-gradient(to bottom, ${COLOR_ERROR}cc, ${COLOR_ERROR}44)`,
 zIndex: 20, pointerEvents: 'none'}}>
 <div style={{
 position: 'absolute', top: 0, left: -20,
 background: COLOR_ERROR, color: '#fff',
 fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
 whiteSpace: 'nowrap'}}>
 TODAY
 </div>
 </div>
 )}

 {/* Rows */}
 {Object.entries(filteredAndGrouped).map(([groupName, groupProjects]) => {
 const order = rowOrders[groupName];
 const ordered: ProjectResponse[] = order
 ? [...order.map(id => (groupProjects as ProjectResponse[]).find(p => p.id === id)).filter(Boolean) as ProjectResponse[],
 ...(groupProjects as ProjectResponse[]).filter(p => !order.includes(p.id))]
 : (groupProjects as ProjectResponse[]);

 const onDragStart = (e: React.DragEvent, id: number) => { e.dataTransfer.effectAllowed = 'move'; draggingRowRef.current = id; setDraggingRowId(id); };
 const onDragOver = (e: React.DragEvent, id: number) => {
 e.preventDefault();
 const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
 const after = e.clientY > rect.top + rect.height / 2 ? id : (ordered[ordered.findIndex(p => p.id === id) - 1]?.id ?? null);
 setInsertAfterRow({ groupName, afterId: after });
 };
 const onDrop = (e: React.DragEvent) => {
 e.preventDefault();
 const dragId = draggingRowRef.current;
 if (!dragId) return;
 const cur = ordered.map(p => p.id).filter(id => id !== dragId);
 const afterId = insertAfterRow?.groupName === groupName ? insertAfterRow.afterId : cur[cur.length - 1] ?? null;
 const idx = afterId === null ? 0 : cur.indexOf(afterId) + 1;
 const next = [...cur]; next.splice(idx, 0, dragId);
 setRowOrders(prev => ({ ...prev, [groupName]: next }));
 setDraggingRowId(null); setInsertAfterRow(null); draggingRowRef.current = null;
 };

 return (
 <div key={groupName} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
 {groupBy !== 'all' && (
 <div style={{
 padding: '6px 14px', borderBottom: `1px solid ${borderColor}`,
 background: dark ? 'rgba(255,255,255,0.04)' : `linear-gradient(90deg, ${DEEP_BLUE}08 0%, transparent 60%)`,
 display: 'flex', alignItems: 'center', gap: 8}}>
 <div style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: AQUA }} />
 <Text size="xs" fw={700} tt="uppercase" style={{ color: AQUA, letterSpacing: '0.07em' }}>
 {groupName}
 </Text>
 <Badge size="xs" variant="light" color="gray" ml={4}>
 {ordered.length}
 </Badge>
 </div>
 )}

 {ordered.map((project: ProjectResponse) => {
 // ── Bar position: prefer actual dates, fall back to month indices ──
 let barLeft: number;
 let barRight: number;
 const { refYear } = dateRange;

 if (project.startDate) {
 barLeft = Math.max(0, dateToX(project.startDate));
 } else {
 barLeft = Math.max(0, absToX(toAbsMonth(refYear, (project.startMonth || 1) - 1)));
 }

 if (project.targetDate) {
 // end of target date's month column
 const d = new Date(project.targetDate);
 barRight = absToX(toAbsMonth(d.getFullYear(), d.getMonth()) + 1);
 } else if (project.targetEndMonth) {
 barRight = absToX(toAbsMonth(refYear, project.targetEndMonth - 1) + 1);
 } else {
 barRight = barLeft + (project.durationMonths || 1) * COL_W;
 }

 const barWidth = Math.max(24, barRight - barLeft);

 // ── Duration label: calculate from dates if available ──────────
 const durationLabel = (() => {
 if (project.startDate && project.targetDate) {
 const ms = new Date(project.targetDate).getTime() - new Date(project.startDate).getTime();
 const mo = Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
 return mo > 0 ? `${mo}mo` : null;
 }
 return project.durationMonths > 0 ? `${project.durationMonths}mo` : null;
 })();

 const barColor = STATUS_COLORS[project.status] || TEXT_DIM;
 const isInsertBelow = insertAfterRow?.groupName === groupName && insertAfterRow.afterId === project.id;
 const isInsertTop = insertAfterRow?.groupName === groupName && insertAfterRow.afterId === null && ordered[0]?.id === project.id;

 return (
 <React.Fragment key={project.id}>
 {isInsertTop && (
 <div style={{ height: 3, background: AQUA, margin: '1px 0', boxShadow: `0 0 8px ${AQUA}80` }} />
 )}
 <div
 draggable
 onDragStart={e => onDragStart(e, project.id)}
 onDragOver={e => onDragOver(e, project.id)}
 onDragEnd={() => { setDraggingRowId(null); setInsertAfterRow(null); draggingRowRef.current = null; }}
 style={{
 display: 'flex', alignItems: 'center',
 minWidth: LABEL_W + totalW,
 height: ROW_H,
 borderBottom: `1px solid ${borderColor}`,
 backgroundColor: bgColor,
 opacity: draggingRowId === project.id ? 0.35 : 1,
 cursor: 'grab',
 transition: 'background 0.1s, opacity 0.15s'}}
 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = dark ? '#2a2c30' : '#f8f9fb'; }}
 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = bgColor; }}
 >
 {/* Label column */}
 <div style={{
 width: LABEL_W, minWidth: LABEL_W,
 padding: '0 14px', borderRight: `1px solid ${borderColor}`,
 display: 'flex', alignItems: 'center', gap: 8, height: '100%'}}>
 <div style={{
 width: 3, minWidth: 3, height: 28, borderRadius: 2,
 backgroundColor: barColor, opacity: 0.8, flexShrink: 0}} />
 <div style={{ overflow: 'hidden' }}>
 <Text size="xs" fw={600} style={{ color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
 {project.name}
 </Text>
 <Badge size="xs" variant="light" color={PRIORITY_COLORS[project.priority] || 'gray'} mt={2}>
 {project.priority}
 </Badge>
 </div>
 </div>

 {/* Timeline area */}
 <div style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
 {/* Month grid lines */}
 {monthLabels.map((_, idx) => (
 <div key={idx} style={{
 position: 'absolute', left: idx * COL_W, top: 0,
 width: 1, height: '100%',
 backgroundColor: borderColor, opacity: 0.5, pointerEvents: 'none'}} />
 ))}

 <Tooltip
 label={
 <Stack gap={3}>
 <Text size="xs" fw={600}>{project.name}</Text>
 {project.startDate && <Text size="xs">▶ Start: {new Date(project.startDate).toLocaleDateString()}</Text>}
 {project.targetDate && <Text size="xs">⏹ Target: {new Date(project.targetDate).toLocaleDateString()}</Text>}
 {project.owner && <Text size="xs">👤 {project.owner}</Text>}
 <Text size="xs" style={{ color: barColor }}>● {STATUS_LABELS[project.status] || project.status}</Text>
 {durationLabel && <Text size="xs">⏱ {durationLabel} duration</Text>}
 </Stack>
 }
 position="top"
 withArrow
 >
 <div
 style={{
 position: 'absolute',
 left: barLeft + 4,
 width: Math.max(barWidth - 8, 24),
 height: 28,
 borderRadius: 5,
 background: `linear-gradient(90deg, ${barColor}ee, ${barColor}aa)`,
 boxShadow: `0 1px 4px ${barColor}55`,
 display: 'flex', alignItems: 'center', paddingLeft: 8,
 cursor: 'pointer',
 transition: 'filter 0.15s, transform 0.1s',
 overflow: 'hidden'}}
 onMouseEnter={e => {
 (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)';
 (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.06)';
 }}
 onMouseLeave={e => {
 (e.currentTarget as HTMLElement).style.filter = '';
 (e.currentTarget as HTMLElement).style.transform = '';
 }}
 >
 {project.blockedById && (
 <Tooltip label={`Blocked by #${project.blockedById}`} position="bottom">
 <ActionIcon variant="transparent" size="xs" color="white"
      aria-label="Copy link"
    >
 <IconLink size={12} />
 </ActionIcon>
 </Tooltip>
 )}
 </div>
 </Tooltip>
 </div>
 </div>
 {isInsertBelow && (
 <div style={{ height: 3, background: AQUA, margin: '1px 0', boxShadow: `0 0 8px ${AQUA}80` }} />
 )}
 </React.Fragment>
 );
 })}
 </div>
 );
 })}
 </div>
 </ScrollArea>
 </ChartCard>

 {/* ── Milestones ───────────────────────────────────────────────────── */}
 <ChartCard title="Upcoming Milestones (Next 90 Days)">
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
 <thead>
 <tr style={{ backgroundColor: hdrBg, borderBottom: `2px solid ${borderColor}` }}>
 {['Project', 'Priority', 'Target Date', 'Days Left', 'Owner', 'Status'].map((h, i) => (
 <th key={h} style={{
 padding: '10px 12px', textAlign: i === 0 || i === 4 ? 'left' : 'center',
 fontWeight: 700, fontSize: 11, color: textColor,
 textTransform: 'uppercase', letterSpacing: '0.06em'}}>
 {h}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {upcomingMilestones.length === 0 ? (
 <tr>
 <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: TEXT_DIM }}>
 No milestones in the next 90 days
 </td>
 </tr>
 ) : (
 upcomingMilestones.map((m, idx) => (
 <tr
 key={m.id}
 style={{
 borderBottom: `1px solid ${borderColor}`,
 backgroundColor: idx % 2 === 0 ? bgColor : (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.012)'),
 transition: 'background 0.1s'}}
 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = dark ? '#2a2c30' : '#f0f9ff'; }}
 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 0 ? bgColor : (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.012)'); }}
 >
 <td style={{ padding: '10px 12px', color: textColor, fontWeight: 500 }}>{m.name}</td>
 <td style={{ padding: '10px 12px', textAlign: 'center' }}>
 <Badge size="sm" variant="light" color={PRIORITY_COLORS[m.priority] || 'gray'}>{m.priority}</Badge>
 </td>
 <td style={{ padding: '10px 12px', textAlign: 'center', color: textColor }}>
 {m.targetDate.toLocaleDateString()}
 </td>
 <td style={{ padding: '10px 12px', textAlign: 'center' }}>
 <Badge
 size="sm"
 variant="filled"
 color={m.daysRemaining <= 7 ? 'red' : m.daysRemaining <= 30 ? 'orange' : 'teal'}
 >
 {m.daysRemaining}d
 </Badge>
 </td>
 <td style={{ padding: '10px 12px', color: textColor }}>{m.owner}</td>
 <td style={{ padding: '10px 12px', textAlign: 'center' }}>
 <Badge size="sm" variant="light" style={{ backgroundColor: `${STATUS_COLORS[m.status] || TEXT_DIM}18`, color: STATUS_COLORS[m.status] || TEXT_DIM }}>
 {STATUS_LABELS[m.status] || m.status}
 </Badge>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </ChartCard>
 </Stack>
 );
};

export default RoadmapTimelinePage;
