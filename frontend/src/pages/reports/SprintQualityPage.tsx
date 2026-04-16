import { useState, useMemo, type ReactNode } from 'react';
import {
  Title, Text, Stack, Group, Paper, Badge, Select, Loader, Button,
  Table, Progress, Alert, ThemeIcon, SimpleGrid, Tabs, Box,
  ActionIcon, Tooltip, SegmentedControl,
} from '@mantine/core';
import {
  IconBug, IconClock, IconUsers, IconAlertTriangle,
  IconCircleCheck, IconTrendingUp, IconShieldCheck,
  IconArrowRight, IconCalendarStats, IconChevronLeft, IconChevronRight,
  IconBuilding, IconSearch, IconCloudDownload, IconRefresh,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import apiClient from '../../api/client';
import { AQUA_HEX, FONT_FAMILY, COLOR_ERROR, COLOR_GREEN, COLOR_WARNING } from '../../brandTokens';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Pod      { id: number; displayName: string; projectKeys: string[] }
interface SprintOpt{ sprintJiraId: number; sprintName: string; boardId: number | null; state: string; projectKey: string }
interface DeptRow  { board_id: number; project_key: string; sprint_name: string; sprint_id: number; sprint_state: string; complete_date: string; start_date: string; stories: number; bugs: number; defect_density: number; completed: number; committed: number; predictability: number; quality_score: number; grade: string }
interface StoryRow { issue_key: string; summary: string; assignee_display_name: string; status_name: string; bug_count: number; bugs: { issue_key: string }[] | null; quality_score: string }
interface LoadRow  { assignee: string; total_issues: number; stories: number; bugs: number; completed: number }
interface CycleRow { issue_key: string; summary: string; issue_type: string; assignee_display_name: string; dev_cycle_days: number; qa_cycle_days: number; total_days: number }
interface PredRow  { sprint_name: string; committed: number; completed: number; total_issues: number; bugs_in_sprint: number; predictability_pct: number; scope_creep: number }
interface EscapeRow{ sprint_name: string; prev_sprint_name: string; stories_completed: number; escaped_bugs: number; escape_rate_pct: number }
interface TrendRow { period: string; sprint_count: number; stories_completed: number; bugs_total: number; defect_density: number; avg_predictability: number; avg_cycle_days: number | null; quality_score: number }

function safe<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }

function useApi(key: unknown[], url: string | null) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiClient.get(url as string).then(r => r.data),
    enabled: url != null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

const GRADE_COLOR: Record<string, string> = { A: 'green', B: 'teal', C: 'yellow', D: 'red' };

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SprintQualityPage() {
  const [view, setView]             = useState<'dept' | 'pod'>('dept');
  const [activePod, setActivePod]   = useState<string | null>(null);
  const [trendPeriod, setTrendPeriod] = useState('quarter');
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  // Sync + refresh
  const qc = useQueryClient();
  const triggerSync = useMutation({
    mutationFn: () => apiClient.post('/jira/sync/trigger', null, { params: { fullSync: true } }),
    onSuccess: () => {
      import('@mantine/notifications').then(({ notifications }) =>
        notifications.show({ color: 'teal', title: 'Sync started', message: 'Jira sync running — data will refresh in ~30s.' }));
      setTimeout(() => qc.invalidateQueries({ queryKey: ['quality'] }), 30000);
      setTimeout(() => qc.invalidateQueries({ queryKey: ['q'] }), 30000);
    },
  });
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['quality'] });
    qc.invalidateQueries({ queryKey: ['q'] });
  };

  // ── Pods + department data ────────────────────────────────────────────────
  const { data: rawPods, isLoading: loadingPods } = useApi(['quality', 'pods'], '/backlog/pods');
  const pods = safe<Pod>(rawPods);

  const { data: rawDept, isLoading: loadingDept } = useApi(['quality', 'dept'], '/jira/quality/department-summary?scope=all');
  const dept = safe<DeptRow>(rawDept);

  // ── POD-level data ────────────────────────────────────────────────────────
  const podId  = activePod ?? (pods.length > 0 ? String(pods[0].id) : null);
  const pod    = pods.find(p => String(p.id) === podId);
  const projKey = pod?.projectKeys?.[0] ?? null;

  const { data: rawSprints } = useApi(['quality', 'sprints', projKey], projKey ? `/retro/sprints?limit=50` : null);
  const allSprints = safe<SprintOpt>(rawSprints);

  const podSprints = useMemo(() => {
    if (!pod?.projectKeys?.length) return allSprints;
    const filtered = allSprints.filter(s => pod.projectKeys.includes(s.projectKey));
    return filtered.sort((a, b) => {
      const order = { closed: 0, active: 1, future: 2 };
      return (order[a.state as keyof typeof order] ?? 3) - (order[b.state as keyof typeof order] ?? 3);
    });
  }, [allSprints, pod]);

  // Default: most recent CLOSED sprint (real data), fallback to active
  const defaultSprintId = useMemo(() => {
    const closed = podSprints.find(s => s.state === 'closed');
    const active = podSprints.find(s => s.state === 'active');
    return (closed ?? active)?.sprintJiraId ?? podSprints[0]?.sprintJiraId ?? null;
  }, [podSprints]);

  const sprintId = selectedSprintId ?? defaultSprintId;
  const sprint   = podSprints.find(s => s.sprintJiraId === sprintId);

  // Get boardId — from sprint data or by lookup
  const { data: boardLookup } = useApi(['quality', 'board-lookup', sprintId],
    sprintId && !sprint?.boardId ? `/jira/quality/sprint/${sprintId}/board` : null);
  const boardId = sprint?.boardId ?? (boardLookup as any)?.board_id ?? null;

  const sprintIdx  = podSprints.findIndex(s => s.sprintJiraId === sprintId);
  const prevSprint = sprintIdx > 0 ? podSprints[sprintIdx - 1] : null;
  const nextSprint = sprintIdx < podSprints.length - 1 ? podSprints[sprintIdx + 1] : null;

  const handlePodClick = (pid: string) => {
    setActivePod(pid);
    setSelectedSprintId(null);
    setView('pod');
  };

  // ── Quality data ──────────────────────────────────────────────────────────
  const { data: rawStory,   isLoading: lStory   } = useApi(['q','story',   sprintId], sprintId ? `/jira/quality/sprint/${sprintId}/story-quality`          : null);
  const { data: rawLoad,    isLoading: lLoad     } = useApi(['q','load',    sprintId], sprintId ? `/jira/quality/sprint/${sprintId}/assignee-load`           : null);
  const { data: rawCycle,   isLoading: lCycle    } = useApi(['q','cycle',   sprintId], sprintId ? `/jira/quality/sprint/${sprintId}/cycle-time`              : null);
  const { data: rawPredict, isLoading: lPredict  } = useApi(['q','predict', boardId],  boardId  ? `/jira/quality/board/${boardId}/predictability?sprints=10` : null);
  const { data: rawEscape,  isLoading: lEscape   } = useApi(['q','escape',  boardId],  boardId  ? `/jira/quality/board/${boardId}/bug-escape-rate?sprints=8` : null);
  const { data: rawTrends,  isLoading: lTrends   } = useApi(['q','trends',  boardId, trendPeriod], boardId ? `/jira/quality/board/${boardId}/trends?period=${trendPeriod}` : null);

  const story   = safe<StoryRow>(Array.isArray(rawStory)   ? rawStory   : null);
  const cycle   = safe<CycleRow>(Array.isArray(rawCycle)   ? rawCycle   : null);
  const predict = safe<PredRow>(Array.isArray(rawPredict)  ? rawPredict : null);
  const escape  = safe<EscapeRow>(Array.isArray(rawEscape) ? rawEscape  : null);
  const trends  = safe<TrendRow>((rawTrends as any)?.periods);
  const assigns = safe<LoadRow>((rawLoad as any)?.assignees);

  const totalBugs = story.reduce((s, r) => s + (r.bug_count ?? 0), 0);
  const cyclePos  = cycle.filter(c => (c.total_days ?? 0) > 0);
  const avgCycle  = cyclePos.length ? Math.round(cyclePos.reduce((s, c) => s + c.total_days, 0) / cyclePos.length * 10) / 10 : null;
  const lastPred  = predict[predict.length - 1];
  const lastEsc   = escape[escape.length - 1];

  const sprintOpts = podSprints.map(s => ({
    value: String(s.sprintJiraId),
    label: `${s.sprintName ?? ''}${s.state === 'closed' ? '' : s.state === 'active' ? ' ● ACTIVE' : ' (upcoming)'}`,
  }));

  if (loadingPods) return <Group justify="center" mt="xl"><Loader /></Group>;

  return (
    <Stack gap="md" className="page-enter">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Group gap="xs">
          <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'violet', to: 'pink', deg: 135 }}>
            <IconShieldCheck size={20} />
          </ThemeIcon>
          <div>
            <Title order={2} style={{ fontFamily: FONT_FAMILY }}>Sprint Quality</Title>
            <Text size="xs" c="dimmed">Defect density · Cycle time · Predictability · Trends</Text>
          </div>
        </Group>
        <Group gap="sm">
          <Button size="xs" variant="light" color="teal"
            leftSection={<IconCloudDownload size={14} />}
            loading={triggerSync.isPending}
            onClick={() => triggerSync.mutate()}
          >
            Sync Jira
          </Button>
          <ActionIcon variant="light" color="teal" size="sm" onClick={refreshAll} title="Refresh data">
            <IconRefresh size={14} />
          </ActionIcon>
          <SegmentedControl
            value={view}
            onChange={v => setView(v as 'dept' | 'pod')}
            data={[
              { value: 'dept', label: <Group gap={4}><IconBuilding size={14}/><span>Department</span></Group> },
              { value: 'pod',  label: <Group gap={4}><IconSearch size={14}/><span>POD Detail</span></Group> },
            ]}
            size="sm"
          />
        </Group>
      </Group>

      {/* ══ DEPARTMENT VIEW ════════════════════════════════════════════════════ */}
      {view === 'dept' && (
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Showing the most recently completed sprint for each board. Click a row to drill into that POD.
          </Text>

          {loadingDept ? <Loader size="sm" /> : dept.length === 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={16}/>} title="No closed sprints found">
              <Text size="sm" mb="sm">
                Quality metrics require completed (closed) sprints with issues. This could mean:
              </Text>
              <Text size="sm" component="div">
                1. Jira data hasn't been synced yet — click <b>Sync Jira</b> above and wait ~30 seconds, then click <b>↻</b> to refresh.
                <br/>2. Your Jira boards don't have closed sprints — check if sprints have been completed in Jira.
                <br/>3. Sprint data was recently cleared — a full sync will restore historical data from Jira.
              </Text>
            </Alert>
          ) : (
            <>
              {/* Summary KPIs across all boards */}
              <SimpleGrid cols={4} spacing="sm">
                <Kpi icon={<IconBug size={18}/>} label="Total Bugs (last sprint)"
                  value={String(dept.reduce((s, r) => s + (r.bugs ?? 0), 0))}
                  sub={`across ${dept.length} boards`}
                  color={dept.reduce((s, r) => s + (r.bugs ?? 0), 0) > 20 ? COLOR_ERROR : COLOR_GREEN} />
                <Kpi icon={<IconTrendingUp size={18}/>} label="Avg Predictability"
                  value={dept.length ? `${Math.round(dept.reduce((s, r) => s + (r.predictability ?? 0), 0) / dept.length)}%` : '—'}
                  sub="across all boards"
                  color={dept.reduce((s, r) => s + (r.predictability ?? 0), 0) / Math.max(dept.length, 1) >= 70 ? COLOR_GREEN : COLOR_WARNING} />
                <Kpi icon={<IconBug size={18}/>} label="Avg Defect Density"
                  value={dept.length ? String(Math.round(dept.reduce((s, r) => s + (r.defect_density ?? 0), 0) / dept.length * 100) / 100) : '—'}
                  sub="bugs per story"
                  color={dept.reduce((s, r) => s + (r.defect_density ?? 0), 0) / Math.max(dept.length, 1) > 1 ? COLOR_ERROR : COLOR_GREEN} />
                <Kpi icon={<IconShieldCheck size={18}/>} label="Boards needing attention"
                  value={String(dept.filter(r => r.grade === 'C' || r.grade === 'D').length)}
                  sub={`Grade C or D out of ${dept.length}`}
                  color={dept.filter(r => r.grade === 'C' || r.grade === 'D').length > 0 ? COLOR_WARNING : COLOR_GREEN} />
              </SimpleGrid>

              {/* Department table */}
              <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
                <Table highlightOnHover>
                  <Table.Thead style={{ background: 'var(--mantine-color-dark-6)' }}>
                    <Table.Tr>
                      <Table.Th>Board / POD</Table.Th>
                      <Table.Th>Last Closed Sprint</Table.Th>
                      <Table.Th ta="center">Grade</Table.Th>
                      <Table.Th ta="center">Quality Score</Table.Th>
                      <Table.Th ta="center">Predictability</Table.Th>
                      <Table.Th ta="center">Stories Done</Table.Th>
                      <Table.Th ta="center">Bugs</Table.Th>
                      <Table.Th ta="center">Defect/Story</Table.Th>
                      <Table.Th ta="center">Completed</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dept
                      .sort((a, b) => (a.quality_score ?? 0) - (b.quality_score ?? 0)) // worst first
                      .map(row => {
                        const matchedPod = pods.find(p => p.projectKeys.includes(row.project_key));
                        return (
                          <Table.Tr key={row.board_id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              if (matchedPod) handlePodClick(String(matchedPod.id));
                            }}
                          >
                            <Table.Td>
                              <Group gap="xs">
                                <Text size="sm" fw={600}>{matchedPod?.displayName ?? row.project_key}</Text>
                                <Badge size="xs" variant="light" color="gray">{row.project_key}</Badge>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={6}>
                                <div>
                                  <Text size="xs">{row.sprint_name}</Text>
                                  <Text size="10px" c="dimmed">{String(row.complete_date ?? row.start_date ?? '').slice(0, 10)}</Text>
                                </div>
                                <Badge size="xs"
                                  color={row.sprint_state === 'active' ? 'teal' : 'gray'}
                                  variant={row.sprint_state === 'active' ? 'filled' : 'light'}>
                                  {row.sprint_state === 'active' ? '● LIVE' : 'CLOSED'}
                                </Badge>
                              </Group>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Badge size="lg" color={GRADE_COLOR[row.grade] ?? 'gray'} variant="filled">{row.grade}</Badge>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Group gap={4} justify="center">
                                <Text fw={700} size="sm">{row.quality_score ?? 0}</Text>
                                <Progress value={row.quality_score ?? 0} size="xs" w={60} color={GRADE_COLOR[row.grade] ?? 'gray'}/>
                              </Group>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Badge color={(row.predictability ?? 0) >= 80 ? 'green' : (row.predictability ?? 0) >= 60 ? 'yellow' : 'red'}>
                                {row.predictability ?? 0}%
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="center">{row.stories ?? 0}</Table.Td>
                            <Table.Td ta="center">
                              <Badge color={(row.bugs ?? 0) > 10 ? 'red' : (row.bugs ?? 0) > 3 ? 'yellow' : 'green'} variant="light" size="sm">
                                {row.bugs ?? 0}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Badge size="xs" color={(row.defect_density ?? 0) > 1 ? 'red' : (row.defect_density ?? 0) > 0.5 ? 'yellow' : 'green'}>
                                {row.defect_density ?? 0}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="center">{row.completed ?? 0}/{row.committed ?? 0}</Table.Td>
                            <Table.Td ta="center">
                              <Text size="xs" c="dimmed">→ Detail</Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}
        </Stack>
      )}

      {/* ══ POD DETAIL VIEW ═══════════════════════════════════════════════════ */}
      {view === 'pod' && (
        <Stack gap="md">
          {/* POD tabs */}
          <Box style={{ borderBottom: '1px solid var(--mantine-color-dark-4)', overflowX: 'auto' }}>
            <Group gap={4} wrap="nowrap" pb={8}>
              {pods.map(p => {
                const isActive = String(p.id) === podId;
                return (
                  <Box key={p.id} onClick={() => handlePodClick(String(p.id))}
                    style={{
                      padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                      whiteSpace: 'nowrap', flexShrink: 0,
                      background: isActive ? `${AQUA_HEX}22` : 'transparent',
                      border: `1.5px solid ${isActive ? AQUA_HEX : 'transparent'}`,
                      color: isActive ? AQUA_HEX : 'var(--mantine-color-dimmed)',
                      fontWeight: isActive ? 700 : 500, fontSize: 13,
                    }}
                  >
                    {p.displayName}
                    <Text component="span" size="10px" c="dimmed" ml={4}>{p.projectKeys.join(' ')}</Text>
                  </Box>
                );
              })}
            </Group>
          </Box>

          {/* Sprint nav */}
          <Group gap="sm" align="center">
            <Tooltip label="Previous sprint (older)" withArrow>
              <ActionIcon variant="light" size="sm" disabled={!nextSprint}
                onClick={() => setSelectedSprintId(nextSprint!.sprintJiraId)}>
                <IconChevronLeft size={14} />
              </ActionIcon>
            </Tooltip>
            <Select data={sprintOpts} value={sprintId ? String(sprintId) : null}
              onChange={v => setSelectedSprintId(v ? Number(v) : null)}
              placeholder="Select sprint" w={320} size="sm" />
            <Tooltip label="Next sprint (newer)" withArrow>
              <ActionIcon variant="light" size="sm" disabled={!prevSprint}
                onClick={() => setSelectedSprintId(prevSprint!.sprintJiraId)}>
                <IconChevronRight size={14} />
              </ActionIcon>
            </Tooltip>
            {sprint && (
              <Badge color={sprint.state === 'active' ? 'teal' : sprint.state === 'closed' ? 'gray' : 'orange'}
                variant={sprint.state === 'active' ? 'filled' : 'light'}>
                {sprint.state.toUpperCase()}
              </Badge>
            )}
            {sprint?.state === 'active' && (
              <Text size="xs" c="orange">⚠ Active sprint — bugs filed during QA will appear here as the sprint progresses</Text>
            )}
            {sprint?.state === 'future' && (
              <Text size="xs" c="dimmed">Sprint hasn't started yet — select a closed sprint for quality data</Text>
            )}
          </Group>

          {!sprintId ? (
            <Alert color="blue">No sprints found. Trigger a Jira sync first.</Alert>
          ) : (
            <>
              <SimpleGrid cols={4} spacing="sm">
                <Kpi icon={<IconBug size={18}/>} label="Bugs in Sprint" value={String(totalBugs)}
                  sub={`${story.filter(s => s.quality_score === 'POOR').length} stories with 3+ bugs`}
                  color={totalBugs > 10 ? COLOR_ERROR : totalBugs > 4 ? COLOR_WARNING : COLOR_GREEN} />
                <Kpi icon={<IconClock size={18}/>} label="Avg Cycle Time" value={avgCycle != null ? `${avgCycle}d` : '—'}
                  sub="dev start → QA complete" color={AQUA_HEX} />
                <Kpi icon={<IconTrendingUp size={18}/>} label="Predictability"
                  value={lastPred ? `${lastPred.predictability_pct}%` : '—'}
                  sub={lastPred ? `${lastPred.completed}/${lastPred.committed} committed` : boardId ? 'No closed sprints' : 'Loading...'}
                  color={(lastPred?.predictability_pct ?? 0) >= 80 ? COLOR_GREEN : COLOR_WARNING} />
                <Kpi icon={<IconAlertTriangle size={18}/>} label="Bug Escape Rate"
                  value={lastEsc ? `${lastEsc.escape_rate_pct}%` : '—'}
                  sub={lastEsc ? `${lastEsc.escaped_bugs} escaped bugs` : 'No data'}
                  color={(lastEsc?.escape_rate_pct ?? 0) > 10 ? COLOR_ERROR : COLOR_GREEN} />
              </SimpleGrid>

              <Tabs defaultValue="story" variant="outline" radius="md" keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab value="story"   leftSection={<IconBug size={14}/>}>Story Quality</Tabs.Tab>
                  <Tabs.Tab value="cycle"   leftSection={<IconClock size={14}/>}>Cycle Time</Tabs.Tab>
                  <Tabs.Tab value="load"    leftSection={<IconUsers size={14}/>}>Load Balance</Tabs.Tab>
                  <Tabs.Tab value="predict" leftSection={<IconTrendingUp size={14}/>}>Predictability</Tabs.Tab>
                  <Tabs.Tab value="escape"  leftSection={<IconAlertTriangle size={14}/>}>Bug Escape Rate</Tabs.Tab>
                  <Tabs.Tab value="trends"  leftSection={<IconCalendarStats size={14}/>}>Trends</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="story" pt="md">
                  {lStory ? <Loader size="sm"/> : story.length === 0 ? (
                    <Alert icon={<IconCircleCheck size={16}/>} color="blue">
                      No stories with linked bugs found.{sprint?.state !== 'closed' && ' Switch to a closed sprint to see historical data.'}
                    </Alert>
                  ) : (
                    <Stack gap="xs">
                      {story.map(s => {
                        const qc = s.quality_score === 'POOR' ? COLOR_ERROR : s.quality_score === 'FAIR' ? COLOR_WARNING : COLOR_GREEN;
                        return (
                          <Paper key={s.issue_key} p="sm" radius="md" withBorder style={{ borderLeft: `3px solid ${qc}` }}>
                            <Group justify="space-between" wrap="nowrap">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Group gap="xs" mb={2}>
                                  <Text size="xs" ff="monospace" c="dimmed">{s.issue_key}</Text>
                                  <Badge size="xs" color={s.quality_score === 'POOR' ? 'red' : s.quality_score === 'FAIR' ? 'yellow' : 'green'}>{s.quality_score}</Badge>
                                  <Text size="xs" c="dimmed">{s.assignee_display_name || 'Unassigned'}</Text>
                                </Group>
                                <Text size="sm" fw={500} lineClamp={1}>{s.summary}</Text>
                                {(s.bugs ?? []).length > 0 && <Text size="xs" c="dimmed" mt={2}>🐛 {(s.bugs ?? []).map(b => b.issue_key).join(', ')}</Text>}
                              </div>
                              <Box ta="center" style={{ flexShrink: 0, minWidth: 40 }}>
                                <Text fw={800} size="xl" c={qc}>{s.bug_count ?? 0}</Text>
                                <Text size="9px" c="dimmed">bugs</Text>
                              </Box>
                            </Group>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="cycle" pt="md">
                  {lCycle ? <Loader size="sm"/> : cycle.length === 0 ? (
                    <Alert color="blue">No transition data yet.</Alert>
                  ) : (
                    <Table striped highlightOnHover withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr><Table.Th>Issue</Table.Th><Table.Th>Summary</Table.Th><Table.Th>Assignee</Table.Th><Table.Th ta="center">Dev</Table.Th><Table.Th ta="center">QA</Table.Th><Table.Th ta="center">Total</Table.Th></Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {cycle.map(c => (
                          <Table.Tr key={c.issue_key}>
                            <Table.Td><Text ff="monospace" size="xs">{c.issue_key}</Text></Table.Td>
                            <Table.Td><Text size="sm" lineClamp={1}>{c.summary}</Text></Table.Td>
                            <Table.Td><Text size="xs">{c.assignee_display_name || '—'}</Text></Table.Td>
                            <Table.Td ta="center"><CycleBadge v={c.dev_cycle_days}/></Table.Td>
                            <Table.Td ta="center"><CycleBadge v={c.qa_cycle_days}/></Table.Td>
                            <Table.Td ta="center"><CycleBadge v={c.total_days} hi/></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="load" pt="md">
                  {lLoad ? <Loader size="sm"/> : assigns.length === 0 ? (
                    <Alert color="blue">No assignee data.</Alert>
                  ) : (
                    <Stack gap="sm">
                      {assigns.map(a => {
                        const maxV = assigns.reduce((m, x) => Math.max(m, Number(x.total_issues) || 0), 1);
                        const pct  = Math.round((Number(a.total_issues) || 0) / maxV * 100);
                        return (
                          <Paper key={a.assignee} p="sm" radius="md" withBorder>
                            <Group justify="space-between" mb={4}>
                              <Text size="sm" fw={600}>{a.assignee}</Text>
                              <Group gap="xs">
                                <Badge size="xs" color="blue" variant="light">{a.stories} stories</Badge>
                                <Badge size="xs" color="red" variant="light">{a.bugs} bugs</Badge>
                                <Badge size="xs" color="green" variant="light">{a.completed} done</Badge>
                              </Group>
                            </Group>
                            <Progress value={pct} color={pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'teal'} size="sm" radius="xl"/>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="predict" pt="md">
                  {!boardId ? <Alert color="orange">Restart backend to load board-level metrics.</Alert>
                  : lPredict ? <Loader size="sm"/>
                  : predict.length === 0 ? <Alert color="blue">No closed sprints for this board yet.</Alert>
                  : (
                    <Stack gap="md">
                      <Box h={220}><ResponsiveContainer width="100%" height="100%">
                        <LineChart data={predict} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                          <XAxis dataKey="sprint_name" tick={{ fontSize: 10 }} tickFormatter={v => String(v).slice(-8)}/>
                          <YAxis domain={[0, 110]} unit="%" tick={{ fontSize: 11 }}/>
                          <RTooltip formatter={(v: unknown) => [`${v}%`]}/>
                          <Line type="monotone" dataKey="predictability_pct" stroke={AQUA_HEX} strokeWidth={2} dot={{ r: 4 }} name="Predictability"/>
                        </LineChart>
                      </ResponsiveContainer></Box>
                      <Table striped withTableBorder withColumnBorders>
                        <Table.Thead><Table.Tr><Table.Th>Sprint</Table.Th><Table.Th ta="center">Committed</Table.Th><Table.Th ta="center">Completed</Table.Th><Table.Th ta="center">Scope Creep</Table.Th><Table.Th ta="center">Bugs</Table.Th><Table.Th ta="center">Predictability</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {predict.map(p => (
                            <Table.Tr key={p.sprint_name}>
                              <Table.Td><Text size="xs">{p.sprint_name}</Text></Table.Td>
                              <Table.Td ta="center">{p.committed}</Table.Td>
                              <Table.Td ta="center">{p.completed}</Table.Td>
                              <Table.Td ta="center"><Badge size="xs" color={(p.scope_creep??0)>3?'orange':'gray'} variant="light">+{p.scope_creep??0}</Badge></Table.Td>
                              <Table.Td ta="center"><Badge size="xs" color="red" variant="light">{p.bugs_in_sprint}</Badge></Table.Td>
                              <Table.Td ta="center"><Badge color={(p.predictability_pct??0)>=80?'green':(p.predictability_pct??0)>=60?'yellow':'red'}>{p.predictability_pct??0}%</Badge></Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="escape" pt="md">
                  {!boardId ? <Alert color="orange">Restart backend to load board-level metrics.</Alert>
                  : lEscape ? <Loader size="sm"/>
                  : escape.length === 0 ? <Alert color="blue">No escape rate data yet.</Alert>
                  : (
                    <Stack gap="md">
                      <Box h={200}><ResponsiveContainer width="100%" height="100%">
                        <BarChart data={escape} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                          <XAxis dataKey="sprint_name" tick={{ fontSize: 10 }} tickFormatter={v => String(v).slice(0, 10)}/>
                          <YAxis unit="%" tick={{ fontSize: 11 }}/><RTooltip/>
                          <Bar dataKey="escape_rate_pct" name="Escape Rate %" fill={AQUA_HEX} radius={[4,4,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer></Box>
                      <Table striped withTableBorder withColumnBorders>
                        <Table.Thead><Table.Tr><Table.Th>Sprint</Table.Th><Table.Th ta="center">Stories</Table.Th><Table.Th ta="center">Escaped Bugs</Table.Th><Table.Th ta="center">Rate</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {escape.map(e => (
                            <Table.Tr key={e.sprint_name}>
                              <Table.Td><Group gap={4}><Text size="xs">{e.sprint_name}</Text><IconArrowRight size={10}/><Text size="xs" c="dimmed">{e.prev_sprint_name}</Text></Group></Table.Td>
                              <Table.Td ta="center">{e.stories_completed}</Table.Td>
                              <Table.Td ta="center"><Badge color={(e.escaped_bugs??0)>0?'red':'green'} variant="light" size="sm">{e.escaped_bugs??0}</Badge></Table.Td>
                              <Table.Td ta="center"><Badge color={(e.escape_rate_pct??0)>10?'red':(e.escape_rate_pct??0)>5?'yellow':'green'}>{e.escape_rate_pct??0}%</Badge></Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="trends" pt="md">
                  {!boardId ? <Alert color="orange">Restart backend to load trends.</Alert>
                  : (
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">Quality trend over time for this POD.</Text>
                        <Select data={[{value:'month',label:'By Month'},{value:'quarter',label:'By Quarter'},{value:'year',label:'By Year'}]}
                          value={trendPeriod} onChange={v => setTrendPeriod(v ?? 'quarter')} w={150} size="sm"/>
                      </Group>
                      {lTrends ? <Loader size="sm"/> : trends.length === 0 ? (
                        <Alert color="blue">No trend data — requires multiple closed sprints.</Alert>
                      ) : (
                        <>
                          <Box h={200}><ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                              <XAxis dataKey="period" tick={{ fontSize: 11 }}/>
                              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }}/>
                              <RTooltip formatter={(v: unknown) => [`${v}%`]}/>
                              <Line type="monotone" dataKey="quality_score"      stroke={AQUA_HEX}    strokeWidth={2.5} dot={{ r: 4 }} name="Quality Score"/>
                              <Line type="monotone" dataKey="avg_predictability" stroke={COLOR_GREEN}  strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 3 }} name="Predictability %"/>
                            </LineChart>
                          </ResponsiveContainer></Box>
                          <Table striped withTableBorder withColumnBorders>
                            <Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th ta="center">Sprints</Table.Th><Table.Th ta="center">Stories</Table.Th><Table.Th ta="center">Bugs</Table.Th><Table.Th ta="center">Defect/Story</Table.Th><Table.Th ta="center">Predictability</Table.Th><Table.Th ta="center">Quality</Table.Th></Table.Tr></Table.Thead>
                            <Table.Tbody>
                              {trends.map((t, idx) => {
                                const prev = idx > 0 ? trends[idx - 1] : null;
                                const dir  = prev ? (t.quality_score > prev.quality_score ? '↑' : t.quality_score < prev.quality_score ? '↓' : '') : '';
                                return (
                                  <Table.Tr key={t.period}>
                                    <Table.Td><Group gap={4}><Text size="sm" fw={600}>{t.period}</Text>{dir && <Text size="xs" c={dir==='↑'?'green':'red'}>{dir}</Text>}</Group></Table.Td>
                                    <Table.Td ta="center">{t.sprint_count}</Table.Td>
                                    <Table.Td ta="center">{t.stories_completed}</Table.Td>
                                    <Table.Td ta="center"><Badge size="xs" color="red" variant="light">{t.bugs_total}</Badge></Table.Td>
                                    <Table.Td ta="center"><Badge size="xs" color={(t.defect_density??0)>1?'red':(t.defect_density??0)>0.5?'yellow':'green'}>{t.defect_density??0}</Badge></Table.Td>
                                    <Table.Td ta="center"><Badge color={(t.avg_predictability??0)>=80?'green':(t.avg_predictability??0)>=60?'yellow':'red'}>{t.avg_predictability??0}%</Badge></Table.Td>
                                    <Table.Td ta="center"><Badge size="sm" color={(t.quality_score??0)>=70?'green':(t.quality_score??0)>=50?'yellow':'red'} variant="filled">{t.quality_score??0}</Badge></Table.Td>
                                  </Table.Tr>
                                );
                              })}
                            </Table.Tbody>
                          </Table>
                        </>
                      )}
                    </Stack>
                  )}
                </Tabs.Panel>
              </Tabs>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function Kpi({ icon, label, value, sub, color }: { icon: ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Group gap="xs" mb={4}>
        <ThemeIcon size={28} radius="md" color="gray" variant="light">{icon}</ThemeIcon>
        <Text size="xs" c="dimmed" fw={600}>{label}</Text>
      </Group>
      <Text fw={800} size="xl" c={color} style={{ fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>{value}</Text>
      <Text size="xs" c="dimmed" mt={2}>{sub}</Text>
    </Paper>
  );
}

function CycleBadge({ v, hi }: { v: number; hi?: boolean }) {
  if (v == null || v < 0) return <Text size="xs" c="dimmed">—</Text>;
  const color = v > 7 ? 'red' : v > 3 ? 'yellow' : 'green';
  return <Badge color={hi ? color : 'gray'} variant={hi ? 'filled' : 'light'} size="sm">{v}d</Badge>;
}
