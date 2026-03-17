import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Grid, Paper,
  Progress, Loader, Alert, ThemeIcon, Tooltip, Collapse,
  TextInput, SegmentedControl, Divider, Modal, Switch, ActionIcon,
  ScrollArea, Table, Checkbox,
} from '@mantine/core';
import {
  IconTicket, IconRefresh, IconAlertTriangle, IconCircleCheck,
  IconChevronDown, IconChevronUp, IconUsers, IconClockHour4,
  IconChartBar, IconSearch, IconTrendingUp, IconList,
  IconCircleDot, IconSquareCheck, IconSettings, IconGripVertical,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts';
import { notifications } from '@mantine/notifications';
import {
  useJiraStatus, useJiraProjects, useJiraPods,
  usePodWatchConfig, useSavePodWatchConfig, usePodVelocity,
  PodMetrics, SprintVelocity, PodWatchRequest,
} from '../api/jira';

const DEEP_BLUE = '#0C2340';
const AGUA = '#1F9196';
const AMBER = '#F59E0B';
const GREEN = '#22C55E';
const RED = '#EF4444';
const GRAY = '#94A3B8';

const POD_COLORS = [
  '#0C2340', '#1F9196', '#7C3AED', '#DB2777', '#D97706',
  '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D',
];

export default function PodDashboardPage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [configOpen, setConfigOpen] = useState(false);

  const { data: status, isLoading: statusLoading } = useJiraStatus();
  const { data: pods = [], isLoading, refetch, error } = useJiraPods();
  const { data: watchConfig = [] } = usePodWatchConfig();

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

  const totalActiveSprints = pods.filter(p => p.activeSprint).length;
  const totalHours   = pods.reduce((s, p) => s + (p.activeSprint?.hoursLogged ?? 0), 0);
  const totalSP      = pods.reduce((s, p) => s + (p.activeSprint?.totalSP ?? 0), 0);
  const totalDoneSP  = pods.reduce((s, p) => s + (p.activeSprint?.doneSP ?? 0), 0);
  const overallPct   = totalSP > 0 ? (totalDoneSP / totalSP) * 100 : 0;

  const isConfigured = watchConfig.length > 0;

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
              Live sprint health &amp; team activity
              {isConfigured
                ? ` · ${watchConfig.filter(w => w.enabled).length} watched PODs`
                : ' · showing all Jira projects (configure below)'}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <SegmentedControl
            size="xs" value={view}
            onChange={v => setView(v as 'cards' | 'table')}
            data={[{ label: 'Cards', value: 'cards' }, { label: 'Table', value: 'table' }]}
          />
          <Button
            size="xs" variant="light"
            leftSection={<IconSettings size={14} />}
            onClick={() => setConfigOpen(true)}
          >
            Configure PODs
          </Button>
          <Button
            size="xs" variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={isLoading}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ── Company Summary Bar ── */}
      {pods.length > 0 && (
        <Paper withBorder p="md" mb="lg" radius="md"
          style={{ background: `linear-gradient(135deg, ${DEEP_BLUE}08, ${AGUA}12)` }}>
          <Group grow>
            <CompanyStat label="Active Sprints" value={String(totalActiveSprints)}
              sub={`of ${pods.length} PODs`} color={DEEP_BLUE} icon={<IconChartBar size={18} />} />
            <CompanyStat label="Sprint Progress" value={`${Math.round(overallPct)}%`}
              sub={`${Math.round(totalDoneSP)} / ${Math.round(totalSP)} SP`}
              color={AGUA} icon={<IconTrendingUp size={18} />} />
            <CompanyStat label="Hours Logged" value={`${Math.round(totalHours).toLocaleString()} h`}
              sub="this sprint" color="#7C3AED" icon={<IconClockHour4 size={18} />} />
            <CompanyStat label="Backlog Items" value={String(pods.reduce((s, p) => s + p.backlogSize, 0))}
              sub={`${pods.filter(p => p.backlogSize > 0).length} PODs with backlog`}
              color={AMBER} icon={<IconList size={18} />} />
          </Group>
          {totalSP > 0 && (
            <Box mt="sm">
              <Progress
                value={overallPct}
                color={overallPct >= 80 ? 'teal' : overallPct >= 50 ? 'yellow' : 'red'}
                size="sm" radius="xl"
              />
            </Box>
          )}
        </Paper>
      )}

      {/* ── Not configured hint ── */}
      {!isConfigured && !isLoading && (
        <Alert icon={<IconInfoCircle />} color="blue" mb="md"
          title="No PODs configured yet">
          Click <strong>Configure PODs</strong> to select which Jira project spaces
          to track and set their POD display names.
        </Alert>
      )}

      {/* ── Filter bar ── */}
      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search PODs…"
          leftSection={<IconSearch size={14} />}
          value={search} onChange={e => setSearch(e.currentTarget.value)}
          size="sm" style={{ width: 240 }}
        />
        <Text size="sm" c="dimmed">{filtered.length} PODs</Text>
      </Group>

      {error && (
        <Alert icon={<IconAlertTriangle />} color="red" mb="md">
          {(error as any)?.message ?? String(error)}
        </Alert>
      )}

      {isLoading && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Fetching sprint data from Jira…</Text>
        </Stack>
      )}

      {!isLoading && view === 'cards' && (
        <Grid gutter="md">
          {filtered.map((pod, idx) => (
            <Grid.Col key={pod.jiraProjectKey} span={{ base: 12, sm: 6, lg: 4 }}>
              <PodCard pod={pod} color={POD_COLORS[idx % POD_COLORS.length]} />
            </Grid.Col>
          ))}
        </Grid>
      )}

      {!isLoading && view === 'table' && <PodTable pods={filtered} />}

      {/* ── Configure Modal ── */}
      <ConfigureModal
        opened={configOpen}
        onClose={() => setConfigOpen(false)}
        currentConfig={watchConfig}
        onRefreshPods={() => refetch()}
      />
    </Box>
  );
}

// ── Configure Modal ───────────────────────────────────────────────────

function ConfigureModal({
  opened, onClose, currentConfig, onRefreshPods,
}: {
  opened: boolean;
  onClose: () => void;
  currentConfig: Array<{ id: number; jiraProjectKey: string; podDisplayName: string; enabled: boolean }>;
  onRefreshPods: () => void;
}) {
  const { data: jiraProjects = [], isLoading: loadingProjects, refetch: refetchJira } = useJiraProjects();
  const save = useSavePodWatchConfig();

  // Build editable rows: merge jira projects with existing config
  const [rows, setRows] = useState<PodWatchRequest[]>(() => initRows(currentConfig, jiraProjects));

  // Re-init when projects load or modal opens
  const computedRows = useMemo(
    () => initRows(currentConfig, jiraProjects),
    [currentConfig, jiraProjects]
  );

  const [localRows, setLocalRows] = useState<PodWatchRequest[]>(computedRows);

  // Sync when modal opens
  const handleOpen = () => setLocalRows(computedRows);

  const toggle = (key: string) =>
    setLocalRows(r => r.map(row => row.jiraProjectKey === key ? { ...row, enabled: !row.enabled } : row));

  const rename = (key: string, name: string) =>
    setLocalRows(r => r.map(row => row.jiraProjectKey === key ? { ...row, podDisplayName: name } : row));

  const handleSave = async () => {
    try {
      await save.mutateAsync(localRows);
      notifications.show({ message: 'POD watchlist saved', color: 'teal' });
      onRefreshPods();
      onClose();
    } catch (e) {
      notifications.show({ message: 'Save failed', color: 'red' });
    }
  };

  const enabledCount = localRows.filter(r => r.enabled).length;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onEntered={handleOpen}
      title={
        <Group gap="xs">
          <IconSettings size={18} />
          <Text fw={700} style={{ color: DEEP_BLUE }}>Configure POD Watchlist</Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Select which Jira project spaces to show in the POD Dashboard
            and customize their display names.
          </Text>
          <Badge color="teal">{enabledCount} enabled</Badge>
        </Group>

        {loadingProjects ? (
          <Stack align="center" py="md"><Loader size="sm" /><Text size="sm" c="dimmed">Loading Jira projects…</Text></Stack>
        ) : (
          <ScrollArea mah={460}>
            <Table verticalSpacing={6} highlightOnHover>
              <Table.Thead style={{ backgroundColor: '#f8fafb' }}>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>On</Table.Th>
                  <Table.Th>Jira Space</Table.Th>
                  <Table.Th>POD Display Name</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {localRows.map(row => (
                  <Table.Tr key={row.jiraProjectKey}
                    style={{ opacity: row.enabled ? 1 : 0.45 }}>
                    <Table.Td>
                      <Checkbox
                        checked={row.enabled}
                        onChange={() => toggle(row.jiraProjectKey)}
                        size="sm"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge size="xs" variant="outline" color="blue">
                          {row.jiraProjectKey}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {jiraProjects.find(p => p.key === row.jiraProjectKey)?.name ?? ''}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        value={row.podDisplayName}
                        onChange={e => rename(row.jiraProjectKey, e.currentTarget.value)}
                        placeholder={row.jiraProjectKey}
                        disabled={!row.enabled}
                        style={{ maxWidth: 220 }}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        <Group justify="space-between" pt="xs">
          <Button size="xs" variant="subtle" leftSection={<IconRefresh size={13} />}
            loading={loadingProjects} onClick={() => refetchJira()}>
            Reload Jira Spaces
          </Button>
          <Group gap="xs">
            <Button size="sm" variant="default" onClick={onClose}>Cancel</Button>
            <Button size="sm" style={{ backgroundColor: DEEP_BLUE }}
              loading={save.isPending} onClick={handleSave}>
              Save Watchlist
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

function initRows(
  config: Array<{ jiraProjectKey: string; podDisplayName: string; enabled: boolean }>,
  jiraProjects: Array<{ key: string; name: string }>
): PodWatchRequest[] {
  // Merge: existing config rows first, then any new Jira projects not yet configured
  const configKeys = new Set(config.map(c => c.jiraProjectKey));
  const fromConfig: PodWatchRequest[] = config.map(c => ({
    jiraProjectKey: c.jiraProjectKey,
    podDisplayName: c.podDisplayName,
    enabled: c.enabled,
  }));
  const newProjects: PodWatchRequest[] = jiraProjects
    .filter(p => !configKeys.has(p.key))
    .map(p => ({ jiraProjectKey: p.key, podDisplayName: p.name, enabled: false }));
  return [...fromConfig, ...newProjects];
}

// ── POD Card ──────────────────────────────────────────────────────────

function PodCard({ pod, color }: { pod: PodMetrics; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: velocity = [], isLoading: loadingVelocity } =
    usePodVelocity(pod.jiraProjectKey, expanded);

  const sprint = pod.activeSprint;

  const topMembers = useMemo(() =>
    Object.entries(pod.hoursByMember).sort(([, a], [, b]) => b - a).slice(0, 4),
    [pod.hoursByMember]
  );
  const spEntries = useMemo(() =>
    Object.entries(pod.spByMember).sort(([, a], [, b]) => b - a).slice(0, 4),
    [pod.spByMember]
  );

  const velocityData = velocity.map(v => ({
    sprint: v.sprintName.length > 14 ? '…' + v.sprintName.slice(-12) : v.sprintName,
    Committed: v.committedSP,
    Completed: v.completedSP,
  }));

  return (
    <Paper withBorder radius="md" style={{ borderTop: `4px solid ${color}`, height: '100%' }}>
      {/* Header */}
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
          {pod.errorMessage
            ? <Tooltip label={pod.errorMessage}><IconAlertTriangle size={16} color={RED} /></Tooltip>
            : sprint ? <IconCircleCheck size={16} color={GREEN} /> : null}
        </Group>
        {pod.boardName && <Text size="xs" c="dimmed">Board: {pod.boardName}</Text>}
      </Box>

      <Divider />

      <Box p="md">
        {!sprint ? (
          <Text size="sm" c="dimmed" ta="center" py="sm">
            {pod.errorMessage ? 'Error loading data'
              : !pod.boardName ? 'No Scrum board'
              : 'No active sprint'}
          </Text>
        ) : (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">Active Sprint</Text>
              <Badge size="xs"
                color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'red'}>
                {Math.round(sprint.spProgressPct)}% done
              </Badge>
            </Group>
            <Text size="sm" fw={600} style={{ color: DEEP_BLUE }}>{sprint.name}</Text>
            {sprint.startDate && (
              <Text size="xs" c="dimmed">
                {fmt(sprint.startDate)} → {fmt(sprint.endDate)}
              </Text>
            )}
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">Story Points</Text>
                <Text size="xs" fw={600}>
                  {Math.round(sprint.doneSP)} / {Math.round(sprint.totalSP)} SP
                </Text>
              </Group>
              <Progress value={sprint.spProgressPct} size="md" radius="xs"
                color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'orange'} />
            </Box>
            <Group gap="xs" mt={2}>
              <StatPill icon={<IconSquareCheck size={11} />} label={String(sprint.doneIssues)} tip="Done" color={GREEN} />
              <StatPill icon={<IconCircleDot size={11} />} label={String(sprint.inProgressIssues)} tip="In Progress" color={AMBER} />
              <StatPill icon={<IconList size={11} />}
                label={String(sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues)} tip="To Do" color={GRAY} />
              {sprint.hoursLogged > 0 && (
                <StatPill icon={<IconClockHour4 size={11} />}
                  label={`${Math.round(sprint.hoursLogged)}h`} tip="Hours Logged" color={AGUA} />
              )}
            </Group>
          </Stack>
        )}
      </Box>

      {pod.backlogSize > 0 && (
        <Box px="md" pb="xs">
          <Text size="xs" c="dimmed">Backlog: <strong>{pod.backlogSize}</strong> items</Text>
        </Box>
      )}

      {/* Expand for velocity + team */}
      <Divider />
      <Box px="md" py="xs" style={{ cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {expanded ? 'Hide' : 'Velocity & team breakdown'}
          </Text>
          {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </Group>
      </Box>

      <Collapse in={expanded}>
        <Box px="md" pb="md">
          {loadingVelocity ? (
            <Stack align="center" py="sm"><Loader size="xs" /><Text size="xs" c="dimmed">Loading velocity…</Text></Stack>
          ) : velocityData.length > 0 ? (
            <>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">
                Velocity (last {velocityData.length} sprints)
              </Text>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={velocityData} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="sprint" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <RTooltip formatter={(v: number, n: string) => [`${v} SP`, n]} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Committed" fill={GRAY} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Completed" fill={color} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <Text size="xs" c="dimmed" ta="center">No closed sprints found</Text>
          )}

          {(topMembers.length > 0 || spEntries.length > 0) && (
            <>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs" mt="sm">Team (current sprint)</Text>
              <Stack gap={4}>
                {(topMembers.length > 0 ? topMembers : spEntries).map(([name, val]) => {
                  const isHours = topMembers.length > 0;
                  const maxVal = (topMembers.length > 0 ? topMembers : spEntries)[0]?.[1] ?? 1;
                  return (
                    <Group key={name} gap="xs" wrap="nowrap">
                      <Text size="xs" style={{ width: 130, flexShrink: 0 }} truncate>{name}</Text>
                      <Box style={{ flex: 1 }}>
                        <Progress value={(Number(val) / Number(maxVal)) * 100} color={color} size="xs" />
                      </Box>
                      <Text size="xs" c="dimmed" style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>
                        {isHours ? `${Math.round(val as number)}h` : `${val} SP`}
                      </Text>
                    </Group>
                  );
                })}
              </Stack>
            </>
          )}
        </Box>
      </Collapse>
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
            {['POD', 'Sprint', 'Progress', 'SP Done/Total', 'Hours', 'Issues', 'Backlog'].map(h => (
              <th key={h} style={{ color: 'white', padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pods.map((pod, idx) => {
            const sprint = pod.activeSprint;
            return (
              <tr key={pod.jiraProjectKey} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafb' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div>
                    <Text size="sm" fw={600}>{pod.jiraProjectName}</Text>
                    <Badge size="xs" variant="outline">{pod.jiraProjectKey}</Badge>
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint ? <Text size="sm">{sprint.name}</Text> : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px', minWidth: 120 }}>
                  {sprint ? (
                    <Box>
                      <Progress value={sprint.spProgressPct} size="sm"
                        color={sprint.spProgressPct >= 80 ? 'teal' : sprint.spProgressPct >= 50 ? 'yellow' : 'orange'} />
                      <Text size="xs" c="dimmed" mt={2}>{Math.round(sprint.spProgressPct)}%</Text>
                    </Box>
                  ) : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint ? <Text size="sm">{Math.round(sprint.doneSP)} / {Math.round(sprint.totalSP)}</Text>
                    : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint?.hoursLogged ? <Text size="sm">{Math.round(sprint.hoursLogged)} h</Text>
                    : <Text size="sm" c="dimmed">—</Text>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {sprint ? (
                    <Group gap={4}>
                      <Badge size="xs" color="teal">{sprint.doneIssues}✓</Badge>
                      <Badge size="xs" color="yellow">{sprint.inProgressIssues}⟳</Badge>
                      <Badge size="xs" color="gray">{sprint.totalIssues - sprint.doneIssues - sprint.inProgressIssues}</Badge>
                    </Group>
                  ) : <Text size="sm" c="dimmed">—</Text>}
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

function CompanyStat({ label, value, sub, color, icon }: {
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

function StatPill({ icon, label, tip, color }: {
  icon: React.ReactNode; label: string; tip: string; color: string;
}) {
  return (
    <Tooltip label={tip}>
      <Badge size="sm" variant="light" leftSection={icon}
        style={{ backgroundColor: `${color}18`, color, borderColor: `${color}30` }}>
        {label}
      </Badge>
    </Tooltip>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return '?';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}
