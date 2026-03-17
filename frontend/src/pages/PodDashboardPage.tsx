import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Grid, Paper,
  Progress, Loader, Alert, ThemeIcon, RingProgress, Tooltip,
  ActionIcon, Collapse, TextInput, SegmentedControl, Divider,
} from '@mantine/core';
import {
  IconTicket, IconRefresh, IconAlertTriangle, IconCircleCheck,
  IconChevronDown, IconChevronUp, IconUsers, IconClockHour4,
  IconChartBar, IconSearch, IconTrendingUp, IconList,
  IconCircleDot, IconSquareCheck,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useJiraStatus, useJiraPods, PodMetrics, SprintVelocity } from '../api/jira';

const DEEP_BLUE = '#0C2340';
const AGUA = '#1F9196';
const AMBER = '#F59E0B';
const GREEN = '#22C55E';
const RED = '#EF4444';
const GRAY = '#94A3B8';

// Palette for POD cards
const POD_COLORS = [
  '#0C2340', '#1F9196', '#7C3AED', '#DB2777', '#D97706',
  '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D',
];

export default function PodDashboardPage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const { data: status, isLoading: statusLoading } = useJiraStatus();
  const { data: pods = [], isLoading, refetch, error } = useJiraPods();

  if (statusLoading) return <Loader />;

  if (!status?.configured) {
    return (
      <Box p="xl">
        <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
          Add your Jira credentials to{' '}
          <code>backend/src/main/resources/application-local.yml</code> and restart
          the backend with <code>-Dspring.profiles.active=local</code>.
        </Alert>
      </Box>
    );
  }

  const filtered = pods.filter(p =>
    p.jiraProjectName.toLowerCase().includes(search.toLowerCase()) ||
    p.jiraProjectKey.toLowerCase().includes(search.toLowerCase())
  );

  // Company-wide aggregates
  const totalActiveSprints = pods.filter(p => p.activeSprint).length;
  const totalHours = pods.reduce((s, p) =>
    s + (p.activeSprint?.hoursLogged ?? 0), 0);
  const totalSP = pods.reduce((s, p) =>
    s + (p.activeSprint?.totalSP ?? 0), 0);
  const totalDoneSP = pods.reduce((s, p) =>
    s + (p.activeSprint?.doneSP ?? 0), 0);
  const overallProgress = totalSP > 0 ? (totalDoneSP / totalSP) * 100 : 0;

  return (
    <Box p="md">
      {/* ── Header ── */}
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
            <IconUsers size={22} color="white" />
          </ThemeIcon>
          <div>
            <Title order={3} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>
              POD Performance Dashboard
            </Title>
            <Text size="sm" c="dimmed">
              Live sprint health, velocity &amp; team activity · {pods.length} PODs
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            value={view}
            onChange={v => setView(v as 'cards' | 'table')}
            data={[
              { label: 'Cards', value: 'cards' },
              { label: 'Table', value: 'table' },
            ]}
          />
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={isLoading}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ── Company Summary Bar ── */}
      <Paper withBorder p="md" mb="lg" radius="md"
        style={{ background: `linear-gradient(135deg, ${DEEP_BLUE}08, ${AGUA}12)` }}>
        <Group grow>
          <CompanyStat
            label="Active Sprints"
            value={String(totalActiveSprints)}
            sub={`of ${pods.length} PODs`}
            color={DEEP_BLUE}
            icon={<IconChartBar size={18} />}
          />
          <CompanyStat
            label="Sprint Progress"
            value={`${Math.round(overallProgress)}%`}
            sub={`${Math.round(totalDoneSP)} / ${Math.round(totalSP)} SP`}
            color={AGUA}
            icon={<IconTrendingUp size={18} />}
          />
          <CompanyStat
            label="Hours Logged (Sprint)"
            value={`${Math.round(totalHours).toLocaleString()} h`}
            sub="across active sprints"
            color="#7C3AED"
            icon={<IconClockHour4 size={18} />}
          />
          <CompanyStat
            label="PODs with Backlog"
            value={String(pods.filter(p => p.backlogSize > 0).length)}
            sub={`total ${pods.reduce((s, p) => s + p.backlogSize, 0)} items`}
            color={AMBER}
            icon={<IconList size={18} />}
          />
        </Group>
        {totalSP > 0 && (
          <Box mt="sm">
            <Progress
              value={overallProgress}
              color={overallProgress >= 80 ? 'teal' : overallProgress >= 50 ? 'yellow' : 'red'}
              size="sm"
              radius="xl"
            />
            <Text size="xs" c="dimmed" mt={4}>
              Overall sprint completion across all active PODs
            </Text>
          </Box>
        )}
      </Paper>

      {/* ── Filter bar ── */}
      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search PODs..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          size="sm"
          style={{ width: 240 }}
        />
        <Text size="sm" c="dimmed">{filtered.length} PODs shown</Text>
      </Group>

      {/* ── Error state ── */}
      {error && (
        <Alert icon={<IconAlertTriangle />} color="red" mb="md">
          Failed to load POD metrics: {(error as any)?.message}
        </Alert>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Fetching sprint data from Jira… this may take a moment</Text>
        </Stack>
      )}

      {/* ── Cards or Table ── */}
      {!isLoading && view === 'cards' && (
        <Grid gutter="md">
          {filtered.map((pod, idx) => (
            <Grid.Col key={pod.jiraProjectKey} span={{ base: 12, sm: 6, lg: 4 }}>
              <PodCard pod={pod} color={POD_COLORS[idx % POD_COLORS.length]} />
            </Grid.Col>
          ))}
        </Grid>
      )}

      {!isLoading && view === 'table' && (
        <PodTable pods={filtered} />
      )}
    </Box>
  );
}

// ── POD Card ──────────────────────────────────────────────────────────

function PodCard({ pod, color }: { pod: PodMetrics; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const sprint = pod.activeSprint;

  const topMembers = useMemo(() => {
    const entries = Object.entries(pod.hoursByMember).sort(([, a], [, b]) => b - a);
    return entries.slice(0, 4);
  }, [pod.hoursByMember]);

  const spEntries = useMemo(() => {
    const entries = Object.entries(pod.spByMember).sort(([, a], [, b]) => b - a);
    return entries.slice(0, 4);
  }, [pod.spByMember]);

  const velocityData = pod.velocity.map(v => ({
    sprint: v.sprintName.length > 14 ? v.sprintName.slice(-14) : v.sprintName,
    Committed: v.committedSP,
    Completed: v.completedSP,
  }));

  const avgVelocity = pod.velocity.length > 0
    ? Math.round(pod.velocity.reduce((s, v) => s + v.completedSP, 0) / pod.velocity.length)
    : null;

  return (
    <Paper
      withBorder
      radius="md"
      style={{
        borderTop: `4px solid ${color}`,
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Card Header */}
      <Box p="md" pb="xs">
        <Group justify="space-between" mb={4}>
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" style={{ backgroundColor: color }}>
              <IconTicket size={15} color="white" />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ color: DEEP_BLUE, lineHeight: 1.2 }}>
                {pod.jiraProjectName}
              </Text>
              <Badge size="xs" variant="outline" color="gray">{pod.jiraProjectKey}</Badge>
            </div>
          </Group>
          {pod.errorMessage ? (
            <Tooltip label={pod.errorMessage}>
              <IconAlertTriangle size={16} color={RED} />
            </Tooltip>
          ) : sprint ? (
            <IconCircleCheck size={16} color={GREEN} />
          ) : null}
        </Group>

        {pod.boardName && (
          <Text size="xs" c="dimmed">Board: {pod.boardName}</Text>
        )}
      </Box>

      <Divider />

      {/* Sprint section */}
      <Box p="md">
        {!sprint ? (
          <Text size="sm" c="dimmed" ta="center" py="sm">
            {pod.errorMessage
              ? 'Error loading data'
              : !pod.boardName
              ? 'No Scrum board configured'
              : 'No active sprint'}
          </Text>
        ) : (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">Active Sprint</Text>
              <Badge
                size="xs"
                color={sprint.progressPct >= 80 ? 'teal' : sprint.progressPct >= 50 ? 'yellow' : 'red'}
              >
                {Math.round(sprint.progressPct)}% done
              </Badge>
            </Group>

            <Text size="sm" fw={600} style={{ color: DEEP_BLUE }}>
              {sprint.name}
            </Text>

            {sprint.startDate && (
              <Text size="xs" c="dimmed">
                {formatDate(sprint.startDate)} → {formatDate(sprint.endDate)}
              </Text>
            )}

            {/* Story Points progress */}
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">Story Points</Text>
                <Text size="xs" fw={600}>
                  {Math.round(sprint.doneSP)} / {Math.round(sprint.totalSP)} SP
                </Text>
              </Group>
              <Progress
                value={sprint.spProgressPct}
                color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'orange'}
                size="md"
                radius="xs"
              />
            </Box>

            {/* Issue status pills */}
            <Group gap="xs" mt={2}>
              <StatusPill
                icon={<IconSquareCheck size={11} />}
                label={String(sprint.doneIssues)}
                tooltip="Done"
                color={GREEN}
              />
              <StatusPill
                icon={<IconCircleDot size={11} />}
                label={String(sprint.inProgressIssues)}
                tooltip="In Progress"
                color={AMBER}
              />
              <StatusPill
                icon={<IconList size={11} />}
                label={String(sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues)}
                tooltip="To Do"
                color={GRAY}
              />
              {sprint.hoursLogged > 0 && (
                <StatusPill
                  icon={<IconClockHour4 size={11} />}
                  label={`${Math.round(sprint.hoursLogged)}h`}
                  tooltip="Hours Logged"
                  color={AGUA}
                />
              )}
            </Group>
          </Stack>
        )}
      </Box>

      {/* Stats row */}
      <Box px="md" pb="xs">
        <Group gap="lg">
          {avgVelocity !== null && (
            <div>
              <Text size="xs" c="dimmed">Avg Velocity</Text>
              <Text size="sm" fw={700} style={{ color }}>
                {avgVelocity} SP/sprint
              </Text>
            </div>
          )}
          {pod.backlogSize > 0 && (
            <div>
              <Text size="xs" c="dimmed">Backlog</Text>
              <Text size="sm" fw={700} c="dimmed">{pod.backlogSize} items</Text>
            </div>
          )}
        </Group>
      </Box>

      {/* Expand / Collapse toggle */}
      {(velocityData.length > 0 || topMembers.length > 0) && (
        <>
          <Divider />
          <Box
            px="md"
            py="xs"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setExpanded(e => !e)}
          >
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {expanded ? 'Hide details' : 'Velocity & team breakdown'}
              </Text>
              {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </Group>
          </Box>

          <Collapse in={expanded}>
            <Box px="md" pb="md">
              {/* Velocity chart */}
              {velocityData.length > 0 && (
                <>
                  <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
                    Sprint Velocity (last {velocityData.length} sprints)
                  </Text>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={velocityData} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="sprint" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <RTooltip
                        formatter={(v: number, name: string) => [`${v} SP`, name]}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="Committed" fill={GRAY} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Completed" fill={color} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}

              {/* Team breakdown */}
              {(topMembers.length > 0 || spEntries.length > 0) && (
                <>
                  <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs" mt="sm">
                    Team (current sprint)
                  </Text>
                  <Stack gap={4}>
                    {(topMembers.length > 0 ? topMembers : spEntries).map(([name, val]) => {
                      const isHours = topMembers.length > 0;
                      const maxVal = topMembers.length > 0
                        ? topMembers[0][1]
                        : spEntries[0]?.[1] ?? 1;
                      return (
                        <Group key={name} gap="xs" wrap="nowrap">
                          <Text size="xs" style={{ width: 130, flexShrink: 0 }} truncate>
                            {name}
                          </Text>
                          <Box style={{ flex: 1 }}>
                            <Progress
                              value={(val / (maxVal || 1)) * 100}
                              color={color}
                              size="xs"
                            />
                          </Box>
                          <Text size="xs" c="dimmed" style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>
                            {isHours
                              ? `${Math.round(val as number)}h`
                              : `${val} SP`}
                          </Text>
                        </Group>
                      );
                    })}
                  </Stack>
                </>
              )}
            </Box>
          </Collapse>
        </>
      )}
    </Paper>
  );
}

// ── Table view ────────────────────────────────────────────────────────

function PodTable({ pods }: { pods: PodMetrics[] }) {
  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: DEEP_BLUE }}>
            {['POD', 'Sprint', 'Progress', 'SP Done/Total', 'Hours', 'Issues', 'Avg Velocity', 'Backlog'].map(h => (
              <th key={h} style={{
                color: 'white', padding: '10px 12px', textAlign: 'left',
                fontSize: 12, fontWeight: 600,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pods.map((pod, idx) => {
            const sprint = pod.activeSprint;
            const avgVel = pod.velocity.length > 0
              ? Math.round(pod.velocity.reduce((s, v) => s + v.completedSP, 0) / pod.velocity.length)
              : null;
            return (
              <tr key={pod.jiraProjectKey}
                style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafb' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div>
                    <Text size="sm" fw={600}>{pod.jiraProjectName}</Text>
                    <Badge size="xs" variant="outline">{pod.jiraProjectKey}</Badge>
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint ? (
                    <Text size="sm">{sprint.name}</Text>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </td>
                <td style={{ padding: '10px 12px', minWidth: 120 }}>
                  {sprint ? (
                    <Box>
                      <Progress
                        value={sprint.spProgressPct}
                        color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'orange'}
                        size="sm"
                      />
                      <Text size="xs" c="dimmed" mt={2}>{Math.round(sprint.spProgressPct)}%</Text>
                    </Box>
                  ) : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint
                    ? <Text size="sm">{Math.round(sprint.doneSP)} / {Math.round(sprint.totalSP)}</Text>
                    : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint?.hoursLogged
                    ? <Text size="sm">{Math.round(sprint.hoursLogged)} h</Text>
                    : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint ? (
                    <Group gap={4}>
                      <Badge size="xs" color="teal">{sprint.doneIssues}✓</Badge>
                      <Badge size="xs" color="yellow">{sprint.inProgressIssues}⟳</Badge>
                      <Badge size="xs" color="gray">
                        {sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues}
                      </Badge>
                    </Group>
                  ) : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {avgVel !== null
                    ? <Text size="sm" fw={600}>{avgVel} SP</Text>
                    : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Text size="sm">{pod.backlogSize || '—'}</Text>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Paper>
  );
}

// ── Helper components ─────────────────────────────────────────────────

function CompanyStat({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
  return (
    <Group gap="sm">
      <ThemeIcon size={40} radius="md" style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </ThemeIcon>
      <div>
        <Text size="xs" tt="uppercase" c="dimmed" fw={600}>{label}</Text>
        <Text size="xl" fw={800} style={{ color, lineHeight: 1.1 }}>{value}</Text>
        <Text size="xs" c="dimmed">{sub}</Text>
      </div>
    </Group>
  );
}

function StatusPill({
  icon, label, tooltip, color,
}: {
  icon: React.ReactNode; label: string; tooltip: string; color: string;
}) {
  return (
    <Tooltip label={tooltip}>
      <Badge
        size="sm"
        variant="light"
        leftSection={icon}
        style={{ backgroundColor: `${color}18`, color, borderColor: `${color}30` }}
      >
        {label}
      </Badge>
    </Tooltip>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '?';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}
