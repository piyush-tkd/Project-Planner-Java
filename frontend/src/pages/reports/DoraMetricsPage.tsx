import { useState, useMemo, useCallback } from 'react';
import {
 Text, Badge, Group, SegmentedControl, Table, Paper, Tooltip,
 SimpleGrid, ThemeIcon, Drawer, ScrollArea, Stack,
 UnstyledButton, Button,
} from '@mantine/core';
import {
 IconRocket, IconClock, IconBug, IconHeartbeat,
 IconCalendarEvent, IconTrendingUp, IconDatabase, IconCloud,
 IconChevronRight, IconRefresh,
} from '@tabler/icons-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
 ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { useDoraMetrics, useDoraMonthly, DoraMetricValue, DoraMonthCard } from '../../api/reports';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import ReportPageShell, { SummaryCardItem } from '../../components/common/ReportPageShell';
import {
 DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, DEEP_BLUE_TINTS, AQUA_TINTS,
 BORDER_DEFAULT, TEXT_SECONDARY,
} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

/* ── Level → colour mapping ─────────────────────────────────────────────── */
const LEVEL_COLOR: Record<string, string> = {
 elite: '#40c057',
 high: '#339af0',
 medium: '#fab005',
 low: '#fa5252',
};
const LEVEL_BG: Record<string, string> = {
 elite: 'rgba(64, 192, 87, 0.10)',
 high: 'rgba(51, 154, 240, 0.10)',
 medium: 'rgba(250, 176, 5, 0.10)',
 low: 'rgba(250, 82, 82, 0.10)',
};
const LEVEL_LABEL: Record<string, string> = {
 elite: 'Elite',
 high: 'High',
 medium: 'Medium',
 low: 'Low',
};

/* ── Drill-down type ────────────────────────────────────────────────────── */
type DrillType = 'deploy' | 'leadTime' | 'cfr' | 'mttr' | 'trend' | 'monthDrill' | null;

interface TrendDrill { month: string; releases: number; failures: number }

/* ── Clickable Metric card ──────────────────────────────────────────────── */
function MetricCard({ title, icon, metric, subtitle, extra, onClick }: {
 title: string;
 icon: React.ReactNode;
 metric: DoraMetricValue;
 subtitle?: string;
 extra?: React.ReactNode;
 onClick?: () => void;
}) {
 const dark = useDarkMode();
 const color = LEVEL_COLOR[metric.level] ?? '#868e96';
 const bg = LEVEL_BG[metric.level] ?? 'transparent';
 return (
 <UnstyledButton onClick={onClick} style={{ textAlign: 'left', width: '100%' }}>
 <Paper
 withBorder
 radius="md"
 p="lg"
 style={{
 borderTop: `3px solid ${color}`,
 boxShadow: SHADOW.card,
 transition: 'box-shadow 0.2s ease, transform 0.2s ease',
 cursor: 'pointer',
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.boxShadow = SHADOW.cardHover;
 e.currentTarget.style.transform = 'translateY(-2px)';
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.boxShadow = SHADOW.card;
 e.currentTarget.style.transform = '';
 }}
 >
 <Group gap="sm" mb="md" wrap="nowrap" justify="space-between">
 <Group gap="sm" wrap="nowrap">
 <ThemeIcon size={40} radius="md" variant="light" color={color} style={{ backgroundColor: bg }}>
 {icon}
 </ThemeIcon>
 <div>
 <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ fontFamily: FONT_FAMILY, letterSpacing: '0.04em' }}>
 {title}
 </Text>
 {subtitle && <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{subtitle}</Text>}
 </div>
 </Group>
 <IconChevronRight size={16} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
 </Group>

 <Group align="baseline" gap={8}>
 <Text size="2rem" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE, lineHeight: 1.1 }}>
 {metric.label ?? metric.value}
 </Text>
 {!metric.label && (
 <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 {metric.unit}
 </Text>
 )}
 </Group>

 <Group mt="sm" gap={6}>
 <Badge
 size="md"
 variant="light"
 color={color === '#40c057' ? 'green' : color === '#339af0' ? 'blue' : color === '#fab005' ? 'yellow' : 'red'}
 radius="sm"
 styles={{ root: { textTransform: 'uppercase', fontFamily: FONT_FAMILY, fontWeight: 700 } }}
 >
 {LEVEL_LABEL[metric.level]}
 </Badge>
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 {metric.value} {metric.unit}
 </Text>
 </Group>

 {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
 </Paper>
 </UnstyledButton>
 );
}

/* ── DORA level explanation ──────────────────────────────────────────────── */
const LEVEL_BENCHMARKS: Record<string, Record<string, string>> = {
 deploy: { elite: 'On-demand (multiple deploys per day)', high: 'Between once per day and once per week', medium: 'Between once per week and once per month', low: 'Less than once per month' },
 leadTime: { elite: 'Less than one day', high: 'Between one day and one week', medium: 'Between one week and one month', low: 'More than one month' },
 cfr: { elite: '0–5%', high: '5–10%', medium: '10–15%', low: 'Greater than 15%' },
 mttr: { elite: 'Less than one hour', high: 'Less than one day', medium: 'Less than one week', low: 'More than one week' },
};

function BenchmarkTable({ metricKey, currentLevel }: { metricKey: string; currentLevel: string }) {
 const dark = useDarkMode();
 const benchmarks = LEVEL_BENCHMARKS[metricKey];
 if (!benchmarks) return null;
 return (
 <Paper withBorder radius="sm" p="sm" mt="md" style={{ backgroundColor: AQUA_TINTS[10] }}>
 <Text size="xs" fw={700} mb="xs" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 DORA Benchmark Thresholds
 </Text>
 <Table withRowBorders={false} styles={{
 td: { fontFamily: FONT_FAMILY, fontSize: 12, padding: '4px 8px' },
 }}>
 <Table.Tbody>
 {(['elite', 'high', 'medium', 'low'] as const).map(level => (
 <Table.Tr key={level} style={{
 backgroundColor: level === currentLevel ? LEVEL_BG[level] : 'transparent',
 fontWeight: level === currentLevel ? 700 : 400,
 borderRadius: 4,
 }}>
 <Table.Td w={80}>
 <Badge size="xs" variant="light" radius="sm"
 color={LEVEL_COLOR[level] === '#40c057' ? 'green' : LEVEL_COLOR[level] === '#339af0' ? 'blue' : LEVEL_COLOR[level] === '#fab005' ? 'yellow' : 'red'}
 >{LEVEL_LABEL[level]}</Badge>
 </Table.Td>
 <Table.Td>
 {benchmarks[level]}
 {level === currentLevel && (
 <Badge size="xs" ml={8} variant="outline" color="dark" radius="sm">You</Badge>
 )}
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </Paper>
 );
}

/* ── Detail table for drill-down drawer ─────────────────────────────────── */
function DetailTable({ details, columns, jiraBaseUrl }: {
 details: Record<string, unknown>[];
 columns: { key: string; label: string; render?: (val: unknown, row: Record<string, unknown>) => React.ReactNode }[];
 jiraBaseUrl?: string;
}) {
 const dark = useDarkMode();
 return (
 <Table fz="xs" highlightOnHover withTableBorder styles={{
 th: { fontFamily: FONT_FAMILY, fontSize: 11, color: dark ? '#fff' : DEEP_BLUE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '8px 10px' },
 td: { fontFamily: FONT_FAMILY, fontSize: 12, padding: '6px 10px' },
 }}>
 <Table.Thead>
 <Table.Tr>
 {columns.map(c => <Table.Th key={c.key}>{c.label}</Table.Th>)}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {details.map((row, i) => (
 <Table.Tr key={i}>
 {columns.map(c => (
 <Table.Td key={c.key}>
 {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '—')}
 </Table.Td>
 ))}
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 );
}

/* ── Score helper ───────────────────────────────────────────────────────── */
function levelScore(level: string) {
 if (level === 'elite') return 4;
 if (level === 'high') return 3;
 if (level === 'medium') return 2;
 return 1;
}

/* ── Monthly Breakdown View (MBR) ──────────────────────────────────────── */
const METRIC_KEYS = ['deploymentFrequency', 'leadTimeForChanges', 'changeFailureRate', 'meanTimeToRecovery'] as const;
const METRIC_LABELS: Record<string, string> = {
 deploymentFrequency: 'Deployment Frequency',
 leadTimeForChanges: 'Lead Time for Changes',
 changeFailureRate: 'Change Failure Rate',
 meanTimeToRecovery: 'Mean Time to Recovery',
};
const METRIC_ICONS: Record<string, React.ReactNode> = {
 deploymentFrequency: <IconRocket size={16} />,
 leadTimeForChanges: <IconClock size={16} />,
 changeFailureRate: <IconBug size={16} />,
 meanTimeToRecovery: <IconHeartbeat size={16} />,
};

function MonthlyBreakdownView({ months: lookback, onCellClick }: {
 months: number;
 onCellClick: (card: DoraMonthCard, metricKey: string) => void;
}) {
 const dark = useDarkMode();
 const { data, isLoading, error } = useDoraMonthly(lookback);

 if (isLoading) return <LoadingSpinner variant="chart" message="Loading monthly breakdown..." />;
 if (error) return <PageError context="loading monthly DORA data" error={error} />;
 if (!data || data.months.length === 0) {
 return (
 <Paper withBorder radius="md" p="xl" style={{ textAlign: 'center' }}>
 <Text c="dimmed">No monthly data available for the selected period.</Text>
 </Paper>
 );
 }

 const monthCards = data.months;

 return (
 <Stack gap="md">
 {/* ── Scorecard matrix: metrics × months ───────────────────── */}
 <ChartCard title="Month-by-Month DORA Scorecard" minHeight={200}>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders styles={{
 th: { fontFamily: FONT_FAMILY, fontSize: 11, color: dark ? '#fff' : DEEP_BLUE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '10px 12px', textAlign: 'center' },
 td: { fontFamily: FONT_FAMILY, fontSize: 12, padding: '0' },
 }}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ textAlign: 'left', minWidth: 180 }}>Metric</Table.Th>
 {monthCards.map(m => (
 <Table.Th key={m.month} style={{ minWidth: 120 }}>{m.month}</Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {METRIC_KEYS.map(mk => (
 <Table.Tr key={mk}>
 <Table.Td style={{ padding: '10px 12px' }}>
 <Group gap={6} wrap="nowrap">
 {METRIC_ICONS[mk]}
 <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{METRIC_LABELS[mk]}</Text>
 </Group>
 </Table.Td>
 {monthCards.map(card => {
 const metric = card[mk] as DoraMetricValue;
 const color = LEVEL_COLOR[metric.level] ?? '#868e96';
 const bg = LEVEL_BG[metric.level] ?? 'transparent';
 return (
 <Table.Td key={card.month} style={{ padding: 0 }}>
 <UnstyledButton
 onClick={() => onCellClick(card, mk)}
 style={{
 width: '100%',
 padding: '10px 12px',
 textAlign: 'center',
 background: bg,
 transition: 'all 0.15s ease',
 cursor: 'pointer',
 }}
 onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.95)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
 onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = ''; }}
 >
 <Text size="sm" fw={800} style={{ color, fontFamily: FONT_FAMILY }}>
 {metric.label ?? `${metric.value}${metric.unit}`}
 </Text>
 <Badge size="xs" variant="light" radius="sm" mt={2}
 color={color === '#40c057' ? 'green' : color === '#339af0' ? 'blue' : color === '#fab005' ? 'yellow' : 'red'}
 >
 {LEVEL_LABEL[metric.level]}
 </Badge>
 </UnstyledButton>
 </Table.Td>
 );
 })}
 </Table.Tr>
 ))}
 {/* ── Summary row: total releases + issues ───────────── */}
 <Table.Tr style={{ borderTop: `2px solid ${DEEP_BLUE_TINTS[20]}` }}>
 <Table.Td style={{ padding: '10px 12px' }}>
 <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>Releases / Issues</Text>
 </Table.Td>
 {monthCards.map(card => (
 <Table.Td key={card.month} style={{ padding: '10px 12px', textAlign: 'center' }}>
 <Group gap={4} justify="center" wrap="nowrap">
 <Text size="sm" fw={700} style={{ color: AQUA }}>{card.totalReleases}</Text>
 <Text size="xs" c="dimmed">/</Text>
 <Text size="sm" fw={700} c="dimmed">{card.totalIssues}</Text>
 </Group>
 </Table.Td>
 ))}
 </Table.Tr>
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </ChartCard>

 {/* ── Per-month mini cards for quick scan ───────────────────── */}
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
 {monthCards.map(card => {
 const avgScore = (
 levelScore(card.deploymentFrequency.level) +
 levelScore(card.leadTimeForChanges.level) +
 levelScore(card.changeFailureRate.level) +
 levelScore(card.meanTimeToRecovery.level)
 ) / 4;
 const overallColor = avgScore >= 3.5 ? '#40c057' : avgScore >= 2.5 ? '#339af0' : avgScore >= 1.5 ? '#fab005' : '#fa5252';
 return (
 <Paper key={card.month} withBorder radius="md" p="md" style={{ borderLeft: `4px solid ${overallColor}`, boxShadow: SHADOW.card }}>
 <Group justify="space-between" mb="sm">
 <Text size="sm" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>{card.month}</Text>
 <Group gap={4}>
 <Text size="xs" c="dimmed">{card.totalReleases} releases</Text>
 <Text size="xs" c="dimmed">·</Text>
 <Text size="xs" c="dimmed">{card.totalIssues} issues</Text>
 </Group>
 </Group>
 <SimpleGrid cols={2} spacing={8}>
 {METRIC_KEYS.map(mk => {
 const m = card[mk] as DoraMetricValue;
 return (
 <UnstyledButton key={mk} onClick={() => onCellClick(card, mk)} style={{ textAlign: 'left' }}>
 <Group gap={4} wrap="nowrap">
 <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: LEVEL_COLOR[m.level], flexShrink: 0 }} />
 <div style={{ overflow: 'hidden' }}>
 <Text size="xs" c="dimmed" truncate style={{ fontFamily: FONT_FAMILY }}>{METRIC_LABELS[mk]}</Text>
 <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY }}>
 {m.label ?? `${m.value} ${m.unit}`}
 </Text>
 </div>
 </Group>
 </UnstyledButton>
 );
 })}
 </SimpleGrid>
 </Paper>
 );
 })}
 </SimpleGrid>
 </Stack>
 );
}

/* ════════════════════════════════════════════════════════════════════════════
 Main page
 ════════════════════════════════════════════════════════════════════════════ */
export default function DoraMetricsPage() {
 const dark = useDarkMode();
 const [months, setMonths] = useState(6);
 const [viewMode, setViewMode] = useState<'overview' | 'monthly'>('overview');
 const { data, isLoading, isFetching, error, refetch } = useDoraMetrics(months);

 const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

 // Drill-down state
 const [drill, setDrill] = useState<DrillType>(null);
 const [trendDrill, setTrendDrill] = useState<TrendDrill | null>(null);
 const [monthDrillCard, setMonthDrillCard] = useState<DoraMonthCard | null>(null);
 const [monthDrillMetric, setMonthDrillMetric] = useState<string>('');

 const closeDrill = useCallback(() => { setDrill(null); setTrendDrill(null); setMonthDrillCard(null); setMonthDrillMetric(''); }, []);

 const handleMonthCellClick = useCallback((card: DoraMonthCard, metricKey: string) => {
 setMonthDrillCard(card);
 setMonthDrillMetric(metricKey);
 setDrill('monthDrill');
 }, []);

 const summaryCards = useMemo<SummaryCardItem[]>(() => {
 if (!data) return [];
 const avgScore = (
 levelScore(data.deploymentFrequency.level) +
 levelScore(data.leadTimeForChanges.level) +
 levelScore(data.changeFailureRate.level) +
 levelScore(data.meanTimeToRecovery.level)
 ) / 4;
 const overallLabel = avgScore >= 3.5 ? 'Elite' : avgScore >= 2.5 ? 'High' : avgScore >= 1.5 ? 'Medium' : 'Low';
 const overallColor = avgScore >= 3.5 ? 'green' : avgScore >= 2.5 ? 'blue' : avgScore >= 1.5 ? 'yellow' : 'red';
 return [
 { label: 'Overall DORA', value: overallLabel, icon: <IconTrendingUp size={18} />, color: overallColor },
 { label: 'Releases', value: data.totalReleases, icon: <IconRocket size={18} />, color: 'blue' },
 { label: 'Sprints', value: data.totalSprints, icon: <IconCalendarEvent size={18} />, color: 'teal' },
 { label: 'Lookback', value: `${data.lookbackMonths} months`, icon: <IconClock size={18} />, color: 'gray' },
 ];
 }, [data]);

 if (isLoading) return <LoadingSpinner variant="chart" message="Fetching DORA metrics from Jira..." />;
 if (error) return <PageError context="loading DORA metrics" error={error} onRetry={() => refetch()} />;
 if (!data) return null;

 const isJira = data.source === 'jira';

 /* ── Drawer content based on drill type ──────────────────────────── */
 const renderDrawerContent = () => {
 if (!data) return null;

 switch (drill) {
 case 'deploy': {
 const details = (data.deploymentFrequency.details ?? []) as Record<string, unknown>[];
 return (
 <Stack gap="md">
 <Group gap="xs">
 <ThemeIcon size={32} radius="md" variant="light" color={LEVEL_COLOR[data.deploymentFrequency.level]}
 style={{ backgroundColor: LEVEL_BG[data.deploymentFrequency.level] }}>
 <IconRocket size={18} />
 </ThemeIcon>
 <div>
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {data.deploymentFrequency.label ?? data.deploymentFrequency.value} {data.deploymentFrequency.unit}
 </Text>
 <Text size="xs" c="dimmed">Deployment Frequency</Text>
 </div>
 </Group>

 <BenchmarkTable metricKey="deploy" currentLevel={data.deploymentFrequency.level} />

 {details.length > 0 && (
 <>
 <Text size="sm" fw={600} mt="sm" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 Released Versions ({details.length})
 </Text>
 <DetailTable
 details={details}
 columns={[
 { key: 'release', label: 'Version', render: (v) => <Text fw={600} size="sm">{String(v)}</Text> },
 { key: 'releaseDate', label: 'Release Date' },
 ]}
 />
 </>
 )}
 </Stack>
 );
 }

 case 'leadTime': {
 const details = (data.leadTimeForChanges.details ?? []) as Record<string, unknown>[];
 return (
 <Stack gap="md">
 <Group gap="xs">
 <ThemeIcon size={32} radius="md" variant="light" color={LEVEL_COLOR[data.leadTimeForChanges.level]}
 style={{ backgroundColor: LEVEL_BG[data.leadTimeForChanges.level] }}>
 <IconClock size={18} />
 </ThemeIcon>
 <div>
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {data.leadTimeForChanges.value} {data.leadTimeForChanges.unit}
 </Text>
 <Text size="xs" c="dimmed">Lead Time for Changes (avg)</Text>
 </div>
 </Group>

 {data.leadTimeForChanges.median != null && (
 <Group gap="lg">
 <div>
 <Text size="xs" c="dimmed">Median</Text>
 <Text fw={700}>{data.leadTimeForChanges.median} days</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">Sample Size</Text>
 <Text fw={700}>{data.leadTimeForChanges.sampleSize} issues</Text>
 </div>
 </Group>
 )}

 <BenchmarkTable metricKey="leadTime" currentLevel={data.leadTimeForChanges.level} />

 {details.length > 0 && (
 <>
 <Text size="sm" fw={600} mt="sm" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {isJira ? 'Issue Cycle Times' : 'Release Lead Times'} ({details.length})
 </Text>
 <DetailTable
 details={details}
 columns={isJira ? [
 { key: 'key', label: 'Issue', render: (v) => <Text fw={600} size="sm" c="blue">{String(v)}</Text> },
 { key: 'summary', label: 'Summary' },
 { key: 'leadTimeDays', label: 'Cycle (days)', render: (v) => (
 <Badge size="sm" variant="light"
 color={Number(v) <= 7 ? 'green' : Number(v) <= 30 ? 'yellow' : 'red'}
 radius="sm">{String(v)}d</Badge>
 )},
 { key: 'created', label: 'Created' },
 { key: 'resolved', label: 'Resolved' },
 ] : [
 { key: 'release', label: 'Release', render: (v) => <Text fw={600} size="sm">{String(v)}</Text> },
 { key: 'leadTimeDays', label: 'Lead Time (days)', render: (v) => (
 <Badge size="sm" variant="light"
 color={Number(v) <= 7 ? 'green' : Number(v) <= 30 ? 'yellow' : 'red'}
 radius="sm">{String(v)}d</Badge>
 )},
 { key: 'codeFreezeDate', label: 'Code Freeze' },
 { key: 'releaseDate', label: 'Release Date' },
 ]}
 />
 </>
 )}
 </Stack>
 );
 }

 case 'cfr': {
 return (
 <Stack gap="md">
 <Group gap="xs">
 <ThemeIcon size={32} radius="md" variant="light" color={LEVEL_COLOR[data.changeFailureRate.level]}
 style={{ backgroundColor: LEVEL_BG[data.changeFailureRate.level] }}>
 <IconBug size={18} />
 </ThemeIcon>
 <div>
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {data.changeFailureRate.value}{data.changeFailureRate.unit}
 </Text>
 <Text size="xs" c="dimmed">Change Failure Rate</Text>
 </div>
 </Group>

 <Group gap="lg">
 {isJira ? (
 <>
 <div>
 <Text size="xs" c="dimmed">Bugs / Incidents</Text>
 <Text fw={700} c="red">{data.changeFailureRate.bugCount ?? 0}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">Total Resolved Issues</Text>
 <Text fw={700}>{data.changeFailureRate.totalIssues ?? 0}</Text>
 </div>
 </>
 ) : (
 <>
 <div>
 <Text size="xs" c="dimmed">SPECIAL Releases</Text>
 <Text fw={700} c="red">{data.changeFailureRate.specialReleases ?? 0}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">Total Releases</Text>
 <Text fw={700}>{data.changeFailureRate.totalReleases ?? 0}</Text>
 </div>
 </>
 )}
 </Group>

 <BenchmarkTable metricKey="cfr" currentLevel={data.changeFailureRate.level} />

 {/* Visual ratio bar */}
 <Paper withBorder radius="sm" p="sm">
 <Text size="xs" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY }}>Failure Ratio</Text>
 <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', background: DEEP_BLUE_TINTS[10] }}>
 <div style={{
 width: `${Math.max(data.changeFailureRate.value, 2)}%`,
 background: 'linear-gradient(90deg, #fa5252, #ff6b6b)',
 borderRadius: '6px 0 0 6px',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 }}>
 {data.changeFailureRate.value >= 8 && (
 <Text size="xs" c="white" fw={700}>{data.changeFailureRate.value}%</Text>
 )}
 </div>
 <div style={{
 flex: 1,
 background: `linear-gradient(90deg, ${AQUA}, ${AQUA_TINTS[70]})`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 }}>
 <Text size="xs" c="white" fw={700}>{Math.round(100 - data.changeFailureRate.value)}% Success</Text>
 </div>
 </div>
 </Paper>
 </Stack>
 );
 }

 case 'mttr': {
 const details = (data.meanTimeToRecovery.details ?? []) as Record<string, unknown>[];
 return (
 <Stack gap="md">
 <Group gap="xs">
 <ThemeIcon size={32} radius="md" variant="light" color={LEVEL_COLOR[data.meanTimeToRecovery.level]}
 style={{ backgroundColor: LEVEL_BG[data.meanTimeToRecovery.level] }}>
 <IconHeartbeat size={18} />
 </ThemeIcon>
 <div>
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {data.meanTimeToRecovery.value} {data.meanTimeToRecovery.unit}
 </Text>
 <Text size="xs" c="dimmed">Mean Time to Recovery</Text>
 </div>
 </Group>

 <div>
 <Text size="xs" c="dimmed">Recovery Events</Text>
 <Text fw={700}>{data.meanTimeToRecovery.recoveryEvents ?? 0}</Text>
 </div>

 <BenchmarkTable metricKey="mttr" currentLevel={data.meanTimeToRecovery.level} />

 {details.length > 0 && (
 <>
 <Text size="sm" fw={600} mt="sm" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 Recovery Details ({details.length})
 </Text>
 <DetailTable
 details={details}
 columns={[
 { key: 'key', label: 'Issue', render: (v) => <Text fw={600} size="sm" c="blue">{String(v)}</Text> },
 { key: 'summary', label: 'Summary' },
 { key: 'priority', label: 'Priority', render: (v) => (
 <Badge size="xs" variant="light" color={
 String(v) === 'Highest' || String(v) === 'Critical' || String(v) === 'Blocker' ? 'red' : 'orange'
 } radius="sm">{String(v ?? '—')}</Badge>
 )},
 { key: 'recoveryDays', label: 'Recovery (days)', render: (v) => (
 <Badge size="sm" variant="light"
 color={Number(v) <= 1 ? 'green' : Number(v) <= 7 ? 'yellow' : 'red'}
 radius="sm">{String(v)}d</Badge>
 )},
 { key: 'created', label: 'Created' },
 { key: 'resolved', label: 'Resolved' },
 ]}
 />
 </>
 )}
 </Stack>
 );
 }

 case 'trend': {
 if (!trendDrill) return null;
 // Show all items for the clicked month (from lead time details as a proxy for available data)
 return (
 <Stack gap="md">
 <Group gap="xs">
 <ThemeIcon size={32} radius="md" variant="light" color="blue">
 <IconCalendarEvent size={18} />
 </ThemeIcon>
 <div>
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {trendDrill.month}
 </Text>
 <Text size="xs" c="dimmed">Monthly Breakdown</Text>
 </div>
 </Group>

 <SimpleGrid cols={2} spacing="sm">
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center' }}>
 <Text size="xl" fw={800} style={{ color: AQUA }}>{trendDrill.releases}</Text>
 <Text size="xs" c="dimmed">{isJira ? 'Resolved Issues' : 'Total Releases'}</Text>
 </Paper>
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center' }}>
 <Text size="xl" fw={800} c="red">{trendDrill.failures}</Text>
 <Text size="xs" c="dimmed">{isJira ? 'Bugs / Incidents' : 'Failures (SPECIAL)'}</Text>
 </Paper>
 </SimpleGrid>

 <Paper withBorder radius="sm" p="sm">
 <Text size="xs" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY }}>Success Rate</Text>
 <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', background: DEEP_BLUE_TINTS[10] }}>
 {trendDrill.releases > 0 && (
 <>
 <div style={{
 width: `${Math.max(((trendDrill.releases - trendDrill.failures) / trendDrill.releases) * 100, 2)}%`,
 background: `linear-gradient(90deg, ${AQUA}, ${AQUA_TINTS[70]})`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 }}>
 <Text size="xs" c="white" fw={700}>
 {Math.round(((trendDrill.releases - trendDrill.failures) / trendDrill.releases) * 100)}%
 </Text>
 </div>
 {trendDrill.failures > 0 && (
 <div style={{
 width: `${(trendDrill.failures / trendDrill.releases) * 100}%`,
 background: 'linear-gradient(90deg, #fa5252, #ff6b6b)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 }}>
 {(trendDrill.failures / trendDrill.releases) * 100 >= 15 && (
 <Text size="xs" c="white" fw={700}>{Math.round((trendDrill.failures / trendDrill.releases) * 100)}%</Text>
 )}
 </div>
 )}
 </>
 )}
 </div>
 </Paper>
 </Stack>
 );
 }

 case 'monthDrill': {
 if (!monthDrillCard) return null;
 const metric = monthDrillCard[monthDrillMetric as keyof DoraMonthCard] as DoraMetricValue & {
 releases?: string[]; sampleSize?: number; bugCount?: number; totalIssues?: number; recoveryEvents?: number;
 };
 const mLabel = METRIC_LABELS[monthDrillMetric] ?? monthDrillMetric;
 const mIcon = METRIC_ICONS[monthDrillMetric];
 const color = LEVEL_COLOR[metric.level] ?? '#868e96';
 const bg = LEVEL_BG[metric.level] ?? 'transparent';
 const benchKey = monthDrillMetric === 'deploymentFrequency' ? 'deploy'
 : monthDrillMetric === 'leadTimeForChanges' ? 'leadTime'
 : monthDrillMetric === 'changeFailureRate' ? 'cfr'
 : 'mttr';

 return (
 <Stack gap="md">
 <Group gap="xs">
 <ThemeIcon size={32} radius="md" variant="light" color={color} style={{ backgroundColor: bg }}>
 {mIcon}
 </ThemeIcon>
 <div>
 <Text size="lg" fw={800} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {monthDrillCard.month} — {mLabel}
 </Text>
 <Text size="xs" c="dimmed">
 {metric.label ?? `${metric.value} ${metric.unit}`}
 </Text>
 </div>
 </Group>

 <SimpleGrid cols={2} spacing="sm">
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center' }}>
 <Text size="xl" fw={800} style={{ color }}>{metric.label ?? `${metric.value}`}</Text>
 <Text size="xs" c="dimmed">{metric.unit}</Text>
 </Paper>
 <Paper withBorder radius="sm" p="sm" style={{ textAlign: 'center' }}>
 <Badge size="lg" variant="light" radius="sm"
 color={color === '#40c057' ? 'green' : color === '#339af0' ? 'blue' : color === '#fab005' ? 'yellow' : 'red'}
 >{LEVEL_LABEL[metric.level]}</Badge>
 <Text size="xs" c="dimmed" mt={4}>Performance Level</Text>
 </Paper>
 </SimpleGrid>

 {/* Extra context per metric type */}
 {monthDrillMetric === 'deploymentFrequency' && metric.releases && metric.releases.length > 0 && (
 <Paper withBorder radius="sm" p="sm">
 <Text size="xs" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>Releases this month ({metric.releases.length})</Text>
 {metric.releases.map((r: string, i: number) => (
 <Badge key={i} size="sm" variant="light" color="blue" radius="sm" mr={4} mb={4}>{r}</Badge>
 ))}
 </Paper>
 )}

 {monthDrillMetric === 'leadTimeForChanges' && metric.sampleSize != null && (
 <Paper withBorder radius="sm" p="sm">
 <Group gap="lg">
 <div><Text size="xs" c="dimmed">Sample Size</Text><Text fw={700}>{metric.sampleSize} issues</Text></div>
 </Group>
 </Paper>
 )}

 {monthDrillMetric === 'changeFailureRate' && (
 <Paper withBorder radius="sm" p="sm">
 <Text size="xs" fw={600} mb={4} style={{ fontFamily: FONT_FAMILY }}>Failure Ratio</Text>
 <Group gap="lg" mb={8}>
 <div><Text size="xs" c="dimmed">Bugs/Incidents</Text><Text fw={700} c="red">{metric.bugCount ?? 0}</Text></div>
 <div><Text size="xs" c="dimmed">Total Issues</Text><Text fw={700}>{metric.totalIssues ?? 0}</Text></div>
 </Group>
 <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', background: DEEP_BLUE_TINTS[10] }}>
 <div style={{ width: `${Math.max(metric.value, 2)}%`, background: 'linear-gradient(90deg, #fa5252, #ff6b6b)', borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 {metric.value >= 8 && <Text size="xs" c="white" fw={700}>{metric.value}%</Text>}
 </div>
 <div style={{ flex: 1, background: `linear-gradient(90deg, ${AQUA}, ${AQUA_TINTS[70]})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <Text size="xs" c="white" fw={700}>{Math.round(100 - metric.value)}% Success</Text>
 </div>
 </div>
 </Paper>
 )}

 {monthDrillMetric === 'meanTimeToRecovery' && metric.recoveryEvents != null && (
 <Paper withBorder radius="sm" p="sm">
 <div><Text size="xs" c="dimmed">Recovery Events</Text><Text fw={700}>{metric.recoveryEvents}</Text></div>
 </Paper>
 )}

 {/* Month summary */}
 <Paper withBorder radius="sm" p="sm" style={{ backgroundColor: AQUA_TINTS[10] }}>
 <Text size="xs" fw={700} mb={4} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>Month Summary</Text>
 <Group gap="lg">
 <div><Text size="xs" c="dimmed">Total Releases</Text><Text fw={700}>{monthDrillCard.totalReleases}</Text></div>
 <div><Text size="xs" c="dimmed">Total Issues</Text><Text fw={700}>{monthDrillCard.totalIssues}</Text></div>
 </Group>
 </Paper>

 <BenchmarkTable metricKey={benchKey} currentLevel={metric.level} />
 </Stack>
 );
 }

 default:
 return null;
 }
 };

 const drawerTitle = drill === 'deploy' ? 'Deployment Frequency'
 : drill === 'leadTime' ? 'Lead Time for Changes'
 : drill === 'cfr' ? 'Change Failure Rate'
 : drill === 'mttr' ? 'Mean Time to Recovery'
 : drill === 'trend' ? `Month: ${trendDrill?.month ?? ''}`
 : drill === 'monthDrill' ? `${monthDrillCard?.month ?? ''} — ${METRIC_LABELS[monthDrillMetric] ?? ''}`
 : '';

 return (
 <ReportPageShell
 title="DORA Metrics"
 subtitle="Deployment Frequency · Lead Time · Change Failure Rate · Mean Time to Recovery"
 summaryCards={summaryCards}
 filters={
 <Group gap="md" align="flex-end">
 <div>
 <Text size="xs" c="dimmed" mb={4}>View</Text>
 <SegmentedControl
 value={viewMode}
 onChange={v => setViewMode(v as 'overview' | 'monthly')}
 data={[
 { value: 'overview', label: 'Overview' },
 { value: 'monthly', label: 'Monthly (MBR)' },
 ]}
 size="sm"
 />
 </div>
 <div>
 <Text size="xs" c="dimmed" mb={4}>Lookback period</Text>
 <SegmentedControl
 value={String(months)}
 onChange={v => setMonths(Number(v))}
 data={[
 { value: '3', label: '3 months' },
 { value: '6', label: '6 months' },
 { value: '12', label: '12 months' },
 ]}
 size="sm"
 />
 </div>
 <Tooltip label={isJira
 ? `Real-time data from Jira (${(data.projectKeys ?? []).join(', ')})`
 : 'Computed from internal release calendar'
 }>
 <Badge
 size="lg"
 variant="light"
 color={isJira ? 'blue' : 'gray'}
 radius="sm"
 leftSection={isJira ? <IconCloud size={14} /> : <IconDatabase size={14} />}
 styles={{ root: { fontFamily: FONT_FAMILY, cursor: 'help' } }}
 >
 {isJira ? 'Jira Live' : 'Release Calendar'}
 </Badge>
 </Tooltip>
 <Button
 variant="light"
 size="sm"
 leftSection={<IconRefresh size={15} />}
 loading={isFetching}
 onClick={handleRefresh}
 >
 Refresh
 </Button>
 </Group>
 }
 >
 {viewMode === 'overview' ? (<>
 {/* ── 4 Metric Cards (clickable) ───────────────────────────────── */}
 <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
 <MetricCard
 title="Deployment Frequency"
 subtitle="How often code reaches production"
 icon={<IconRocket size={20} />}
 metric={data.deploymentFrequency}
 onClick={() => setDrill('deploy')}
 />
 <MetricCard
 title="Lead Time for Changes"
 subtitle={isJira ? 'Avg issue cycle time (created → done)' : 'Code freeze → release'}
 icon={<IconClock size={20} />}
 metric={data.leadTimeForChanges}
 onClick={() => setDrill('leadTime')}
 extra={data.leadTimeForChanges.median != null ? (
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 Median: {data.leadTimeForChanges.median}d · {data.leadTimeForChanges.sampleSize} issues
 </Text>
 ) : undefined}
 />
 <MetricCard
 title="Change Failure Rate"
 subtitle={isJira ? 'Bug/Incident ratio in resolved work' : '% of releases that are hotfixes'}
 icon={<IconBug size={20} />}
 metric={data.changeFailureRate}
 onClick={() => setDrill('cfr')}
 extra={data.changeFailureRate.bugCount != null ? (
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 {data.changeFailureRate.bugCount} bugs / {data.changeFailureRate.totalIssues} total
 </Text>
 ) : undefined}
 />
 <MetricCard
 title="Mean Time to Recovery"
 subtitle={isJira ? 'High-priority bug resolution time' : 'Avg recovery after a failure'}
 icon={<IconHeartbeat size={20} />}
 metric={data.meanTimeToRecovery}
 onClick={() => setDrill('mttr')}
 extra={data.meanTimeToRecovery.recoveryEvents != null ? (
 <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
 {data.meanTimeToRecovery.recoveryEvents} recovery events
 </Text>
 ) : undefined}
 />
 </SimpleGrid>

 {/* ── Monthly Trend Chart (clickable bars) ─────────────────────── */}
 <ChartCard title={isJira ? 'Monthly Resolved Issues vs Bugs — click a bar to drill in' : 'Monthly Release Trend — click a bar to drill in'} minHeight={300}>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart
 data={data.trend}
 margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
 onClick={(e) => {
 if (e?.activePayload?.[0]?.payload) {
 const payload = e.activePayload[0].payload as TrendDrill;
 setTrendDrill(payload);
 setDrill('trend');
 }
 }}
 style={{ cursor: 'pointer' }}
 >
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis
 dataKey="month"
 tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false}
 />
 <YAxis
 tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false}
 allowDecimals={false}
 />
 <RechartsTooltip
 contentStyle={{
 fontFamily: FONT_FAMILY,
 fontSize: 12,
 borderRadius: 8,
 border: `1px solid ${DEEP_BLUE_TINTS[10]}`,
 boxShadow: SHADOW.md,
 }}
 cursor={{ fill: AQUA_TINTS[10] }}
 />
 <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
 <Bar
 dataKey="releases"
 name={isJira ? 'Resolved Issues' : 'Total Releases'}
 fill={AQUA}
 radius={[4, 4, 0, 0]}
 />
 <Bar
 dataKey="failures"
 name={isJira ? 'Bugs / Incidents' : 'Failures (SPECIAL)'}
 fill="#fa5252"
 radius={[4, 4, 0, 0]}
 />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>

 {/* ── Lead Time Details (clickable dots) ───────────────────────── */}
 {data.leadTimeForChanges.details && data.leadTimeForChanges.details.length > 0 && (
 <ChartCard title={isJira ? 'Issue Cycle Time — click for details' : 'Lead Time per Release — click for details'} minHeight={250}>
 <ResponsiveContainer width="100%" height={250}>
 <AreaChart
 data={data.leadTimeForChanges.details as Record<string, unknown>[]}
 margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
 onClick={() => setDrill('leadTime')}
 style={{ cursor: 'pointer' }}
 >
 <defs>
 <linearGradient id="leadTimeGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={AQUA} stopOpacity={0.3} />
 <stop offset="95%" stopColor={AQUA} stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke={DEEP_BLUE_TINTS[10]} />
 <XAxis
 dataKey={isJira ? 'key' : 'release'}
 tick={{ fontSize: 10, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false}
 angle={-30}
 textAnchor="end"
 height={60}
 />
 <YAxis
 tick={{ fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY }}
 tickLine={false}
 label={{
 value: 'Days',
 angle: -90,
 position: 'insideLeft',
 style: { fontSize: 11, fill: DEEP_BLUE_TINTS[60], fontFamily: FONT_FAMILY },
 }}
 />
 <RechartsTooltip
 contentStyle={{
 fontFamily: FONT_FAMILY,
 fontSize: 12,
 borderRadius: 8,
 border: `1px solid ${DEEP_BLUE_TINTS[10]}`,
 boxShadow: SHADOW.md,
 }}
 formatter={(value: number) => [`${value} days`, 'Cycle Time']}
 />
 <Area
 type="monotone"
 dataKey="leadTimeDays"
 name="Lead Time (days)"
 stroke={AQUA}
 strokeWidth={2}
 fill="url(#leadTimeGrad)"
 dot={{ r: 4, fill: AQUA, stroke: '#fff', strokeWidth: 2 }}
 activeDot={{ r: 6, style: { cursor: 'pointer' } }}
 />
 </AreaChart>
 </ResponsiveContainer>
 </ChartCard>
 )}

 {/* ── Upcoming Releases Table (clickable rows) ─────────────────── */}
 {data.upcoming.length > 0 && (
 <ChartCard title="Upcoming Releases" minHeight={100}>
 <Table fz="xs" highlightOnHover withTableBorder withColumnBorders styles={{
 th: { fontFamily: FONT_FAMILY, fontSize: 12, color: dark ? '#fff' : DEEP_BLUE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' },
 td: { fontFamily: FONT_FAMILY, fontSize: 13 },
 tr: { cursor: 'pointer' },
 }}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Release</Table.Th>
 <Table.Th>Type</Table.Th>
 <Table.Th>{isJira ? 'Start Date' : 'Code Freeze'}</Table.Th>
 <Table.Th>Release Date</Table.Th>
 <Table.Th>Days Until</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {data.upcoming.map((r) => (
 <Table.Tr key={r.name} onClick={() => setDrill('deploy')}>
 <Table.Td fw={600}>
 <Group gap={4} wrap="nowrap">
 {r.name}
 <IconChevronRight size={12} color={TEXT_SECONDARY} />
 </Group>
 </Table.Td>
 <Table.Td>
 <Badge
 size="sm"
 variant="light"
 color={r.type === 'SPECIAL' || r.type === 'OVERDUE' ? 'red' : 'blue'}
 radius="sm"
 >
 {r.type}
 </Badge>
 </Table.Td>
 <Table.Td>{r.codeFreezeDate}</Table.Td>
 <Table.Td>{r.releaseDate}</Table.Td>
 <Table.Td>
 <Badge
 size="sm"
 variant="light"
 color={r.daysUntilRelease <= 7 ? 'red' : r.daysUntilRelease <= 14 ? 'orange' : 'teal'}
 radius="sm"
 >
 {r.daysUntilRelease}d
 </Badge>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ChartCard>
 )}

 </>) : (
 <MonthlyBreakdownView months={months} onCellClick={handleMonthCellClick} />
 )}

 {/* ── Drill-down Drawer ────────────────────────────────────────── */}
 <Drawer
 opened={drill !== null}
 onClose={closeDrill}
 title={
 <Text fw={700} size="lg" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
 {drawerTitle}
 </Text>
 }
 position="right"
 size="lg"
 padding="lg"
 overlayProps={{ backgroundOpacity: 0.15 }}
 styles={{
 header: { borderBottom: `1px solid ${BORDER_DEFAULT}`, paddingBottom: 12 },
 body: { paddingTop: 16 },
 }}
 >
 <ScrollArea h="calc(100vh - 120px)" offsetScrollbars>
 {renderDrawerContent()}
 </ScrollArea>
 </Drawer>
 </ReportPageShell>
 );
}
