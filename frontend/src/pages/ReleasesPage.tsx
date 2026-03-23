import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Grid, Paper,
  Progress, Loader, Alert, ThemeIcon, Tooltip,
  TextInput, Divider, SimpleGrid, Modal, Table, ScrollArea,
  Tabs, Textarea, ActionIcon,
} from '@mantine/core';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  IconTag, IconRefresh, IconAlertTriangle, IconSettings,
  IconSearch, IconPackage, IconClock, IconUser, IconChevronRight,
  IconNotes, IconCheck,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  useJiraStatus, useReleaseMetrics, useClearJiraCache,
  useSaveReleaseConfig, useReleaseConfig,
  ReleaseMetrics, IssueRow,
} from '../api/jira';
import ChartCard from '../components/common/ChartCard';
import { DEEP_BLUE, AQUA, AQUA_TINTS, FONT_FAMILY } from '../brandTokens';

// ── Issue type colour map ──────────────────────────────────────────────
// Covers the most common Jira issue types. Falls back to a neutral blue.
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

const AMBER     = '#F59E0B';
const GREEN     = '#22C55E';
const RED       = '#EF4444';
const GRAY      = '#94A3B8';

const CHART_COLORS = [
  DEEP_BLUE, AQUA, '#7C3AED', '#DB2777', '#D97706',
  '#059669', '#2563EB', '#DC2626', '#0891B2', '#65A30D',
  '#9333EA', '#EA580C',
];

const STATUS_CAT_COLORS: Record<string, string> = {
  'To Do':       '#94A3B8',
  'In Progress': '#F59E0B',
  'Done':        '#22C55E',
};

const STATUS_CAT_BG: Record<string, string> = {
  'In Progress': '#FEF3C7',
  'To Do':       '#F1F5F9',
  'Done':        '#DCFCE7',
};

function fmtHours(h: number) {
  if (h === 0) return '0h';
  if (h < 1)   return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function spPct(m: ReleaseMetrics) {
  return m.totalSP > 0 ? Math.round((m.doneSP / m.totalSP) * 100) : 0;
}

function donePct(m: ReleaseMetrics) {
  const done = m.statusCategoryBreakdown?.['Done'] ?? 0;
  return m.totalIssues > 0 ? Math.round((done / m.totalIssues) * 100) : 0;
}

// ── Issue List Modal ───────────────────────────────────────────────────

interface ModalFilter {
  label: string;
  predicate: (i: IssueRow) => boolean;
}

function IssueModal({
  opened, onClose, filter, issues, jiraBaseUrl,
}: {
  opened: boolean;
  onClose: () => void;
  filter: ModalFilter | null;
  issues: IssueRow[];
  jiraBaseUrl?: string;
}) {
  const filtered = filter ? issues.filter(filter.predicate) : issues;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
          {filter?.label ?? 'All Issues'}{' '}
          <Badge size="sm" variant="light" color="teal" ml={6}>{filtered.length}</Badge>
        </Text>
      }
      size="90%"
      radius="md"
    >
      <ScrollArea h={560}>
        <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Key</Table.Th>
              <Table.Th>Summary</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Type</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Status</Table.Th>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Assignee</Table.Th>
              <Table.Th ta="center">SP</Table.Th>
              <Table.Th ta="center">Hours</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map(issue => (
              <Table.Tr key={issue.key}>
                <Table.Td>
                  {jiraBaseUrl ? (
                    <a
                      href={`${jiraBaseUrl}/browse/${issue.key}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: AQUA, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}
                    >
                      {issue.key}
                    </a>
                  ) : (
                    <Text fw={700} c="teal">{issue.key}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text lineClamp={2}>{issue.summary}</Text>
                </Table.Td>
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
                    size="sm"
                    variant="light"
                    style={{
                      backgroundColor: STATUS_CAT_BG[issue.statusCategory] ?? '#F1F5F9',
                      color: STATUS_CAT_COLORS[issue.statusCategory] ?? '#64748B',
                      border: `1px solid ${STATUS_CAT_COLORS[issue.statusCategory] ?? '#CBD5E1'}`,
                    }}
                  >
                    {issue.statusName}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text>{issue.assignee}</Text>
                </Table.Td>
                <Table.Td ta="center">
                  {issue.storyPoints > 0 ? (
                    <Text fw={700}>{issue.storyPoints}</Text>
                  ) : (
                    <Text c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td ta="center">
                  {issue.hoursLogged > 0 ? (
                    <Text fw={700} c="teal">{fmtHours(issue.hoursLogged)}</Text>
                  ) : (
                    <Text c="dimmed">—</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {filtered.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" mt="xl">No issues match this filter.</Text>
        )}
      </ScrollArea>
    </Modal>
  );
}

// ── Release Card ──────────────────────────────────────────────────────

function ReleaseCard({
  m, jiraBaseUrl, onNoteSave,
}: {
  m: ReleaseMetrics;
  jiraBaseUrl?: string;
  onNoteSave: (versionName: string, note: string) => void;
}) {
  const [modalFilter, setModalFilter]   = useState<ModalFilter | null>(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingNote, setEditingNote]   = useState(false);
  const [noteText, setNoteText]         = useState(m.notes ?? '');

  const typeData     = Object.entries(m.issueTypeBreakdown).map(([name, value]) => ({ name, value }));
  const statusData   = Object.entries(m.statusCategoryBreakdown).map(([name, value]) => ({ name, value }));
  const assigneeData = Object.entries(m.assigneeBreakdown)
    .slice(0, 8).map(([name, value]) => ({ name: name.split(' ')[0], value, fullName: name }));
  const hoursData    = Object.entries(m.assigneeHoursLogged ?? {})
    .filter(([, h]) => h > 0)
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.split(' ')[0], value: Math.round(value * 10) / 10, fullName: name }));

  const sp    = spPct(m);
  const done  = donePct(m);
  const doneCount       = m.statusCategoryBreakdown?.['Done'] ?? 0;
  const inProgressCount = m.statusCategoryBreakdown?.['In Progress'] ?? 0;
  const todoCount       = m.statusCategoryBreakdown?.['To Do'] ?? 0;

  const openModal = (filter: ModalFilter) => {
    setModalFilter(filter);
    setModalOpen(true);
  };

  const openAll = () => { setModalFilter(null); setModalOpen(true); };

  return (
    <>
      <IssueModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        filter={modalFilter}
        issues={m.issues ?? []}
        jiraBaseUrl={jiraBaseUrl}
      />

      <Paper withBorder p="md" radius="md" style={{ borderTop: `3px solid ${AQUA}` }}>
        {/* ── Card header ── */}
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" style={{ backgroundColor: DEEP_BLUE }}>
              <IconPackage size={16} color="white" />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                {m.podDisplayName}
              </Text>
              <Badge size="xs" variant="light" color="teal">{m.versionName}</Badge>
            </div>
          </Group>
          <Group gap="xs">
            <Tooltip label="View all tickets">
              <Badge
                variant="outline" color="gray" size="sm"
                style={{ cursor: 'pointer' }}
                onClick={openAll}
                rightSection={<IconChevronRight size={10} />}
              >
                {m.totalIssues} issues
              </Badge>
            </Tooltip>
            {m.errorMessage && (
              <Tooltip label={m.errorMessage}>
                <ThemeIcon size={20} color="red" variant="light" radius="xl">
                  <IconAlertTriangle size={12} />
                </ThemeIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {m.errorMessage && m.totalIssues === 0 ? (
          <Alert color="red" icon={<IconAlertTriangle size={14} />}>
            {m.errorMessage}
          </Alert>
        ) : (
          <Tabs defaultValue="overview" variant="pills" radius="sm">
            <Tabs.List mb="sm" grow>
              <Tabs.Tab value="overview" fz="xs">Overview</Tabs.Tab>
              <Tabs.Tab value="types" fz="xs">By Type</Tabs.Tab>
              <Tabs.Tab value="resources" fz="xs">Resources</Tabs.Tab>
              <Tabs.Tab value="notes" fz="xs" leftSection={m.notes ? <IconNotes size={11} /> : undefined}>
                Notes
              </Tabs.Tab>
            </Tabs.List>

            {/* ── Overview tab ── */}
            <Tabs.Panel value="overview">
              <Stack gap="sm">
                {/* Status category counters — clickable */}
                <SimpleGrid cols={3} spacing="xs">
                  <Paper
                    withBorder p="xs" radius="sm" ta="center"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openModal({
                      label: 'Done Issues',
                      predicate: i => i.statusCategory === 'Done',
                    })}
                  >
                    <Text size="xs" c="dimmed">Done</Text>
                    <Text fw={700} size="lg" style={{ color: GREEN }}>{doneCount}</Text>
                  </Paper>
                  <Paper
                    withBorder p="xs" radius="sm" ta="center"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openModal({
                      label: 'In Progress Issues',
                      predicate: i => i.statusCategory === 'In Progress',
                    })}
                  >
                    <Text size="xs" c="dimmed">In Progress</Text>
                    <Text fw={700} size="lg" style={{ color: AMBER }}>{inProgressCount}</Text>
                  </Paper>
                  <Paper
                    withBorder p="xs" radius="sm" ta="center"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openModal({
                      label: 'To Do Issues',
                      predicate: i => i.statusCategory === 'To Do',
                    })}
                  >
                    <Text size="xs" c="dimmed">To Do</Text>
                    <Text fw={700} size="lg" style={{ color: GRAY }}>{todoCount}</Text>
                  </Paper>
                </SimpleGrid>

                {/* Progress bars */}
                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed">Issue Completion</Text>
                    <Text size="xs" fw={600}>{done}%</Text>
                  </Group>
                  <Progress
                    value={done}
                    color={done >= 80 ? 'green' : done >= 50 ? 'yellow' : 'gray'}
                    size="sm" radius="xl"
                  />
                </div>

                {m.totalSP > 0 && (
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs" c="dimmed">Story Points ({m.doneSP} / {m.totalSP} SP)</Text>
                      <Text size="xs" fw={600}>{sp}%</Text>
                    </Group>
                    <Progress
                      value={sp}
                      color={sp >= 80 ? 'green' : sp >= 50 ? 'yellow' : 'blue'}
                      size="sm" radius="xl"
                    />
                  </div>
                )}

                {/* Hours logged summary */}
                {m.totalHoursLogged > 0 && (
                  <Group gap="xs">
                    <IconClock size={13} color={AQUA} />
                    <Text size="xs" c="dimmed">Hours logged:</Text>
                    <Text size="xs" fw={700} style={{ color: AQUA }}>
                      {fmtHours(m.totalHoursLogged)}
                    </Text>
                  </Group>
                )}

                {/* Status pie — clickable slices */}
                {statusData.length > 0 && (
                  <ChartCard title="Status breakdown" minHeight={200}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="38%"
                          outerRadius={55}
                          labelLine={false}
                          onClick={(entry) => openModal({
                            label: `${entry.name} Issues`,
                            predicate: i => i.statusCategory === entry.name,
                          })}
                          style={{ cursor: 'pointer' }}
                        >
                          {statusData.map((entry, i) => (
                            <Cell key={i}
                              fill={STATUS_CAT_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Legend
                          iconType="circle" iconSize={8}
                          formatter={(value) => <span style={{ fontSize: 9 }}>{value}</span>}
                        />
                        <RTooltip contentStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Status detail badges — clickable */}
                {Object.keys(m.statusBreakdown).length > 0 && (
                  <>
                    <Divider />
                    <Group gap="xs" wrap="wrap">
                      {Object.entries(m.statusBreakdown).map(([status, count]) => (
                        <Badge
                          key={status} size="xs" variant="outline" color="gray"
                          style={{ cursor: 'pointer' }}
                          onClick={() => openModal({
                            label: `${status}`,
                            predicate: i => i.statusName === status,
                          })}
                        >
                          {status}: {count}
                        </Badge>
                      ))}
                    </Group>
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            {/* ── By Type tab ── */}
            <Tabs.Panel value="types">
              <Stack gap="sm">
                {/* Summary list — clickable rows */}
                <Stack gap={4}>
                  {Object.entries(m.issueTypeBreakdown).map(([type, count], i) => {
                    const pct = m.totalIssues > 0 ? Math.round((count / m.totalIssues) * 100) : 0;
                    return (
                      <Paper
                        key={type} withBorder p={6} radius="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => openModal({
                          label: `${type} Issues`,
                          predicate: is => is.issueType === type,
                        })}
                      >
                        <Group justify="space-between" mb={3}>
                          <Group gap={6}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }} />
                            <Text size="xs" fw={600}>{type}</Text>
                          </Group>
                          <Group gap={6}>
                            <Text size="xs" c="dimmed">{count} issues</Text>
                            <Text size="xs" c="dimmed">{pct}%</Text>
                          </Group>
                        </Group>
                        <Progress
                          value={pct}
                          color={CHART_COLORS[i % CHART_COLORS.length]}
                          size={5} radius="xl"
                        />
                      </Paper>
                    );
                  })}
                </Stack>

                {/* Bar chart */}
                {typeData.length > 0 && (
                  <>
                    <Divider />
                    <ChartCard title="Issue count by type" minHeight={120}>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={typeData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                          <RTooltip contentStyle={{ fontSize: 11 }} />
                          <Bar
                            dataKey="value" radius={[3, 3, 0, 0]}
                            onClick={(entry) => openModal({
                              label: `${entry.name} Issues`,
                              predicate: i => i.issueType === entry.name,
                            })}
                            style={{ cursor: 'pointer' }}
                          >
                            {typeData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            {/* ── Resources tab ── */}
            <Tabs.Panel value="resources">
              <Stack gap="sm">
                {/* Per-assignee summary rows — clickable */}
                <Stack gap={4}>
                  {Object.entries(m.assigneeBreakdown).map(([name, count]) => {
                    const hours = (m.assigneeHoursLogged ?? {})[name] ?? 0;
                    return (
                      <Paper
                        key={name} withBorder p={6} radius="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => openModal({
                          label: `${name}'s Issues`,
                          predicate: i => i.assignee === name,
                        })}
                      >
                        <Group justify="space-between">
                          <Group gap={6}>
                            <ThemeIcon size={18} radius="xl" color="teal" variant="light">
                              <IconUser size={10} />
                            </ThemeIcon>
                            <Text size="xs" fw={600}>{name}</Text>
                          </Group>
                          <Group gap="md">
                            <Tooltip label="Issues assigned">
                              <Text size="xs" c="dimmed">{count} issues</Text>
                            </Tooltip>
                            {hours > 0 && (
                              <Tooltip label="Hours logged">
                                <Group gap={3}>
                                  <IconClock size={11} color={AQUA} />
                                  <Text size="xs" fw={600} style={{ color: AQUA }}>
                                    {fmtHours(hours)}
                                  </Text>
                                </Group>
                              </Tooltip>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>

                {/* Hours by resource chart */}
                {hoursData.length > 0 && (
                  <>
                    <Divider />
                    <ChartCard title="Hours logged per person" minHeight={100}>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={hoursData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <RTooltip
                            contentStyle={{ fontSize: 11 }}
                            formatter={(v: number) => [`${v}h`, 'Hours']}
                          />
                          <Bar
                            dataKey="value" fill={AQUA} radius={[3, 3, 0, 0]}
                            onClick={(entry) => openModal({
                              label: `${entry.fullName}'s Issues`,
                              predicate: i => i.assignee === entry.fullName,
                            })}
                            style={{ cursor: 'pointer' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </>
                )}

                {/* Assignee issues chart */}
                {assigneeData.length > 0 && (
                  <>
                    <Divider />
                    <ChartCard title="Issues per person" minHeight={100}>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={assigneeData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                          <RTooltip contentStyle={{ fontSize: 11 }} />
                          <Bar
                            dataKey="value" fill={DEEP_BLUE} radius={[3, 3, 0, 0]}
                            onClick={(entry) => openModal({
                              label: `${entry.fullName}'s Issues`,
                              predicate: i => i.assignee === entry.fullName,
                            })}
                            style={{ cursor: 'pointer' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            {/* ── Notes tab ── */}
            <Tabs.Panel value="notes">
              <Stack gap="sm">
                <Text size="xs" c="dimmed">
                  Release notes are saved alongside this tracked version. They appear here and in
                  the Release Settings page.
                </Text>
                {editingNote ? (
                  <>
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.currentTarget.value)}
                      placeholder="Add release notes, goals, scope, caveats…"
                      minRows={5}
                      autosize
                    />
                    <Group gap="xs">
                      <Button
                        size="xs"
                        leftSection={<IconCheck size={13} />}
                        onClick={() => {
                          onNoteSave(m.versionName, noteText);
                          setEditingNote(false);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="xs" variant="subtle" color="gray"
                        onClick={() => { setNoteText(m.notes ?? ''); setEditingNote(false); }}
                      >
                        Cancel
                      </Button>
                    </Group>
                  </>
                ) : (
                  <>
                    {noteText ? (
                      <Paper withBorder p="sm" radius="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        <Text size="sm">{noteText}</Text>
                      </Paper>
                    ) : (
                      <Text size="sm" c="dimmed" fs="italic">No release notes yet.</Text>
                    )}
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconNotes size={13} />}
                      onClick={() => setEditingNote(true)}
                    >
                      {noteText ? 'Edit Notes' : 'Add Notes'}
                    </Button>
                  </>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        )}
      </Paper>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function ReleasesPage() {
  const navigate   = useNavigate();
  const [search, setSearch] = useState('');
  const [globalModal, setGlobalModal] = useState<{ open: boolean; filter: ModalFilter | null }>({
    open: false, filter: null,
  });

  const openGlobal = (filter: ModalFilter | null) =>
    setGlobalModal({ open: true, filter });

  const { data: status, isLoading: statusLoading } = useJiraStatus();
  const { data: releases = [], isLoading, refetch } = useReleaseMetrics();
  const { data: configs = [] } = useReleaseConfig();
  const clearCache   = useClearJiraCache();
  const saveConfig   = useSaveReleaseConfig();

  // Handler: update notes for a single release version, save immediately
  const handleNoteSave = (podId: number | null, versionName: string, note: string) => {
    // Find the config for this pod
    const podConfig = configs.find(c => c.podId === podId);
    if (!podConfig) return;
    const updatedNotes = { ...podConfig.versionNotes, [versionName]: note };
    saveConfig.mutate([{
      podId: podConfig.podId,
      versions: podConfig.versions,
      versionNotes: updatedNotes,
    }]);
  };

  const jiraBaseUrl = status?.baseUrl;

  const handleRefresh = () => {
    clearCache.mutate(undefined, { onSettled: () => refetch() });
  };

  // All issues across every release — used by the global stat card modals
  const allIssues = releases.flatMap(r => r.issues ?? []);

  if (statusLoading) return <LoadingSpinner variant="table" message="Loading Jira releases..." />;

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

  const filtered = releases.filter(r =>
    r.podDisplayName.toLowerCase().includes(search.toLowerCase()) ||
    r.versionName.toLowerCase().includes(search.toLowerCase())
  );

  const totalIssues    = releases.reduce((s, r) => s + r.totalIssues, 0);
  const totalDone      = releases.reduce((s, r) => s + (r.statusCategoryBreakdown?.['Done'] ?? 0), 0);
  const overallDonePct = totalIssues > 0 ? Math.round((totalDone / totalIssues) * 100) : 0;
  const totalSP        = releases.reduce((s, r) => s + r.totalSP, 0);
  const totalDoneSP    = releases.reduce((s, r) => s + r.doneSP, 0);
  const totalHours     = releases.reduce((s, r) => s + (r.totalHoursLogged ?? 0), 0);

  return (
    <Box p="md" className="page-enter stagger-children">
      {/* Global cross-release issue modal */}
      <IssueModal
        opened={globalModal.open}
        onClose={() => setGlobalModal(m => ({ ...m, open: false }))}
        filter={globalModal.filter}
        issues={allIssues}
        jiraBaseUrl={jiraBaseUrl}
      />

      {/* ── Header ── */}
      <Group justify="space-between" mb="lg" className="slide-in-left">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
            <IconTag size={22} color="white" />
          </ThemeIcon>
          <div>
            <Title order={3} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              Release Tracker
            </Title>
            <Text size="sm" c="dimmed">
              Per-release issue breakdown across all configured PODs
              {releases.length > 0 && ` · ${releases.length} tracked release${releases.length !== 1 ? 's' : ''}`}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button
            variant="light" size="sm"
            leftSection={<IconSettings size={15} />}
            onClick={() => navigate('/settings/releases')}
          >
            Configure
          </Button>
          <Button
            variant="light" size="sm"
            leftSection={<IconRefresh size={15} />}
            loading={clearCache.isPending || isLoading}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ── Summary bar — all cards clickable ── */}
      {releases.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm" mb="lg">
          <Tooltip label="Click to see all issues">
            <Paper
              withBorder p="sm" radius="md" ta="center"
              style={{ cursor: 'pointer' }}
              onClick={() => openGlobal(null)}
            >
              <Text size="xs" c="dimmed">Total Issues</Text>
              <Text fw={700} size="xl" style={{ color: DEEP_BLUE }}>{totalIssues}</Text>
            </Paper>
          </Tooltip>
          <Tooltip label="Click to see Done issues">
            <Paper
              withBorder p="sm" radius="md" ta="center"
              style={{ cursor: 'pointer' }}
              onClick={() => openGlobal({
                label: 'Done Issues',
                predicate: i => i.statusCategory === 'Done',
              })}
            >
              <Text size="xs" c="dimmed">Done</Text>
              <Text fw={700} size="xl" style={{ color: GREEN }}>{totalDone}</Text>
            </Paper>
          </Tooltip>
          <Tooltip label="Click to see In Progress issues">
            <Paper
              withBorder p="sm" radius="md" ta="center"
              style={{ cursor: 'pointer' }}
              onClick={() => openGlobal({
                label: 'In Progress Issues',
                predicate: i => i.statusCategory === 'In Progress',
              })}
            >
              <Text size="xs" c="dimmed">Overall Progress</Text>
              <Text fw={700} size="xl" style={{ color: AQUA }}>{overallDonePct}%</Text>
            </Paper>
          </Tooltip>
          <Tooltip label="Click to see issues with story points">
            <Paper
              withBorder p="sm" radius="md" ta="center"
              style={{ cursor: 'pointer' }}
              onClick={() => openGlobal({
                label: 'Issues with Story Points',
                predicate: i => i.storyPoints > 0,
              })}
            >
              <Text size="xs" c="dimmed">Story Points</Text>
              <Text fw={700} size="xl" style={{ color: DEEP_BLUE }}>{totalDoneSP} / {totalSP}</Text>
            </Paper>
          </Tooltip>
          <Tooltip label="Click to see issues with hours logged">
            <Paper
              withBorder p="sm" radius="md" ta="center"
              style={{ cursor: 'pointer' }}
              onClick={() => openGlobal({
                label: 'Issues with Hours Logged',
                predicate: i => i.hoursLogged > 0,
              })}
            >
              <Text size="xs" c="dimmed">Hours Logged</Text>
              <Group justify="center" gap={4} mt={2}>
                <IconClock size={16} color={AQUA} />
                <Text fw={700} size="xl" style={{ color: AQUA }}>{fmtHours(totalHours)}</Text>
              </Group>
            </Paper>
          </Tooltip>
        </SimpleGrid>
      )}

      {/* ── Search ── */}
      <TextInput
        placeholder="Search by POD or version..."
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={e => setSearch(e.currentTarget.value)}
        mb="md"
        w={300}
      />

      {/* ── Content ── */}
      {isLoading ? (
        <Group justify="center" mt="xl">
          <Loader />
          <Text c="dimmed" size="sm">Loading release data from Jira…</Text>
        </Group>
      ) : filtered.length === 0 ? (
        <Alert icon={<IconTag size={16} />} color="blue" title="No releases configured">
          Go to <strong>Configure</strong> to select which release versions to track for each POD.
        </Alert>
      ) : (
        <Grid gutter="md">
          {filtered.map(r => (
            <Grid.Col key={`${r.podId}-${r.versionName}`} span={{ base: 12, md: 6, xl: 4 }}>
              <ReleaseCard
                m={r}
                jiraBaseUrl={jiraBaseUrl}
                onNoteSave={(versionName, note) => handleNoteSave(r.podId, versionName, note)}
              />
            </Grid.Col>
          ))}
        </Grid>
      )}
    </Box>
  );
}
