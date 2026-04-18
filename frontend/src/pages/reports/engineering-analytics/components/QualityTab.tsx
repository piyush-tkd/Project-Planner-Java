import { useState } from 'react';
import {
 Stack, Group, Paper, Badge, Select, Loader, Table, Alert, SimpleGrid,
 ScrollArea, Accordion, Text, Pagination, Divider,
} from '@mantine/core';
import { IconAlertCircle, IconShieldCheck } from '@tabler/icons-react';
import SprintQualityPage from '../../SprintQualityPage';
import { useQuery } from '@tanstack/react-query';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid,
 Tooltip as RechartTooltip, ResponsiveContainer,
} from 'recharts';
import apiClient from '../../../../api/client';
import { AQUA_HEX } from '../../../../brandTokens';
import { MetricCard } from './MetricCard';
import { AssigneeCell } from './AssigneeCell';
import { jiraLink, statusBadge, fmt1, fmt0, fmtDate } from '../utils';

export function QualityTab({ projectKey, days, avatars }: { projectKey: string | null; days: number; avatars: Record<string, string> }) {
 const [reopenAssigneeFilter, setReopenAssigneeFilter] = useState<string | null>(null);
 const [bugClusterPage, setBugClusterPage] = useState(1);
 const BUG_CLUSTER_PAGE_SIZE = 20;
 const [ftpFilter] = useState<string>('ALL');
 const [reworkPage, setReworkPage] = useState(1);
 const [reworkLoopsFilter, setReworkLoopsFilter] = useState<string>('1');
 const REWORK_PAGE_SIZE = 10;

 const { data: flowEff, isLoading: flowLoading } = useQuery({
 queryKey: ['eng-analytics', 'quality', 'flow-efficiency', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/quality/flow-efficiency', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: reopen, isLoading: reopenLoading } = useQuery({
 queryKey: ['eng-analytics', 'quality', 'reopen-rate', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/quality/reopen-rate', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: bugCluster, isLoading: bugLoading } = useQuery({
 queryKey: ['eng-analytics', 'quality', 'bug-clustering', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/quality/bug-clustering', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: ftp, isLoading: ftpLoading } = useQuery({
 queryKey: ['eng-analytics', 'quality', 'first-time-pass-rate', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/quality/first-time-pass-rate', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: bugResTime, isLoading: resLoading } = useQuery({
 queryKey: ['eng-analytics', 'quality', 'bug-resolution-time', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/quality/bug-resolution-time', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: rework, isLoading: reworkLoading } = useQuery({
 queryKey: ['eng-analytics', 'quality', 'rework-loops', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/quality/rework-loops', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 if (flowLoading || reopenLoading || bugLoading || ftpLoading || resLoading || reworkLoading) {
 return <Loader />;
 }

 // Cap at 100% — data anomalies can inflate this if transitions are incomplete
 const flowEffPct = Math.min(100, Math.max(0, flowEff?.avg_flow_efficiency_pct ?? 0));
 const reopenPct = reopen?.reopen_rate_pct ?? 0;
 const ftpPct = ftp?.first_time_pass_rate_pct ?? 0;
 const reworkAvg = rework?.avg_loops ?? 0;

 return (
 <Stack gap="lg">
 <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg" pb="xl">
 <MetricCard
 title="Flow Efficiency"
 description="% of time spent actively working (vs waiting)"
 insight={`${flowEffPct < 30 ? 'LOW: Excessive wait time detected' : 'GOOD: Team is flowing well'}`}
 >
 <Group gap="sm">
 <Text fw={700} size="xl">{flowEffPct.toFixed(1)}%</Text>
 <Badge color={flowEffPct > 50 ? 'green' : 'red'}>
 {statusBadge(flowEffPct).label}
 </Badge>
 </Group>
 </MetricCard>

 <MetricCard
 title="Re-open Rate"
 description="% of resolved issues that reopened"
 insight={`${reopenPct > 20 ? 'ALERT: High reopen rate suggests quality issues' : 'HEALTHY: Low reopen rate'}`}
 >
 <Group gap="sm">
 <Text fw={700} size="xl">{fmt1(reopenPct)}%</Text>
 <Badge color={reopenPct < 15 ? 'green' : reopenPct < 25 ? 'yellow' : 'red'}>
 {reopenPct < 15 ? 'GOOD' : reopenPct < 25 ? 'CAUTION' : 'ALERT'}
 </Badge>
 </Group>
 </MetricCard>

 <MetricCard
 title="First-Time Pass Rate"
 description="% of issues resolved on first attempt"
 >
 <Group gap="sm">
 <Text fw={700} size="xl">{fmt1(ftpPct)}%</Text>
 <Badge color={ftpPct > 70 ? 'green' : 'yellow'}>
 {ftpPct > 70 ? 'STRONG' : 'IMPROVING'}
 </Badge>
 </Group>
 </MetricCard>
 </SimpleGrid>

 {reopen?.reopened_issues && reopen.reopened_issues.length > 0 && (
 <MetricCard
 title="Re-opened Issues"
 description="Issues sent back to development after completion"
 >
 <Group gap="sm" mb="md">
 <Select
 label="Filter by Assignee"
 placeholder="All assignees"
 data={(reopen.by_assignee ? Object.keys(reopen.by_assignee) : []).map((a: string) => ({ value: a, label: a }))}
 value={reopenAssigneeFilter}
 onChange={setReopenAssigneeFilter}
 searchable
 clearable
 />
 </Group>
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Issue</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th>Assignee</Table.Th>
 <Table.Th ta="right">Reopen Count</Table.Th>
 <Table.Th>Last Reopened</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(reopen.reopened_issues ?? [])
 .filter((issue: any) => !reopenAssigneeFilter || issue.assignee_display_name === reopenAssigneeFilter)
 .slice(0, 10)
 .map((issue: any) => (
 <Table.Tr key={issue.issue_key}>
 <Table.Td>
 <Text component="a" href={jiraLink(issue.issue_key)} target="_blank"
 size="xs" ff="monospace" c="blue" td="underline">
 {issue.issue_key}
 </Text>
 </Table.Td>
 <Table.Td><Text size="xs" lineClamp={1}>{issue.summary}</Text></Table.Td>
 <Table.Td><AssigneeCell name={issue.assignee_display_name} avatars={avatars} /></Table.Td>
 <Table.Td ta="right"><Badge size="sm" color="orange">{issue.reopen_count}</Badge></Table.Td>
 <Table.Td><Text size="xs">{fmtDate(issue.last_reopen)}</Text></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </MetricCard>
 )}

 <MetricCard
 title="Bug Clustering (by Epic)"
 description="Which epics/areas generate the most bugs"
 >
 {bugCluster?.by_epic && bugCluster.by_epic.length > 0 ? (
 <>
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Epic</Table.Th>
 <Table.Th ta="right">Total Bugs</Table.Th>
 <Table.Th ta="right">Open</Table.Th>
 <Table.Th ta="right">Avg Priority</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(bugCluster.by_epic ?? [])
 .slice((bugClusterPage - 1) * BUG_CLUSTER_PAGE_SIZE, bugClusterPage * BUG_CLUSTER_PAGE_SIZE)
 .map((row: any) => (
 <Table.Tr key={row.epic_key}>
 <Table.Td>
 <Group gap={6}>
 <Text component="a" href={jiraLink(row.epic_key)} target="_blank"
 size="xs" ff="monospace" c="blue" td="underline">
 {row.epic_key}
 </Text>
 <Text size="xs" c="dimmed">{row.epic_name}</Text>
 </Group>
 </Table.Td>
 <Table.Td ta="right" fw={600}>{row.bug_count}</Table.Td>
 <Table.Td ta="right">{row.open_bugs}</Table.Td>
 <Table.Td ta="right"><Badge size="sm">{fmt1(row.avg_priority_score)}</Badge></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 {(bugCluster.by_epic ?? []).length > BUG_CLUSTER_PAGE_SIZE && (
 <Group justify="center" mt="md">
 <Pagination
 value={bugClusterPage}
 onChange={setBugClusterPage}
 total={Math.ceil((bugCluster.by_epic ?? []).length / BUG_CLUSTER_PAGE_SIZE)}
 />
 </Group>
 )}
 </>
 ) : (
 <Alert icon={<IconAlertCircle size={14} />} color="gray">
 No data available
 </Alert>
 )}
 </MetricCard>

 <MetricCard
 title="Bug Clustering (by Project)"
 description="Distribution of bugs across projects"
 >
 {bugCluster?.by_project ? (
 <div role="img" aria-label="Bar chart">
 <ResponsiveContainer width="100%" height={250}>
 <BarChart data={bugCluster.by_project}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="project_key" />
 <YAxis />
 <RechartTooltip />
 <Bar dataKey="bug_count" fill={AQUA_HEX} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 ) : (
 <Alert icon={<IconAlertCircle size={14} />} color="gray">
 No data available
 </Alert>
 )}
 </MetricCard>

 {ftp?.by_assignee && ftp.by_assignee.length > 0 && (
 <MetricCard
 title="First-Time Pass Rate (by Assignee)"
 description="% of stories passed on first QA attempt"
 >
 <Group gap="sm" mb="md">
 {/* Segmented control omitted here to keep component focused */}
 </Group>
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Assignee</Table.Th>
 <Table.Th ta="right">Total</Table.Th>
 <Table.Th ta="right">Passed</Table.Th>
 <Table.Th ta="right">Failed</Table.Th>
 <Table.Th ta="right">Pass Rate</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(ftp.by_assignee ?? [])
 .filter((row: any) => {
 if (ftpFilter === 'PASSED') return row.pass_rate_pct >= 100;
 if (ftpFilter === 'FAILED') return row.pass_rate_pct < 100;
 return true;
 })
 .map((row: any) => {
 const failed = (row.total ?? 0) - (row.passed ?? 0);
 return (
 <Table.Tr key={row.assignee}>
 <Table.Td><AssigneeCell name={row.assignee} avatars={avatars} /></Table.Td>
 <Table.Td ta="right">{row.total}</Table.Td>
 <Table.Td ta="right"><Badge size="sm" color="green">{row.passed}</Badge></Table.Td>
 <Table.Td ta="right"><Badge size="sm" color="red">{failed}</Badge></Table.Td>
 <Table.Td ta="right">
 <Badge color={row.pass_rate_pct >= 80 ? 'green' : row.pass_rate_pct >= 60 ? 'yellow' : 'red'}>
 {fmt1(row.pass_rate_pct)}%
 </Badge>
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </MetricCard>
 )}

 <MetricCard
 title="Bug Resolution Time"
 description="Average hours to resolve bugs by priority"
 >
 {bugResTime?.by_priority ? (
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Priority</Table.Th>
 <Table.Th>Count</Table.Th>
 <Table.Th>Avg Hours</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {bugResTime.by_priority
 .sort((a: any, b: any) => {
 const priorityOrder = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
 return priorityOrder.indexOf(a.priority_name) - priorityOrder.indexOf(b.priority_name);
 })
 .map((row: any) => (
 <Table.Tr key={row.priority_name}>
 <Table.Td>
 <Badge size="sm" color={
 row.priority_name === 'Highest' ? 'red' :
 row.priority_name === 'High' ? 'orange' :
 row.priority_name === 'Medium' ? 'blue' : 'gray'
 }>
 {row.priority_name}
 </Badge>
 </Table.Td>
 <Table.Td>{row.bug_count}</Table.Td>
 <Table.Td fw={600} style={{ fontSize: '13px' }}>{fmt0(row.avg_resolution_hours)}</Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 ) : (
 <Alert icon={<IconAlertCircle size={14} />} color="gray">
 No data available
 </Alert>
 )}
 </MetricCard>

 <MetricCard
 title="Rework Loops"
 description="Stories that bounced between statuses"
 >
 <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mb="md">
 <Paper withBorder radius="md" p="lg">
 <Stack gap="xs">
 <Text size="xs" c="dimmed">Total Rework Issues</Text>
 <Text fw={700} size="xl">{rework?.total_rework_issues ?? 0}</Text>
 </Stack>
 </Paper>
 <Paper withBorder radius="md" p="lg">
 <Stack gap="xs">
 <Text size="xs" c="dimmed">Avg Loops Per Issue</Text>
 <Group gap="sm">
 <Text fw={700} size="xl">{fmt1(reworkAvg)}</Text>
 <Badge color={reworkAvg < 1.5 ? 'green' : 'yellow'}>
 {reworkAvg < 1.5 ? 'STABLE' : 'WATCH'}
 </Badge>
 </Group>
 </Stack>
 </Paper>
 </SimpleGrid>
 {rework?.issues_with_rework && rework.issues_with_rework.length > 0 ? (
 <>
 <Group gap="sm" mb="md">
 <Select
 label="Min Loops"
 placeholder="1+"
 data={[
 { value: '1', label: '1+' },
 { value: '2', label: '2+' },
 { value: '3', label: '3+' },
 ]}
 value={reworkLoopsFilter}
 onChange={(val) => {
 setReworkLoopsFilter(val ?? '1');
 setReworkPage(1);
 }}
 w={120}
 />
 </Group>
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Issue</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th ta="right">Loops</Table.Th>
 <Table.Th>Assignee</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(rework.issues_with_rework ?? [])
 .filter((s: any) => s.loop_count >= parseInt(reworkLoopsFilter))
 .slice((reworkPage - 1) * REWORK_PAGE_SIZE, reworkPage * REWORK_PAGE_SIZE)
 .map((s: any) => (
 <Table.Tr key={s.issue_key}>
 <Table.Td>
 <Text component="a" href={jiraLink(s.issue_key)} target="_blank"
 size="xs" ff="monospace" c="blue" td="underline">
 {s.issue_key}
 </Text>
 </Table.Td>
 <Table.Td><Text size="xs" lineClamp={1}>{s.summary}</Text></Table.Td>
 <Table.Td ta="right"><Badge color={s.loop_count >= 3 ? 'red' : s.loop_count >= 2 ? 'orange' : 'gray'}>{s.loop_count}</Badge></Table.Td>
 <Table.Td><AssigneeCell name={s.assignee || s.assignee_display_name} avatars={avatars} /></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 {((rework.issues_with_rework ?? []).filter((s: any) => s.loop_count >= parseInt(reworkLoopsFilter)).length) > REWORK_PAGE_SIZE && (
 <Group justify="center" mt="md">
 <Pagination
 value={reworkPage}
 onChange={setReworkPage}
 total={Math.ceil((rework.issues_with_rework ?? []).filter((s: any) => s.loop_count >= parseInt(reworkLoopsFilter)).length / REWORK_PAGE_SIZE)}
 />
 </Group>
 )}
 </>
 ) : (
 <Alert icon={<IconAlertCircle size={14} />} color="gray">
 No rework issues found
 </Alert>
 )}
 </MetricCard>

 <Accordion>
 <Accordion.Item value="glossary">
 <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
 <Accordion.Panel>
 <Stack gap="sm" style={{ fontSize: '14px' }}>
 <div>
 <Text fw={600} size="sm">Flow Efficiency</Text>
 <Text size="xs" c="dimmed">Active time (In Dev + QA In Progress) ÷ Total lead time. Low = too much waiting, not a people problem</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Re-open Rate</Text>
 <Text size="xs" c="dimmed">% of completed issues sent back to development. &gt;20% = definition-of-done problem</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Bug Clustering</Text>
 <Text size="xs" c="dimmed">Which epics/areas generate the most bugs. Reveals code quality hot zones</Text>
 </div>
 <div>
 <Text fw={600} size="sm">First-Time Pass Rate</Text>
 <Text size="xs" c="dimmed">Stories going straight through QA without rework. High = good requirements + dev quality</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Bug Resolution Time</Text>
 <Text size="xs" c="dimmed">Average hours from bug creation to resolution, by priority</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Rework Loops</Text>
 <Text size="xs" c="dimmed"># of times a story bounced between Dev and QA. &gt;2 loops = unclear requirements</Text>
 </div>
 </Stack>
 </Accordion.Panel>
 </Accordion.Item>
 </Accordion>

 {/* ── Sprint Quality ─────────────────────────────────────────────────── */}
 <Divider
 label={
 <Group gap="xs">
 <IconShieldCheck size={14} />
 <Text size="sm" fw={600}>Sprint Quality</Text>
 <Text size="xs" c="dimmed">Defect density · Cycle time · Predictability · Bug Escape Rate</Text>
 </Group>
 }
 labelPosition="left"
 my="sm"
 />
 <SprintQualityPage />

 </Stack>
 );
}
