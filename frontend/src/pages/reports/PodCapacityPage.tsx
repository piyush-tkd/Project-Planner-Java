import { useMemo, useState } from 'react';
import { Title, Stack, Text, Card, SimpleGrid, Table, SegmentedControl, Group, Select, Switch, ScrollArea} from '@mantine/core';
import {
 BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
 ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { IconClock, IconFlame, IconCalendarStats, IconTrendingUp } from '@tabler/icons-react';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { formatHours, formatPercent } from '../../utils/formatting';
import { getUtilizationBgColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import SummaryCard from '../../components/charts/SummaryCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ExportableChart from '../../components/common/ExportableChart';
import ChartCard from '../../components/common/ChartCard';

export default function PodCapacityPage() {
 const { data: gapData, isLoading } = useCapacityGap('hours');
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const dark = useDarkMode();
 const months = Array.from({ length: 12 }, (_, i) => i + 1);

 const pods = useMemo(() => {
 if (!gapData?.gaps) return [];
 const names = new Set(gapData.gaps.map(g => g.podName));
 return Array.from(names).sort();
 }, [gapData]);

 const [selectedPod, setSelectedPod] = useState<string>('');
 const [monthFilter, setMonthFilter] = useState<string | null>(null);
 const [hidePast, setHidePast] = useState(false);
 const activePod = selectedPod || pods[0] || '';
 const activeMonth = monthFilter ? Number(monthFilter) : null;

 const podMonthData = useMemo(() => {
 if (!gapData?.gaps || !activePod) return [];
 return months.map(m => {
 const row = gapData.gaps.find(g => g.podName === activePod && g.monthIndex === m);
 const cap = row?.capacityHours ?? 0;
 const dem = row?.demandHours ?? 0;
 const util = cap > 0 ? (dem / cap) * 100 : 0;
 return {
 month: monthLabels[m] ?? `M${m}`,
 monthIndex: m,
 capacity: Math.round(cap),
 demand: Math.round(dem),
 utilization: Math.round(util),
 };
 });
 }, [gapData, activePod, monthLabels, months]);

 // Visible months for charts/table (optionally hide past)
 const visibleMonthData = useMemo(() =>
 hidePast ? podMonthData.filter(d => d.monthIndex >= currentMonthIndex) : podMonthData,
 [podMonthData, hidePast, currentMonthIndex]);

 // Stats: spotlight selected month, otherwise annual summary
 const stats = useMemo(() => {
 if (podMonthData.length === 0) return { totalCap: 0, totalDem: 0, avgUtil: 0, peakMonth: '', peakUtil: 0, gap: 0 };
 if (activeMonth !== null) {
 const d = podMonthData.find(d => d.monthIndex === activeMonth);
 const cap = d?.capacity ?? 0;
 const dem = d?.demand ?? 0;
 const util = d?.utilization ?? 0;
 return { totalCap: cap, totalDem: dem, avgUtil: util, peakMonth: d?.month ?? '', peakUtil: util, gap: cap - dem };
 }
 const src = hidePast ? visibleMonthData : podMonthData;
 const totalCap = src.reduce((s, d) => s + d.capacity, 0);
 const totalDem = src.reduce((s, d) => s + d.demand, 0);
 const avgUtil = totalCap > 0 ? (totalDem / totalCap) * 100 : 0;
 const peakIdx = src.reduce((pi, d, i) => d.utilization > src[pi].utilization ? i : pi, 0);
 return {
 totalCap,
 totalDem,
 avgUtil: Math.round(avgUtil),
 peakMonth: src[peakIdx]?.month ?? '',
 peakUtil: src[peakIdx]?.utilization ?? 0,
 gap: totalCap - totalDem,
 };
 }, [podMonthData, visibleMonthData, activeMonth, hidePast]);

 if (isLoading) return <LoadingSpinner variant="chart" message="Loading POD capacity..." />;

 return (
 <Stack className="page-enter stagger-children">
 <Group className="slide-in-left">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>POD Capacity</Title>
 <Text size="sm" c="dimmed">Per-POD capacity vs demand detail — select a POD to drill in</Text>
 </div>
 </Group>

 {pods.length > 0 && (
 <SegmentedControl
 value={activePod}
 onChange={v => { setSelectedPod(v); setMonthFilter(null); }}
 data={pods.map(p => ({ value: p, label: p }))}
 />
 )}

 <Group gap="md" align="flex-end" wrap="wrap">
 <Select
 label="Month spotlight"
 placeholder="All months (annual)"
 data={podMonthData.map(d => ({ value: String(d.monthIndex), label: d.month }))}
 value={monthFilter}
 onChange={setMonthFilter}
 clearable
 style={{ minWidth: 200, maxWidth: 260 }}
 size="sm"
 />
 <div>
 <Text size="xs" c="dimmed" mb={6}>Hide past months</Text>
 <Switch
 checked={hidePast}
 onChange={e => setHidePast(e.currentTarget.checked)}
 label={hidePast ? 'Showing future only' : 'Showing all months'}
 size="sm"
 />
 </div>
 </Group>

 <SimpleGrid cols={{ base: 2, sm: 4 }}>
 <SummaryCard
 title={activeMonth ? 'Capacity' : 'Total Capacity'}
 value={formatHours(stats.totalCap)}
 icon={<IconClock size={20} color="#339af0" />}
 />
 <SummaryCard
 title={activeMonth ? 'Demand' : 'Total Demand'}
 value={formatHours(stats.totalDem)}
 icon={<IconTrendingUp size={20} color="#845ef7" />}
 />
 <SummaryCard
 title={activeMonth ? 'Utilization' : 'Avg Utilization'}
 value={formatPercent(stats.avgUtil)}
 icon={<IconFlame size={20} color={stats.avgUtil > 100 ? '#fa5252' : stats.avgUtil > 80 ? '#fd7e14' : '#40c057'} />}
 color={stats.avgUtil > 100 ? 'red' : stats.avgUtil > 80 ? 'orange' : 'green'}
 />
 <SummaryCard
 title={activeMonth ? 'Gap' : 'Peak Month'}
 value={activeMonth
 ? (stats.gap >= 0 ? `+${formatHours(stats.gap)}` : formatHours(stats.gap))
 : `${stats.peakMonth} (${formatPercent(stats.peakUtil)})`}
 icon={<IconCalendarStats size={20} color={activeMonth && stats.gap < 0 ? '#fa5252' : '#fd7e14'} />}
 color={activeMonth ? (stats.gap < 0 ? 'red' : 'green') : undefined}
 />
 </SimpleGrid>

 <SimpleGrid cols={{ base: 1, md: 2 }}>
 <ChartCard title={`Capacity vs Demand — ${activePod}`} minHeight={300}>
 <ExportableChart title={`Capacity vs Demand - ${activePod}`}>
 <Text size="xs" c="dimmed" mb="sm">
 Total hours per month{activeMonth ? ` — ${visibleMonthData.find(d => d.monthIndex === activeMonth)?.month ?? ''} highlighted` : ''}
 </Text>
 <ResponsiveContainer width="100%" height={280}>
 <BarChart data={visibleMonthData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" fontSize={10} />
 <YAxis fontSize={10} />
 <Tooltip formatter={(value: number) => formatHours(value)} />
 <Legend wrapperStyle={{ fontSize: 11 }} />
 <Bar dataKey="capacity" name="Capacity" strokeWidth={2}>
 {visibleMonthData.map(d => (
 <Cell key={d.monthIndex}
 fill={activeMonth === d.monthIndex ? '#3b82f6' : 'rgba(59,130,246,0.3)'}
 stroke="#3b82f6"
 />
 ))}
 </Bar>
 <Bar dataKey="demand" name="Demand" strokeWidth={2}>
 {visibleMonthData.map(d => (
 <Cell key={d.monthIndex}
 fill={activeMonth === d.monthIndex ? '#ef4444' : 'rgba(239,68,68,0.35)'}
 stroke="#ef4444"
 />
 ))}
 </Bar>
 {activeMonth !== null && (
 <ReferenceLine
 x={visibleMonthData.find(d => d.monthIndex === activeMonth)?.month}
 stroke="#0C2340"
 strokeWidth={2}
 strokeDasharray="4 3"
 />
 )}
 </BarChart>
 </ResponsiveContainer>
 </ExportableChart>
 </ChartCard>

 <ChartCard title={`Utilization % — ${activePod}`} minHeight={300}>
 <ExportableChart title={`Utilization - ${activePod}`}>
 <Text size="xs" c="dimmed" mb="sm">Demand / capacity per month</Text>
 <ResponsiveContainer width="100%" height={280}>
 <LineChart data={visibleMonthData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="month" fontSize={10} />
 <YAxis fontSize={10} domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} />
 <Tooltip formatter={(value: number) => `${value}%`} />
 <ReferenceLine y={100} stroke="rgba(220,38,38,0.5)" strokeDasharray="5 4" label={{ value: '100%', position: 'right', fontSize: 10 }} />
 {activeMonth !== null && (
 <ReferenceLine
 x={visibleMonthData.find(d => d.monthIndex === activeMonth)?.month}
 stroke="#0C2340"
 strokeWidth={2}
 strokeDasharray="4 3"
 />
 )}
 <Line
 type="monotone"
 dataKey="utilization"
 stroke="#8b5cf6"
 fill="rgba(139,92,246,0.1)"
 strokeWidth={2}
 dot={(props: any) => {
 const isActive = visibleMonthData[props.index]?.monthIndex === activeMonth;
 return <circle key={props.index} cx={props.cx} cy={props.cy} r={isActive ? 7 : 4} fill={isActive ? '#0C2340' : '#8b5cf6'} stroke="white" strokeWidth={1} />;
 }}
 name="Utilization %"
 />
 </LineChart>
 </ResponsiveContainer>
 </ExportableChart>
 </ChartCard>
 </SimpleGrid>

 <Card withBorder padding="md">
 <Title order={4} mb={4}>Monthly Detail — {activePod}</Title>
 <Text size="xs" c="dimmed" mb="sm">Capacity, demand, and utilization per month</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Month</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Capacity (hrs)</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Demand (hrs)</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Gap (hrs)</Table.Th>
 <Table.Th style={{ textAlign: 'right' }}>Utilization</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {visibleMonthData.map(d => {
 const gap = d.capacity - d.demand;
 const isSpotlit = activeMonth === d.monthIndex;
 return (
 <Table.Tr
 key={d.monthIndex}
 style={{
 cursor: 'pointer',
 outline: isSpotlit ? '2px solid #0C2340' : undefined,
 ...(d.monthIndex < currentMonthIndex && !isSpotlit ? { opacity: 0.5 } : {}),
 }}
 onClick={() => setMonthFilter(prev => prev === String(d.monthIndex) ? null : String(d.monthIndex))}
 >
 <Table.Td fw={isSpotlit ? 700 : 500}>
 {d.month}{isSpotlit ? ' ◀' : ''}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{formatHours(d.capacity)}</Table.Td>
 <Table.Td style={{ textAlign: 'right' }}>{formatHours(d.demand)}</Table.Td>
 <Table.Td style={{ textAlign: 'right', color: gap < 0 ? '#fa5252' : '#40c057', fontWeight: 600 }}>
 {formatHours(gap)}
 </Table.Td>
 <Table.Td style={{ textAlign: 'right', backgroundColor: getUtilizationBgColor(d.utilization, dark) }}>
 {formatPercent(d.utilization)}
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Card>
 </Stack>
 );
}
