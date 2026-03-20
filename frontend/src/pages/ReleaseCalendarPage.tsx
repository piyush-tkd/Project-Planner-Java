import { useState, useEffect } from 'react';
import {
  Title, Stack, Group, Button, Table, Badge, Modal, TextInput, Select, ActionIcon, Text,
  Textarea, Alert, Drawer, ScrollArea, Anchor, Loader, Center, Box, SimpleGrid,
  SegmentedControl, Tooltip, ThemeIcon, Autocomplete,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconEdit, IconTrash, IconRocket, IconInfoCircle, IconExternalLink,
  IconAlertTriangle, IconChevronDown, IconChevronUp, IconCheck, IconPackage,
} from '@tabler/icons-react';
import { useReleases, useCreateRelease, useUpdateRelease, useDeleteRelease } from '../api/releases';
import { useSearchReleaseVersion, useJiraStatus, useAllFixVersions, type ReleaseMetrics, type IssueRow } from '../api/jira';
import type { ReleaseCalendarRequest, ReleaseCalendarResponse } from '../types/project';

// ── Issue-card colours ────────────────────────────────────────────────────────
const DEEP_BLUE = '#0C2340';

const ISSUE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Story':       { bg: '#EDE9FE', text: '#7C3AED' },
  'Bug':         { bg: '#FEE2E2', text: '#DC2626' },
  'Task':        { bg: '#DBEAFE', text: '#2563EB' },
  'Sub-task':    { bg: '#F1F5F9', text: '#64748B' },
  'Subtask':     { bg: '#F1F5F9', text: '#64748B' },
  'Epic':        { bg: '#FFEDD5', text: '#EA580C' },
  'Improvement': { bg: '#CCFBF1', text: '#0D9488' },
  'New Feature': { bg: '#E0F2FE', text: '#0284C7' },
  'Spike':       { bg: '#FEF3C7', text: '#D97706' },
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

      {/* Stats + issues */}
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

          {metrics.totalIssues === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">No issues found for this fix version.</Text>
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
                  const ts   = issueTypeStyle(issue.issueType);
                  const sc   = STATUS_CAT_COLOR[issue.statusCategory] ?? '#94A3B8';
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

// ── Release issues drawer ──────────────────────────────────────────────────────
function ReleaseIssuesDrawer({
  release,
  onClose,
}: {
  release: ReleaseCalendarResponse | null;
  onClose: () => void;
}) {
  const [versionName, setVersionName] = useState('');
  const { data: jiraStatus } = useJiraStatus();
  const jiraBaseUrl = jiraStatus?.baseUrl ?? '';

  // Reset versionName whenever a different release is selected
  useEffect(() => { setVersionName(''); }, [release?.id]);

  // Fetch all Jira fix versions for autocomplete suggestions
  const { data: allFixVersions = [] } = useAllFixVersions();

  // Build autocomplete options — deduplicated version names, sorted
  const versionOptions = Array.from(
    new Set(allFixVersions.map(v => v.name).filter(Boolean))
  ).sort();

  // When the drawer opens for a new release, auto-select the best matching fix version
  const currentVersion = release?.name ?? '';

  // Find best match: exact match first, then case-insensitive, then partial match
  const bestMatch = (() => {
    if (!currentVersion || versionOptions.length === 0) return currentVersion;
    const exact = versionOptions.find(v => v === currentVersion);
    if (exact) return exact;
    const ci = versionOptions.find(v => v.toLowerCase() === currentVersion.toLowerCase());
    if (ci) return ci;
    // Partial: pick version whose name contains the release name words (e.g. "March 2026")
    const words = currentVersion.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const partial = versionOptions.find(v => words.every(w => v.toLowerCase().includes(w)));
    if (partial) return partial;
    return currentVersion;
  })();

  const effectiveVersion = versionName || bestMatch;

  const { data = [], isLoading, isFetching } = useSearchReleaseVersion(effectiveVersion, !!release && effectiveVersion.length > 0);

  const totalIssues = data.reduce((s, m) => s + m.totalIssues, 0);
  const hasData = data.length > 0 && !data.every(m => m.errorMessage);

  return (
    <Drawer
      opened={!!release}
      onClose={() => { setVersionName(''); onClose(); }}
      position="right"
      size="xl"
      title={
        <Group gap="sm" align="center">
          <ThemeIcon color="teal" size="sm" radius="md" variant="light">
            <IconPackage size={14} />
          </ThemeIcon>
          <Text fw={700} size="sm">
            {release?.name} — Jira Issues
          </Text>
          {hasData && (
            <Badge size="sm" color="blue" variant="light">{totalIssues} issues</Badge>
          )}
        </Group>
      }
    >
      <Stack gap="md" h="100%">
        {/* Fix version search — autocomplete with real Jira fix version names */}
        <Autocomplete
          label="Fix Version"
          description="Select a Jira fix version — suggestions are loaded from Jira"
          value={versionName || bestMatch}
          onChange={setVersionName}
          data={versionOptions}
          placeholder="e.g. April 2026 Release"
          limit={20}
          rightSection={
            (isLoading || isFetching)
              ? <Loader size="xs" />
              : undefined
          }
        />

        <ScrollArea style={{ flex: 1 }} type="auto">
          {(isLoading || isFetching) && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <Loader size="sm" />
                <Text size="xs" c="dimmed">Loading Jira issues for "{effectiveVersion}"…</Text>
              </Stack>
            </Center>
          )}

          {!isLoading && !isFetching && data.length === 0 && effectiveVersion && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconAlertTriangle size={28} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">No issues found for fix version "{effectiveVersion}"</Text>
                <Text size="xs" c="dimmed">Try selecting a version from the dropdown above</Text>
              </Stack>
            </Center>
          )}

          {!isLoading && !isFetching && data.map(metrics => (
            <PodIssueCard
              key={`${metrics.podId ?? metrics.podDisplayName}-${metrics.versionName}`}
              metrics={metrics}
              jiraBaseUrl={jiraBaseUrl}
            />
          ))}
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const typeOptions = [
  { value: 'REGULAR', label: 'Regular (Monthly)' },
  { value: 'SPECIAL', label: 'Special / Ad-hoc' },
];

const emptyForm = (): ReleaseCalendarRequest => ({
  name: '',
  releaseDate: '',
  codeFreezeDate: '',
  type: 'REGULAR',
  notes: null,
});

function typeBadge(type: string) {
  return type === 'SPECIAL'
    ? <Badge color="orange" variant="filled">Special</Badge>
    : <Badge color="green" variant="light">Regular</Badge>;
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Release table ─────────────────────────────────────────────────────────────
interface ReleaseTableProps {
  releases: ReleaseCalendarResponse[];
  onEdit: (r: ReleaseCalendarResponse) => void;
  onDelete: (id: number) => void;
  onView: (r: ReleaseCalendarResponse) => void;
  highlightCurrent?: boolean;
}

function ReleaseTable({ releases, onEdit, onDelete, onView, highlightCurrent }: ReleaseTableProps) {
  if (releases.length === 0) return null;
  return (
    <Table withTableBorder withColumnBorders highlightOnHover style={{ cursor: 'pointer' }}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Release</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Code Freeze</Table.Th>
          <Table.Th>Release Date</Table.Th>
          <Table.Th>Notes</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {releases.map(r => (
          <Table.Tr
            key={r.id}
            onClick={() => onView(r)}
            style={{
              background: highlightCurrent
                ? 'var(--mantine-color-teal-0)'
                : r.type === 'SPECIAL'
                  ? 'var(--mantine-color-orange-0)'
                  : undefined,
            }}
          >
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <Text fw={500}>{r.name}</Text>
                <Badge size="xs" color="teal" variant="dot" style={{ opacity: 0.7 }}>View Issues →</Badge>
              </Group>
            </Table.Td>
            <Table.Td>{typeBadge(r.type)}</Table.Td>
            <Table.Td c="dimmed">{formatDate(r.codeFreezeDate)}</Table.Td>
            <Table.Td fw={500}>{formatDate(r.releaseDate)}</Table.Td>
            <Table.Td c="dimmed" size="sm">{r.notes ?? '-'}</Table.Td>
            <Table.Td>
              <Group gap="xs" onClick={e => e.stopPropagation()}>
                <ActionIcon variant="subtle" onClick={() => onEdit(r)}><IconEdit size={14} /></ActionIcon>
                <ActionIcon color="red" variant="subtle" onClick={() => onDelete(r.id)}><IconTrash size={14} /></ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReleaseCalendarPage() {
  const { data: releases, isLoading } = useReleases();
  const createRelease = useCreateRelease();
  const updateRelease = useUpdateRelease();
  const deleteRelease = useDeleteRelease();

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReleaseCalendarRequest>(emptyForm());

  // Drawer state
  const [drawerRelease, setDrawerRelease] = useState<ReleaseCalendarResponse | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModal(true);
  };

  const openEdit = (r: ReleaseCalendarResponse) => {
    setEditingId(r.id);
    setForm({ name: r.name, releaseDate: r.releaseDate, codeFreezeDate: r.codeFreezeDate, type: r.type, notes: r.notes });
    setModal(true);
  };

  const handleSave = () => {
    if (!form.name || !form.releaseDate || !form.codeFreezeDate) return;
    if (editingId) {
      updateRelease.mutate({ id: editingId, data: form }, {
        onSuccess: () => { setModal(false); notifications.show({ title: 'Updated', message: 'Release updated', color: 'green' }); },
      });
    } else {
      createRelease.mutate(form, {
        onSuccess: () => { setModal(false); notifications.show({ title: 'Created', message: 'Release added', color: 'green' }); },
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteRelease.mutate(id, {
      onSuccess: () => notifications.show({ title: 'Deleted', message: 'Release removed', color: 'orange' }),
    });
  };

  const dateVal = (d: string | null) => d ? new Date(d + 'T00:00:00') : null;
  const dateStr = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;

  const today = todayStr();
  const allReleases = releases ?? [];

  const pastReleases     = allReleases.filter(r => r.releaseDate < today);
  const currentReleases  = allReleases.filter(r => r.codeFreezeDate <= today && r.releaseDate >= today);
  const upcomingReleases = allReleases.filter(r => r.codeFreezeDate > today);

  return (
    <>
      <ReleaseIssuesDrawer release={drawerRelease} onClose={() => setDrawerRelease(null)} />

      <Stack>
        <Group justify="space-between">
          <Group gap="sm">
            <IconRocket size={28} />
            <Title order={2}>Release Calendar</Title>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Release</Button>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Regular releases follow the monthly cadence (Sunday following first Tuesday). Special releases are ad-hoc additions. Click any release row to view associated Jira issues by fix version.
        </Alert>

        {isLoading && <Text c="dimmed" ta="center">Loading...</Text>}

        {/* ── Current Release ─────────────────────────────────────────────── */}
        {currentReleases.length > 0 && (
          <Stack gap="xs">
            <Title order={4} c="teal">🚀 Current Release</Title>
            <ReleaseTable releases={currentReleases} onEdit={openEdit} onDelete={handleDelete}
              onView={setDrawerRelease} highlightCurrent />
          </Stack>
        )}

        {/* ── Upcoming Releases ─────────────────────────────────────────── */}
        {upcomingReleases.length > 0 && (
          <Stack gap="xs">
            <Title order={4} c="blue">📅 Upcoming Releases</Title>
            <ReleaseTable releases={upcomingReleases} onEdit={openEdit} onDelete={handleDelete}
              onView={setDrawerRelease} />
          </Stack>
        )}

        {/* ── Past Releases ─────────────────────────────────────────────── */}
        {pastReleases.length > 0 && (
          <Stack gap="xs">
            <Title order={4} c="dimmed">🕘 Past Releases</Title>
            <ReleaseTable releases={pastReleases} onEdit={openEdit} onDelete={handleDelete}
              onView={setDrawerRelease} />
          </Stack>
        )}

        {!isLoading && allReleases.length === 0 && (
          <Text ta="center" c="dimmed" py="md">No releases defined</Text>
        )}

        <Modal opened={modal} onClose={() => setModal(false)} title={editingId ? 'Edit Release' : 'Add Release'} size="md">
          <Stack>
            <TextInput label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. April 2026 Release" />
            <Select label="Type" data={typeOptions} value={form.type} onChange={v => setForm({ ...form, type: v ?? 'REGULAR' })} />
            <Group grow>
              <DateInput label="Code Freeze Date" value={dateVal(form.codeFreezeDate)} onChange={d => setForm({ ...form, codeFreezeDate: dateStr(d) ?? '' })} required valueFormat="MMM DD, YYYY" />
              <DateInput label="Release Date" value={dateVal(form.releaseDate)} onChange={d => setForm({ ...form, releaseDate: dateStr(d) ?? '' })} required valueFormat="MMM DD, YYYY" />
            </Group>
            <Textarea label="Notes" placeholder="e.g. Marketing launch alignment" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value || null })} />
            <Button onClick={handleSave} loading={createRelease.isPending || updateRelease.isPending}>
              {editingId ? 'Save Changes' : 'Add Release'}
            </Button>
          </Stack>
        </Modal>
      </Stack>
    </>
  );
}
