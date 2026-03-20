import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Stack, Badge, Button, Select, Paper, Table,
  ActionIcon, ThemeIcon, Alert, Loader, Progress, Tooltip,
  SimpleGrid, RingProgress, ScrollArea, Divider, TextInput, Modal,
  SegmentedControl,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconClock, IconChevronDown, IconChevronRight, IconRefresh,
  IconAlertTriangle, IconUser, IconBug, IconCheck, IconBolt,
  IconSubtask, IconTicket, IconExternalLink, IconSearch, IconHistory,
  IconX,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  useJiraStatus, useWorklogReport, useWorklogUserHistory,
  WorklogUserRow, WorklogIssueEntry,
} from '../api/jira';
import ChartCard from '../components/common/ChartCard';

const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';

// Build a colour and icon for each Jira issue type
const TYPE_META: Record<string, { color: string; hex: string; icon: React.ReactNode }> = {
  Story:      { color: 'green',  hex: '#2e7d32', icon: <IconCheck size={12} /> },
  Bug:        { color: 'red',    hex: '#c62828', icon: <IconBug size={12} /> },
  Task:       { color: 'blue',   hex: '#1565c0', icon: <IconSubtask size={12} /> },
  Incident:   { color: 'orange', hex: '#e65100', icon: <IconBolt size={12} /> },
  Epic:       { color: 'violet', hex: '#6a1b9a', icon: <IconTicket size={12} /> },
  'Sub-task': { color: 'gray',   hex: '#616161', icon: <IconSubtask size={12} /> },
};
const TYPE_COLORS_FALLBACK = ['#1F9196', '#0C2340', '#2e7d32', '#c62828', '#e65100', '#6a1b9a', '#616161'];

function typeMeta(type: string) {
  return TYPE_META[type] ?? { color: 'gray', hex: '#616161', icon: <IconTicket size={12} /> };
}

// Returns the current year-month as "YYYY-MM"
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Build a list of recent months for the picker
function monthOptions() {
  const opts = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const label = new Date(y, d.getMonth(), 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
    opts.push({ value: `${y}-${m}`, label });
    d.setMonth(d.getMonth() - 1);
  }
  return opts;
}

const HISTORY_MONTHS_OPTIONS = [
  { label: '3 mo', value: '3' },
  { label: '6 mo', value: '6' },
  { label: '12 mo', value: '12' },
];

export default function JiraWorklogPage() {
  const [month, setMonth] = useState(currentMonth());
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [historyAuthor, setHistoryAuthor] = useState<string | null>(null);
  const [historyMonths, setHistoryMonths] = useState('6');
  const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure(false);

  const { data: status, isLoading: statusLoading } = useJiraStatus();
  const {
    data: report,
    isLoading,
    refetch,
  } = useWorklogReport(month, projectFilter ?? undefined);

  const {
    data: historyData,
    isLoading: historyLoading,
  } = useWorklogUserHistory(historyAuthor, Number(historyMonths));

  if (statusLoading) return <Loader />;

  if (!status?.configured) {
    return (
      <Box p="xl">
        <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
          Jira credentials need to be set up before worklog data is available.
        </Alert>
      </Box>
    );
  }

  const allUsers  = report?.users ?? [];
  const maxHrs = allUsers.length > 0 ? allUsers[0].totalHours : 1;

  // Filter by search
  const users = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.trim().toLowerCase();
    return allUsers.filter(u => u.author.toLowerCase().includes(q));
  }, [allUsers, search]);

  // Collect all project keys that appear in this report (for filter dropdown)
  const projectKeys = useMemo(() => {
    const keys = new Set<string>();
    allUsers.forEach(u => u.issues.forEach(i => keys.add(i.projectKey)));
    return Array.from(keys).sort().map(k => ({ value: k, label: k }));
  }, [allUsers]);

  // Team-level issue-type chart data sorted by hours
  const typeBreakdown = useMemo(() => {
    const bd = report?.issueTypeBreakdown ?? {};
    return Object.entries(bd).sort(([, a], [, b]) => b - a);
  }, [report]);

  const totalTypeHours = typeBreakdown.reduce((s, [, h]) => s + h, 0);

  // Format "YYYY-MM" → "March 2026" using local-time constructor (avoids UTC off-by-one)
  const monthLabel = (() => {
    const parts = month.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  })();

  // Build history chart data
  const historyChartData = useMemo(() => {
    if (!historyData) return [];
    return historyData.months.map(pt => {
      const entry: Record<string, string | number> = {
        label: pt.monthLabel.replace(' 20', " '"),
      };
      entry['Total'] = pt.totalHours;
      Object.entries(pt.issueTypeBreakdown).forEach(([t, h]) => {
        entry[t] = h;
      });
      return entry;
    });
  }, [historyData]);

  // Unique issue types in history
  const historyTypes = useMemo(() => {
    if (!historyData) return [];
    const types = new Set<string>();
    historyData.months.forEach(pt =>
      Object.keys(pt.issueTypeBreakdown).forEach(t => types.add(t))
    );
    return Array.from(types);
  }, [historyData]);

  function handleOpenHistory(author: string) {
    setHistoryAuthor(author);
    openHistory();
  }

  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
            <IconClock size={22} color="white" />
          </ThemeIcon>
          <div>
            <Title order={3} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>
              Worklog Breakdown
            </Title>
            <Text size="sm" c="dimmed">
              Hours logged per person · what they worked on · where time was spent
            </Text>
          </div>
        </Group>
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

      {/* Filters */}
      <Group mb="md" gap="sm" align="flex-end">
        <Select
          label="Month"
          data={monthOptions()}
          value={month}
          onChange={v => setMonth(v ?? currentMonth())}
          size="sm"
          style={{ width: 200 }}
        />
        <Select
          label="Project"
          placeholder="All projects"
          clearable
          data={projectKeys}
          value={projectFilter}
          onChange={setProjectFilter}
          size="sm"
          style={{ width: 160 }}
        />
        <TextInput
          label="Search member"
          placeholder="Filter by name…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          size="sm"
          style={{ width: 200 }}
          rightSection={
            search ? (
              <ActionIcon size="xs" variant="subtle" onClick={() => setSearch('')}>
                <IconX size={12} />
              </ActionIcon>
            ) : null
          }
        />
      </Group>

      {isLoading ? (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Fetching worklogs from Jira…</Text>
        </Stack>
      ) : (
        <Stack gap="md">
          {/* ── KPI row ───────────────────────────────────────────── */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <KpiCard label="Total Hours"
              value={`${(report?.totalHours ?? 0).toLocaleString()} h`}
              color={AGUA} />
            <KpiCard label="Team Members"
              value={String(report?.totalUsers ?? 0)}
              color={DEEP_BLUE} />
            <KpiCard label="Avg Hours / Person"
              value={report && report.totalUsers > 0
                ? `${Math.round(report.totalHours / report.totalUsers)} h`
                : '—'}
              color="#2e7d32" />
            <KpiCard label="Issue Types"
              value={String(typeBreakdown.length)}
              color="#6a4c93" />
          </SimpleGrid>

          {/* ── Team issue-type breakdown ─────────────────────────── */}
          {typeBreakdown.length > 0 && (
            <ChartCard title="Time by Issue Type — Team Total" minHeight={160}>
              <Group gap="xl" align="flex-start">
                <RingProgress
                  size={120}
                  thickness={14}
                  sections={typeBreakdown.map(([type, hrs]) => ({
                    value: totalTypeHours > 0 ? (hrs / totalTypeHours) * 100 : 0,
                    color: typeMeta(type).color,
                    tooltip: `${type}: ${hrs} h`,
                  }))}
                  label={
                    <Text ta="center" size="xs" fw={600} c="dimmed">
                      {Math.round(report?.totalHours ?? 0)} h
                    </Text>
                  }
                />
                <Stack gap={4} style={{ flex: 1 }}>
                  {typeBreakdown.map(([type, hrs]) => (
                    <Group key={type} gap="xs" wrap="nowrap">
                      <Badge size="xs" color={typeMeta(type).color} style={{ minWidth: 80 }}>
                        {type}
                      </Badge>
                      <Box style={{ flex: 1 }}>
                        <Progress
                          value={totalTypeHours > 0 ? (hrs / totalTypeHours) * 100 : 0}
                          color={typeMeta(type).color}
                          size="sm"
                          radius="xs"
                        />
                      </Box>
                      <Text size="xs" c="dimmed" style={{ minWidth: 48, textAlign: 'right' }}>
                        {hrs} h
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Group>
            </ChartCard>
          )}

          {/* ── Per-user rows ─────────────────────────────────────── */}
          {users.length === 0 ? (
            <Alert icon={<IconAlertTriangle />} color="gray">
              {search
                ? `No team members matching "${search}" found for ${monthLabel}.`
                : `No worklog entries found for ${monthLabel}. Make sure time is logged in Jira for the configured POD projects.`}
            </Alert>
          ) : (
            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
              <Table highlightOnHover>
                <Table.Thead style={{ backgroundColor: DEEP_BLUE }}>
                  <Table.Tr>
                    <Table.Th style={{ color: 'white', width: 32 }} />{/* expand */}
                    <Table.Th style={{ color: 'white', width: 44, textAlign: 'center' }}>#</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Team Member</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Hours Logged</Table.Th>
                    <Table.Th style={{ color: 'white' }}>Breakdown by Type</Table.Th>
                    <Table.Th style={{ color: 'white', textAlign: 'right' }}>Issues</Table.Th>
                    <Table.Th style={{ color: 'white', width: 60 }} />{/* history */}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((user) => (
                    <UserRows
                      key={user.author}
                      rank={allUsers.indexOf(user) + 1}
                      user={user}
                      maxHrs={maxHrs}
                      expanded={expandedUser === user.author}
                      onToggle={() =>
                        setExpandedUser(expandedUser === user.author ? null : user.author)
                      }
                      month={month}
                      jiraBaseUrl={status.baseUrl ?? ''}
                      onHistory={() => handleOpenHistory(user.author)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Stack>
      )}

      {/* ── Month-by-month history modal ──────────────────────────── */}
      <Modal
        opened={historyOpened}
        onClose={closeHistory}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
              <IconHistory size={16} color="white" />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ color: DEEP_BLUE }}>{historyAuthor}</Text>
              <Text size="xs" c="dimmed">Month-by-month worklog history</Text>
            </div>
          </Group>
        }
        size="xl"
        centered
      >
        <Stack gap="sm">
          <Group justify="flex-end">
            <SegmentedControl
              size="xs"
              value={historyMonths}
              onChange={setHistoryMonths}
              data={HISTORY_MONTHS_OPTIONS}
            />
          </Group>

          {historyLoading ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Loading history…</Text>
            </Stack>
          ) : !historyData || historyData.months.length === 0 ? (
            <Alert icon={<IconAlertTriangle />} color="gray">
              No worklog history found for {historyAuthor}.
            </Alert>
          ) : (
            <>
              {/* Summary KPIs */}
              <SimpleGrid cols={3} spacing="xs">
                <KpiCard
                  label="Total Hours"
                  value={`${historyData.months.reduce((s, m) => s + m.totalHours, 0).toFixed(0)} h`}
                  color={AGUA}
                />
                <KpiCard
                  label="Avg / Month"
                  value={`${Math.round(
                    historyData.months.reduce((s, m) => s + m.totalHours, 0) /
                    Math.max(historyData.months.filter(m => m.totalHours > 0).length, 1)
                  )} h`}
                  color={DEEP_BLUE}
                />
                <KpiCard
                  label="Peak Month"
                  value={`${Math.max(...historyData.months.map(m => m.totalHours)).toFixed(0)} h`}
                  color="#2e7d32"
                />
              </SimpleGrid>

              {/* Bar chart */}
              <ChartCard title="Hours by Month" minHeight={260}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={historyChartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" h" />
                    <ReTooltip
                      formatter={(value: number, name: string) => [`${value} h`, name]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {historyTypes.length > 0 ? (
                      historyTypes.map((type, i) => (
                        <Bar
                          key={type}
                          dataKey={type}
                          stackId="a"
                          fill={typeMeta(type).hex ?? TYPE_COLORS_FALLBACK[i % TYPE_COLORS_FALLBACK.length]}
                          name={type}
                        />
                      ))
                    ) : (
                      <Bar dataKey="Total" fill={AGUA} name="Total Hours" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Monthly detail table */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <Table striped>
                  <Table.Thead style={{ backgroundColor: DEEP_BLUE }}>
                    <Table.Tr>
                      <Table.Th style={{ color: 'white' }}>Month</Table.Th>
                      <Table.Th style={{ color: 'white', textAlign: 'right' }}>Hours</Table.Th>
                      <Table.Th style={{ color: 'white' }}>Breakdown</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {[...historyData.months].reverse().map(pt => (
                      <Table.Tr key={pt.month}>
                        <Table.Td>
                          <Text size="sm">{pt.monthLabel}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} c={pt.totalHours > 0 ? DEEP_BLUE : 'dimmed'}>
                            {pt.totalHours > 0 ? `${pt.totalHours} h` : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="wrap">
                            {Object.entries(pt.issueTypeBreakdown)
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, hrs]) => (
                                <Badge key={type} size="xs" color={typeMeta(type).color}>
                                  {type}: {hrs} h
                                </Badge>
                              ))}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}
        </Stack>
      </Modal>
    </Box>
  );
}

// ── User row (collapsed + expanded) ───────────────────────────────────

function UserRows({
  rank,
  user,
  maxHrs,
  expanded,
  onToggle,
  month,
  jiraBaseUrl,
  onHistory,
}: {
  rank: number;
  user: WorklogUserRow;
  maxHrs: number;
  expanded: boolean;
  onToggle: () => void;
  month: string;
  jiraBaseUrl: string;
  onHistory: () => void;
}) {
  const typeEntries = Object.entries(user.issueTypeBreakdown).sort(([, a], [, b]) => b - a);

  return (
    <>
      <Table.Tr
        style={{ cursor: 'pointer' }}
        onClick={onToggle}
      >
        {/* Expand toggle */}
        <Table.Td>
          <ActionIcon variant="subtle" size="xs" color="gray">
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
        </Table.Td>

        {/* Rank */}
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="xs" fw={600} c="dimmed">{rank}</Text>
        </Table.Td>

        {/* Name */}
        <Table.Td>
          <Group gap="xs">
            <ThemeIcon size={28} radius="xl" color="gray" variant="light">
              <IconUser size={14} />
            </ThemeIcon>
            <Text size="sm" fw={500}>{user.author}</Text>
          </Group>
        </Table.Td>

        {/* Hours bar */}
        <Table.Td style={{ minWidth: 180 }}>
          <Group gap="xs" wrap="nowrap">
            <Box style={{ flex: 1 }}>
              <Progress
                value={maxHrs > 0 ? (user.totalHours / maxHrs) * 100 : 0}
                color={AGUA}
                size="md"
                radius="xs"
              />
            </Box>
            <Text size="sm" fw={600} c={DEEP_BLUE} style={{ minWidth: 52, textAlign: 'right' }}>
              {user.totalHours} h
            </Text>
          </Group>
        </Table.Td>

        {/* Type badges */}
        <Table.Td>
          <Group gap={4} wrap="wrap">
            {typeEntries.map(([type, hrs]) => (
              <Tooltip key={type} label={`${type}: ${hrs} h`} withArrow>
                <Badge
                  size="xs"
                  color={typeMeta(type).color}
                  leftSection={typeMeta(type).icon}
                >
                  {type} · {hrs} h
                </Badge>
              </Tooltip>
            ))}
          </Group>
        </Table.Td>

        {/* Issue count */}
        <Table.Td style={{ textAlign: 'right' }}>
          <Badge variant="light" color="gray" size="sm">
            {user.issues.length}
          </Badge>
        </Table.Td>

        {/* History button */}
        <Table.Td onClick={e => e.stopPropagation()}>
          <Tooltip label="View month-by-month history" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="blue"
              onClick={onHistory}
            >
              <IconHistory size={15} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>

      {/* Expanded issue list */}
      {expanded && (
        <Table.Tr>
          <Table.Td colSpan={7} style={{ padding: 0, background: '#f8f9fa' }}>
            <IssueList
              issues={user.issues}
              jiraBaseUrl={jiraBaseUrl}
              month={month}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// ── Expanded issue list ────────────────────────────────────────────────

function IssueList({
  issues,
  jiraBaseUrl,
}: {
  issues: WorklogIssueEntry[];
  jiraBaseUrl: string;
  month: string;
}) {
  // Group by issue type
  const grouped = useMemo(() => {
    const map: Record<string, WorklogIssueEntry[]> = {};
    for (const issue of issues) {
      (map[issue.issueType] ??= []).push(issue);
    }
    // Sort each group by hours desc
    Object.values(map).forEach(arr => arr.sort((a, b) => b.hoursLogged - a.hoursLogged));
    return map;
  }, [issues]);

  const typeOrder = Object.keys(grouped).sort(
    (a, b) =>
      issues.filter(i => i.issueType === b).reduce((s, i) => s + i.hoursLogged, 0) -
      issues.filter(i => i.issueType === a).reduce((s, i) => s + i.hoursLogged, 0)
  );

  return (
    <ScrollArea.Autosize mah={400}>
      <Stack gap={0} px="xl" py="sm">
        {typeOrder.map(type => (
          <Box key={type} mb="sm">
            <Group gap="xs" mb={4}>
              <Badge size="xs" color={typeMeta(type).color} leftSection={typeMeta(type).icon}>
                {type}
              </Badge>
              <Text size="xs" c="dimmed">
                {grouped[type].reduce((s, i) => s + i.hoursLogged, 0).toFixed(1)} h total ·{' '}
                {grouped[type].length} issue{grouped[type].length !== 1 ? 's' : ''}
              </Text>
            </Group>
            {grouped[type].map(issue => (
              <Group
                key={issue.issueKey}
                gap="sm"
                py={4}
                px="xs"
                style={{ borderBottom: '1px solid #eee' }}
                wrap="nowrap"
              >
                {/* Issue key */}
                <a
                  href={`${jiraBaseUrl}/browse/${issue.issueKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}
                >
                  <Group gap={4} wrap="nowrap">
                    <Text
                      size="xs"
                      fw={600}
                      style={{ fontFamily: 'monospace', color: '#1F9196', whiteSpace: 'nowrap' }}
                    >
                      {issue.issueKey}
                    </Text>
                    <IconExternalLink size={10} color="#999" />
                  </Group>
                </a>

                {/* Summary */}
                <Text size="xs" style={{ flex: 1 }} lineClamp={1} c="dimmed">
                  {issue.summary}
                </Text>

                {/* Hours chip */}
                <Badge size="xs" variant="outline" color={AGUA.replace('#', '') as any}
                  style={{ minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                  {issue.hoursLogged} h
                </Badge>
              </Group>
            ))}
          </Box>
        ))}

        {/* Footer summary */}
        <Divider mt="xs" mb={4} />
        <Group justify="flex-end" pb="xs">
          <Text size="xs" c="dimmed">
            {issues.length} issues · {issues.reduce((s, i) => s + i.hoursLogged, 0).toFixed(1)} h total
          </Text>
        </Group>
      </Stack>
    </ScrollArea.Autosize>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Paper withBorder p="md" radius="md" style={{ borderLeft: `4px solid ${color}` }}>
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">{label}</Text>
      <Text size="xl" fw={700} style={{ color }}>{value}</Text>
    </Paper>
  );
}
