import { useState, useMemo, useEffect } from 'react';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Paper,
  Loader, Alert, ThemeIcon, Tooltip, Divider,
  TextInput, ScrollArea, Table, SimpleGrid,
  Modal, ActionIcon, SegmentedControl, Progress,
  Select, Collapse,
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import {
  IconCurrencyDollar, IconRefresh, IconAlertTriangle,
  IconCheck, IconSettings, IconSearch, IconExternalLink,
  IconChevronDown, IconChevronUp, IconTags, IconX,
  IconUsers, IconMapPin,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  useJiraStatus, useCapexReport, useCapexSettings, useSaveCapexSettings,
  useJiraFields, CapexIssue, CapexMonthReport, WorklogAuthorRow, LocationSummary,
} from '../api/jira';
import WidgetGrid, { Widget } from '../components/layout/WidgetGrid';
import ChartCard from '../components/common/ChartCard';

const DEEP_BLUE  = '#0C2340';
const AGUA       = '#1F9196';
const AMBER      = '#F59E0B';
const GREEN      = '#22C55E';
const RED        = '#EF4444';
const GRAY       = '#94A3B8';
const PURPLE     = '#7C3AED';
const INDIA_COLOR = '#7C3AED';  // purple
const US_COLOR    = '#0EA5E9';  // sky blue

const CAT_COLORS: Record<string, string> = {
  'IDS':      DEEP_BLUE,
  'NON-IDS':  AGUA,
  'Untagged': AMBER,
};

const LOC_COLORS: Record<string, string> = {
  'India': INDIA_COLOR,
  'US':    US_COLOR,
};

// ── Issue type colour map ──────────────────────────────────────────────
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

function fmtHours(h: number) {
  if (h === 0) return '—';
  if (h < 1)   return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function monthLabel(date: Date | null) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function LocationBadge({ location }: { location: string }) {
  const color = LOC_COLORS[location] ?? GRAY;
  return (
    <Badge
      size="xs"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}
    >
      {location}
    </Badge>
  );
}

// ── Settings Modal ─────────────────────────────────────────────────────

function CapexSettingsModal({
  opened, onClose,
}: { opened: boolean; onClose: () => void }) {
  const { data: settings } = useCapexSettings();
  const {
    data: fields = [],
    isLoading: loadingFields,
    isFetching: fetchingFields,
    isError: fieldsError,
    refetch: refetchFields,
  } = useJiraFields(opened);
  const save = useSaveCapexSettings();
  const [fieldId, setFieldId] = useState('');

  useEffect(() => {
    if (settings?.capexFieldId !== undefined) {
      setFieldId(settings.capexFieldId);
    }
  }, [settings?.capexFieldId, opened]);

  const fieldOptions = [
    { value: '', label: '— type manually —' },
    ...fields.map(f => ({ value: f.id, label: `${f.name} (${f.id})` })),
  ];

  const showLoader  = loadingFields || fetchingFields;
  const showSelect  = !showLoader && fields.length > 0;
  const showEmpty   = !showLoader && !fieldsError && fields.length === 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={24} radius="sm" style={{ backgroundColor: DEEP_BLUE }}>
            <IconSettings size={14} color="white" />
          </ThemeIcon>
          <Text fw={700} style={{ color: DEEP_BLUE }}>CapEx Field Settings</Text>
        </Group>
      }
      size="xl"
      radius="md"
    >
      <Stack gap="md">
        <Alert color="blue" variant="light" icon={<IconTags size={14} />}>
          Enter the Jira custom field ID that stores your <strong>IDS / NON-IDS</strong> (CapEx / OpEx)
          classification. This is usually a select or text field, e.g. <code>customfield_10060</code>.
        </Alert>

        {showLoader && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">Loading Jira custom fields…</Text>
          </Group>
        )}

        {fieldsError && (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={14} />}>
            <Group justify="space-between" align="center">
              <Text size="sm">Could not load fields from Jira.</Text>
              <Button size="xs" variant="light" color="orange" leftSection={<IconRefresh size={12} />}
                onClick={() => refetchFields()}>
                Retry
              </Button>
            </Group>
          </Alert>
        )}

        {showSelect && (
          <Select
            label={
              <Group gap={6} align="center">
                <Text size="sm" fw={500}>Pick field from Jira</Text>
                <Tooltip label="Refresh field list" withArrow>
                  <ActionIcon size="xs" variant="subtle" color="gray"
                    onClick={() => refetchFields()} loading={fetchingFields}>
                    <IconRefresh size={11} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            }
            description="Only custom fields are shown — search by name or ID"
            data={fieldOptions}
            value={fieldId}
            onChange={v => setFieldId(v ?? '')}
            searchable
            clearable
            placeholder="Search fields…"
          />
        )}

        {showEmpty && (
          <Group gap="xs" align="center">
            <Text size="sm" c="dimmed">No custom fields returned from Jira.</Text>
            <Button size="xs" variant="subtle" leftSection={<IconRefresh size={12} />}
              onClick={() => refetchFields()}>
              Retry
            </Button>
          </Group>
        )}

        <TextInput
          label="Custom Field ID (manual)"
          description="e.g. customfield_10060 — use this if the picker above is empty"
          placeholder="customfield_XXXXX"
          value={fieldId}
          onChange={e => setFieldId(e.currentTarget.value)}
        />

        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
          <Button
            leftSection={<IconCheck size={14} />}
            loading={save.isPending}
            onClick={() => {
              save.mutate({ capexFieldId: fieldId }, { onSuccess: onClose });
            }}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Issue Detail Modal ─────────────────────────────────────────────────

function IssueModal({
  opened, onClose, title, issues, jiraBaseUrl,
}: {
  opened: boolean; onClose: () => void;
  title: string; issues: CapexIssue[];
  jiraBaseUrl?: string;
}) {
  const [search, setSearch] = useState('');
  const filtered = issues.filter(i =>
    !search ||
    i.key.toLowerCase().includes(search.toLowerCase()) ||
    i.summary.toLowerCase().includes(search.toLowerCase()) ||
    (i.assignee ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      opened={opened} onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={700} style={{ color: DEEP_BLUE }}>{title}</Text>
          <Badge size="sm" variant="light" color="teal">{filtered.length}</Badge>
        </Group>
      }
      size="90%"
      radius="md"
    >
      <TextInput
        placeholder="Search key, summary, assignee…"
        leftSection={<IconSearch size={13} />}
        value={search}
        onChange={e => setSearch(e.currentTarget.value)}
        rightSection={search ? <IconX size={13} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} /> : null}
        mb="sm" size="xs"
      />
      <ScrollArea h={500}>
        <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ whiteSpace: 'nowrap' }}>Key</Table.Th>
              <Table.Th>Summary</Table.Th>
              <Table.Th>POD</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Assignee</Table.Th>
              <Table.Th ta="center">Location</Table.Th>
              <Table.Th ta="center">Category</Table.Th>
              <Table.Th ta="center">Hours</Table.Th>
              <Table.Th ta="center">SP</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map(issue => (
              <Table.Tr
                key={issue.key}
                style={!issue.capexCategory ? { backgroundColor: '#FFFBEB' } : undefined}
              >
                <Table.Td>
                  {jiraBaseUrl ? (
                    <a href={`${jiraBaseUrl}/browse/${issue.key}`}
                       target="_blank" rel="noreferrer"
                       style={{ color: AGUA, fontWeight: 600, textDecoration: 'none' }}>
                      {issue.key}
                    </a>
                  ) : (
                    <Text fw={600} c="teal" size="xs">{issue.key}</Text>
                  )}
                </Table.Td>
                <Table.Td><Text size="xs" lineClamp={2}>{issue.summary}</Text></Table.Td>
                <Table.Td><Text size="xs">{issue.podDisplayName ?? '—'}</Text></Table.Td>
                <Table.Td>
                  <Tooltip label={`Type: ${issue.issueType}`} withArrow position="top">
                    <Badge size="xs" style={{
                      backgroundColor: issueTypeStyle(issue.issueType).bg,
                      color: issueTypeStyle(issue.issueType).text,
                      border: `1px solid ${issueTypeStyle(issue.issueType).text}33`,
                      cursor: 'default',
                    }}>
                      {issue.issueType}
                    </Badge>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" style={{
                    backgroundColor: STATUS_CAT_BG[issue.statusCategory] ?? '#F1F5F9',
                    color: STATUS_CAT_COLOR[issue.statusCategory] ?? GRAY,
                  }}>
                    {issue.statusName}
                  </Badge>
                </Table.Td>
                <Table.Td><Text size="xs">{issue.assignee}</Text></Table.Td>
                <Table.Td ta="center">
                  <LocationBadge location={issue.assigneeLocation ?? 'India'} />
                </Table.Td>
                <Table.Td ta="center">
                  {issue.capexCategory ? (
                    <Badge size="xs" style={{
                      backgroundColor: CAT_COLORS[issue.capexCategory] ?? PURPLE,
                      color: 'white',
                    }}>
                      {issue.capexCategory}
                    </Badge>
                  ) : (
                    <Badge size="xs" color="orange" variant="light">Untagged</Badge>
                  )}
                </Table.Td>
                <Table.Td ta="center">
                  <Text size="xs" fw={issue.monthlyHours > 0 ? 600 : 400}
                        c={issue.monthlyHours > 0 ? 'teal' : 'dimmed'}>
                    {fmtHours(issue.monthlyHours)}
                  </Text>
                </Table.Td>
                <Table.Td ta="center">
                  {issue.storyPoints > 0
                    ? <Text size="xs" fw={600}>{issue.storyPoints}</Text>
                    : <Text size="xs" c="dimmed">—</Text>}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {filtered.length === 0 && (
          <Text c="dimmed" ta="center" size="sm" mt="xl">No issues match the filter.</Text>
        )}
      </ScrollArea>
    </Modal>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, onClick }: {
  label: string; value: string; sub?: string;
  color: string; onClick?: () => void;
}) {
  return (
    <Paper
      withBorder p="sm" radius="md" ta="center"
      style={{ cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${color}` }}
      onClick={onClick}
    >
      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
      <Text fw={800} size="xl" style={{ color }}>{value}</Text>
      {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Paper>
  );
}

// ── Location Summary Card ──────────────────────────────────────────────

function LocationCard({ loc }: { loc: LocationSummary }) {
  const color = LOC_COLORS[loc.location] ?? GRAY;
  return (
    <Paper withBorder p="md" radius="md" style={{ borderTop: `3px solid ${color}` }}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconMapPin size={14} color={color} />
          <Text fw={700} size="sm" style={{ color }}>{loc.location}</Text>
        </Group>
        <Badge size="xs" style={{ backgroundColor: color + '22', color }}>
          {loc.authorCount} {loc.authorCount === 1 ? 'person' : 'people'}
        </Badge>
      </Group>
      <Text fw={800} size="xl" style={{ color }}>{fmtHours(loc.totalHours)}</Text>
      <Text size="xs" c="dimmed" mb="xs">total hours logged</Text>
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">IDS</Text>
          <Text size="xs" fw={600} style={{ color: DEEP_BLUE }}>{fmtHours(loc.idsHours)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">NON-IDS</Text>
          <Text size="xs" fw={600} style={{ color: AGUA }}>{fmtHours(loc.nonIdsHours)}</Text>
        </Group>
        {loc.untaggedHours > 0 && (
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Untagged</Text>
            <Text size="xs" fw={600} style={{ color: AMBER }}>{fmtHours(loc.untaggedHours)}</Text>
          </Group>
        )}
      </Stack>
      {loc.totalHours > 0 && (
        <Progress.Root size={6} mt="xs">
          {loc.idsHours > 0 && (
            <Progress.Section
              value={(loc.idsHours / loc.totalHours) * 100}
              color={DEEP_BLUE}
            />
          )}
          {loc.nonIdsHours > 0 && (
            <Progress.Section
              value={(loc.nonIdsHours / loc.totalHours) * 100}
              color={AGUA}
            />
          )}
          {loc.untaggedHours > 0 && (
            <Progress.Section
              value={(loc.untaggedHours / loc.totalHours) * 100}
              color={AMBER}
            />
          )}
        </Progress.Root>
      )}
    </Paper>
  );
}

// ── Compact issue table (IDS / NON-IDS sections) ───────────────────────

function CompactIssueSection({
  title, issues, color, jiraBaseUrl, defaultExpanded = false,
}: {
  title: string;
  issues: CapexIssue[];
  color: string;
  jiraBaseUrl?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    issues.filter(i =>
      !search ||
      i.key.toLowerCase().includes(search.toLowerCase()) ||
      i.summary.toLowerCase().includes(search.toLowerCase()) ||
      (i.assignee ?? '').toLowerCase().includes(search.toLowerCase())
    ), [issues, search]);

  const totalHours = issues.reduce((s, i) => s + i.monthlyHours, 0);
  const totalSP    = issues.reduce((s, i) => s + i.storyPoints, 0);

  return (
    <Paper withBorder radius="md" style={{ borderLeft: `4px solid ${color}`, overflow: 'hidden' }}>
      <Group
        justify="space-between" p="sm"
        style={{ cursor: 'pointer', backgroundColor: color + '08' }}
        onClick={() => setExpanded(e => !e)}
      >
        <Group gap="xs">
          <Text fw={700} size="sm" style={{ color }}>{title}</Text>
          <Badge size="xs" style={{ backgroundColor: color, color: 'white' }}>
            {issues.length}
          </Badge>
        </Group>
        <Group gap="md">
          <Text size="xs" c="dimmed">{fmtHours(totalHours)} logged</Text>
          {totalSP > 0 && <Text size="xs" c="dimmed">{Math.round(totalSP)} SP</Text>}
          {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </Group>
      </Group>
      <Collapse in={expanded}>
        <Box p="sm" pt={0}>
          <TextInput
            placeholder="Search…"
            size="xs"
            leftSection={<IconSearch size={12} />}
            rightSection={search
              ? <ActionIcon size="xs" variant="subtle" onClick={() => setSearch('')}><IconX size={12} /></ActionIcon>
              : null}
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            mt="xs"
            mb="xs"
            w={220}
          />
          <ScrollArea h={300}>
            <Table striped highlightOnHover withTableBorder fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Key</Table.Th>
                  <Table.Th>Summary</Table.Th>
                  <Table.Th>Assignee</Table.Th>
                  <Table.Th ta="center">Loc</Table.Th>
                  <Table.Th ta="center">Type</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                  <Table.Th ta="center">Hours</Table.Th>
                  <Table.Th ta="center">SP</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map(i => (
                  <Table.Tr key={i.key}>
                    <Table.Td>
                      {jiraBaseUrl ? (
                        <a href={`${jiraBaseUrl}/browse/${i.key}`}
                           target="_blank" rel="noreferrer"
                           style={{ color: AGUA, fontWeight: 600, textDecoration: 'none' }}>
                          {i.key}
                        </a>
                      ) : (
                        <Text fw={600} c="teal" size="xs">{i.key}</Text>
                      )}
                    </Table.Td>
                    <Table.Td><Text size="xs" lineClamp={1}>{i.summary}</Text></Table.Td>
                    <Table.Td><Text size="xs">{i.assignee}</Text></Table.Td>
                    <Table.Td ta="center">
                      <LocationBadge location={i.assigneeLocation ?? 'India'} />
                    </Table.Td>
                    <Table.Td ta="center">
                      <Tooltip label={`Type: ${i.issueType}`} withArrow>
                        <Badge size="xs" style={{
                          backgroundColor: issueTypeStyle(i.issueType).bg,
                          color: issueTypeStyle(i.issueType).text,
                          border: `1px solid ${issueTypeStyle(i.issueType).text}33`,
                          cursor: 'default',
                        }}>
                          {i.issueType}
                        </Badge>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge size="xs" style={{
                        backgroundColor: STATUS_CAT_BG[i.statusCategory] ?? '#F1F5F9',
                        color: STATUS_CAT_COLOR[i.statusCategory] ?? GRAY,
                      }}>
                        {i.statusName}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text size="xs" fw={i.monthlyHours > 0 ? 600 : 400}
                            c={i.monthlyHours > 0 ? 'teal' : 'dimmed'}>
                        {fmtHours(i.monthlyHours)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      {i.storyPoints > 0
                        ? <Text size="xs" fw={600}>{i.storyPoints}</Text>
                        : <Text size="xs" c="dimmed">—</Text>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {filtered.length === 0 && (
              <Text c="dimmed" ta="center" size="sm" mt="lg">No issues match.</Text>
            )}
          </ScrollArea>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function JiraCapexPage() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch]     = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalTitle, setModalTitle]     = useState('');
  const [modalIssues, setModalIssues]   = useState<CapexIssue[]>([]);
  const [podExpanded, setPodExpanded]   = useState(true);
  const [authorExpanded, setAuthorExpanded] = useState(true);

  const { data: status } = useJiraStatus();
  const { data: settings } = useCapexSettings();

  const monthStr = monthLabel(selectedMonth);
  const fieldId  = settings?.capexFieldId ?? '';

  const { data: report, isLoading, refetch } = useCapexReport(monthStr, fieldId || undefined);

  const jiraBaseUrl = status?.baseUrl;

  // ── Derived data ──────────────────────────────────────────────────

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    let list = report.issues;
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'untagged') {
        list = list.filter(i => !i.capexCategory);
      } else {
        list = list.filter(i => i.capexCategory === categoryFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        (i.assignee ?? '').toLowerCase().includes(q) ||
        (i.podDisplayName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [report, categoryFilter, search]);

  // Category options — skip "Untagged" from breakdown (it's added separately with ⚠ prefix)
  const categoryOptions = useMemo(() => {
    if (!report) return [{ label: 'All', value: 'all' }];
    const cats: { label: string; value: string }[] = [{ label: 'All', value: 'all' }];
    report.breakdown.forEach(b => {
      // Skip Untagged here — added below with a warning icon so it's not duplicated
      if (b.category === 'Untagged') return;
      cats.push({ label: `${b.category} (${b.issueCount})`, value: b.category });
    });
    if (report.untaggedIssues > 0) {
      cats.push({ label: `⚠ Untagged (${report.untaggedIssues})`, value: 'untagged' });
    }
    return cats;
  }, [report]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!report) return [];
    return report.breakdown.map(b => ({
      name: b.category,
      value: b.totalHours,
    }));
  }, [report]);

  // Stacked bar by POD
  const podBarData = useMemo(() => {
    if (!report) return [];
    return report.podBreakdown.map(p => ({
      pod: p.podName,
      ...p.hoursByCategory,
    }));
  }, [report]);

  const allCategories = useMemo(() => {
    if (!report) return [];
    return report.breakdown.map(b => b.category);
  }, [report]);

  // Author bar chart data — top 20 by total hours
  const authorBarData = useMemo(() => {
    if (!report) return [];
    return report.authorBreakdown.slice(0, 20).map(a => ({
      name: a.author.split(' ')[0],   // first name only for axis readability
      fullName: a.author,
      location: a.location,
      IDS: a.idsHours,
      'NON-IDS': a.nonIdsHours,
      Untagged: a.untaggedHours,
    }));
  }, [report]);

  // Location IDS vs NON-IDS grouped bar
  const locationBarData = useMemo(() => {
    if (!report) return [];
    return report.locationBreakdown.map(l => ({
      name: l.location,
      IDS: l.idsHours,
      'NON-IDS': l.nonIdsHours,
      Untagged: l.untaggedHours,
    }));
  }, [report]);

  const idsIssues    = useMemo(() => report?.issues.filter(i => i.capexCategory === 'IDS')    ?? [], [report]);
  const nonIdsIssues = useMemo(() => report?.issues.filter(i => i.capexCategory === 'NON-IDS') ?? [], [report]);

  function openModal(title: string, issues: CapexIssue[]) {
    setModalTitle(title);
    setModalIssues(issues);
    setModalOpen(true);
  }

  if (!status?.configured) {
    return (
      <Box p="xl">
        <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
          Configure your Jira credentials in <strong>Settings → Jira Credentials</strong>.
        </Alert>
      </Box>
    );
  }

  const idsCat    = report?.breakdown.find(b => b.category === 'IDS');
  const nonIdsCat = report?.breakdown.find(b => b.category === 'NON-IDS');
  const tagPct    = report && report.totalIssues > 0
    ? Math.round((report.taggedIssues / report.totalIssues) * 100) : 0;

  return (
    <Box p="md">
      {/* Settings Modal */}
      <CapexSettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Issue Detail Modal */}
      <IssueModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        issues={modalIssues}
        jiraBaseUrl={jiraBaseUrl}
      />

      {/* ── Header ── */}
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
            <IconCurrencyDollar size={22} color="white" />
          </ThemeIcon>
          <div>
            <Title order={3} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>
              CapEx / OpEx Tracker
            </Title>
            <Text size="sm" c="dimmed">
              IDS vs NON-IDS hours by month · {fieldId
                ? <span style={{ color: AGUA }}>field: {fieldId}</span>
                : <span style={{ color: AMBER }}>⚠ No field configured — click Settings</span>}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button
            variant="light" size="sm"
            leftSection={<IconSettings size={15} />}
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
          <Button
            variant="light" size="sm"
            leftSection={<IconRefresh size={15} />}
            loading={isLoading}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ── Month picker + field ID status ── */}
      <Paper withBorder p="sm" radius="md" mb="lg">
        <Group gap="md" align="flex-end" wrap="wrap">
          <MonthPickerInput
            label="Month"
            placeholder="Pick a month"
            value={selectedMonth}
            onChange={setSelectedMonth}
            w={200}
          />
          {!fieldId && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={14} />}
              style={{ flex: 1 }} p="xs">
              No CapEx field configured. Click <strong>Settings</strong> to set the custom field ID
              (e.g. <code>customfield_10060</code>).
            </Alert>
          )}
          {fieldId && (
            <Badge variant="outline" color="teal" size="md">
              Field: {fieldId}
            </Badge>
          )}
        </Group>
      </Paper>

      {/* ── Loading ── */}
      {isLoading && (
        <Group justify="center" mt="xl">
          <Loader />
          <Text c="dimmed">Loading CapEx data for {monthStr}…</Text>
        </Group>
      )}

      {!isLoading && report && (
        <WidgetGrid pageKey="capex">

          {/* ── Summary Cards ── */}
          <Widget id="kpi-cards" title="Summary">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm" mb="lg">
            <StatCard
              label="Total Issues"
              value={String(report.totalIssues)}
              color={DEEP_BLUE}
              onClick={() => openModal('All Issues', report.issues)}
            />
            <StatCard
              label="IDS (CapEx)"
              value={fmtHours(idsCat?.totalHours ?? 0)}
              sub={`${idsCat?.issueCount ?? 0} issues`}
              color={DEEP_BLUE}
              onClick={() => openModal('IDS — CapEx Issues',
                report.issues.filter(i => i.capexCategory === 'IDS'))}
            />
            <StatCard
              label="NON-IDS (OpEx)"
              value={fmtHours(nonIdsCat?.totalHours ?? 0)}
              sub={`${nonIdsCat?.issueCount ?? 0} issues`}
              color={AGUA}
              onClick={() => openModal('NON-IDS — OpEx Issues',
                report.issues.filter(i => i.capexCategory === 'NON-IDS'))}
            />
            <StatCard
              label="Total Hours"
              value={fmtHours(report.totalHours)}
              color={PURPLE}
              onClick={() => openModal('All Issues (with hours)',
                report.issues.filter(i => i.monthlyHours > 0))}
            />
            <StatCard
              label="Untagged"
              value={String(report.untaggedIssues)}
              sub={`${100 - tagPct}% untagged`}
              color={report.untaggedIssues > 0 ? AMBER : GREEN}
              onClick={() => openModal('Untagged Issues (missing CapEx field)',
                report.issues.filter(i => !i.capexCategory))}
            />
          </SimpleGrid>

          </Widget>

          {/* ── Tagging health bar ── */}
          <Widget id="tagging-health" title="Tagging Health">
          {report.totalIssues > 0 && (
            <Paper withBorder p="sm" radius="md" mb="lg">
              <Group justify="space-between" mb={6}>
                <Group gap="xs">
                  <IconTags size={15} color={tagPct === 100 ? GREEN : AMBER} />
                  <Text size="sm" fw={600}>Tagging Health</Text>
                </Group>
                <Group gap="xs">
                  <Badge
                    color={tagPct === 100 ? 'green' : tagPct > 80 ? 'yellow' : 'orange'}
                    variant="light"
                  >
                    {tagPct}% tagged correctly
                  </Badge>
                  {report.untaggedIssues > 0 && (
                    <Button
                      size="xs" variant="subtle" color="orange"
                      leftSection={<IconAlertTriangle size={12} />}
                      onClick={() => openModal('Untagged Issues (missing CapEx field)',
                        report.issues.filter(i => !i.capexCategory))}
                    >
                      {report.untaggedIssues} untagged
                    </Button>
                  )}
                </Group>
              </Group>
              <Progress
                value={tagPct}
                color={tagPct === 100 ? 'green' : tagPct > 80 ? 'yellow' : 'orange'}
                size="md" radius="xl"
              />
            </Paper>
          )}

          </Widget>

          {/* ── Charts row ── */}
          <Widget id="charts" title="Charts">
          {report.totalIssues > 0 && (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">
              {/* Pie: hours by category */}
              <ChartCard title="Hours by Category" minHeight={260}>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="38%"
                        outerRadius={75}
                        labelLine={false}
                        onClick={(e) => openModal(
                          `${e.name} Issues`,
                          report.issues.filter(i => (i.capexCategory ?? 'Untagged') === e.name)
                        )}
                        style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={CAT_COLORS[entry.name] ?? PURPLE} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle" iconSize={8}
                        formatter={v => <span style={{ fontSize: 11 }}>{v}</span>}
                      />
                      <RTooltip
                        contentStyle={{ fontSize: 11 }}
                        formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Text c="dimmed" ta="center" size="sm" mt="xl">No hours data</Text>
                )}
              </ChartCard>

              {/* Stacked bar: by POD */}
              {podBarData.length > 0 && (
                <ChartCard
                  title="Hours by POD"
                  minHeight={200}
                  headerRight={
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => setPodExpanded(e => !e)}
                    >
                      {podExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                    </ActionIcon>
                  }
                >
                  <Collapse in={podExpanded}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={podBarData} margin={{ top: 0, right: 4, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="pod" tick={{ fontSize: 9 }}
                          angle={-30} textAnchor="end" interval={0}
                        />
                        <YAxis tick={{ fontSize: 9 }} />
                        <RTooltip
                          contentStyle={{ fontSize: 11 }}
                          formatter={(v: number, n: string) => [`${v.toFixed(1)}h`, n]}
                        />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                        {allCategories.map(cat => (
                          <Bar
                            key={cat}
                            dataKey={cat}
                            stackId="a"
                            fill={CAT_COLORS[cat] ?? PURPLE}
                            radius={cat === allCategories[allCategories.length - 1]
                              ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Collapse>
                </ChartCard>
              )}
            </SimpleGrid>
          )}

          </Widget>

          {/* ── Category breakdown cards ── */}
          <Widget id="category-breakdown" title="Category Breakdown">
          {report.breakdown.length > 0 && (
            <Paper withBorder p="md" radius="md" mb="lg">
              <Text size="sm" fw={600} c="dimmed" mb="sm">Category Breakdown</Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                {report.breakdown.map(b => {
                  const pct = report.totalHours > 0
                    ? Math.round((b.totalHours / report.totalHours) * 100) : 0;
                  return (
                    <Paper
                      key={b.category} withBorder p="sm" radius="sm"
                      style={{
                        borderLeft: `4px solid ${CAT_COLORS[b.category] ?? PURPLE}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => openModal(
                        `${b.category} Issues`,
                        report.issues.filter(i =>
                          b.category === 'Untagged'
                            ? !i.capexCategory
                            : i.capexCategory === b.category)
                      )}
                    >
                      <Group justify="space-between" mb={4}>
                        <Text size="sm" fw={700}
                          style={{ color: CAT_COLORS[b.category] ?? PURPLE }}>
                          {b.category}
                        </Text>
                        <Badge size="xs" variant="light"
                          style={{ backgroundColor: CAT_COLORS[b.category] ?? PURPLE, color: 'white' }}>
                          {pct}%
                        </Badge>
                      </Group>
                      <Group gap="xl">
                        <div>
                          <Text size="xs" c="dimmed">Hours</Text>
                          <Text fw={700} size="md">{fmtHours(b.totalHours)}</Text>
                        </div>
                        <div>
                          <Text size="xs" c="dimmed">Issues</Text>
                          <Text fw={700} size="md">{b.issueCount}</Text>
                        </div>
                        {b.totalSP > 0 && (
                          <div>
                            <Text size="xs" c="dimmed">Story Pts</Text>
                            <Text fw={700} size="md">{Math.round(b.totalSP)}</Text>
                          </div>
                        )}
                      </Group>
                      <Progress
                        value={pct}
                        color={CAT_COLORS[b.category] === AMBER ? 'orange'
                          : CAT_COLORS[b.category] === AGUA ? 'teal' : 'dark'}
                        size={4} radius="xl" mt="xs"
                      />
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Paper>
          )}

          </Widget>

          {/* ── Worklog Attribution by Author & Location ── */}
          <Widget id="worklog-attribution" title="Worklog Attribution">
          {(report.locationBreakdown.length > 0 || report.authorBreakdown.length > 0) && (
            <Paper withBorder p="md" radius="md" mb="lg">
              <Group gap="xs" mb="md">
                <IconUsers size={16} color={DEEP_BLUE} />
                <Text size="sm" fw={600} style={{ color: DEEP_BLUE }}>
                  Worklog Attribution — India vs US
                </Text>
                <Text size="xs" c="dimmed">(by worklog author, not assignee)</Text>
              </Group>

              {/* Location summary cards */}
              {report.locationBreakdown.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mb="md">
                  {report.locationBreakdown.map(loc => (
                    <LocationCard key={loc.location} loc={loc} />
                  ))}
                </SimpleGrid>
              )}

              {/* IDS vs NON-IDS grouped bar by location */}
              {locationBarData.length > 0 && (
                <Paper withBorder p="sm" radius="sm" mb="md">
                  <Text size="xs" fw={600} c="dimmed" mb="xs">IDS vs NON-IDS Hours by Location</Text>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={locationBarData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <RTooltip
                        contentStyle={{ fontSize: 11 }}
                        formatter={(v: number, n: string) => [`${v.toFixed(1)}h`, n]}
                      />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="IDS" fill={DEEP_BLUE} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="NON-IDS" fill={AGUA} radius={[3, 3, 0, 0]} />
                      {report.untaggedIssues > 0 && (
                        <Bar dataKey="Untagged" fill={AMBER} radius={[3, 3, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              )}

              {/* Author stacked bar chart */}
              {authorBarData.length > 0 && (
                <Paper withBorder p="sm" radius="sm" mb="md">
                  <Group justify="space-between" mb="xs" style={{ cursor: 'pointer' }}
                    onClick={() => setAuthorExpanded(e => !e)}>
                    <Text size="xs" fw={600} c="dimmed">
                      Hours by Author (top {Math.min(20, report.authorBreakdown.length)})
                    </Text>
                    {authorExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </Group>
                  <Collapse in={authorExpanded}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={authorBarData}
                        margin={{ top: 0, right: 4, left: -20, bottom: 60 }}
                        layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="name" tick={{ fontSize: 9 }}
                          angle={-40} textAnchor="end" interval={0}
                        />
                        <YAxis tick={{ fontSize: 9 }} />
                        <RTooltip
                          contentStyle={{ fontSize: 11 }}
                          formatter={(v: number, n: string) => [`${v.toFixed(1)}h`, n]}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload;
                            return item ? `${item.fullName} (${item.location})` : label;
                          }}
                        />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                        <Bar dataKey="IDS" stackId="a" fill={DEEP_BLUE} />
                        <Bar dataKey="NON-IDS" stackId="a" fill={AGUA} />
                        {report.authorBreakdown.some(a => a.untaggedHours > 0) && (
                          <Bar dataKey="Untagged" stackId="a" fill={AMBER}
                            radius={[3, 3, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </Collapse>
                </Paper>
              )}

              {/* Author breakdown table */}
              {report.authorBreakdown.length > 0 && (
                <ScrollArea h={250}>
                  <Table striped highlightOnHover withTableBorder fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Author</Table.Th>
                        <Table.Th ta="center">Location</Table.Th>
                        <Table.Th ta="right">IDS hrs</Table.Th>
                        <Table.Th ta="right">NON-IDS hrs</Table.Th>
                        {report.authorBreakdown.some(a => a.untaggedHours > 0) && (
                          <Table.Th ta="right">Untagged hrs</Table.Th>
                        )}
                        <Table.Th ta="right">Total hrs</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {report.authorBreakdown.map(a => (
                        <Table.Tr key={a.author}>
                          <Table.Td><Text size="xs" fw={500}>{a.author}</Text></Table.Td>
                          <Table.Td ta="center"><LocationBadge location={a.location} /></Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs" c={a.idsHours > 0 ? undefined : 'dimmed'}>
                              {fmtHours(a.idsHours)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs" c={a.nonIdsHours > 0 ? undefined : 'dimmed'}>
                              {fmtHours(a.nonIdsHours)}
                            </Text>
                          </Table.Td>
                          {report.authorBreakdown.some(x => x.untaggedHours > 0) && (
                            <Table.Td ta="right">
                              <Text size="xs" c={a.untaggedHours > 0 ? 'orange' : 'dimmed'}>
                                {fmtHours(a.untaggedHours)}
                              </Text>
                            </Table.Td>
                          )}
                          <Table.Td ta="right">
                            <Text size="xs" fw={700}>{fmtHours(a.totalHours)}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Paper>
          )}

          </Widget>

          {/* ── IDS & NON-IDS Stories ── */}
          <Widget id="ids-nonids-stories" title="IDS & NON-IDS Stories">
          {idsIssues.length > 0 && (
            <Box mb="md">
              <CompactIssueSection
                title="IDS Stories (CapEx)"
                issues={idsIssues}
                color={DEEP_BLUE}
                jiraBaseUrl={jiraBaseUrl}
              />
            </Box>
          )}
          {nonIdsIssues.length > 0 && (
            <Box mb="lg">
              <CompactIssueSection
                title="NON-IDS Stories (OpEx)"
                issues={nonIdsIssues}
                color={AGUA}
                jiraBaseUrl={jiraBaseUrl}
              />
            </Box>
          )}
          </Widget>

          {/* ── Full issue list ── */}
          <Widget id="issue-list" title="Issue List">
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dimmed">
                All Issues in {monthStr}
                {categoryFilter !== 'all' && ` · ${categoryFilter === 'untagged' ? 'Untagged' : categoryFilter}`}
              </Text>
              <Group gap="xs">
                <TextInput
                  placeholder="Search issues…"
                  size="xs"
                  leftSection={<IconSearch size={12} />}
                  rightSection={search
                    ? <ActionIcon size="xs" variant="subtle" onClick={() => setSearch('')}><IconX size={12} /></ActionIcon>
                    : null}
                  value={search}
                  onChange={e => setSearch(e.currentTarget.value)}
                  w={200}
                />
                <Button
                  size="xs" variant="light"
                  onClick={() => openModal(`Issues — ${monthStr}`, filteredIssues)}
                  leftSection={<IconExternalLink size={12} />}
                >
                  Expand
                </Button>
              </Group>
            </Group>

            <SegmentedControl
              size="xs"
              value={categoryFilter}
              onChange={setCategoryFilter}
              data={categoryOptions}
              mb="sm"
              style={{ flexWrap: 'wrap' }}
            />

            <ScrollArea h={400}>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Key</Table.Th>
                    <Table.Th>Summary</Table.Th>
                    <Table.Th>POD</Table.Th>
                    <Table.Th>Assignee</Table.Th>
                    <Table.Th ta="center">Loc</Table.Th>
                    <Table.Th ta="center">Category</Table.Th>
                    <Table.Th ta="center">Hours</Table.Th>
                    <Table.Th ta="center">Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredIssues.map(issue => (
                    <Table.Tr
                      key={issue.key}
                      style={!issue.capexCategory ? { backgroundColor: '#FFFBEB' } : undefined}
                    >
                      <Table.Td>
                        {jiraBaseUrl ? (
                          <a href={`${jiraBaseUrl}/browse/${issue.key}`}
                             target="_blank" rel="noreferrer"
                             style={{ color: AGUA, fontWeight: 600, textDecoration: 'none' }}>
                            {issue.key}
                          </a>
                        ) : (
                          <Text fw={600} c="teal" size="xs">{issue.key}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={1}>{issue.summary}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{issue.podDisplayName ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{issue.assignee}</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <LocationBadge location={issue.assigneeLocation ?? 'India'} />
                      </Table.Td>
                      <Table.Td ta="center">
                        {issue.capexCategory ? (
                          <Badge size="xs" style={{
                            backgroundColor: CAT_COLORS[issue.capexCategory] ?? PURPLE,
                            color: 'white',
                          }}>
                            {issue.capexCategory}
                          </Badge>
                        ) : (
                          <Tooltip label="Missing CapEx/OpEx tag">
                            <Badge size="xs" color="orange" variant="light">
                              Untagged
                            </Badge>
                          </Tooltip>
                        )}
                      </Table.Td>
                      <Table.Td ta="center">
                        <Text size="xs" fw={issue.monthlyHours > 0 ? 600 : 400}
                              c={issue.monthlyHours > 0 ? 'teal' : 'dimmed'}>
                          {fmtHours(issue.monthlyHours)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" style={{
                          backgroundColor: STATUS_CAT_BG[issue.statusCategory] ?? '#F1F5F9',
                          color: STATUS_CAT_COLOR[issue.statusCategory] ?? GRAY,
                        }}>
                          {issue.statusName}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {filteredIssues.length === 0 && (
                <Text c="dimmed" ta="center" size="sm" mt="lg">No issues match the filter.</Text>
              )}
            </ScrollArea>

            <Group justify="space-between" mt="xs">
              <Text size="xs" c="dimmed">
                Showing {filteredIssues.length} of {report.totalIssues} issues
              </Text>
              <Text size="xs" c="dimmed">
                Total hours shown: {fmtHours(filteredIssues.reduce((s, i) => s + i.monthlyHours, 0))}
              </Text>
            </Group>
          </Paper>
          </Widget>

        </WidgetGrid>
      )}

      {!isLoading && !report && (
        <Alert color="blue" icon={<IconCurrencyDollar />} title="No data">
          Select a month and ensure your Jira PODs are configured to see CapEx/OpEx data.
        </Alert>
      )}
    </Box>
  );
}
