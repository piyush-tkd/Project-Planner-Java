import { useState } from 'react';
import {
 Stack, Group, Box, Text, Badge, Loader, Table, Alert, ScrollArea, Accordion, Tooltip, Pagination, Paper, Drawer, Divider,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../../../../api/client';
import { AQUA_HEX } from '../../../../brandTokens';
import { MetricCard } from './MetricCard';
import { AssigneeCell } from './AssigneeCell';
import { jiraLink, fmt1, fmt0, fmtDate } from '../utils';

function DeveloperDrawer({
 developer, projectKey, avatars, opened, onClose,
}: {
 developer: string | null; projectKey: string | null; avatars: Record<string, string>; opened: boolean; onClose: () => void;
}) {
 const { data, isLoading } = useQuery({
 queryKey: ['eng-analytics', 'productivity', 'developer-report', developer, projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/productivity/developer-report', {
 params: { developer, sprints: 10, projectKey: projectKey || undefined },
 });
 return res.data as any[];
 },
 enabled: opened && !!developer,
 });

 const totalSP = (data ?? []).reduce((s: number, r: any) => s + (r.sp_closed ?? 0), 0);
 const totalHours = (data ?? []).reduce((s: number, r: any) => s + (r.hours_logged ?? 0), 0);
 const totalBugs = (data ?? []).reduce((s: number, r: any) => s + (r.bugs_done ?? 0), 0);
 const totalMissing = (data ?? []).reduce((s: number, r: any) => s + (r.issues_missing_logs ?? 0), 0);

 return (
 <Drawer
 opened={opened}
 onClose={onClose}
 title={
 <Group gap={8}>
 <AssigneeCell name={developer} avatars={avatars} />
 <Text fw={600} size="sm">Developer Report</Text>
 </Group>
 }
 position="right"
 size="lg"
 >
 {isLoading ? (
 <Loader mt="xl" />
 ) : !data || data.length === 0 ? (
 <Alert color="blue" mt="md">No sprint data found for this developer.</Alert>
 ) : (
 <Stack gap="md">
 {/* Summary badges */}
 <Group gap={8} wrap="wrap">
 <Badge size="sm" variant="light" color="blue">{fmt0(totalSP)} SP closed</Badge>
 <Badge size="sm" variant="light" color="teal">{fmt1(totalHours)}h logged</Badge>
 <Badge size="sm" variant="light" color="red">{totalBugs} bugs/incidents</Badge>
 {totalMissing > 0 && (
 <Badge size="sm" variant="light" color="orange">{totalMissing} issues missing logs</Badge>
 )}
 </Group>

 <Divider />

 <ScrollArea>
 <Table striped highlightOnHover>
 <colgroup>
 <col style={{ width: '40%' }} />
 <col style={{ width: 60 }} />
 <col style={{ width: 55 }} />
 <col style={{ width: 60 }} />
 <col style={{ width: 70 }} />
 <col style={{ width: 80 }} />
 </colgroup>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Sprint</Table.Th>
 <Table.Th ta="right">Done</Table.Th>
 <Table.Th ta="right">SPs</Table.Th>
 <Table.Th ta="right">Bugs</Table.Th>
 <Table.Th ta="right">Hours</Table.Th>
 <Table.Th ta="right">Missing logs</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {data.map((row: any) => (
 <Table.Tr key={row.sprint_name}>
 <Table.Td><Text size="xs" lineClamp={1}>{row.sprint_name}</Text></Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{row.issues_done ?? 0}</Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{fmt1(row.sp_closed ?? 0)}</Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{row.bugs_done ?? 0}</Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>
 {(row.hours_logged ?? 0) > 0
 ? `${fmt1(row.hours_logged)}h`
 : <Text size="xs" c="dimmed">—</Text>}
 </Table.Td>
 <Table.Td ta="right">
 {(row.issues_missing_logs ?? 0) > 0 ? (
 <Tooltip label="Issues marked done with no hours logged" withArrow>
 <Badge size="xs" color="orange" variant="light">{row.issues_missing_logs} missing</Badge>
 </Tooltip>
 ) : (
 <Text size="xs" c="green">✓</Text>
 )}
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>

 <Text size="9px" c="dimmed">
 Hours logged = worklogs submitted by this developer · Missing logs = done issues with no hours recorded
 </Text>
 </Stack>
 )}
 </Drawer>
 );
}

function ThroughputGrid({ byPerson, avatars, onSelect }: { byPerson: Record<string, any[]>; avatars: Record<string, string>; onSelect: (name: string) => void }) {
 const [page, setPage] = useState(1);
 const PAGE = 15;
 const entries = Object.entries(byPerson ?? {});
 const paged = entries.slice((page - 1) * PAGE, page * PAGE);

 return (
 <Stack gap={4}>
 <Group px={4} pb={4} gap={4} wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
 <Box style={{ flex: 1, minWidth: 0 }}><Text size="xs" fw={600} c="dimmed">Developer</Text></Box>
 <Text size="xs" fw={600} c="dimmed" w={55} ta="center">Done</Text>
 <Text size="xs" fw={600} c="dimmed" w={45} ta="center">Avg</Text>
 <Text size="xs" fw={600} c="dimmed" w={52} ta="center">Rate</Text>
 <Box style={{ flexShrink: 0 }}><Text size="xs" fw={600} c="dimmed">← Sprints (newest →)</Text></Box>
 </Group>

 {paged.map(([name, sprintList]: [string, any]) => {
 const arr = Array.isArray(sprintList) ? sprintList : [];
 const done = arr.reduce((s: number, sp: any) => s + (sp.issues_completed ?? 0), 0);
 const total = arr.reduce((s: number, sp: any) => s + (sp.total_assigned ?? sp.issues_completed ?? 0), 0);
 const avg = arr.length ? done / arr.length : 0;
 const rate = total > 0 ? Math.round(done / total * 100) : 0;
 const last = arr[0]?.issues_completed ?? 0;
 const prev = arr[1]?.issues_completed ?? 0;
 const trend = arr.length > 1 ? (last > prev ? '↑' : last < prev ? '↓' : '→') : '';

 return (
 <Group key={name} px={4} py={2} gap={4} align="center" wrap="nowrap">
 <Box
 style={{ flex: 1, minWidth: 0, overflow: 'hidden', cursor: 'pointer' }}
 onClick={() => onSelect(name)}
 >
 <Group gap={4} wrap="nowrap">
 <AssigneeCell name={name} avatars={avatars} />
 {trend && <Text size="10px" c={trend==='↑'?'green':trend==='↓'?'red':'dimmed'} fw={700}>{trend}</Text>}
 </Group>
 </Box>
 <Text size="xs" fw={600} w={55} ta="center">{done}</Text>
 <Text size="xs" c="dimmed" w={45} ta="center">{avg.toFixed(1)}</Text>
 <Box w={52} ta="center">
 <Badge size="xs" variant="light" color={rate>=80?'green':rate>=60?'yellow':'red'}>{rate}%</Badge>
 </Box>
 <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
 {[...arr].reverse().map((sp: any, i: number) => {
 const d = sp.issues_completed ?? 0;
 const t = sp.total_assigned ?? d;
 const p = t > 0 ? d / t : 0;
 return (
 <Tooltip key={i} label={`${(sp.sprint_name ?? '').slice(-14)}: ${d}/${t} done`} withArrow>
 <Box style={{
 width: 20, height: 20, borderRadius: 3, flexShrink: 0,
 background: d===0 ? 'var(--mantine-color-dark-5)' : p>=0.9?'#16a34a':p>=0.6?'#d97706':'#dc2626',
 display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default'}}>
 <Text size="8px" fw={700} c="white" style={{ lineHeight: 1 }}>{d||''}</Text>
 </Box>
 </Tooltip>
 );
 })}
 </Group>
 </Group>
 );
 })}

 {entries.length > PAGE && (
 <Group justify="center" pt={4}>
 <Pagination size="xs" value={page} onChange={setPage} total={Math.ceil(entries.length / PAGE)} />
 </Group>
 )}
 <Text size="9px" c="dimmed" pt={2}>
 🟩 ≥90% · 🟨 60-89% · 🟥 &lt;60% · ⬛ no issues that sprint · Avg = avg completed/sprint · Rate = overall done%
 </Text>
 </Stack>
 );
}

function CycleTimeTrend({ devData, avatars }: { devData: any[]; avatars: Record<string, string> }) {
 const [page, setPage] = useState(1);
 const PAGE = 15;
 const paged = devData.slice((page - 1) * PAGE, page * PAGE);

 return (
 <Stack gap={4}>
 <Group px={4} pb={4} gap={4} wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
 <Box style={{ flex: 1, minWidth: 0 }}><Text size="xs" fw={600} c="dimmed">Developer</Text></Box>
 <Text size="xs" fw={600} c="dimmed" w={60} ta="right">Latest</Text>
 <Text size="xs" fw={600} c="dimmed" w={50} ta="right">Avg</Text>
 <Box style={{ flexShrink: 0 }}><Text size="xs" fw={600} c="dimmed">← Months (newest →)</Text></Box>
 </Group>

 {paged.map((dev: any) => {
 const months: any[] = Array.isArray(dev.months) ? dev.months : [];
 const withData = months.filter((m: any) => (m.avg_cycle_days ?? 0) > 0);
 const latest = months[months.length - 1]?.avg_cycle_days ?? 0;
 const prev = months[months.length - 2]?.avg_cycle_days ?? 0;
 const trend = withData.length > 1
 ? (latest < prev ? '↓' : latest > prev ? '↑' : '→')
 : '';
 // ↓ = faster = green; ↑ = slower = red
 const trendColor = trend === '↓' ? 'green' : trend === '↑' ? 'red' : 'dimmed';
 const avg = withData.length ? withData.reduce((s: number, m: any) => s + m.avg_cycle_days, 0) / withData.length : 0;
 const cycleColor = (d: number) => d === 0 ? 'var(--mantine-color-dark-5)' : d <= 3 ? '#16a34a' : d <= 7 ? '#d97706' : '#dc2626';

 return (
 <Group key={dev.developer} px={4} py={2} gap={4} align="center" wrap="nowrap">
 <Box style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
 <Group gap={4} wrap="nowrap">
 <AssigneeCell name={dev.developer} avatars={avatars} />
 {trend && <Text size="10px" c={trendColor} fw={700}>{trend}</Text>}
 </Group>
 </Box>
 <Text size="xs" fw={600} w={60} ta="right" c={latest === 0 ? 'dimmed' : undefined}>
 {latest > 0 ? `${latest.toFixed(1)}d` : '—'}
 </Text>
 <Text size="xs" c="dimmed" w={50} ta="right">
 {avg > 0 ? `${avg.toFixed(1)}d` : '—'}
 </Text>
 <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
 {[...months].map((m: any, i: number) => {
 const d = m.avg_cycle_days ?? 0;
 return (
 <Tooltip key={i} label={`${m.month ?? ''}: ${d > 0 ? d.toFixed(1) + 'd avg cycle' : 'no data'}`} withArrow>
 <Box style={{
 width: 20, height: 20, borderRadius: 3, flexShrink: 0,
 background: cycleColor(d),
 display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default',
 }}>
 <Text size="8px" fw={700} c="white" style={{ lineHeight: 1 }}>
 {d > 0 ? (d >= 10 ? Math.round(d) : d.toFixed(1)) : ''}
 </Text>
 </Box>
 </Tooltip>
 );
 })}
 </Group>
 </Group>
 );
 })}

 {devData.length > PAGE && (
 <Group justify="center" pt={4}>
 <Pagination size="xs" value={page} onChange={setPage} total={Math.ceil(devData.length / PAGE)} />
 </Group>
 )}
 <Text size="9px" c="dimmed" pt={2}>
 🟩 ≤3d · 🟨 4–7d · 🟥 &gt;7d · ⬛ no data · ↓ = faster than last month · each cell = 1 month
 </Text>
 </Stack>
 );
}

export function ProductivityTab({ projectKey, avatars }: { projectKey: string | null; avatars: Record<string, string> }) {
 const [selectedDev, setSelectedDev] = useState<string | null>(null);

 const { data: throughput, isLoading: tpLoading } = useQuery({
 queryKey: ['eng-analytics', 'productivity', 'individual-throughput', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/productivity/individual-throughput', {
 params: { sprints: 20, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: estAccuracy, isLoading: estLoading } = useQuery({
 queryKey: ['eng-analytics', 'productivity', 'estimation-accuracy', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/productivity/estimation-accuracy', {
 params: { days: 90, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: wipData, isLoading: wipLoading } = useQuery({
 queryKey: ['eng-analytics', 'productivity', 'throughput-wip', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/productivity/throughput-wip', {
 params: { weeks: 12, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: optCap } = useQuery({
 queryKey: ['eng-analytics', 'forecasting', 'optimal-capacity', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/forecasting/optimal-capacity', {
 params: { projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: devGrowth } = useQuery({
 queryKey: ['eng-analytics', 'forecasting', 'developer-growth', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/forecasting/developer-growth', {
 params: { months: 6, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 if (tpLoading || estLoading) return <Loader />;

 const estPct = estAccuracy?.avg_accuracy_pct ?? 0;
 const wipChartData = Array.isArray(wipData)
 ? wipData.map((r: any) => ({
 week: fmtDate(r.week_start),
 throughput: r.throughput ?? 0,
 wip: r.wip_at_start ?? 0,
 }))
 : [];

 return (
 <Stack gap="lg">
 {/* Estimation Accuracy — compact stat, doesn't need a full card */}
 <Paper withBorder radius="md" p="md">
 <Group justify="space-between" wrap="wrap" gap="xs">
 <div>
 <Text size="xs" c="dimmed" fw={500}>Estimation Accuracy</Text>
 <Text size="9px" c="dimmed">Actual ÷ estimated × 100% · 80–120% = good · last 90 days</Text>
 </div>
 <Group gap="sm">
 <Text fw={700} size="xl">{fmt1(estPct)}%</Text>
 <Badge color={estPct >= 80 && estPct <= 120 ? 'green' : estPct < 80 ? 'blue' : 'orange'}>
 {estPct >= 80 && estPct <= 120 ? 'GOOD' : estPct < 80 ? 'OVER-ESTIMATED' : 'UNDER-ESTIMATED'}
 </Badge>
 </Group>
 </Group>
 </Paper>

 <MetricCard
 title="Throughput vs WIP"
 description="Weekly: issues completed vs work in progress. As WIP rises, throughput typically falls (Little's Law)."
 insight={wipChartData.length > 2
 ? (() => {
 const recent3 = wipChartData.slice(-3);
 const avgWip = recent3.reduce((s: number, r: any) => s + r.wip, 0) / 3;
 const avgTp = recent3.reduce((s: number, r: any) => s + r.throughput, 0) / 3;
 return avgWip > 20
 ? `HIGH WIP (avg ${avgWip.toFixed(0)}) may be limiting throughput (avg ${avgTp.toFixed(0)}/wk)`
 : `WIP is healthy (avg ${avgWip.toFixed(0)}), throughput avg ${avgTp.toFixed(0)}/wk`;
 })()
 : undefined}
 >
 {wipLoading ? <Loader size="sm" /> : wipChartData.length === 0 ? (
 <Text size="xs" c="dimmed">No weekly data available yet.</Text>
 ) : (
 <Box h={200}>
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={wipChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
 <XAxis dataKey="week" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(0, 6)} />
 <YAxis tick={{ fontSize: 10 }} />
 <RechartTooltip />
 <Line type="monotone" dataKey="throughput" stroke={AQUA_HEX} strokeWidth={2} dot={{ r: 3 }} name="Completed/wk" />
 <Line type="monotone" dataKey="wip" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="WIP" />
 </LineChart>
 </ResponsiveContainer>
 </Box>
 )}
 </MetricCard>

 <DeveloperDrawer
 developer={selectedDev}
 projectKey={projectKey}
 avatars={avatars}
 opened={!!selectedDev}
 onClose={() => setSelectedDev(null)}
 />

 <MetricCard
 title={`Individual Throughput${throughput?.total_people ? ` — ${throughput.total_people} people` : ''}`}
 description="Issues completed per person per sprint. Click a name for a full sprint-by-sprint breakdown. Green = mostly done, yellow = partial, red = low output."
 >
 {!throughput?.by_person || Object.keys(throughput.by_person).length === 0 ? (
 <Alert color="blue">No sprint data found. Ensure closed/active sprints are synced for the selected project.</Alert>
 ) : (
 <ThroughputGrid byPerson={throughput.by_person} avatars={avatars} onSelect={setSelectedDev} />
 )}
 </MetricCard>

 {estAccuracy?.issues && estAccuracy.issues.length > 0 && (
 <MetricCard
 title="Worst Estimates"
 description="Stories with largest estimation variance"
 >
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Issue</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th ta="right">Est (hrs)</Table.Th>
 <Table.Th ta="right">Actual (hrs)</Table.Th>
 <Table.Th ta="right">Accuracy %</Table.Th>
 <Table.Th>Assignee</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(estAccuracy.issues ?? []).slice(0, 5).map((s: any) => (
 <Table.Tr key={s.issue_key}>
 <Table.Td>
 <Text component="a" href={jiraLink(s.issue_key)} target="_blank"
 size="xs" ff="monospace" c="blue" td="underline">
 {s.issue_key}
 </Text>
 </Table.Td>
 <Table.Td><Text size="xs" lineClamp={1}>{s.summary}</Text></Table.Td>
 <Table.Td ta="right" style={{ fontSize: '13px' }}>{fmt0(s.estimated_hours)}</Table.Td>
 <Table.Td ta="right" style={{ fontSize: '13px' }}>{fmt0(s.actual_hours)}</Table.Td>
 <Table.Td ta="right" fw={600} c={s.accuracy_pct >= 80 && s.accuracy_pct <= 120 ? 'green' : 'red'}>
 {fmt1(s.accuracy_pct)}%
 </Table.Td>
 <Table.Td><AssigneeCell name={s.assignee_display_name} /></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </MetricCard>
 )}

 {/* Optimal Capacity */}
 {optCap?.by_sprint_size && optCap.by_sprint_size.length > 0 && (
 <MetricCard
 title="Optimal Sprint Capacity"
 description="Compares sprint outcomes by team size to find where predictability and throughput are highest"
 insight={(() => {
 const best = [...optCap.by_sprint_size].sort((a: any, b: any) => (b.avg_predictability ?? 0) - (a.avg_predictability ?? 0))[0];
 return best ? `Best predictability at ${best.sprint_size} team members (${fmt1(best.avg_predictability ?? 0)}% on-time)` : undefined;
 })()}
 >
 <Stack gap="sm">
 <ScrollArea>
 <Table striped highlightOnHover>
 <colgroup>
 <col style={{ width: 130 }} />
 <col style={{ width: 90 }} />
 <col style={{ width: 110 }} />
 <col style={{ width: 130 }} />
 <col style={{ width: 100 }} />
 </colgroup>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Team Size</Table.Th>
 <Table.Th ta="right">Sprints</Table.Th>
 <Table.Th ta="right">Avg Velocity</Table.Th>
 <Table.Th ta="right">Predictability</Table.Th>
 <Table.Th ta="right">On-time Rate</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {optCap.by_sprint_size.map((row: any) => {
 const pred = row.avg_predictability ?? 0;
 return (
 <Table.Tr key={row.sprint_size}>
 <Table.Td fw={600}>{row.sprint_size} members</Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{row.sprint_count}</Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{fmt1(row.avg_velocity ?? 0)}</Table.Td>
 <Table.Td ta="right">
 <Badge size="xs" variant="light" color={pred >= 80 ? 'green' : pred >= 60 ? 'yellow' : 'red'}>
 {fmt1(pred)}%
 </Badge>
 </Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{fmt1(row.on_time_rate ?? 0)}%</Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </ScrollArea>

 {optCap.sprints && optCap.sprints.length > 0 && (
 <Accordion variant="separated" mt={4}>
 <Accordion.Item value="sprints">
 <Accordion.Control><Text size="xs" fw={500}>Sprint-by-sprint breakdown ({optCap.sprints.length} sprints)</Text></Accordion.Control>
 <Accordion.Panel>
 <ScrollArea>
 <Table striped>
 <colgroup>
 <col style={{ width: 220 }} />
 <col style={{ width: 90 }} />
 <col style={{ width: 90 }} />
 <col style={{ width: 110 }} />
 </colgroup>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Sprint</Table.Th>
 <Table.Th ta="right">Team Size</Table.Th>
 <Table.Th ta="right">Velocity</Table.Th>
 <Table.Th ta="right">Predictability</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {optCap.sprints.map((sp: any) => (
 <Table.Tr key={sp.sprint_name}>
 <Table.Td><Text size="xs" lineClamp={1}>{sp.sprint_name}</Text></Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{sp.sprint_size}</Table.Td>
 <Table.Td ta="right" style={{ fontSize: 13 }}>{fmt1(sp.velocity ?? 0)}</Table.Td>
 <Table.Td ta="right">
 <Badge size="xs" variant="light" color={(sp.predictability ?? 0) >= 80 ? 'green' : (sp.predictability ?? 0) >= 60 ? 'yellow' : 'red'}>
 {fmt1(sp.predictability ?? 0)}%
 </Badge>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Accordion.Panel>
 </Accordion.Item>
 </Accordion>
 )}
 </Stack>
 </MetricCard>
 )}

 {/* Cycle Time Trend */}
 {devGrowth && Array.isArray(devGrowth) && devGrowth.length > 0 && (
 <MetricCard
 title={`Cycle Time Trend${devGrowth.length > 1 ? ` — top ${devGrowth.length} developers` : ''}`}
 description="Avg days from created to done, per developer per month. Green = fast, red = slow. ↓ = getting faster. Only developers with ≥3 issues in the period."
 insight={(() => {
 const improving = devGrowth.filter((dev: any) => {
 const m = Array.isArray(dev.months) ? dev.months : [];
 const latest = m[m.length - 1]?.avg_cycle_days ?? 0;
 const prev = m[m.length - 2]?.avg_cycle_days ?? 0;
 return latest > 0 && prev > 0 && latest < prev;
 }).length;
 const total = devGrowth.filter((dev: any) => {
 const m = Array.isArray(dev.months) ? dev.months : [];
 return (m[m.length - 1]?.avg_cycle_days ?? 0) > 0 && (m[m.length - 2]?.avg_cycle_days ?? 0) > 0;
 }).length;
 return total > 0 ? `${improving} of ${total} developers improved cycle time last month` : undefined;
 })()}
 >
 <CycleTimeTrend devData={devGrowth} avatars={avatars} />
 </MetricCard>
 )}

 <Accordion>
 <Accordion.Item value="glossary">
 <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
 <Accordion.Panel>
 <Stack gap="sm" style={{ fontSize: '14px' }}>
 <div>
 <Text fw={600} size="sm">Estimation Accuracy</Text>
 <Text size="xs" c="dimmed">Actual time ÷ Estimated time × 100%. 80-120% = good range. Consistent &lt;80% = over-estimation, &gt;120% = under-estimation</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Individual Throughput</Text>
 <Text size="xs" c="dimmed">Issues completed per developer per sprint. Use to spot sudden drops (blocked) not for evaluation</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Throughput vs WIP</Text>
 <Text size="xs" c="dimmed">As WIP (work in progress) increases, throughput decreases (Little's Law). Keep WIP bounded</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Optimal Sprint Capacity</Text>
 <Text size="xs" c="dimmed">Groups historical sprints by team size to find which size produced the best velocity and predictability. Use to guide hiring and staffing decisions.</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Cycle Time Trend</Text>
 <Text size="xs" c="dimmed">Avg days from work-started to done per developer, by month. ↓ means getting faster. Use to spot persistent slowdowns (blocked? complex domain?) — not for ranking people.</Text>
 </div>
 </Stack>
 </Accordion.Panel>
 </Accordion.Item>
 </Accordion>
 </Stack>
 );
}
