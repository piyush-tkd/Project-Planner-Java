import { useState, useMemo } from 'react';
import {
  Title, Text, Group, Select, Table, TextInput,
  Stack, SimpleGrid, ScrollArea, ThemeIcon, SegmentedControl,
  Tooltip, Modal, Badge, Paper, Loader, Box, UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconSearch, IconClock, IconCoin, IconBug, IconBook2,
  IconTarget, IconUsers, IconExternalLink,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import {
  useResourcePerformance, useResourceIssues,
  ResourceMetrics, PeriodMetrics, PerformanceSummary,
} from '../../api/resourcePerformance';
import SummaryCard from '../../components/charts/SummaryCard';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

type MetricView = 'hours' | 'dollars' | 'stories' | 'bugs' | 'sp' | 'issues';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.substring(0, 2)?.toUpperCase() ?? '?';
}

function formatDollars(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatHours(val: number): string {
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(1);
}

function getMetricValue(p: PeriodMetrics, metric: MetricView): number {
  switch (metric) {
    case 'hours': return p.hoursLogged;
    case 'dollars': return p.dollarValue;
    case 'stories': return p.storyCount;
    case 'bugs': return p.bugCount;
    case 'sp': return p.storyPointsCompleted;
    case 'issues': return p.totalIssues;
  }
}

function formatMetric(val: number, metric: MetricView): string {
  if (val === 0) return '\u2014';
  switch (metric) {
    case 'hours': return `${val.toFixed(1)}h`;
    case 'dollars': return formatDollars(val);
    case 'stories':
    case 'bugs':
    case 'issues': return String(val);
    case 'sp': return String(Math.round(val));
  }
}

function metricColor(metric: MetricView): string {
  switch (metric) {
    case 'hours': return 'teal';
    case 'dollars': return 'green';
    case 'stories': return 'indigo';
    case 'bugs': return 'red';
    case 'sp': return 'orange';
    case 'issues': return 'blue';
  }
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: String(CURRENT_YEAR - i),
  label: String(CURRENT_YEAR - i),
}));

const METRIC_OPTIONS: { value: MetricView; label: string }[] = [
  { value: 'hours',   label: 'Hours Logged' },
  { value: 'dollars', label: 'Dollar Value' },
  { value: 'stories', label: 'Stories' },
  { value: 'bugs',    label: 'Bugs' },
  { value: 'issues',  label: 'Total Issues' },
  { value: 'sp',      label: 'Story Points' },
];

// ── Issue type / status styling ─────────────────────────────────────────
const ISSUE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Story': { bg: '#EDE9FE', text: '#7C3AED' },
  'Bug': { bg: '#FEE2E2', text: '#DC2626' },
  'Task': { bg: '#DBEAFE', text: '#2563EB' },
  'Sub-task': { bg: '#F1F5F9', text: '#64748B' },
  'Subtask': { bg: '#F1F5F9', text: '#64748B' },
  'Epic': { bg: '#FFEDD5', text: '#EA580C' },
  'Improvement': { bg: '#CCFBF1', text: '#0D9488' },
  'New Feature': { bg: '#E0F2FE', text: '#0284C7' },
  'Spike': { bg: '#FEF3C7', text: '#D97706' },
};
const STATUS_COLORS: Record<string, string> = {
  'Done': '#22C55E', 'In Progress': '#F59E0B', 'To Do': '#94A3B8',
};
function issueTypeStyle(t: string) {
  return ISSUE_TYPE_COLORS[t] ?? { bg: '#EFF6FF', text: '#3B82F6' };
}

// ── Chart colors ────────────────────────────────────────────────────────
const CHART_COLORS = {
  hours:   '#20c997',
  dollars: '#40c057',
  stories: '#5c7cfa',
  bugs:    '#fa5252',
  sp:      '#fd7e14',
  issues:  '#339af0',
  commits: '#ae3ec9',
};

export default function ResourcePerformancePage() {
  const isDark = useDarkMode();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [period, setPeriod] = useState('MONTHLY');
  const [metric, setMetric] = useState<MetricView>('hours');
  const [search, setSearch] = useState('');

  // Drilldown state
  const [drilldownOpened, { open: openDrilldown, close: closeDrilldown }] = useDisclosure(false);
  const [drillResource, setDrillResource] = useState<{ id: number; name: string } | null>(null);
  const [drillPeriod, setDrillPeriod] = useState<{ index: number; label: string }>({ index: 0, label: '' });

  const { data, isLoading, error, refetch } = useResourcePerformance(year, period);
  const { data: drillIssues, isLoading: drillLoading } = useResourceIssues(
    drillResource?.id ?? null, year, period, drillPeriod.index
  );

  // Period labels for column headers
  const periodLabels = useMemo(() => {
    if (!data || data.resources.length === 0) return [];
    return data.resources[0]?.periods.map(p => p.periodLabel) ?? [];
  }, [data]);

  // Filtered resources
  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data.resources;
    const q = search.toLowerCase();
    return data.resources.filter(r =>
      r.resourceName.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q)
    );
  }, [data, search]);

  // Max value for heat shading
  const maxVal = useMemo(() => {
    if (!data) return 1;
    let max = 0;
    for (const r of data.resources) {
      for (const p of r.periods) {
        const v = getMetricValue(p, metric);
        if (v > max) max = v;
      }
    }
    return max || 1;
  }, [data, metric]);

  // Chart data: aggregate by period
  const chartData = useMemo(() => {
    if (!data || !data.resources.length) return [];
    const labels = data.resources[0].periods.map(p => p.periodLabel.replace(` ${year}`, ''));
    return labels.map((label, i) => {
      let hours = 0, dollars = 0, stories = 0, bugs = 0, sp = 0, issues = 0;
      for (const r of data.resources) {
        const p = r.periods[i];
        hours += p.hoursLogged;
        dollars += p.dollarValue;
        stories += p.storyCount;
        bugs += p.bugCount;
        sp += p.storyPointsCompleted;
        issues += p.totalIssues;
      }
      return { label, hours: Math.round(hours * 10) / 10, dollars: Math.round(dollars), stories, bugs, sp: Math.round(sp), issues };
    });
  }, [data, year]);

  // Resource total for the selected metric
  function resourceTotal(r: ResourceMetrics): number {
    return r.periods.reduce((sum, p) => sum + getMetricValue(p, metric), 0);
  }

  // Cell background intensity
  function cellBg(val: number): string | undefined {
    if (val === 0) return undefined;
    const intensity = Math.min(val / maxVal, 1);
    const alpha = 0.05 + intensity * 0.15;
    const colors: Record<MetricView, string> = {
      hours: `rgba(32,201,151,${alpha})`,
      dollars: `rgba(64,192,87,${alpha})`,
      stories: `rgba(92,124,250,${alpha})`,
      bugs: `rgba(250,82,82,${alpha})`,
      sp: `rgba(253,126,20,${alpha})`,
      issues:  `rgba(34,139,230,${alpha})`,
    };
    return colors[metric];
  }

  // Tooltip for each cell
  function cellTooltip(p: PeriodMetrics): string {
    return [
      `${p.hoursLogged.toFixed(1)}h logged`,
      `${formatDollars(p.dollarValue)} value`,
      `${p.storyCount} stories, ${p.bugCount} bugs, ${p.taskCount} tasks`,
      `${Math.round(p.storyPointsCompleted)} SP completed`,
    ].join('\n');
  }

  // Handle resource name click → drilldown
  function handleDrilldown(r: ResourceMetrics, periodIdx?: number) {
    setDrillResource({ id: r.resourceId, name: r.resourceName });
    // If a specific period cell is clicked, drilldown to that period; otherwise show first non-empty
    const idx = periodIdx ?? 0;
    const p = r.periods[idx];
    setDrillPeriod({ index: p?.periodIndex ?? 1, label: p?.periodLabel ?? '' });
    openDrilldown();
  }

  if (isLoading) return <LoadingSpinner />;
  if (error) return <PageError context="loading resource performance" error={error} onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            Resource Performance
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Track hours, costs, stories, bugs, and velocity per resource
          </Text>
        </div>
        <Group gap="xs">
          <Select
            size="xs"
            data={YEAR_OPTIONS}
            value={String(year)}
            onChange={v => setYear(Number(v))}
            style={{ width: 100 }}
          />
          <SegmentedControl
            size="xs"
            value={period}
            onChange={setPeriod}
            data={[
              { label: 'Monthly', value: 'MONTHLY' },
              { label: 'Quarterly', value: 'QUARTERLY' },
              { label: 'Yearly', value: 'YEARLY' },
            ]}
          />
        </Group>
      </Group>

      {/* KPI Summary Cards */}
      {data && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          <SummaryCard
            title="Mapped Resources"
            value={`${data.mappedResources} / ${data.totalResources}`}
            icon={<IconUsers size={20} color="#339af0" />}
            color="#339af0"
          />
          <SummaryCard
            title={`YTD Hours (${year})`}
            value={`${formatHours(data.totalHours)}h`}
            icon={<IconClock size={20} color="#20c997" />}
            color="#20c997"
            sparkData={sparkFor(data, 'hours')}
          />
          <SummaryCard
            title={`YTD Value (${year})`}
            value={formatDollars(data.totalDollarValue)}
            icon={<IconCoin size={20} color="#40c057" />}
            color="#40c057"
            sparkData={sparkFor(data, 'dollars')}
          />
          <SummaryCard
            title="Stories"
            value={String(data.totalStories)}
            icon={<IconBook2 size={20} color="#5c7cfa" />}
            color="#5c7cfa"
            sparkData={sparkFor(data, 'stories')}
          />
          <SummaryCard
            title="Bugs"
            value={String(data.totalBugs)}
            icon={<IconBug size={20} color="#fa5252" />}
            color="#fa5252"
            sparkData={sparkFor(data, 'bugs')}
          />
          <SummaryCard
            title="Story Points"
            value={String(Math.round(data.totalStoryPoints))}
            icon={<IconTarget size={20} color="#fd7e14" />}
            color="#fd7e14"
            sparkData={sparkFor(data, 'sp')}
          />
        </SimpleGrid>
      )}

      {/* Toolbar: Search + Metric Selector */}
      <Group justify="space-between">
        <Group gap="xs">
          <TextInput
            placeholder="Search by name, role, or location..."
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
            size="xs"
          />
          <Select
            size="xs"
            data={METRIC_OPTIONS}
            value={metric}
            onChange={v => setMetric((v as MetricView) ?? 'hours')}
            style={{ width: 160 }}
          />
        </Group>
        <Text size="xs" c="dimmed">
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''} · Showing {METRIC_OPTIONS.find(m => m.value === metric)?.label}
        </Text>
      </Group>

      {/* Period Table */}
      <ScrollArea>
        <Table fz="xs" withColumnBorders withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 36, position: 'sticky', left: 0, background: isDark ? '#1a1b1e' : '#fff', zIndex: 1 }}>#</Table.Th>
              <Table.Th style={{ minWidth: 170, position: 'sticky', left: 36, background: isDark ? '#1a1b1e' : '#fff', zIndex: 1 }}>Resource</Table.Th>
              <Table.Th style={{ width: 65 }}>Rate</Table.Th>
              {periodLabels.map(label => (
                <Table.Th key={label} style={{ width: 72, textAlign: 'center' }}>
                  <Text size="xs" fw={600}>{label.replace(` ${year}`, '')}</Text>
                </Table.Th>
              ))}
              <Table.Th style={{ width: 80, textAlign: 'center', background: isDark ? '#25262b' : '#f8f9fa' }}>
                <Text size="xs" fw={700}>Total</Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((r, idx) => {
              const total = resourceTotal(r);
              return (
                <Table.Tr key={r.resourceId}>
                  <Table.Td style={{ position: 'sticky', left: 0, background: isDark ? '#1a1b1e' : '#fff', zIndex: 1 }}>
                    <Text size="xs" c="dimmed" fw={500}>{idx + 1}</Text>
                  </Table.Td>

                  {/* Resource name — clickable for drilldown */}
                  <Table.Td style={{ position: 'sticky', left: 36, background: isDark ? '#1a1b1e' : '#fff', zIndex: 1, minWidth: 200 }}>
                    <Group
                      gap="xs" wrap="nowrap"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleDrilldown(r)}
                    >
                      <ThemeIcon size={24} radius="xl" color="blue" variant="light" style={{ flexShrink: 0 }}>
                        <Text size="xs" fw={700} style={{ fontSize: 9 }}>{initials(r.resourceName)}</Text>
                      </ThemeIcon>
                      <div style={{ minWidth: 0 }}>
                        <Text size="xs" fw={600} style={{ lineHeight: 1.2, color: AQUA, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.resourceName}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{r.role} · {r.location}</Text>
                      </div>
                    </Group>
                  </Table.Td>

                  <Table.Td>
                    <Text size="xs" c="dimmed">${r.hourlyRate}/h</Text>
                  </Table.Td>

                  {/* Period cells — clickable for drilldown to that period */}
                  {r.periods.map((p, pi) => {
                    const val = getMetricValue(p, metric);
                    return (
                      <Table.Td
                        key={p.periodIndex}
                        style={{ textAlign: 'center', background: cellBg(val), cursor: val > 0 ? 'pointer' : undefined }}
                        onClick={() => { if (val > 0) handleDrilldown(r, pi); }}
                      >
                        <Tooltip label={cellTooltip(p)} multiline style={{ whiteSpace: 'pre-line' }}>
                          <Text size="xs" fw={val > 0 ? 600 : 400} c={val > 0 ? metricColor(metric) : 'dimmed'}>
                            {formatMetric(val, metric)}
                          </Text>
                        </Tooltip>
                      </Table.Td>
                    );
                  })}

                  <Table.Td style={{ textAlign: 'center', background: isDark ? '#25262b' : '#f8f9fa' }}>
                    <Text size="xs" fw={700} c={total > 0 ? metricColor(metric) : 'dimmed'}>
                      {formatMetric(total, metric)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}

            {/* Grand Total Row */}
            {filtered.length > 0 && data && (
              <Table.Tr style={{ background: isDark ? '#25262b' : '#f1f3f5' }}>
                <Table.Td style={{ position: 'sticky', left: 0, background: isDark ? '#25262b' : '#f1f3f5', zIndex: 1 }} />
                <Table.Td style={{ position: 'sticky', left: 36, background: isDark ? '#25262b' : '#f1f3f5', zIndex: 1 }}>
                  <Text size="xs" fw={700}>Grand Total</Text>
                </Table.Td>
                <Table.Td />
                {periodLabels.map((label, pi) => {
                  const periodTotal = filtered.reduce((sum, r) => sum + getMetricValue(r.periods[pi], metric), 0);
                  return (
                    <Table.Td key={label} style={{ textAlign: 'center' }}>
                      <Text size="xs" fw={700} c={periodTotal > 0 ? metricColor(metric) : 'dimmed'}>
                        {formatMetric(periodTotal, metric)}
                      </Text>
                    </Table.Td>
                  );
                })}
                <Table.Td style={{ textAlign: 'center', background: isDark ? '#2c2e33' : '#e9ecef' }}>
                  <Text size="xs" fw={700} c={metricColor(metric)}>
                    {formatMetric(
                      filtered.reduce((sum, r) => sum + resourceTotal(r), 0),
                      metric
                    )}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}

            {filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3 + periodLabels.length + 1}>
                  <Text ta="center" c="dimmed" py="xl">
                    {(data?.resources ?? []).length === 0
                      ? 'No mapped resources found \u2014 map Jira users in Resource Mapping first'
                      : 'No results match your search'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* ── Trend Charts ───────────────────────────────────────────────── */}
      {chartData.length > 1 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {/* Hours & Dollar Value — stacked bar */}
          <ChartCard title="Hours & Dollar Value">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
                <RTooltip
                  contentStyle={{
                    background: isDark ? '#25262b' : '#fff',
                    border: `1px solid ${isDark ? '#373A40' : '#dee2e6'}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val: number, name: string) =>
                    name === 'dollars' ? [`$${val.toLocaleString()}`, 'Dollar Value'] :
                    [`${val}h`, 'Hours Logged']
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="hours" name="Hours" fill={CHART_COLORS.hours} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="dollars" name="Dollars" fill={CHART_COLORS.dollars} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Story Points — area chart */}
          <ChartCard title="Story Points Completed">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.sp} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS.sp} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip
                  contentStyle={{
                    background: isDark ? '#25262b' : '#fff',
                    border: `1px solid ${isDark ? '#373A40' : '#dee2e6'}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="sp" name="Story Points" stroke={CHART_COLORS.sp}
                  fill="url(#spGrad)" strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.sp }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Stories vs Bugs — grouped bar */}
          <ChartCard title="Stories vs Bugs">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip
                  contentStyle={{
                    background: isDark ? '#25262b' : '#fff',
                    border: `1px solid ${isDark ? '#373A40' : '#dee2e6'}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="stories" name="Stories" fill={CHART_COLORS.stories} radius={[4, 4, 0, 0]} />
                <Bar dataKey="bugs" name="Bugs" fill={CHART_COLORS.bugs} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Total Issues — area chart */}
          <ChartCard title="Total Issues Resolved">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="issueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.issues} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS.issues} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip
                  contentStyle={{
                    background: isDark ? '#25262b' : '#fff',
                    border: `1px solid ${isDark ? '#373A40' : '#dee2e6'}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="issues" name="Issues" stroke={CHART_COLORS.issues}
                  fill="url(#issueGrad)" strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.issues }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

        </SimpleGrid>
      )}

      <Text size="xs" c="dimmed">
        Showing {filtered.length} of {data?.resources.length ?? 0} resources · Year {year} · Click resource name or period cell for details
      </Text>

      {/* ── Resource Drilldown Modal ───────────────────────────────────── */}
      <Modal
        opened={drilldownOpened}
        onClose={closeDrilldown}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="xl" color="blue" variant="light">
              <Text fw={700} style={{ fontSize: 10 }}>{drillResource ? initials(drillResource.name) : ''}</Text>
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY }}>{drillResource?.name}</Text>
              <Text size="xs" c="dimmed">{drillPeriod.label} · Issues & Worklogs</Text>
            </div>
          </Group>
        }
        size="xl"
        centered
        zIndex={300}
      >
        {/* Period selector inside modal */}
        {data && drillResource && (
          <Box
            mb="md"
            style={{
              display: 'flex',
              gap: 4,
              padding: '4px 6px',
              background: 'rgba(45,204,211,0.06)',
              borderRadius: 10,
              border: `1px solid rgba(45,204,211,0.15)`,
              flexWrap: 'wrap',
            }}
          >
            {(data.resources.find(r => r.resourceId === drillResource.id)?.periods ?? []).map(p => {
              const isActive = drillPeriod.index === p.periodIndex;
              const label = p.periodLabel.replace(` ${year}`, '');
              return (
                <UnstyledButton
                  key={p.periodIndex}
                  onClick={() => setDrillPeriod({ index: p.periodIndex, label: p.periodLabel })}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    fontSize: 11,
                    fontFamily: FONT_FAMILY,
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    background: isActive ? AQUA : 'transparent',
                    color: isActive ? '#fff' : 'rgba(45,204,211,0.75)',
                    boxShadow: isActive ? `0 2px 8px ${AQUA}55` : 'none',
                    border: isActive ? 'none' : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(45,204,211,0.12)';
                      (e.currentTarget as HTMLElement).style.color = AQUA;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'rgba(45,204,211,0.75)';
                    }
                  }}
                >
                  {label}
                </UnstyledButton>
              );
            })}
          </Box>
        )}

        {drillLoading && (
          <Group justify="center" py="xl"><Loader size="sm" /><Text size="sm" c="dimmed">Loading issues...</Text></Group>
        )}

        {!drillLoading && drillIssues && drillIssues.length === 0 && (
          <Text ta="center" c="dimmed" py="xl">No issues found for this period</Text>
        )}

        {!drillLoading && drillIssues && drillIssues.length > 0 && (
          <ScrollArea h={400}>
            <Table fz="xs" withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 100 }}>Key</Table.Th>
                  <Table.Th>Summary</Table.Th>
                  <Table.Th style={{ width: 80 }}>Type</Table.Th>
                  <Table.Th style={{ width: 90 }}>Status</Table.Th>
                  <Table.Th style={{ width: 50, textAlign: 'center' }}>SP</Table.Th>
                  <Table.Th style={{ width: 60, textAlign: 'right' }}>Hours</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {drillIssues.map(issue => {
                  const ts = issueTypeStyle(issue.issueType);
                  const statusColor = STATUS_COLORS[issue.statusCategory] ?? '#94A3B8';
                  return (
                    <Table.Tr key={issue.issueKey}>
                      <Table.Td>
                        <Text size="xs" fw={600} c={AQUA}>{issue.issueKey}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={2}>{issue.summary}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" style={{ backgroundColor: ts.bg, color: ts.text }}>{issue.issueType}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="dot" color={statusColor}>{issue.status}</Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="xs" fw={600} c="orange">{issue.storyPoints ?? '\u2014'}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="xs" fw={600} c="teal">{issue.hoursLogged > 0 ? `${issue.hoursLogged.toFixed(1)}h` : '\u2014'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            <Group justify="space-between" mt="xs">
              <Text size="xs" c="dimmed">{drillIssues.length} issue{drillIssues.length !== 1 ? 's' : ''}</Text>
              <Group gap="md">
                <Text size="xs" fw={600} c="teal">
                  {drillIssues.reduce((s, i) => s + i.hoursLogged, 0).toFixed(1)}h total
                </Text>
                <Text size="xs" fw={600} c="orange">
                  {drillIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0)} SP total
                </Text>
              </Group>
            </Group>
          </ScrollArea>
        )}
      </Modal>
    </Stack>
  );
}

// ── Sparkline helper: aggregate all resources per period ──────────────
function sparkFor(data: PerformanceSummary, metric: MetricView): number[] {
  if (!data.resources.length) return [];
  const periodCount = data.resources[0].periods.length;
  const result: number[] = [];
  for (let i = 0; i < periodCount; i++) {
    let sum = 0;
    for (const r of data.resources) {
      sum += getMetricValue(r.periods[i], metric);
    }
    result.push(sum);
  }
  return result;
}
