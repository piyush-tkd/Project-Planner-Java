import { useMemo, useState } from 'react';
import {
 Title, Stack, Text, Group, Select, Badge, Card, SimpleGrid, Table,
 SegmentedControl, Tooltip, Button, ScrollArea} from '@mantine/core';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
 Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { IconCurrencyDollar, IconTrendingUp, IconAlertTriangle, IconBuilding } from '@tabler/icons-react';
import { useResourceAllocation } from '../../api/reports';
import { useResources } from '../../api/resources';
import { useCostRates } from '../../api/resources';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { useDarkMode } from '../../hooks/useDarkMode';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import CsvToolbar from '../../components/common/CsvToolbar';
import ChartCard from '../../components/common/ChartCard';
import type { CsvColumnDef } from '../../utils/csv';

function formatCurrency(n: number): string {
 if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
 if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
 return `$${Math.round(n).toLocaleString()}`;
}

function formatCurrencyFull(n: number): string {
 return `$${Math.round(n).toLocaleString()}`;
}

interface PodMonthSpend {
 podName: string;
 monthIndex: number;
 monthLabel: string;
 spend: number;
}

interface PodAnnualSpend {
 podName: string;
 totalSpend: number;
 monthlyBreakdown: Record<number, number>;
}

interface RoleSpend {
 role: string;
 totalSpend: number;
 pct: number;
}

interface CsvRow {
 pod: string;
 role: string;
 month: string;
 hours: number;
 rate: number;
 spend: number;
}

const CSV_COLUMNS: CsvColumnDef<CsvRow>[] = [
 { key: 'pod', header: 'POD' },
 { key: 'role', header: 'Role' },
 { key: 'month', header: 'Month' },
 { key: 'hours', header: 'Hours', format: r => String(Math.round(r.hours)) },
 { key: 'rate', header: 'Hourly Rate ($)', format: r => r.rate.toFixed(2) },
 { key: 'spend', header: 'Planned Spend ($)', format: r => Math.round(r.spend).toString() },
];

export default function BudgetPage() {
 const { data: allocations, isLoading: allocLoading } = useResourceAllocation();
 const { data: resources, isLoading: resLoading } = useResources();
 const { data: costRates, isLoading: ratesLoading } = useCostRates();
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const dark = useDarkMode();
 const months = Array.from({ length: 12 }, (_, i) => i + 1);

 const [podFilter, setPodFilter] = useState<string | null>(null);
 const [viewMode, setViewMode] = useState<'monthly' | 'cumulative'>('monthly');

 const isLoading = allocLoading || resLoading || ratesLoading;

 // Build lookup maps
 const locationMap = useMemo(() => {
 const map = new Map<number, string>();
 if (!resources) return map;
 for (const r of resources) map.set(r.id, r.location);
 return map;
 }, [resources]);

 const rateMap = useMemo(() => {
 const map = new Map<string, number>();
 if (!costRates) return map;
 for (const r of costRates) map.set(`${r.role}::${r.location}`, r.hourlyRate);
 return map;
 }, [costRates]);

 // Compute spend per pod/month
 const spendRows = useMemo((): PodMonthSpend[] => {
 if (!allocations || rateMap.size === 0) return [];
 const acc = new Map<string, number>();

 for (const a of allocations) {
 const location = locationMap.get(a.resourceId) ?? 'UNKNOWN';
 const rate = rateMap.get(`${a.role}::${location}`) ?? rateMap.get(`${a.role}::`) ?? 0;
 const spend = a.allocatedHours * rate;
 const key = `${a.podName}::${a.monthIndex}`;
 acc.set(key, (acc.get(key) ?? 0) + spend);
 }

 const rows: PodMonthSpend[] = [];
 for (const [key, spend] of acc) {
 const [podName, monthStr] = key.split('::');
 const monthIndex = Number(monthStr);
 rows.push({ podName, monthIndex, monthLabel: monthLabels[monthIndex] ?? `M${monthIndex}`, spend });
 }
 return rows.sort((a, b) => a.monthIndex - b.monthIndex || a.podName.localeCompare(b.podName));
 }, [allocations, locationMap, rateMap, monthLabels]);

 // CSV data rows
 const csvRows = useMemo((): CsvRow[] => {
 if (!allocations || rateMap.size === 0) return [];
 return allocations.map(a => {
 const location = locationMap.get(a.resourceId) ?? 'UNKNOWN';
 const rate = rateMap.get(`${a.role}::${location}`) ?? 0;
 return {
 pod: a.podName,
 role: a.role,
 month: monthLabels[a.monthIndex] ?? `M${a.monthIndex}`,
 hours: a.allocatedHours,
 rate,
 spend: a.allocatedHours * rate,
 };
 });
 }, [allocations, locationMap, rateMap, monthLabels]);

 const pods = useMemo(() => [...new Set(spendRows.map(r => r.podName))].sort(), [spendRows]);
 const podOptions = pods.map(p => ({ value: p, label: p }));

 const filteredRows = useMemo(() =>
 podFilter ? spendRows.filter(r => r.podName === podFilter) : spendRows,
 [spendRows, podFilter]);

 // POD annual spend
 const podAnnualSpend = useMemo((): PodAnnualSpend[] => {
 const acc = new Map<string, PodAnnualSpend>();
 for (const r of filteredRows) {
 if (!acc.has(r.podName)) acc.set(r.podName, { podName: r.podName, totalSpend: 0, monthlyBreakdown: {} });
 const entry = acc.get(r.podName)!;
 entry.totalSpend += r.spend;
 entry.monthlyBreakdown[r.monthIndex] = (entry.monthlyBreakdown[r.monthIndex] ?? 0) + r.spend;
 }
 return [...acc.values()].sort((a, b) => b.totalSpend - a.totalSpend);
 }, [filteredRows]);

 const totalAnnualSpend = useMemo(() => podAnnualSpend.reduce((s, p) => s + p.totalSpend, 0), [podAnnualSpend]);
 const avgMonthlySpend = totalAnnualSpend / 12;

 // Monthly total spend for trend chart
 const monthlyTotals = useMemo(() => months.map(m => {
 const spend = filteredRows.filter(r => r.monthIndex === m).reduce((s, r) => s + r.spend, 0);
 return { month: monthLabels[m] ?? `M${m}`, spend, monthIndex: m };
 }), [filteredRows, months, monthLabels]);

 // Cumulative trend
 const cumulativeTotals = useMemo(() => {
 let cum = 0;
 return monthlyTotals.map(row => {
 cum += row.spend;
 return { ...row, cumulative: cum };
 });
 }, [monthlyTotals]);

 // Role spend breakdown
 const roleSpend = useMemo((): RoleSpend[] => {
 if (!allocations || rateMap.size === 0) return [];
 const acc = new Map<string, number>();
 for (const a of (podFilter ? allocations.filter(a => a.podName === podFilter) : allocations)) {
 const location = locationMap.get(a.resourceId) ?? 'UNKNOWN';
 const rate = rateMap.get(`${a.role}::${location}`) ?? 0;
 const spend = a.allocatedHours * rate;
 acc.set(a.role, (acc.get(a.role) ?? 0) + spend);
 }
 const total = [...acc.values()].reduce((s, v) => s + v, 0);
 return [...acc.entries()]
 .map(([role, spend]) => ({ role, totalSpend: spend, pct: total > 0 ? (spend / total) * 100 : 0 }))
 .sort((a, b) => b.totalSpend - a.totalSpend);
 }, [allocations, locationMap, rateMap, podFilter]);

 // Bar chart data — by POD for selected month range
 const podBarData = useMemo(() =>
 podAnnualSpend.map(p => ({
 pod: p.podName.length > 12 ? p.podName.slice(0, 12) + '…' : p.podName,
 fullName: p.podName,
 spend: Math.round(p.totalSpend),
 })),
 [podAnnualSpend]);

 // Monthly breakdown table data — rows = months, cols = pods
 const tableData = useMemo(() => months.map(m => {
 const row: Record<string, unknown> = { month: monthLabels[m] ?? `M${m}`, monthIndex: m };
 let rowTotal = 0;
 for (const pod of pods) {
 const spend = filteredRows.find(r => r.podName === pod && r.monthIndex === m)?.spend ?? 0;
 row[pod] = spend;
 rowTotal += spend;
 }
 row._total = rowTotal;
 return row;
 }), [months, monthLabels, pods, filteredRows]);

 const noCostRates = !isLoading && costRates?.length === 0;
 const noRateMatch = !isLoading && spendRows.length === 0 && (allocations?.length ?? 0) > 0;

 if (isLoading) return <LoadingSpinner variant="chart" message="Loading budget data..." />;

 const displayPods = podFilter ? [podFilter] : pods;
 const today = new Date().toISOString().slice(0, 10);

 return (
 <Stack className="page-enter stagger-children">
 <Group justify="space-between" align="flex-end" className="slide-in-left">
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>Budget &amp; Cost Tracker</Title>
 <Group gap="sm">
 <Select
 placeholder="All PODs"
 data={podOptions}
 value={podFilter}
 onChange={setPodFilter}
 clearable
 searchable
 size="sm"
 style={{ width: 200 }}
 />
 {podFilter && (
 <Button variant="subtle" color="gray" size="sm" onClick={() => setPodFilter(null)}>
 Clear
 </Button>
 )}
 <CsvToolbar
 data={csvRows as unknown as Record<string, unknown>[]}
 columns={CSV_COLUMNS as unknown as CsvColumnDef<Record<string, unknown>>[]}
 filename={`budget-${today}`}
 exportOnly
 />
 </Group>
 </Group>

 {noCostRates && (
 <Card withBorder p="md" style={{ borderColor: 'orange' }}>
 <Group gap="sm">
 <IconAlertTriangle size={18} color="orange" />
 <Text size="sm" c="orange">No cost rates configured. Go to Settings → Reference Data to add hourly rates per role &amp; location.</Text>
 </Group>
 </Card>
 )}

 {noRateMatch && !noCostRates && (
 <Card withBorder p="md" style={{ borderColor: 'var(--mantine-color-yellow-5)' }}>
 <Group gap="sm">
 <IconAlertTriangle size={18} color="orange" />
 <Text size="sm" c="dimmed">Some resources have no matching cost rate (role + location). Spend may be understated.</Text>
 </Group>
 </Card>
 )}

 {/* KPI Cards */}
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
 <Card withBorder p="md">
 <Group gap="sm" mb={4}>
 <IconCurrencyDollar size={20} color="var(--mantine-color-green-6)" />
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Annual Planned Spend</Text>
 </Group>
 <Text size="xl" fw={700}>{formatCurrency(totalAnnualSpend)}</Text>
 <Text size="xs" c="dimmed">full year projection</Text>
 </Card>

 <Card withBorder p="md">
 <Group gap="sm" mb={4}>
 <IconTrendingUp size={20} color="var(--mantine-color-blue-6)" />
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Avg Monthly Spend</Text>
 </Group>
 <Text size="xl" fw={700}>{formatCurrency(avgMonthlySpend)}</Text>
 <Text size="xs" c="dimmed">across all PODs</Text>
 </Card>

 <Card withBorder p="md">
 <Group gap="sm" mb={4}>
 <IconBuilding size={20} color="var(--mantine-color-violet-6)" />
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Most Expensive POD</Text>
 </Group>
 <Text size="xl" fw={700} truncate>
 {podAnnualSpend[0]?.podName ?? '—'}
 </Text>
 <Text size="xs" c="dimmed">
 {podAnnualSpend[0] ? formatCurrency(podAnnualSpend[0].totalSpend) : 'no data'}
 </Text>
 </Card>

 <Card withBorder p="md">
 <Group gap="sm" mb={4}>
 <IconCurrencyDollar size={20} color="var(--mantine-color-orange-6)" />
 <Text size="xs" c="dimmed" fw={600} tt="uppercase">Current Month</Text>
 </Group>
 <Text size="xl" fw={700}>
 {formatCurrency(monthlyTotals.find(m => m.monthIndex === currentMonthIndex)?.spend ?? 0)}
 </Text>
 <Text size="xs" c="dimmed">{monthLabels[currentMonthIndex]}</Text>
 </Card>
 </SimpleGrid>

 {/* Charts row */}
 <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
 {/* POD spend bar chart */}
 <ChartCard title="Annual Spend by POD" minHeight={280}>
 <ResponsiveContainer width="100%" height={280}>
 <BarChart data={podBarData} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
 <XAxis dataKey="pod" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
 <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11 }} />
 <RechartTooltip
 formatter={(v: number, _: string, item: { payload?: { fullName?: string } }) =>
 [formatCurrencyFull(v), item?.payload?.fullName ?? '']}
 contentStyle={{ fontSize: 12 }}
 />
 <Bar animationDuration={600} dataKey="spend" fill="var(--mantine-color-blue-6)" radius={[3, 3, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </ChartCard>

 {/* Monthly trend */}
 <ChartCard
 title="Monthly Spend Trend"
 minHeight={280}
 headerRight={
 <SegmentedControl
 size="xs"
 value={viewMode}
 onChange={v => setViewMode(v as 'monthly' | 'cumulative')}
 data={[{ value: 'monthly', label: 'Monthly' }, { value: 'cumulative', label: 'Cumulative' }]}
 />
 }
 >
 <ResponsiveContainer width="100%" height={280}>
 <LineChart data={cumulativeTotals} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
 <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
 <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
 <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11 }} />
 <RechartTooltip formatter={(v: number) => formatCurrencyFull(v)} contentStyle={{ fontSize: 12 }} />
 {viewMode === 'monthly' ? (
 <Line animationDuration={600} type="monotone" dataKey="spend" stroke="var(--mantine-color-green-6)" strokeWidth={2} dot={{ r: 3 }} name="Monthly" />
 ) : (
 <Line animationDuration={600} type="monotone" dataKey="cumulative" stroke="var(--mantine-color-violet-6)" strokeWidth={2} dot={{ r: 3 }} name="Cumulative" />
 )}
 </LineChart>
 </ResponsiveContainer>
 </ChartCard>
 </SimpleGrid>

 {/* Role spend breakdown */}
 <Card withBorder p="md">
 <Text fw={600} mb="md">Spend by Role</Text>
 <Group gap="md" wrap="wrap">
 {roleSpend.map(r => (
 <Group key={r.role} gap={6} align="center">
 <Badge variant="light" color="blue" size="lg" style={{ fontWeight: 500 }}>
 {r.role.replace(/_/g, ' ')}
 </Badge>
 <Text size="sm" fw={600}>{formatCurrency(r.totalSpend)}</Text>
 <Text size="xs" c="dimmed">({Math.round(r.pct)}%)</Text>
 </Group>
 ))}
 {roleSpend.length === 0 && <Text size="sm" c="dimmed">No data</Text>}
 </Group>
 </Card>

 {/* Monthly breakdown table */}
 <Card withBorder p="md">
 <Text fw={600} mb="md">Monthly Planned Spend by POD</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ whiteSpace: 'nowrap', minWidth: 80 }}>Month</Table.Th>
 {displayPods.map(pod => (
 <Table.Th key={pod} style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 110 }}>{pod}</Table.Th>
 ))}
 <Table.Th style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 110 }}>Total</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {tableData.map(row => {
 const isPast = (row.monthIndex as number) < currentMonthIndex;
 return (
 <Table.Tr key={row.monthIndex as number} style={isPast ? { opacity: 0.55 } : undefined}>
 <Table.Td fw={500} style={{ whiteSpace: 'nowrap' }}>
 {row.month as string}
 {(row.monthIndex as number) === currentMonthIndex && (
 <Badge size="xs" variant="dot" color="blue" ml={6}>Now</Badge>
 )}
 </Table.Td>
 {displayPods.map(pod => (
 <Table.Td key={pod} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
 <Tooltip label={formatCurrencyFull(row[pod] as number)}>
 <Text size="sm">{(row[pod] as number) > 0 ? formatCurrency(row[pod] as number) : '—'}</Text>
 </Tooltip>
 </Table.Td>
 ))}
 <Table.Td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
 {(row._total as number) > 0 ? formatCurrency(row._total as number) : '—'}
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 <Table.Tfoot>
 <Table.Tr style={{ fontWeight: 700 }}>
 <Table.Td>Annual Total</Table.Td>
 {displayPods.map(pod => {
 const podTotal = podAnnualSpend.find(p => p.podName === pod)?.totalSpend ?? 0;
 return (
 <Table.Td key={pod} style={{ textAlign: 'right', fontWeight: 700 }}>
 {formatCurrency(podTotal)}
 </Table.Td>
 );
 })}
 <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(totalAnnualSpend)}</Table.Td>
 </Table.Tr>
 </Table.Tfoot>
 </Table>
 </ScrollArea>
 </Card>
 </Stack>
 );
}
