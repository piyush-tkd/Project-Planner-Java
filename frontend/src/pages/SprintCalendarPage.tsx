import { useState } from 'react';
import {
  Title, Stack, Group, Button, Table, Badge, Modal, TextInput, Select,
  ActionIcon, Text, Alert, Drawer, Loader, ScrollArea, Anchor, Tooltip,
  Box, SimpleGrid, SegmentedControl, ThemeIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconEdit, IconTrash, IconCalendarEvent, IconInfoCircle,
  IconPackage, IconAlertTriangle, IconExternalLink, IconCheck,
  IconChevronDown, IconChevronUp, IconTag,
} from '@tabler/icons-react';
import { useSprints, useCreateSprint, useUpdateSprint, useDeleteSprint } from '../api/sprints';
import { useSprintCalendarIssues, useJiraStatus, type ReleaseMetrics, type IssueRow } from '../api/jira';
import type { SprintRequest, SprintResponse } from '../types/project';

// ── Shared issue-card colours ─────────────────────────────────────────────────
const DEEP_BLUE = '#0C2340';

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
};
const STATUS_CAT_COLOR: Record<string, string> = {
  'To Do': '#94A3B8', 'In Progress': '#F59E0B', 'Done': '#22C55E',
};
function issueTypeStyle(t: string) {
  return ISSUE_TYPE_COLORS[t] ?? { bg: '#EFF6FF', text: '#3B82F6' };
}

// ── Per-POD issue card ────────────────────────────────────────────────────────
function PodIssueCard({ metrics, jiraBaseUrl }: { metrics: ReleaseMetrics; jiraBaseUrl: string }) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Story' | 'Bug' | 'Task'>('All');

  const stories = metrics.issues.filter(i => i.issueType === 'Story').length;
  const bugs    = metrics.issues.filter(i => i.issueType === 'Bug').length;
  const tasks   = metrics.issues.filter(i => i.issueType === 'Task').length;
  const donePct = metrics.totalIssues > 0
    ? Math.round((metrics.issues.filter(i => i.statusCategory === 'Done').length / metrics.totalIssues) * 100)
    : 0;

  const visible = metrics.issues.filter(i => {
    if (filter === 'All') return true;
    if (filter === 'Story') return i.issueType === 'Story';
    if (filter === 'Bug')   return i.issueType === 'Bug';
    if (filter === 'Task')  return i.issueType === 'Task';
    return true;
  });

  if (metrics.errorMessage) {
    return (
      <Alert icon={<IconAlertTriangle size={14} />} color="red" mb="xs">
        <strong>{metrics.podDisplayName}</strong>: {metrics.errorMessage}
      </Alert>
    );
  }

  return (
    <Box mb="sm" style={{ border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(e => !e)}
        style={{ background: DEEP_BLUE, padding: '10px 14px', cursor: 'pointer' }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text fw={700} c="white" size="sm">{metrics.podDisplayName}</Text>
            {metrics.notes && (
              <Text size="xs" c="rgba(255,255,255,0.6)">· {metrics.notes}</Text>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Badge size="xs" color="violet" variant="light">{stories} Stories</Badge>
            <Badge size="xs" color="red"    variant="light">{bugs} Bugs</Badge>
            <Badge size="xs" color={donePct >= 90 ? 'green' : donePct >= 50 ? 'yellow' : 'gray'} variant="filled">
              {donePct}% Done
            </Badge>
            <ActionIcon variant="subtle" style={{ color: 'white' }} size="sm"
              onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}>
              {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Stats */}
      {expanded && (
        <>
          <SimpleGrid cols={4} p="xs" style={{ borderBottom: '1px solid #e9ecef', background: '#fafafa' }}>
            {[
              { label: 'Total', value: metrics.totalIssues },
              { label: 'SP', value: metrics.totalSP > 0 ? `${metrics.doneSP}/${metrics.totalSP}` : '—' },
              { label: 'Hours', value: metrics.totalHoursLogged > 0 ? `${metrics.totalHoursLogged.toFixed(0)}h` : '—' },
              { label: 'Assignees', value: Object.keys(metrics.assigneeBreakdown).length },
            ].map(({ label, value }) => (
              <Box key={label} ta="center">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">{label}</Text>
                <Text fw={700} size="md" style={{ color: DEEP_BLUE }}>{value}</Text>
              </Box>
            ))}
          </SimpleGrid>

          {/* Filter */}
          <Box px="xs" py={6} style={{ borderBottom: '1px solid #e9ecef', background: '#fafafa' }}>
            <SegmentedControl
              size="xs"
              value={filter}
              onChange={v => setFilter(v as typeof filter)}
              data={[
                { value: 'All',   label: `All (${metrics.totalIssues})` },
                { value: 'Story', label: `Stories (${stories})` },
                { value: 'Bug',   label: `Bugs (${bugs})` },
                { value: 'Task',  label: `Tasks (${tasks})` },
              ]}
            />
          </Box>

          {/* Issue table */}
          {metrics.totalIssues === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">No issues found.</Text>
          ) : (
            <Table fz="xs" withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 90 }}>Key</Table.Th>
                  <Table.Th style={{ minWidth: 70 }}>Type</Table.Th>
                  <Table.Th style={{ minWidth: 320 }}>Summary</Table.Th>
                  <Table.Th style={{ minWidth: 80 }}>Status</Table.Th>
                  <Table.Th style={{ minWidth: 120 }}>Assignee</Table.Th>
                  <Table.Th style={{ minWidth: 40, textAlign: 'right' }}>SP</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((issue: IssueRow) => {
                  const ts = issueTypeStyle(issue.issueType);
                  const sc = STATUS_CAT_COLOR[issue.statusCategory] ?? '#94A3B8';
                  const done = issue.statusCategory === 'Done';
                  return (
                    <Table.Tr key={issue.key} style={{ opacity: done ? 0.75 : 1 }}>
                      <Table.Td>
                        <Group gap={3} wrap="nowrap">
                          <Anchor href={`${jiraBaseUrl}/browse/${issue.key}`} target="_blank" fw={600} size="xs">
                            {issue.key}
                          </Anchor>
                          <IconExternalLink size={10} color="#94A3B8" />
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" style={{ background: ts.bg, color: ts.text, border: `1px solid ${ts.text}33` }}>
                          {issue.issueType}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: 380 }}>
                        <Tooltip label={issue.summary} disabled={issue.summary.length < 70} withArrow multiline w={360}>
                          <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                            {done && <IconCheck size={10} style={{ marginRight: 3, color: '#22C55E', display: 'inline', verticalAlign: 'middle' }} />}
                            {issue.summary}
                          </Text>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="dot" style={{ '--badge-dot-color': sc } as React.CSSProperties}>
                          {issue.statusName}
                        </Badge>
                      </Table.Td>
                      <Table.Td c="dimmed" size="xs">{issue.assignee}</Table.Td>
                      <Table.Td ta="right">
                        {issue.storyPoints > 0
                          ? <Badge size="xs" variant="outline" color="violet">{issue.storyPoints}</Badge>
                          : <Text size="xs" c="dimmed">—</Text>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {visible.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="sm" size="xs">No issues match filter.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </>
      )}
    </Box>
  );
}

// ── Sprint issues drawer ───────────────────────────────────────────────────────
function SprintIssuesDrawer({
  sprint,
  onClose,
}: {
  sprint: SprintResponse | null;
  onClose: () => void;
}) {
  const { data: jiraStatus } = useJiraStatus();
  const { data, isLoading, isFetching } = useSprintCalendarIssues(
    sprint?.startDate ?? '',
    sprint?.endDate ?? '',
    !!sprint,
  );
  const jiraBaseUrl = jiraStatus?.baseUrl ?? '';

  const hasData = data && data.length > 0;
  const allErrors = hasData && data.every(m => !!m.errorMessage);

  return (
    <Drawer
      opened={!!sprint}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        sprint ? (
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={28} radius="sm" style={{ background: DEEP_BLUE, flexShrink: 0, marginTop: 2 }}>
              <IconPackage size={15} color="white" />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ color: DEEP_BLUE }}>{sprint.name}</Text>
              <Group gap={6} mt={2}>
                <Badge size="xs" color={sprint.type === 'IP_WEEK' ? 'grape' : 'blue'} variant="light">
                  {sprint.type === 'IP_WEEK' ? 'IP Week' : 'Sprint'}
                </Badge>
                <Text size="xs" c="dimmed">
                  {new Date(sprint.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' → '}
                  {new Date(sprint.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                Jira issues from boards whose sprint dates overlap this window
              </Text>
            </div>
          </Group>
        ) : null
      }
      styles={{ body: { padding: '12px 16px' } }}
    >
      {!jiraStatus?.configured && (
        <Alert icon={<IconAlertTriangle size={14} />} color="orange">
          Jira is not configured. Go to Settings → Jira Credentials.
        </Alert>
      )}

      {jiraStatus?.configured && (isLoading || isFetching) && (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">Searching Jira sprints by date…</Text>
        </Group>
      )}

      {jiraStatus?.configured && !isLoading && !isFetching && !hasData && (
        <Alert icon={<IconTag size={14} />} color="blue">
          No Jira sprints found that overlap{' '}
          <strong>{sprint?.startDate} → {sprint?.endDate}</strong>.
          Make sure your POD boards are configured in Settings → Jira Settings.
        </Alert>
      )}

      {jiraStatus?.configured && !isLoading && allErrors && (
        <Alert icon={<IconAlertTriangle size={14} />} color="red">
          {data![0].errorMessage}
        </Alert>
      )}

      {jiraStatus?.configured && !isLoading && hasData && !allErrors && (
        <ScrollArea style={{ height: 'calc(100vh - 120px)' }}>
          <Stack gap="xs">
            {data!.filter(m => !m.errorMessage || m.totalIssues > 0).map(metrics => (
              <PodIssueCard
                key={`${metrics.podId}-${metrics.versionName}`}
                metrics={metrics}
                jiraBaseUrl={jiraBaseUrl}
              />
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Drawer>
  );
}

// ── Sprint form helpers ───────────────────────────────────────────────────────
const typeOptions = [
  { value: 'SPRINT', label: 'Sprint' },
  { value: 'IP_WEEK', label: 'IP Week' },
];

const emptyForm = (): SprintRequest => ({
  name: '',
  type: 'SPRINT',
  startDate: '',
  endDate: '',
  requirementsLockInDate: null,
});

function sprintBadge(type: string) {
  return type === 'IP_WEEK'
    ? <Badge color="grape" variant="light">IP Week</Badge>
    : <Badge color="blue" variant="light">Sprint</Badge>;
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function classifySprint(s: SprintResponse, today: string): 'past' | 'current' | 'upcoming' {
  if (s.endDate < today) return 'past';
  if (s.startDate <= today && s.endDate >= today) return 'current';
  return 'upcoming';
}

// ── Sprint table (rows clickable) ─────────────────────────────────────────────
interface SprintTableProps {
  sprints: SprintResponse[];
  onEdit: (s: SprintResponse) => void;
  onDelete: (id: number) => void;
  onViewIssues: (s: SprintResponse) => void;
  highlight?: boolean;
}

function SprintTable({ sprints, onEdit, onDelete, onViewIssues, highlight }: SprintTableProps) {
  if (sprints.length === 0) return null;
  return (
    <Table withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Sprint</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Start</Table.Th>
          <Table.Th>End</Table.Th>
          <Table.Th>Req. Lock-in</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {sprints.map(s => (
          <Table.Tr
            key={s.id}
            style={{
              background: highlight
                ? 'var(--mantine-color-teal-0)'
                : s.type === 'IP_WEEK'
                  ? 'var(--mantine-color-grape-0)'
                  : undefined,
              cursor: 'pointer',
            }}
            onClick={() => onViewIssues(s)}
          >
            <Table.Td fw={highlight ? 700 : 500}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={highlight ? 700 : 500}>{s.name}</Text>
                {highlight && <Badge size="xs" color="teal" variant="filled">Current</Badge>}
                <Badge size="xs" color="gray" variant="subtle" style={{ cursor: 'pointer' }}>
                  View Issues →
                </Badge>
              </Group>
            </Table.Td>
            <Table.Td>{sprintBadge(s.type)}</Table.Td>
            <Table.Td>{formatDate(s.startDate)}</Table.Td>
            <Table.Td>{formatDate(s.endDate)}</Table.Td>
            <Table.Td c={!s.requirementsLockInDate ? 'dimmed' : undefined}>
              {formatDate(s.requirementsLockInDate)}
            </Table.Td>
            <Table.Td onClick={e => e.stopPropagation()}>
              <Group gap="xs">
                <ActionIcon variant="subtle" onClick={() => onEdit(s)}><IconEdit size={14} /></ActionIcon>
                <ActionIcon color="red" variant="subtle" onClick={() => onDelete(s.id)}><IconTrash size={14} /></ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SprintCalendarPage() {
  const { data: sprints, isLoading } = useSprints();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();

  const [modal, setModal]           = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [form, setForm]             = useState<SprintRequest>(emptyForm());
  const [viewingSprint, setViewingSprint] = useState<SprintResponse | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModal(true);
  };

  const openEdit = (s: SprintResponse) => {
    setEditingId(s.id);
    setForm({
      name: s.name, type: s.type,
      startDate: s.startDate, endDate: s.endDate,
      requirementsLockInDate: s.requirementsLockInDate,
    });
    setModal(true);
  };

  const handleSave = () => {
    if (!form.name || !form.startDate || !form.endDate) return;
    if (editingId) {
      updateSprint.mutate({ id: editingId, data: form }, {
        onSuccess: () => { setModal(false); notifications.show({ title: 'Updated', message: 'Sprint updated', color: 'green' }); },
      });
    } else {
      createSprint.mutate(form, {
        onSuccess: () => { setModal(false); notifications.show({ title: 'Created', message: 'Sprint added', color: 'green' }); },
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteSprint.mutate(id, {
      onSuccess: () => notifications.show({ title: 'Deleted', message: 'Sprint removed', color: 'orange' }),
    });
  };

  const dateVal = (d: string | null) => d ? new Date(d + 'T00:00:00') : null;
  const dateStr = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;

  const today = todayStr();
  const allSprints      = sprints ?? [];
  const pastSprints     = allSprints.filter(s => classifySprint(s, today) === 'past');
  const currentSprints  = allSprints.filter(s => classifySprint(s, today) === 'current');
  const upcomingSprints = allSprints.filter(s => classifySprint(s, today) === 'upcoming');

  return (
    <>
      <Stack>
        <Group justify="space-between">
          <Group gap="sm">
            <IconCalendarEvent size={28} />
            <Title order={2}>Sprint Calendar</Title>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Sprint</Button>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Requirements lock-in and dates shown here are <b>reference guidelines</b> — they are not enforced by the system.
          <b> Click any sprint row</b> to view Jira stories from boards whose sprint dates overlap.
        </Alert>

        {isLoading && <Text c="dimmed" ta="center">Loading...</Text>}

        {currentSprints.length > 0 && (
          <Stack gap="xs">
            <Title order={4} c="teal">🟢 Current Sprint</Title>
            <SprintTable sprints={currentSprints} onEdit={openEdit} onDelete={handleDelete}
              onViewIssues={setViewingSprint} highlight />
          </Stack>
        )}

        {upcomingSprints.length > 0 && (
          <Stack gap="xs">
            <Title order={4} c="blue">📅 Upcoming Sprints</Title>
            <SprintTable sprints={upcomingSprints} onEdit={openEdit} onDelete={handleDelete}
              onViewIssues={setViewingSprint} />
          </Stack>
        )}

        {pastSprints.length > 0 && (
          <Stack gap="xs">
            <Title order={4} c="dimmed">🕘 Past Sprints</Title>
            <SprintTable sprints={pastSprints} onEdit={openEdit} onDelete={handleDelete}
              onViewIssues={setViewingSprint} />
          </Stack>
        )}

        {!isLoading && allSprints.length === 0 && (
          <Text ta="center" c="dimmed" py="md">No sprints defined</Text>
        )}

        <Modal opened={modal} onClose={() => setModal(false)} title={editingId ? 'Edit Sprint' : 'Add Sprint'} size="md">
          <Stack>
            <TextInput label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              required placeholder="Sprint - DD-MMM-YYYY - DD-MMM-YYYY" />
            <Select label="Type" data={typeOptions} value={form.type} onChange={v => setForm({ ...form, type: v ?? 'SPRINT' })} />
            <Group grow>
              <DateInput label="Start Date" value={dateVal(form.startDate)} onChange={d => setForm({ ...form, startDate: dateStr(d) ?? '' })} required valueFormat="MMM DD, YYYY" />
              <DateInput label="End Date" value={dateVal(form.endDate)} onChange={d => setForm({ ...form, endDate: dateStr(d) ?? '' })} required valueFormat="MMM DD, YYYY" />
            </Group>
            <DateInput label="Requirements Lock-in (guideline)" value={dateVal(form.requirementsLockInDate)}
              onChange={d => setForm({ ...form, requirementsLockInDate: dateStr(d) })} clearable valueFormat="MMM DD, YYYY" />
            <Button onClick={handleSave} loading={createSprint.isPending || updateSprint.isPending}>
              {editingId ? 'Save Changes' : 'Add Sprint'}
            </Button>
          </Stack>
        </Modal>
      </Stack>

      {/* ── Jira issues drawer ──────────────────────────────────────────── */}
      <SprintIssuesDrawer sprint={viewingSprint} onClose={() => setViewingSprint(null)} />
    </>
  );
}
