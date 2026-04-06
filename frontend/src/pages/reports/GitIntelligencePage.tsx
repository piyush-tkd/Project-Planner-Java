import { useState, useMemo } from 'react';
import {
  Title, Text, Stack, Group, SimpleGrid, Card, Badge, Select,
  Paper, Box, Progress, Table, ScrollArea, Alert, ThemeIcon,
  Tabs, Anchor, Tooltip,
} from '@mantine/core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  IconGitPullRequest, IconGitCommit, IconGitBranch, IconUsers,
  IconClock, IconAlertCircle, IconCircleCheck, IconSettings,
  IconExternalLink, IconCheck, IconX, IconMinus,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import {
  useAdoStatus, useAdoSummary, useAdoPrs, useAdoCommits, useAdoBranches,
} from '../../api/azureDevOps';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

const REVIEW_VOTE_LABEL: Record<number, { label: string; color: string }> = {
  10:  { label: 'Approved',   color: '#40c057' },
  5:   { label: 'Approved*',  color: '#82c91e' },
  0:   { label: 'Pending',    color: '#868e96' },
  [-5]:{ label: 'Waiting',    color: '#fab005' },
  [-10]:{ label: 'Rejected',  color: '#fa5252' },
};

// A set of muted colors for author series in the commit bar chart
const AUTHOR_COLORS = [
  AQUA, '#8b5cf6', '#f59e0b', '#3b82f6', '#10b981',
  '#ef4444', '#ec4899', '#64748b', '#0ea5e9', '#a16207',
];

// ── Not-configured placeholder ─────────────────────────────────────────────────

function NotConfigured({ onConfigure }: { onConfigure: () => void }) {
  return (
    <Paper withBorder radius="lg" p="xl" style={{ textAlign: 'center', maxWidth: 480, margin: '60px auto' }}>
      <ThemeIcon size={56} radius="xl" variant="light" color="blue" mb="md" style={{ margin: '0 auto 16px' }}>
        <IconGitBranch size={28} />
      </ThemeIcon>
      <Title order={3} mb={6} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
        Azure DevOps not connected
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Connect your ADO organisation to see PR metrics, commit frequency, and branch health for your repositories.
      </Text>
      <Badge
        size="lg"
        color="blue"
        variant="light"
        style={{ cursor: 'pointer' }}
        leftSection={<IconSettings size={13} />}
        onClick={onConfigure}
      >
        Go to Azure DevOps Settings
      </Badge>
    </Paper>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <Card withBorder radius="lg" p="md">
      <Group justify="space-between" mb={6}>
        <Text size="xs" tt="uppercase" fw={700}
          style={{ color: '#94a3b8', letterSpacing: '0.6px', fontFamily: FONT_FAMILY }}>
          {label}
        </Text>
        <ThemeIcon variant="light" color={color} size={32} radius="md">{icon}</ThemeIcon>
      </Group>
      <Text fw={800} size="xl" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{value}</Text>
      {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GitIntelligencePage() {
  const navigate    = useNavigate();
  const [days, setDays]   = useState('90');
  const [repo, setRepo]   = useState<string | null>(null);
  const [subTab, setSubTab] = useState('prs');

  const { data: status, isLoading: statusLoading } = useAdoStatus();
  const configured = status?.configured ?? false;
  const repos      = status?.repos ?? [];

  const daysNum = Number(days);
  const repoParam = repo === 'all' ? null : repo;

  const { data: summary, isLoading: sumLoading } = useAdoSummary(daysNum);
  const { data: prs,     isLoading: prLoading  } = useAdoPrs(repoParam, daysNum);
  const { data: commits, isLoading: cmLoading  } = useAdoCommits(repoParam, daysNum);
  const { data: branches,isLoading: brLoading  } = useAdoBranches(repoParam);

  // ── Commit chart data (stacked bar per author) ────────────────────────────

  const commitChartData = useMemo(() => {
    if (!commits?.dailyTotals) return [];
    // Aggregate into weekly buckets for readability
    const weekMap: Record<string, Record<string, number>> = {};
    for (const author of commits.byAuthor ?? []) {
      for (const [date, count] of Object.entries(author.byDay)) {
        // Get Monday of the week
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay() + 1);
        const week = d.toISOString().slice(0, 10);
        if (!weekMap[week]) weekMap[week] = {};
        weekMap[week][author.author] = (weekMap[week][author.author] ?? 0) + count;
      }
    }
    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({ week: week.slice(5), ...data }));
  }, [commits]);

  const commitAuthors = useMemo(() => {
    return (commits?.byAuthor ?? [])
      .sort((a, b) =>
        Object.values(b.byDay).reduce((s, v) => s + v, 0) -
        Object.values(a.byDay).reduce((s, v) => s + v, 0)
      )
      .slice(0, 10)
      .map(a => a.author);
  }, [commits]);

  // ── Repo selector options ─────────────────────────────────────────────────

  const repoOptions = [
    { value: 'all', label: 'All repositories' },
    ...repos.map(r => ({ value: r, label: r })),
  ];

  // ── Loading / not configured ──────────────────────────────────────────────

  if (statusLoading) return <LoadingSpinner variant="chart" message="Checking Azure DevOps…" />;

  if (!configured) {
    return <NotConfigured onConfigure={() => navigate('/settings/azure-devops')} />;
  }

  const dataLoading = sumLoading || prLoading || cmLoading || brLoading;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack gap="lg">

      {/* Header + controls */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 800 }}>
            Git Intelligence
          </Title>
          <Text size="sm" c="dimmed">
            Azure DevOps · {repos.length} repo{repos.length !== 1 ? 's' : ''}
          </Text>
        </Box>
        <Group gap="sm">
          <Select
            data={repoOptions}
            value={repo ?? 'all'}
            onChange={v => setRepo(v === 'all' ? null : v)}
            style={{ width: 200 }}
            size="sm"
            label="Repository"
            styles={{ label: { fontSize: 11, fontWeight: 600 } }}
          />
          <Select
            data={[
              { value: '30',  label: 'Last 30 days' },
              { value: '90',  label: 'Last 90 days' },
              { value: '180', label: 'Last 180 days' },
            ]}
            value={days}
            onChange={v => setDays(v ?? '90')}
            style={{ width: 150 }}
            size="sm"
            label="Period"
            styles={{ label: { fontSize: 11, fontWeight: 600 } }}
          />
        </Group>
      </Group>

      {/* KPI strip */}
      {dataLoading ? (
        <LoadingSpinner variant="chart" message="Loading Git data from Azure DevOps…" />
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
            <KpiCard
              icon={<IconGitPullRequest size={16} />}
              label="PRs Merged"
              value={String(summary?.prsMerged ?? '—')}
              sub={`last ${days} days`}
              color="blue"
            />
            <KpiCard
              icon={<IconClock size={16} />}
              label="Avg Review Time"
              value={summary?.avgCycleHours ? fmtHours(summary.avgCycleHours) : '—'}
              sub="creation → merge"
              color={
                !summary?.avgCycleHours ? 'gray'
                : summary.avgCycleHours < 24 ? 'teal'
                : summary.avgCycleHours < 72 ? 'orange'
                : 'red'
              }
            />
            <KpiCard
              icon={<IconGitCommit size={16} />}
              label="Commits"
              value={String(commits?.totalCommits ?? '—')}
              sub={`last ${days} days`}
              color="violet"
            />
            <KpiCard
              icon={<IconUsers size={16} />}
              label="Contributors"
              value={String(summary?.contributors ?? commits?.uniqueAuthors ?? '—')}
              sub="unique authors"
              color="teal"
            />
            <KpiCard
              icon={<IconGitBranch size={16} />}
              label="Branches"
              value={String(branches?.length ?? '—')}
              sub="active"
              color="orange"
            />
          </SimpleGrid>

          {/* Sub-tabs */}
          <Tabs value={subTab} onChange={v => setSubTab(v ?? 'prs')} variant="pills" radius="sm">
            <Tabs.List mb="lg">
              <Tabs.Tab value="prs"      leftSection={<IconGitPullRequest size={14} />}>PR Activity</Tabs.Tab>
              <Tabs.Tab value="commits"  leftSection={<IconGitCommit size={14} />}>Commit Frequency</Tabs.Tab>
              <Tabs.Tab value="branches" leftSection={<IconGitBranch size={14} />}>Branch Health</Tabs.Tab>
            </Tabs.List>

            {/* ══════════ PR ACTIVITY ══════════ */}
            <Tabs.Panel value="prs">
              {!prs || prs.length === 0 ? (
                <Alert icon={<IconAlertCircle size={15} />} color="gray">
                  No completed PRs found in the selected period and repository.
                </Alert>
              ) : (
                <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                  {/* Table header */}
                  <Box style={{ background: DEEP_BLUE, padding: '10px 16px', display: 'flex', gap: 0 }}>
                    {[
                      { label: 'PR',          w: 60  },
                      { label: 'Title',       w: 280 },
                      { label: 'Author',      w: 160 },
                      { label: 'Reviewers',   w: 200 },
                      { label: 'Opened',      w: 100 },
                      { label: 'Merged',      w: 100 },
                      { label: 'Cycle Time',  w: 100 },
                      { label: 'Repo',        w: undefined },
                    ].map(col => (
                      <Text key={col.label} size="10px" fw={700} tt="uppercase"
                        style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.7px',
                                 width: col.w, flexShrink: 0, flex: col.w ? undefined : 1 }}>
                        {col.label}
                      </Text>
                    ))}
                  </Box>

                  <ScrollArea style={{ maxHeight: 520 }}>
                    {prs.slice(0, 100).map((pr, i) => {
                      const cycleColor =
                        pr.cycleTimeHours == null ? '#94a3b8'
                        : pr.cycleTimeHours < 24  ? '#40c057'
                        : pr.cycleTimeHours < 72  ? '#fab005'
                        : '#fa5252';
                      return (
                        <Box key={pr.id} style={{
                          display: 'flex', alignItems: 'center',
                          padding: '9px 16px',
                          borderBottom: '1px solid var(--mantine-color-default-border)',
                          background: i % 2 === 0 ? 'var(--mantine-color-body)' : 'var(--mantine-color-default-hover)',
                        }}>
                          <Text size="xs" c="dimmed" style={{ width: 60, flexShrink: 0 }}>
                            #{pr.id}
                          </Text>
                          <Box style={{ width: 280, flexShrink: 0, paddingRight: 8 }}>
                            <Text size="xs" fw={500} style={{ color: DEEP_BLUE }}
                              lineClamp={1} title={pr.title}>
                              {pr.title}
                            </Text>
                          </Box>
                          <Text size="xs" c="dimmed" style={{ width: 160, flexShrink: 0 }}>{pr.author}</Text>
                          <Box style={{ width: 200, flexShrink: 0 }}>
                            {pr.reviewers.slice(0, 3).map(r => (
                              <Badge key={r} size="xs" variant="light" color="gray" mr={2}>
                                {r.split(' ')[0]}
                              </Badge>
                            ))}
                            {pr.reviewers.length > 3 && (
                              <Text size="10px" c="dimmed">+{pr.reviewers.length - 3}</Text>
                            )}
                          </Box>
                          <Text size="xs" c="dimmed" style={{ width: 100, flexShrink: 0 }}>
                            {pr.createdDate ?? '—'}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ width: 100, flexShrink: 0 }}>
                            {pr.closedDate ?? '—'}
                          </Text>
                          <Text size="xs" fw={600}
                            style={{ width: 100, flexShrink: 0, color: cycleColor }}>
                            {pr.cycleTimeHours != null ? fmtHours(pr.cycleTimeHours) : '—'}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ flex: 1 }}>{pr.repo}</Text>
                        </Box>
                      );
                    })}
                  </ScrollArea>

                  <Box style={{ padding: '8px 16px', borderTop: '1px solid #f0f4f8', background: '#fafbfc' }}>
                    <Text size="xs" c="dimmed">
                      Showing {Math.min(100, prs.length)} of {prs.length} PRs
                      {summary?.avgCycleHours
                        ? ` · avg review time ${fmtHours(summary.avgCycleHours)}`
                        : ''}
                    </Text>
                  </Box>
                </Paper>
              )}
            </Tabs.Panel>

            {/* ══════════ COMMIT FREQUENCY ══════════ */}
            <Tabs.Panel value="commits">
              {!commits || commits.totalCommits === 0 ? (
                <Alert icon={<IconAlertCircle size={15} />} color="gray">
                  No commits found in the selected period and repository.
                </Alert>
              ) : (
                <Stack gap="md">
                  {/* Weekly stacked bar */}
                  <Paper withBorder p="lg" radius="md">
                    <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      Commits per week by author (top 10)
                    </Text>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={commitChartData} margin={{ left: 0, right: 16, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <RechartTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        {commitAuthors.map((author, i) => (
                          <Bar
                            key={author}
                            dataKey={author}
                            stackId="a"
                            fill={AUTHOR_COLORS[i % AUTHOR_COLORS.length]}
                            name={author.split(' ')[0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>

                  {/* Per-author summary */}
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      Author breakdown
                    </Text>
                    <Stack gap="sm">
                      {(commits.byAuthor ?? [])
                        .map(a => ({
                          author: a.author,
                          total: Object.values(a.byDay).reduce((s, v) => s + v, 0),
                        }))
                        .sort((a, b) => b.total - a.total)
                        .map((a, i) => {
                          const max = (commits.byAuthor ?? [])
                            .map(x => Object.values(x.byDay).reduce((s, v) => s + v, 0))
                            .reduce((m, v) => Math.max(m, v), 1);
                          const pct = (a.total / max) * 100;
                          return (
                            <Box key={a.author}>
                              <Group justify="space-between" mb={3}>
                                <Group gap={8}>
                                  <Box style={{
                                    width: 10, height: 10, borderRadius: 2,
                                    background: AUTHOR_COLORS[i % AUTHOR_COLORS.length],
                                    flexShrink: 0,
                                  }} />
                                  <Text size="xs" fw={500} style={{ color: DEEP_BLUE }}>{a.author}</Text>
                                </Group>
                                <Text size="xs" c="dimmed">{a.total} commits</Text>
                              </Group>
                              <Progress
                                value={pct}
                                color="blue"
                                size={5}
                                radius="xl"
                                style={{ '--progress-section-color': AUTHOR_COLORS[i % AUTHOR_COLORS.length] } as React.CSSProperties}
                              />
                            </Box>
                          );
                        })}
                    </Stack>
                  </Paper>
                </Stack>
              )}
            </Tabs.Panel>

            {/* ══════════ BRANCH HEALTH ══════════ */}
            <Tabs.Panel value="branches">
              {!branches || branches.length === 0 ? (
                <Alert icon={<IconAlertCircle size={15} />} color="gray">
                  No branches found.
                </Alert>
              ) : (
                <Stack gap="md">
                  <Group gap="md">
                    <Badge size="sm" color="teal">
                      {branches.filter(b =>
                        b.name === 'main' || b.name === 'master' || b.name === 'develop').length} trunk branches
                    </Badge>
                    <Badge size="sm" color="blue">
                      {branches.filter(b => b.name.startsWith('feature/')).length} feature branches
                    </Badge>
                    <Badge size="sm" color="orange">
                      {branches.filter(b => b.name.startsWith('hotfix/')).length} hotfix branches
                    </Badge>
                    <Badge size="sm" color="gray">
                      {branches.length} total
                    </Badge>
                  </Group>

                  <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                    <Box style={{ background: DEEP_BLUE, padding: '10px 16px', display: 'flex' }}>
                      {[
                        { label: 'Branch',      w: 320 },
                        { label: 'Repo',        w: 180 },
                        { label: 'Created by',  w: undefined },
                      ].map(col => (
                        <Text key={col.label} size="10px" fw={700} tt="uppercase"
                          style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.7px',
                                   width: col.w, flexShrink: 0, flex: col.w ? undefined : 1 }}>
                          {col.label}
                        </Text>
                      ))}
                    </Box>

                    <ScrollArea style={{ maxHeight: 520 }}>
                      {branches.map((b, i) => {
                        const isTrunk = b.name === 'main' || b.name === 'master' || b.name === 'develop';
                        const isFeature = b.name.startsWith('feature/');
                        const badgeColor = isTrunk ? 'teal' : isFeature ? 'blue' : 'gray';
                        return (
                          <Box key={`${b.repo}-${b.name}`} style={{
                            display: 'flex', alignItems: 'center',
                            padding: '9px 16px',
                            borderBottom: '1px solid var(--mantine-color-default-border)',
                            background: i % 2 === 0 ? 'var(--mantine-color-body)' : 'var(--mantine-color-default-hover)',
                          }}>
                            <Box style={{ width: 320, flexShrink: 0 }}>
                              <Group gap={8}>
                                <Badge size="xs" color={badgeColor} variant="dot">
                                  {b.name}
                                </Badge>
                              </Group>
                            </Box>
                            <Text size="xs" c="dimmed" style={{ width: 180, flexShrink: 0 }}>
                              {b.repo}
                            </Text>
                            <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                              {b.createdBy ?? '—'}
                            </Text>
                          </Box>
                        );
                      })}
                    </ScrollArea>
                  </Paper>
                </Stack>
              )}
            </Tabs.Panel>
          </Tabs>
        </>
      )}
    </Stack>
  );
}
