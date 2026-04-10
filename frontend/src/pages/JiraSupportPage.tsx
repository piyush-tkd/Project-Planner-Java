import { useState, useMemo, useEffect, useRef } from 'react';
import {
 Title, Text, Group, Stack, Badge, Tooltip, ActionIcon, Select,
 Table, Paper, Alert, Center, Tabs, ThemeIcon, Anchor,
 Indicator, SimpleGrid, Box, Drawer, Divider, ScrollArea, SegmentedControl, Modal,
 TextInput, Switch, Button,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import PageSkeleton from '../components/common/PageSkeleton';
import { EmptyState } from '../components/ui';
import CsvToolbar from '../components/common/CsvToolbar';
import type { CsvColumnDef } from '../utils/csv';
import {
 IconRefresh, IconAlertTriangle, IconSettings, IconTicket,
 IconClock, IconUser, IconTag, IconCircleCheck, IconSortAscending,
 IconSortDescending, IconSelector, IconExternalLink, IconChartLine,
 IconAlertCircle, IconSearch, IconDatabase,
} from '@tabler/icons-react';
import {
 ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
 LineChart, Line,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDarkMode } from '../hooks/useDarkMode';
import {
 useSupportSnapshot, useSupportHistory, useSupportMonthlyThroughput,
 useAllSupportTickets,
 SupportTicket, SupportBoardSnapshot,
} from '../api/jira';
import { useJiraStatus } from '../api/jira';
import WidgetGrid, { Widget } from '../components/layout/WidgetGrid';
import ChartCard from '../components/common/ChartCard';
import { COLOR_AMBER, COLOR_BLUE_LIGHT, COLOR_ERROR, COLOR_ERROR_DEEP, COLOR_GREEN_LIGHT, COLOR_ORANGE, COLOR_SUCCESS, COLOR_VIOLET_LIGHT, FONT_FAMILY, GRAY_300 } from '../brandTokens';

// ── Palette ────────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
 Critical: COLOR_ERROR, Blocker: COLOR_ERROR, Highest: COLOR_ERROR,
 High: COLOR_ORANGE,
 Medium: COLOR_AMBER,
 Low: COLOR_BLUE_LIGHT,
 Lowest: GRAY_300,
};

const STATUS_COLORS: Record<string, string> = {
 'To Do': GRAY_300, 'Open': GRAY_300,
 'Waiting': '#74c0fc', 'Pending': '#74c0fc',
 'In Progress': COLOR_BLUE_LIGHT,
 'In Review': COLOR_VIOLET_LIGHT,
 'Blocked': COLOR_ERROR,
 'Resolved': COLOR_GREEN_LIGHT, 'Done': COLOR_SUCCESS,
};

const CHART_PALETTE = [
 COLOR_BLUE_LIGHT,COLOR_GREEN_LIGHT,COLOR_AMBER,COLOR_ORANGE,COLOR_ERROR,
 COLOR_VIOLET_LIGHT,'#20c997','#f06595','#74c0fc','#a9e34b',
];

const PRIORITY_ORDER = ['Critical','Blocker','Highest','High','Medium','Low','Lowest'];
const URGENT_PRIORITIES = new Set(['Critical','Blocker','Highest','High']);

// ── SLA tiers (business-day thresholds) ────────────────────────────────────────
const SLA_THRESHOLD_DAYS: Record<string, number> = {
 Critical: 1, Blocker: 1, Highest: 1,
 High: 3,
 Medium: 7,
 Low: 14,
 Lowest: 14,
};
const DEFAULT_SLA_DAYS = 7;

type SlaStatus = 'breached' | 'at_risk' | 'ok' | 'unknown';

function getSlaStatus(ticket: SupportTicket): { status: SlaStatus; threshold: number; age: number } {
 const priority = ticket.priority ?? '';
 const threshold = SLA_THRESHOLD_DAYS[priority] ?? DEFAULT_SLA_DAYS;
 const age = ageDays(ticket.created);
 if (!priority) return { status: 'unknown', threshold, age };
 if (age >= threshold) return { status: 'breached', threshold, age };
 if (age >= threshold * 0.7) return { status: 'at_risk', threshold, age };
 return { status: 'ok', threshold, age };
}

const SLA_COLOR: Record<SlaStatus, string> = {
 breached: COLOR_ERROR,
 at_risk: COLOR_ORANGE,
 ok: COLOR_GREEN_LIGHT,
 unknown: GRAY_300,
};

const SLA_LABEL: Record<SlaStatus, string> = {
 breached: 'Breached',
 at_risk: 'At Risk',
 ok: 'OK',
 unknown: '—',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
 if (!iso) return '—';
 try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
 catch { return iso; }
}

function formatRelative(iso: string | null) {
 if (!iso) return '—';
 try {
 const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
 if (days === 0) return 'today';
 if (days === 1) return 'yesterday';
 return `${days}d ago`;
 } catch { return iso; }
}

function jiraUrl(base: string | undefined, key: string) {
 return base ? `${base.replace(/\/$/, '')}/browse/${key}` : '#';
}

function ageDays(iso: string | null) {
 if (!iso) return 0;
 return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon, onClick }: {
 label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode;
 onClick?: () => void;
}) {
 return (
 <Paper
 withBorder p="md" radius="md"
 onClick={onClick}
 style={{
 cursor: onClick ? 'pointer' : undefined,
 transition: onClick ? 'box-shadow 0.15s ease, transform 0.1s ease' : undefined,
 userSelect: 'none',
 }}
 onMouseEnter={onClick ? e => {
 (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)';
 (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
 } : undefined}
 onMouseLeave={onClick ? e => {
 (e.currentTarget as HTMLElement).style.boxShadow = '';
 (e.currentTarget as HTMLElement).style.transform = '';
 } : undefined}
 >
 <Group justify="space-between" wrap="nowrap" gap="xs">
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>{label}</Text>
 <Text fw={800} size="xl" mt={4} style={{ fontFamily: FONT_FAMILY }}>{value}</Text>
 {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
 </Box>
 <ThemeIcon color={color} size={44} radius="md" variant="light">{icon}</ThemeIcon>
 </Group>
 </Paper>
 );
}

// ── Chart Panel — wraps ChartCard for zoom + camera on every chart ─────────────

function ChartPanel({ title, children, minH = 280 }: { title: string; children: React.ReactNode; minH?: number }) {
 return (
 <ChartCard title={title} minHeight={minH}>
 {children}
 </ChartCard>
 );
}

// ── Donut Chart ────────────────────────────────────────────────────────────────

function DonutChart({ data, colorMap, onSliceClick }: {
 data: { name: string; value: number }[];
 colorMap: Record<string, string>;
 onSliceClick?: (name: string) => void;
}) {
 if (!data.length) return <Center h={180}><Text size="sm" c="dimmed">No data</Text></Center>;
 // Dynamic height: base 200 for donut + ~22px per legend row (assume ~3 items per row)
 const legendRows = Math.ceil(data.length / 3);
 const chartHeight = Math.max(240, 200 + legendRows * 28);
 return (
 <ResponsiveContainer width="100%" height={chartHeight}>
 <PieChart>
 <Pie
 data={data} cx="50%" cy={90} innerRadius={48} outerRadius={76} paddingAngle={2}
 dataKey="value"
 cursor={onSliceClick ? 'pointer' : undefined}
 onClick={onSliceClick ? (entry: { name: string }) => onSliceClick(entry.name) : undefined}
 >
 {data.map((e, i) => (
 <Cell
 key={e.name}
 fill={colorMap[e.name] ?? CHART_PALETTE[i % CHART_PALETTE.length]}
 stroke="none"
 />
 ))}
 </Pie>
 <RTooltip
 formatter={(v: number, n: string) => [v, n]}
 contentStyle={{ fontSize: 12 }}
 />
 <Legend
 iconType="circle"
 iconSize={7}
 wrapperStyle={{ fontSize: 10, lineHeight: '18px', paddingTop: 4 }}
 formatter={(v: string) => (
 <span
 style={{ fontSize: 10, cursor: onSliceClick ? 'pointer' : undefined }}
 onClick={onSliceClick ? () => onSliceClick(v) : undefined}
 >{v}</span>
 )}
 />
 </PieChart>
 </ResponsiveContainer>
 );
}

// ── Horizontal Bar ─────────────────────────────────────────────────────────────

function HBar({ data, color = COLOR_BLUE_LIGHT, height = 180, onBarClick }: {
 data: { name: string; value: number }[];
 color?: string;
 height?: number;
 onBarClick?: (name: string) => void;
}) {
 if (!data.length) return <Center h={height}><Text size="sm" c="dimmed">No data</Text></Center>;
 return (
 <ResponsiveContainer width="100%" height={height}>
 <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} />
 <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
 <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
 <RTooltip formatter={(v: number) => [v, 'tickets']} contentStyle={{ fontSize: 12 }} />
 <Bar
 dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18}
 cursor={onBarClick ? 'pointer' : undefined}
 onClick={onBarClick ? (entry: { name: string }) => onBarClick(entry.name) : undefined}
 />
 </BarChart>
 </ResponsiveContainer>
 );
}

// ── Vertical Bar ───────────────────────────────────────────────────────────────

function VBar({ data, onBarClick }: {
 data: { date: string; label: string; count: number }[];
 onBarClick?: (isoDate: string) => void;
}) {
 if (data.every(d => d.count === 0)) return <Center h={160}><Text size="sm" c="dimmed">No tickets in this period</Text></Center>;
 return (
 <ResponsiveContainer width="100%" height={180}>
 <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
 <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
 <RTooltip formatter={(v: number) => [v, 'created']} contentStyle={{ fontSize: 12 }} />
 <Bar
 dataKey="count" fill={COLOR_BLUE_LIGHT} radius={[4, 4, 0, 0]} maxBarSize={24}
 cursor={onBarClick ? 'pointer' : undefined}
 onClick={onBarClick ? (entry: { date: string }) => onBarClick(entry.date) : undefined}
 />
 </BarChart>
 </ResponsiveContainer>
 );
}

// ── Age Histogram ──────────────────────────────────────────────────────────────

const AGE_BUCKETS = [
 { key: 'today', label: 'Today', color: COLOR_GREEN_LIGHT },
 { key: '1-3d', label: '1–3d', color: '#a9e34b' },
 { key: '4-7d', label: '4–7d', color: COLOR_AMBER },
 { key: '8-14d', label: '8–14d', color: COLOR_ORANGE },
 { key: '15-30d',label: '15–30d', color: COLOR_ERROR },
 { key: '30d+', label: '30d+', color: COLOR_ERROR_DEEP },
];

// maps bucket label back to the SupportTicket age predicate
const AGE_BUCKET_FILTER: Record<string, (t: SupportTicket) => boolean> = {
 'Today': t => ageDays(t.created) === 0,
 '1–3d': t => { const d = ageDays(t.created); return d >= 1 && d <= 3; },
 '4–7d': t => { const d = ageDays(t.created); return d >= 4 && d <= 7; },
 '8–14d': t => { const d = ageDays(t.created); return d >= 8 && d <= 14; },
 '15–30d': t => { const d = ageDays(t.created); return d >= 15 && d <= 30; },
 '30d+': t => ageDays(t.created) > 30,
};

function AgeHistogram({ tickets, onBarClick }: {
 tickets: SupportTicket[];
 onBarClick?: (label: string) => void;
}) {
 const data = useMemo(() => {
 const counts: Record<string, number> = { today: 0, '1-3d': 0, '4-7d': 0, '8-14d': 0, '15-30d': 0, '30d+': 0 };
 tickets.forEach(t => {
 const d = ageDays(t.created);
 if (d === 0) counts['today']++;
 else if (d <= 3) counts['1-3d']++;
 else if (d <= 7) counts['4-7d']++;
 else if (d <= 14) counts['8-14d']++;
 else if (d <= 30) counts['15-30d']++;
 else counts['30d+']++;
 });
 return AGE_BUCKETS.map(b => ({ name: b.label, value: counts[b.key], color: b.color }));
 }, [tickets]);

 return (
 <ResponsiveContainer width="100%" height={180}>
 <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="name" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
 <RTooltip formatter={(v: number) => [v, 'tickets']} contentStyle={{ fontSize: 12 }} />
 <Bar
 dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}
 cursor={onBarClick ? 'pointer' : undefined}
 onClick={onBarClick ? (entry: { name: string }) => onBarClick(entry.name) : undefined}
 >
 {data.map(d => <Cell key={d.name} fill={d.color} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 );
}

// ── Board Health Table ─────────────────────────────────────────────────────────

function BoardHealthTable({ boards }: { boards: SupportBoardSnapshot[] }) {
 return (
 <Table fz="xs" highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Board</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Open</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Stale</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Stale %</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Avg Age</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Unassigned</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {boards.map(b => {
 const stale = b.tickets.filter(t => t.stale).length;
 const unassigned = b.tickets.filter(t => !t.assignee).length;
 const avg = b.tickets.length
 ? Math.round(b.tickets.reduce((s, t) => s + ageDays(t.created), 0) / b.tickets.length)
 : 0;
 const stalePct = b.tickets.length ? Math.round(stale / b.tickets.length * 100) : 0;
 return (
 <Table.Tr key={b.configId}>
 <Table.Td fw={600}>{b.boardName}</Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{b.tickets.length}</Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>
 {stale > 0
 ? <Badge color="orange" variant="light" size="xs">{stale}</Badge>
 : <Text c="dimmed" size="sm">0</Text>}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>
 <Text size="sm" c={stalePct > 30 ? 'red' : stalePct > 15 ? 'orange' : 'dimmed'}>
 {stalePct}%
 </Text>
 </Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>
 <Text size="sm" c={avg > 14 ? 'red' : avg > 7 ? 'orange' : undefined}>{avg}d</Text>
 </Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>
 {unassigned > 0
 ? <Badge color="red" variant="light" size="xs">{unassigned}</Badge>
 : <Text c="dimmed" size="sm">0</Text>}
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 );
}

// ── Trend Chart ────────────────────────────────────────────────────────────────

function TrendChart({ metric }: { metric: 'openCount' | 'staleCount' | 'avgAgeDays' }) {
 const { data: history = [] } = useSupportHistory(30);

 const chartData = useMemo(() => {
 if (!history.length) return [];
 const allDates = [...new Set(history.flatMap(b => b.history.map(d => d.date)))].sort();
 return allDates.map(date => {
 const row: Record<string, string | number> = { date: date.slice(5).replace('-', '/') };
 history.forEach(b => {
 const point = b.history.find(d => d.date === date);
 row[b.boardName] = point ? (point[metric] as number) : 0;
 });
 return row;
 });
 }, [history, metric]);

 if (chartData.length < 2) return (
 <Center h={180}>
 <Stack align="center" gap="xs">
 <IconChartLine size={28} color="var(--mantine-color-dimmed)" />
 <Text size="sm" c="dimmed">History builds up after the first day of use</Text>
 {chartData.length === 1 && (
 <Text size="xs" c="dimmed">First snapshot captured — check back tomorrow</Text>
 )}
 </Stack>
 </Center>
 );

 const boardNames = history.map(b => b.boardName);

 return (
 <ResponsiveContainer width="100%" height={200}>
 <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
 <YAxis tick={{ fontSize: 10 }} allowDecimals={metric === 'avgAgeDays'} />
 <RTooltip />
 <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
 {boardNames.map((name, i) => (
 <Line
 key={name}
 type="monotone"
 dataKey={name}
 stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
 strokeWidth={2}
 dot={false}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 );
}

// ── Monthly Throughput Chart ───────────────────────────────────────────────────

function MonthlyThroughputChart({ months }: { months: number }) {
 const { data = [], isLoading } = useSupportMonthlyThroughput(months);

 const chartData = useMemo(() => {
 if (!data.length) return [];
 // Collect all month labels in order
 const allMonths = data[0]?.months.map(p => p.month) ?? [];
 return allMonths.map(mon => {
 const row: Record<string, string | number> = {
 month: mon.slice(0, 7).replace('-', '/'), // "YYYY/MM"
 };
 data.forEach(board => {
 const pt = board.months.find(p => p.month === mon);
 row[`${board.boardName} Created`] = pt?.created ?? 0;
 row[`${board.boardName} Closed`] = pt?.closed ?? 0;
 });
 return row;
 });
 }, [data]);

 if (isLoading) return <PageSkeleton variant="table" />;
 if (!chartData.length) return (
 <Center h={180}>
 <Text size="sm" c="dimmed">No data yet — make sure support boards are configured</Text>
 </Center>
 );

 // Each board gets a pair of bars (created = solid, closed = lighter shade)
 const barPairs = data.flatMap((board, i) => {
 const base = CHART_PALETTE[i % CHART_PALETTE.length];
 return [
 <Bar animationDuration={600} key={`${board.boardName}-created`} dataKey={`${board.boardName} Created`}
 name={data.length === 1 ? 'Created' : `${board.boardName} Created`}
 fill={base} radius={[3, 3, 0, 0]} maxBarSize={24} />,
 <Bar animationDuration={600} key={`${board.boardName}-closed`} dataKey={`${board.boardName} Closed`}
 name={data.length === 1 ? 'Closed' : `${board.boardName} Closed`}
 fill={base} fillOpacity={0.4} radius={[3, 3, 0, 0]} maxBarSize={24} />,
 ];
 });

 return (
 <Stack gap="md">
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%">
 <CartesianGrid strokeDasharray="3 3" vertical={false} />
 <XAxis dataKey="month" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
 <RTooltip />
 <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
 {barPairs}
 </BarChart>
 </ResponsiveContainer>

 {/* ── Per-month data table ── */}
 {data.map(board => (
 <Stack key={board.boardId} gap={4}>
 {data.length > 1 && (
 <Text size="xs" fw={600} c="dimmed">{board.boardName}</Text>
 )}
 <Table fz="xs" withTableBorder withColumnBorders
 horizontalSpacing="xs" verticalSpacing={4}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Month</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Created</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Closed</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Net</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {board.months.map(pt => {
 const net = pt.closed - pt.created;
 return (
 <Table.Tr key={pt.month}>
 <Table.Td>{pt.month}</Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{pt.created}</Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{pt.closed}</Table.Td>
 <Table.Td style={{
 textAlign: 'right',
 fontWeight: 600,
 color: net >= 0
 ? 'var(--mantine-color-green-7)'
 : 'var(--mantine-color-red-7)',
 }}>
 {net > 0 ? '+' : ''}{net}
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </Stack>
 ))}
 </Stack>
 );
}

// ── Needs Attention Panel ─────────────────────────────────────────────────────

function NeedsAttentionPanel({ tickets, jiraBaseUrl }: { tickets: SupportTicket[]; jiraBaseUrl?: string }) {
 const isDark = useDarkMode();
 const urgent = tickets.filter(t => t.stale && URGENT_PRIORITIES.has(t.priority ?? ''));
 if (!urgent.length) return null;
 return (
 <Paper withBorder radius="md" p="md" style={{ borderColor: 'var(--mantine-color-red-4)', borderWidth: 2 }}>
 <Group gap="xs" mb="sm">
 <ThemeIcon color="red" size="sm" radius="xl" variant="filled">
 <IconAlertCircle size={12} />
 </ThemeIcon>
 <Text fw={700} size="sm" c="red" style={{ fontFamily: FONT_FAMILY }}>
 Needs Attention — {urgent.length} high-priority stale ticket{urgent.length > 1 ? 's' : ''}
 </Text>
 </Group>
 <Stack gap={6}>
 {urgent.map(t => (
 <Group key={t.key} justify="space-between" wrap="nowrap" gap="xs"
 style={{ padding: '6px 8px', borderRadius: 6, background: isDark ? 'rgba(239,68,68,0.1)' : 'var(--mantine-color-red-0)' }}>
 <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
 <Badge
 size="xs" variant="filled"
 style={{ background: PRIORITY_COLORS[t.priority ?? ''] ?? '#aaa', minWidth: 60 }}
 >
 {t.priority}
 </Badge>
 <Anchor
 href={jiraUrl(jiraBaseUrl, t.key)} target="_blank" rel="noopener noreferrer"
 size="xs" fw={700} style={{ whiteSpace: 'nowrap' }}
 >
 {t.key}
 </Anchor>
 <Text size="xs" lineClamp={1} style={{ flex: 1 }}>{t.summary}</Text>
 </Group>
 <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
 <Text size="xs" c="dimmed">{t.assignee ?? 'Unassigned'}</Text>
 <Text size="xs" c="orange" fw={600}>
 last update {formatRelative(t.lastCommentDate ?? t.updated)}
 </Text>
 </Group>
 </Group>
 ))}
 </Stack>
 </Paper>
 );
}

// ── Ticket Detail Drawer ───────────────────────────────────────────────────────

function TicketDetailDrawer({ ticket, jiraBaseUrl, onClose }: {
 ticket: SupportTicket | null; jiraBaseUrl?: string; onClose: () => void;
}) {
 const isDark = useDarkMode();
 return (
 <Drawer
 opened={!!ticket}
 onClose={onClose}
 position="right"
 size="md"
 title={
 ticket ? (
 <Group gap="sm">
 <Anchor href={jiraUrl(jiraBaseUrl, ticket.key)} target="_blank" rel="noopener noreferrer" fw={700}>
 {ticket.key}
 </Anchor>
 <ActionIcon
 component="a" href={jiraUrl(jiraBaseUrl, ticket?.key ?? '')}
 target="_blank" rel="noopener noreferrer"
 variant="subtle" size="sm"
 >
 <IconExternalLink size={14} />
 </ActionIcon>
 </Group>
 ) : null
 }
 >
 {ticket && (
 <ScrollArea h="100%" pr="sm">
 <Stack gap="md">
 <Text fw={600} size="md">{ticket.summary}</Text>

 <SimpleGrid cols={2} spacing="xs">
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Status</Text>
 <Badge mt={4}
 style={{ background: (STATUS_COLORS[ticket.status ?? ''] ?? GRAY_300) + '22',
 color: STATUS_COLORS[ticket.status ?? ''] ?? GRAY_300 }}
 variant="light"
 >
 {ticket.status ?? '—'}
 </Badge>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Priority</Text>
 <Badge mt={4}
 style={{ background: (PRIORITY_COLORS[ticket.priority ?? ''] ?? GRAY_300) + '22',
 color: PRIORITY_COLORS[ticket.priority ?? ''] ?? GRAY_300 }}
 variant="light"
 >
 {ticket.priority ?? '—'}
 </Badge>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Reporter</Text>
 <Text size="sm" mt={4}>{ticket.reporter ?? '—'}</Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Assignee</Text>
 <Text size="sm" mt={4} c={ticket.assignee ? undefined : 'dimmed'}>
 {ticket.assignee ?? 'Unassigned'}
 </Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Created</Text>
 <Text size="sm" mt={4}>{formatDate(ticket.created)}</Text>
 <Text size="xs" c="dimmed">({formatRelative(ticket.created)})</Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Last Updated</Text>
 <Text size="sm" mt={4}>{formatDate(ticket.updated)}</Text>
 <Text size="xs" c="dimmed">({formatRelative(ticket.updated)})</Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Status Changed</Text>
 <Text size="sm" mt={4}>{formatDate(ticket.lastStatusChangeDate)}</Text>
 </Box>
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Staleness</Text>
 {ticket.stale
 ? <Badge mt={4} color="orange" variant="light">⚠ Stale</Badge>
 : <Badge mt={4} color="green" variant="light">Active</Badge>}
 </Box>
 </SimpleGrid>

 {(ticket.labels ?? []).length > 0 && (
 <>
 <Divider />
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={6}>Labels</Text>
 <Group gap={6}>
 {ticket.labels.map(l => (
 <Badge key={l} size="sm" variant="outline" color="violet">{l}</Badge>
 ))}
 </Group>
 </Box>
 </>
 )}

 {ticket.lastCommentSnippet && (
 <>
 <Divider />
 <Box>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={6}>
 Last Comment
 {ticket.lastCommentDate && (
 <Text span c="dimmed" fw={400}> · {formatRelative(ticket.lastCommentDate)}</Text>
 )}
 </Text>
 <Paper withBorder p="sm" radius="sm" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'var(--mantine-color-gray-0)' }}>
 <Text size="sm">{ticket.lastCommentSnippet}</Text>
 </Paper>
 </Box>
 </>
 )}
 </Stack>
 </ScrollArea>
 )}
 </Drawer>
 );
}

// ── KPI Ticket List Modal ─────────────────────────────────────────────────────

function TicketListModal({ title, tickets, jiraBaseUrl, opened, onClose, onOpen }: {
 title: string;
 tickets: SupportTicket[];
 jiraBaseUrl?: string;
 opened: boolean;
 onClose: () => void;
 onOpen: (t: SupportTicket) => void;
}) {
 return (
 <Modal
 opened={opened}
 onClose={onClose}
 title={
 <Group gap="xs">
 <Text fw={700}>{title}</Text>
 <Badge variant="light" color="blue">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</Badge>
 </Group>
 }
 size="1400px"
 scrollAreaComponent={ScrollArea.Autosize}
 >
 {tickets.length === 0 ? (
 <Center py="xl">
 <Text c="dimmed" size="sm">No tickets match this filter.</Text>
 </Center>
 ) : (
 <Table fz="xs" highlightOnHover withTableBorder style={{ cursor: 'pointer' }}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 90 }}>Key</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th style={{ minWidth: 90 }}>Priority</Table.Th>
 <Table.Th style={{ minWidth: 100 }}>Status</Table.Th>
 <Table.Th style={{ minWidth: 60 }} ta="right">Age</Table.Th>
 <Table.Th style={{ minWidth: 110 }}>Assignee</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {tickets
 .slice()
 .sort((a, b) => ageDays(a.created) < ageDays(b.created) ? 1 : -1)
 .map(t => (
 <Table.Tr key={t.key} onClick={() => onOpen(t)}>
 <Table.Td>
 {jiraBaseUrl ? (
 <Anchor
 href={jiraUrl(jiraBaseUrl, t.key)}
 target="_blank" rel="noopener noreferrer"
 fw={700} size="xs"
 onClick={e => e.stopPropagation()}
 >
 {t.key}
 </Anchor>
 ) : (
 <Text fw={700} size="xs" c="teal">{t.key}</Text>
 )}
 </Table.Td>
 <Table.Td>
 <Text size="xs" lineClamp={1}>{t.summary}</Text>
 </Table.Td>
 <Table.Td>
 <Badge
 size="xs"
 style={{
 backgroundColor: (PRIORITY_COLORS[t.priority ?? ''] ?? GRAY_300) + '22',
 color: PRIORITY_COLORS[t.priority ?? ''] ?? GRAY_300,
 }}
 >
 {t.priority ?? '—'}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Badge
 size="xs"
 style={{
 backgroundColor: (STATUS_COLORS[t.status ?? ''] ?? GRAY_300) + '22',
 color: STATUS_COLORS[t.status ?? ''] ?? GRAY_300,
 }}
 >
 {t.status ?? '—'}
 </Badge>
 </Table.Td>
 <Table.Td ta="right">
 <Text
 size="xs"
 fw={600}
 c={ageDays(t.created) > 14 ? 'red' : ageDays(t.created) > 7 ? 'orange' : 'dimmed'}
 >
 {ageDays(t.created)}d
 </Text>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c={t.assignee ? undefined : 'dimmed'}>
 {t.assignee ?? 'Unassigned'}
 </Text>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 )}
 </Modal>
 );
}

// ── CSV column definitions ─────────────────────────────────────────────────────

const SUPPORT_CSV_COLUMNS: CsvColumnDef<SupportTicket>[] = [
 { key: 'key', header: 'Key' },
 { key: 'summary', header: 'Summary' },
 { key: 'status', header: 'Status' },
 { key: 'priority', header: 'Priority' },
 { key: 'reporter', header: 'Reporter' },
 { key: 'assignee', header: 'Assignee' },
 { key: 'created', header: 'Created' },
 { key: 'updated', header: 'Last Updated' },
 { key: 'stale', header: 'Stale', format: t => t.stale ? 'Yes' : 'No' },
 { key: 'labels', header: 'Labels', format: t => (t.labels ?? []).join(', ') },
];

// ── Sort helpers ───────────────────────────────────────────────────────────────

type SortField = 'key' | 'status' | 'priority' | 'reporter' | 'assignee' | 'created' | 'updated';

function sortTickets(tickets: SupportTicket[], field: SortField | null, dir: 'asc' | 'desc') {
 if (!field) return tickets;
 return [...tickets].sort((a, b) => {
 let av: string | number = '', bv: string | number = '';
 if (field === 'priority') {
 av = PRIORITY_ORDER.indexOf(a.priority ?? '') === -1 ? 99 : PRIORITY_ORDER.indexOf(a.priority ?? '');
 bv = PRIORITY_ORDER.indexOf(b.priority ?? '') === -1 ? 99 : PRIORITY_ORDER.indexOf(b.priority ?? '');
 return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
 }
 if (field === 'created' || field === 'updated') {
 av = a[field] ? new Date(a[field]!).getTime() : 0;
 bv = b[field] ? new Date(b[field]!).getTime() : 0;
 return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
 }
 av = (a[field] as string) ?? '';
 bv = (b[field] as string) ?? '';
 return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
 });
}

function SortIcon({ field, active, dir }: { field: string; active: string | null; dir: 'asc' | 'desc' }) {
 if (active !== field) return <IconSelector size={12} opacity={0.3} />;
 return dir === 'asc' ? <IconSortAscending size={12} /> : <IconSortDescending size={12} />;
}

// ── Ticket Row ──────────────────────────────────────────────────────────────────

const TIME_WINDOWS = [
 { value: 'all', label: 'All Open' },
 { value: 'today', label: 'Created Today' },
 { value: 'last3', label: 'Last 3 Days' },
 { value: 'last7', label: 'Last 7 Days' },
 { value: 'older', label: 'Older' },
];

function TicketRow({ ticket, jiraBaseUrl, onLabelClick, onOpen }: {
 ticket: SupportTicket; jiraBaseUrl?: string;
 onLabelClick: (l: string) => void; onOpen: (t: SupportTicket) => void;
}) {
 const staleStyle = ticket.stale ? { backgroundColor: 'var(--mantine-color-orange-0)' } : undefined;
 const visibleLabels = (ticket.labels ?? []).slice(0, 2);
 const extraLabels = (ticket.labels ?? []).slice(2);
 const lastUpdate = ticket.lastCommentDate ?? ticket.updated;

 return (
 <Table.Tr style={staleStyle}>
 <Table.Td>
 <Group gap={4} wrap="nowrap">
 {ticket.stale && (
 <Tooltip label="No update for threshold business days" withArrow>
 <ThemeIcon color="orange" size="xs" variant="light" radius="xl">
 <IconAlertTriangle size={10} />
 </ThemeIcon>
 </Tooltip>
 )}
 <Anchor href={jiraUrl(jiraBaseUrl, ticket.key)} target="_blank" rel="noopener noreferrer"
 size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, whiteSpace: 'nowrap' }}>
 {ticket.key}
 </Anchor>
 </Group>
 </Table.Td>

 <Table.Td style={{ maxWidth: 260, cursor: 'pointer' }} onClick={() => onOpen(ticket)}>
 <Text size="sm" lineClamp={2} title={ticket.summary ?? ''}>{ticket.summary}</Text>
 </Table.Td>

 <Table.Td>
 <Badge size="sm" variant="light"
 style={{ background: (STATUS_COLORS[ticket.status ?? ''] ?? GRAY_300) + '22',
 color: STATUS_COLORS[ticket.status ?? ''] ?? GRAY_300 }}>
 {ticket.status ?? '—'}
 </Badge>
 </Table.Td>

 <Table.Td>
 {ticket.priority
 ? <Badge size="sm" variant="light"
 style={{ background: (PRIORITY_COLORS[ticket.priority] ?? GRAY_300) + '22',
 color: PRIORITY_COLORS[ticket.priority] ?? GRAY_300 }}>
 {ticket.priority}
 </Badge>
 : <Text size="sm" c="dimmed">—</Text>}
 </Table.Td>

 <Table.Td style={{ maxWidth: 160 }}>
 {!(ticket.labels ?? []).length
 ? <Text size="xs" c="dimmed">—</Text>
 : <Group gap={4}>
 {visibleLabels.map(l => (
 <Badge key={l} size="xs" variant="outline" color="gray"
 style={{ cursor: 'pointer' }} onClick={() => onLabelClick(l)}>
 {l}
 </Badge>
 ))}
 {extraLabels.length > 0 && (
 <Tooltip label={extraLabels.join(', ')} withArrow>
 <Badge size="xs" variant="outline" color="gray">+{extraLabels.length}</Badge>
 </Tooltip>
 )}
 </Group>}
 </Table.Td>

 <Table.Td><Text size="sm">{ticket.reporter ?? '—'}</Text></Table.Td>
 <Table.Td>
 <Text size="sm" c={ticket.assignee ? undefined : 'dimmed'}>
 {ticket.assignee ?? 'Unassigned'}
 </Text>
 </Table.Td>

 <Table.Td>
 <Tooltip label={formatDate(ticket.created)} withArrow>
 <Text size="sm">{formatRelative(ticket.created)}</Text>
 </Tooltip>
 </Table.Td>

 <Table.Td style={{ maxWidth: 180 }}>
 <Tooltip label={ticket.lastCommentSnippet ?? 'No comments yet'} multiline w={260} withArrow
 disabled={!ticket.lastCommentSnippet}>
 <Stack gap={2}>
 <Text size="xs" c={ticket.stale ? 'orange' : 'dimmed'} fw={ticket.stale ? 600 : undefined}>
 {formatRelative(lastUpdate)}
 </Text>
 {ticket.lastCommentSnippet && (
 <Text size="xs" c="dimmed" lineClamp={1}>{ticket.lastCommentSnippet}</Text>
 )}
 </Stack>
 </Tooltip>
 </Table.Td>

 <Table.Td>
 {(() => {
 const { status, threshold, age } = getSlaStatus(ticket);
 return (
 <Tooltip
 label={status === 'unknown' ? 'No priority set' : `SLA: ${threshold}d threshold · age: ${age}d`}
 withArrow
 >
 <Badge
 size="sm"
 variant="light"
 style={{ background: SLA_COLOR[status] + '22', color: SLA_COLOR[status], cursor: 'default' }}
 >
 {SLA_LABEL[status]}
 </Badge>
 </Tooltip>
 );
 })()}
 </Table.Td>
 </Table.Tr>
 );
}

// ── Board Section ──────────────────────────────────────────────────────────────

function BoardSection({ board, timeWindow, labelFilter, searchText, priorityFilter, assigneeFilter, staleOnly, sortField, sortDir, jiraBaseUrl, onLabelClick, onOpen }: {
 board: SupportBoardSnapshot; timeWindow: string; labelFilter: string;
 searchText: string; priorityFilter: string; assigneeFilter: string; staleOnly: boolean;
 sortField: SortField | null; sortDir: 'asc' | 'desc';
 jiraBaseUrl?: string;
 onLabelClick: (l: string) => void; onOpen: (t: SupportTicket) => void;
 onSortChange: (f: SortField) => void;
}) {
 const tickets = useMemo(() => {
 let ts = timeWindow === 'all' ? board.tickets : board.tickets.filter(t => t.timeWindow === timeWindow);
 if (labelFilter) ts = ts.filter(t => (t.labels ?? []).includes(labelFilter));
 return sortTickets(ts, sortField, sortDir);
 }, [board.tickets, timeWindow, labelFilter, sortField, sortDir]);

 const staleCount = tickets.filter(t => t.stale).length;

 return (
 <Stack gap="xs">
 <Group gap="sm">
 <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>{board.boardName}</Text>
 <Badge variant="light" size="sm">{tickets.length} tickets</Badge>
 {staleCount > 0 && (
 <Badge color="orange" variant="light" size="sm" leftSection={<IconAlertTriangle size={10} />}>
 {staleCount} stale
 </Badge>
 )}
 {board.errorMessage && <Badge color="red" variant="light" size="sm">Error loading</Badge>}
 </Group>

 {board.errorMessage ? (
 <Alert color="red" icon={<IconAlertTriangle size={16} />} py="xs">{board.errorMessage}</Alert>
 ) : !tickets.length ? (
 <Paper withBorder p="md" radius="sm">
 <Text size="sm" c="dimmed" ta="center">No tickets in this window.</Text>
 </Paper>
 ) : (
 <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
 <Table fz="xs" highlightOnHover verticalSpacing="xs">
 <Table.Thead>
 <Table.Tr>
 {([
 ['key', 'Key'], ['', 'Summary'], ['status', 'Status'], ['priority', 'Priority'],
 ['', 'Labels'], ['reporter', 'Reporter'], ['assignee', 'Assignee'],
 ['created', 'Created'], ['updated', 'Last Update'], ['', 'SLA'],
 ] as [string, string][]).map(([f, label]) => (
 <Table.Th key={label}
 style={f ? { cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' } : {}}
 onClick={f ? () => (document as any).__sortHandler?.(f) : undefined}
 >
 <Group gap={4} wrap="nowrap">
 {label}
 {f && <SortIcon field={f} active={sortField} dir={sortDir} />}
 </Group>
 </Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {tickets.map(t => (
 <TicketRow key={t.key} ticket={t} jiraBaseUrl={jiraBaseUrl}
 onLabelClick={onLabelClick} onOpen={onOpen} />
 ))}
 </Table.Tbody>
 </Table>
 </Paper>
 )}
 </Stack>
 );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// ── All Tickets Panel (all statuses, historical) ────────────────────────────

function AllTicketsPanel({ snapshot, jiraBaseUrl, days, statusFilter, onStatusFilter, onChangeDays, onClose, onOpen }: {
 snapshot: import('../api/jira').SupportSnapshot | undefined;
 jiraBaseUrl: string | undefined;
 days: number;
 statusFilter: string;
 onStatusFilter: (s: string) => void;
 onChangeDays: (d: number) => void;
 onClose: () => void;
 onOpen: (t: SupportTicket) => void;
}) {
 const [search, setSearch] = useState('');
 const [priorityF, setPriorityF] = useState('');
 const [assigneeF, setAssigneeF] = useState('');
 const [boardF, setBoardF] = useState('all');

 const allBoards = snapshot?.boards ?? [];
 const boardOptions = [
 { value: 'all', label: 'All Boards' },
 ...allBoards.map(b => ({ value: String(b.configId), label: b.boardName })),
 ];

 const rawTickets = useMemo(
 () => boardF === 'all' ? allBoards.flatMap(b => b.tickets) : (allBoards.find(b => String(b.configId) === boardF)?.tickets ?? []),
 [allBoards, boardF],
 );

 const allStatuses = useMemo(() => {
 const s = new Set(rawTickets.map(t => t.status).filter(Boolean) as string[]);
 return ['', ...Array.from(s).sort()];
 }, [rawTickets]);

 const allPriorities = useMemo(() => {
 const present = new Set(rawTickets.map(t => t.priority).filter(Boolean) as string[]);
 return [
 { value: '', label: 'All Priorities' },
 ...PRIORITY_ORDER.filter(p => present.has(p)).map(p => ({ value: p, label: p })),
 ];
 }, [rawTickets]);

 const allAssignees = useMemo(() => {
 const a = new Set(rawTickets.map(t => t.assignee ?? 'Unassigned'));
 return [{ value: '', label: 'All Assignees' }, ...[...a].sort().map(v => ({ value: v, label: v }))];
 }, [rawTickets]);

 const filtered = useMemo(() => {
 let ts = rawTickets;
 if (statusFilter) ts = ts.filter(t => t.status === statusFilter);
 if (priorityF) ts = ts.filter(t => t.priority === priorityF);
 if (assigneeF) ts = ts.filter(t => (t.assignee ?? 'Unassigned') === assigneeF);
 if (search) {
 const q = search.toLowerCase();
 ts = ts.filter(t => t.key.toLowerCase().includes(q) || (t.summary ?? '').toLowerCase().includes(q));
 }
 return ts;
 }, [rawTickets, statusFilter, priorityF, assigneeF, search]);

 const statusOptions = allStatuses.map(s => ({ value: s, label: s || 'All Statuses' }));

 return (
 <Stack gap="sm">
 <Group justify="space-between" wrap="nowrap">
 <Group gap="sm" wrap="wrap" align="flex-end">
 <TextInput
 placeholder="Search key or summary…"
 leftSection={<IconSearch size={14} />}
 value={search}
 onChange={e => setSearch(e.currentTarget.value)}
 style={{ width: 220 }}
 size="sm"
 />
 <Select data={boardOptions} value={boardF} onChange={v => setBoardF(v ?? 'all')} style={{ width: 160 }} size="sm" />
 <Select data={statusOptions} value={statusFilter} onChange={v => onStatusFilter(v ?? '')} style={{ width: 170 }} size="sm" placeholder="All Statuses" />
 <Select data={allPriorities} value={priorityF} onChange={v => setPriorityF(v ?? '')} style={{ width: 155 }} size="sm" />
 <Select data={allAssignees} value={assigneeF} onChange={v => setAssigneeF(v ?? '')} style={{ width: 170 }} size="sm" searchable />
 <Select
 size="xs"
 style={{ width: 130 }}
 value={String(days)}
 onChange={v => onChangeDays(Number(v ?? 90))}
 data={[
 { value: '30', label: 'Last 30 days' },
 { value: '60', label: 'Last 60 days' },
 { value: '90', label: 'Last 90 days' },
 { value: '180', label: 'Last 180 days' },
 { value: '365', label: 'Last 365 days' },
 ]}
 />
 </Group>
 <Group gap="xs">
 <Text size="xs" c="dimmed">{filtered.length.toLocaleString()} tickets</Text>
 <Button size="xs" variant="subtle" color="gray" onClick={onClose}>Hide</Button>
 </Group>
 </Group>

 <ScrollArea>
 <Table fz="xs" highlightOnHover withTableBorder withColumnBorders style={{ fontSize: 12 }}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ width: 100 }}>Key</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th style={{ width: 120 }}>Status</Table.Th>
 <Table.Th style={{ width: 90 }}>Priority</Table.Th>
 <Table.Th style={{ width: 140 }}>Assignee</Table.Th>
 <Table.Th style={{ width: 110 }}>Created</Table.Th>
 <Table.Th style={{ width: 110 }}>Updated</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {filtered.slice(0, 300).map(t => (
 <Table.Tr key={t.key} style={{ cursor: 'pointer' }} onClick={() => onOpen(t)}>
 <Table.Td>
 <Anchor href={jiraUrl(jiraBaseUrl, t.key)} target="_blank" size="xs" fw={600}
 onClick={e => e.stopPropagation()}>
 {t.key}
 </Anchor>
 </Table.Td>
 <Table.Td>
 <Text size="xs" lineClamp={2}>{t.summary}</Text>
 </Table.Td>
 <Table.Td>
 {t.status && (
 <Badge size="xs" variant="light"
 color={STATUS_COLORS[t.status] ? undefined : 'gray'}
 style={STATUS_COLORS[t.status] ? { backgroundColor: STATUS_COLORS[t.status] + '22', color: STATUS_COLORS[t.status] } : undefined}>
 {t.status}
 </Badge>
 )}
 </Table.Td>
 <Table.Td>
 {t.priority && (
 <Text size="xs" fw={500} c={PRIORITY_COLORS[t.priority] ?? 'dimmed'}>{t.priority}</Text>
 )}
 </Table.Td>
 <Table.Td><Text size="xs">{t.assignee ?? <Text span c="dimmed">Unassigned</Text>}</Text></Table.Td>
 <Table.Td><Text size="xs" c="dimmed">{formatDate(t.created)}</Text></Table.Td>
 <Table.Td><Text size="xs" c="dimmed">{formatDate(t.updated)}</Text></Table.Td>
 </Table.Tr>
 ))}
 {filtered.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={7}>
 <Text ta="center" c="dimmed" py="md" size="sm">No tickets match the current filters.</Text>
 </Table.Td>
 </Table.Tr>
 )}
 {filtered.length > 300 && (
 <Table.Tr>
 <Table.Td colSpan={7}>
 <Text ta="center" c="dimmed" py="xs" size="xs">Showing 300 of {filtered.length} — use filters to narrow down.</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Stack>
 );
}

export default function JiraSupportPage() {
 const isDark = useDarkMode();
 const navigate = useNavigate();
 const qc = useQueryClient();

 const [timeWindow, setTimeWindow] = useState('all');
 const [boardFilter, setBoardFilter] = useState('all');
 const [labelFilter, setLabelFilter] = useState('');
 const [sortField, setSortField] = useState<SortField | null>(null);
 const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
 const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);
 const [kpiModal, setKpiModal] = useState<{ title: string; tickets: SupportTicket[] } | null>(null);
 const [autoRefresh, setAutoRefresh] = useState('off');
 const [trendMetric, setTrendMetric] = useState<'openCount' | 'staleCount' | 'avgAgeDays'>('openCount');
 const [throughputMonths, setThroughputMonths] = useState(6);

 // ── Ticket list filters ────────────────────────────────────────────────────
 const [ticketSearch, setTicketSearch] = useState('');
 const [ticketPriority, setTicketPriority] = useState('');
 const [ticketAssignee, setTicketAssignee] = useState('');
 const [ticketStaleOnly, setTicketStaleOnly] = useState(false);

 // ── All-tickets view (all statuses, historical) ────────────────────────────
 const [showAllTickets, setShowAllTickets] = useState(false);
 const [allDays, setAllDays] = useState(90);
 const [allStatusFilter, setAllStatusFilter] = useState('');
 const { data: allTicketsSnapshot, isLoading: allTicketsLoading, refetch: refetchAllTickets } =
 useAllSupportTickets(showAllTickets, allDays);

 const { data: jiraStatus } = useJiraStatus();
 const { data: snapshot, isLoading, error, dataUpdatedAt } =
 useSupportSnapshot(jiraStatus?.configured ?? false);

 const jiraBaseUrl = jiraStatus?.baseUrl;

 // Sort handler stored on window for access inside BoardSection header cells
 useEffect(() => {
 (document as any).__sortHandler = (f: string) => {
 setSortField(prev => {
 if (prev === f) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
 setSortDir('asc'); return f as SortField;
 });
 };
 }, []);

 // Auto-refresh
 const refreshRef = useRef<number | null>(null);
 useEffect(() => {
 if (refreshRef.current) clearInterval(refreshRef.current);
 if (autoRefresh !== 'off') {
 const mins = parseInt(autoRefresh, 10);
 refreshRef.current = window.setInterval(() => {
 qc.invalidateQueries({ queryKey: ['jira', 'support', 'snapshot'] });
 }, mins * 60_000);
 }
 return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
 }, [autoRefresh, qc]);

 function handleRefresh() {
 // Invalidate all support data so snapshot, tickets, history and throughput all reload
 qc.invalidateQueries({ queryKey: ['jira', 'support'] });
 }

 // ── Derived data ───────────────────────────────────────────────────────────

 const allTickets = useMemo(
 () => (snapshot?.boards ?? []).flatMap(b => b.tickets), [snapshot]);

 const openTotal = allTickets.length;
 const staleTotal = allTickets.filter(t => t.stale).length;
 const unassignedTotal = allTickets.filter(t => !t.assignee).length;
 const todayTotal = allTickets.filter(t => t.timeWindow === 'today').length;
 const slaBreachedTotal = allTickets.filter(t => getSlaStatus(t).status === 'breached').length;
 const slaAtRiskTotal = allTickets.filter(t => getSlaStatus(t).status === 'at_risk').length;
 const avgAge = useMemo(() => {
 if (!allTickets.length) return 0;
 return Math.round(allTickets.reduce((s, t) => s + ageDays(t.created), 0) / allTickets.length);
 }, [allTickets]);

 const priorityData = useMemo(() => {
 const c: Record<string, number> = {};
 allTickets.forEach(t => { const p = t.priority ?? 'Unknown'; c[p] = (c[p] || 0) + 1; });
 return PRIORITY_ORDER.filter(p => c[p]).map(p => ({ name: p, value: c[p] }))
 .concat(Object.entries(c).filter(([k]) => !PRIORITY_ORDER.includes(k)).map(([n, v]) => ({ name: n, value: v })));
 }, [allTickets]);

 const statusData = useMemo(() => {
 const c: Record<string, number> = {};
 allTickets.forEach(t => { const s = t.status ?? 'Unknown'; c[s] = (c[s] || 0) + 1; });
 return Object.entries(c).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value);
 }, [allTickets]);

 const labelsData = useMemo(() => {
 const c: Record<string, number> = {};
 allTickets.forEach(t => (t.labels ?? []).forEach(l => { c[l] = (c[l] || 0) + 1; }));
 return Object.entries(c).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value).slice(0, 10);
 }, [allTickets]);

 const assigneeData = useMemo(() => {
 const c: Record<string, number> = {};
 allTickets.forEach(t => { const a = t.assignee ?? 'Unassigned'; c[a] = (c[a] || 0) + 1; });
 return Object.entries(c).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
 }, [allTickets]);

 const reporterData = useMemo(() => {
 const c: Record<string, number> = {};
 allTickets.forEach(t => { const r = t.reporter ?? 'Unknown'; c[r] = (c[r] || 0) + 1; });
 return Object.entries(c).map(([n, v]) => ({ name: n, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);
 }, [allTickets]);

 const timelineData = useMemo(() => {
 const buckets: Record<string, number> = {};
 for (let i = 13; i >= 0; i--) {
 const d = new Date(); d.setDate(d.getDate() - i);
 buckets[d.toISOString().split('T')[0]] = 0;
 }
 allTickets.forEach(t => { if (t.created) { const k = t.created.split('T')[0]; if (k in buckets) buckets[k]++; } });
 // date = ISO "YYYY-MM-DD" (used for filtering), label = "MM/DD" (displayed on axis)
 return Object.entries(buckets).map(([d, c]) => ({ date: d, label: d.slice(5).replace('-', '/'), count: c }));
 }, [allTickets]);

 const labelOptions = useMemo(() => [
 { value: '', label: 'All Labels' },
 ...labelsData.map(l => ({ value: l.name, label: `${l.name} (${l.value})` })),
 ], [labelsData]);

 const priorityFilterOptions = useMemo(() => {
 const presentPriorities = new Set(allTickets.map(t => t.priority).filter(Boolean) as string[]);
 return [
 { value: '', label: 'All Priorities' },
 ...PRIORITY_ORDER.filter(p => presentPriorities.has(p)).map(p => ({ value: p, label: p })),
 ];
 }, [allTickets]);

 const assigneeFilterOptions = useMemo(() => {
 const assignees = [...new Set(allTickets.map(t => t.assignee ?? 'Unassigned'))].sort();
 return [
 { value: '', label: 'All Assignees' },
 ...assignees.map(a => ({ value: a, label: a })),
 ];
 }, [allTickets]);

 const boardOptions = useMemo(() => [
 { value: 'all', label: 'All Boards' },
 ...(snapshot?.boards ?? []).map(b => ({ value: String(b.configId), label: b.boardName })),
 ], [snapshot]);

 const visibleBoards = useMemo(() => {
 const boards = snapshot?.boards ?? [];
 return boardFilter === 'all' ? boards : boards.filter(b => String(b.configId) === boardFilter);
 }, [snapshot, boardFilter]);

 // ── Empty state ────────────────────────────────────────────────────────────

 if (!isLoading && snapshot?.boards.length === 0) {
 return (
 <Stack gap="lg">
 <Title order={2} style={{ fontFamily: FONT_FAMILY }}>Support Queue</Title>
 <EmptyState
 icon={<IconTicket size={40} />}
 title="No support boards configured"
 description="Add your first Jira support queue board to start tracking tickets, SLAs, and throughput."
 actionLabel="Configure Support Boards"
 onAction={() => navigate('/settings/support-boards')}
 />
 </Stack>
 );
 }

 const multiBoard = (snapshot?.boards ?? []).length > 1;

 // ── Render ─────────────────────────────────────────────────────────────────

 return (
 <>
 <TicketDetailDrawer ticket={detailTicket} jiraBaseUrl={jiraBaseUrl} onClose={() => setDetailTicket(null)} />
 <TicketListModal
 opened={!!kpiModal}
 title={kpiModal?.title ?? ''}
 tickets={kpiModal?.tickets ?? []}
 jiraBaseUrl={jiraBaseUrl}
 onClose={() => setKpiModal(null)}
 onOpen={t => { setKpiModal(null); setDetailTicket(t); }}
 />

 <PPPageLayout title="Jira Support" subtitle="Support board health, SLA tracking and ticket analytics" animate dataUpdatedAt={dataUpdatedAt}>
 <Stack gap="lg" className="page-enter stagger-children">
 {/* ── Toolbar ── */}
 <Group justify="flex-end" wrap="nowrap" className="slide-in-left">
 <Group gap="xs" align="center">
 <CsvToolbar
 data={allTickets as unknown as Record<string, unknown>[]}
 columns={SUPPORT_CSV_COLUMNS as unknown as CsvColumnDef<Record<string, unknown>>[]}
 filename={`support-queue-${new Date().toISOString().slice(0, 10)}`}
 exportOnly
 />
 <Select
 data={[
 { value: 'off', label: 'Auto-refresh: Off' },
 { value: '2', label: 'Every 2 min' },
 { value: '5', label: 'Every 5 min' },
 { value: '10', label: 'Every 10 min' },
 ]}
 value={autoRefresh}
 onChange={v => setAutoRefresh(v ?? 'off')}
 size="xs"
 style={{ width: 150 }}
 />
 <Tooltip label="Refresh now">
 <ActionIcon variant="light" onClick={handleRefresh} loading={isLoading}>
 <IconRefresh size={16} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Configure support boards">
 <ActionIcon variant="light" onClick={() => navigate('/settings/support-boards')}>
 <IconSettings size={16} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Group>

 {error && (
 <Alert color="red" icon={<IconAlertTriangle size={16} />}>
 Failed to load support snapshot. {(error as Error).message}
 </Alert>
 )}

 {isLoading && <PageSkeleton variant="dashboard" />}

 {!isLoading && snapshot && (
 <WidgetGrid pageKey="support">

 {/* ── KPI Cards ── */}
 <Widget id="kpi-cards" title="KPI Summary">
 <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
 <StatCard label="Total Open" value={openTotal} color="blue" icon={<IconTicket size={20} />}
 onClick={() => setKpiModal({ title: 'All Open Tickets', tickets: allTickets })} />
 <StatCard label="Stale" value={staleTotal}
 sub={openTotal > 0 ? `${Math.round(staleTotal / openTotal * 100)}% of open` : undefined}
 color={staleTotal > 0 ? 'orange' : 'gray'} icon={<IconAlertTriangle size={20} />}
 onClick={() => setKpiModal({ title: 'Stale Tickets', tickets: allTickets.filter(t => t.stale) })} />
 <StatCard label="SLA Breached" value={slaBreachedTotal}
 sub={slaAtRiskTotal > 0 ? `+${slaAtRiskTotal} at risk` : 'none at risk'}
 color={slaBreachedTotal > 0 ? 'red' : 'gray'} icon={<IconClock size={20} />}
 onClick={() => setKpiModal({ title: 'SLA Breached', tickets: allTickets.filter(t => getSlaStatus(t).status === 'breached') })} />
 <StatCard label="Unassigned" value={unassignedTotal}
 sub={openTotal > 0 ? `${Math.round(unassignedTotal / openTotal * 100)}% of open` : undefined}
 color={unassignedTotal > 0 ? 'red' : 'gray'} icon={<IconUser size={20} />}
 onClick={() => setKpiModal({ title: 'Unassigned Tickets', tickets: allTickets.filter(t => !t.assignee) })} />
 <StatCard label="Avg Age" value={`${avgAge}d`} sub="across open tickets"
 color="violet" icon={<IconClock size={20} />}
 onClick={() => setKpiModal({ title: 'All Open Tickets — By Age', tickets: [...allTickets].sort((a, b) => ageDays(b.created) - ageDays(a.created)) })} />
 <StatCard label="Created Today" value={todayTotal}
 color={todayTotal > 0 ? 'teal' : 'gray'} icon={<IconCircleCheck size={20} />}
 onClick={() => setKpiModal({ title: 'Created Today', tickets: allTickets.filter(t => t.timeWindow === 'today') })} />
 </SimpleGrid>
 </Widget>

 {/* ── Needs Attention ── */}
 <Widget id="needs-attention" title="Needs Attention">
 <NeedsAttentionPanel tickets={allTickets} jiraBaseUrl={jiraBaseUrl} />
 </Widget>

 {/* ── Charts Row 1: Priority · Status · SLA · Labels ── */}
 <Widget id="charts-breakdown" title="Breakdown Charts">
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
 <ChartPanel title="By Priority">
 <DonutChart data={priorityData} colorMap={PRIORITY_COLORS}
 onSliceClick={name => setKpiModal({ title: `Priority: ${name}`, tickets: allTickets.filter(t => t.priority === name) })} />
 </ChartPanel>
 <ChartPanel title="By Status">
 <DonutChart data={statusData} colorMap={STATUS_COLORS}
 onSliceClick={name => setKpiModal({ title: `Status: ${name}`, tickets: allTickets.filter(t => t.status === name) })} />
 </ChartPanel>
 <ChartPanel title="SLA Status">
 {(() => {
 const slaData = [
 { name: 'Breached', value: slaBreachedTotal },
 { name: 'At Risk', value: slaAtRiskTotal },
 { name: 'OK', value: allTickets.filter(t => getSlaStatus(t).status === 'ok').length },
 { name: 'No SLA', value: allTickets.filter(t => getSlaStatus(t).status === 'unknown').length },
 ].filter(d => d.value > 0);
 const slaColorMap: Record<string, string> = {
 Breached: COLOR_ERROR, 'At Risk': COLOR_ORANGE, OK: COLOR_GREEN_LIGHT, 'No SLA': GRAY_300,
 };
 const slaStatusMap: Record<string, string> = {
 Breached: 'breached', 'At Risk': 'at-risk', OK: 'ok', 'No SLA': 'unknown',
 };
 return <DonutChart data={slaData} colorMap={slaColorMap}
 onSliceClick={name => setKpiModal({ title: `SLA: ${name}`, tickets: allTickets.filter(t => getSlaStatus(t).status === slaStatusMap[name]) })} />;
 })()}
 </ChartPanel>
 <ChartPanel title="Top Labels">
 {labelsData.length === 0
 ? <Center h={180}><Text size="sm" c="dimmed">No labels on open tickets</Text></Center>
 : <HBar data={labelsData.slice(0, 8)} color={COLOR_VIOLET_LIGHT}
 height={Math.max(160, labelsData.slice(0, 8).length * 28)}
 onBarClick={name => setKpiModal({ title: `Label: ${name}`, tickets: allTickets.filter(t => t.labels?.includes(name)) })} />}
 </ChartPanel>
 </SimpleGrid>
 </Widget>

 {/* ── Charts Row 2: Assignee · Reporter · Age ── */}
 <Widget id="charts-workload" title="Workload Charts">
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
 <ChartPanel title="Assignee Workload">
 <HBar data={assigneeData} color="#20c997"
 height={Math.max(160, assigneeData.length * 32)}
 onBarClick={name => setKpiModal({ title: `Assignee: ${name}`, tickets: allTickets.filter(t => (t.assignee ?? 'Unassigned') === name) })} />
 </ChartPanel>
 <ChartPanel title="Top Reporters">
 <HBar data={reporterData} color="#f06595"
 height={Math.max(160, reporterData.length * 32)}
 onBarClick={name => setKpiModal({ title: `Reporter: ${name}`, tickets: allTickets.filter(t => t.reporter === name) })} />
 </ChartPanel>
 <ChartPanel title="Ticket Age Distribution">
 <AgeHistogram tickets={allTickets}
 onBarClick={label => setKpiModal({ title: `Age: ${label}`, tickets: allTickets.filter(AGE_BUCKET_FILTER[label] ?? (() => true)) })} />
 </ChartPanel>
 </SimpleGrid>
 </Widget>

 {/* ── Charts Row 3: Timeline · Board Health ── */}
 <Widget id="charts-timeline" title="Timeline & Board Health">
 <SimpleGrid cols={{ base: 1, md: multiBoard ? 2 : 1 }} spacing="sm">
 <ChartPanel title="Created — Last 14 Days">
 <VBar data={timelineData}
 onBarClick={isoDate => setKpiModal({ title: `Created on ${isoDate.slice(5).replace('-', '/')}`, tickets: allTickets.filter(t => t.created?.startsWith(isoDate)) })} />
 </ChartPanel>
 {multiBoard && (
 <ChartPanel title="Board Health Comparison">
 <BoardHealthTable boards={snapshot.boards} />
 </ChartPanel>
 )}
 </SimpleGrid>
 </Widget>

 {/* ── Trend History ── */}
 <Widget id="trend" title="30-Day Trend">
 <ChartPanel title="30-Day Trend">
 <Group gap="sm" mb="xs">
 <SegmentedControl
 size="xs"
 value={trendMetric}
 onChange={v => setTrendMetric(v as typeof trendMetric)}
 data={[
 { label: 'Open tickets', value: 'openCount' },
 { label: 'Stale tickets', value: 'staleCount' },
 { label: 'Avg age (days)', value: 'avgAgeDays' },
 ]}
 />
 </Group>
 <TrendChart metric={trendMetric} />
 </ChartPanel>
 </Widget>

 {/* ── Monthly Throughput ── */}
 <Widget id="throughput" title="Monthly Throughput">
 <ChartPanel title="Monthly Throughput — Tickets Created vs Closed">
 <Group gap="sm" mb="xs" align="center">
 <Text size="xs" c="dimmed">Show last</Text>
 <SegmentedControl
 size="xs"
 value={String(throughputMonths)}
 onChange={v => setThroughputMonths(Number(v))}
 data={[
 { label: '3 mo', value: '3' },
 { label: '6 mo', value: '6' },
 { label: '12 mo', value: '12' },
 ]}
 />
 </Group>
 <MonthlyThroughputChart months={throughputMonths} />
 </ChartPanel>
 </Widget>

 {/* ── Ticket List (Filters + Tabs) ── */}
 <Widget id="ticket-list" title="Ticket List">
 {/* ── Filters ── */}
 <Group gap="sm" wrap="wrap" mb="sm" align="flex-end">
 <TextInput
 placeholder="Search key or summary…"
 leftSection={<IconSearch size={14} />}
 value={ticketSearch}
 onChange={e => setTicketSearch(e.currentTarget.value)}
 style={{ width: 220 }}
 size="sm"
 />
 <Select data={boardOptions} value={boardFilter} onChange={v => setBoardFilter(v ?? 'all')}
 style={{ width: 180 }} size="sm" />
 <Select
 data={priorityFilterOptions}
 value={ticketPriority}
 onChange={v => setTicketPriority(v ?? '')}
 style={{ width: 160 }}
 size="sm"
 placeholder="All Priorities"
 />
 <Select
 data={assigneeFilterOptions}
 value={ticketAssignee}
 onChange={v => setTicketAssignee(v ?? '')}
 style={{ width: 180 }}
 size="sm"
 placeholder="All Assignees"
 searchable
 />
 <Select data={labelOptions} value={labelFilter} onChange={v => setLabelFilter(v ?? '')}
 style={{ width: 180 }} size="sm" leftSection={<IconTag size={14} />}
 clearable placeholder="Filter by label" />
 <Switch
 label="Stale only"
 size="sm"
 checked={ticketStaleOnly}
 onChange={e => setTicketStaleOnly(e.currentTarget.checked)}
 />
 {(ticketSearch || ticketPriority || ticketAssignee || labelFilter || ticketStaleOnly) && (
 <Button size="xs" variant="subtle" color="gray" onClick={() => {
 setTicketSearch(''); setTicketPriority(''); setTicketAssignee('');
 setLabelFilter(''); setTicketStaleOnly(false);
 }}>Clear filters</Button>
 )}
 </Group>

 {/* ── Tabs ── */}
 <Tabs value={timeWindow} onChange={v => setTimeWindow(v ?? 'all')}>
 <Tabs.List>
 {TIME_WINDOWS.map(tw => {
 const base = visibleBoards.flatMap(b => b.tickets);
 const filtered = labelFilter ? base.filter(t => (t.labels ?? []).includes(labelFilter)) : base;
 const count = tw.value === 'all' ? filtered.length : filtered.filter(t => t.timeWindow === tw.value).length;
 const hasStale = tw.value === 'all' ? filtered.some(t => t.stale) : filtered.filter(t => t.timeWindow === tw.value).some(t => t.stale);
 return (
 <Tabs.Tab key={tw.value} value={tw.value}
 rightSection={
 <Indicator color="orange" disabled={!hasStale} size={6} offset={-2}>
 <Badge size="xs" variant="light" color={hasStale ? 'orange' : 'gray'}>{count}</Badge>
 </Indicator>
 }>
 {tw.label}
 </Tabs.Tab>
 );
 })}
 </Tabs.List>
 <Tabs.Panel value={timeWindow} pt="md">
 <Stack gap="xl">
 {!visibleBoards.length
 ? <Text size="sm" c="dimmed" ta="center">No boards to display.</Text>
 : visibleBoards.map(board => (
 <BoardSection
 key={board.configId}
 board={board}
 timeWindow={timeWindow}
 labelFilter={labelFilter}
 searchText={ticketSearch}
 priorityFilter={ticketPriority}
 assigneeFilter={ticketAssignee}
 staleOnly={ticketStaleOnly}
 sortField={sortField}
 sortDir={sortDir}
 jiraBaseUrl={jiraBaseUrl}
 onLabelClick={l => setLabelFilter(l === labelFilter ? '' : l)}
 onOpen={setDetailTicket}
 onSortChange={f => {
 setSortField(prev => { if (prev === f) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; } setSortDir('asc'); return f; });
 }}
 />
 ))}
 </Stack>
 </Tabs.Panel>
 </Tabs>
 </Widget>

 {/* ── All Tickets (all statuses, historical) ── */}
 <Widget id="all-tickets" title="All Tickets (All Statuses)">
 {!showAllTickets ? (
 <Group justify="center" py="xl">
 <Stack align="center" gap="sm">
 <ThemeIcon size="xl" variant="light" color="blue">
 <IconDatabase size={24} />
 </ThemeIcon>
 <Text size="sm" c="dimmed" ta="center">
 Load all tickets including Resolved and Done, for full historical analysis.
 </Text>
 <Group gap="sm">
 <Select
 size="xs"
 style={{ width: 130 }}
 value={String(allDays)}
 onChange={v => setAllDays(Number(v ?? 90))}
 data={[
 { value: '30', label: 'Last 30 days' },
 { value: '60', label: 'Last 60 days' },
 { value: '90', label: 'Last 90 days' },
 { value: '180', label: 'Last 180 days' },
 { value: '365', label: 'Last 365 days' },
 ]}
 />
 <Button
 size="xs"
 leftSection={<IconDatabase size={14} />}
 onClick={() => setShowAllTickets(true)}
 >
 Load All Tickets
 </Button>
 </Group>
 </Stack>
 </Group>
 ) : allTicketsLoading ? (
 <PageSkeleton variant="table" />
 ) : (
 <AllTicketsPanel
 snapshot={allTicketsSnapshot}
 jiraBaseUrl={jiraBaseUrl}
 days={allDays}
 statusFilter={allStatusFilter}
 onStatusFilter={setAllStatusFilter}
 onChangeDays={d => { setAllDays(d); refetchAllTickets(); }}
 onClose={() => { setShowAllTickets(false); setAllStatusFilter(''); }}
 onOpen={setDetailTicket}
 />
 )}
 </Widget>

 </WidgetGrid>
 )}
 </Stack>
 </PPPageLayout>
 </>
 );
}
