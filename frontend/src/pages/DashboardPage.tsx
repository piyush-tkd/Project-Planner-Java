import { useMemo, useState, useEffect } from 'react';
import { useQuery }  from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import {
  Stack, SimpleGrid, Text, Card, Group, Button, Table, Badge, Title,
  Paper, ThemeIcon, ScrollArea, Tabs, Box, RingProgress, Tooltip as MTooltip,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import {
  IconUsers, IconBriefcase, IconFlame, IconAlertTriangle,
  IconChartBar, IconChartAreaLine, IconUserPlus, IconCalendar,
  IconHexagons, IconArrowRight, IconHeadset, IconSparkles,
  IconArrowsLeftRight, IconTag, IconStar, IconDots, IconPlus,
  IconLayoutDashboard, IconPresentation, IconChartDonut, IconTable,
  IconTargetArrow, IconCheck, IconCircleDashed, IconArrowUpRight,
  IconBrain, IconBulb, IconClock, IconRocket, IconSnowflake,
  IconStatusChange, IconPlayerPlay,
} from '@tabler/icons-react';
import { WrikeCard } from '../components/dashboard/widgets/WrikeCard';
import ProjectStatusWidget from '../components/dashboard/widgets/ProjectStatusWidget';
import TeamHealthWidget from '../components/dashboard/widgets/TeamHealthWidget';
import { usePodHours } from '../api/podHours';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Treemap,
} from 'recharts';
import {
  useExecutiveSummary, useUtilizationHeatmap, useHiringForecast, useCapacityDemandSummary,
} from '../api/reports';
import { useSupportSnapshot, useSupportBoards } from '../api/jira';
import { useNlpInsights, NlpInsightCard } from '../api/nlp';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../utils/colors';
import { formatPercent, formatHours, normaliseProjectStatus } from '../utils/formatting';
import { formatRole } from '../types';
import SummaryCard from '../components/charts/SummaryCard';
import PageSkeleton from '../components/common/PageSkeleton';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { PageInsightCard } from '../components/common/PageInsightCard';
import ChartCard from '../components/common/ChartCard';
import WidgetGrid, { Widget } from '../components/layout/WidgetGrid';
import ExportPortfolioButton from '../components/common/ExportPortfolioButton';
import { useDarkMode } from '../hooks/useDarkMode';
import { useJiraStatus, usePodWatchConfig, useReleaseConfig } from '../api/jira';
import { useProjects } from '../api/projects';
import { ProjectResponse } from '../types';
import { AQUA, AQUA_TINTS, BORDER_STRONG, COLOR_AMBER_DARK, COLOR_BLUE, COLOR_BLUE_LIGHT, COLOR_EMERALD, COLOR_ERROR, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_GREEN_DARK, COLOR_GREEN_LIGHT, COLOR_GREEN_STRONG, COLOR_ORANGE, COLOR_ORANGE_DEEP, COLOR_SUCCESS, COLOR_TEAL, COLOR_VIOLET, COLOR_VIOLET_ALT, COLOR_VIOLET_LIGHT, COLOR_WARNING, DARK_TEXT_PRIMARY, DEEP_BLUE, DEEP_BLUE_TINTS, FONT_FAMILY, GRAY_300, GRAY_400, SHADOW, SURFACE_BLUE, SURFACE_FAINT, SURFACE_LIGHT, SURFACE_RED_FAINT, SURFACE_SUBTLE, SURFACE_SUCCESS_LIGHT, TEXT_GRAY, TEXT_SUBTLE} from '../brandTokens';
import { useProjectsHealth, RAG_COLORS, RAG_LABEL, RagStatus } from '../api/projectHealth';
import HealthBadge from '../components/common/HealthBadge';

// ── Wrike-style pastel status colors ──────────────────────────────────────
const STATUS_META: Record<string, { bg: string; text: string; border: string; label: string; chart: string }> = {
  NOT_STARTED:  { bg: SURFACE_BLUE, text: COLOR_BLUE, border: '#bfdbfe', label: 'Not Started',  chart: '#93c5fd' },
  IN_DISCOVERY: { bg: '#f5f3ff', text: COLOR_VIOLET, border: '#ddd6fe', label: 'In Discovery', chart: '#c4b5fd' },
  ACTIVE:       { bg: '#ecfdf5', text: COLOR_EMERALD, border: '#a7f3d0', label: 'Active',        chart: '#6ee7b7' },
  ON_HOLD:      { bg: '#fffbeb', text: COLOR_AMBER_DARK, border: '#fde68a', label: 'On Hold',       chart: '#fcd34d' },
  COMPLETED:    { bg: SURFACE_SUCCESS_LIGHT, text: COLOR_GREEN_STRONG, border: '#bbf7d0', label: 'Completed',     chart: '#86efac' },
  CANCELLED:    { bg: SURFACE_FAINT, text: TEXT_GRAY, border: BORDER_STRONG, label: 'Cancelled',     chart: '#cbd5e1' },
};

const ROLE_COLORS: Record<string, string> = {
  DEVELOPER: COLOR_BLUE,
  QA: COLOR_VIOLET_ALT,
  BSA: COLOR_WARNING,
  TECH_LEAD: COLOR_ERROR_STRONG,
};


// ── Status badge (Wrike pill style) ──────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META['NOT_STARTED'];
  return (
    <Box
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: meta.bg, color: meta.text,
        border: `1px solid ${meta.border}`,
        borderRadius: 20, padding: '3px 10px',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      <Box style={{ width: 3, height: 14, borderRadius: 2, background: meta.text, flexShrink: 0 }} />
      {meta.label}
    </Box>
  );
}

// ── Big KPI number card ───────────────────────────────────────────────────
function KpiNumberCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Paper withBorder radius="lg" p="xl" style={{ border: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)', textAlign: 'center' }}>
      <Text size="xs" fw={600} tt="uppercase" style={{ color: TEXT_SUBTLE, letterSpacing: '0.6px', marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontSize: 40, fontWeight: 800, color: 'var(--mantine-color-text)', lineHeight: 1, fontFamily: FONT_FAMILY }}>{value}</Text>
      {sub && <Text size="xs" c="dimmed" mt={4}>{sub}</Text>}
    </Paper>
  );
}

// ── Dashboard page header bar ─────────────────────────────────────────────
function DashboardHeader({ title, activeBoard, onBoardChange }: {
  title: string;
  activeBoard: string;
  onBoardChange: (b: string) => void;
}) {
  return (
    <Box mb={20}>
      <Group justify="space-between" align="center" mb={12}>
        <Group gap={8}>
          <Title order={2} style={{ color: 'var(--pp-text)', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</Title>
          <ActionIcon icon={<IconStar size={16} />} />
        </Group>
        <Group gap={8}>
          <ExportPortfolioButton />
          <Button size="xs" variant="filled" color="teal"
            leftSection={<IconPlus size={14} />}
            style={{ background: AQUA, color: DEEP_BLUE, fontWeight: 700 }}>
            Widget
          </Button>
          <ActionIcon icon={<IconDots size={16} />} />
        </Group>
      </Group>
      <Group gap={8}>
        <Tabs value={activeBoard} onChange={(v) => onBoardChange(v ?? 'team')}
          styles={{
            root: { flex: 1 },
            list: { borderBottom: '1px solid var(--pp-border)', gap: 0 },
            tab: {
              fontSize: 13, fontWeight: 600, color: 'var(--pp-text-secondary)',
              padding: '8px 16px', borderRadius: '6px 6px 0 0',
            },
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="team" leftSection={<IconLayoutDashboard size={14} />}>Team Dashboard</Tabs.Tab>
            <Tabs.Tab value="executive" leftSection={<IconPresentation size={14} />}>Executive Board</Tabs.Tab>
            <Tabs.Tab value="analyst" leftSection={<IconChartDonut size={14} />}>Analyst Board</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Group>
    </Box>
  );
}

function ActionIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <Box
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: '1px solid var(--mantine-color-default-border)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: TEXT_GRAY, background: 'var(--mantine-color-body)',
      }}
    >
      {icon}
    </Box>
  );
}

// ── TEAM DASHBOARD ────────────────────────────────────────────────────────
function TeamDashboard({ projects }: { projects: ProjectResponse[] }) {
  const navigate = useNavigate();
  const dark = useDarkMode();
  const today = new Date();
  const oneWeekLater = new Date(today); oneWeekLater.setDate(today.getDate() + 7);

  const dueSoon = useMemo(() => {
    return projects
      .filter(p => p.targetDate && p.status !== 'COMPLETED' && p.status !== 'CANCELLED')
      .filter(p => {
        const d = new Date(p.targetDate!);
        return d >= today && d <= oneWeekLater;
      })
      .sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime())
      .slice(0, 5);
  }, [projects]);

  const inProgress = useMemo(() =>
    projects.filter(p => normaliseProjectStatus(p.status, p.jiraStatusCategory, p.sourceType) === 'ACTIVE').slice(0, 5), [projects]);

  const completed = useMemo(() =>
    projects.filter(p => p.status === 'COMPLETED')
      .sort((a, b) => (b.targetDate ?? '').localeCompare(a.targetDate ?? ''))
      .slice(0, 5),
    [projects]);

  // Projects by status for donut
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, count]) => ({
        name: STATUS_META[status]?.label ?? status,
        value: count,
        color: STATUS_META[status]?.chart ?? TEXT_SUBTLE,
      }));
  }, [projects]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: dark ? 'rgba(255,255,255,0.50)' : TEXT_SUBTLE, textTransform: 'none',
    letterSpacing: 0, padding: '10px 16px', background: 'transparent',
    borderBottom: `1px solid var(--pp-border)`,
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: `1px solid var(--pp-border)`,
    fontSize: 13,
    color: 'var(--pp-text)',
  };

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      {/* Tasks Due This Week */}
      <WrikeCard title="Projects Due This Week" count={dueSoon.length} onTitleClick={() => navigate('/projects')}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Name</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Status</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {dueSoon.length === 0 && (
              <tr><td colSpan={3} style={{ ...tdStyle, color: TEXT_SUBTLE, textAlign: 'center', padding: '24px 16px' }}>No projects due this week</td></tr>
            )}
            {dueSoon.map(p => (
              <tr key={p.id} style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(45,204,211,0.06)' : SURFACE_FAINT)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={tdStyle}>{p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}><StatusPill status={p.status} /></td>
                <td style={{ ...tdStyle, textAlign: 'right', color: TEXT_GRAY }}>{formatDate(p.targetDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WrikeCard>

      {/* Projects by Status — Donut */}
      <ProjectStatusWidget projects={projects} />

      {/* In Progress Projects */}
      <WrikeCard title="In Progress" count={inProgress.length} onTitleClick={() => navigate('/projects?status=ACTIVE')}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Name</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Priority</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Target</th>
            </tr>
          </thead>
          <tbody>
            {inProgress.length === 0 && (
              <tr><td colSpan={3} style={{ ...tdStyle, color: TEXT_SUBTLE, textAlign: 'center', padding: '24px 16px' }}>No projects in progress</td></tr>
            )}
            {inProgress.map(p => (
              <tr key={p.id}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(45,204,211,0.06)' : SURFACE_FAINT)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={tdStyle}>{p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <Box style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 12,
                    background: p.priority === 'HIGHEST' || p.priority === 'BLOCKER' ? '#fef2f2' : p.priority === 'HIGH' ? '#fff7ed' : SURFACE_SUCCESS_LIGHT,
                    color: p.priority === 'HIGHEST' || p.priority === 'BLOCKER' ? COLOR_ERROR_DARK : p.priority === 'HIGH' ? COLOR_ORANGE_DEEP : COLOR_GREEN_STRONG,
                  }}>
                    {p.priority}
                  </Box>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: TEXT_GRAY }}>{formatDate(p.targetDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WrikeCard>

      {/* Projects by Assignee */}
      <TeamHealthWidget projects={projects} statusCounts={statusCounts} />
    </SimpleGrid>
  );
}

// ── EXECUTIVE BOARD ───────────────────────────────────────────────────────
function ExecutiveBoard({ projects, summary, capDemData, hiringData, hireRoles, healthData }: {
  projects: ProjectResponse[];
  summary: any;
  capDemData: any[];
  hiringData: any[];
  hireRoles: string[];
  healthData: import('../api/projectHealth').ProjectHealthDto[];
}) {
  const navigate = useNavigate();
  const dark = useDarkMode();
  const capDemChart = useMemo(() =>
    (capDemData ?? []).map(d => ({
      month: d.monthLabel,
      capacity: Math.round(d.totalCapacityHours),
      demand: Math.round(d.totalDemandHours),
    })), [capDemData]);

  const completedCount = projects.filter(p => p.status === 'COMPLETED').length;
  const completionPct = projects.length > 0 ? Math.round((completedCount / projects.length) * 100) : 0;

  const totalBudgetHours = useMemo(() =>
    (capDemData ?? []).reduce((s, d) => s + d.totalCapacityHours, 0),
    [capDemData]);

  // Budget rollup across active/in-flight projects
  const budgetRollup = useMemo(() => {
    const active = projects.filter(p => {
      const norm = normaliseProjectStatus(p.status, p.jiraStatusCategory, p.sourceType);
      return norm !== 'CANCELLED' && norm !== 'COMPLETED';
    });
    const withBudget = active.filter(p => p.estimatedBudget != null);
    const totalEst = withBudget.reduce((s, p) => s + (p.estimatedBudget ?? 0), 0);
    const totalAct = withBudget.reduce((s, p) => s + (p.actualCost ?? 0), 0);
    const pct = totalEst > 0 ? Math.round((totalAct / totalEst) * 100) : null;
    return { totalEst, totalAct, pct, count: withBudget.length };
  }, [projects]);

  // Health scorecard summary for dashboard
  const healthSummary = useMemo(() => {
    const active = healthData.filter(h => h.ragStatus !== 'GREY');
    const green  = active.filter(h => h.ragStatus === 'GREEN').length;
    const amber  = active.filter(h => h.ragStatus === 'AMBER').length;
    const red    = active.filter(h => h.ragStatus === 'RED').length;
    const sorted = [...active].sort((a, b) => (a.overallScore ?? 100) - (b.overallScore ?? 100));
    return { green, amber, red, total: active.length, sorted };
  }, [healthData]);

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: TEXT_SUBTLE, textTransform: 'none',
    letterSpacing: 0, padding: '10px 16px', background: 'transparent',
    borderBottom: '1px solid var(--pp-border)',
  };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--pp-border)', fontSize: 13, color: 'var(--pp-text)' };

  // Health score: simple heuristic
  const getHealthDot = (score: number) => ({
    color: score >= 4 ? COLOR_GREEN : score >= 2.5 ? COLOR_WARNING : COLOR_ERROR_STRONG,
    label: score.toFixed(1),
  });

  return (
    <Stack gap="lg">
      {/* Top row: line chart + KPI cards */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" style={{ alignItems: 'stretch' }}>
        {/* Average Utilization chart — spans 2 cols */}
        <Box style={{ gridColumn: 'span 2' }}>
          <WrikeCard title="Capacity vs Demand — Full Year">
            <Box p={20}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={capDemChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.06)" : SURFACE_LIGHT} />
                  <XAxis dataKey="month" fontSize={11} tick={{ fill: TEXT_SUBTLE }} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} tick={{ fill: TEXT_SUBTLE }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: number) => formatHours(v)} />
                  <Line animationDuration={600} type="monotone" dataKey="capacity" stroke={COLOR_GREEN} strokeWidth={2.5} dot={false} name="Capacity" />
                  <Line animationDuration={600} type="monotone" dataKey="demand" stroke="#fcd34d" strokeWidth={2.5} dot={false} name="Planned Demand" />
                </LineChart>
              </ResponsiveContainer>
              <Group gap={20} mt={12} justify="center">
                <Group gap={6}><Box style={{ width: 12, height: 3, background: '#fcd34d', borderRadius: 2 }} /><Text size="xs" c="dimmed">Planned demand</Text></Group>
                <Group gap={6}><Box style={{ width: 12, height: 3, background: COLOR_GREEN, borderRadius: 2 }} /><Text size="xs" c="dimmed">Capacity</Text></Group>
              </Group>
            </Box>
          </WrikeCard>
        </Box>

        {/* KPI stack */}
        <Stack gap="lg">
          <Paper withBorder radius="lg" p="xl" style={{ border: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)', textAlign: 'center' }}>
            <Text size="xs" fw={600} tt="uppercase" style={{ color: TEXT_SUBTLE, letterSpacing: '0.6px', marginBottom: 8 }}>Completion Progress</Text>
            <Text style={{ fontSize: 40, fontWeight: 800, color: 'var(--mantine-color-text)', lineHeight: 1, fontFamily: FONT_FAMILY }}>
              <AnimatedNumber value={completionPct} decimals={0} suffix="%" />
            </Text>
            <Text size="xs" c="dimmed" mt={4}>{completedCount} of {projects.length} projects</Text>
          </Paper>
          <Paper withBorder radius="lg" p="xl" style={{ border: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)', textAlign: 'center' }}>
            <Text size="xs" fw={600} tt="uppercase" style={{ color: TEXT_SUBTLE, letterSpacing: '0.6px', marginBottom: 8 }}>Total Capacity Hours</Text>
            <Text style={{ fontSize: 40, fontWeight: 800, color: 'var(--mantine-color-text)', lineHeight: 1, fontFamily: FONT_FAMILY }}>
              {totalBudgetHours >= 1000 ? (
                <AnimatedNumber value={totalBudgetHours / 1000} decimals={1} suffix="k h" />
              ) : (
                <AnimatedNumber value={totalBudgetHours} decimals={0} suffix=" h" />
              )}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>Full year across all PODs</Text>
          </Paper>
          {healthSummary.total > 0 && (
            <Paper withBorder radius="lg" p="md" style={{ border: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)' }}>
              <Text size="xs" fw={600} tt="uppercase" style={{ color: TEXT_SUBTLE, letterSpacing: '0.6px', marginBottom: 10 }}>Portfolio Health</Text>
              {/* RAG summary counts */}
              <Group gap="xs" mb={10} justify="center">
                {[
                  { label: 'Healthy', count: healthSummary.green, color: RAG_COLORS.GREEN },
                  { label: 'At Risk', count: healthSummary.amber, color: RAG_COLORS.AMBER },
                  { label: 'Critical', count: healthSummary.red, color: RAG_COLORS.RED },
                ].map(({ label, count, color }) => (
                  <Paper key={label} withBorder radius="sm" px="xs" py={4} style={{ textAlign: 'center', minWidth: 58 }}>
                    <Text fw={700} size="lg" style={{ color, fontFamily: FONT_FAMILY, lineHeight: 1 }}>
                      <AnimatedNumber value={count} decimals={0} />
                    </Text>
                    <Text size="10px" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
                  </Paper>
                ))}
              </Group>
              {/* Per-project heat strip (worst first, max 12) */}
              <Stack gap={4}>
                {healthSummary.sorted.slice(0, 12).map(h => (
                  <Group key={h.projectId} justify="space-between" gap="xs" wrap="nowrap"
                    style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${h.projectId}`)}>
                    <Text size="xs" truncate style={{ fontFamily: FONT_FAMILY, flex: 1, minWidth: 0 }}>
                      {h.projectName}
                    </Text>
                    <HealthBadge rag={h.ragStatus} score={h.overallScore ?? undefined} variant="score" size="xs" />
                  </Group>
                ))}
              </Stack>
              {healthSummary.sorted.length > 12 && (
                <Text size="xs" c="dimmed" mt={6} ta="center" style={{ fontFamily: FONT_FAMILY }}>
                  +{healthSummary.sorted.length - 12} more
                </Text>
              )}
            </Paper>
          )}
          {budgetRollup.count > 0 && (
            <Paper withBorder radius="lg" p="xl" style={{ border: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)', textAlign: 'center' }}>
              <Text size="xs" fw={600} tt="uppercase" style={{ color: TEXT_SUBTLE, letterSpacing: '0.6px', marginBottom: 8 }}>Portfolio Budget</Text>
              <Text fw={700} size="xl" style={{ color: (budgetRollup.pct ?? 0) > 100 ? COLOR_ERROR_STRONG : DARK_TEXT_PRIMARY }}>
                ${budgetRollup.totalAct >= 1_000_000
                  ? `${(budgetRollup.totalAct / 1_000_000).toFixed(1)}M`
                  : budgetRollup.totalAct >= 1_000
                    ? `${(budgetRollup.totalAct / 1_000).toFixed(0)}k`
                    : budgetRollup.totalAct.toFixed(0)}
                {' '}<Text span size="sm" c="dimmed">/ ${budgetRollup.totalEst >= 1_000_000
                  ? `${(budgetRollup.totalEst / 1_000_000).toFixed(1)}M`
                  : budgetRollup.totalEst >= 1_000
                    ? `${(budgetRollup.totalEst / 1_000).toFixed(0)}k`
                    : budgetRollup.totalEst.toFixed(0)}</Text>
              </Text>
              {budgetRollup.pct != null && (
                <Text size="xs" mt={4} c={(budgetRollup.pct ?? 0) > 100 ? 'red' : (budgetRollup.pct ?? 0) >= 80 ? 'orange' : 'teal'}>
                  {budgetRollup.pct}% spent · {budgetRollup.count} project{budgetRollup.count !== 1 ? 's' : ''}
                </Text>
              )}
            </Paper>
          )}
        </Stack>
      </SimpleGrid>

      {/* Team Projects table */}
      <WrikeCard title="Team Projects" count={projects.length}>
        <ScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, minWidth: 180 }}>Project Name</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Priority</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Owner</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Target Date</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Overall Health</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 10).map((p, i) => {
                // Health heuristic based on status + priority
                const healthScore = p.status === 'COMPLETED' ? 5
                  : p.status === 'CANCELLED' ? 1
                  : p.status === 'ON_HOLD' ? 2
                  : p.priority === 'HIGHEST' || p.priority === 'BLOCKER' ? 2.5
                  : p.priority === 'HIGH' ? 3.5
                  : 4.0;
                const dot = getHealthDot(healthScore);
                return (
                  <tr key={p.id}
                    onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : SURFACE_FAINT)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}><StatusPill status={p.status} /></td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Box style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 12,
                        background: p.priority === 'HIGHEST' || p.priority === 'BLOCKER' ? '#fef2f2' : p.priority === 'HIGH' ? '#fff7ed' : p.priority === 'MEDIUM' ? SURFACE_BLUE : SURFACE_FAINT,
                        color: p.priority === 'HIGHEST' || p.priority === 'BLOCKER' ? COLOR_ERROR_DARK : p.priority === 'HIGH' ? COLOR_ORANGE_DEEP : p.priority === 'MEDIUM' ? COLOR_BLUE : TEXT_GRAY,
                      }}>
                        {p.priority}
                      </Box>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: TEXT_GRAY }}>
                      {p.owner.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' ')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: TEXT_GRAY, fontSize: 12 }}>
                      {p.targetDate ? new Date(p.targetDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Group gap={4} justify="center">
                        <Text size="sm" fw={600} style={{ color: "var(--pp-text)" }}>{dot.label}</Text>
                        <Box style={{ width: 8, height: 8, borderRadius: '50%', background: dot.color }} />
                      </Group>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </WrikeCard>
    </Stack>
  );
}

// ── ANALYST BOARD ─────────────────────────────────────────────────────────
function AnalystBoard({ projects }: { projects: ProjectResponse[] }) {
  const dark = useDarkMode();
  // Treemap data by status
  const treemapData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return {
      name: 'root',
      children: Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([status, count]) => ({
          name: STATUS_META[status]?.label ?? status,
          size: count,
          color: STATUS_META[status]?.chart ?? TEXT_SUBTLE,
        })),
    };
  }, [projects]);

  // Projects by owner + status (stacked horizontal bar)
  const byOwner = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    projects.forEach(p => {
      if (!map.has(p.owner)) map.set(p.owner, {});
      const entry = map.get(p.owner)!;
      entry[p.status] = (entry[p.status] ?? 0) + 1;
    });
    return Array.from(map.entries())
      .map(([owner, counts]) => ({
        owner: owner.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' '),
        ...counts,
      }))
      .sort((a, b) => {
        const aT = Object.values(a).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
        const bT = Object.values(b).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
        return bT - aT;
      })
      .slice(0, 6);
  }, [projects]);

  // Cross-tab: status × owner
  const owners = Array.from(new Set(projects.map(p => p.owner)))
    .slice(0, 5)
    .map(o => o.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' '));

  const rawOwners = Array.from(new Set(projects.map(p => p.owner))).slice(0, 5);
  const statuses = Object.keys(STATUS_META).filter(s => projects.some(p => p.status === s));

  const crossTab = useMemo(() => {
    return statuses.map(status => {
      const row: Record<string, any> = { status: STATUS_META[status]?.label ?? status };
      rawOwners.forEach(owner => {
        const short = owner.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' ');
        row[short] = projects.filter(p => p.status === status && p.owner === owner).length;
      });
      return row;
    });
  }, [projects, statuses, rawOwners]);

  // Custom treemap cell
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, root, depth, value } = props;
    if (depth === 0 || !name || name === 'root') return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height}
          style={{ fill: props.color ?? '#93c5fd', stroke: '#fff', strokeWidth: 2, borderRadius: 4 }} />
        {width > 50 && height > 30 && (
          <text x={x + 8} y={y + 18} fontSize={11} fontWeight={600} fill={DARK_TEXT_PRIMARY}>
            {name}
          </text>
        )}
        {width > 50 && height > 40 && (
          <text x={x + 8} y={y + 34} fontSize={10} fill="#475569">
            {value}
          </text>
        )}
      </g>
    );
  };

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: TEXT_SUBTLE, textTransform: 'none',
    letterSpacing: 0, padding: '10px 16px', background: 'transparent',
    borderBottom: '1px solid #e2e8f0',
  };
  const tdStyle: React.CSSProperties = { padding: '11px 16px', borderBottom: '1px solid var(--pp-border)', fontSize: 13, color: 'var(--pp-text)' };

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Treemap: Projects by Status */}
        <WrikeCard title="Projects by Status" count={projects.length}>
          <Box p={16}>
            <ResponsiveContainer width="100%" height={220}>
              <Treemap
                data={treemapData.children}
                dataKey="size"
                content={<CustomTreemapContent />}
              >
                {treemapData.children.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Treemap>
            </ResponsiveContainer>
          </Box>
        </WrikeCard>

        {/* Horizontal bar: Projects by Assignee */}
        <WrikeCard title="Projects by Assignee">
          <Box p={16}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byOwner} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={dark ? "rgba(255,255,255,0.06)" : SURFACE_LIGHT} />
                <XAxis type="number" fontSize={10} tick={{ fill: TEXT_SUBTLE }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="owner" width={85} fontSize={11} tick={{ fill: TEXT_GRAY }} axisLine={false} tickLine={false} />
                <Tooltip />
                {Object.keys(STATUS_META).map(s => (
                  <Bar animationDuration={600} key={s} dataKey={s} stackId="a" fill={STATUS_META[s].chart}
                    name={STATUS_META[s].label} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <Group gap={10} mt={10} wrap="wrap" justify="center">
              {Object.entries(STATUS_META)
                .filter(([s]) => projects.some(p => p.status === s))
                .map(([, m]) => (
                  <Group key={m.label} gap={4}>
                    <Box style={{ width: 8, height: 8, borderRadius: '50%', background: m.chart }} />
                    <Text size="xs" c="dimmed">{m.label}</Text>
                  </Group>
                ))}
            </Group>
          </Box>
        </WrikeCard>
      </SimpleGrid>

      {/* Cross-tab table: Projects by Assignee and Status */}
      <WrikeCard title="Projects by Assignee and Status">
        <ScrollArea>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, minWidth: 110 }}>Status</th>
                {owners.map(o => (
                  <th key={o} style={{ ...tableHeaderStyle, textAlign: 'center', minWidth: 90 }}>{o}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crossTab.map((row, i) => (
                <tr key={i}
                  onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : SURFACE_FAINT)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}>{row.status}</td>
                  {owners.map(o => (
                    <td key={o} style={{ ...tdStyle, textAlign: 'center', color: row[o] > 0 ? DARK_TEXT_PRIMARY : '#cbd5e1', fontWeight: row[o] > 0 ? 600 : 400 }}>
                      {row[o] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </WrikeCard>
    </Stack>
  );
}

// ── AI Insights Bar ───────────────────────────────────────────────────────
function AiInsightsBar() {
  const { data: insights } = useNlpInsights();
  const navigate = useNavigate();

  if (!insights || insights.length === 0) return null;

  const iconMap: Record<string, React.ReactNode> = {
    'clock': <IconClock size={13} />,
    'alert-triangle': <IconAlertTriangle size={13} />,
    'rocket': <IconRocket size={13} />,
    'snowflake': <IconSnowflake size={13} />,
    'users': <IconUsers size={13} />,
    'briefcase': <IconBriefcase size={13} />,
    'chart-bar': <IconChartBar size={13} />,
    'status-change': <IconStatusChange size={13} />,
    'player-play': <IconPlayerPlay size={13} />,
  };

  return (
    <Paper p="sm" radius="lg" withBorder mb="md" style={{ borderLeft: '3px solid #2DCCD3' }}>
      <Group gap="xs" mb={8} wrap="nowrap">
        <IconBulb size={14} color="#2DCCD3" />
        <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.06em', color: '#2DCCD3' }}>
          AI Insights
        </Text>
      </Group>
      <Group gap="xs">
        {insights.slice(0, 4).map(card => (
          <Badge
            key={card.id}
            variant="light"
            color={card.color}
            size="sm"
            leftSection={iconMap[card.icon] || <IconBulb size={11} />}
            style={{ cursor: 'pointer', textTransform: 'none', fontWeight: 500 }}
            onClick={() => card.drillDownRoute ? navigate(card.drillDownRoute) : undefined}
          >
            {card.title}
          </Badge>
        ))}
      </Group>
    </Paper>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  // U-01: sync active tab to URL param so back-button and deep-linking work
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_BOARDS = ['team', 'executive', 'analyst'];
  const rawBoard = searchParams.get('board') ?? 'team';
  const activeBoard = VALID_BOARDS.includes(rawBoard) ? rawBoard : 'team';
  const setActiveBoard = (board: string | null) => {
    const next = board && VALID_BOARDS.includes(board) ? board : 'team';
    setSearchParams(next === 'team' ? {} : { board: next }, { replace: false });
  };

  // ── AI Insights summary ───────────────────────────────────────────────────
  const [insightCounts, setInsightCounts] = useState<{
    high: number; medium: number; low: number; total: number;
  } | null>(null);
  useEffect(() => {
    apiClient.get<{ high: number; medium: number; low: number; total: number }>('/insights/summary')
      .then(({ data }) => setInsightCounts(data))
      .catch(() => { /* silently ignore — widget simply won't render counts */ });
  }, []);

  const { data: projects = [], dataUpdatedAt: dashUpdatedAt } = useProjects();
  const { data: healthData = [] } = useProjectsHealth();
  const { data: summary, isLoading: summaryLoading } = useExecutiveSummary();
  const { data: heatmapCells, isLoading: heatmapLoading } = useUtilizationHeatmap();
  const { data: hiringData, isLoading: hiringLoading } = useHiringForecast();
  const { data: capDemData = [], isLoading: capDemLoading } = useCapacityDemandSummary();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const navigate = useNavigate();
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;

  // ── Real objectives from API ──────────────────────────────────────────────
  interface ObjItem { id: number; title: string; progress: number; status: string }
  const { data: objectivesData = [] } = useQuery<ObjItem[]>({
    queryKey: ['objectives-dashboard'],
    queryFn: () => apiClient.get('/objectives').then(r => r.data),
    staleTime: 60_000,
  });
  // Show up to 3 most relevant objectives on the dashboard
  const dashboardObjectives = objectivesData.slice(0, 3);

  const { data: podHoursData } = usePodHours(new Date().getFullYear(), 'MONTHLY', new Date().getMonth() + 1);
  const { data: jiraStatus } = useJiraStatus();
  const { data: podConfig = [] } = usePodWatchConfig();
  const { data: releaseConfig = [] } = useReleaseConfig();
  const activePodCount = podConfig.filter(p => p.enabled).length;
  const trackedReleaseCount = releaseConfig.reduce((sum, c) => sum + c.versions.length, 0);

  const { data: supportBoards = [] } = useSupportBoards();
  const hasConfiguredBoards = supportBoards.some(b => b.enabled);
  const { data: supportSnapshot } = useSupportSnapshot(jiraStatus?.configured && hasConfiguredBoards);
  const supportAllTickets = (supportSnapshot?.boards ?? []).flatMap(b => b.tickets);
  const supportStale = supportAllTickets.filter(t => t.stale).length;
  const supportTotal = supportAllTickets.length;
  const supportHealth = supportTotal === 0 ? 'gray'
    : (supportStale / supportTotal) > 0.3 ? 'red'
    : (supportStale / supportTotal) > 0.1 ? 'orange'
    : 'green';

  const hireChart = useMemo(() => {
    if (!hiringData) return [];
    const monthMap = new Map<string, Record<string, number>>();
    hiringData.forEach(d => {
      const label = d.monthLabel;
      if (!monthMap.has(label)) monthMap.set(label, {});
      const row = monthMap.get(label)!;
      row[d.role] = (row[d.role] ?? 0) + d.ftesNeeded;
    });
    return Array.from(monthMap.entries()).map(([month, roles]) => ({ month, ...roles }));
  }, [hiringData]);

  const hireRoles = useMemo(() => {
    if (!hiringData) return [];
    return Array.from(new Set(hiringData.map(d => d.role)));
  }, [hiringData]);

  const miniHeatmap = useMemo(() => {
    if (!heatmapCells) return [];
    const podMap = new Map<string, Map<number, number>>();
    heatmapCells.forEach(u => {
      if (!podMap.has(u.podName)) podMap.set(u.podName, new Map());
      podMap.get(u.podName)!.set(u.monthIndex, u.utilizationPct);
    });
    return Array.from(podMap.entries()).slice(0, 7).map(([name, data]) => ({ name, data }));
  }, [heatmapCells]);

  const utilizationSparkline = useMemo(() => {
    if (!capDemData || capDemData.length === 0) return undefined;
    return capDemData.map(d => d.totalCapacityHours > 0
      ? Math.round((d.totalDemandHours / d.totalCapacityHours) * 100) : 0);
  }, [capDemData]);

  const deficitSparkline = useMemo(() => {
    if (!capDemData || capDemData.length === 0) return undefined;
    return capDemData.map(d => d.netGapHours < 0 ? Math.abs(d.netGapHours) : 0);
  }, [capDemData]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (summaryLoading) return <PageSkeleton variant="dashboard" />;

  const boardTitles: Record<string, string> = {
    team: 'Team dashboard',
    executive: 'Executive board',
    analyst: 'Analyst board',
  };

  return (
    <PPPageLayout title="Dashboard" subtitle="Your portfolio at a glance" animate dataUpdatedAt={dashUpdatedAt}>
      <PageInsightCard pageKey="dashboard" />
      <Stack pb="xl">
        {/* AI Insights Bar */}
        <AiInsightsBar />

        {/* Wrike-style header with board selector */}
        <DashboardHeader
          title={boardTitles[activeBoard] ?? 'Dashboard'}
          activeBoard={activeBoard}
          onBoardChange={setActiveBoard}
        />

      {/* Board content */}
      {activeBoard === 'team' && <TeamDashboard projects={projects} />}
      {activeBoard === 'executive' && (
        <ExecutiveBoard
          projects={projects}
          summary={summary}
          capDemData={capDemData}
          hiringData={hiringData ?? []}
          hireRoles={hireRoles}
          healthData={healthData}
        />
      )}
      {activeBoard === 'analyst' && <AnalystBoard projects={projects} />}

      {/* ── Legacy resource widgets below (always visible) ── */}
      <Box mt={8}>
        <Text size="xs" fw={700} tt="uppercase" style={{ color: 'var(--pp-text-muted)', letterSpacing: '0.7px', marginBottom: 12 }}>
          Resource & Capacity Overview
        </Text>
        <WidgetGrid pageKey="dashboard">
          {/* KPI Summary */}
          <Widget id="kpi-cards" title="KPI Summary">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <SummaryCard title="Total Resources" value={summary?.totalResources ?? 0}
                icon={<IconUsers size={20} color={COLOR_BLUE_LIGHT} />} onClick={() => navigate('/resources')} />
              <SummaryCard title="Active Projects" value={summary?.activeProjects ?? 0}
                icon={<IconBriefcase size={20} color={COLOR_VIOLET_LIGHT} />} onClick={() => navigate('/projects')} />
              <SummaryCard title="Overall Utilization" value={formatPercent(summary?.overallUtilizationPct ?? 0)}
                icon={<IconFlame size={20} color={COLOR_ORANGE} />}
                color={(summary?.overallUtilizationPct ?? 0) > 100 ? 'red' : undefined}
                onClick={() => navigate('/reports/utilization')} sparkData={utilizationSparkline} />
              <SummaryCard title="POD-Months in Deficit" value={summary?.podMonthsInDeficit ?? 0}
                icon={<IconAlertTriangle size={20} color={COLOR_ERROR} />}
                color={(summary?.podMonthsInDeficit ?? 0) > 0 ? 'red' : 'green'}
                onClick={() => navigate('/reports/capacity-gap')} sparkData={deficitSparkline} />
            </SimpleGrid>
          </Widget>

          {/* AI Proactive Insights */}
          <Widget id="ai-insights" title="AI Proactive Insights">
            <Group justify="space-between" mb="sm" wrap="nowrap">
              <Group gap="xs">
                <ThemeIcon size={36} radius="md" variant="gradient"
                  gradient={{ from: DEEP_BLUE, to: AQUA, deg: 135 }}>
                  <IconBrain size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={600}>Automated signal detection</Text>
                  <Text size="xs" c="dimmed">Deadline risk · Overallocation · Stale projects · Open risks</Text>
                </div>
              </Group>
              <Button
                size="xs"
                variant="light"
                rightSection={<IconArrowRight size={14} />}
                onClick={() => navigate('/reports/smart-notifications')}
              >
                View all
              </Button>
            </Group>

            {insightCounts ? (
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                {/* HIGH */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: '4px solid #fa5252', background: dark ? 'rgba(250,82,82,0.10)' : SURFACE_RED_FAINT }}>
                  <Text size="xs" fw={600} tt="uppercase" style={{ letterSpacing: '0.5px', color: dark ? 'rgba(255,255,255,0.50)' : TEXT_SUBTLE }}>High</Text>
                  <Text size="xl" fw={800} style={{ color: '#fa5252' }}>{insightCounts.high}</Text>
                </Paper>
                {/* MEDIUM */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: '4px solid #fd7e14', background: dark ? 'rgba(253,126,20,0.10)' : '#fff4e6' }}>
                  <Text size="xs" fw={600} tt="uppercase" style={{ letterSpacing: '0.5px', color: dark ? 'rgba(255,255,255,0.50)' : TEXT_SUBTLE }}>Medium</Text>
                  <Text size="xl" fw={800} style={{ color: '#fd7e14' }}>{insightCounts.medium}</Text>
                </Paper>
                {/* LOW */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: '4px solid #339af0', background: dark ? 'rgba(51,154,240,0.10)' : '#e7f5ff' }}>
                  <Text size="xs" fw={600} tt="uppercase" style={{ letterSpacing: '0.5px', color: dark ? 'rgba(255,255,255,0.50)' : TEXT_SUBTLE }}>Low</Text>
                  <Text size="xl" fw={800} style={{ color: '#339af0' }}>{insightCounts.low}</Text>
                </Paper>
                {/* TOTAL */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: `4px solid ${AQUA}`, background: dark ? 'rgba(45,204,211,0.08)' : SURFACE_SUBTLE }}>
                  <Text size="xs" fw={600} tt="uppercase" style={{ letterSpacing: '0.5px', color: dark ? 'rgba(255,255,255,0.50)' : TEXT_SUBTLE }}>Total Active</Text>
                  <Text size="xl" fw={800} style={{ color: AQUA }}>{insightCounts.total}</Text>
                </Paper>
              </SimpleGrid>
            ) : (
              <Text size="sm" c="dimmed">Loading insights…</Text>
            )}
          </Widget>

          {/* Jira integrations */}
          {jiraStatus?.configured && (
            <Widget id="jira-integrations" title="Jira Integrations">
              <SimpleGrid cols={{ base: 1, sm: hasConfiguredBoards ? 3 : 2 }}>
                <Card withBorder padding="lg" radius="lg" onClick={() => navigate('/jira-pods')}
                  style={{ cursor: 'pointer', borderLeft: `4px solid ${DEEP_BLUE}` }}>
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${DEEP_BLUE}, ${AQUA})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconHexagons size={22} color="white" />
                      </div>
                      <div>
                        <Text size="sm" c="dimmed" fw={500}>POD Dashboard</Text>
                        <Text size="xl" fw={700} style={{ color: 'var(--pp-text)' }}>{activePodCount} Active POD{activePodCount !== 1 ? 's' : ''}</Text>
                      </div>
                    </Group>
                    <IconArrowRight size={16} color={AQUA} />
                  </Group>
                  <Text size="xs" c="dimmed" mt="sm">Sprint progress, velocity, team utilization &amp; Jira board metrics</Text>
                </Card>

                <Card withBorder padding="lg" radius="lg" onClick={() => navigate('/jira-releases')}
                  style={{ cursor: 'pointer', borderLeft: `4px solid ${AQUA}` }}>
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${AQUA}, #40c9c0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconTag size={22} color="white" />
                      </div>
                      <div>
                        <Text size="sm" c="dimmed" fw={500}>Release Tracker</Text>
                        <Text size="xl" fw={700} style={{ color: AQUA }}>{trackedReleaseCount} Version{trackedReleaseCount !== 1 ? 's' : ''}</Text>
                      </div>
                    </Group>
                    <IconArrowRight size={16} color={AQUA} />
                  </Group>
                  <Text size="xs" c="dimmed" mt="sm">Fix version progress, issue types, hours logged &amp; release notes per POD</Text>
                </Card>

                {hasConfiguredBoards && (
                  <Card withBorder padding="lg" radius="lg" onClick={() => navigate('/jira-support')}
                    style={{
                      cursor: 'pointer',
                      borderLeft: `4px solid ${supportHealth === 'red' ? COLOR_ERROR : supportHealth === 'orange' ? COLOR_ORANGE : supportHealth === 'green' ? COLOR_GREEN_LIGHT : GRAY_300}`,
                    }}>
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: `linear-gradient(135deg, ${supportHealth === 'red' ? COLOR_ERROR : supportHealth === 'orange' ? COLOR_ORANGE : COLOR_GREEN_LIGHT}, ${supportHealth === 'red' ? '#e03131' : supportHealth === 'orange' ? '#f08c00' : COLOR_SUCCESS})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconHeadset size={22} color="white" />
                        </div>
                        <div>
                          <Text size="sm" c="dimmed" fw={500}>Support Queue</Text>
                          <Text size="xl" fw={700} style={{ color: supportHealth === 'red' ? COLOR_ERROR : supportHealth === 'orange' ? COLOR_ORANGE : COLOR_GREEN_DARK }}>{supportTotal} Open</Text>
                        </div>
                      </Group>
                      <Group gap="xs" align="center" mt={4}>
                        {supportStale > 0 && <Badge size="sm" variant="light" color={supportHealth === 'red' ? 'red' : 'orange'}>{supportStale} stale</Badge>}
                        <IconArrowRight size={16} color={supportHealth === 'red' ? COLOR_ERROR : AQUA} />
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed" mt="sm">{supportBoards.filter(b => b.enabled).length} board{supportBoards.filter(b => b.enabled).length !== 1 ? 's' : ''} monitored</Text>
                  </Card>
                )}
              </SimpleGrid>
            </Widget>
          )}

          {/* Utilization Heatmap */}
          <Widget id="heatmap" title="Utilization Overview">
            {!heatmapLoading && miniHeatmap.length > 0 && (
              <ChartCard title="Utilization Overview" minHeight={0}>
                <ScrollArea>
                  <Table fz="xs" withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ minWidth: 120 }}>POD</Table.Th>
                        {months.map(m => (
                          <Table.Th key={m} style={{ textAlign: 'center', fontSize: 11, ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : {}) }}>
                            {monthLabels[m] ?? `M${m}`}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {miniHeatmap.map(row => (
                        <Table.Tr key={row.name}>
                          <Table.Td fw={500} style={{ fontSize: 12 }}>{row.name}</Table.Td>
                          {months.map(m => {
                            const val = row.data.get(m) ?? 0;
                            return (
                              <Table.Td key={m} style={{ textAlign: 'center', ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : { backgroundColor: val > 0 ? getUtilizationBgColor(val, dark) : undefined }) }}>
                                <Text size="xs">{val > 0 ? formatPercent(val) : '-'}</Text>
                              </Table.Td>
                            );
                          })}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </ChartCard>
            )}
          </Widget>

          {/* OKR / Strategic Objectives */}
          <Widget id="objectives" title="Strategic Objectives">
            <Stack gap={0}>
              {dashboardObjectives.length === 0 ? (
                <Box px={16} py={24} style={{ textAlign: 'center' }}>
                  <Text size="sm" c="dimmed">No objectives found. Add objectives to track progress here.</Text>
                </Box>
              ) : dashboardObjectives.map((obj, i) => {
                const st = (obj.status || '').toUpperCase();
                const statusColor = st === 'ON_TRACK' ? COLOR_TEAL : st === 'AT_RISK' ? COLOR_WARNING : st === 'COMPLETED' ? AQUA : TEXT_SUBTLE;
                const mantineColor = st === 'ON_TRACK' ? 'teal' : st === 'AT_RISK' ? 'yellow' : st === 'COMPLETED' ? 'cyan' : 'gray';
                const statusLabel = st === 'ON_TRACK' ? 'On Track' : st === 'AT_RISK' ? 'At Risk' : st === 'COMPLETED' ? 'Complete' : 'Not Started';
                const progress = obj.progress ?? 0;
                return (
                  <Box
                    key={obj.id}
                    px={16} py={12}
                    style={{
                      borderBottom: i < dashboardObjectives.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: 'pointer',
                      transition: 'background 150ms',
                    }}
                    className="hover-bg"
                    onClick={() => navigate('/objectives')}
                  >
                    <Group justify="space-between" mb={6}>
                      <Group gap={8}>
                        <IconTargetArrow size={14} color={statusColor} />
                        <Text size="sm" fw={600} style={{ color: 'var(--pp-text)', fontFamily: FONT_FAMILY }}>
                          {obj.title}
                        </Text>
                      </Group>
                      <Badge size="xs" variant="dot" color={mantineColor}>
                        {statusLabel}
                      </Badge>
                    </Group>
                    <Group gap={8}>
                      <Box style={{ flex: 1, height: 4, borderRadius: 4, background: BORDER_STRONG, overflow: 'hidden' }}>
                        <Box style={{ width: `${progress}%`, height: '100%', background: statusColor, borderRadius: 4, transition: 'width 600ms ease' }} />
                      </Box>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY, minWidth: 28 }}>{progress}%</Text>
                    </Group>
                  </Box>
                );
              })}
              <Box px={16} py={10} style={{ borderTop: '1px solid #f1f5f9' }}>
                <Button
                  variant="subtle" size="xs" fullWidth rightSection={<IconArrowUpRight size={12} />}
                  style={{ color: AQUA, fontFamily: FONT_FAMILY }}
                  onClick={() => navigate('/objectives')}
                >
                  View all objectives
                </Button>
              </Box>
            </Stack>
          </Widget>

          {/* Quick Links */}
          <Widget id="quick-links" title="Quick Links">
            <Group wrap="wrap" gap="sm">
              {[
                { icon: IconFlame,         label: 'Capacity',       path: '/capacity' },
                { icon: IconChartAreaLine, label: 'Analytics',      path: '/reports/portfolio-health-dashboard' },
                { icon: IconCalendar,      label: 'Calendar',       path: '/calendar' },
                { icon: IconAlertTriangle, label: 'Risk Register',  path: '/risk-register' },
                { icon: IconUserPlus,      label: 'Hiring Forecast', path: '/reports/hiring-forecast' },
                { icon: IconTargetArrow,   label: 'Objectives',     path: '/objectives' },
              ].map(({ icon: Icon, label, path }) => (
                <Button key={path} onClick={() => navigate(path)}
                  variant="light" radius="xl" size="sm"
                  leftSection={<Icon size={16} />}
                  style={{
                    fontWeight: 600, border: `1px solid ${AQUA}25`,
                    background: `linear-gradient(135deg, ${AQUA}10, ${DEEP_BLUE}05)`,
                    color: DEEP_BLUE,
                  }}>
                  {label}
                </Button>
              ))}
            </Group>
          </Widget>
        </WidgetGrid>
      </Box>
      </Stack>
    </PPPageLayout>
  );
}
