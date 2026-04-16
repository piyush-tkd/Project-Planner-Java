import { useState, useMemo, useEffect } from 'react';
import {
  Title, Text, Stack, Group, Paper, Badge, Select, Loader, Tabs, Table, Progress,
  Alert, ThemeIcon, SimpleGrid, Box, Tooltip, ScrollArea, Card, Kbd, Accordion, Avatar, Pagination, Button,
  SegmentedControl, NumberInput,
} from '@mantine/core';
import {
  IconBug, IconTrendingUp, IconClock, IconTarget, IconChartBar, IconAlertCircle,
  IconCheck, IconX, IconCloudDownload,
} from '@tabler/icons-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import apiClient from '../../api/client';
import { AQUA_HEX, AQUA, FONT_FAMILY, COLOR_ERROR, COLOR_GREEN, COLOR_WARNING,
  DEEP_BLUE_TINTS, CHART_COLORS, SHADOW, TEXT_SUBTLE } from '../../brandTokens';

/* ── Types ───────────────────────────────────────────────────────────────── */
type TabType = 'quality' | 'productivity' | 'efficiency' | 'tracking' | 'forecasting';

interface ProjectOption {
  value: string;
  label: string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const JIRA_BASE = 'https://baylorgenetics.atlassian.net';
function jiraLink(issueKey: string) {
  return `${JIRA_BASE}/browse/${issueKey}`;
}

// Global avatar map — fetched once and shared across all tab components
let _avatarCache: Record<string, string> | null = null;
async function getAvatarMap(): Promise<Record<string, string>> {
  if (_avatarCache) return _avatarCache;
  try {
    const { default: apiClient } = await import('../../api/client');
    const res = await apiClient.get('/engineering-analytics/assignee-avatars');
    _avatarCache = res.data ?? {};
    return _avatarCache!;
  } catch { return {}; }
}

// Hook to load avatar map once
function useAvatarMap() {
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  useEffect(() => { getAvatarMap().then(setAvatars); }, []);
  return avatars;
}

function statusBadge(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'HEALTHY', color: 'green' };
  if (pct >= 50) return { label: 'CAUTION', color: 'yellow' };
  return { label: 'LOW', color: 'red' };
}

function fmt1(n: number): string {
  return typeof n === 'number' ? n.toFixed(1) : '—';
}

function fmt0(n: number): string {
  return typeof n === 'number' ? n.toFixed(0) : '—';
}

function fmtDate(val: any): string {
  if (!val) return '—';
  const s = String(val);
  // Extract just the date part YYYY-MM-DD
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return s.slice(0, 10);
  const [year, month, day] = m[1].split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(month)-1]} ${parseInt(day)}, ${year}`;
}

function AssigneeCell({ name, avatars }: { name: string | null; avatars?: Record<string, string> }) {
  if (!name) return <Text size="xs" c="dimmed">Unassigned</Text>;
  const avatarUrl = avatars?.[name];
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['blue', 'teal', 'violet', 'orange', 'green', 'pink', 'cyan'];
  const colorIdx = name.charCodeAt(0) % colors.length;
  return (
    <Group gap={6} wrap="nowrap">
      {avatarUrl
        ? <Avatar size={22} radius="xl" src={avatarUrl} alt={name} />
        : <Avatar size={22} radius="xl" color={colors[colorIdx]}>{initials}</Avatar>
      }
      <Text size="xs" lineClamp={1}>{name}</Text>
    </Group>
  );
}

/* ── Metric Card Component ───────────────────────────────────────────────── */
function MetricCard({
  title, description, children, insight,
}: {
  title: string; description: string; children: React.ReactNode; insight?: string;
}) {
  return (
    <Paper withBorder radius="md" p="lg" style={{ boxShadow: SHADOW.card }}>
      <Stack gap="sm">
        <div>
          <Text fw={700} size="md">{title}</Text>
          <Text size="xs" c="dimmed">{description}</Text>
        </div>
        {children}
        {insight && (
          <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
            {insight}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

/* ── Quality Tab ──────────────────────────────────────────────────────────── */
function QualityTab({ projectKey, days, avatars }: { projectKey: string | null; days: number; avatars: Record<string, string> }) {
  const [reopenAssigneeFilter, setReopenAssigneeFilter] = useState<string | null>(null);
  const [bugClusterPage, setBugClusterPage] = useState(1);
  const BUG_CLUSTER_PAGE_SIZE = 20;
  const [ftpFilter, setFtpFilter] = useState<string>('ALL');
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
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bugCluster.by_project}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="project_key" />
              <YAxis />
              <RechartTooltip />
              <Bar dataKey="bug_count" fill={AQUA_HEX} />
            </BarChart>
          </ResponsiveContainer>
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
            <SegmentedControl
              value={ftpFilter}
              onChange={setFtpFilter}
              data={[
                { value: 'ALL', label: 'All' },
                { value: 'PASSED', label: 'Passed Only' },
                { value: 'FAILED', label: 'Failed Only' },
              ]}
              size="xs"
            />
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
    </Stack>
  );
}

/* ── Throughput Grid sub-component ──────────────────────────────────────── */
function ThroughputGrid({ byPerson, avatars }: { byPerson: Record<string, any[]>; avatars: Record<string, string> }) {
  const [page, setPage] = useState(1);
  const PAGE = 15;
  const entries = Object.entries(byPerson ?? {});
  const paged   = entries.slice((page - 1) * PAGE, page * PAGE);

  return (
    <Stack gap={4}>
      <Group px={4} pb={4} style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <Box style={{ flex: 1 }}><Text size="xs" fw={600} c="dimmed">Developer</Text></Box>
        <Text size="xs" fw={600} c="dimmed" w={55} ta="center">Done</Text>
        <Text size="xs" fw={600} c="dimmed" w={45} ta="center">Avg</Text>
        <Text size="xs" fw={600} c="dimmed" w={52} ta="center">Rate</Text>
        <Text size="xs" fw={600} c="dimmed">← Sprints (newest →)</Text>
      </Group>

      {paged.map(([name, sprintList]: [string, any]) => {
        const arr    = Array.isArray(sprintList) ? sprintList : [];
        const done   = arr.reduce((s: number, sp: any) => s + (sp.issues_completed ?? 0), 0);
        const total  = arr.reduce((s: number, sp: any) => s + (sp.total_assigned   ?? sp.issues_completed ?? 0), 0);
        const avg    = arr.length ? done / arr.length : 0;
        const rate   = total > 0 ? Math.round(done / total * 100) : 0;
        const last   = arr[0]?.issues_completed ?? 0;
        const prev   = arr[1]?.issues_completed ?? 0;
        const trend  = arr.length > 1 ? (last > prev ? '↑' : last < prev ? '↓' : '→') : '';

        return (
          <Group key={name} px={4} py={2} gap={4} align="center" wrap="nowrap">
            <Box style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
                const t = sp.total_assigned   ?? d;
                const p = t > 0 ? d / t : 0;
                return (
                  <Tooltip key={i} label={`${(sp.sprint_name ?? '').slice(-14)}: ${d}/${t} done`} withArrow>
                    <Box style={{
                      width: 20, height: 20, borderRadius: 3, flexShrink: 0,
                      background: d===0 ? 'var(--mantine-color-dark-5)' : p>=0.9?'#16a34a':p>=0.6?'#d97706':'#dc2626',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default',
                    }}>
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

/* ── Productivity Tab ────────────────────────────────────────────────────── */
function ProductivityTab({ projectKey, avatars }: { projectKey: string | null; avatars: Record<string, string> }) {
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
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <MetricCard
          title="Estimation Accuracy"
          description="Avg accuracy: actual ÷ estimated × 100%"
          insight={`${estPct > 100 ? 'Under-estimated by avg ' + (estPct - 100).toFixed(0) + '%' : estPct < 100 ? 'Over-estimated by avg ' + (100 - estPct).toFixed(0) + '%' : 'Spot on'}`}
        >
          <Group gap="sm">
            <Text fw={700} size="xl">{fmt1(estPct)}%</Text>
            <Badge color={estPct >= 80 && estPct <= 120 ? 'green' : estPct < 80 ? 'blue' : 'orange'}>
              {estPct >= 80 && estPct <= 120 ? 'GOOD' : estPct < 80 ? 'OVER-ESTIMATED' : 'UNDER-ESTIMATED'}
            </Badge>
          </Group>
        </MetricCard>

        <MetricCard
          title="Throughput vs WIP"
          description="Weekly: issues completed vs work in progress. As WIP rises, throughput typically falls (Little's Law)"
          insight={wipChartData.length > 2
            ? (() => {
                const recent3 = wipChartData.slice(-3);
                const avgWip = recent3.reduce((s: number, r: any) => s + r.wip, 0) / 3;
                const avgTp  = recent3.reduce((s: number, r: any) => s + r.throughput, 0) / 3;
                return avgWip > 20 ? `HIGH WIP (avg ${avgWip.toFixed(0)}) may be limiting throughput (avg ${avgTp.toFixed(0)}/wk)`
                  : `WIP is healthy (avg ${avgWip.toFixed(0)}), throughput avg ${avgTp.toFixed(0)}/wk`;
              })()
            : undefined}
        >
          {wipLoading ? <Loader size="sm" /> : wipChartData.length === 0 ? (
            <Text size="xs" c="dimmed">No weekly data available yet.</Text>
          ) : (
            <Box h={180}>
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
      </SimpleGrid>

      <MetricCard
        title={`Individual Throughput${throughput?.total_people ? ` — ${throughput.total_people} people` : ''}`}
        description="Issues completed per person per sprint. Green box = mostly done, yellow = partial, red = low output. Spot drops (blocked?) or gaps without blame."
      >
        {!throughput?.by_person || Object.keys(throughput.by_person).length === 0 ? (
          <Alert color="blue">No sprint data found. Ensure closed/active sprints are synced for the selected project.</Alert>
        ) : (
          <ThroughputGrid byPerson={throughput.by_person} avatars={avatars} />
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
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

/* ── Efficiency Tab ──────────────────────────────────────────────────────── */
function EfficiencyTab({ projectKey, days, avatars }: { projectKey: string | null; days: number; avatars: Record<string, string> }) {
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
          <Box mt="md">
            <Text size="sm" fw={600} mb="xs">Top items in queue:</Text>
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
          </Box>
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
                { value: 'ALL',    label: 'All' },
                { value: 'RED',    label: '🔴 Red — stuck >14 days' },
                { value: 'YELLOW', label: '🟡 Yellow — stuck 7-14 days' },
                { value: 'GREEN',  label: '🟢 Green — stuck <7 days' },
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

                  // Count issues from batchSize.data array per bucket
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
              <Text size="sm" fw={600} mt="lg" mb="xs">All Issues (sorted by Story Points)</Text>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Issue</Table.Th>
                      <Table.Th ta="right">SP</Table.Th>
                      <Table.Th ta="right">Cycle Days</Table.Th>
                      <Table.Th>Assignee</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(batchSize.data ?? [])
                      .sort((a: any, b: any) => (b.story_points ?? 0) - (a.story_points ?? 0))
                      .slice(0, 20)
                      .map((issue: any) => (
                      <Table.Tr key={issue.issue_key}>
                        <Table.Td>
                          <Text component="a" href={jiraLink(issue.issue_key)} target="_blank"
                            size="xs" ff="monospace" c="blue" td="underline">
                            {issue.issue_key}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">{issue.story_points ?? 0}</Table.Td>
                        <Table.Td ta="right">{fmt1(issue.cycle_days)}</Table.Td>
                        <Table.Td><Text size="xs">{issue.assignee || '—'}</Text></Table.Td>
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

/* ── Tracking Tab ────────────────────────────────────────────────────────── */
function TrackingTab({ projectKey, avatars }: { projectKey: string | null; avatars: Record<string, string> }) {
  const [carryoverPage, setCarryoverPage] = useState(1);
  const CARRYOVER_PAGE_SIZE = 10;
  const [carryoverSprintsFilter, setCarryoverSprintsFilter] = useState<string>('3');
  const [epicPage, setEpicPage] = useState(1);
  const EPIC_PAGE_SIZE = 10;
  const [epicCompletionFilter, setEpicCompletionFilter] = useState<string>('ALL');
  const [releasePage, setReleasePage] = useState(1);
  const RELEASE_PAGE_SIZE = 10;
  const [releaseStatusFilter, setReleaseStatusFilter] = useState<string>('ALL');

  const { data: carryover, isLoading: carryoverLoading } = useQuery({
    queryKey: ['eng-analytics', 'tracking', 'sprint-carryover', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/tracking/sprint-carryover', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: epicBd, isLoading: epicLoading } = useQuery({
    queryKey: ['eng-analytics', 'tracking', 'epic-burndown', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/tracking/epic-burndown', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: relReady, isLoading: relLoading } = useQuery({
    queryKey: ['eng-analytics', 'tracking', 'release-readiness', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/tracking/release-readiness', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  if (carryoverLoading || epicLoading || relLoading) return <Loader />;

  return (
    <Stack gap="lg">
      {carryover?.zombie_issues && carryover.zombie_issues.length > 0 && (
        <MetricCard
          title="Sprint Carryover"
          description="Zombie issues — unresolved across multiple sprints"
        >
          <Group gap="sm" mb="md">
            <Select
              label="Min Sprints Carried"
              placeholder="3"
              data={[
                { value: '3', label: '3+' },
                { value: '4', label: '4+' },
                { value: '5', label: '5+' },
              ]}
              value={carryoverSprintsFilter}
              onChange={(val) => {
                setCarryoverSprintsFilter(val ?? '3');
                setCarryoverPage(1);
              }}
              w={150}
            />
          </Group>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Issue</Table.Th>
                  <Table.Th>Summary</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Assignee</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th ta="right">
                    <Tooltip label="Number of consecutive sprints this issue has appeared in without being done">
                      <span>Carried Over (×)</span>
                    </Tooltip>
                  </Table.Th>
                  <Table.Th>First Seen</Table.Th>
                  <Table.Th>Last Seen</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(carryover.zombie_issues ?? [])
                  .filter((z: any) => z.sprint_count >= parseInt(carryoverSprintsFilter))
                  .slice((carryoverPage - 1) * CARRYOVER_PAGE_SIZE, carryoverPage * CARRYOVER_PAGE_SIZE)
                  .map((z: any) => (
                  <Table.Tr key={z.issue_key}>
                    <Table.Td>
                      <Text component="a" href={jiraLink(z.issue_key)} target="_blank"
                        size="xs" ff="monospace" c="blue" td="underline">
                        {z.issue_key}
                      </Text>
                    </Table.Td>
                    <Table.Td><Text size="xs" lineClamp={1}>{z.summary}</Text></Table.Td>
                    <Table.Td><Text size="xs">{z.issue_type}</Text></Table.Td>
                    <Table.Td><AssigneeCell name={z.assignee_display_name} /></Table.Td>
                    <Table.Td><Text size="xs">{z.status_name}</Text></Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={
                        z.priority_name === 'Highest' ? 'red' :
                        z.priority_name === 'High' ? 'orange' :
                        z.priority_name === 'Medium' ? 'blue' : 'gray'
                      }>
                        {z.priority_name}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Badge size="sm" color={z.sprint_count >= 4 ? 'red' : z.sprint_count === 3 ? 'orange' : 'gray'}>
                        {z.sprint_count >= 4 ? `${z.sprint_count} ZOMBIE` : `${z.sprint_count}`}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="xs">{fmtDate(z.first_seen)}</Text></Table.Td>
                    <Table.Td><Text size="xs">{fmtDate(z.last_seen)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {((carryover.zombie_issues ?? []).filter((z: any) => z.sprint_count >= parseInt(carryoverSprintsFilter)).length) > CARRYOVER_PAGE_SIZE && (
            <Group justify="center" mt="md">
              <Pagination
                value={carryoverPage}
                onChange={setCarryoverPage}
                total={Math.ceil(((carryover.zombie_issues ?? []).filter((z: any) => z.sprint_count >= parseInt(carryoverSprintsFilter)).length) / CARRYOVER_PAGE_SIZE)}
              />
            </Group>
          )}
        </MetricCard>
      )}

      {Array.isArray(epicBd) && epicBd.length > 0 && (
        <MetricCard
          title="Epic Burndown"
          description="Progress toward epic completion"
        >
          <Group gap="sm" mb="md">
            <SegmentedControl
              value={epicCompletionFilter}
              onChange={(val) => {
                setEpicCompletionFilter(val);
                setEpicPage(1);
              }}
              data={[
                { value: 'ALL', label: 'All' },
                { value: 'LOW', label: '< 25%' },
                { value: 'MID', label: '25-75%' },
                { value: 'HIGH', label: '> 75%' },
              ]}
              size="xs"
            />
          </Group>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Epic Key</Table.Th>
                  <Table.Th>Epic Name</Table.Th>
                  <Table.Th>Progress</Table.Th>
                  <Table.Th ta="right">% Complete</Table.Th>
                  <Table.Th ta="right">Remaining Stories</Table.Th>
                  <Table.Th ta="right">Est. Sprints Left</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(epicBd as any[])
                  .filter((epic: any) => {
                    const total = epic.total_stories ?? 0;
                    const done = epic.done_stories ?? 0;
                    const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
                    if (epicCompletionFilter === 'LOW') return pct < 25;
                    if (epicCompletionFilter === 'MID') return pct >= 25 && pct <= 75;
                    if (epicCompletionFilter === 'HIGH') return pct > 75;
                    return true;
                  })
                  .slice((epicPage - 1) * EPIC_PAGE_SIZE, epicPage * EPIC_PAGE_SIZE)
                  .map((epic: any) => {
                  const total = epic.total_stories ?? 0;
                  const done = epic.done_stories ?? 0;
                  const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
                  return (
                    <Table.Tr key={epic.epic_key}>
                      <Table.Td>
                        <Text component="a" href={jiraLink(epic.epic_key)} target="_blank"
                          size="xs" ff="monospace" c="blue" td="underline">
                          {epic.epic_key}
                        </Text>
                      </Table.Td>
                      <Table.Td><Text size="xs" lineClamp={1}>{epic.epic_name || '—'}</Text></Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Progress value={pct} w={100} color={pct === 100 ? 'green' : 'blue'} />
                          <Text size="xs">{done}/{total}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right" fw={600}>{fmt0(pct)}%</Table.Td>
                      <Table.Td ta="right">{epic.remaining_stories ?? 0}</Table.Td>
                      <Table.Td ta="right">{epic.estimated_sprints_remaining ? `${epic.estimated_sprints_remaining}` : '—'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {((epicBd as any[])
            .filter((epic: any) => {
              const total = epic.total_stories ?? 0;
              const done = epic.done_stories ?? 0;
              const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
              if (epicCompletionFilter === 'LOW') return pct < 25;
              if (epicCompletionFilter === 'MID') return pct >= 25 && pct <= 75;
              if (epicCompletionFilter === 'HIGH') return pct > 75;
              return true;
            }).length) > EPIC_PAGE_SIZE && (
            <Group justify="center" mt="md">
              <Pagination
                value={epicPage}
                onChange={setEpicPage}
                total={Math.ceil(((epicBd as any[])
                  .filter((epic: any) => {
                    const total = epic.total_stories ?? 0;
                    const done = epic.done_stories ?? 0;
                    const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
                    if (epicCompletionFilter === 'LOW') return pct < 25;
                    if (epicCompletionFilter === 'MID') return pct >= 25 && pct <= 75;
                    if (epicCompletionFilter === 'HIGH') return pct > 75;
                    return true;
                  }).length) / EPIC_PAGE_SIZE)}
              />
            </Group>
          )}
        </MetricCard>
      )}

      {Array.isArray(relReady) && relReady.length > 0 && (
        <MetricCard
          title="Release Readiness"
          description="Completion status per release"
        >
          <Group gap="sm" mb="md">
            <SegmentedControl
              value={releaseStatusFilter}
              onChange={(val) => {
                setReleaseStatusFilter(val);
                setReleasePage(1);
              }}
              data={[
                { value: 'ALL', label: 'All' },
                { value: 'NOT_STARTED', label: 'Not Started <10%' },
                { value: 'IN_PROGRESS', label: 'In Progress 10-90%' },
                { value: 'NEAR_DONE', label: 'Near Done >90%' },
              ]}
              size="xs"
            />
          </Group>
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Release</Table.Th>
                  <Table.Th ta="right">Completion</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(relReady as any[])
                  .filter((rel: any) => {
                    const pct = (rel.completed / rel.total) * 100;
                    if (releaseStatusFilter === 'NOT_STARTED') return pct < 10;
                    if (releaseStatusFilter === 'IN_PROGRESS') return pct >= 10 && pct <= 90;
                    if (releaseStatusFilter === 'NEAR_DONE') return pct > 90;
                    return true;
                  })
                  .slice((releasePage - 1) * RELEASE_PAGE_SIZE, releasePage * RELEASE_PAGE_SIZE)
                  .map((rel: any) => {
                    const pct = (rel.completed / rel.total) * 100;
                    return (
                    <Table.Tr key={rel.version}>
                      <Table.Td fw={500}>{rel.version}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Progress
                            value={pct}
                            w="100px"
                            color={pct === 100 ? 'green' : pct < 10 ? 'red' : 'blue'}
                          />
                          <Text size="xs">{rel.completed}/{rel.total}</Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                  })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {((relReady as any[])
            .filter((rel: any) => {
              const pct = (rel.completed / rel.total) * 100;
              if (releaseStatusFilter === 'NOT_STARTED') return pct < 10;
              if (releaseStatusFilter === 'IN_PROGRESS') return pct >= 10 && pct <= 90;
              if (releaseStatusFilter === 'NEAR_DONE') return pct > 90;
              return true;
            }).length) > RELEASE_PAGE_SIZE && (
            <Group justify="center" mt="md">
              <Pagination
                value={releasePage}
                onChange={setReleasePage}
                total={Math.ceil(((relReady as any[])
                  .filter((rel: any) => {
                    const pct = (rel.completed / rel.total) * 100;
                    if (releaseStatusFilter === 'NOT_STARTED') return pct < 10;
                    if (releaseStatusFilter === 'IN_PROGRESS') return pct >= 10 && pct <= 90;
                    if (releaseStatusFilter === 'NEAR_DONE') return pct > 90;
                    return true;
                  }).length) / RELEASE_PAGE_SIZE)}
              />
            </Group>
          )}
        </MetricCard>
      )}

      <Accordion>
        <Accordion.Item value="glossary">
          <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm" style={{ fontSize: '14px' }}>
              <div>
                <Text fw={600} size="sm">Sprint Carryover</Text>
                <Text size="xs" c="dimmed">Issues appearing in 3+ consecutive sprints without completion. "Zombie stories" consuming planning bandwidth</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Epic Burndown</Text>
                <Text size="xs" c="dimmed">% of child stories completed per epic. Velocity-based prediction of completion date</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Release Readiness</Text>
                <Text size="xs" c="dimmed">% of issues resolved for each fix version. Shows release risk</Text>
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

/* ── Forecasting Tab ────────────────────────────────────────────────────── */
function ForecastingTab({ projectKey, avatars }: { projectKey: string | null; avatars: Record<string, string> }) {
  const [backlogSizeInput, setBacklogSizeInput] = useState<number | string>(30);
  const [devGrowthPage, setDevGrowthPage] = useState(1);
  const [devGrowthFilter, setDevGrowthFilter] = useState<string | null>(null);
  const DEV_GROWTH_PAGE_SIZE = 10;

  const { data: velForecast, isLoading: velLoading } = useQuery({
    queryKey: ['eng-analytics', 'forecasting', 'velocity-forecast', projectKey, backlogSizeInput],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/velocity-forecast', {
        params: { backlogSize: parseInt(String(backlogSizeInput)) || 30, projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: optCap, isLoading: optCapLoading } = useQuery({
    queryKey: ['eng-analytics', 'forecasting', 'optimal-capacity', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/optimal-capacity', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: riskDet, isLoading: riskLoading } = useQuery({
    queryKey: ['eng-analytics', 'forecasting', 'risk-detection', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/risk-detection', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: devGrowth, isLoading: devLoading } = useQuery({
    queryKey: ['eng-analytics', 'forecasting', 'developer-growth', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/developer-growth', {
        params: { months: 6, projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: seasonalPat, isLoading: seasonalLoading } = useQuery({
    queryKey: ['eng-analytics', 'forecasting', 'seasonal-patterns', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/seasonal-patterns', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  if (velLoading || optCapLoading || riskLoading || devLoading || seasonalLoading) {
    return <Loader />;
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="md" p="lg">
        <Stack gap="xs">
          <Text fw={600} size="sm">Monte Carlo Simulation Settings</Text>
          <NumberInput
            label="Backlog Size (items)"
            description="Adjust the backlog size to see how velocity forecasts change"
            value={backlogSizeInput}
            onChange={setBacklogSizeInput}
            min={1}
            max={500}
            step={5}
            w={250}
          />
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="lg">
        <MetricCard
          title="50th Percentile"
          description="Median velocity forecast"
        >
          <Text fw={700} size="xl">
            {velForecast?.forecast_50th_pct_sprints ? `${velForecast.forecast_50th_pct_sprints} sprints` : '—'}
          </Text>
        </MetricCard>

        <MetricCard
          title="80th Percentile"
          description="Optimistic forecast"
        >
          <Text fw={700} size="xl">
            {velForecast?.forecast_80th_pct_sprints ? `${velForecast.forecast_80th_pct_sprints} sprints` : '—'}
          </Text>
        </MetricCard>

        <MetricCard
          title="90th Percentile"
          description="Conservative forecast"
        >
          <Text fw={700} size="xl">
            {velForecast?.forecast_90th_pct_sprints ? `${velForecast.forecast_90th_pct_sprints} sprints` : '—'}
          </Text>
        </MetricCard>

        <MetricCard
          title="Avg Velocity"
          description="Average sprint throughput"
        >
          <Text fw={700} size="xl">
            {velForecast?.avg_velocity ? `${fmt1(velForecast.avg_velocity)} SP/sprint` : '—'}
          </Text>
        </MetricCard>
      </SimpleGrid>

      {velForecast?.backlog_size !== undefined && (
        <MetricCard
          title="Backlog Overview"
          description="Current backlog and forecast summary"
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Paper withBorder radius="md" p="lg">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Total Backlog Size</Text>
                <Text fw={700} size="xl">{fmt0(velForecast.backlog_size)} items</Text>
              </Stack>
            </Paper>
            <Paper withBorder radius="md" p="lg">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Estimated Completion (50th %ile)</Text>
                <Text fw={700} size="xl">{velForecast?.forecast_50th_pct_sprints ? `${velForecast.forecast_50th_pct_sprints} sprints` : '—'}</Text>
              </Stack>
            </Paper>
          </SimpleGrid>
        </MetricCard>
      )}

      {optCap?.by_sprint_size && (
        <MetricCard
          title="Optimal Capacity"
          description="Sprint size vs predictability"
        >
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Sprint Size (issues)</Table.Th>
                  <Table.Th ta="right">Sprint Count</Table.Th>
                  <Table.Th ta="right">Avg Predictability</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(optCap.by_sprint_size).map(([bucket, stats]: [string, any]) => (
                  <Table.Tr key={bucket}>
                    <Table.Td fw={500}>{bucket} issues</Table.Td>
                    <Table.Td ta="right">{stats.sprint_count} sprints</Table.Td>
                    <Table.Td ta="right">
                      <Badge color={stats.avg_predictability_pct >= 80 ? 'green' : stats.avg_predictability_pct >= 60 ? 'yellow' : 'red'}>
                        {stats.avg_predictability_pct}%
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {optCap?.data && optCap.data.length > 0 && (
            <>
              <Text size="sm" fw={600} mt="lg" mb="xs">All Sprints (sorted by capacity)</Text>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Sprint</Table.Th>
                      <Table.Th ta="right">Issues</Table.Th>
                      <Table.Th ta="right">Committed</Table.Th>
                      <Table.Th ta="right">Completed</Table.Th>
                      <Table.Th ta="right">Predictability %</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(optCap.data ?? [])
                      .sort((a: any, b: any) => (b.total_issues ?? 0) - (a.total_issues ?? 0))
                      .slice(0, 15)
                      .map((sprint: any) => {
                        const predictability = sprint.committed_issues > 0 ? ((sprint.completed_issues / sprint.committed_issues) * 100) : 0;
                        return (
                        <Table.Tr key={sprint.sprint_name}>
                          <Table.Td><Text size="xs">{sprint.sprint_name}</Text></Table.Td>
                          <Table.Td ta="right">{sprint.total_issues}</Table.Td>
                          <Table.Td ta="right">{sprint.committed_issues}</Table.Td>
                          <Table.Td ta="right">{sprint.completed_issues}</Table.Td>
                          <Table.Td ta="right"><Badge size="sm" color={predictability >= 80 ? 'green' : predictability >= 60 ? 'yellow' : 'red'}>{fmt0(predictability)}%</Badge></Table.Td>
                        </Table.Tr>
                      );
                      })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
        </MetricCard>
      )}

      {Array.isArray(riskDet) && riskDet.length > 0 && (
        <MetricCard
          title="Risk Detection"
          description="Automated flags based on velocity, WIP, and bug trends"
        >
          <Stack gap="md">
            {(riskDet as any[]).slice(0, 5).map((risk: any, i: number) => (
              <Paper key={i} p="md" radius="md" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={600} size="sm">{risk.project_key}</Text>
                  <Badge color={risk.risk_level === 'high' ? 'red' : risk.risk_level === 'medium' ? 'yellow' : 'gray'}>
                    Risk: {risk.risk_score.toFixed(0)}
                  </Badge>
                </Group>
                <Group gap="xs" mb="sm">
                  <Text size="xs" c="dimmed">
                    WIP: {risk.current_wip} | Bugs (14d): {risk.recent_bugs} | Velocity: {risk.velocity_trend?.last ?? '—'} (prev: {risk.velocity_trend?.previous ?? '—'})
                    {risk.velocity_trend?.last < risk.velocity_trend?.previous && <Badge size="xs" color="red" ml={4}>↓ Dropping</Badge>}
                  </Text>
                </Group>
                {risk.flags && risk.flags.length > 0 && (
                  <Group gap="xs">
                    {risk.flags.map((flag: string, idx: number) => (
                      <Badge key={idx} size="xs" variant="light" color="orange">
                        {flag}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Paper>
            ))}
          </Stack>
        </MetricCard>
      )}

      {Array.isArray(devGrowth) && devGrowth.length > 0 && (
        <MetricCard
          title="Developer Growth"
          description="Monthly stats per developer"
        >
          <Group gap="sm" mb="md">
            {(() => {
              const grouped = (devGrowth as any[]).reduce((acc: any, row: any) => {
                const dev = row.developer || 'Unknown';
                if (!acc[dev]) acc[dev] = [];
                acc[dev].push(row);
                return acc;
              }, {});
              const devs = Object.keys(grouped).sort();
              return (
                <Select
                  label="Filter by Developer"
                  placeholder="All developers"
                  data={devs.map((d: string) => ({ value: d, label: d }))}
                  value={devGrowthFilter}
                  onChange={(val) => {
                    setDevGrowthFilter(val);
                    setDevGrowthPage(1);
                  }}
                  searchable
                  clearable
                />
              );
            })()}
          </Group>
          <Stack gap="lg">
            {(() => {
              const grouped = (devGrowth as any[]).reduce((acc: any, row: any) => {
                const dev = row.developer || 'Unknown';
                if (!acc[dev]) acc[dev] = [];
                acc[dev].push(row);
                return acc;
              }, {});
              const devs = Object.entries(grouped)
                .filter(([dev]: [string, any]) => !devGrowthFilter || dev === devGrowthFilter)
                .sort((a: any, b: any) => a[0].localeCompare(b[0]));
              const paged = devs.slice((devGrowthPage - 1) * DEV_GROWTH_PAGE_SIZE, devGrowthPage * DEV_GROWTH_PAGE_SIZE);

              return paged.map(([developer, rows]: [string, any]) => (
                <Paper key={developer} withBorder radius="md" p="lg">
                  <Group gap="sm" mb="md">
                    <Avatar size={32} radius="xl">{developer.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</Avatar>
                    <div>
                      <Text fw={600} size="sm">{developer}</Text>
                      <Text size="xs" c="dimmed">{rows.length} months of data</Text>
                    </div>
                  </Group>
                  <ScrollArea>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Month</Table.Th>
                          <Table.Th ta="right">Issues</Table.Th>
                          <Table.Th ta="right">Avg Complexity</Table.Th>
                          <Table.Th ta="right">Avg Cycle (days)</Table.Th>
                          <Table.Th ta="right">Trend</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(rows as any[])
                          .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
                          .map((row: any, idx: number) => {
                            const nextRow = rows[idx + 1];
                            let trend = '—';
                            if (nextRow) {
                              const cycleChange = row.avg_cycle_days - nextRow.avg_cycle_days;
                              trend = cycleChange < -0.1 ? '↑' : cycleChange > 0.1 ? '↓' : '→';
                            }
                            return (
                              <Table.Tr key={idx}>
                                <Table.Td><Text size="xs">{fmtDate(row.month)}</Text></Table.Td>
                                <Table.Td ta="right">{row.issues_completed}</Table.Td>
                                <Table.Td ta="right">{fmt1(row.avg_complexity)}</Table.Td>
                                <Table.Td ta="right">{fmt1(row.avg_cycle_days)}</Table.Td>
                                <Table.Td ta="right">{trend}</Table.Td>
                              </Table.Tr>
                            );
                          })}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Paper>
              ));
            })()}
            {(() => {
              const grouped = (devGrowth as any[]).reduce((acc: any, row: any) => {
                const dev = row.developer || 'Unknown';
                if (!acc[dev]) acc[dev] = [];
                acc[dev].push(row);
                return acc;
              }, {});
              const devs = Object.entries(grouped).filter(([dev]: [string, any]) => !devGrowthFilter || dev === devGrowthFilter);
              return devs.length > DEV_GROWTH_PAGE_SIZE && (
                <Group justify="center" mt="lg">
                  <Pagination
                    value={devGrowthPage}
                    onChange={setDevGrowthPage}
                    total={Math.ceil(devs.length / DEV_GROWTH_PAGE_SIZE)}
                  />
                </Group>
              );
            })()}
          </Stack>
        </MetricCard>
      )}

      {seasonalPat?.by_month && seasonalPat.by_month.length > 0 && (
        <MetricCard
          title="Seasonal Patterns"
          description="Completed and resolved issues trend over time"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={seasonalPat.by_month}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <RechartTooltip />
              <Legend />
              <Line type="monotone" dataKey="issues_completed" stroke={AQUA_HEX} strokeWidth={2} />
              {seasonalPat.by_month && seasonalPat.by_month.some((d: any) => d.bugs_resolved !== undefined) && (
                <Line type="monotone" dataKey="bugs_resolved" stroke={COLOR_ERROR} strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </MetricCard>
      )}

      <Accordion>
        <Accordion.Item value="glossary">
          <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm" style={{ fontSize: '14px' }}>
              <div>
                <Text fw={600} size="sm">Velocity Forecast</Text>
                <Text size="xs" c="dimmed">Monte Carlo simulation using last N sprints' throughput variance. 50th percentile = most likely, 90th = conservative</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Optimal Sprint Capacity</Text>
                <Text size="xs" c="dimmed">Historical analysis of sprint size vs predictability. Most teams find 20-30% overcommitment</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Risk Detection</Text>
                <Text size="xs" c="dimmed">Automated flags based on: velocity drop &gt;30%, WIP &gt;20, bug spike in 14 days</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Developer Growth</Text>
                <Text size="xs" c="dimmed">Month-over-month trend in cycle time, complexity (SP), and throughput per developer</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Seasonal Patterns</Text>
                <Text size="xs" c="dimmed">Productivity by month to identify predictable dips (holidays, releases)</Text>
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function EngineeringAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('quality');
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const avatars = useAvatarMap(); // load Jira avatar URLs once, share across all tabs

  // Backfill status — polled every 30s so the UI stays fresh after a backfill runs
  const { data: backfillStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['eng-analytics', 'backfill-status'],
    queryFn: () => apiClient.get('/engineering-analytics/backfill-status').then(r => r.data),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Backfill historical transition data (runs async on backend)
  const backfill = useMutation({
    mutationFn: () => apiClient.post('/engineering-analytics/backfill-transitions?maxIssues=10000').then(r => r.data),
    onSuccess: (data) => {
      import('@mantine/notifications').then(({ notifications }) =>
        notifications.show({
          color: data.status === 'COMPLETE' ? 'teal' : 'blue',
          title: data.status === 'COMPLETE' ? 'Already up to date' : 'Backfill started',
          message: data.message,
          autoClose: 8000,
        })
      );
      setTimeout(() => refetchStatus(), 5000);
    },
  });

  const { data: projects, isLoading: projLoading } = useQuery({
    queryKey: ['eng-analytics', 'projects'],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/projects');
      return res.data?.projects || [];
    },
  });

  const projectOptions: ProjectOption[] = useMemo(() => {
    const opts = (projects || []).map((p: string) => ({ value: p, label: p }));
    return [{ value: '', label: 'All Projects' }, ...opts];
  }, [projects]);

  return (
    <Stack gap="lg" p="lg">
      <div>
        <Group gap="sm">
          <ThemeIcon size={40} radius="md" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }}>
            <IconChartBar size={24} />
          </ThemeIcon>
          <div>
            <Title order={1} size="h2">Engineering Analytics</Title>
            <Text size="sm" c="dimmed">Flow Efficiency · Aging WIP · Throughput · Forecasting</Text>
          </div>
        </Group>
      </div>

      <Group gap="md" align="flex-end">
        <Select
          label="Project Filter"
          placeholder={projLoading ? 'Loading...' : 'All Projects'}
          searchable
          clearable
          data={projectOptions.filter(o => o.value !== '')} // remove the empty 'All' option, clearable handles it
          value={projectKey ?? null}
          onChange={(val) => setProjectKey(val)}
          w={200}
          disabled={projLoading}
          nothingFoundMessage={projLoading ? 'Loading projects…' : 'No projects found'}
        />
        <Select
          label="Lookback Period"
          data={[
            { value: '30', label: '30 days' },
            { value: '60', label: '60 days' },
            { value: '90', label: '90 days' },
            { value: '180', label: '180 days' },
          ]}
          value={String(days)}
          onChange={(val) => setDays(parseInt(val || '90', 10))}
          w={150}
        />
        <Tooltip label="Backfill transition history from Jira for all historical sprint issues. Required for Flow Efficiency, Queue Time, and other transition-based metrics. Runs in background (~5 min)." withArrow multiline w={320}>
          <Button
            variant="light"
            color="violet"
            size="sm"
            loading={backfill.isPending}
            onClick={() => backfill.mutate()}
            leftSection={<IconCloudDownload size={14} />}
          >
            Backfill History
          </Button>
        </Tooltip>

        {/* Backfill status — shows coverage and last sync time */}
        {backfillStatus && (
          <Box style={{ fontSize: 11, lineHeight: 1.4 }}>
            <Text size="xs" c={backfillStatus.is_complete ? 'green' : 'orange'} fw={600}>
              {backfillStatus.is_complete ? '✓ Transitions synced' : `⚡ ${backfillStatus.coverage_pct}% synced`}
            </Text>
            <Text size="xs" c="dimmed">
              {backfillStatus.issues_with_transitions}/{backfillStatus.total_sprint_issues} issues
              {backfillStatus.last_synced_at && ` · Last: ${fmtDate(backfillStatus.last_synced_at)}`}
            </Text>
            {!backfillStatus.is_complete && backfillStatus.issues_pending > 0 && (
              <Text size="xs" c="orange">{backfillStatus.issues_pending} still pending</Text>
            )}
          </Box>
        )}
      </Group>

      <Tabs value={activeTab} onChange={(tab) => setActiveTab(tab as TabType)} variant="outline" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="quality" leftSection={<IconBug size={14} />}>
            Quality
          </Tabs.Tab>
          <Tabs.Tab value="productivity" leftSection={<IconTrendingUp size={14} />}>
            Productivity
          </Tabs.Tab>
          <Tabs.Tab value="efficiency" leftSection={<IconClock size={14} />}>
            Efficiency
          </Tabs.Tab>
          <Tabs.Tab value="tracking" leftSection={<IconTarget size={14} />}>
            Tracking
          </Tabs.Tab>
          <Tabs.Tab value="forecasting" leftSection={<IconChartBar size={14} />}>
            Forecasting
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="quality" pt="lg">
          <QualityTab projectKey={projectKey} days={days} avatars={avatars} />
        </Tabs.Panel>

        <Tabs.Panel value="productivity" pt="lg">
          <ProductivityTab projectKey={projectKey} avatars={avatars} />
        </Tabs.Panel>

        <Tabs.Panel value="efficiency" pt="lg">
          <EfficiencyTab projectKey={projectKey} days={days} avatars={avatars} />
        </Tabs.Panel>

        <Tabs.Panel value="tracking" pt="lg">
          <TrackingTab projectKey={projectKey} avatars={avatars} />
        </Tabs.Panel>

        <Tabs.Panel value="forecasting" pt="lg">
          <ForecastingTab projectKey={projectKey} avatars={avatars} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
