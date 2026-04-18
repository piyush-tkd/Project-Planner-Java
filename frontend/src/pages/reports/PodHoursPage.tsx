import React, { useState, useMemo } from 'react';
import {
 Box, Title, Text, Select, Group, Badge, Tooltip,
 Table, ScrollArea, Loader, Alert, UnstyledButton, Tabs,
 TextInput, Modal, Stack, Divider
} from '@mantine/core';
import {
 IconClock, IconUsers, IconAlertTriangle, IconHexagons, IconInfoCircle,
 IconSearch, IconArrowUp, IconArrowDown, IconMinus, IconSelector
} from '@tabler/icons-react';
import { usePodHours, PeriodType, ResourceRow, PodHoursEntry, PodInfo } from '../../api/podHours';
import { AQUA, COLOR_GREEN, COLOR_WARNING, DARK_BG, DEEP_BLUE, GRAY_200, GRAY_400} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

const BUFFER_COLOR = COLOR_WARNING;
const BUFFER_LIGHT_DARK = 'rgba(245,158,11,0.10)';
const BUFFER_LIGHT_LIGHT = 'rgba(245,158,11,0.08)';

const MONTH_NAMES = [
 '', 'January','February','March','April','May','June',
 'July','August','September','October','November','December',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtHours(h: number) {
 if (h === 0) return '—';
 return `${h.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;
}
function roleBadgeColor(role: string | null): string {
 switch (role) {
 case 'DEVELOPER': return 'blue';
 case 'QA': return 'orange';
 case 'BSA': return 'green';
 case 'TECH_LEAD': return 'violet';
 default: return 'gray';
 }
}

/** Returns {year, periodIndex} for the period immediately before the given one. */
function prevPeriod(year: number, period: PeriodType, periodIndex: number) {
 if (period === 'MONTHLY') {
 if (periodIndex <= 1) return { year: year - 1, periodIndex: 12 };
 return { year, periodIndex: periodIndex - 1 };
 }
 if (period === 'QUARTERLY') {
 if (periodIndex <= 1) return { year: year - 1, periodIndex: 4 };
 return { year, periodIndex: periodIndex - 1 };
 }
 // YEARLY
 return { year: year - 1, periodIndex: 0 };
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
 if (previous === 0 && current === 0) return null;
 const delta = current - previous;
 const pct = previous > 0 ? ((delta / previous) * 100) : null;

 const sign = delta > 0 ? '+' : '';
 const color = delta > 0 ? COLOR_GREEN : delta < 0 ? '#f87171' : GRAY_400;
 const Icon = delta > 0 ? IconArrowUp : delta < 0 ? IconArrowDown : IconMinus;
 const label = pct !== null
 ? `${sign}${delta.toFixed(1)}h (${sign}${pct.toFixed(0)}%)`
 : `${sign}${delta.toFixed(1)}h`;

 return (
 <Group gap={3} mt={3}>
 <Icon size={11} style={{ color }} />
 <Text size="xs" style={{ color}}>{label} vs prior period</Text>
 </Group>
 );
}

// ── Period selector ───────────────────────────────────────────────────────────
interface PeriodSelectorProps {
 year: number; setYear: (y: number) => void;
 period: PeriodType; setPeriod: (p: PeriodType) => void;
 periodIndex: number; setPeriodIndex: (i: number) => void;
 dark: boolean;
}
function PeriodSelector({ year, setYear, period, setPeriod, periodIndex, setPeriodIndex, dark }: PeriodSelectorProps) {
 const currentYear = new Date().getFullYear();
 const yearOptions = Array.from({ length: 5 }, (_, i) => {
 const y = currentYear - 2 + i;
 return { value: String(y), label: String(y) };
 });
 const PERIOD_TYPES: { label: string; value: PeriodType }[] = [
 { label: 'Month', value: 'MONTHLY' },
 { label: 'Quarter', value: 'QUARTERLY' },
 { label: 'Year', value: 'YEARLY' },
 ];
 const pillStyle = (active: boolean): React.CSSProperties => ({
 padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
 background: active ? (dark ? 'rgba(45,204,211,0.14)' : '#ffffff') : 'transparent',
 color: active ? (dark ? AQUA : DEEP_BLUE) : (dark ? 'rgba(255,255,255,0.55)' : 'rgba(12,35,64,0.55)'),
 borderBottom: active ? `2.5px solid ${AQUA}` : '2.5px solid transparent',
 boxShadow: active && !dark ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
 transition: 'all 0.15s'
 });
 const pillTray: React.CSSProperties = {
 display: 'flex', gap: 2, padding: '4px 6px',
 background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
 borderRadius: 12,
 border: `1px solid ${dark ? 'rgba(45,204,211,0.12)' : 'rgba(12,35,64,0.08)'}`
 };
 const monthOptions = Array.from({ length: 12 }, (_, i) => ({
 value: String(i + 1), label: MONTH_NAMES[i + 1].slice(0, 3)
 }));
 const quarterOptions = [
 { value: '1', label: 'Q1' }, { value: '2', label: 'Q2' },
 { value: '3', label: 'Q3' }, { value: '4', label: 'Q4' },
 ];
 return (
 <Group gap={10} align="center" wrap="wrap">
 <Select size="sm" value={String(year)} onChange={v => v && setYear(Number(v))}
 data={yearOptions} style={{ width: 90 }}
 styles={{ input: { } }} />
 <Box style={pillTray}>
 {PERIOD_TYPES.map(pt => (
 <UnstyledButton key={pt.value} style={pillStyle(period === pt.value)}
 onClick={() => {
 setPeriod(pt.value);
 if (pt.value === 'MONTHLY') setPeriodIndex(new Date().getMonth() + 1);
 if (pt.value === 'QUARTERLY') setPeriodIndex(Math.ceil((new Date().getMonth() + 1) / 3));
 if (pt.value === 'YEARLY') setPeriodIndex(0);
 }}>
 {pt.label}
 </UnstyledButton>
 ))}
 </Box>
 {period === 'MONTHLY' && (
 <Box style={pillTray}>
 {monthOptions.map(mo => (
 <UnstyledButton key={mo.value} style={pillStyle(periodIndex === Number(mo.value))}
 onClick={() => setPeriodIndex(Number(mo.value))}>
 {mo.label}
 </UnstyledButton>
 ))}
 </Box>
 )}
 {period === 'QUARTERLY' && (
 <Box style={pillTray}>
 {quarterOptions.map(qo => (
 <UnstyledButton key={qo.value} style={pillStyle(periodIndex === Number(qo.value))}
 onClick={() => setPeriodIndex(Number(qo.value))}>
 {qo.label}
 </UnstyledButton>
 ))}
 </Box>
 )}
 </Group>
 );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, dark, prevValue }: {
 label: string; value: string; sub?: string;
 icon: React.ReactNode; color: string; dark: boolean;
 prevValue?: number; // for delta; pass raw number, not formatted
}) {
 // parse current numeric value from formatted string for delta
 const numericCurrent = parseFloat(value.replace(/[^\d.-]/g, ''));
 return (
 <Box style={{
 flex: '1 1 180px', padding: '14px 18px', borderRadius: 10, minWidth: 0,
 background: dark ? 'rgba(255,255,255,0.04)' : '#fff',
 border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,35,64,0.08)'}`,
 boxShadow: '0 1px 4px rgba(0,0,0,0.06)'}}>
 <Group gap={8} mb={4} wrap="nowrap">
 <Box style={{ color }}>{icon}</Box>
 <Text size="xs" c="dimmed" style={{ }}>{label}</Text>
 </Group>
 <Text fw={700} size="xl" style={{ color: dark ? '#fff' : DEEP_BLUE}}>
 {value}
 </Text>
 {prevValue !== undefined && !isNaN(numericCurrent) && (
 <DeltaBadge current={numericCurrent} previous={prevValue} />
 )}
 {sub && <Text size="xs" c="dimmed" mt={prevValue !== undefined ? 1 : 2}>{sub}</Text>}
 </Box>
 );
}

// ── Buffer drill-down modal ───────────────────────────────────────────────────
function BufferDrillModal({
 pod, resources, dark, opened, onClose
}: {
 pod: PodInfo | null; resources: ResourceRow[]; dark: boolean;
 opened: boolean; onClose: () => void;
}) {
 if (!pod) return null;

 const buffers = resources
 .flatMap(r => r.pods
 .filter(p => p.podName === pod.podName && p.buffer)
 .map(p => ({ name: r.authorName, role: r.role, homePodName: r.homePodName, hours: p.hours, issueCount: p.issueCount }))
 )
 .sort((a, b) => b.hours - a.hours);

 const totalBufferHours = buffers.reduce((s, b) => s + b.hours, 0);
 const bufferPct = pod.totalHours > 0 ? ((totalBufferHours / pod.totalHours) * 100).toFixed(1) : '0.0';

 return (
 <Modal
 opened={opened}
 onClose={onClose}
 title={
 <Group gap={8}>
 <Text fw={700} size="md" style={{ color: dark ? '#fff' : DEEP_BLUE}}>
 Buffer Contributors — {pod.podName}
 </Text>
 <Badge color="yellow" variant="light" style={{ color: BUFFER_COLOR }}>
 {buffers.length} buffer resource{buffers.length !== 1 ? 's' : ''}
 </Badge>
 </Group>
 }
 size="lg"
 styles={{ content: { background: dark ? DARK_BG : '#fff' }, header: { background: dark ? DARK_BG : '#fff' } }}
 >
 <Stack gap="sm">
 <Group gap={24}>
 <Box>
 <Text size="xs" c="dimmed">Buffer Hours</Text>
 <Text fw={700} size="lg" style={{ color: BUFFER_COLOR}}>{fmtHours(totalBufferHours)}</Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed">% of POD Total</Text>
 <Text fw={700} size="lg" style={{ color: BUFFER_COLOR}}>{bufferPct}%</Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed">POD Total</Text>
 <Text fw={700} size="lg" style={{ color: dark ? '#fff' : DEEP_BLUE}}>{fmtHours(pod.totalHours)}</Text>
 </Box>
 </Group>

 {Number(bufferPct) > 50 && (
 <Alert icon={<IconAlertTriangle size={14} />} color="orange" variant="light" py={8}>
 <Text size="xs">Over half of hours logged to this POD came from non-assigned resources. Consider reviewing formal POD assignments.</Text>
 </Alert>
 )}

 <Divider />

 <ScrollArea mah={360}>
 <Table withColumnBorders style={{ }}>
 <Table.Thead>
 <Table.Tr>
 {['Resource', 'Home POD', 'Role', 'Hours', 'Issues'].map(h => (
 <Table.Th key={h} style={{
 background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
 color: dark ? '#fff' : DEEP_BLUE,
 fontWeight: 700, fontSize: 12, padding: '8px 10px'}}>{h}</Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {buffers.map((b, i) => (
 <Table.Tr key={b.name} style={{ background: i % 2 === 1 ? (dark ? 'rgba(255,255,255,0.02)' : 'rgba(12,35,64,0.015)') : 'transparent' }}>
 <Table.Td style={{ padding: '8px 10px' }}>
 <Text size="sm" fw={600} style={{ color: dark ? '#fff' : DEEP_BLUE}}>{b.name}</Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 10px' }}>
 <Text size="sm" c="dimmed">{b.homePodName ?? '—'}</Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 10px' }}>
 {b.role
 ? <Badge size="xs" color={roleBadgeColor(b.role)} variant="light">{b.role.replace('_', ' ')}</Badge>
 : <Text size="xs" c="dimmed">—</Text>}
 </Table.Td>
 <Table.Td style={{ padding: '8px 10px', textAlign: 'right' }}>
 <Text size="sm" fw={700} style={{ color: BUFFER_COLOR}}>{fmtHours(b.hours)}</Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 10px', textAlign: 'center' }}>
 <Text size="sm" c="dimmed">{b.issueCount}</Text>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Stack>
 </Modal>
 );
}

// ── POD summary cards ─────────────────────────────────────────────────────────
function PodSummaryCards({
 podSummaries, dark, onBufferClick
}: {
 podSummaries: PodInfo[]; dark: boolean;
 onBufferClick: (pod: PodInfo) => void;
}) {
 return (
 <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
 {podSummaries.map(pod => (
 <Box key={pod.podId} style={{
 flex: '1 1 160px', padding: '12px 14px', borderRadius: 8, minWidth: 0,
 background: dark ? 'rgba(255,255,255,0.04)' : '#fff',
 border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(12,35,64,0.08)'}`,
 boxShadow: '0 1px 3px rgba(0,0,0,0.05)'}}>
 <Text size="xs" fw={700} style={{ color: AQUA, marginBottom: 4 }}>
 {pod.podName}
 </Text>
 <Text fw={700} size="lg" style={{ color: dark ? '#fff' : DEEP_BLUE}}>
 {fmtHours(pod.totalHours)}
 </Text>
 <Group gap={6} mt={4}>
 <Text size="xs" c="dimmed">{pod.resourceCount} contributor{pod.resourceCount !== 1 ? 's' : ''}</Text>
 {pod.bufferCount > 0 && (
 <Tooltip label="Click to see who logged buffer hours" withArrow position="top">
 <Badge
 size="xs" color="yellow" variant="light"
 style={{ color: BUFFER_COLOR, cursor: 'pointer' }}
 onClick={() => onBufferClick(pod)}
 >
 {pod.bufferCount} BUFFER
 </Badge>
 </Tooltip>
 )}
 </Group>
 </Box>
 ))}
 </Box>
 );
}

// ── Sort icon helper ──────────────────────────────────────────────────────────
function SortIcon({ column, sortCol, sortDir }: {
 column: string; sortCol: string | null; sortDir: 'asc' | 'desc';
}) {
 if (sortCol !== column) return <IconSelector size={12} style={{ opacity: 0.35, marginLeft: 3 }} />;
 return sortDir === 'asc'
 ? <IconArrowUp size={12} style={{ color: AQUA, marginLeft: 3 }} />
 : <IconArrowDown size={12} style={{ color: AQUA, marginLeft: 3 }} />;
}

// ── Matrix Tab ───────────────────────────────────────────────────────────────
function MatrixTab({ resources, podNames, dark, search }: {
 resources: ResourceRow[]; podNames: string[]; dark: boolean; search: string;
}) {
 // sortCol: 'name' | 'total' | a pod name
 const [sortCol, setSortCol] = useState<string>('total');
 const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

 function handleSort(col: string) {
 if (sortCol === col) {
 setSortDir(d => d === 'desc' ? 'asc' : 'desc');
 } else {
 setSortCol(col);
 setSortDir('desc');
 }
 }

 const headerBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)';
 const rowAlt = dark ? 'rgba(255,255,255,0.02)' : 'rgba(12,35,64,0.015)';
 const bufLight = dark ? BUFFER_LIGHT_DARK : BUFFER_LIGHT_LIGHT;

 // Filter by search
 const q = search.trim().toLowerCase();
 const filtered = q
 ? resources.filter(r =>
 r.authorName.toLowerCase().includes(q) ||
 (r.role ?? '').toLowerCase().includes(q) ||
 (r.homePodName ?? '').toLowerCase().includes(q)
 )
 : resources;

 // Sort
 const sorted = [...filtered].sort((a, b) => {
 let va: number, vb: number;
 if (sortCol === 'name') {
 const cmp = a.authorName.localeCompare(b.authorName);
 return sortDir === 'asc' ? cmp : -cmp;
 }
 if (sortCol === 'total') {
 va = a.totalHours; vb = b.totalHours;
 } else {
 // sort by a specific pod's hours
 va = a.pods.find(p => p.podName === sortCol)?.hours ?? 0;
 vb = b.pods.find(p => p.podName === sortCol)?.hours ?? 0;
 }
 return sortDir === 'asc' ? va - vb : vb - va;
 });

 const thStyle = (col: string): React.CSSProperties => ({
 background: sortCol === col
 ? (dark ? 'rgba(45,204,211,0.08)' : 'rgba(45,204,211,0.07)')
 : headerBg,
 color: dark ? '#fff' : DEEP_BLUE, fontWeight: sortCol === col ? 700 : 600,
 fontSize: 11, padding: '10px 8px', textAlign: 'center',
 minWidth: 90, maxWidth: 120, cursor: 'pointer',
 userSelect: 'none',
 whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
 borderBottom: sortCol === col ? `2px solid ${AQUA}` : undefined
 });

 if (sorted.length === 0) {
 return (
 <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
 {q ? `No resources match "${search}".` : 'No worklog data found for this period.'}
 </Alert>
 );
 }

 return (
 <ScrollArea style={{ width: '100%' }}>
 <Table style={{ borderCollapse: 'collapse', minWidth: 600}} withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 {/* Resource column */}
 <Table.Th
 onClick={() => handleSort('name')}
 style={{
 ...thStyle('name'),
 textAlign: 'left', minWidth: 200,
 position: 'sticky', left: 0, zIndex: 2,
 borderRight: `2px solid ${AQUA}33`}}
 >
 <Group gap={2} wrap="nowrap">
 Resource
 <SortIcon column="name" sortCol={sortCol} sortDir={sortDir} />
 </Group>
 </Table.Th>
 {/* Total column */}
 <Table.Th
 onClick={() => handleSort('total')}
 style={{ ...thStyle('total'), textAlign: 'right', width: 80 }}
 >
 <Group gap={2} justify="flex-end" wrap="nowrap">
 Total
 <SortIcon column="total" sortCol={sortCol} sortDir={sortDir} />
 </Group>
 </Table.Th>
 {/* Per-POD columns */}
 {podNames.map(pod => (
 <Table.Th key={pod} onClick={() => handleSort(pod)} style={thStyle(pod)}>
 <Tooltip label={`Sort by ${pod}`} position="top" withArrow>
 <Group gap={2} justify="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
 <Text
 size="11px"
 fw={sortCol === pod ? 700 : 600}
 style={{
 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
 color: sortCol === pod ? AQUA : undefined}}
 >
 {pod}
 </Text>
 <SortIcon column={pod} sortCol={sortCol} sortDir={sortDir} />
 </Group>
 </Tooltip>
 </Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sorted.map((res, idx) => {
 const podMap = new Map<string, PodHoursEntry>();
 res.pods.forEach(p => podMap.set(p.podName, p));
 const stickyBg = dark
 ? (idx % 2 === 1 ? 'rgba(255,255,255,0.04)' : DARK_BG)
 : (idx % 2 === 1 ? 'rgba(12,35,64,0.03)' : '#fff');

 return (
 <Table.Tr key={res.authorName} style={{ background: idx % 2 === 1 ? rowAlt : 'transparent' }}>
 {/* Resource name */}
 <Table.Td style={{
 padding: '8px 12px', position: 'sticky', left: 0, zIndex: 1,
 background: stickyBg, borderRight: `2px solid ${AQUA}33`}}>
 <Text size="sm" fw={600} style={{ color: dark ? '#fff' : DEEP_BLUE}}>
 {res.authorName}
 </Text>
 <Group gap={4} mt={2}>
 {res.role && (
 <Badge size="xs" color={roleBadgeColor(res.role)} variant="light">
 {res.role.replace('_', ' ')}
 </Badge>
 )}
 {!res.resourceId && <Badge size="xs" color="gray" variant="outline">Unmatched</Badge>}
 {res.homePodName && <Text size="10px" c="dimmed">Home: {res.homePodName}</Text>}
 </Group>
 </Table.Td>
 {/* Total */}
 <Table.Td style={{ padding: '8px', textAlign: 'right' }}>
 <Text size="sm" fw={700} style={{ color: AQUA}}>
 {fmtHours(res.totalHours)}
 </Text>
 </Table.Td>
 {/* Per-POD cells */}
 {podNames.map(pod => {
 const entry = podMap.get(pod);
 if (!entry || entry.hours === 0) {
 return (
 <Table.Td key={pod} style={{
 padding: '8px', textAlign: 'center',
 background: sortCol === pod ? (dark ? 'rgba(45,204,211,0.03)' : 'rgba(45,204,211,0.02)') : 'transparent'}}>
 <Text size="xs" c="dimmed">—</Text>
 </Table.Td>
 );
 }
 return (
 <Table.Td key={pod} style={{
 padding: '8px', textAlign: 'center',
 background: entry.buffer
 ? bufLight
 : sortCol === pod ? (dark ? 'rgba(45,204,211,0.03)' : 'rgba(45,204,211,0.02)') : 'transparent'}}>
 <Tooltip
 label={`${entry.hours.toLocaleString(undefined, { minimumFractionDigits: 1 })}h · ${entry.issueCount} issue${entry.issueCount !== 1 ? 's' : ''}${entry.buffer ? ' · buffer contribution' : ''}`}
 withArrow position="top"
 >
 <Box>
 <Text size="sm" fw={entry.buffer ? 700 : 500} style={{
 color: entry.buffer ? BUFFER_COLOR : (dark ? GRAY_200 : '#333')}}>
 {fmtHours(entry.hours)}
 </Text>
 {entry.buffer && (
 <Text size="9px" style={{ color: BUFFER_COLOR, fontWeight: 700, lineHeight: 1 }}>BUFFER</Text>
 )}
 </Box>
 </Tooltip>
 </Table.Td>
 );
 })}
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 {q && (
 <Text size="xs" c="dimmed" mt="xs" px="xs">
 Showing {sorted.length} of {resources.length} resources
 </Text>
 )}
 </ScrollArea>
 );
}

// ── Details Tab ───────────────────────────────────────────────────────────────
function DetailsTab({ resources, dark, search }: { resources: ResourceRow[]; dark: boolean; search: string }) {
 const headerBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)';
 const rowAlt = dark ? 'rgba(255,255,255,0.02)' : 'rgba(12,35,64,0.015)';
 const bufLight = dark ? BUFFER_LIGHT_DARK : BUFFER_LIGHT_LIGHT;

 type FlatRow = {
 authorName: string; role: string | null; homePodName: string | null;
 resourceId: number | null; podName: string;
 hours: number; issueCount: number; buffer: boolean;
 };

 const q = search.trim().toLowerCase();

 const flat: FlatRow[] = [];
 resources.forEach(res => {
 if (q && !res.authorName.toLowerCase().includes(q) &&
 !(res.role ?? '').toLowerCase().includes(q) &&
 !(res.homePodName ?? '').toLowerCase().includes(q)) return;
 res.pods.forEach(pod => {
 if (pod.hours > 0) {
 flat.push({
 authorName: res.authorName, role: res.role, homePodName: res.homePodName,
 resourceId: res.resourceId, podName: pod.podName,
 hours: pod.hours, issueCount: pod.issueCount, buffer: pod.buffer
 });
 }
 });
 });

 flat.sort((a, b) => a.podName.localeCompare(b.podName) || b.hours - a.hours);

 if (flat.length === 0) {
 return (
 <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
 {q ? `No resources match "${search}".` : 'No worklog data found for this period.'}
 </Alert>
 );
 }

 return (
 <ScrollArea style={{ width: '100%' }}>
 <Table withColumnBorders style={{ }}>
 <Table.Thead>
 <Table.Tr>
 {['POD', 'Resource', 'Role', 'Home POD', 'Hours', 'Issues', 'Type'].map(h => (
 <Table.Th key={h} style={{
 background: headerBg, color: dark ? '#fff' : DEEP_BLUE, fontWeight: 700, fontSize: 12, padding: '10px 12px'}}>{h}</Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {flat.map((row, idx) => (
 <Table.Tr key={`${row.authorName}-${row.podName}`} style={{
 background: row.buffer ? bufLight : (idx % 2 === 1 ? rowAlt : 'transparent')}}>
 <Table.Td style={{ padding: '8px 12px' }}>
 <Text size="sm" fw={600} style={{ color: AQUA }}>{row.podName}</Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 12px' }}>
 <Group gap={6}>
 <Text size="sm" fw={500} style={{ color: dark ? '#fff' : DEEP_BLUE }}>{row.authorName}</Text>
 {!row.resourceId && <Badge size="xs" color="gray" variant="outline">Unmatched</Badge>}
 </Group>
 </Table.Td>
 <Table.Td style={{ padding: '8px 12px' }}>
 {row.role
 ? <Badge size="xs" color={roleBadgeColor(row.role)} variant="light">{row.role.replace('_', ' ')}</Badge>
 : <Text size="xs" c="dimmed">—</Text>}
 </Table.Td>
 <Table.Td style={{ padding: '8px 12px' }}>
 <Text size="sm" c="dimmed">{row.homePodName ?? '—'}</Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 12px', textAlign: 'right' }}>
 <Text size="sm" fw={700} style={{
 color: row.buffer ? BUFFER_COLOR : (dark ? GRAY_200 : '#333')}}>
 {fmtHours(row.hours)}
 </Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 12px', textAlign: 'center' }}>
 <Text size="sm" c="dimmed">{row.issueCount}</Text>
 </Table.Td>
 <Table.Td style={{ padding: '8px 12px' }}>
 {row.buffer
 ? <Badge size="xs" color="yellow" variant="filled" style={{ color: '#92400e' }}>Buffer</Badge>
 : <Badge size="xs" color="teal" variant="light">Assigned</Badge>}
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 {q && (
 <Text size="xs" c="dimmed" mt="xs" px="xs">
 Showing {flat.length} rows matching "{search}"
 </Text>
 )}
 </ScrollArea>
 );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PodHoursPage() {
 const dark = useDarkMode();
 const now = new Date();
 const currentYear = now.getFullYear();
 const currentMonth = now.getMonth() + 1;

 const [year, setYear] = useState(currentYear);
 const [period, setPeriod] = useState<PeriodType>('MONTHLY');
 const [periodIndex, setPeriodIndex] = useState(currentMonth);
 const [search, setSearch] = useState('');
 const [bufferPod, setBufferPod] = useState<PodInfo | null>(null);

 // Current period data
 const { data, isLoading, isError } = usePodHours(year, period, periodIndex);

 // Previous period data (for delta)
 const prev = prevPeriod(year, period, periodIndex);
 const { data: prevData } = usePodHours(prev.year, period, prev.periodIndex);

 const podNames = useMemo(() => (data?.podSummaries ?? []).map(p => p.podName), [data]);

 const bufferPct = data && data.totalHours > 0
 ? ((data.bufferHours / data.totalHours) * 100).toFixed(1) : '0.0';

 const tabStyles = {
 root: { },
 list: {
 padding: '4px 6px', gap: 2,
 background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
 borderRadius: 12,
 border: `1px solid ${dark ? 'rgba(45,204,211,0.12)' : 'rgba(12,35,64,0.08)'}`,
 '&::before': { display: 'none' },
 marginBottom: 16
 },
 tab: {fontSize: 13, fontWeight: 600,
 borderRadius: 8, padding: '6px 14px', border: 'none',
 color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(12,35,64,0.55)',
 '&[data-active]': {
 background: dark ? 'rgba(45,204,211,0.14)' : '#ffffff',
 color: dark ? AQUA : DEEP_BLUE,
 borderBottom: `2.5px solid ${AQUA}`,
 boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.07)'
 },
 '&:hover:not([data-active])': {
 background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
 color: dark ? 'rgba(255,255,255,0.8)' : DEEP_BLUE
 }
 }
 };

 return (
 <Box p="lg" style={{ }}>
 {/* Header */}
 <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" gap="sm">
 <Box>
 <Title order={2} style={{ color: dark ? '#fff' : DEEP_BLUE}}>
 POD Work Hours
 </Title>
 <Text size="sm" c="dimmed" mt={2}>
 Hours logged per resource against each POD — including buffer contributions from cross-pod helpers
 </Text>
 </Box>
 <PeriodSelector
 year={year} setYear={setYear}
 period={period} setPeriod={setPeriod}
 periodIndex={periodIndex} setPeriodIndex={setPeriodIndex}
 dark={dark}
 />
 </Group>

 {/* Period label */}
 {data && (
 <Text size="sm" fw={600} mb="md" style={{ color: AQUA}}>
 {data.periodLabel}
 </Text>
 )}

 {/* Loading / Error */}
 {isLoading && (
 <Box py="xl" style={{ textAlign: 'center' }}>
 <Loader color={AQUA} />
 <Text size="sm" c="dimmed" mt="sm">Loading worklog data…</Text>
 </Box>
 )}
 {isError && (
 <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
 Failed to load POD hours data. Please check that Jira PODs are configured.
 </Alert>
 )}

 {data && !isLoading && (
 <>
 {/* Summary stat cards */}
 <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
 <StatCard
 label="Total Hours Logged" value={fmtHours(data.totalHours)}
 sub={data.periodLabel}
 icon={<IconClock size={16} />} color={AQUA} dark={dark}
 prevValue={prevData?.totalHours}
 />
 <StatCard
 label="Contributors" value={String(data.totalResources)}
 sub="people with logged time"
 icon={<IconUsers size={16} />} color="#818cf8" dark={dark}
 prevValue={prevData?.totalResources}
 />
 <StatCard
 label="Active PODs" value={String(data.totalPods)}
 sub="with at least 1 worklog"
 icon={<IconHexagons size={16} />} color="#34d399" dark={dark}
 prevValue={prevData?.totalPods}
 />
 <StatCard
 label="Buffer Hours" value={fmtHours(data.bufferHours)}
 sub={`${bufferPct}% of total · cross-POD extra effort`}
 icon={<IconAlertTriangle size={16} />} color={BUFFER_COLOR} dark={dark}
 prevValue={prevData?.bufferHours}
 />
 </Box>

 {data.totalHours === 0 ? (
 <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
 No worklog data found for {data.periodLabel}. Make sure Jira PODs are configured and worklogs have been synced.
 </Alert>
 ) : (
 <>
 {/* Legend */}
 <Group gap={16} mb="md">
 <Group gap={6}>
 <Box style={{ width: 12, height: 12, borderRadius: 3, background: AQUA }} />
 <Text size="xs" c="dimmed">Assigned (home POD)</Text>
 </Group>
 <Group gap={6}>
 <Box style={{ width: 12, height: 12, borderRadius: 3, background: BUFFER_COLOR }} />
 <Text size="xs" c="dimmed">Buffer (cross-POD contribution)</Text>
 </Group>
 </Group>

 {/* Per-POD summary chips */}
 <PodSummaryCards
 podSummaries={data.podSummaries}
 dark={dark}
 onBufferClick={setBufferPod}
 />

 {/* Search bar + views */}
 <Tabs defaultValue="matrix" keepMounted={false} styles={tabStyles}>
 <Group justify="space-between" align="center" mb={0} wrap="wrap" gap="sm">
 <Tabs.List style={{ marginBottom: 0 }}>
 <Tabs.Tab value="matrix">Matrix View</Tabs.Tab>
 <Tabs.Tab value="details">Detailed List</Tabs.Tab>
 </Tabs.List>

 {/* Search input */}
 <TextInput
 placeholder="Search by name, role, or POD…"
 size="sm"
 leftSection={<IconSearch size={14} />}
 value={search}
 onChange={e => setSearch(e.currentTarget.value)}
 style={{ width: 260 }}
 styles={{
 input: {background: dark ? 'rgba(255,255,255,0.05)' : '#fff',
 borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(12,35,64,0.15)'
 }}}
 />
 </Group>

 <Box mt="md">
 <Tabs.Panel value="matrix">
 <MatrixTab resources={data.resources} podNames={podNames} dark={dark} search={search} />
 </Tabs.Panel>
 <Tabs.Panel value="details">
 <DetailsTab resources={data.resources} dark={dark} search={search} />
 </Tabs.Panel>
 </Box>
 </Tabs>
 </>
 )}
 </>
 )}

 <BufferDrillModal
 pod={bufferPod}
 resources={data?.resources ?? []}
 dark={dark}
 opened={bufferPod !== null}
 onClose={() => setBufferPod(null)}
 />
 </Box>
 );
}
