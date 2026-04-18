import { useMemo, useState } from 'react';
import {
  Stack, Group, Text, Badge, Paper, SimpleGrid,
  Progress, ThemeIcon, Alert, Box,
  Divider, Drawer, ScrollArea, Button, Table,
} from '@mantine/core';
import {
  IconAlertTriangle, IconTrendingUp, IconTrendingDown,
  IconMinus, IconExternalLink, IconUsers, IconChevronRight,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useJiraPods, PodMetrics } from '../../api/jira';
import {
  DEEP_BLUE, AQUA, UX_ERROR, UX_POSITIVE, UX_WARNING,
  BORDER_DEFAULT, TEXT_SECONDARY,
} from '../../brandTokens';

// ── helpers ───────────────────────────────────────────────────────────────────

function sprintTimePct(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

type Health = 'ahead' | 'on-track' | 'behind';

function getHealth(workPct: number, timePct: number | null): Health {
  if (timePct === null) return 'on-track';
  const gap = workPct - timePct;
  if (gap >= 5) return 'ahead';
  if (gap <= -10) return 'behind';
  return 'on-track';
}

function healthColor(h: Health) {
  return h === 'ahead' ? UX_POSITIVE : h === 'behind' ? UX_ERROR : UX_WARNING;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── POD team card ─────────────────────────────────────────────────────────────

interface PodTeamCardProps {
  pod: PodMetrics;
  onClick: () => void;
}

function PodTeamCard({ pod, onClick }: PodTeamCardProps) {
  const sp = pod.activeSprint;
  if (!sp) return null;

  const workPct = sp.totalIssues > 0 ? Math.round((sp.doneIssues / sp.totalIssues) * 100) : 0;
  const timePct = sprintTimePct(sp.startDate, sp.endDate);
  const health  = getHealth(workPct, timePct);
  const gap     = timePct !== null ? workPct - timePct : null;

  // Top 3 members by issue count
  const topMembers = Object.entries(pod.memberIssueCount ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Paper
      withBorder p="md" radius="md"
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={700} c={DEEP_BLUE} truncate>{pod.podDisplayName}</Text>
            <Text size="xs" c="dimmed" truncate>{sp.name}</Text>
          </Box>
          <Badge
            size="sm" variant="filled"
            style={{ backgroundColor: healthColor(health) }}
            leftSection={
              health === 'ahead'    ? <IconTrendingUp size={10} /> :
              health === 'behind'   ? <IconTrendingDown size={10} /> :
              <IconMinus size={10} />
            }
          >
            {health === 'ahead' ? 'Ahead' : health === 'behind' ? 'Behind' : 'On Track'}
          </Badge>
        </Group>

        {/* Work% vs Time% */}
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Work done</Text>
            <Text size="xs" fw={600}>{workPct}%</Text>
          </Group>
          <Progress value={workPct} size="sm" color={AQUA} radius="xl" />
          {timePct !== null && (
            <>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Time elapsed</Text>
                <Text size="xs" fw={600}>{timePct}%</Text>
              </Group>
              <Progress value={timePct} size="sm" color={DEEP_BLUE} radius="xl" />
            </>
          )}
          {gap !== null && (
            <Text
              size="xs" ta="right"
              c={gap >= 0 ? 'green' : 'red'}
              fw={600}
            >
              {gap >= 0 ? `+${gap}%` : `${gap}%`} gap
            </Text>
          )}
        </Stack>

        {/* Issue counts */}
        <Group justify="space-between" wrap="nowrap">
          <Box ta="center">
            <Text size="lg" fw={700} c="green">{sp.doneIssues}</Text>
            <Text size="xs" c="dimmed">Done</Text>
          </Box>
          <Box ta="center">
            <Text size="lg" fw={700} c="blue">{sp.inProgressIssues}</Text>
            <Text size="xs" c="dimmed">In Progress</Text>
          </Box>
          <Box ta="center">
            <Text size="lg" fw={700} c="dimmed">{sp.todoIssues}</Text>
            <Text size="xs" c="dimmed">To Do</Text>
          </Box>
          <Box ta="center">
            <Text size="lg" fw={700} c={DEEP_BLUE}>{sp.doneSP} / {sp.totalSP}</Text>
            <Text size="xs" c="dimmed">SP</Text>
          </Box>
        </Group>

        {/* Top members */}
        {topMembers.length > 0 && (
          <>
            <Divider />
            <Stack gap={4}>
              {topMembers.map(([name, count]) => {
                const pct = sp.totalIssues > 0 ? Math.round((count / sp.totalIssues) * 100) : 0;
                return (
                  <Group key={name} justify="space-between" wrap="nowrap">
                    <Text size="xs" truncate style={{ minWidth: 0, flex: 1 }}>{name}</Text>
                    <Group gap={6} wrap="nowrap" style={{ width: 120 }}>
                      <Progress value={pct} size="xs" radius="xl" style={{ flex: 1 }} color={AQUA} />
                      <Text size="xs" c="dimmed">{count}</Text>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          </>
        )}

        <Group justify="flex-end" mt={4}>
          <IconChevronRight size={12} color="gray" />
        </Group>
      </Stack>
    </Paper>
  );
}

// ── POD detail drawer ─────────────────────────────────────────────────────────

function PodDetailDrawer({ pod }: { pod: PodMetrics; onClose: () => void }) {
  const sp = pod.activeSprint!;
  const workPct = sp.totalIssues > 0 ? Math.round((sp.doneIssues / sp.totalIssues) * 100) : 0;
  const timePct = sprintTimePct(sp.startDate, sp.endDate);

  // Velocity chart data
  const velocityData = (pod.velocity ?? []).slice(-6).map(v => ({
    name: v.sprintName.replace(/.*sprint\s*/i, 'S').slice(0, 10),
    committed: v.committedSP,
    completed: v.completedSP,
  }));

  // All members sorted by issue count
  const memberRows = Object.entries(pod.memberIssueCount ?? {})
    .sort((a, b) => b[1] - a[1]);

  const memberHourRows = Object.entries(pod.hoursByMember ?? {})
    .sort((a, b) => b[1] - a[1]);

  // Status breakdown
  const statusRows = Object.entries(pod.statusBreakdown ?? {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <Stack gap="md">
      {/* Sprint summary */}
      <Paper withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Sprint</Text>
            <Text size="xs" fw={600}>{sp.name}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Dates</Text>
            <Text size="xs">{fmtDate(sp.startDate)} → {fmtDate(sp.endDate)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Story Points</Text>
            <Text size="xs" fw={600}>{sp.doneSP} / {sp.totalSP}</Text>
          </Group>
          <Divider />
          <Group justify="space-between" mb={2}>
            <Text size="xs" c="dimmed">Work done</Text>
            <Text size="xs" fw={600}>{workPct}%</Text>
          </Group>
          <Progress value={workPct} size="sm" color={AQUA} radius="xl" />
          {timePct !== null && (
            <>
              <Group justify="space-between" mb={2}>
                <Text size="xs" c="dimmed">Time elapsed</Text>
                <Text size="xs" fw={600}>{timePct}%</Text>
              </Group>
              <Progress value={timePct} size="sm" color={DEEP_BLUE} radius="xl" />
            </>
          )}
        </Stack>
      </Paper>

      {/* Velocity history */}
      {velocityData.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">
            Velocity History (last {velocityData.length} sprints)
          </Text>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={velocityData} barSize={10}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <RechartsTooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(val: number, name: string) => [val, name === 'committed' ? 'Committed' : 'Completed']}
              />
              <Bar dataKey="committed" fill={`${DEEP_BLUE}55`} radius={[2, 2, 0, 0]} />
              <Bar dataKey="completed" fill={AQUA} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Group gap="md" justify="center" mt={4}>
            <Group gap={4}><Box w={10} h={10} style={{ background: `${DEEP_BLUE}55`, borderRadius: 2 }} /><Text size="xs" c="dimmed">Committed</Text></Group>
            <Group gap={4}><Box w={10} h={10} style={{ background: AQUA, borderRadius: 2 }} /><Text size="xs" c="dimmed">Completed</Text></Group>
          </Group>
        </Box>
      )}

      {/* Member issue breakdown */}
      {memberRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">Issues by Member</Text>
          <Stack gap={5}>
            {memberRows.map(([name, count]) => {
              const pct = sp.totalIssues > 0 ? Math.round((count / sp.totalIssues) * 100) : 0;
              return (
                <Group key={name} justify="space-between" wrap="nowrap">
                  <Text size="xs" style={{ minWidth: 120 }} truncate>{name}</Text>
                  <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    <Progress value={pct} size="xs" radius="xl" style={{ flex: 1 }} color={AQUA} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{count} issues</Text>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Hours by member */}
      {memberHourRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">Hours Logged by Member</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member</Table.Th>
                <Table.Th ta="right">Hours</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {memberHourRows.map(([name, hrs]) => (
                <Table.Tr key={name}>
                  <Table.Td><Text size="xs">{name}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="xs" fw={600}>{hrs.toFixed(1)}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      {/* Status breakdown */}
      {statusRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">By Status</Text>
          <Stack gap={5}>
            {statusRows.map(([status, count]) => {
              const pct = sp.totalIssues > 0 ? Math.round((count / sp.totalIssues) * 100) : 0;
              return (
                <Group key={status} justify="space-between" wrap="nowrap">
                  <Text size="xs" style={{ minWidth: 130 }} truncate>{status}</Text>
                  <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    <Progress value={pct} size="xs" radius="xl" style={{ flex: 1 }} color={AQUA} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{count}</Text>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider />
      <Button
        variant="light" size="xs" rightSection={<IconExternalLink size={12} />}
        component="a" href="/sprint-backlog"
      >
        Sprint Backlog
      </Button>
    </Stack>
  );
}

// ── Teams summary table ───────────────────────────────────────────────────────

interface TeamsSummaryTableProps {
  pods: PodMetrics[];
  onRowClick: (pod: PodMetrics) => void;
}

function TeamsSummaryTable({ pods, onRowClick }: TeamsSummaryTableProps) {
  return (
    <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
      <Box p="sm" style={{ borderBottom: `1px solid ${BORDER_DEFAULT}` }}>
        <Text size="sm" fw={600} c={DEEP_BLUE}>All Teams — Side-by-Side</Text>
        <Text size="xs" c="dimmed" mt={2}>Click a row for full breakdown</Text>
      </Box>
      <Box style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover style={{ minWidth: 700 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>POD</Table.Th>
              <Table.Th>Sprint</Table.Th>
              <Table.Th ta="center">Work %</Table.Th>
              <Table.Th ta="center">Time %</Table.Th>
              <Table.Th ta="center">Gap</Table.Th>
              <Table.Th ta="center">Issues</Table.Th>
              <Table.Th ta="center">SP Done</Table.Th>
              <Table.Th ta="center">Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pods.map(pod => {
              const sp = pod.activeSprint!;
              const workPct = sp.totalIssues > 0
                ? Math.round((sp.doneIssues / sp.totalIssues) * 100) : 0;
              const timePct = sprintTimePct(sp.startDate, sp.endDate);
              const gap = timePct !== null ? workPct - timePct : null;
              const health = getHealth(workPct, timePct);
              return (
                <Table.Tr
                  key={pod.podId ?? pod.podDisplayName}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onRowClick(pod)}
                >
                  <Table.Td><Text size="sm" fw={600}>{pod.podDisplayName}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" truncate style={{ maxWidth: 160 }}>{sp.name}</Text></Table.Td>
                  <Table.Td ta="center"><Text size="sm" fw={600}>{workPct}%</Text></Table.Td>
                  <Table.Td ta="center">
                    <Text size="sm" c="dimmed">{timePct !== null ? `${timePct}%` : '—'}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    {gap !== null ? (
                      <Text size="sm" fw={600} c={gap >= 0 ? 'green' : 'red'}>
                        {gap >= 0 ? `+${gap}%` : `${gap}%`}
                      </Text>
                    ) : <Text size="sm" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Text size="xs" c="dimmed">{sp.doneIssues} / {sp.totalIssues}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Text size="xs" c="dimmed">{sp.doneSP} / {sp.totalSP}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge
                      size="xs"
                      color={health === 'ahead' ? 'green' : health === 'behind' ? 'red' : 'yellow'}
                      variant="light"
                    >
                      {health === 'ahead' ? 'Ahead' : health === 'behind' ? 'Behind' : 'On Track'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
    </Paper>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function SprintTeamsTab() {
  const { data: pods = [], isLoading, error } = useJiraPods();
  const [selectedPod, setSelectedPod] = useState<PodMetrics | null>(null);

  const activePods = useMemo(
    () => pods.filter(p => p.activeSprint !== null && !p.errorMessage),
    [pods],
  );

  if (error) {
    return (
      <Alert icon={<IconAlertTriangle size={14} />} color="red" mt="md">
        Failed to load POD data from Jira.
      </Alert>
    );
  }

  if (!isLoading && activePods.length === 0) {
    return (
      <Alert icon={<IconAlertTriangle size={14} />} color="yellow" mt="md">
        No active sprints found across any POD.
      </Alert>
    );
  }

  return (
    <>
      <Stack gap="lg" pb="xl">
        {/* Summary hint */}
        <Box>
          <Text size="sm" fw={600} c={DEEP_BLUE} mb={4}>
            {activePods.length} POD{activePods.length !== 1 ? 's' : ''} with active sprints
          </Text>
          <Text size="xs" style={{ color: TEXT_SECONDARY }}>
            Click any card or row to see velocity history, member breakdown, and status detail.
          </Text>
        </Box>

        {/* POD health cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {activePods.map(pod => (
            <PodTeamCard
              key={pod.podId ?? pod.podDisplayName}
              pod={pod}
              onClick={() => setSelectedPod(pod)}
            />
          ))}
        </SimpleGrid>

        {/* Summary table */}
        {activePods.length > 1 && (
          <TeamsSummaryTable pods={activePods} onRowClick={setSelectedPod} />
        )}
      </Stack>

      {/* Detail drawer */}
      <Drawer
        opened={selectedPod !== null}
        onClose={() => setSelectedPod(null)}
        position="right"
        size="md"
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" size="sm" radius="md" color="blue">
              <IconUsers size={13} />
            </ThemeIcon>
            <Text size="sm" fw={700} c={DEEP_BLUE}>
              {selectedPod?.podDisplayName}
            </Text>
          </Group>
        }
        padding="lg"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {selectedPod && (
          <PodDetailDrawer
            pod={selectedPod}
            onClose={() => setSelectedPod(null)}
          />
        )}
      </Drawer>
    </>
  );
}
