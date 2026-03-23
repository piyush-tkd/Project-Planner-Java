import { useState, useMemo, useEffect } from 'react';
import {
  Title, Text, Stack, Group, Badge, Alert, Loader, Anchor, Paper,
  Collapse, ActionIcon, Divider, SimpleGrid, ThemeIcon, Tooltip,
  ScrollArea, Table, Box, SegmentedControl, MultiSelect, TextInput, Button,
} from '@mantine/core';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  IconPackage, IconAlertTriangle, IconChevronDown, IconChevronUp,
  IconExternalLink, IconSearch, IconCheck, IconTag,
  IconCalendarEvent, IconBookmark, IconRefresh,
} from '@tabler/icons-react';
import { useJiraStatus, useReleaseMetrics, useSearchReleaseVersion, useAllFixVersions, type IssueRow, type ReleaseMetrics } from '../api/jira';
import { useReleases } from '../api/releases';
import type { ReleaseCalendarResponse } from '../types/project';
import { DEEP_BLUE, FONT_FAMILY } from '../brandTokens';

// ── Brand / colour helpers ────────────────────────────────────────────────────

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

function issueTypeStyle(type: string) {
  return ISSUE_TYPE_COLORS[type] ?? { bg: '#EFF6FF', text: '#3B82F6' };
}

const STATUS_CAT_COLOR: Record<string, string> = {
  'To Do':       '#94A3B8',
  'In Progress': '#F59E0B',
  'Done':        '#22C55E',
};

function statusColor(cat: string) {
  return STATUS_CAT_COLOR[cat] ?? '#94A3B8';
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Try to correlate a Jira version name to a Release Calendar entry ─────────
function matchCalendarRelease(
  versionName: string,
  releases: ReleaseCalendarResponse[],
): ReleaseCalendarResponse | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const vn = norm(versionName);
  return releases.find(r => {
    const rn = norm(r.name);
    return rn === vn || rn.includes(vn) || vn.includes(rn);
  });
}

// ── Issue type filter options ─────────────────────────────────────────────────
const TYPE_FILTERS = ['All', 'Story', 'Bug', 'Task', 'Other'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

function filterIssues(issues: IssueRow[], typeFilter: TypeFilter, search: string): IssueRow[] {
  return issues.filter(i => {
    const typeMatch =
      typeFilter === 'All' ? true :
      typeFilter === 'Story' ? i.issueType === 'Story' :
      typeFilter === 'Bug'   ? i.issueType === 'Bug' :
      typeFilter === 'Task'  ? i.issueType === 'Task' :
      !['Story', 'Bug', 'Task'].includes(i.issueType);

    const searchLower = search.toLowerCase();
    const searchMatch = !search ||
      i.key.toLowerCase().includes(searchLower) ||
      i.summary.toLowerCase().includes(searchLower) ||
      i.assignee.toLowerCase().includes(searchLower);

    return typeMatch && searchMatch;
  });
}

// ── Ad-hoc version result (self-fetching, renders one card per POD) ──────────
function VersionResultSection({
  versionName,
  calendarReleases,
  jiraBaseUrl,
}: {
  versionName: string;
  calendarReleases: ReleaseCalendarResponse[];
  jiraBaseUrl: string;
}) {
  const { data, isLoading, isFetching } = useSearchReleaseVersion(versionName, true);
  const calendarRelease = matchCalendarRelease(versionName, calendarReleases);

  if (isLoading || isFetching) {
    return (
      <Paper withBorder radius="md" p="md">
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">Loading <strong>{versionName}</strong> from Jira…</Text>
        </Group>
      </Paper>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Alert color="blue" icon={<IconTag size={14} />}>
        No issues tagged with fix version <strong>"{versionName}"</strong> in any configured Jira board.
        Check that the version name exactly matches what's in Jira (case-sensitive).
      </Alert>
    );
  }
  // Check if every entry is an error
  const allErrors = data.every(m => !!m.errorMessage);
  if (allErrors) {
    return (
      <Alert icon={<IconAlertTriangle size={14} />} color="red">
        <strong>{versionName}</strong>: {data[0].errorMessage}
      </Alert>
    );
  }
  return (
    <>
      {data.map(metrics => (
        <ReleaseSection
          key={`${metrics.podId ?? metrics.podDisplayName}-${metrics.versionName}`}
          metrics={metrics}
          calendarRelease={calendarRelease}
          jiraBaseUrl={jiraBaseUrl}
        />
      ))}
    </>
  );
}

// ── Per-release section ───────────────────────────────────────────────────────
function ReleaseSection({
  metrics,
  calendarRelease,
  jiraBaseUrl,
}: {
  metrics: ReleaseMetrics;
  calendarRelease: ReleaseCalendarResponse | undefined;
  jiraBaseUrl: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [search, setSearch] = useState('');

  const stories = metrics.issues.filter(i => i.issueType === 'Story').length;
  const bugs    = metrics.issues.filter(i => i.issueType === 'Bug').length;
  const other   = metrics.issues.length - stories - bugs;
  const donePct = metrics.totalSP > 0
    ? Math.round((metrics.doneSP / metrics.totalSP) * 100)
    : metrics.issues.length > 0
      ? Math.round((metrics.issues.filter(i => i.statusCategory === 'Done').length / metrics.issues.length) * 100)
      : 0;

  const visibleIssues = useMemo(
    () => filterIssues(metrics.issues, typeFilter, search),
    [metrics.issues, typeFilter, search],
  );

  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      {/* ── Section header ───────────────────────────────────────────── */}
      <Box
        onClick={() => setExpanded(e => !e)}
        style={{
          background: DEEP_BLUE,
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={30} radius="sm" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <IconPackage size={17} color="white" />
            </ThemeIcon>
            <div>
              <Group gap="xs" wrap="nowrap">
                <Text fw={700} c="white" style={{ fontFamily: FONT_FAMILY }}>
                  {metrics.versionName}
                </Text>
                <Badge size="xs" variant="light" color="gray" style={{ opacity: 0.8 }}>
                  {metrics.podDisplayName}
                </Badge>
              </Group>
              {calendarRelease && (
                <Group gap={6} mt={2}>
                  <IconCalendarEvent size={12} color="rgba(255,255,255,0.65)" />
                  <Text size="xs" c="rgba(255,255,255,0.65)">
                    Code Freeze: {formatDate(calendarRelease.codeFreezeDate)}
                    {' · '}
                    Released: {formatDate(calendarRelease.releaseDate)}
                    {calendarRelease.type === 'SPECIAL' && (
                      <> · <span style={{ color: '#FFA94D' }}>Special Release</span></>
                    )}
                  </Text>
                </Group>
              )}
            </div>
          </Group>

          <Group gap="sm" wrap="nowrap">
            {/* Quick stats */}
            <Badge color="violet" variant="light">{stories} Stor{stories !== 1 ? 'ies' : 'y'}</Badge>
            <Badge color="red"    variant="light">{bugs} Bug{bugs !== 1 ? 's' : ''}</Badge>
            {other > 0 && <Badge color="blue" variant="light">{other} Other</Badge>}
            <Badge
              color={donePct >= 90 ? 'green' : donePct >= 50 ? 'yellow' : 'gray'}
              variant="filled"
            >
              {donePct}% Done
            </Badge>
            <ActionIcon
              variant="subtle"
              style={{ color: 'white' }}
              onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            >
              {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* ── Collapsed: summary only ───────────────────────────────────── */}
      {!expanded && (
        <Box px="md" py="xs" style={{ background: '#f8f9fa' }}>
          <Text size="sm" c="dimmed">
            {metrics.totalIssues} issues · {metrics.totalSP > 0 ? `${metrics.totalSP} SP total, ${metrics.doneSP} SP done` : 'no story points'} · click to expand
          </Text>
        </Box>
      )}

      {/* ── Expanded: stats + issue table ────────────────────────────── */}
      <Collapse in={expanded}>
        {metrics.errorMessage ? (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" m="md">
            {metrics.errorMessage}
          </Alert>
        ) : metrics.issues.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            No issues tagged with this fix version in Jira.
          </Text>
        ) : (
          <>
            {/* ── Stats row ──────────────────────────────────────────── */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
              <Box ta="center">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Issues</Text>
                <Text fw={700} size="xl" style={{ color: DEEP_BLUE }}>{metrics.totalIssues}</Text>
              </Box>
              <Box ta="center">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Story Points</Text>
                <Text fw={700} size="xl" style={{ color: DEEP_BLUE }}>
                  {metrics.doneSP > 0 ? `${metrics.doneSP} / ${metrics.totalSP}` : metrics.totalSP > 0 ? metrics.totalSP : '—'}
                </Text>
                {metrics.totalSP > 0 && (
                  <Text size="xs" c="dimmed">{donePct}% done</Text>
                )}
              </Box>
              <Box ta="center">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Hours Logged</Text>
                <Text fw={700} size="xl" style={{ color: DEEP_BLUE }}>
                  {metrics.totalHoursLogged > 0 ? `${metrics.totalHoursLogged.toFixed(0)}h` : '—'}
                </Text>
              </Box>
              <Box ta="center">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Assignees</Text>
                <Text fw={700} size="xl" style={{ color: DEEP_BLUE }}>
                  {Object.keys(metrics.assigneeBreakdown).length}
                </Text>
              </Box>
            </SimpleGrid>

            {/* ── Filters ────────────────────────────────────────────── */}
            <Group px="md" py="sm" justify="space-between" wrap="wrap" style={{ borderBottom: '1px solid #e9ecef', background: '#fafafa' }}>
              <SegmentedControl
                size="xs"
                value={typeFilter}
                onChange={v => setTypeFilter(v as TypeFilter)}
                data={TYPE_FILTERS.map(t => ({
                  value: t,
                  label: t === 'All'
                    ? `All (${metrics.issues.length})`
                    : t === 'Story' ? `Stories (${stories})`
                    : t === 'Bug'   ? `Bugs (${bugs})`
                    : t === 'Task'  ? `Tasks (${metrics.issues.filter(i => i.issueType === 'Task').length})`
                    : `Other (${other})`,
                }))}
              />
              <TextInput
                size="xs"
                placeholder="Search key / summary / assignee…"
                leftSection={<IconSearch size={13} />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 260 }}
              />
            </Group>

            {/* ── Issue table ────────────────────────────────────────── */}
            <ScrollArea>
              <Table fz="sm" withColumnBorders highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 100 }}>Key</Table.Th>
                    <Table.Th style={{ minWidth: 80 }}>Type</Table.Th>
                    <Table.Th style={{ minWidth: 430 }}>Summary</Table.Th>
                    <Table.Th style={{ minWidth: 90 }}>Status</Table.Th>
                    <Table.Th style={{ minWidth: 140 }}>Assignee</Table.Th>
                    <Table.Th style={{ minWidth: 50, textAlign: 'right' }}>SP</Table.Th>
                    <Table.Th style={{ minWidth: 60, textAlign: 'right' }}>Hours</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibleIssues.map(issue => {
                    const typeStyle = issueTypeStyle(issue.issueType);
                    const sCatColor = statusColor(issue.statusCategory);
                    const isDone = issue.statusCategory === 'Done';
                    return (
                      <Table.Tr key={issue.key} style={{ opacity: isDone ? 0.75 : 1 }}>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Anchor
                              href={`${jiraBaseUrl}/browse/${issue.key}`}
                              target="_blank"
                              rel="noreferrer"
                              fw={600}
                              size="sm"
                            >
                              {issue.key}
                            </Anchor>
                            <IconExternalLink size={11} color="#94A3B8" />
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            style={{ background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.text}33` }}
                          >
                            {issue.issueType}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ maxWidth: 500 }}>
                          <Tooltip label={issue.summary} disabled={issue.summary.length < 80} withArrow multiline w={400}>
                            <Text size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                              {isDone && <IconCheck size={12} style={{ marginRight: 4, color: '#22C55E', display: 'inline', verticalAlign: 'middle' }} />}
                              {issue.summary}
                            </Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            variant="dot"
                            style={{ '--badge-dot-color': sCatColor } as React.CSSProperties}
                          >
                            {issue.statusName}
                          </Badge>
                        </Table.Td>
                        <Table.Td c="dimmed" size="sm">{issue.assignee}</Table.Td>
                        <Table.Td ta="right">
                          {issue.storyPoints > 0
                            ? <Badge size="xs" variant="outline" color="violet">{issue.storyPoints}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>
                        <Table.Td ta="right">
                          {issue.hoursLogged > 0
                            ? <Text size="xs">{issue.hoursLogged.toFixed(1)}h</Text>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                  {visibleIssues.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text ta="center" c="dimmed" py="md" size="sm">No issues match your filter.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </>
        )}
      </Collapse>
    </Paper>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReleaseNotesPage() {
  const { data: jiraStatus } = useJiraStatus();
  const { data: releaseMetrics, isLoading: metricsLoading, isFetching: metricsFetching, refetch: refetchMetrics } = useReleaseMetrics();
  const { data: calendarReleases } = useReleases();
  const { data: allFixVersions, isLoading: versionsLoading, refetch: refetchVersions } = useAllFixVersions();

  const handleRefresh = () => { refetchMetrics(); refetchVersions(); };

  const jiraBaseUrl = jiraStatus?.baseUrl ?? '';

  // ── Tracked version names (deduplicated) ──────────────────────────
  const trackedVersionNames = useMemo(
    () => [...new Set((releaseMetrics ?? []).map(m => m.versionName))],
    [releaseMetrics],
  );

  // ── Selected versions — seeded once from tracked releases ─────────
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && !metricsLoading) {
      setSelectedVersions(trackedVersionNames);
      setSeeded(true);
    }
  }, [trackedVersionNames, metricsLoading, seeded]);

  // ── MultiSelect data: Tracked group + Jira unreleased + released ──
  const multiSelectData = useMemo(() => {
    const trackedSet = new Set(trackedVersionNames);
    const trackedItems = trackedVersionNames.map(name => ({ value: name, label: name }));
    const others = (allFixVersions ?? []).filter(v => !trackedSet.has(v.name));
    const unreleasedOther = others.filter(v => !v.released).map(v => ({ value: v.name, label: v.name }));
    const releasedOther   = others.filter(v =>  v.released).map(v => ({ value: v.name, label: v.name }));
    const result = [];
    if (trackedItems.length > 0)    result.push({ group: '📌 Tracked Versions', items: trackedItems });
    if (unreleasedOther.length > 0) result.push({ group: '🚀 Unreleased / Upcoming', items: unreleasedOther });
    if (releasedOther.length > 0)   result.push({ group: '✅ Released', items: releasedOther });
    return result;
  }, [trackedVersionNames, allFixVersions]);

  // ── Summary badges: from tracked releases that are currently visible ─
  const visibleTracked = useMemo(
    () => (releaseMetrics ?? []).filter(m => selectedVersions.includes(m.versionName)),
    [releaseMetrics, selectedVersions],
  );
  const totalStories = visibleTracked.reduce((n, m) => n + m.issues.filter(i => i.issueType === 'Story').length, 0);
  const totalBugs    = visibleTracked.reduce((n, m) => n + m.issues.filter(i => i.issueType === 'Bug').length, 0);
  const totalIssues  = visibleTracked.reduce((n, m) => n + m.totalIssues, 0);

  // ── Jira not configured guard ─────────────────────────────────────
  if (!jiraStatus?.configured) {
    return (
      <Stack>
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" style={{ background: DEEP_BLUE }}>
            <IconPackage size={20} color="white" />
          </ThemeIcon>
          <Title order={2} style={{ color: DEEP_BLUE }}>Release Notes</Title>
        </Group>
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Jira Not Configured">
          Jira integration is not set up. Go to Settings → Jira Credentials to configure it, then track
          your release fix versions in Settings → Release Versions.
        </Alert>
      </Stack>
    );
  }

  const hasAnyResults = selectedVersions.length > 0;

  return (
    <Stack gap="md" className="page-enter stagger-children">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <Group justify="space-between" wrap="wrap" className="slide-in-left">
        <Group gap="sm" align="center">
          <ThemeIcon size={36} radius="md" style={{ background: DEEP_BLUE }}>
            <IconPackage size={20} color="white" />
          </ThemeIcon>
          <div>
            <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              Release Notes
            </Title>
            <Text size="sm" c="dimmed">
              Stories &amp; bugs per Jira fix version · linked to Release Calendar dates
            </Text>
          </div>
        </Group>
        <Group gap="sm">
          {visibleTracked.length > 0 && (
            <>
              <Badge size="lg" variant="light" color="violet">{totalStories} Stories</Badge>
              <Badge size="lg" variant="light" color="red">{totalBugs} Bugs</Badge>
              <Badge size="lg" variant="light" color="blue">{totalIssues} Total</Badge>
            </>
          )}
          <Button
            variant="light"
            size="sm"
            leftSection={<IconRefresh size={15} />}
            loading={metricsFetching}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ── Version picker ────────────────────────────────────────────── */}
      <MultiSelect
        label="Fix Versions"
        description={
          <Text size="xs" c="dimmed">
            Your tracked versions are pre-selected. Search to add any past or future release.
          </Text>
        }
        placeholder={
          metricsLoading || versionsLoading
            ? 'Loading…'
            : selectedVersions.length === 0
              ? 'Select or search a fix version…'
              : undefined
        }
        searchable
        clearable
        data={multiSelectData}
        value={selectedVersions}
        onChange={setSelectedVersions}
        disabled={metricsLoading}
        maxDropdownHeight={340}
        rightSection={(metricsLoading || versionsLoading) ? <Loader size="xs" /> : <IconSearch size={14} color="#adb5bd" />}
        renderOption={({ option }) => {
          const isTracked = trackedVersionNames.includes(option.value);
          const jv = allFixVersions?.find(v => v.name === option.value);
          return (
            <Group gap="sm" wrap="nowrap" style={{ width: '100%' }}>
              <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  {isTracked && <IconBookmark size={11} color={DEEP_BLUE} />}
                  <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {option.label}
                  </Text>
                </Group>
                {jv?.podNames && jv.podNames.length > 0 && (
                  <Group gap={4} wrap="wrap">
                    {jv.podNames.map(p => (
                      <Badge key={p} size="xs" variant="light" color="blue">{p}</Badge>
                    ))}
                    {jv.releaseDate && <Text size="xs" c="dimmed">· {jv.releaseDate}</Text>}
                  </Group>
                )}
              </Stack>
              {isTracked && (
                <Badge size="xs" color="teal" variant="light" style={{ flexShrink: 0 }}>tracked</Badge>
              )}
            </Group>
          );
        }}
      />

      {/* ── Loading skeleton ──────────────────────────────────────────── */}
      {metricsLoading && (
        <LoadingSpinner variant="table" message="Loading release notes..." />
      )}

      {/* ── Empty state: nothing tracked and nothing selected ────────── */}
      {!metricsLoading && !hasAnyResults && (
        <Alert icon={<IconTag size={16} />} color="blue" title="No Versions Selected">
          Your tracked versions will appear here automatically. You can also search for any fix version
          above to explore past or upcoming releases. To add tracked versions go to{' '}
          <strong>Settings → Release Versions</strong>.
        </Alert>
      )}

      {/* ── Results — one card per selected version ───────────────────── */}
      {!metricsLoading && selectedVersions.map(versionName => {
        // Tracked? Render all per-POD entries from releaseMetrics
        const trackedEntries = (releaseMetrics ?? []).filter(m => m.versionName === versionName);
        if (trackedEntries.length > 0) {
          return trackedEntries.map(m => (
            <ReleaseSection
              key={`${m.podId}-${m.versionName}`}
              metrics={m}
              calendarRelease={matchCalendarRelease(m.versionName, calendarReleases ?? [])}
              jiraBaseUrl={jiraBaseUrl}
            />
          ));
        }
        // Not tracked — fetch on demand via search endpoint
        return (
          <VersionResultSection
            key={versionName}
            versionName={versionName}
            calendarReleases={calendarReleases ?? []}
            jiraBaseUrl={jiraBaseUrl}
          />
        );
      })}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      {hasAnyResults && !metricsLoading && (
        <>
          <Divider />
          <Group gap="lg" wrap="wrap">
            {(['Story', 'Bug', 'Task'] as const).map(t => {
              const s = issueTypeStyle(t);
              return (
                <Group key={t} gap={6} align="center">
                  <Box style={{ width: 12, height: 12, borderRadius: 2, background: s.bg, border: `1px solid ${s.text}44` }} />
                  <Text size="xs" c="dimmed">{t}</Text>
                </Group>
              );
            })}
            <Divider orientation="vertical" />
            {[['To Do', '#94A3B8'], ['In Progress', '#F59E0B'], ['Done', '#22C55E']].map(([label, color]) => (
              <Group key={label} gap={6} align="center">
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <Text size="xs" c="dimmed">{label}</Text>
              </Group>
            ))}
          </Group>
        </>
      )}
    </Stack>
  );
}
