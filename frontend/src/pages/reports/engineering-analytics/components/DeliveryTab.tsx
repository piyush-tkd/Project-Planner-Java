import { useState } from 'react';
import {
  Stack, Group, Text, Badge, Select, Loader, Table, SegmentedControl,
  ScrollArea, Accordion, Pagination, Progress, Tooltip, Tabs, Anchor,
  Paper, NumberInput, SimpleGrid,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import { useJiraStatus } from '../../../../api/jira';
import { MetricCard } from './MetricCard';
import { AssigneeCell } from './AssigneeCell';
import { jiraLink, fmt0, fmt1, fmtDate } from '../utils';

interface DeliveryTabProps {
  projectKey: string | null;
  avatars: Record<string, string>;
}

export function DeliveryTab({ projectKey, avatars: _avatars }: DeliveryTabProps) {
  // ── Tracking state ─────────────────────────────────────────────────────────
  const [carryoverPage, setCarryoverPage] = useState(1);
  const CARRYOVER_PAGE_SIZE = 10;
  const [carryoverSprintsFilter, setCarryoverSprintsFilter] = useState<string>('3');
  const [epicPage, setEpicPage] = useState(1);
  const EPIC_PAGE_SIZE = 10;
  const [epicCompletionFilter, setEpicCompletionFilter] = useState<string>('ALL');
  const [releasePage, setReleasePage] = useState(1);
  const RELEASE_PAGE_SIZE = 10;
  const [releaseStatusFilter, setReleaseStatusFilter] = useState<string>('ALL');
  const [releaseTab, setReleaseTab] = useState<'future' | 'past'>('future');
  const { data: jiraStatus } = useJiraStatus();
  const jiraBase = jiraStatus?.baseUrl?.replace(/\/$/, '') ?? '';

  // ── Forecasting state ──────────────────────────────────────────────────────
  const [backlogSizeInput, setBacklogSizeInput] = useState<number | string>(30);

  // ── Tracking queries ───────────────────────────────────────────────────────
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

  const { data: orphaned } = useQuery({
    queryKey: ['eng-analytics', 'tracking', 'orphaned-issues', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/tracking/orphaned-issues', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data as any[];
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

  // ── Forecasting query ──────────────────────────────────────────────────────
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

  if (carryoverLoading || epicLoading || relLoading) return <Loader />;

  return (
    <Stack gap="lg">
      {/* ── Sprint Carryover ──────────────────────────────────────────────── */}
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

      {/* ── Epic Burndown ──────────────────────────────────────────────────── */}
      {Array.isArray(epicBd) && epicBd.length > 0 && (() => {
        const orphanedEpicKeys = new Set<string>(
          (Array.isArray(orphaned) ? orphaned : []).map((i: any) => i.epic_key).filter(Boolean)
        );
        return (
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
                      const hasOrphans = orphanedEpicKeys.has(epic.epic_key);
                      return (
                        <Table.Tr key={epic.epic_key}>
                          <Table.Td>
                            <Text component="a" href={jiraLink(epic.epic_key)} target="_blank"
                              size="xs" ff="monospace" c="blue" td="underline">
                              {epic.epic_key}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              <Text size="xs" lineClamp={1} style={{ minWidth: 0 }}>{epic.epic_name || '—'}</Text>
                              {hasOrphans && (
                                <Tooltip label="This epic is closed but has open issues" withArrow>
                                  <Badge size="xs" color="orange" variant="filled" style={{ flexShrink: 0, cursor: 'default' }}>
                                    open work
                                  </Badge>
                                </Tooltip>
                              )}
                            </Group>
                          </Table.Td>
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
        );
      })()}

      {/* ── Orphaned Work ─────────────────────────────────────────────────── */}
      {Array.isArray(orphaned) && orphaned.length > 0 && (() => {
        const byEpic: Record<string, { epicName: string; epicStatus: string; issues: any[] }> = {};
        orphaned.forEach((issue: any) => {
          const key = issue.epic_key ?? '—';
          if (!byEpic[key]) byEpic[key] = { epicName: issue.epic_name ?? key, epicStatus: issue.epic_status, issues: [] };
          byEpic[key].issues.push(issue);
        });
        return (
          <MetricCard
            title="Orphaned Work"
            description={`${orphaned.length} open issue${orphaned.length !== 1 ? 's' : ''} under closed epics`}
          >
            <Stack gap="md">
              {Object.entries(byEpic).map(([epicKey, group]) => (
                <div key={epicKey}>
                  <Group gap="xs" mb="xs">
                    <Text
                      component="a"
                      href={jiraBase ? `${jiraBase}/browse/${epicKey}` : '#'}
                      target="_blank"
                      rel="noreferrer"
                      size="xs"
                      ff="monospace"
                      fw={700}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {epicKey}
                    </Text>
                    <Text size="xs" fw={600} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.epicName}
                    </Text>
                    <Badge size="xs" color="green" variant="light">Epic Closed</Badge>
                    <Badge size="xs" color="orange" variant="filled">{group.issues.length} open</Badge>
                  </Group>
                  <Table striped style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 110 }} />
                      <col />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 120 }} />
                    </colgroup>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Key</Table.Th>
                        <Table.Th>Summary</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Priority</Table.Th>
                        <Table.Th>Assignee</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {group.issues.map((issue: any) => (
                        <Table.Tr key={issue.issue_key}>
                          <Table.Td>
                            <Text
                              component="a"
                              href={jiraBase ? `${jiraBase}/browse/${issue.issue_key}` : '#'}
                              target="_blank" rel="noreferrer"
                              size="xs" ff="monospace"
                              style={{ color: '#1c7ed6', fontWeight: 600, textDecoration: 'none' }}
                            >
                              {issue.issue_key}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ overflow: 'hidden' }}>
                            <Tooltip label={issue.summary} openDelay={300} withArrow multiline maw={360}>
                              <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {issue.summary}
                              </Text>
                            </Tooltip>
                          </Table.Td>
                          <Table.Td><Text size="xs" c="dimmed">{issue.issue_type}</Text></Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color={
                              issue.priority_name === 'Highest' || issue.priority_name === 'Critical' ? 'red' :
                              issue.priority_name === 'High' ? 'orange' :
                              issue.priority_name === 'Medium' ? 'yellow' : 'gray'
                            }>
                              {issue.priority_name ?? '—'}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ overflow: 'hidden' }}>
                            <AssigneeCell name={issue.assignee} avatarUrl={issue.assignee_avatar_url} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              ))}
            </Stack>
          </MetricCard>
        );
      })()}

      {/* ── Release Readiness ─────────────────────────────────────────────── */}
      {Array.isArray(relReady) && relReady.length > 0 && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isOverdue = (rel: any) =>
          !rel.released && rel.release_date && new Date(rel.release_date) < today;

        const futureReleases = (relReady as any[]).filter((rel: any) => !rel.released);
        const pastReleases   = (relReady as any[]).filter((rel: any) => !!rel.released);

        const applyStatusFilter = (list: any[]) => list.filter((rel: any) => {
          const pct = Number(rel.completion_pct ?? ((rel.done / rel.total_issues) * 100));
          if (releaseStatusFilter === 'NOT_STARTED') return pct < 10;
          if (releaseStatusFilter === 'IN_PROGRESS') return pct >= 10 && pct <= 90;
          if (releaseStatusFilter === 'NEAR_DONE') return pct > 90;
          return true;
        });

        const activeList = applyStatusFilter(releaseTab === 'future' ? futureReleases : pastReleases);
        const pagedList  = activeList.slice((releasePage - 1) * RELEASE_PAGE_SIZE, releasePage * RELEASE_PAGE_SIZE);

        const fmtReleaseDate = (d: string | null) => {
          if (!d) return null;
          return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        };

        const daysUntil = (d: string | null) => {
          if (!d) return null;
          const diff = new Date(d).getTime() - today.getTime();
          return Math.ceil(diff / 86_400_000);
        };

        return (
          <MetricCard
            title="Release Readiness"
            description="Completion status per release"
          >
            <Tabs
              value={releaseTab}
              onChange={v => { setReleaseTab((v ?? 'future') as 'future' | 'past'); setReleasePage(1); }}
              variant="pills"
              mb="md"
            >
              <Tabs.List>
                <Tabs.Tab value="future">
                  Upcoming
                  {futureReleases.length > 0 && (
                    <Badge size="xs" ml={6} variant="light" color="blue">{futureReleases.length}</Badge>
                  )}
                </Tabs.Tab>
                <Tabs.Tab value="past">
                  Past
                  {pastReleases.length > 0 && (
                    <Badge size="xs" ml={6} variant="light" color="gray">{pastReleases.length}</Badge>
                  )}
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <Group gap="sm" mb="md">
              <SegmentedControl
                value={releaseStatusFilter}
                onChange={(val) => { setReleaseStatusFilter(val); setReleasePage(1); }}
                data={[
                  { value: 'ALL', label: 'All' },
                  { value: 'NOT_STARTED', label: '<10%' },
                  { value: 'IN_PROGRESS', label: '10–90%' },
                  { value: 'NEAR_DONE', label: '>90%' },
                ]}
                size="xs"
              />
            </Group>

            {activeList.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">No releases in this view</Text>
            ) : (
              <>
                <ScrollArea>
                  <Table striped highlightOnHover style={{ tableLayout: 'fixed', minWidth: 580 }}>
                    <colgroup>
                      <col />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 180 }} />
                    </colgroup>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Release</Table.Th>
                        <Table.Th>Board</Table.Th>
                        <Table.Th>{releaseTab === 'future' ? 'Release Date' : 'Released'}</Table.Th>
                        <Table.Th ta="right">Issues</Table.Th>
                        <Table.Th>Completion</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pagedList.map((rel: any) => {
                        const pct = Number(rel.completion_pct ?? ((rel.done / rel.total_issues) * 100));
                        const days = daysUntil(rel.release_date);
                        const overdue = isOverdue(rel);
                        const urgent = !overdue && days !== null && days <= 7 && releaseTab === 'future';
                        const versionUrl = jiraBase && rel.project_key && rel.version_id
                          ? `${jiraBase}/projects/${rel.project_key}/versions/${rel.version_id}`
                          : null;
                        return (
                          <Table.Tr
                            key={rel.version_name}
                            style={overdue ? { backgroundColor: 'rgba(240,62,62,0.05)' } : undefined}
                          >
                            <Table.Td style={{ overflow: 'hidden' }}>
                              <Group gap={6} wrap="nowrap">
                                {versionUrl ? (
                                  <Anchor href={versionUrl} target="_blank" rel="noreferrer" size="xs" fw={600} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {rel.version_name}
                                  </Anchor>
                                ) : (
                                  <Text size="xs" fw={600} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rel.version_name}</Text>
                                )}
                                {overdue && (
                                  <Badge size="xs" color="red" variant="filled" style={{ flexShrink: 0 }}>OVERDUE</Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              {rel.project_key ? (
                                <Badge size="xs" variant="outline" color="gray">{rel.project_key}</Badge>
                              ) : (
                                <Text size="xs" c="dimmed">—</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {rel.release_date ? (
                                <Tooltip label={fmtReleaseDate(rel.release_date) ?? ''} withArrow openDelay={300}>
                                  <Text
                                    size="xs"
                                    fw={overdue || urgent ? 700 : 400}
                                    c={overdue ? 'red' : urgent ? 'red' : undefined}
                                  >
                                    {overdue
                                      ? `${Math.abs(days!)}d ago`
                                      : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days !== null ? `${days}d` : fmtReleaseDate(rel.release_date)}
                                  </Text>
                                </Tooltip>
                              ) : (
                                <Text size="xs" c="dimmed">—</Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="xs" c="dimmed">{rel.done}/{rel.total_issues}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs" wrap="nowrap">
                                <Progress
                                  value={pct}
                                  style={{ flex: 1 }}
                                  size="sm"
                                  color={pct === 100 ? 'green' : overdue ? 'red' : urgent ? 'red' : pct < 10 ? 'red' : 'blue'}
                                />
                                <Text size="xs" fw={600} w={36} ta="right">{pct}%</Text>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
                {activeList.length > RELEASE_PAGE_SIZE && (
                  <Group justify="center" mt="md">
                    <Pagination
                      value={releasePage}
                      onChange={setReleasePage}
                      total={Math.ceil(activeList.length / RELEASE_PAGE_SIZE)}
                      size="sm"
                    />
                  </Group>
                )}
              </>
            )}
          </MetricCard>
        );
      })()}

      {/* ── Monte Carlo Forecasting ────────────────────────────────────────── */}
      <MetricCard
        title="Monte Carlo Forecast"
        description="Simulates thousands of sprint outcomes using historical velocity variance"
      >
        <Stack gap="md">
          <NumberInput
            label="Backlog Size (items)"
            description="Adjust to see how completion estimates change"
            value={backlogSizeInput}
            onChange={setBacklogSizeInput}
            min={1}
            max={500}
            step={5}
            w={250}
          />

          {velLoading ? (
            <Loader size="sm" />
          ) : (
            <>
              <SimpleGrid cols={{ base: 2, md: 4 }}>
                <Paper withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed">50th Percentile</Text>
                  <Text size="xs" c="dimmed" mb={4}>Median — most likely</Text>
                  <Text fw={700} size="xl">
                    {velForecast?.forecast_50th_pct_sprints ? `${velForecast.forecast_50th_pct_sprints} sprints` : '—'}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed">80th Percentile</Text>
                  <Text size="xs" c="dimmed" mb={4}>Optimistic</Text>
                  <Text fw={700} size="xl">
                    {velForecast?.forecast_80th_pct_sprints ? `${velForecast.forecast_80th_pct_sprints} sprints` : '—'}
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed">90th Percentile</Text>
                  <Text size="xs" c="dimmed" mb={4}>Conservative</Text>
                  <Group gap="xs" align="flex-end">
                    <Text fw={700} size="xl">
                      {velForecast?.forecast_90th_pct_sprints ? `${velForecast.forecast_90th_pct_sprints} sprints` : '—'}
                    </Text>
                    {velForecast?.forecast_90th_pct_sprints && velForecast?.forecast_50th_pct_sprints &&
                      velForecast.forecast_90th_pct_sprints > velForecast.forecast_50th_pct_sprints && (
                        <Badge size="xs" color="orange">
                          +{velForecast.forecast_90th_pct_sprints - velForecast.forecast_50th_pct_sprints} buffer
                        </Badge>
                      )}
                  </Group>
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed">Avg Velocity</Text>
                  <Text size="xs" c="dimmed" mb={4}>Sprint throughput</Text>
                  <Text fw={700} size="xl">
                    {velForecast?.avg_velocity ? `${fmt1(velForecast.avg_velocity)} SP` : '—'}
                  </Text>
                </Paper>
              </SimpleGrid>
            </>
          )}
        </Stack>
      </MetricCard>

      {/* ── Glossary ──────────────────────────────────────────────────────── */}
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
              <div>
                <Text fw={600} size="sm">Monte Carlo Simulation</Text>
                <Text size="xs" c="dimmed">Runs thousands of simulated sprint sequences using historical velocity variance. Each percentile = % of simulations finishing by that sprint count.</Text>
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
