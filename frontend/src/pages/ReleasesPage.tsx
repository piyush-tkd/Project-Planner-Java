import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import {
 Box, Title, Text, Group, Stack, Badge, Button, Grid, Paper,
 Progress, Skeleton, Alert, ThemeIcon, Tooltip,
 TextInput, Divider, SimpleGrid, Modal, Table, ScrollArea,
 Tabs, Textarea, ActionIcon, NumberInput, Select,
} from '@mantine/core';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/ui';
import {
 IconTag, IconRefresh, IconAlertTriangle, IconSettings,
 IconSearch, IconPackage, IconClock, IconUser, IconChevronRight,
 IconNotes, IconCheck, IconPencil, IconX, IconTrash,
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
import { useReleases, useCreateRelease, useUpdateRelease, useDeleteRelease } from '../api/releases';
import type { ReleaseCalendarResponse, ReleaseCalendarRequest } from '../types/project';
import ChartCard from '../components/common/ChartCard';
import { AQUA_HEX, DEEP_BLUE_HEX, AQUA, AQUA_TINTS, COLOR_AMBER_DARK, COLOR_BLUE, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_ORANGE_DEEP, COLOR_VIOLET, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY, SURFACE_AMBER, SURFACE_BLUE, SURFACE_BLUE_LIGHT, SURFACE_ERROR_LIGHT, SURFACE_GRAY, SURFACE_LIGHT, SURFACE_ORANGE, SURFACE_VIOLET, TEXT_GRAY, TEXT_SUBTLE } from '../brandTokens';

// ── Issue type colour map ──────────────────────────────────────────────
// Covers the most common Jira issue types. Falls back to a neutral blue.
const ISSUE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
 'Story': { bg: SURFACE_VIOLET, text: COLOR_VIOLET },
 'Bug': { bg: SURFACE_ERROR_LIGHT, text: COLOR_ERROR_DARK },
 'Task': { bg: SURFACE_BLUE_LIGHT, text: COLOR_BLUE_STRONG },
 'Sub-task': { bg: SURFACE_LIGHT, text: TEXT_GRAY },
 'Subtask': { bg: SURFACE_LIGHT, text: TEXT_GRAY },
 'Epic': { bg: SURFACE_ORANGE, text: COLOR_ORANGE_DEEP },
 'Improvement': { bg: '#CCFBF1', text: '#0D9488' },
 'New Feature': { bg: '#E0F2FE', text: '#0284C7' },
 'Spike': { bg: SURFACE_AMBER, text: COLOR_AMBER_DARK },
 'Incident': { bg: SURFACE_ERROR_LIGHT, text: '#B91C1C' },
 'Change Request': { bg: '#F3E8FF', text: '#9333EA' },
};
function issueTypeStyle(typeName: string) {
 return ISSUE_TYPE_COLORS[typeName] ?? { bg: SURFACE_BLUE, text: COLOR_BLUE };
}

const AMBER = COLOR_WARNING;
const GREEN = COLOR_GREEN;
const RED = COLOR_ERROR_STRONG;
const GRAY = TEXT_SUBTLE;

const CHART_COLORS = [
 DEEP_BLUE, AQUA, COLOR_VIOLET, '#DB2777', COLOR_AMBER_DARK,
 COLOR_EMERALD, COLOR_BLUE_STRONG, COLOR_ERROR_DARK, '#0891B2', '#65A30D',
 '#9333EA', COLOR_ORANGE_DEEP,
];

const STATUS_CAT_COLORS: Record<string, string> = {
 'To Do': TEXT_SUBTLE,
 'In Progress': COLOR_WARNING,
 'Done': COLOR_GREEN,
};

const STATUS_CAT_BG: Record<string, string> = {
 'In Progress': SURFACE_AMBER,
 'To Do': SURFACE_LIGHT,
 'Done': '#DCFCE7',
};

function fmtHours(h: number) {
 if (h === 0) return '0h';
 if (h < 1) return `${Math.round(h * 60)}m`;
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
 const isDark = useDarkMode();
 const filtered = filter ? issues.filter(filter.predicate) : issues;

 return (
 <Modal
 opened={opened}
 onClose={onClose}
 title={
 <Text fw={700} style={{ color: isDark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
 {filter?.label ?? 'All Issues'}{' '}
 <Badge size="sm" variant="light" color="teal" ml={6}>{filtered.length}</Badge>
 </Text>
 }
 size="90%"
 radius="md"
 >
 <ScrollArea h={560}>
 <Table fz="xs" highlightOnHover withTableBorder withColumnBorders>
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
 backgroundColor: STATUS_CAT_BG[issue.statusCategory] ?? SURFACE_LIGHT,
 color: STATUS_CAT_COLORS[issue.statusCategory] ?? TEXT_GRAY,
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
 const isDark = useDarkMode();
 const [modalFilter, setModalFilter] = useState<ModalFilter | null>(null);
 const [modalOpen, setModalOpen] = useState(false);
 const [editingNote, setEditingNote] = useState(false);
 const [noteText, setNoteText] = useState(m.notes ?? '');

 const typeData = Object.entries(m.issueTypeBreakdown).map(([name, value]) => ({ name, value }));
 const statusData = Object.entries(m.statusCategoryBreakdown).map(([name, value]) => ({ name, value }));
 const assigneeData = Object.entries(m.assigneeBreakdown)
 .slice(0, 8).map(([name, value]) => ({ name: name.split(' ')[0], value, fullName: name }));
 const hoursData = Object.entries(m.assigneeHoursLogged ?? {})
 .filter(([, h]) => h > 0)
 .slice(0, 8)
 .map(([name, value]) => ({ name: name.split(' ')[0], value: Math.round(value * 10) / 10, fullName: name }));

 const sp = spPct(m);
 const done = donePct(m);
 const doneCount = m.statusCategoryBreakdown?.['Done'] ?? 0;
 const inProgressCount = m.statusCategoryBreakdown?.['In Progress'] ?? 0;
 const todoCount = m.statusCategoryBreakdown?.['To Do'] ?? 0;

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
 <ThemeIcon size={28} radius="sm" style={{ backgroundColor: isDark ? '#4a5568' : DEEP_BLUE }}>
 <IconPackage size={16} color="white" />
 </ThemeIcon>
 <div>
 <Text fw={700} size="sm" style={{ color: isDark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
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
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} />
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
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} />
 <XAxis dataKey="name" tick={{ fontSize: 9 }} />
 <YAxis tick={{ fontSize: 9 }} />
 <RTooltip
 contentStyle={{ fontSize: 11 }}
 formatter={(v: number) => [`${v}h`, 'Hours']}
 />
 <Bar
 dataKey="value" fill={AQUA_HEX} radius={[3, 3, 0, 0]}
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
 <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} />
 <XAxis dataKey="name" tick={{ fontSize: 9 }} />
 <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
 <RTooltip contentStyle={{ fontSize: 11 }} />
 <Bar
 dataKey="value" fill={DEEP_BLUE_HEX} radius={[3, 3, 0, 0]}
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

// ── Release Calendar Table with Inline Editing ────────────────────────────

interface ReleaseTableForm {
  name: string;
  releaseDate: string | null;
  codeFreezeDate: string | null;
  type: string;
  notes: string | null;
}

function ReleaseCalendarTable() {
  const isDark = useDarkMode();
  const { data: releases = [], isLoading } = useReleases();
  const updateMutation = useUpdateRelease();
  const deleteMutation = useDeleteRelease();

  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineForm, setInlineForm] = useState<ReleaseTableForm>({
    name: '', releaseDate: null, codeFreezeDate: null, type: 'REGULAR', notes: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const startInlineEdit = (r: ReleaseCalendarResponse) => {
    setInlineEditId(r.id);
    setInlineForm({
      name: r.name,
      releaseDate: r.releaseDate,
      codeFreezeDate: r.codeFreezeDate,
      type: r.type,
      notes: r.notes,
    });
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  const saveInlineEdit = (r: ReleaseCalendarResponse) => {
    updateMutation.mutate({
      id: r.id,
      data: {
        name: inlineForm.name,
        releaseDate: inlineForm.releaseDate!,
        codeFreezeDate: inlineForm.codeFreezeDate!,
        type: inlineForm.type,
        notes: inlineForm.notes,
      },
    }, {
      onSuccess: () => {
        setInlineEditId(null);
        notifications.show({ title: 'Release updated', message: `${inlineForm.name} saved` });
      },
      onError: () => notifications.show({ title: 'Update failed', message: 'Could not save release changes', color: 'red' }),
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <Paper withBorder radius="md" p="md" mb="lg">
      <Title order={4} mb="md" style={{ fontFamily: FONT_FAMILY }}>Release Calendar</Title>

      {releases.length === 0 ? (
        <Text c="dimmed" size="sm">No releases configured. Create your first release in the Configure tab.</Text>
      ) : (
        <ScrollArea>
          <Table fz="xs" withColumnBorders>
            <Table.Thead style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Release Date</Table.Th>
                <Table.Th>Code Freeze Date</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {releases.map(r => (
                <Table.Tr key={r.id}>
                  <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <TextInput
                        size="xs"
                        value={inlineForm.name}
                        onChange={e => setInlineForm(f => ({ ...f, name: e.target.value }))}
                        style={{ width: 140 }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <Text size="sm" fw={600} style={{ color: AQUA }}>{r.name}</Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={(e: React.MouseEvent) => inlineEditId === r.id && e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <TextInput
                        size="xs"
                        type="date"
                        value={inlineForm.releaseDate ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineForm(f => ({ ...f, releaseDate: e.target.value || null }))}
                        style={{ width: 130 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      />
                    ) : (
                      <Text size="sm">{r.releaseDate}</Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={(e: React.MouseEvent) => inlineEditId === r.id && e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <TextInput
                        size="xs"
                        type="date"
                        value={inlineForm.codeFreezeDate ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInlineForm(f => ({ ...f, codeFreezeDate: e.target.value || null }))}
                        style={{ width: 130 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      />
                    ) : (
                      <Text size="sm">{r.codeFreezeDate}</Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <Select
                        size="xs"
                        data={[
                          { value: 'REGULAR', label: 'Regular' },
                          { value: 'SPECIAL', label: 'Special' },
                        ]}
                        value={inlineForm.type}
                        onChange={v => v && setInlineForm(f => ({ ...f, type: v }))}
                        style={{ minWidth: 100 }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <Badge size="xs" variant="light" color={r.type === 'SPECIAL' ? 'orange' : 'blue'}>
                        {r.type}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <TextInput
                        size="xs"
                        value={inlineForm.notes ?? ''}
                        onChange={e => setInlineForm(f => ({ ...f, notes: e.target.value || null }))}
                        placeholder="Add notes…"
                        style={{ width: 160 }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <Text size="sm" c={r.notes ? 'inherit' : 'dimmed'} lineClamp={1}>
                        {r.notes ?? '—'}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td onClick={e => e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Save">
                          <ActionIcon
                            size="sm" color="green" variant="filled"
                            loading={updateMutation.isPending}
                            onClick={() => saveInlineEdit(r)}
                          >
                            <IconCheck size={13} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel">
                          <ActionIcon size="sm" color="gray" variant="subtle" onClick={cancelInlineEdit}>
                            <IconX size={13} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    ) : (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Quick edit">
                          <ActionIcon size="sm" color="blue" variant="subtle" onClick={() => startInlineEdit(r)}>
                            <IconPencil size={13} />
                          </ActionIcon>
                        </Tooltip>
                        <ActionIcon
                          color="red" variant="subtle" size="sm"
                          onClick={() => setDeleteConfirm(r.id)}
                          loading={deleteMutation.isPending}
                        >
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Delete confirmation */}
      {deleteConfirm !== null && (
        <Modal opened onClose={() => setDeleteConfirm(null)} title="Delete Release" centered>
          <Stack gap="md">
            <Text size="sm">Are you sure you want to delete this release? This action cannot be undone.</Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button
                color="red"
                loading={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(deleteConfirm, {
                    onSuccess: () => {
                      setDeleteConfirm(null);
                      notifications.show({ title: 'Release deleted', message: 'Release removed successfully' });
                    },
                    onError: () => notifications.show({ title: 'Delete failed', message: 'Could not delete release', color: 'red' }),
                  });
                }}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </Paper>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function ReleasesPage() {
 const isDark = useDarkMode();
 const navigate = useNavigate();
 const [search, setSearch] = useState('');
 const [globalModal, setGlobalModal] = useState<{ open: boolean; filter: ModalFilter | null }>({
 open: false, filter: null,
 });

 const openGlobal = (filter: ModalFilter | null) =>
 setGlobalModal({ open: true, filter });

 const { data: status, isLoading: statusLoading } = useJiraStatus();
 const { data: releases = [], isLoading, refetch } = useReleaseMetrics();
 const { data: configs = [] } = useReleaseConfig();
 const clearCache = useClearJiraCache();
 const saveConfig = useSaveReleaseConfig();

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
 clearCache.mutate(undefined, { onSettled: () => refetch(), onSuccess: () => notifications.show({ title: 'Cache cleared', message: 'Release cache refreshed.', color: 'teal' }), onError: (e: unknown) => notifications.show({ title: 'Error', message: (e as Error).message || 'Failed to clear cache.', color: 'red' }) });
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

 const totalIssues = releases.reduce((s, r) => s + r.totalIssues, 0);
 const totalDone = releases.reduce((s, r) => s + (r.statusCategoryBreakdown?.['Done'] ?? 0), 0);
 const overallDonePct = totalIssues > 0 ? Math.round((totalDone / totalIssues) * 100) : 0;
 const totalSP = releases.reduce((s, r) => s + r.totalSP, 0);
 const totalDoneSP = releases.reduce((s, r) => s + r.doneSP, 0);
 const totalHours = releases.reduce((s, r) => s + (r.totalHoursLogged ?? 0), 0);

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
 <ThemeIcon size={38} radius="md" style={{ backgroundColor: isDark ? '#4a5568' : DEEP_BLUE }}>
 <IconTag size={22} color="white" />
 </ThemeIcon>
 <div>
 <Title order={3} style={{ color: isDark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
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

 {/* ── Release Calendar Table (inline editing) ── */}
 <ReleaseCalendarTable />

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
 <Text fw={700} size="xl" style={{ color: isDark ? '#fff' : DEEP_BLUE }}>{totalIssues}</Text>
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
 <Text fw={700} size="xl" style={{ color: isDark ? '#fff' : DEEP_BLUE }}>{totalDoneSP} / {totalSP}</Text>
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
 <Stack gap="xs">{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} radius="sm" />)}</Stack>
 ) : filtered.length === 0 ? (
 <EmptyState
 icon={<IconTag size={40} />}
 title="No releases configured"
 description="Select which Jira fix versions to track for each POD. Use the Configure tab above to add release versions."
 />
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
