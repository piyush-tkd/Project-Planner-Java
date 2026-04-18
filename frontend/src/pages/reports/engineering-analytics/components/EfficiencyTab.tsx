import { useState } from 'react';
import {
 Stack, Group, Text, Badge, Select, Loader, Table, Alert, ScrollArea, Accordion, Pagination,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import { MetricCard } from './MetricCard';
import { AssigneeCell } from './AssigneeCell';
import { jiraLink, fmt1, fmt0 } from '../utils';

export function EfficiencyTab({ projectKey, days }: { projectKey: string | null; days: number; avatars: Record<string, string> }) {
 const [agingPage, setAgingPage] = useState(1);
 const AGING_PAGE_SIZE = 15;
 const [agingAgeFilter, setAgingAgeFilter] = useState<string>('ALL');
 const [agingProjectFilter, setAgingProjectFilter] = useState<string | null>(null);
 const [ctxPage, setCtxPage] = useState(1);
 const CTX_PAGE_SIZE = 15;
 const [ctxMinFilter, setCtxMinFilter] = useState<string>('2');

 const { data: agingWip, isLoading: agingLoading } = useQuery({
 queryKey: ['eng-analytics', 'efficiency', 'aging-wip', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/efficiency/aging-wip', {
 params: { projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: queueTime, isLoading: queueLoading } = useQuery({
 queryKey: ['eng-analytics', 'efficiency', 'queue-time', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/efficiency/queue-time', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: batchSize, isLoading: batchLoading } = useQuery({
 queryKey: ['eng-analytics', 'efficiency', 'batch-size-vs-cycle-time', projectKey, days],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/efficiency/batch-size-vs-cycle-time', {
 params: { days, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 const { data: ctxSwitch, isLoading: ctxLoading } = useQuery({
 queryKey: ['eng-analytics', 'efficiency', 'context-switching', projectKey],
 queryFn: async () => {
 const res = await apiClient.get('/engineering-analytics/efficiency/context-switching', {
 params: { sprints: 5, projectKey: projectKey || undefined },
 });
 return res.data;
 },
 enabled: !!projectKey || projectKey === null,
 });

 if (agingLoading || queueLoading || batchLoading || ctxLoading) return <Loader />;

 const avgQueueHrs = queueTime?.avg_dev_to_qa_hours ?? 0;
 const queueInsight = queueTime?.insight || '';

 return (
 <Stack gap="lg">
 <MetricCard
 title="Queue Time (Dev → QA)"
 description="Time an issue waits in 'Ready for Testing' before QA picks it up. Measures handoff efficiency, not people speed."
 insight={queueInsight}
 >
 {!queueTime?.data_available ? (
 <Alert color="orange" title="No transition data yet">
 Click <b>Backfill History</b> at the top of this page to load historical Jira transition data.
 Queue time requires changelog data from Jira.
 {queueTime?.actual_statuses_in_db?.length > 0 && (
 <Text size="xs" mt="xs">
 Statuses found in DB: {queueTime.actual_statuses_in_db.map((s: any) => s.status).join(', ')}
 </Text>
 )}
 </Alert>
 ) : (
 <Group gap="sm">
 <Text fw={700} size="xl">{fmt1(avgQueueHrs)} hrs</Text>
 <Badge color={avgQueueHrs < 4 ? 'green' : avgQueueHrs < 8 ? 'yellow' : 'red'}>
 {avgQueueHrs < 4 ? 'FAST' : avgQueueHrs < 8 ? 'WATCH' : 'BOTTLENECK'}
 </Badge>
 <Text size="xs" c="dimmed">avg wait before QA starts</Text>
 </Group>
 )}
 {queueTime?.dev_to_qa_queue && queueTime.dev_to_qa_queue.length > 0 && (
 <Group mt="md">
 <Text size="sm" fw={600}>Top items in queue:</Text>
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Issue</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th ta="right">Queue Hours</Table.Th>
 <Table.Th>Assignee</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(queueTime.dev_to_qa_queue ?? []).slice(0, 5).map((item: any) => (
 <Table.Tr key={item.issue_key}>
 <Table.Td>
 <Text component="a" href={jiraLink(item.issue_key)} target="_blank"
 size="xs" ff="monospace" c="blue" td="underline">
 {item.issue_key}
 </Text>
 </Table.Td>
 <Table.Td><Text size="xs" lineClamp={1}>{item.summary}</Text></Table.Td>
 <Table.Td ta="right" style={{ fontSize: '13px' }}>{fmt0(item.queue_hours)}</Table.Td>
 <Table.Td><AssigneeCell name={item.assignee_display_name} /></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Group>
 )}
 </MetricCard>

 {agingWip?.wip_items && (
 <MetricCard
 title="Aging WIP"
 description="Issues currently in progress, colour-coded by how long they've been stuck"
 >
 <Group gap="sm" mb="md">
 <Group gap="sm">
 {Object.entries(agingWip.by_age_color ?? {}).map(([color, count]: [string, any]) => (
 <Badge key={color} size="lg" color={color === 'RED' ? 'red' : color === 'YELLOW' ? 'yellow' : 'green'}>
 {color}: {count}
 </Badge>
 ))}
 </Group>
 <Text size="xs" c="dimmed">Total WIP: {agingWip.total_wip}</Text>
 </Group>

 <Group gap="md" mb="md">
 <Select
 label="Filter by Status"
 placeholder="All"
 data={[
 { value: 'ALL', label: 'All' },
 { value: 'RED', label: '🔴 Red — stuck >14 days' },
 { value: 'YELLOW', label: '🟡 Yellow — stuck 7-14 days' },
 { value: 'GREEN', label: '🟢 Green — stuck <7 days' },
 ]}
 value={agingAgeFilter}
 onChange={(val) => {
 setAgingAgeFilter(val ?? 'ALL');
 setAgingPage(1);
 }}
 searchable
 clearable
 />
 {agingWip?.wip_items && (
 <Select
 label="Filter by Project"
 placeholder="All projects"
 data={Array.from(new Set((agingWip.wip_items ?? []).map((item: any) => item.project_key)))
 .map((p: any) => ({ value: p, label: p }))}
 value={agingProjectFilter}
 onChange={(val) => {
 setAgingProjectFilter(val);
 setAgingPage(1);
 }}
 searchable
 clearable
 />
 )}
 </Group>

 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Issue</Table.Th>
 <Table.Th>Summary</Table.Th>
 <Table.Th>Status</Table.Th>
 <Table.Th ta="right">Days Stuck</Table.Th>
 <Table.Th>Assignee</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {((agingWip.wip_items ?? [])
 .filter((item: any) => {
 if (agingAgeFilter !== 'ALL' && item.age_status !== agingAgeFilter) return false;
 if (agingProjectFilter && item.project_key !== agingProjectFilter) return false;
 return true;
 })
 .slice((agingPage - 1) * AGING_PAGE_SIZE, agingPage * AGING_PAGE_SIZE)
 ).map((item: any) => (
 <Table.Tr key={item.issue_key}>
 <Table.Td>
 <Text component="a" href={jiraLink(item.issue_key)} target="_blank"
 size="xs" ff="monospace" c="blue" td="underline">
 {item.issue_key}
 </Text>
 </Table.Td>
 <Table.Td><Text size="xs" lineClamp={1}>{item.summary}</Text></Table.Td>
 <Table.Td><Text size="xs">{item.status_name}</Text></Table.Td>
 <Table.Td ta="right">
 <Badge color={item.age_status === 'RED' ? 'red' : item.age_status === 'YELLOW' ? 'yellow' : 'green'} size="sm">
 {item.days_in_current_status}d
 </Badge>
 </Table.Td>
 <Table.Td><AssigneeCell name={item.assignee_display_name} /></Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>

 <Group justify="center" mt="md">
 <Pagination
 value={agingPage}
 onChange={setAgingPage}
 total={Math.ceil(((agingWip.wip_items ?? [])
 .filter((item: any) => {
 if (agingAgeFilter !== 'ALL' && item.age_status !== agingAgeFilter) return false;
 if (agingProjectFilter && item.project_key !== agingProjectFilter) return false;
 return true;
 }).length) / AGING_PAGE_SIZE)}
 />
 </Group>
 </MetricCard>
 )}

 {batchSize?.avg_cycle_by_sp_bucket && (
 <MetricCard
 title="Batch Size vs Cycle Time"
 description="Correlation between story size and completion time"
 >
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Story Points Bucket</Table.Th>
 <Table.Th ta="right">Count</Table.Th>
 <Table.Th ta="right">Avg Cycle Days</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(() => {
 const bucketOrder = ['1 SP', '2-3 SP', '4-5 SP', '6+ SP'];
 const bucketsData = Object.entries(batchSize.avg_cycle_by_sp_bucket ?? {}).map(([bucket, avgCycle]: [string, any]) => ({
 bucket,
 avgCycle,
 }));
 const countByBucket = (batchSize.data ?? []).reduce((acc: any, issue: any) => {
 const sp = issue.story_points ?? 0;
 let bucket = '1 SP';
 if (sp >= 6) bucket = '6+ SP';
 else if (sp >= 4) bucket = '4-5 SP';
 else if (sp >= 2) bucket = '2-3 SP';
 acc[bucket] = (acc[bucket] || 0) + 1;
 return acc;
 }, {});
 return bucketOrder.map((bucket) => {
 const data = bucketsData.find(d => d.bucket === bucket || d.bucket.includes(bucket.split(' ')[0]));
 return (
 <Table.Tr key={bucket}>
 <Table.Td fw={500}>{bucket}</Table.Td>
 <Table.Td ta="right">{countByBucket[bucket] ?? 0}</Table.Td>
 <Table.Td ta="right">{data ? fmt1(data.avgCycle) : '—'}</Table.Td>
 </Table.Tr>
 );
 });
 })()}
 </Table.Tbody>
 </Table>
 </ScrollArea>

 {batchSize?.data && batchSize.data.length > 0 && (
 <>
 <Text size="sm" fw={600} mt="lg" mb={2}>Slowest Completed Issues</Text>
 <Text size="xs" c="dimmed" mb="xs">
   Completed stories/tasks ranked by how long they took from first "In Dev" transition to "Done".
   These are your drag — investigate what caused the delay.
 </Text>
 <ScrollArea>
 <Table striped highlightOnHover style={{ tableLayout: 'fixed', width: '100%' }}>
   <colgroup>
     <col style={{ width: 100 }} /> {/* Issue key */}
     <col />                        {/* Summary — fills remaining space */}
     <col style={{ width: 50 }} />  {/* SP */}
     <col style={{ width: 100 }} /> {/* Cycle Days */}
     <col style={{ width: 160 }} /> {/* Assignee */}
   </colgroup>
   <Table.Thead>
     <Table.Tr>
       <Table.Th>Issue</Table.Th>
       <Table.Th>Summary</Table.Th>
       <Table.Th ta="right">SP</Table.Th>
       <Table.Th ta="right">Cycle Days</Table.Th>
       <Table.Th>Assignee</Table.Th>
     </Table.Tr>
   </Table.Thead>
   <Table.Tbody>
     {(batchSize.data ?? [])
       .sort((a: any, b: any) => (b.cycle_hours ?? 0) - (a.cycle_hours ?? 0))
       .slice(0, 20)
       .map((issue: any) => (
         <Table.Tr key={issue.issue_key}>
           <Table.Td>
             <Text component="a" href={jiraLink(issue.issue_key)} target="_blank"
               size="xs" ff="monospace" c="blue" td="underline" style={{ whiteSpace: 'nowrap' }}>
               {issue.issue_key}
             </Text>
           </Table.Td>
           <Table.Td style={{ overflow: 'hidden' }}>
             <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
               {issue.summary || '—'}
             </Text>
           </Table.Td>
           <Table.Td ta="right">
             <Text size="xs">{issue.story_points != null ? issue.story_points : '—'}</Text>
           </Table.Td>
           <Table.Td ta="right">
             <Text size="xs" fw={600} c={issue.cycle_hours > 240 ? 'red' : issue.cycle_hours > 120 ? 'orange' : 'dimmed'}>
               {issue.cycle_hours != null ? `${fmt1(issue.cycle_hours / 24)}d` : '—'}
             </Text>
           </Table.Td>
           <Table.Td style={{ overflow: 'hidden' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
               {issue.assignee_avatar_url ? (
                 <img src={issue.assignee_avatar_url} alt={issue.assignee ?? ''}
                   style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
               ) : issue.assignee ? (
                 <div style={{
                   width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                   background: 'var(--mantine-color-blue-2)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   fontSize: 9, fontWeight: 700, color: 'var(--mantine-color-blue-7)',
                 }}>
                   {issue.assignee.charAt(0).toUpperCase()}
                 </div>
               ) : null}
               <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                 {issue.assignee || '—'}
               </Text>
             </div>
           </Table.Td>
         </Table.Tr>
       ))}
   </Table.Tbody>
 </Table>
 </ScrollArea>
 </>
 )}
 </MetricCard>
 )}

 {ctxSwitch?.data && ctxSwitch.data.length > 0 ? (
 <MetricCard
 title="Context Switching"
 description="Number of task switches per developer (last 5 sprints)"
 >
 <Group gap="sm" mb="md">
 <Select
 label="Min Contexts"
 placeholder="2+"
 data={[
 { value: '2', label: '2+' },
 { value: '3', label: '3+' },
 { value: '4', label: '4+' },
 ]}
 value={ctxMinFilter}
 onChange={(val) => {
 setCtxMinFilter(val ?? '2');
 setCtxPage(1);
 }}
 w={120}
 />
 </Group>
 <ScrollArea>
 <Table striped highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Developer</Table.Th>
 <Table.Th>Sprint</Table.Th>
 <Table.Th ta="right">Total Issues</Table.Th>
 <Table.Th ta="right">Epics (Contexts)</Table.Th>
 <Table.Th ta="right">Projects</Table.Th>
 <Table.Th ta="right">Completion Rate</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {(ctxSwitch.data ?? [])
 .filter((dev: any) => (dev.contexts ?? 0) >= parseInt(ctxMinFilter))
 .sort((a: any, b: any) => (b.contexts ?? 0) - (a.contexts ?? 0))
 .slice((ctxPage - 1) * CTX_PAGE_SIZE, ctxPage * CTX_PAGE_SIZE)
 .map((dev: any) => {
 const completionRate = dev.total_issues ? ((dev.completed ?? 0) / dev.total_issues * 100) : 0;
 return (
 <Table.Tr key={`${dev.assignee}-${dev.sprint_name}`}>
 <Table.Td fw={500}><AssigneeCell name={dev.assignee} /></Table.Td>
 <Table.Td><Text size="xs">{dev.sprint_name || '—'}</Text></Table.Td>
 <Table.Td ta="right">{dev.total_issues ?? 0}</Table.Td>
 <Table.Td ta="right">
 <Badge color={dev.contexts >= 4 ? 'red' : dev.contexts >= 3 ? 'orange' : 'gray'}>
 {dev.contexts ?? 0}
 </Badge>
 </Table.Td>
 <Table.Td ta="right"><Text size="xs">{dev.projects ?? 0}</Text></Table.Td>
 <Table.Td ta="right"><Text size="xs">{fmt0(completionRate)}%</Text></Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 {((ctxSwitch.data ?? []).filter((dev: any) => (dev.contexts ?? 0) >= parseInt(ctxMinFilter)).length) > CTX_PAGE_SIZE && (
 <Group justify="center" mt="md">
 <Pagination
 value={ctxPage}
 onChange={setCtxPage}
 total={Math.ceil(((ctxSwitch.data ?? []).filter((dev: any) => (dev.contexts ?? 0) >= parseInt(ctxMinFilter)).length) / CTX_PAGE_SIZE)}
 />
 </Group>
 )}
 </MetricCard>
 ) : (
 <MetricCard
 title="Context Switching"
 description="Number of task switches per developer (last 5 sprints)"
 >
 <Alert icon={<IconAlertCircle size={14} />} color="gray">
 No closed sprints found. Check back once sprints complete.
 </Alert>
 </MetricCard>
 )}

 <Accordion>
 <Accordion.Item value="glossary">
 <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
 <Accordion.Panel>
 <Stack gap="sm" style={{ fontSize: '14px' }}>
 <div>
 <Text fw={600} size="sm">Aging WIP</Text>
 <Text size="xs" c="dimmed">Issues stuck in a status too long. Green=&lt;7d, Yellow=7-14d, Red=&gt;14d. Indicates silent blockers</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Queue Time</Text>
 <Text size="xs" c="dimmed">Wait time between stages. Long queues = process bottleneck, not people problem</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Batch Size vs Cycle Time</Text>
 <Text size="xs" c="dimmed">Smaller stories typically complete faster. Use to encourage story decomposition</Text>
 </div>
 <div>
 <Text fw={600} size="sm">Context Switching</Text>
 <Text size="xs" c="dimmed"># of different epics per developer per sprint. &gt;3 epics = productivity loss from context switching</Text>
 </div>
 </Stack>
 </Accordion.Panel>
 </Accordion.Item>
 </Accordion>
 </Stack>
 );
}
