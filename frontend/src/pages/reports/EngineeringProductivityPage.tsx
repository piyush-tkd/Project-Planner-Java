import { useMemo, useState } from 'react';
import {
 Title, Stack, Text, Group, Card, SimpleGrid, Badge, Table, Select,
 Progress, ThemeIcon, SegmentedControl, ScrollArea, Button, Paper, UnstyledButton
} from '@mantine/core';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
 ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
 IconCurrencyDollar, IconRocket, IconTargetArrow,
 IconBug, IconClock, IconChecklist,
 IconFlame, IconExternalLink, IconChevronRight
} from '@tabler/icons-react';
import { useProductivityMetrics, useDoraMetrics, type DoraMetricValue } from '../../api/reports';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../hooks/useDarkMode';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import { AQUA_HEX, AQUA, COLOR_AMBER, COLOR_BLUE_LIGHT, COLOR_ERROR, COLOR_ERROR_LIGHT, COLOR_SUCCESS, GRAY_300, SURFACE_FAINT, TEXT_DIM } from '../../brandTokens';
import { DEEP_BLUE } from '../../brandTokens';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function fmtCurrency(n: number): string {
 if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
 if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
 return `$${Math.round(n).toLocaleString()}`;
}

function fmtCurrencyFull(n: number): string {
 return `$${Math.round(n).toLocaleString()}`;
}

function fmtHours(h: number): string {
 if (h >= 1000) return `${(h / 1000).toFixed(1)}K hrs`;
 return `${Math.round(h)} hrs`;
}

const LEVEL_COLORS: Record<string, string> = {
 elite: 'green', high: 'blue', medium: 'yellow', low: 'red'
};

const LEVEL_HEX: Record<string, string> = {
 elite: COLOR_SUCCESS, high: COLOR_BLUE_LIGHT, medium: COLOR_AMBER, low: COLOR_ERROR
};

const STATUS_COLORS: Record<string, string> = {
 COMPLETED: 'green', ACTIVE: 'blue', IN_DISCOVERY: 'violet',
 NOT_STARTED: 'gray', ON_HOLD: 'orange', CANCELLED: 'red'
};

const PRIORITY_COLORS: Record<string, string> = {
 P0: 'red', P1: 'orange', P2: 'blue', P3: 'gray',
 CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'blue', LOW: 'gray'
};

const PIE_COLORS = [AQUA, DEEP_BLUE, COLOR_BLUE_LIGHT, COLOR_AMBER, COLOR_ERROR_LIGHT, TEXT_DIM];

function DoraCard({ label, icon, metric, onClick }: { label: string; icon: React.ReactNode; metric?: DoraMetricValue; onClick?: () => void }) {
 if (!metric) return null;
 const borderColor = LEVEL_HEX[metric.level] ?? TEXT_DIM;
 return (
 <UnstyledButton onClick={onClick} style={{ textAlign: 'left', width: '100%' }}>
 <Paper
 withBorder
 radius="md"
 p="lg"
 style={{
 borderTop: `3px solid ${borderColor}`,
 transition: 'box-shadow 0.2s ease, transform 0.2s ease',
 cursor: 'pointer'}}
 onMouseEnter={e => {
 e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
 e.currentTarget.style.transform = 'translateY(-2px)';
 }}
 onMouseLeave={e => {
 e.currentTarget.style.boxShadow = '';
 e.currentTarget.style.transform = '';
 }}
 >
 <Group justify="space-between" mb="sm" wrap="nowrap">
 <Group gap="sm" wrap="nowrap">
 <ThemeIcon size={36} radius="md" variant="light" color={LEVEL_COLORS[metric.level] ?? 'gray'}>
 {icon}
 </ThemeIcon>
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>{label}</Text>
 </Group>
 <IconChevronRight size={14} style={{ color: GRAY_300, flexShrink: 0 }} />
 </Group>
 <Group align="baseline" gap={6} mb={6}>
 <Text size="2rem" fw={800} style={{ lineHeight: 1.1 }}>
 {metric.label ?? metric.value}
 </Text>
 {!metric.label && <Text size="sm" c="dimmed">{metric.unit}</Text>}
 </Group>
 <Badge size="sm" color={LEVEL_COLORS[metric.level] ?? 'gray'} variant="light">
 {metric.level}
 </Badge>
 </Paper>
 </UnstyledButton>
 );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function EngineeringProductivityPage() {
 const [lookback, setLookback] = useState('6');
 const navigate = useNavigate();
 const { data, isLoading, error, refetch } = useProductivityMetrics(Number(lookback));
 // Pull DORA from the same endpoint as the DORA Metrics page so numbers always match
 const { data: doraData } = useDoraMetrics(Number(lookback));
 const dark = useDarkMode();
 const [costView, setCostView] = useState<'delivered' | 'all'>('delivered');

 const gridStroke = dark ? 'rgba(255,255,255,0.1)' : SURFACE_FAINT;

 /* ── Derived data ──────────────────────────────────────────────────────── */

 const podBarData = useMemo(() => {
 if (!data?.investment?.spendByPod) return [];
 return data.investment.spendByPod.slice(0, 10).map(p => ({
 pod: p.pod.length > 14 ? p.pod.slice(0, 14) + '…' : p.pod,
 fullName: p.pod,
 spend: Math.round(p.annualSpend)
 }));
 }, [data]);

 const statusPieData = useMemo(() => {
 if (!data?.output?.statusBreakdown) return [];
 return Object.entries(data.output.statusBreakdown).map(([status, count]) => ({
 name: status.replace(/_/g, ' '),
 value: count
 }));
 }, [data]);

 const priorityPieData = useMemo(() => {
 if (!data?.output?.priorityBreakdown) return [];
 return Object.entries(data.output.priorityBreakdown).map(([priority, count]) => ({
 name: priority,
 value: count
 }));
 }, [data]);

 const costProjectList = useMemo(() => {
 if (!data?.efficiency) return [];
 if (costView === 'delivered') return data.efficiency.costPerProject ?? [];
 return data.efficiency.allProjectCosts ?? [];
 }, [data, costView]);

 const ownerBarData = useMemo(() => {
 if (!data?.impact?.effortByOwner) return [];
 return data.impact.effortByOwner.slice(0, 8).map(o => ({
 owner: o.owner.length > 14 ? o.owner.slice(0, 14) + '…' : o.owner,
 fullName: o.owner,
 hours: o.totalHours,
 pct: o.pct
 }));
 }, [data]);

 if (isLoading) return <LoadingSpinner variant="chart" message="Computing productivity metrics…" />;
 if (error || !data) return <PageError context="loading engineering productivity metrics" error={error} onRetry={() => refetch()} />;

 const investment = data.investment ?? { totalAnnualSpend: 0, avgMonthlySpend: 0, spendByPod: [], spendByProject: [] };
 const output = data.output ?? { totalProjects: 0, completedProjects: 0, activeProjects: 0, completionRate: 0, statusBreakdown: {}, priorityBreakdown: {}, criticalHighDelivered: 0, projectEffortSummary: [] };
 const efficiency = data.efficiency ?? { deliveredProjectCount: 0, totalDeliveredCost: 0, avgCostPerProjectDelivered: 0, costPerProject: [] };
 const impact = data.impact ?? { criticalHighPct: 0, criticalHighEffortPct: 0, totalPlannedEffortHours: 0, effortByOwner: [] };

 return (
 <Stack className="page-enter stagger-children">
 {/* ── Header ─────────────────────────────────────────────────────── */}
 <Group justify="space-between" align="flex-end" className="slide-in-left">
 <div>
 <Title order={2} style={{color: dark ? '#fff' : DEEP_BLUE }}>Engineering Productivity</Title>
 <Text size="sm" c="dimmed">Executive view — investment, output, efficiency, and impact</Text>
 </div>
 <Select
 label="Lookback"
 data={[
 { value: '3', label: '3 months' },
 { value: '6', label: '6 months' },
 { value: '12', label: '12 months' },
 ]}
 value={lookback}
 onChange={v => v && setLookback(v)}
 size="sm"
 style={{ width: 140 }}
 />
 </Group>

 {/* ═══════════════════════════════════════════════════════════════════
 Section 1 — INVESTMENT: "How much did we spend?"
 ═══════════════════════════════════════════════════════════════════ */}
 <Title order={3} mt="md">
 <Group gap="xs">
 <ThemeIcon variant="light" color="green" size="md"><IconCurrencyDollar size={16} /></ThemeIcon>
 Investment — How much did we spend?
 </Group>
 </Title>

 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Annual Spend</Text>
 <Text size="xl" fw={700}>{fmtCurrency(investment.totalAnnualSpend)}</Text>
 <Text size="xs" c="dimmed">full year projection</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Avg Monthly Spend</Text>
 <Text size="xl" fw={700}>{fmtCurrency(investment.avgMonthlySpend)}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Teams (PODs)</Text>
 <Text size="xl" fw={700}>{investment.spendByPod.length}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Costliest POD</Text>
 <Text size="lg" fw={700} truncate>{investment.spendByPod[0]?.pod ?? '—'}</Text>
 <Text size="xs" c="dimmed">{investment.spendByPod[0] ? fmtCurrency(investment.spendByPod[0].annualSpend) : ''}</Text>
 </Card>
 </SimpleGrid>

 <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
 <ChartCard title="Spend by POD" minHeight={280}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={280}>
 <BarChart data={podBarData} margin={{ top: 4, right: 16, left: 8, bottom: 50 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
 <XAxis dataKey="pod" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
 <YAxis tickFormatter={v => fmtCurrency(v)} tick={{ fontSize: 11 }} />
 <RechartTooltip
 formatter={(v: number, _: string, item: { payload?: { fullName?: string } }) =>
 [fmtCurrencyFull(v), item?.payload?.fullName ?? '']}
 contentStyle={{ fontSize: 12 }}
 />
 <Bar animationDuration={600} dataKey="spend" fill={AQUA_HEX} radius={[3, 3, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>

 <ChartCard title="Spend by Project (Top 10)" minHeight={280}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={280}>
 <BarChart
 data={investment.spendByProject.slice(0, 10).map(p => ({
 name: p.name.length > 16 ? p.name.slice(0, 16) + '…' : p.name,
 fullName: p.name,
 cost: p.totalCost
 }))}
 margin={{ top: 4, right: 16, left: 8, bottom: 50 }}
 >
 <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
 <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
 <YAxis tickFormatter={v => fmtCurrency(v)} tick={{ fontSize: 11 }} />
 <RechartTooltip
 formatter={(v: number, _: string, item: { payload?: { fullName?: string } }) =>
 [fmtCurrencyFull(v), item?.payload?.fullName ?? '']}
 contentStyle={{ fontSize: 12 }}
 />
 <Bar animationDuration={600} dataKey="cost" fill={COLOR_BLUE_LIGHT} radius={[3, 3, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </SimpleGrid>

 {/* ═══════════════════════════════════════════════════════════════════
 Section 2 — OUTPUT: "What was delivered?"
 ═══════════════════════════════════════════════════════════════════ */}
 <Title order={3} mt="xl">
 <Group gap="xs">
 <ThemeIcon variant="light" color="blue" size="md"><IconChecklist size={16} /></ThemeIcon>
 Output — What was delivered?
 </Group>
 </Title>

 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Total Projects</Text>
 <Text size="xl" fw={700}>{output.totalProjects}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Completed</Text>
 <Text size="xl" fw={700} c="green">{output.completedProjects}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Active</Text>
 <Text size="xl" fw={700} c="blue">{output.activeProjects}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Completion Rate</Text>
 <Group gap="xs" align="baseline">
 <Text size="xl" fw={700}>{output.completionRate}%</Text>
 </Group>
 <Progress value={output.completionRate} color="green" size="sm" mt={6} />
 </Card>
 </SimpleGrid>

 <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
 <ChartCard title="Projects by Status" minHeight={300}>
 <div role="img" aria-label="Pie chart">
 <ResponsiveContainer width="100%" height={300}>
 <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
 <Pie
 data={statusPieData}
 cx="50%" cy="50%"
 innerRadius={50} outerRadius={85}
 paddingAngle={2}
 dataKey="value"
 label={({ name, value }) => `${name} (${value})`}
 style={{ fontSize: 11 }}
 >
 {statusPieData.map((entry, i) => {
 const STATUS_PIE: Record<string, string> = {
 'ACTIVE': AQUA, 'IN DISCOVERY': DEEP_BLUE, 'NOT STARTED': COLOR_BLUE_LIGHT,
 'ON HOLD': COLOR_AMBER, 'COMPLETED': COLOR_SUCCESS, 'CANCELLED': COLOR_ERROR_LIGHT
 };
 return <Cell key={i} fill={STATUS_PIE[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />;
 })}
 </Pie>
 <RechartTooltip />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>

 <ChartCard title="Projects by Priority" minHeight={300}>
 <div role="img" aria-label="Pie chart">
 <ResponsiveContainer width="100%" height={300}>
 <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
 <Pie
 data={priorityPieData}
 cx="50%" cy="50%"
 innerRadius={50} outerRadius={85}
 paddingAngle={2}
 dataKey="value"
 label={({ name, value }) => `${name} (${value})`}
 style={{ fontSize: 11 }}
 >
 {priorityPieData.map((entry, i) => (
 <Cell key={i} fill={
 entry.name === 'HIGHEST' || entry.name === 'BLOCKER' ? COLOR_ERROR_LIGHT :
 entry.name === 'HIGH' ? COLOR_AMBER :
 entry.name === 'MEDIUM' ? COLOR_BLUE_LIGHT :
 entry.name === 'LOW' || entry.name === 'LOWEST' ? TEXT_DIM :
 PIE_COLORS[i % PIE_COLORS.length]
 } />
 ))}
 </Pie>
 <RechartTooltip />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </SimpleGrid>

 {/* Top projects by effort */}
 <Card withBorder p="md">
 <Text fw={600} mb="md">Top Projects by Effort</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Project</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Priority</Table.Th>
 <Table.Th>Owner</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Effort (hrs)</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>PODs</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Duration</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {output.projectEffortSummary.slice(0, 15).map(p => (
 <Table.Tr key={p.id}>
 <Table.Td fw={500}>{p.name}</Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Badge size="sm" color={STATUS_COLORS[p.status] ?? 'gray'} variant="light">
 {p.status.replace(/_/g, ' ')}
 </Badge>
 </Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Badge size="sm" color={PRIORITY_COLORS[p.priority] ?? 'gray'} variant="light">
 {p.priority}
 </Badge>
 </Table.Td>
 <Table.Td>{p.owner ?? '—'}</Table.Td>
 <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 {fmtHours(p.totalHours)}
 </Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>{p.pods}</Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 {p.durationMonths ? `${p.durationMonths} mo` : '—'}
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Card>

 {/* ═══════════════════════════════════════════════════════════════════
 Section 3 — EFFICIENCY: "Was it delivered efficiently?"
 ═══════════════════════════════════════════════════════════════════ */}
 <Title order={3} mt="xl">
 <Group gap="xs">
 <ThemeIcon variant="light" color="violet" size="md"><IconRocket size={16} /></ThemeIcon>
 Efficiency — Was it delivered efficiently?
 </Group>
 </Title>

 {/* DORA snapshot — sourced from the same endpoint as the DORA Metrics page */}
 {doraData && (
 <>
 <Group justify="space-between" align="center" mb={-4}>
 <Text size="sm" c="dimmed">
 DORA Metrics (industry benchmarks) — source: {doraData.source}
 </Text>
 <Button
 size="xs"
 variant="subtle"
 rightSection={<IconExternalLink size={12} />}
 onClick={() => navigate('/reports/dora', { state: {} })}
 >
 Full DORA Report
 </Button>
 </Group>
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
 <DoraCard
 label="Deploy Frequency"
 icon={<IconRocket size={18} color="var(--mantine-color-green-6)" />}
 metric={doraData.deploymentFrequency}
 onClick={() => navigate('/reports/dora', { state: { openDrill: 'deploy' } })}
 />
 <DoraCard
 label="Lead Time"
 icon={<IconClock size={18} color="var(--mantine-color-blue-6)" />}
 metric={doraData.leadTimeForChanges}
 onClick={() => navigate('/reports/dora', { state: { openDrill: 'leadTime' } })}
 />
 <DoraCard
 label="Change Failure Rate"
 icon={<IconBug size={18} color="var(--mantine-color-orange-6)" />}
 metric={doraData.changeFailureRate}
 onClick={() => navigate('/reports/dora', { state: { openDrill: 'cfr' } })}
 />
 <DoraCard
 label="MTTR"
 icon={<IconFlame size={18} color="var(--mantine-color-red-6)" />}
 metric={doraData.meanTimeToRecovery}
 onClick={() => navigate('/reports/dora', { state: { openDrill: 'mttr' } })}
 />
 </SimpleGrid>
 </>
 )}

 {/* Cost per project */}
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Projects Delivered</Text>
 <Text size="xl" fw={700} c="green">{efficiency.deliveredProjectCount}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Total Delivered Cost</Text>
 <Text size="xl" fw={700}>{fmtCurrency(efficiency.totalDeliveredCost)}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Avg Cost / Project</Text>
 <Text size="xl" fw={700}>{fmtCurrency(efficiency.avgCostPerProjectDelivered)}</Text>
 <Text size="xs" c="dimmed">delivered projects only</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Total Planned Cost</Text>
 <Text size="xl" fw={700}>{fmtCurrency(efficiency.totalPlannedCost ?? 0)}</Text>
 <Text size="xs" c="dimmed">all projects</Text>
 </Card>
 </SimpleGrid>

 {/* Cost per project table */}
 <Card withBorder p="md">
 <Group justify="space-between" mb="md">
 <Text fw={600}>Cost per Project</Text>
 <SegmentedControl
 size="xs"
 value={costView}
 onChange={v => setCostView(v as 'delivered' | 'all')}
 data={[
 { value: 'delivered', label: 'Delivered Only' },
 { value: 'all', label: 'All Projects' },
 ]}
 />
 </Group>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Project</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Priority</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Hours</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Total Cost</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Dev</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>QA</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>BSA</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Tech Lead</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {costProjectList.slice(0, 20).map(p => (
 <Table.Tr key={p.id}>
 <Table.Td fw={500}>{p.name}</Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Badge size="sm" color={STATUS_COLORS[p.status] ?? 'gray'} variant="light">
 {p.status.replace(/_/g, ' ')}
 </Badge>
 </Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Badge size="sm" color={PRIORITY_COLORS[p.priority] ?? 'gray'} variant="light">
 {p.priority}
 </Badge>
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 {fmtHours(p.totalHours)}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
 {fmtCurrency(p.totalCost)}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 {p.roleCosts?.DEV ? fmtCurrency(p.roleCosts.DEV) : '—'}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 {p.roleCosts?.QA ? fmtCurrency(p.roleCosts.QA) : '—'}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 {p.roleCosts?.BSA ? fmtCurrency(p.roleCosts.BSA) : '—'}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 {p.roleCosts?.TECH_LEAD ? fmtCurrency(p.roleCosts.TECH_LEAD) : '—'}
 </Table.Td>
 </Table.Tr>
 ))}
 {costProjectList.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={9} style={{ textAlign: 'center' }}>
 <Text c="dimmed" size="sm">No {costView === 'delivered' ? 'delivered' : ''} projects with cost data</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Card>

 {/* ═══════════════════════════════════════════════════════════════════
 Section 4 — IMPACT: "Did it matter?"
 ═══════════════════════════════════════════════════════════════════ */}
 <Title order={3} mt="xl">
 <Group gap="xs">
 <ThemeIcon variant="light" color="orange" size="md"><IconTargetArrow size={16} /></ThemeIcon>
 Impact — Did it matter?
 </Group>
 </Title>

 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Critical/High Projects</Text>
 <Text size="xl" fw={700}>{impact.criticalHighPct}%</Text>
 <Text size="xs" c="dimmed">of all projects</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Effort on Critical/High</Text>
 <Group gap="xs" align="baseline">
 <Text size="xl" fw={700}>{impact.criticalHighEffortPct}%</Text>
 </Group>
 <Progress
 value={Number(impact.criticalHighEffortPct)}
 color={Number(impact.criticalHighEffortPct) >= 50 ? 'green' : 'orange'}
 size="sm"
 mt={6}
 />
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Total Planned Effort</Text>
 <Text size="xl" fw={700}>{fmtHours(impact.totalPlannedEffortHours)}</Text>
 </Card>
 <Card withBorder p="md">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Critical/High Delivered</Text>
 <Text size="xl" fw={700} c="green">{output.criticalHighDelivered}</Text>
 <Text size="xs" c="dimmed">projects completed</Text>
 </Card>
 </SimpleGrid>

 {/* Effort by Owner */}
 <ChartCard title="Engineering Effort by Business Owner" minHeight={280}>
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={280}>
 <BarChart data={ownerBarData} margin={{ top: 4, right: 16, left: 8, bottom: 50 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
 <XAxis dataKey="owner" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
 <YAxis tickFormatter={v => fmtHours(v)} tick={{ fontSize: 11 }} />
 <RechartTooltip
 formatter={(v: number, _: string, item: { payload?: { fullName?: string; pct?: number } }) =>
 [`${fmtHours(v)} (${item?.payload?.pct ?? 0}%)`, item?.payload?.fullName ?? '']}
 contentStyle={{ fontSize: 12 }}
 />
 <Bar animationDuration={600} dataKey="hours" fill={COLOR_AMBER} radius={[3, 3, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </ChartCard>
 </Stack>
 );
}
