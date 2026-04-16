import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import {
  Title, Text, Stack, Group, Badge, Paper, Card, Table,
  Select, SimpleGrid, ThemeIcon, Tabs, Alert, Divider,
  Progress, ScrollArea, Box, Tooltip,
} from '@mantine/core';
import {
  IconCurrencyDollar, IconUsers, IconChartBar, IconBug,
  IconAlertCircle, IconInfoCircle, IconBolt, IconArrowUp,
  IconArrowDown, IconMinus, IconCode, IconTestPipe,
} from '@tabler/icons-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';

import { AQUA_HEX, AQUA, COLOR_BLUE, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_TEAL, COLOR_VIOLET, COLOR_VIOLET_ALT, COLOR_WARNING, DEEP_BLUE, FONT_FAMILY, SLATE_700, TEXT_GRAY, TEXT_SUBTLE} from '../../brandTokens';
import { useResources }    from '../../api/resources';
import { useCostRates }    from '../../api/costRates';
import { useProjects }     from '../../api/projects';
import { useWorklogReport, WorklogMonthReport } from '../../api/jira';
import { useProductivityMetrics } from '../../api/reports';
import { ResourceResponse } from '../../types/resource';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtHrs(h: number): string {
  return `${Math.round(h).toLocaleString()} hrs`;
}
function pct(num: number, den: number): string {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

const MONTHLY_CAPACITY_HOURS = 160; // assumed hrs/person/month at full utilization

// Last 6 months for the month picker
const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { value, label };
});

const ISSUE_TYPE_COLORS: Record<string, string> = {
  Story:   COLOR_BLUE_STRONG,
  Bug:     COLOR_ERROR_DARK,
  Task:    COLOR_EMERALD,
  Epic:    COLOR_VIOLET,
  'Sub-task': '#0891b2',
  Spike:   '#b45309',
};
const getIssueColor = (t: string) => ISSUE_TYPE_COLORS[t] ?? TEXT_GRAY;

const ROLE_PALETTE = [AQUA, COLOR_VIOLET_ALT, COLOR_WARNING, COLOR_BLUE, COLOR_TEAL, COLOR_ERROR_STRONG, '#ec4899', TEXT_GRAY];
const ALL_ROLES: string[] = [];
const getRoleColor = (role: string) => {
  if (!ALL_ROLES.includes(role)) ALL_ROLES.push(role);
  return ROLE_PALETTE[ALL_ROLES.indexOf(role) % ROLE_PALETTE.length];
};

// ── Person-level row (the core join) ─────────────────────────────────────────

interface PersonRow {
  author:              string;
  resource:            ResourceResponse | undefined;
  role:                string;
  pod:                 string;
  location:            string;
  ratePerHour:         number;
  hoursLogged:         number;
  loggedCost:          number;
  capacityCost:        number;   // rate × MONTHLY_CAPACITY_HOURS
  utilizationPct:      number;   // hoursLogged / MONTHLY_CAPACITY_HOURS
  issueTypeBreakdown:  Record<string, number>;
  matched:             boolean;  // true if Jira author matched a resource
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinancialIntelligencePage() {
  const [month, setMonth]   = useState(MONTH_OPTIONS[0].value);
  const [view, setView]     = useState('overview');

  const { data: resources,    isLoading: rLoading  } = useResources();
  const { data: costRates,    isLoading: crLoading  } = useCostRates();
  const { data: projects,     isLoading: pLoading   } = useProjects();
  const { data: worklog,      isLoading: wLoading   } = useWorklogReport(month);
  const { data: metrics,      isLoading: mLoading   } = useProductivityMetrics(6);
  // Fetch all pods so every team appears in the utilization breakdown
  const { data: allPods } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['pods-all-names'],
    queryFn: () => apiClient.get('/pods/all').then(r => r.data),
  });

  const loading = rLoading || crLoading || pLoading || wLoading || mLoading;

  // ── Rate lookup: "role|location" → hourlyRate ──────────────────────────────
  const rateLookup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const cr of costRates ?? []) m[`${cr.role}|${cr.location}`] = cr.hourlyRate;
    return m;
  }, [costRates]);

  const effectiveRate = (r: ResourceResponse): number =>
    r.actualRate ?? rateLookup[`${r.role}|${r.location}`] ?? 0;

  // ── Resource index by Jira display name and by real name ──────────────────
  const resourceIndex = useMemo(() => {
    const m: Record<string, ResourceResponse> = {};
    for (const r of resources ?? []) {
      if (r.jiraDisplayName) m[r.jiraDisplayName.toLowerCase()] = r;
      m[r.name.toLowerCase()] = r;
    }
    return m;
  }, [resources]);

  const matchResource = (author: string) =>
    resourceIndex[author.toLowerCase()];

  // ── Build per-person rows ──────────────────────────────────────────────────
  const personRows = useMemo((): PersonRow[] => {
    const wlUsers = worklog?.users ?? [];
    return wlUsers
      .map(u => {
        const resource      = matchResource(u.author);
        const rate          = resource ? effectiveRate(resource) : 0;
        const hoursLogged   = u.totalHours;
        const loggedCost    = hoursLogged * rate;
        const capacityCost  = rate * MONTHLY_CAPACITY_HOURS;
        const utilizationPct = MONTHLY_CAPACITY_HOURS > 0 ? (hoursLogged / MONTHLY_CAPACITY_HOURS) * 100 : 0;
        return {
          author:             u.author,
          resource,
          role:               resource?.role ?? 'Unknown',
          pod:                u.homePodName ?? resource?.podAssignment?.podName ?? 'Unassigned',
          location:           resource?.location ?? '—',
          ratePerHour:        rate,
          hoursLogged,
          loggedCost,
          capacityCost,
          utilizationPct,
          issueTypeBreakdown: u.issueTypeBreakdown ?? {},
          matched:            !!resource,
        };
      })
      .sort((a, b) => b.loggedCost - a.loggedCost);
  }, [worklog, resourceIndex, rateLookup]);

  // ── Team capacity from resources (independent of worklog) ─────────────────
  const teamCapacity = useMemo(() => {
    const active = (resources ?? []).filter(r => r.active && r.countsInCapacity);
    const totalMonthlyCost = active.reduce((s, r) => s + effectiveRate(r) * MONTHLY_CAPACITY_HOURS, 0);
    const avgRate = active.length
      ? active.reduce((s, r) => s + effectiveRate(r), 0) / active.length
      : 0;
    return { totalMonthlyCost, avgRate, headcount: active.length };
  }, [resources, rateLookup]);

  // ── Logged spend totals ────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const loggedCost    = personRows.reduce((s, r) => s + r.loggedCost, 0);
    const loggedHours   = personRows.reduce((s, r) => s + r.hoursLogged, 0);
    const matchedRows   = personRows.filter(r => r.matched);
    const unmatchedRows = personRows.filter(r => !r.matched);
    return { loggedCost, loggedHours, matchedRows, unmatchedRows };
  }, [personRows]);

  // ── POD breakdown — all pods, even those with no worklog activity ────────
  const podBreakdown = useMemo(() => {
    const map: Record<string, { hours: number; cost: number; people: number; byRole: Record<string, number> }> = {};
    // Seed every registered pod with zero values so they all appear
    for (const p of allPods ?? []) {
      map[p.name] = { hours: 0, cost: 0, people: 0, byRole: {} };
    }
    // Fill in actual worklog data
    for (const row of personRows) {
      if (!map[row.pod]) map[row.pod] = { hours: 0, cost: 0, people: 0, byRole: {} };
      map[row.pod].hours  += row.hoursLogged;
      map[row.pod].cost   += row.loggedCost;
      map[row.pod].people += 1;
      map[row.pod].byRole[row.role] = (map[row.pod].byRole[row.role] ?? 0) + row.loggedCost;
    }
    return Object.entries(map)
      .map(([pod, d]) => ({ pod, ...d }))
      .sort((a, b) => b.cost - a.cost);
  }, [personRows, allPods]);

  // ── Issue-type cost attribution ────────────────────────────────────────────
  const issueTypeCosts = useMemo(() => {
    const map: Record<string, { hours: number; cost: number }> = {};
    for (const row of personRows) {
      for (const [type, hours] of Object.entries(row.issueTypeBreakdown)) {
        if (!map[type]) map[type] = { hours: 0, cost: 0 };
        map[type].hours += hours;
        map[type].cost  += hours * row.ratePerHour;
      }
    }
    return Object.entries(map)
      .map(([type, d]) => ({ type, ...d }))
      .sort((a, b) => b.cost - a.cost);
  }, [personRows]);

  const totalIssueTypeCost = issueTypeCosts.reduce((s, r) => s + r.cost, 0);

  // ── Utilization pct across team ────────────────────────────────────────────
  const teamUtilization = teamCapacity.totalMonthlyCost > 0
    ? (totals.loggedCost / teamCapacity.totalMonthlyCost) * 100
    : 0;

  // ── Budget waterfall data ──────────────────────────────────────────────────
  const budgetWaterfallData = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    return projects
      .filter(p => p.estimatedBudget && p.estimatedBudget > 0)
      .map(p => ({
        name: p.name,
        estimated: p.estimatedBudget ?? 0,
        actual: p.actualCost ?? 0,
        variance: (p.estimatedBudget ?? 0) - (p.actualCost ?? 0),
      }))
      .sort((a, b) => b.estimated - a.estimated)
      .slice(0, 10);
  }, [projects]);

  // ── CapEx vs OpEx breakdown ────────────────────────────────────────────────
  const capexOpexData = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const capex = projects.filter(p => p.status === 'CAPEX' || p.defaultPattern === 'CapEx').reduce((s, p) => s + (p.estimatedBudget ?? 0), 0);
    const opex = projects.filter(p => p.status !== 'CAPEX' && p.defaultPattern !== 'CapEx').reduce((s, p) => s + (p.estimatedBudget ?? 0), 0);
    return [
      { name: 'CapEx', value: capex },
      { name: 'OpEx', value: opex },
    ].filter(d => d.value > 0);
  }, [projects]);

  // ── Budget at risk: projects over 90% of estimated budget ────────────────
  const budgetAtRisk = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    return projects.filter(p => {
      const estimated = p.estimatedBudget ?? 0;
      const actual = p.actualCost ?? 0;
      return estimated > 0 && actual > estimated * 0.9;
    }).sort((a, b) => {
      const aUsage = a.estimatedBudget ? (a.actualCost ?? 0) / a.estimatedBudget : 0;
      const bUsage = b.estimatedBudget ? (b.actualCost ?? 0) / b.estimatedBudget : 0;
      return bUsage - aUsage;
    });
  }, [projects]);

  // ── Monthly burn estimate ───────────────────────────────────────────────────
  const monthlyBurnData = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const months: Record<string, number> = {};
    for (const p of projects) {
      if (p.startDate && p.estimatedBudget && p.estimatedBudget > 0) {
        const start = new Date(p.startDate);
        const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        const monthlyBurn = p.durationMonths > 0 ? p.estimatedBudget / p.durationMonths : p.estimatedBudget;
        months[monthKey] = (months[monthKey] ?? 0) + monthlyBurn;
      }
    }
    return Object.entries(months)
      .map(([month, value]) => ({ month, spend: value }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [projects]);

  const noCostRates = (costRates ?? []).length === 0;
  const noWorklog   = !worklog || worklog.totalHours === 0;
  const noProjects  = !projects || projects.length === 0;

  if (loading) return <LoadingSpinner />;

  return (
    <Stack gap="lg" className="page-enter">

      {/* ── Header ── */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={1} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 800 }}>
            Financial Intelligence
          </Title>
          <Text c="dimmed" size="sm" mt={2} style={{ fontFamily: FONT_FAMILY }}>
            Actual cost attribution from resource rates × Jira worklogs — per person, per POD, per work type
          </Text>
        </Box>
        <Select
          data={MONTH_OPTIONS}
          value={month}
          onChange={v => setMonth(v ?? MONTH_OPTIONS[0].value)}
          style={{ width: 200 }}
          size="sm"
          label="Month"
          styles={{ label: { fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 11 } }}
        />
      </Group>

      {/* ── Warnings ── */}
      {noCostRates && (
        <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Cost rates not configured">
          Go to Admin Settings → Reference Data → Cost Rates to set hourly rates per role and location. Without rates, all cost figures will show $0.
        </Alert>
      )}
      {noWorklog && !wLoading && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" title="No Jira worklog data for this month">
          Jira integration must be configured and team members must log time in Jira for cost attribution to work. Team capacity figures (from resource records) are still shown below.
        </Alert>
      )}
      {totals.unmatchedRows.length > 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" title={`${totals.unmatchedRows.length} Jira authors not matched to a resource`}>
          {totals.unmatchedRows.map(r => r.author).join(', ')} — set the Jira Display Name on each resource record to enable cost attribution.
        </Alert>
      )}

      {/* ── KPI cards ── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[
          {
            label:   'Team Monthly Capacity',
            value:   fmt(teamCapacity.totalMonthlyCost),
            sub:     `${teamCapacity.headcount} active resources`,
            icon:    <IconUsers size={18} />,
            color:   'blue',
          },
          {
            label:   'Logged Spend (this month)',
            value:   fmt(totals.loggedCost),
            sub:     `${fmtHrs(totals.loggedHours)} across ${personRows.length} people`,
            icon:    <IconCurrencyDollar size={18} />,
            color:   totals.loggedCost > teamCapacity.totalMonthlyCost ? 'red' : 'teal',
          },
          {
            label:   'Capacity Utilization',
            value:   `${teamUtilization.toFixed(1)}%`,
            sub:     teamUtilization > 90 ? 'Near full capacity' : teamUtilization > 60 ? 'Healthy range' : 'Below expected',
            icon:    teamUtilization > 90 ? <IconArrowUp size={18} /> : teamUtilization < 50 ? <IconArrowDown size={18} /> : <IconMinus size={18} />,
            color:   teamUtilization > 90 ? 'orange' : teamUtilization < 50 ? 'gray' : 'green',
          },
          {
            label:   'Avg Hourly Rate',
            value:   `$${Math.round(teamCapacity.avgRate)}/hr`,
            sub:     `Across ${teamCapacity.headcount} resources`,
            icon:    <IconChartBar size={18} />,
            color:   'violet',
          },
        ].map(k => (
          <Card key={k.label} withBorder radius="lg" p="md">
            <Group justify="space-between" mb={6}>
              <Text size="xs" tt="uppercase" fw={700} style={{ color: TEXT_SUBTLE, letterSpacing: '0.6px', fontFamily: FONT_FAMILY }}>
                {k.label}
              </Text>
              <ThemeIcon variant="light" color={k.color} size={32} radius="md">{k.icon}</ThemeIcon>
            </Group>
            <Text fw={800} size="xl" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{k.value}</Text>
            <Text size="xs" c="dimmed" mt={2} style={{ fontFamily: FONT_FAMILY }}>{k.sub}</Text>
          </Card>
        ))}
      </SimpleGrid>

      {/* ── View tabs ── */}
      <Tabs value={view} onChange={v => setView(v ?? 'overview')} variant="outline" radius="sm" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview"    leftSection={<IconChartBar    size={14} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="people"      leftSection={<IconUsers       size={14} />}>By Person</Tabs.Tab>
          <Tabs.Tab value="worktype"    leftSection={<IconBug         size={14} />}>By Work Type</Tabs.Tab>
          <Tabs.Tab value="pod"         leftSection={<IconBolt        size={14} />}>By POD</Tabs.Tab>
          <Tabs.Tab value="budget"      leftSection={<IconCurrencyDollar size={14} />}>Project Budget</Tabs.Tab>
        </Tabs.List>

        {/* ══════════ OVERVIEW ══════════ */}
        <Tabs.Panel value="overview">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">

            {/* POD spend bar */}
            <Paper withBorder radius="md" p="lg">
              <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                Logged Spend by POD
              </Text>
              {podBreakdown.length === 0 ? (
                <Text size="sm" c="dimmed">No worklog data for this month</Text>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={podBreakdown} layout="vertical" margin={{ left: 100, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: TEXT_GRAY }} tickFormatter={v => fmt(v)} />
                    <YAxis dataKey="pod" type="category" tick={{ fontSize: 11, fill: SLATE_700 }} width={95} />
                    <RechartTooltip formatter={(v: number) => [fmt(v), 'Logged cost']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar animationDuration={600} dataKey="cost" fill={AQUA_HEX} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>

            {/* Issue type cost donut */}
            <Paper withBorder radius="md" p="lg">
              <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                Cost by Issue Type
              </Text>
              {issueTypeCosts.length === 0 ? (
                <Text size="sm" c="dimmed">No worklog data for this month</Text>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie animationDuration={600} data={issueTypeCosts} dataKey="cost" nameKey="type" cx="50%" cy="50%"
                        innerRadius={55} outerRadius={80} paddingAngle={2}>
                        {issueTypeCosts.map((entry) => (
                          <Cell key={entry.type} fill={getIssueColor(entry.type)} />
                        ))}
                      </Pie>
                      <RechartTooltip formatter={(v: number) => [fmt(v), 'Cost']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Stack gap={6} mt="sm">
                    {issueTypeCosts.map(it => (
                      <Group key={it.type} justify="space-between">
                        <Group gap={6}>
                          <Box style={{ width: 10, height: 10, borderRadius: 2, background: getIssueColor(it.type), flexShrink: 0 }} />
                          <Text size="xs" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{it.type}</Text>
                        </Group>
                        <Group gap="md">
                          <Text size="xs" c="dimmed">{fmtHrs(it.hours)}</Text>
                          <Text size="xs" fw={600} style={{ color: DEEP_BLUE, width: 60, textAlign: 'right' }}>{fmt(it.cost)}</Text>
                          <Text size="xs" c="dimmed" style={{ width: 40, textAlign: 'right' }}>{pct(it.cost, totalIssueTypeCost)}</Text>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>

            {/* Capacity vs logged per POD */}
            <Paper withBorder radius="md" p="lg" style={{ gridColumn: '1 / -1' }}>
              <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                Utilization by POD — logged hours vs 160h capacity
              </Text>
              {podBreakdown.length === 0 ? (
                <Text size="sm" c="dimmed">No worklog data for this month</Text>
              ) : (
                <Stack gap="sm">
                  {podBreakdown.map(pod => {
                    const capacityHours = pod.people * MONTHLY_CAPACITY_HOURS;
                    const utilPct = capacityHours > 0 ? Math.min(100, (pod.hours / capacityHours) * 100) : 0;
                    return (
                      <Box key={pod.pod}>
                        <Group justify="space-between" mb={4}>
                          <Group gap={8}>
                            <Text size="xs" fw={600} style={{ color: DEEP_BLUE, width: 150, fontFamily: FONT_FAMILY }}>{pod.pod}</Text>
                            <Text size="xs" c="dimmed">{pod.people} people</Text>
                          </Group>
                          <Group gap="md">
                            <Text size="xs" c="dimmed">{fmtHrs(pod.hours)} / {fmtHrs(capacityHours)}</Text>
                            <Text size="xs" fw={600} style={{ color: DEEP_BLUE, width: 38, textAlign: 'right' }}>{utilPct.toFixed(0)}%</Text>
                            <Text size="xs" fw={600} style={{ color: AQUA, width: 65, textAlign: 'right' }}>{fmt(pod.cost)}</Text>
                          </Group>
                        </Group>
                        <Progress value={utilPct}
                          color={utilPct > 95 ? 'red' : utilPct > 80 ? 'orange' : 'teal'}
                          size={7} radius="xl" />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        {/* ══════════ BY PERSON ══════════ */}
        <Tabs.Panel value="people">
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <Box style={{ background: DEEP_BLUE, padding: '10px 16px', display: 'flex', gap: 0 }}>
              {[
                { label: 'Name',          w: 180 },
                { label: 'Role',          w: 140 },
                { label: 'POD',           w: 130 },
                { label: 'Rate ($/hr)',   w: 90  },
                { label: 'Hrs Logged',    w: 90  },
                { label: 'Logged Cost',   w: 110 },
                { label: 'Utilization',   w: 120 },
                { label: 'Top Work Type', w: undefined },
              ].map(col => (
                <Text key={col.label} size="10px" fw={700} tt="uppercase"
                  style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.7px', width: col.w, flexShrink: 0, flex: col.w ? undefined : 1 }}>
                  {col.label}
                </Text>
              ))}
            </Box>
            <ScrollArea>
              {personRows.length === 0 ? (
                <Box p="xl" style={{ textAlign: 'center' }}>
                  <Text size="sm" c="dimmed">No worklog data for {MONTH_OPTIONS.find(m => m.value === month)?.label}</Text>
                </Box>
              ) : personRows.map((row, i) => {
                const topType = Object.entries(row.issueTypeBreakdown).sort((a, b) => b[1] - a[1])[0];
                const roleColor = getRoleColor(row.role);
                return (
                  <Box key={row.author} style={{
                    display: 'flex', alignItems: 'center', padding: '10px 16px',
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    background: i % 2 === 0 ? 'var(--mantine-color-body)' : 'var(--mantine-color-default-hover)',
                    opacity: row.matched ? 1 : 0.55,
                  }}>
                    <Box style={{ width: 180, flexShrink: 0 }}>
                      <Text size="xs" fw={600} style={{ color: DEEP_BLUE }}>{row.author}</Text>
                      {!row.matched && <Badge size="xs" color="orange" variant="light">unmatched</Badge>}
                    </Box>
                    <Box style={{ width: 140, flexShrink: 0 }}>
                      <Badge size="xs" style={{ background: `${roleColor}14`, color: roleColor, border: `1px solid ${roleColor}30`, fontSize: 10 }}>
                        {row.role}
                      </Badge>
                    </Box>
                    <Text size="xs" c="dimmed" style={{ width: 130, flexShrink: 0 }}>{row.pod}</Text>
                    <Text size="xs" style={{ width: 90, flexShrink: 0, color: row.ratePerHour ? DEEP_BLUE : TEXT_SUBTLE }}>
                      {row.ratePerHour ? `$${row.ratePerHour}/hr` : '—'}
                    </Text>
                    <Text size="xs" style={{ width: 90, flexShrink: 0, color: DEEP_BLUE }}>{fmtHrs(row.hoursLogged)}</Text>
                    <Text size="xs" fw={700} style={{ width: 110, flexShrink: 0, color: row.loggedCost ? AQUA : TEXT_SUBTLE }}>
                      {row.loggedCost ? fmt(row.loggedCost) : '—'}
                    </Text>
                    <Box style={{ width: 120, flexShrink: 0 }}>
                      <Group gap={4} mb={2}>
                        <Text size="10px" c="dimmed">{row.utilizationPct.toFixed(0)}%</Text>
                      </Group>
                      <Progress value={Math.min(100, row.utilizationPct)}
                        color={row.utilizationPct > 100 ? 'red' : row.utilizationPct > 85 ? 'orange' : 'teal'}
                        size={5} radius="xl" />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      {topType && (
                        <Badge size="xs" style={{ background: `${getIssueColor(topType[0])}14`, color: getIssueColor(topType[0]), border: `1px solid ${getIssueColor(topType[0])}30`, fontSize: 10 }}>
                          {topType[0]} · {topType[1].toFixed(0)}h
                        </Badge>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </ScrollArea>
            <Box style={{ padding: '8px 16px', borderTop: '1px solid #f0f4f8', background: '#fafbfc' }}>
              <Group gap="xl">
                <Text size="xs" c="dimmed">
                  Total logged: <strong>{fmtHrs(totals.loggedHours)}</strong>
                </Text>
                <Text size="xs" c="dimmed">
                  Total cost: <strong style={{ color: AQUA }}>{fmt(totals.loggedCost)}</strong>
                </Text>
                {totals.unmatchedRows.length > 0 && (
                  <Text size="xs" c="orange">
                    {totals.unmatchedRows.length} unmatched (hours logged, rate unknown)
                  </Text>
                )}
              </Group>
            </Box>
          </Paper>
        </Tabs.Panel>

        {/* ══════════ BY WORK TYPE ══════════ */}
        <Tabs.Panel value="worktype">
          <Stack gap="md">

            {/* Summary cards per issue type */}
            <SimpleGrid cols={{ base: 2, sm: 3, md: issueTypeCosts.length }} spacing="md">
              {issueTypeCosts.map(it => {
                const color = getIssueColor(it.type);
                const isPlanned = ['Story', 'Epic', 'Task'].includes(it.type);
                return (
                  <Card key={it.type} withBorder radius="lg" p="md" style={{ borderTop: `3px solid ${color}` }}>
                    <Group gap={6} mb={4}>
                      <Box style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                      <Text size="xs" fw={700} style={{ color, fontFamily: FONT_FAMILY }}>{it.type}</Text>
                      <Badge size="xs" color={isPlanned ? 'green' : 'orange'} variant="light" style={{ marginLeft: 'auto' }}>
                        {isPlanned ? 'Planned' : 'Unplanned'}
                      </Badge>
                    </Group>
                    <Text fw={800} size="lg" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{fmt(it.cost)}</Text>
                    <Text size="xs" c="dimmed" mt={2}>{fmtHrs(it.hours)} · {pct(it.cost, totalIssueTypeCost)}</Text>
                  </Card>
                );
              })}
            </SimpleGrid>

            {issueTypeCosts.length === 0 && (
              <Text size="sm" c="dimmed">No worklog data for this month.</Text>
            )}

            {/* Insight: planned vs unplanned split */}
            {issueTypeCosts.length > 0 && (() => {
              const planned   = issueTypeCosts.filter(it => ['Story', 'Epic', 'Task'].includes(it.type)).reduce((s, it) => s + it.cost, 0);
              const unplanned = issueTypeCosts.filter(it => !['Story', 'Epic', 'Task'].includes(it.type)).reduce((s, it) => s + it.cost, 0);
              const unplannedPct = totalIssueTypeCost > 0 ? (unplanned / totalIssueTypeCost) * 100 : 0;
              return (
                <Paper withBorder p="lg" radius="md" style={{ borderLeft: `4px solid ${unplannedPct > 30 ? COLOR_ERROR_STRONG : AQUA}` }}>
                  <Group justify="space-between" mb="sm">
                    <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Planned vs Unplanned Work Split</Text>
                    {unplannedPct > 30 && (
                      <Badge color="red" size="sm" leftSection={<IconAlertCircle size={11} />}>
                        High unplanned work
                      </Badge>
                    )}
                  </Group>
                  <SimpleGrid cols={2} spacing="xl">
                    <Box>
                      <Text size="xs" c="dimmed" mb={4}>Planned (Stories / Epics / Tasks)</Text>
                      <Text fw={800} size="xl" style={{ color: AQUA }}>{fmt(planned)}</Text>
                      <Text size="xs" c="dimmed">{pct(planned, totalIssueTypeCost)} of total spend</Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed" mb={4}>Unplanned (Bugs / Spikes / Other)</Text>
                      <Text fw={800} size="xl" style={{ color: unplannedPct > 30 ? COLOR_ERROR_STRONG : TEXT_GRAY }}>{fmt(unplanned)}</Text>
                      <Text size="xs" c="dimmed">{pct(unplanned, totalIssueTypeCost)} of total spend</Text>
                    </Box>
                  </SimpleGrid>
                  <Divider my="md" />
                  <Progress.Root size={12} radius="xl">
                    <Progress.Section value={(planned / totalIssueTypeCost) * 100} color={AQUA}>
                      <Progress.Label>{`Planned: ${fmt(planned)}`}</Progress.Label>
                    </Progress.Section>
                    <Progress.Section value={(unplanned / totalIssueTypeCost) * 100} color={COLOR_ERROR_STRONG}>
                      <Progress.Label>{`Unplanned: ${fmt(unplanned)}`}</Progress.Label>
                    </Progress.Section>
                  </Progress.Root>
                  <Group justify="space-between" mt={4}>
                    <Text size="10px" c="dimmed">Planned work</Text>
                    <Text size="10px" c="dimmed">Unplanned work</Text>
                  </Group>
                </Paper>
              );
            })()}

            {/* Per-person breakdown by issue type */}
            {personRows.length > 0 && (
              <Paper withBorder radius="md" p="lg">
                <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                  Hours per Person by Work Type
                </Text>
                <ResponsiveContainer width="100%" height={Math.max(200, personRows.slice(0, 15).length * 32)}>
                  <BarChart
                    data={personRows.slice(0, 15).map(r => ({
                      name: r.author.split(' ')[0],
                      ...r.issueTypeBreakdown,
                    }))}
                    layout="vertical"
                    margin={{ left: 70, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: TEXT_GRAY }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: SLATE_700 }} width={65} />
                    <RechartTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    {issueTypeCosts.map(it => (
                      <Bar animationDuration={600} key={it.type} dataKey={it.type} stackId="a" fill={getIssueColor(it.type)} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ══════════ BY POD ══════════ */}
        <Tabs.Panel value="pod">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
              {podBreakdown.map(pod => {
                const capacityHours = pod.people * MONTHLY_CAPACITY_HOURS;
                const utilPct = capacityHours > 0 ? Math.min(100, (pod.hours / capacityHours) * 100) : 0;
                const roleEntries = Object.entries(pod.byRole).sort((a, b) => b[1] - a[1]);
                return (
                  <Paper key={pod.pod} withBorder radius="md" p="lg"
                    style={{ borderTop: `3px solid ${AQUA}` }}>
                    <Group justify="space-between" mb="sm">
                      <Text fw={700} size="sm" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{pod.pod}</Text>
                      <Badge size="sm" variant="light" color="teal">{pod.people} people</Badge>
                    </Group>

                    <Group justify="space-between" mb="xs">
                      <Box>
                        <Text size="10px" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>Logged Cost</Text>
                        <Text fw={800} size="lg" style={{ color: AQUA }}>{fmt(pod.cost)}</Text>
                      </Box>
                      <Box ta="right">
                        <Text size="10px" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>Hours</Text>
                        <Text fw={700} size="md" style={{ color: DEEP_BLUE }}>{fmtHrs(pod.hours)}</Text>
                      </Box>
                    </Group>

                    <Box mb="sm">
                      <Group justify="space-between" mb={3}>
                        <Text size="10px" c="dimmed">Utilization vs capacity</Text>
                        <Text size="10px" fw={600} c={utilPct > 95 ? 'red' : 'dimmed'}>{utilPct.toFixed(0)}%</Text>
                      </Group>
                      <Progress value={utilPct}
                        color={utilPct > 95 ? 'red' : utilPct > 80 ? 'orange' : 'teal'}
                        size={7} radius="xl" />
                    </Box>

                    <Divider mb="sm" />
                    <Text size="10px" c="dimmed" fw={600} mb={6} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Cost by Role</Text>
                    {roleEntries.map(([role, cost]) => (
                      <Group key={role} justify="space-between" mb={3}>
                        <Group gap={6}>
                          <Box style={{ width: 8, height: 8, borderRadius: 2, background: getRoleColor(role), flexShrink: 0 }} />
                          <Text size="xs" c="dimmed">{role}</Text>
                        </Group>
                        <Group gap="sm">
                          <Text size="xs" fw={600} style={{ color: DEEP_BLUE }}>{fmt(cost)}</Text>
                          <Text size="10px" c="dimmed">{pct(cost, pod.cost)}</Text>
                        </Group>
                      </Group>
                    ))}
                  </Paper>
                );
              })}

              {podBreakdown.length === 0 && (
                <Text size="sm" c="dimmed">No worklog data for this month.</Text>
              )}
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        {/* ══════════ PROJECT BUDGET ══════════ */}
        <Tabs.Panel value="budget">
          <Stack gap="md">
            {noProjects && (
              <Alert icon={<IconAlertCircle size={16} />} color="blue" title="No projects with budget data">
                Add estimated budgets to projects in the Projects page to see budget analysis.
              </Alert>
            )}

            {!noProjects && (
              <>
                {/* Budget Waterfall */}
                {budgetWaterfallData.length > 0 && (
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      Budget Waterfall — Top 10 Projects by Estimated Budget
                    </Text>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={budgetWaterfallData} margin={{ left: 100, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: TEXT_GRAY }} tickFormatter={v => fmt(v)} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: SLATE_700 }} width={95} />
                        <RechartTooltip formatter={(v: number) => [fmt(v), '']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
                        <Bar animationDuration={600} dataKey="estimated" fill={COLOR_BLUE} stackId="a" name="Estimated" />
                        <Bar animationDuration={600} dataKey="variance" fill={COLOR_EMERALD} stackId="a" name="Variance (Under)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                )}

                {/* Monthly Burn */}
                {monthlyBurnData.length > 0 && (
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      Monthly Budget Burn — Last 12 Months
                    </Text>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyBurnData} margin={{ left: 50, right: 20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT_GRAY }} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fill: TEXT_GRAY }} tickFormatter={v => fmt(v)} />
                        <RechartTooltip formatter={(v: number) => [fmt(v), 'Monthly Budget']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar animationDuration={600} dataKey="spend" fill={AQUA_HEX} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                )}

                {/* CapEx vs OpEx */}
                {capexOpexData.length > 0 && (
                  <Paper withBorder radius="md" p="lg">
                    <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      Capital vs Operating Expenses
                    </Text>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie animationDuration={600} data={capexOpexData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          innerRadius={55} outerRadius={80} paddingAngle={2}>
                          {capexOpexData.map((entry, idx) => (
                            <Cell key={entry.name} fill={idx === 0 ? COLOR_BLUE : COLOR_VIOLET} />
                          ))}
                        </Pie>
                        <RechartTooltip formatter={(v: number) => [fmt(v), 'Budget']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Stack gap="xs" mt="sm">
                      {capexOpexData.map((d, i) => (
                        <Group key={d.name} justify="space-between">
                          <Group gap={6}>
                            <Box style={{ width: 12, height: 12, borderRadius: 2, background: i === 0 ? COLOR_BLUE : COLOR_VIOLET, flexShrink: 0 }} />
                            <Text size="xs" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>{d.name}</Text>
                          </Group>
                          <Text size="xs" fw={600} style={{ color: DEEP_BLUE }}>{fmt(d.value)}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {/* Budget at Risk Table */}
                {budgetAtRisk.length > 0 && (
                  <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                    <Box style={{ background: DEEP_BLUE, padding: '10px 16px' }}>
                      <Text size="sm" fw={700} style={{ color: 'white', fontFamily: FONT_FAMILY }}>
                        Projects at Risk — Over 90% of Budget
                      </Text>
                    </Box>
                    <Table striped highlightOnHover>
                      <Table.Thead style={{ background: '#f0f4f8' }}>
                        <Table.Tr>
                          <Table.Th style={{ fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 11 }}>Project</Table.Th>
                          <Table.Th style={{ fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 11 }} ta="right">Estimated</Table.Th>
                          <Table.Th style={{ fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 11 }} ta="right">Actual</Table.Th>
                          <Table.Th style={{ fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 11 }} ta="right">% Used</Table.Th>
                          <Table.Th style={{ fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 11 }} ta="right">Remaining</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {budgetAtRisk.map((p) => {
                          const est = p.estimatedBudget ?? 0;
                          const act = p.actualCost ?? 0;
                          const pctUsed = est > 0 ? (act / est) * 100 : 0;
                          const remaining = est - act;
                          return (
                            <Table.Tr key={p.id} style={{ opacity: pctUsed > 100 ? 0.9 : 1 }}>
                              <Table.Td style={{ fontFamily: FONT_FAMILY }}>{p.name}</Table.Td>
                              <Table.Td ta="right" style={{ fontFamily: FONT_FAMILY }}>{fmt(est)}</Table.Td>
                              <Table.Td ta="right" style={{ fontFamily: FONT_FAMILY, color: pctUsed > 100 ? COLOR_ERROR_DARK : DEEP_BLUE, fontWeight: 600 }}>{fmt(act)}</Table.Td>
                              <Table.Td ta="right">
                                <Badge color={pctUsed > 100 ? 'red' : pctUsed > 95 ? 'orange' : 'yellow'} variant="light">
                                  {pctUsed.toFixed(1)}%
                                </Badge>
                              </Table.Td>
                              <Table.Td ta="right" style={{ fontFamily: FONT_FAMILY, color: remaining < 0 ? COLOR_ERROR_DARK : DEEP_BLUE }}>
                                {fmt(remaining)}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                )}

                {budgetWaterfallData.length === 0 && !noProjects && (
                  <Text size="sm" c="dimmed">No projects with budget data available.</Text>
                )}
              </>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

    </Stack>
  );
}
