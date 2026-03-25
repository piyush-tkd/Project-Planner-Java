import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Title, Stack, Text, Card, SimpleGrid, Table, Badge, Group, TextInput, Select, Button, ScrollArea} from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { IconAlertTriangle, IconFlame, IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { useProjects } from '../../api/projects';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { useTableSort } from '../../hooks/useTableSort';
import { formatHours, formatProjectDate } from '../../utils/formatting';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import SortableHeader from '../../components/common/SortableHeader';
import SummaryCard from '../../components/charts/SummaryCard';
import PriorityBadge from '../../components/common/PriorityBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ExportableChart from '../../components/common/ExportableChart';
import ChartCard from '../../components/common/ChartCard';
import { useDarkMode } from '../../hooks/useDarkMode';

interface ProjectHealth {
 id: number;
 name: string;
 priority: string;
 owner: string;
 startMonth: number;
 endMonth: number;
 durationMonths: number;
 totalDemand: number;
 podCapacity: number;
 loadPct: number;
 risk: string;
 launch: string;
 startDate: string | null;
 targetDate: string | null;
}

export default function DeadlineGapPage() {
 const isDark = useDarkMode();
 const { data: projects, isLoading: projLoading } = useProjects();
 const { data: gapData, isLoading: gapLoading } = useCapacityGap('hours');
 const { monthLabels } = useMonthLabels();
 const navigate = useNavigate();
 const [search, setSearch] = useState('');
 const [riskFilter, setRiskFilter] = useState<string | null>(null);
 const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
 const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

 const projectHealth = useMemo(() => {
 if (!projects || !gapData?.gaps) return [];
 const activeProjects = projects.filter(p => p.status === 'ACTIVE');

 return activeProjects.map(project => {
 const startM = project.startMonth;
 const endM = startM + project.durationMonths - 1;

 // Sum demand and capacity across the project's active months (all PODs)
 let totalDemand = 0;
 let podCapacity = 0;
 for (let m = startM; m <= Math.min(endM, 12); m++) {
 const monthGaps = gapData.gaps.filter(g => g.monthIndex === m);
 totalDemand += monthGaps.reduce((s, g) => s + g.demandHours, 0);
 podCapacity += monthGaps.reduce((s, g) => s + g.capacityHours, 0);
 }

 const loadPct = podCapacity > 0 ? Math.round((totalDemand / podCapacity) * 100) : 0;
 const risk = loadPct > 150 ? 'High' : loadPct > 100 ? 'Medium' : 'Low';
 const launch = monthLabels[endM] ?? `M${endM}`;

 return {
 id: project.id,
 name: project.name,
 priority: project.priority,
 owner: project.owner,
 startMonth: startM,
 endMonth: endM,
 durationMonths: project.durationMonths,
 totalDemand: Math.round(totalDemand),
 podCapacity: Math.round(podCapacity),
 loadPct,
 risk,
 launch,
 startDate: project.startDate ?? null,
 targetDate: project.targetDate ?? null,
 } as ProjectHealth;
 }).sort((a, b) => b.loadPct - a.loadPct);
 }, [projects, gapData, monthLabels]);

 const stats = useMemo(() => {
 const high = projectHealth.filter(p => p.risk === 'High').length;
 const medium = projectHealth.filter(p => p.risk === 'Medium').length;
 const low = projectHealth.filter(p => p.risk === 'Low').length;
 return { high, medium, low };
 }, [projectHealth]);

 const chartData = useMemo(() => {
 return projectHealth.slice(0, 20).map(p => ({
 name: p.name.length > 25 ? p.name.slice(0, 22) + '...' : p.name,
 totalDemand: p.totalDemand,
 podCapacity: p.podCapacity,
 }));
 }, [projectHealth]);

 const ownerOptions = useMemo(() => {
 const owners = [...new Set(projectHealth.map(p => p.owner).filter(Boolean))].sort();
 return owners.map(o => ({ value: o, label: o }));
 }, [projectHealth]);

 const priorityOptions = useMemo(() => {
 const ps = [...new Set(projectHealth.map(p => p.priority))].sort();
 return ps.map(p => ({ value: p, label: p }));
 }, [projectHealth]);

 const filteredHealth = useMemo(() => {
 let list = projectHealth;
 if (search.trim()) {
 const q = search.trim().toLowerCase();
 list = list.filter(p => p.name.toLowerCase().includes(q));
 }
 if (riskFilter) list = list.filter(p => p.risk === riskFilter);
 if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
 if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);
 return list;
 }, [projectHealth, search, riskFilter, ownerFilter, priorityFilter]);

 const { sorted, sortKey, sortDir, onSort } = useTableSort(filteredHealth);

 if (projLoading || gapLoading) return <LoadingSpinner variant="table" message="Loading deadline analysis..." />;

 return (
 <Stack className="page-enter stagger-children">
 <Group className="slide-in-left">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>Deadline Gap</Title>
 <Text size="sm" c="dimmed">
 How much of each project's demand can be served by available capacity during its window — lower load % = more headroom
 </Text>
 </div>
 </Group>

 <SimpleGrid cols={{ base: 1, sm: 3 }} className="stagger-grid">
 <SummaryCard title="High Demand Load" value={stats.high} icon={<IconAlertTriangle size={20} color="#fa5252" />} color="red"
 onClick={() => setRiskFilter(prev => prev === 'High' ? null : 'High')} active={riskFilter === 'High'} />
 <SummaryCard title="Medium Load" value={stats.medium} icon={<IconFlame size={20} color="#fd7e14" />} color="orange"
 onClick={() => setRiskFilter(prev => prev === 'Medium' ? null : 'Medium')} active={riskFilter === 'Medium'} />
 <SummaryCard title="Low Load" value={stats.low} icon={<IconCircleCheck size={20} color="#40c057" />} color="green"
 onClick={() => setRiskFilter(prev => prev === 'Low' ? null : 'Low')} active={riskFilter === 'Low'} />
 </SimpleGrid>

 {chartData.length > 0 && (
 <ChartCard title="Project Demand Load Ranking" minHeight={320}>
 <ExportableChart title="Project Demand Load Ranking">
 <Text size="xs" c="dimmed" mb="sm">Demand / available POD capacity during project window — higher % = more impact on POD</Text>
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="name" fontSize={8} angle={-35} textAnchor="end" interval={0} />
 <YAxis fontSize={10} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
 <Tooltip formatter={(value: number) => formatHours(value)} />
 <Legend wrapperStyle={{ fontSize: 10 }} />
 <Bar dataKey="totalDemand" fill="rgba(124,58,237,0.7)" name="Total Demand" />
 <Bar dataKey="podCapacity" fill="rgba(30,64,175,0.25)" name="POD Capacity Available" />
 </BarChart>
 </ResponsiveContainer>
 </ExportableChart>
 </ChartCard>
 )}

 <Group gap="sm" align="flex-end" wrap="wrap">
 <TextInput
 placeholder="Search by name…"
 leftSection={<IconSearch size={15} />}
 value={search}
 onChange={e => setSearch(e.currentTarget.value)}
 style={{ flex: '1 1 200px', maxWidth: 280 }}
 size="sm"
 />
 <Select
 placeholder="All Owners"
 data={ownerOptions}
 value={ownerFilter}
 onChange={setOwnerFilter}
 clearable
 searchable
 style={{ flex: '1 1 160px', maxWidth: 220 }}
 size="sm"
 />
 <Select
 placeholder="All Priorities"
 data={priorityOptions}
 value={priorityFilter}
 onChange={v => { setPriorityFilter(v); }}
 clearable
 style={{ flex: '1 1 140px', maxWidth: 180 }}
 size="sm"
 />
 {(search || ownerFilter || priorityFilter || riskFilter) && (
 <Button variant="subtle" color="gray" size="sm"
 onClick={() => { setSearch(''); setOwnerFilter(null); setPriorityFilter(null); setRiskFilter(null); }}>
 Clear filters
 </Button>
 )}
 <Text size="sm" c="dimmed" ml="auto">
 {sorted.length} of {projectHealth.length} projects
 </Text>
 </Group>

 <Card withBorder padding="md">
 <Title order={4} mb={4}>Project Health Detail</Title>
 <Text size="xs" c="dimmed" mb="sm">Total demand hours vs POD capacity available during project duration — sorted by load</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <SortableHeader sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort}>Project</SortableHeader>
 <SortableHeader sortKey="priority" currentKey={sortKey} dir={sortDir} onSort={onSort}>Pri</SortableHeader>
 <SortableHeader sortKey="owner" currentKey={sortKey} dir={sortDir} onSort={onSort}>Owner</SortableHeader>
 <SortableHeader sortKey="startMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>Start</SortableHeader>
 <SortableHeader sortKey="endMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>End</SortableHeader>
 <SortableHeader sortKey="durationMonths" currentKey={sortKey} dir={sortDir} onSort={onSort}>Dur</SortableHeader>
 <SortableHeader sortKey="totalDemand" currentKey={sortKey} dir={sortDir} onSort={onSort}>Total Demand</SortableHeader>
 <SortableHeader sortKey="podCapacity" currentKey={sortKey} dir={sortDir} onSort={onSort}>POD Capacity</SortableHeader>
 <SortableHeader sortKey="loadPct" currentKey={sortKey} dir={sortDir} onSort={onSort}>Load %</SortableHeader>
 <SortableHeader sortKey="risk" currentKey={sortKey} dir={sortDir} onSort={onSort}>Risk</SortableHeader>
 <SortableHeader sortKey="launch" currentKey={sortKey} dir={sortDir} onSort={onSort}>Launch</SortableHeader>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sorted.map(p => (
 <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
 <Table.Td fw={600} style={{ maxWidth: 180 }}>{p.name}</Table.Td>
 <Table.Td><PriorityBadge priority={p.priority} /></Table.Td>
 <Table.Td style={{ fontSize: 12 }}>{p.owner}</Table.Td>
 <Table.Td style={{ fontSize: 12 }}>{formatProjectDate(p.startDate, p.startMonth, monthLabels)}</Table.Td>
 <Table.Td style={{ fontSize: 12 }}>{formatProjectDate(p.targetDate, p.endMonth, monthLabels)}</Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>{p.durationMonths}m</Table.Td>
 <Table.Td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>{formatHours(p.totalDemand)}</Table.Td>
 <Table.Td style={{ textAlign: 'right', color: '#1e40af' }}>{formatHours(p.podCapacity)}</Table.Td>
 <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{p.loadPct}%</Table.Td>
 <Table.Td>
 <Badge
 color={p.risk === 'High' ? 'red' : p.risk === 'Medium' ? 'orange' : 'green'}
 variant="light"
 >
 {p.risk === 'High' ? 'High' : p.risk === 'Medium' ? 'Medium' : 'Low'}
 </Badge>
 </Table.Td>
 <Table.Td style={{ fontSize: 12 }}>{p.launch}</Table.Td>
 </Table.Tr>
 ))}
 {sorted.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={11}>
 <Text ta="center" c="dimmed" py="md">No active projects</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Card>
 </Stack>
 );
}
