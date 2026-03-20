import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Paper,
  Progress, Loader, Alert, ThemeIcon, Divider, SimpleGrid,
  ActionIcon, Tooltip, Modal, ScrollArea, Table, TextInput,
} from '@mantine/core';
import {
  IconChartBar, IconArrowLeft, IconExternalLink,
  IconAlertTriangle, IconTicket, IconClockHour4,
  IconCircleCheck, IconList, IconCircleDot,
  IconSquareCheck, IconTrendingUp, IconSearch, IconX,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useJiraPods, useJiraStatus, usePodVelocity, useSprintIssues, SprintIssueRow } from '../api/jira';

const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';
const AMBER     = '#F59E0B';
const GREEN     = '#22C55E';
const RED       = '#EF4444';
const GRAY      = '#94A3B8';

const TYPE_COLORS = [
  '#7C3AED', '#0C2340', '#1F9196', '#DB2777', '#D97706',
  '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D',
];

const STATUS_CAT_BG: Record<string, string> = {
  'In Progress': '#FEF3C7',
  'To Do':       '#F1F5F9',
  'Done':        '#DCFCE7',
};
const STATUS_CAT_COLOR: Record<string, string> = {
  'In Progress': AMBER,
  'To Do':       GRAY,
  'Done':        GREEN,
};

const ISSUE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Story':          { bg: '#EDE9FE', text: '#7C3AED' },
  'Bug':            { bg: '#FEE2E2', text: '#DC2626' },
  'Task':           { bg: '#DBEAFE', text: '#2563EB' },
  'Sub-task':       { bg: '#F1F5F9', text: '#64748B' },
  'Subtask':        { bg: '#F1F5F9', text: '#64748B' },
  'Epic':           { bg: '#FFEDD5', text: '#EA580C' },
  'Improvement':    { bg: '#CCFBF1', text: '#0D9488' },
  'New Feature':    { bg: '#E0F2FE', text: '#0284C7' },
  'Spike':          { bg: '#FEF3C7', text: '#D97706' },
  'Incident':       { bg: '#FEE2E2', text: '#B91C1C' },
  'Change Request': { bg: '#F3E8FF', text: '#9333EA' },
};
function issueTypeStyle(typeName: string) {
  return ISSUE_TYPE_COLORS[typeName] ?? { bg: '#EFF6FF', text: '#3B82F6' };
}
function fmtHours(h: number) {
  if (h === 0) return '—';
  if (h < 1)   return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

// ── Sprint Issues Modal ────────────────────────────────────────────────
function SprintIssueModal({
  opened, onClose, title, issues, jiraBaseUrl, loading,
}: {
  opened: boolean; onClose: () => void;
  title: string; issues: SprintIssueRow[];
  jiraBaseUrl?: string; loading?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = issues.filter(i =>
    !search ||
    i.key.toLowerCase().includes(search.toLowerCase()) ||
    i.summary.toLowerCase().includes(search.toLowerCase()) ||
    i.assignee.toLowerCase().includes(search.toLowerCase()) ||
    i.issueType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      opened={opened} onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>{title}</Text>
          <Badge size="sm" variant="light" color="teal">{filtered.length}</Badge>
        </Group>
      }
      size="90%"
      radius="md"
    >
      {loading ? (
        <Stack align="center" py="xl"><Loader size="sm" /><Text size="sm" c="dimmed">Loading sprint issues…</Text></Stack>
      ) : (
        <>
          <TextInput
            placeholder="Search key, summary, assignee, type…"
            leftSection={<IconSearch size={13} />}
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            rightSection={search ? <IconX size={13} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} /> : null}
            mb="sm" size="xs"
          />
          <ScrollArea h={520}>
            <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Key</Table.Th>
                  <Table.Th>Summary</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Type</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Status</Table.Th>
                  <Table.Th>Assignee</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th ta="center">SP</Table.Th>
                  <Table.Th ta="center">Hours</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(issue => (
                  <Table.Tr key={issue.key}>
                    <Table.Td>
                      {jiraBaseUrl ? (
                        <a href={`${jiraBaseUrl}/browse/${issue.key}`}
                           target="_blank" rel="noreferrer"
                           style={{ color: AGUA, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>
                          {issue.key}
                        </a>
                      ) : (
                        <Text fw={700} c="teal">{issue.key}</Text>
                      )}
                    </Table.Td>
                    <Table.Td><Text lineClamp={2}>{issue.summary}</Text></Table.Td>
                    <Table.Td>
                      <Tooltip label={`Type: ${issue.issueType}`} withArrow position="top">
                        <Badge
                          size="sm"
                          style={{
                            backgroundColor: issueTypeStyle(issue.issueType).bg,
                            color: issueTypeStyle(issue.issueType).text,
                            border: `1px solid ${issueTypeStyle(issue.issueType).text}33`,
                            cursor: 'default',
                          }}
                        >
                          {issue.issueType}
                        </Badge>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm" variant="light"
                        style={{
                          backgroundColor: STATUS_CAT_BG[issue.statusCategory] ?? '#F1F5F9',
                          color: STATUS_CAT_COLOR[issue.statusCategory] ?? GRAY,
                          border: `1px solid ${STATUS_CAT_COLOR[issue.statusCategory] ?? GRAY}44`,
                        }}
                      >
                        {issue.statusName}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="sm">{issue.assignee}</Text></Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm" variant="light"
                        color={
                          issue.priority === 'Highest' || issue.priority === 'High' ? 'red'
                          : issue.priority === 'Medium' ? 'yellow'
                          : 'gray'
                        }
                      >
                        {issue.priority}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      {issue.storyPoints > 0
                        ? <Text fw={700}>{issue.storyPoints}</Text>
                        : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text fw={issue.hoursLogged > 0 ? 700 : 400} c={issue.hoursLogged > 0 ? 'teal' : 'dimmed'}>
                        {fmtHours(issue.hoursLogged)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {filtered.length === 0 && !loading && (
              <Text c="dimmed" size="sm" ta="center" mt="xl">No issues match the filter.</Text>
            )}
          </ScrollArea>
        </>
      )}
    </Modal>
  );
}

function fmt(iso: string | null) {
  if (!iso) return '?';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}

export default function JiraPodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: status } = useJiraStatus();
  const { data: allPods = [], isLoading, error } = useJiraPods();

  const podId = id ? parseInt(id, 10) : null;
  const pod = useMemo(
    () => allPods.find(p => p.podId === podId) ?? null,
    [allPods, podId]
  );

  const { data: velocity = [], isLoading: loadingVelocity } =
    usePodVelocity(pod?.podId ?? null, !!pod);

  // ── Sprint issues modal state ──────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilter, setModalFilter] = useState<((i: SprintIssueRow) => boolean) | null>(null);

  const { data: sprintIssues = [], isFetching: loadingIssues } =
    useSprintIssues(pod?.podId ?? null, modalOpen);

  const displayedIssues = useMemo(
    () => modalFilter ? sprintIssues.filter(modalFilter) : sprintIssues,
    [sprintIssues, modalFilter]
  );

  function openModal(title: string, filter?: (i: SprintIssueRow) => boolean) {
    setModalTitle(title);
    setModalFilter(filter ? () => filter : null);
    setModalOpen(true);
  }

  const jiraBaseUrl = status?.baseUrl ?? '';

  if (isLoading) {
    return (
      <Box p="xl">
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Loading POD data from Jira…</Text>
        </Stack>
      </Box>
    );
  }

  if (error || !pod) {
    return (
      <Box p="xl">
        <Button
          variant="subtle" size="sm" mb="lg"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate('/jira-pods')}
        >
          Back to POD Dashboard
        </Button>
        <Alert icon={<IconAlertTriangle />} color="orange">
          {error ? String((error as Error).message) : `POD #${id} not found.`}
        </Alert>
      </Box>
    );
  }

  const sprint    = pod.activeSprint;
  const backlogUrl = jiraBaseUrl && pod.boardKeys[0]
    ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${pod.boardKeys[0]}?backlog`
    : null;
  const boardUrl = backlogUrl;

  const velocityData = velocity.map(v => ({
    sprint: v.sprintName.length > 18 ? '…' + v.sprintName.slice(-16) : v.sprintName,
    Committed: v.committedSP,
    Completed: v.completedSP,
  }));

  const typeData = Object.entries(pod.issueTypeBreakdown ?? {}).map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(pod.statusBreakdown ?? {}).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(pod.priorityBreakdown ?? {}).map(([name, value]) => ({ name, value }));

  const memberHours = Object.entries(pod.hoursByMember ?? {})
    .sort(([, a], [, b]) => b - a);
  const maxHours = memberHours[0]?.[1] ?? 1;

  const memberSP = Object.entries(pod.spByMember ?? {})
    .sort(([, a], [, b]) => b - a);
  const maxSP = memberSP[0]?.[1] ?? 1;

  const todoCount = sprint
    ? sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues
    : 0;

  return (
    <Box p="md" maw={1200}>
      {/* Sprint Issues Modal */}
      <SprintIssueModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        issues={displayedIssues}
        jiraBaseUrl={jiraBaseUrl}
        loading={loadingIssues}
      />

      {/* Back + header */}
      <Group mb="md" justify="space-between">
        <Group gap="sm">
          <Button
            variant="subtle" size="sm"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate('/jira-pods')}
          >
            POD Dashboard
          </Button>
          <Text c="dimmed" size="sm">/</Text>
          <ThemeIcon size={32} radius="sm" style={{ backgroundColor: DEEP_BLUE }}>
            <IconTicket size={17} color="white" />
          </ThemeIcon>
          <div>
            <Title order={3} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>
              {pod.podDisplayName}
            </Title>
            <Group gap={4}>
              {pod.boardKeys.map(k => (
                <Badge key={k} size="xs" variant="outline" color="gray">{k}</Badge>
              ))}
            </Group>
          </div>
        </Group>
        <Group gap="xs">
          {backlogUrl && (
            <Button
              size="xs" variant="light"
              leftSection={<IconExternalLink size={13} />}
              component="a" href={backlogUrl} target="_blank" rel="noreferrer"
            >
              Open Jira Backlog
            </Button>
          )}
        </Group>
      </Group>

      {pod.errorMessage && (
        <Alert icon={<IconAlertTriangle />} color="orange" mb="md">
          {pod.errorMessage}
        </Alert>
      )}

      {/* Sprint summary bar */}
      {sprint && (
        <Paper withBorder p="md" mb="lg" radius="md"
          style={{ background: `linear-gradient(135deg, ${DEEP_BLUE}08, ${AGUA}12)` }}>
          <Group justify="space-between" mb="sm">
            <div>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">Active Sprint</Text>
              <Text fw={700} size="lg" style={{ color: DEEP_BLUE }}>{sprint.name}</Text>
              {sprint.startDate && (
                <Text size="xs" c="dimmed">{fmt(sprint.startDate)} → {fmt(sprint.endDate)}</Text>
              )}
            </div>
            <Badge
              size="lg"
              color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'orange'}
            >
              {Math.round(sprint.spProgressPct)}% Complete
            </Badge>
          </Group>

          <Progress
            value={sprint.spProgressPct} size="lg" radius="xl"
            color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'orange'}
            mb="md"
          />

          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {([
              {
                label: 'Total Issues', value: sprint.totalIssues, color: DEEP_BLUE,
                onClick: () => openModal('All Sprint Issues'),
              },
              {
                label: 'Done', value: sprint.doneIssues, color: GREEN,
                icon: <IconCircleCheck size={15}/>,
                onClick: () => openModal('Done Issues', i => i.statusCategory === 'Done'),
              },
              {
                label: 'In Progress', value: sprint.inProgressIssues, color: AMBER,
                icon: <IconCircleDot size={15}/>,
                onClick: () => openModal('In Progress Issues', i => i.statusCategory === 'In Progress'),
              },
              {
                label: 'To Do', value: todoCount, color: GRAY,
                icon: <IconList size={15}/>,
                onClick: () => openModal('To Do Issues', i => i.statusCategory === 'To Do'),
              },
              {
                label: 'Story Points', value: `${Math.round(sprint.doneSP)} / ${Math.round(sprint.totalSP)}`, color: DEEP_BLUE,
                onClick: () => openModal('Issues with Story Points', i => i.storyPoints > 0),
              },
              {
                label: 'Hours Logged', value: `${Math.round(sprint.hoursLogged)} h`, color: AGUA,
                icon: <IconClockHour4 size={15}/>,
                onClick: () => openModal('Issues with Hours Logged', i => i.hoursLogged > 0),
              },
              {
                label: 'Cycle Time', value: sprint.avgCycleTimeDays > 0 ? `${sprint.avgCycleTimeDays.toFixed(1)} d` : '—', color: '#7C3AED',
                onClick: undefined,
              },
              {
                label: 'Backlog', value: pod.backlogSize, color: RED,
                onClick: undefined,
              },
            ] as const).map(({ label, value, color, icon, onClick }: any) => (
              <Tooltip
                key={label}
                label={onClick ? `Click to view ${label}` : label}
                withArrow
                disabled={!onClick}
              >
                <Group
                  gap="xs"
                  style={{ cursor: onClick ? 'pointer' : 'default' }}
                  onClick={onClick}
                >
                  {icon && <span style={{ color }}>{icon}</span>}
                  <div>
                    <Text size="xs" c="dimmed" fw={500}>{label}</Text>
                    <Text
                      fw={700} size="sm"
                      style={{ color, textDecoration: onClick ? 'underline dotted' : 'none', textUnderlineOffset: 3 }}
                    >
                      {value}
                    </Text>
                  </div>
                </Group>
              </Tooltip>
            ))}
          </SimpleGrid>
        </Paper>
      )}

      {!sprint && !pod.errorMessage && (
        <Alert icon={<IconAlertTriangle />} color="orange" mb="lg">
          No active sprint found for this POD.
        </Alert>
      )}

      {/* Charts grid */}
      <SimpleGrid cols={{ base: 1, md: 2 }} mb="lg">

        {/* Velocity chart */}
        <Paper withBorder p="md" radius="md">
          <Text fw={700} size="sm" style={{ color: DEEP_BLUE }} mb="md">
            Sprint Velocity
          </Text>
          {loadingVelocity ? (
            <Stack align="center" py="md"><Loader size="xs" /></Stack>
          ) : velocityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="sprint" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RTooltip formatter={(v: number, n: string) => [`${v} SP`, n]} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Committed" fill={GRAY} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Completed" fill={AGUA} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">No closed sprints data</Text>
          )}
        </Paper>

        {/* Issue type pie */}
        {typeData.length > 0 && (
          <Paper withBorder p="md" radius="md">
            <Text fw={700} size="sm" style={{ color: DEEP_BLUE }} mb="md">
              Issue Types (Active Sprint)
            </Text>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="42%"
                  outerRadius={80} label={({ name, value }) => `${name}: ${value}`}
                  labelLine fontSize={10}>
                  {typeData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                </Pie>
                <RTooltip contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Status breakdown */}
        {statusData.length > 0 && (
          <Paper withBorder p="md" radius="md">
            <Text fw={700} size="sm" style={{ color: DEEP_BLUE }} mb="md">
              Status Breakdown
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RTooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" fill={DEEP_BLUE} radius={[3, 3, 0, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Priority breakdown */}
        {priorityData.length > 0 && (
          <Paper withBorder p="md" radius="md">
            <Text fw={700} size="sm" style={{ color: DEEP_BLUE }} mb="md">
              Priority Breakdown
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RTooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {priorityData.map((entry, i) => {
                    const color = entry.name === 'Highest' || entry.name === 'High' ? RED
                      : entry.name === 'Medium' ? AMBER
                      : entry.name === 'Low' || entry.name === 'Lowest' ? GREEN
                      : GRAY;
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}
      </SimpleGrid>

      {/* Team section */}
      {(memberHours.length > 0 || memberSP.length > 0) && (
        <Paper withBorder p="md" radius="md" mb="lg">
          <Group justify="space-between" mb="md">
            <Text fw={700} size="sm" style={{ color: DEEP_BLUE }}>
              Team Breakdown
            </Text>
            <Badge size="sm" variant="light" color="teal">
              {memberHours.length || memberSP.length} members
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {memberHours.length > 0 && (
              <Stack gap={6}>
                <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Hours Logged</Text>
                {memberHours.map(([name, hours]) => (
                  <Group key={name} gap="xs" wrap="nowrap">
                    <Text size="xs" style={{ width: 140, flexShrink: 0 }} truncate>{name}</Text>
                    <Box style={{ flex: 1 }}>
                      <Progress
                        value={(hours / maxHours) * 100}
                        color={AGUA} size="sm"
                      />
                    </Box>
                    <Text size="xs" c="dimmed" style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
                      {Math.round(hours)}h
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}

            {memberSP.length > 0 && (
              <Stack gap={6}>
                <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Story Points</Text>
                {memberSP.map(([name, sp]) => (
                  <Group key={name} gap="xs" wrap="nowrap">
                    <Text size="xs" style={{ width: 140, flexShrink: 0 }} truncate>{name}</Text>
                    <Box style={{ flex: 1 }}>
                      <Progress
                        value={(sp / maxSP) * 100}
                        color={DEEP_BLUE} size="sm"
                      />
                    </Box>
                    <Text size="xs" c="dimmed" style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
                      {sp} SP
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </SimpleGrid>
        </Paper>
      )}

      {/* Backlog link */}
      {pod.backlogSize > 0 && (
        <Group gap="xs" mb="md">
          <Text size="sm">Backlog: <strong>{pod.backlogSize}</strong> items</Text>
          {backlogUrl && (
            <Tooltip label="Open Jira backlog">
              <ActionIcon size="sm" variant="subtle"
                component="a" href={backlogUrl} target="_blank" rel="noreferrer">
                <IconExternalLink size={13} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      )}
    </Box>
  );
}
