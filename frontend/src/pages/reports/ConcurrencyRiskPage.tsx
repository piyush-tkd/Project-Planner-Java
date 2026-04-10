import { useState, useMemo } from 'react';
import { Title, Stack, Table, Text, Tooltip, Card, SimpleGrid, Group, MultiSelect, ScrollArea} from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer } from 'recharts';
import { IconAlertTriangle, IconFlame, IconTrendingUp } from '@tabler/icons-react';
import { useConcurrencyRisk, useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { formatHours } from '../../utils/formatting';
import { getConcurrencyColorByLevel } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { COLOR_BLUE, COLOR_BLUE_LIGHT, COLOR_ERROR, COLOR_ERROR_STRONG, COLOR_ORANGE, COLOR_ORANGE_ALT, COLOR_TEAL, COLOR_VIOLET_ALT, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY, SURFACE_SUBTLE} from '../../brandTokens';
import SummaryCard from '../../components/charts/SummaryCard';
import MonthHeader from '../../components/common/MonthHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ExportableChart from '../../components/common/ExportableChart';
import ChartCard from '../../components/common/ChartCard';

const POD_COLORS = [COLOR_BLUE, COLOR_VIOLET_ALT, COLOR_TEAL, COLOR_WARNING, COLOR_ERROR_STRONG, '#06b6d4', '#ec4899', '#14b8a6', COLOR_ORANGE_ALT, '#6366f1'];

export default function ConcurrencyRiskPage() {
 const { data, isLoading, error } = useConcurrencyRisk();
 const { data: gapData, isLoading: gapLoading } = useCapacityGap('hours');
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const dark = useDarkMode();
 const pastBg = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;
 const months = Array.from({ length: 12 }, (_, i) => i + 1);
 const [selectedPods, setSelectedPods] = useState<string[]>([]);

 const allPodRows = useMemo(() => {
 if (!data) return [];
 const podMap = new Map<string, Map<number, { count: number; riskLevel: string }>>();
 data.forEach(d => {
 if (!podMap.has(d.podName)) podMap.set(d.podName, new Map());
 podMap.get(d.podName)!.set(d.monthIndex, { count: d.activeProjectCount, riskLevel: d.riskLevel });
 });
 return Array.from(podMap.entries()).map(([name, monthData]) => ({ name, monthData }));
 }, [data]);

 const podRows = useMemo(() =>
 selectedPods.length > 0 ? allPodRows.filter(r => selectedPods.includes(r.name)) : allPodRows,
 [allPodRows, selectedPods]);

 const stats = useMemo(() => {
 if (!data) return { overloaded: 0, tight: 0, peakConcurrent: 0 };
 const overloaded = data.filter(d => d.riskLevel === 'HIGH').length;
 const tight = data.filter(d => d.riskLevel === 'MEDIUM').length;
 const peakConcurrent = Math.max(0, ...data.map(d => d.activeProjectCount));
 return { overloaded, tight, peakConcurrent };
 }, [data]);

 const allPodNames = useMemo(() => {
 if (!gapData?.gaps) return [];
 return Array.from(new Set(gapData.gaps.map(g => g.podName))).sort();
 }, [gapData]);

 const pods = useMemo(() =>
 selectedPods.length > 0 ? allPodNames.filter(p => selectedPods.includes(p)) : allPodNames,
 [allPodNames, selectedPods]);

 const demandChartData = useMemo(() => {
 if (!gapData?.gaps) return [];
 return months.map(m => {
 const row: Record<string, number | string> = { month: monthLabels[m] ?? `M${m}` };
 pods.forEach(pod => {
 const g = gapData.gaps.find(g => g.podName === pod && g.monthIndex === m);
 row[pod] = Math.round(g?.demandHours ?? 0);
 });
 return row;
 });
 }, [gapData, pods, monthLabels, months]);

 if (isLoading || gapLoading) return <LoadingSpinner variant="chart" message="Loading concurrency risk..." />;
 if (error) return <PageError context="loading concurrency data" error={error} />;

 return (
 <Stack className="page-enter stagger-children">
 <Group className="slide-in-left">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>Concurrency Risk</Title>
 <Text size="sm" c="dimmed">Months where multiple projects compete for the same POD — hover cells for risk level</Text>
 </div>
 </Group>

 <SimpleGrid cols={{ base: 1, sm: 3 }} className="stagger-grid">
 <SummaryCard title="High Risk POD-Months" value={stats.overloaded} icon={<IconAlertTriangle size={20} color={COLOR_ERROR} />} color="red" />
 <SummaryCard title="Medium Risk POD-Months" value={stats.tight} icon={<IconFlame size={20} color={COLOR_ORANGE} />} color="orange" />
 <SummaryCard title="Peak Concurrent Projects" value={stats.peakConcurrent} icon={<IconTrendingUp size={20} color={COLOR_BLUE_LIGHT} />} />
 </SimpleGrid>

 <Group gap="md">
 <MultiSelect
 label="Filter PODs"
 placeholder={selectedPods.length === 0 ? 'All PODs' : undefined}
 data={allPodNames}
 value={selectedPods}
 onChange={setSelectedPods}
 clearable
 searchable
 style={{ minWidth: 260, maxWidth: 500 }}
 size="sm"
 />
 <Text size="sm" c="dimmed" mt="lg">
 {podRows.length} of {allPodRows.length} PODs shown
 </Text>
 </Group>

 <Card withBorder padding="md">
 <ExportableChart title="Concurrency Grid">
 <Title order={4} mb={4}>Concurrency Grid — Active Projects x Utilization</Title>
 <Text size="xs" c="dimmed" mb="sm">Each cell = # active projects in that POD / month — color = risk level</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 140 }}>POD</Table.Th>
 <MonthHeader monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} />
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {podRows.map(row => (
 <Table.Tr key={row.name}>
 <Table.Td fw={500}>{row.name}</Table.Td>
 {months.map(m => {
 const cell = row.monthData.get(m);
 const count = cell?.count ?? 0;
 const riskLevel = cell?.riskLevel ?? '';
 return (
 <Table.Td
 key={m}
 style={{
 textAlign: 'center',
 ...(m < currentMonthIndex
 ? { opacity: 0.5, backgroundColor: pastBg }
 : { backgroundColor: count > 0 ? getConcurrencyColorByLevel(riskLevel, dark) : undefined }),
 }}
 >
 {count > 0 ? (
 <Tooltip label={`${count} projects — Risk: ${riskLevel}`}>
 <Text size="xs" fw={600}>{count} proj<br /><Text span size="xs" c="dimmed">{riskLevel}</Text></Text>
 </Tooltip>
 ) : (
 <Text size="xs" c="dimmed">—</Text>
 )}
 </Table.Td>
 );
 })}
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </ExportableChart>
 </Card>

 <ChartCard title="Peak Demand Chart — Projects Stacked by POD" minHeight={370}>
 <ExportableChart title="Peak Demand by POD">
 <Text size="xs" c="dimmed" mb="sm">Total demand hours per month — stacked by POD</Text>
 <ResponsiveContainer width="100%" height={350}>
 <BarChart data={demandChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" fontSize={10} />
 <YAxis fontSize={10} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
 <RTooltip formatter={(value: number) => formatHours(value)} />
 <Legend wrapperStyle={{ fontSize: 10 }} />
 {pods.map((pod, i) => (
 <Bar animationDuration={600} key={pod} dataKey={pod} stackId="s" fill={POD_COLORS[i % POD_COLORS.length] + 'cc'} />
 ))}
 </BarChart>
 </ResponsiveContainer>
 </ExportableChart>
 </ChartCard>
 </Stack>
 );
}
