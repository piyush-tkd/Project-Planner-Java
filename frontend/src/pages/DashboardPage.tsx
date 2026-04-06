import { useMemo, useState, useEffect } from 'react';
import { useQuery }  from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import {
  Title, Stack, SimpleGrid, Text, Card, Group, Button, Table, Badge,
  Paper, ThemeIcon, ScrollArea, Tabs, Box, RingProgress, Tooltip as MTooltip,
} from '@mantine/core';
import {
  IconUsers, IconBriefcase, IconFlame, IconAlertTriangle,
  IconChartBar, IconChartAreaLine, IconUserPlus, IconCalendar,
  IconHexagons, IconArrowRight, IconHeadset, IconSparkles,
  IconArrowsLeftRight, IconTag, IconStar, IconDots, IconPlus,
  IconLayoutDashboard, IconPresentation, IconChartDonut, IconTable,
  IconTargetArrow, IconCheck, IconCircleDashed, IconArrowUpRight,
  IconBrain,
} from '@tabler/icons-react';
import { usePodHours } from '../api/podHours';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Treemap,
} from 'recharts';
import {
  useExecutiveSummary, useUtilizationHeatmap, useHiringForecast, useCapacityDemandSummary,
} from '../api/reports';
import { useSupportSnapshot, useSupportBoards } from '../api/jira';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../utils/colors';
import { formatPercent, formatHours } from '../utils/formatting';
import { formatRole } from '../types';
import SummaryCard from '../components/charts/SummaryCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ChartCard from '../components/common/ChartCard';
import WidgetGrid, { Widget } from '../components/layout/WidgetGrid';
import { useDarkMode } from '../hooks/useDarkMode';
import { useJiraStatus, usePodWatchConfig, useReleaseConfig } from '../api/jira';
import { useProjects } from '../api/projects';
import { ProjectResponse } from '../types';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY, SHADOW } from '../brandTokens';

// ── Wrike-style pastel status colors ──────────────────────────────────────
const STATUS_META: Record<string, { bg: string; text: string; border: string; label: string; chart: string }> = {
  NOT_STARTED:  { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe', label: 'Not Started',  chart: '#93c5fd' },
  IN_DISCOVERY: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', label: 'In Discovery', chart: '#c4b5fd' },
  ACTIVE:       { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Active',        chart: '#6ee7b7' },
  ON_HOLD:      { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'On Hold',       chart: '#fcd34d' },
  COMPLETED:    { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Completed',     chart: '#86efac' },
  CANCELLED:    { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', label: 'Cancelled',     chart: '#cbd5e1' },
};

const ROLE_COLORS: Record<string, string> = {
  DEVELOPER: '#3b82f6',
  QA: '#8b5cf6',
  BSA: '#f59e0b',
  TECH_LEAD: '#ef4444',
};

// ── Wrike-style widget card wrapper ──────────────────────────────────────
function WrikeCard({ title, count, children, minH, onTitleClick }: {
  title: string; count?: number; children: React.ReactNode; minH?: number; onTitleClick?: () => void;
}) {
  return (
    <Paper
      withBorder
      radius="lg"
      p={0}
      style={{
        border: '1px solid #e2e8f0',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(12,35,64,0.06)',
        overflow: 'hidden',
        minHeight: minH,
      }}
    >
      <Box px={20} py={14}
        onClick={onTitleClick}
        style={{ borderBottom: '1px solid #f1f5f9', cursor: onTitleClick ? 'pointer' : 'default' }}>
        <Text fw={700} size="sm" style={{ color: '#1e293b' }}>
          {title}{count !== undefined && <Text component="span" c="dimmed" fw={400} ml={6}>({count})</Text>}
          {onTitleClick && <Text component="span" c="dimmed" fw={400} ml={6} size="xs">↗</Text>}
        </Text>
      </Box>
      <Box p={0}>{children}</Box>
    </Paper>
  );
}

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
    <Paper withBorder radius="lg" p="xl" style={{ border: '1px solid #e2e8f0', background: '#fff', textAlign: 'center' }}>
      <Text size="xs" fw={600} tt="uppercase" style={{ color: '#94a3b8', letterSpacing: '0.6px', marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', lineHeight: 1, fontFamily: FONT_FAMILY }}>{value}</Text>
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
          <Title order={2} style={{ color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</Title>
          <ActionIcon icon={<IconStar size={16} />} />
        </Group>
        <Group gap={8}>
          <Button size="xs" variant="filled" color="teal"
            leftSection={<IconPlus size={14} />}
            style={{ background: '#2DCCD3', color: '#0C2340', fontWeight: 700 }}>
            Widget
          </Button>
          <ActionIcon icon={<IconDots size={16} />} />
        </Group>
      </Group>
      <Group gap={8}>
        <Tabs value={activeBoard} onChange={(v) => onBoardChange(v ?? 'team')}
          styles={{
            root: { flex: 1 },
            list: { borderBottom: '1px solid #e2e8f0', gap: 0 },
            tab: {
              fontSize: 13, fontWeight: 600, color: '#64748b',
              padding: '8px 16px', borderRadius: '6px 6px 0 0',
              '&[data-active]': { color: '#0f172a', borderBottom: '2px solid #2DCCD3', background: 'transparent' },
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
        border: '1px solid #e2e8f0', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#64748b', background: '#fff',
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
    projects.filter(p => p.status === 'ACTIVE').slice(0, 5), [projects]);

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
        color: STATUS_META[status]?.chart ?? '#94a3b8',
      }));
  }, [projects]);

  // Projects by owner (stacked bar)
  const byOwner = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    projects.forEach(p => {
      if (!map.has(p.owner)) map.set(p.owner, {});
      const entry = map.get(p.owner)!;
      entry[p.status] = (entry[p.status] ?? 0) + 1;
    });
    return Array.from(map.entries())
      .map(([owner, counts]) => ({ owner: owner.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' '), ...counts }))
      .sort((a, b) => {
        const aTotal = Object.values(a).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
        const bTotal = Object.values(b).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
        return bTotal - aTotal;
      })
      .slice(0, 6);
  }, [projects]);

  const total = statusCounts.reduce((s, d) => s + d.value, 0);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: dark ? '#9ca3af' : '#94a3b8', textTransform: 'none',
    letterSpacing: 0, padding: '10px 16px', background: 'transparent',
    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}`,
    fontSize: 13,
    color: dark ? '#e2e8f0' : '#1e293b',
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
              <tr><td colSpan={3} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: '24px 16px' }}>No projects due this week</td></tr>
            )}
            {dueSoon.map(p => (
              <tr key={p.id} style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(45,204,211,0.06)' : '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={tdStyle}>{p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}><StatusPill status={p.status} /></td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#64748b' }}>{formatDate(p.targetDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WrikeCard>

      {/* Projects by Status — Donut */}
      <WrikeCard title="Projects by Status">
        <Box p={20}>
          <Group align="center" justify="center" gap="xl">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={statusCounts} dataKey="value" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75} paddingAngle={2}
                  cursor="pointer"
                  onClick={(data) => {
                    const statusKey = Object.keys(STATUS_META).find(k => STATUS_META[k].label === data.name);
                    if (statusKey) navigate(`/projects?status=${statusKey}`);
                  }}>
                  {statusCounts.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} projects`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <Stack gap={6}>
              {statusCounts.map((entry) => {
                const statusKey = Object.keys(STATUS_META).find(k => STATUS_META[k].label === entry.name);
                return (
                  <Group key={entry.name} gap={8} align="center"
                    style={{ cursor: statusKey ? 'pointer' : 'default' }}
                    onClick={() => statusKey && navigate(`/projects?status=${statusKey}`)}>
                    <Box style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <Text size="xs" c="dimmed" style={{ minWidth: 90 }}>{entry.name}</Text>
                    <Text size="xs" fw={700} style={{ color: '#1e293b' }}>
                      {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          </Group>
        </Box>
      </WrikeCard>

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
              <tr><td colSpan={3} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', padding: '24px 16px' }}>No projects in progress</td></tr>
            )}
            {inProgress.map(p => (
              <tr key={p.id}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(45,204,211,0.06)' : '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={tdStyle}>{p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <Box style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 12,
                    background: p.priority === 'P0' ? '#fef2f2' : p.priority === 'P1' ? '#fff7ed' : '#f0fdf4',
                    color: p.priority === 'P0' ? '#dc2626' : p.priority === 'P1' ? '#ea580c' : '#16a34a',
                  }}>
                    {p.priority}
                  </Box>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#64748b' }}>{formatDate(p.targetDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WrikeCard>

      {/* Projects by Assignee */}
      <WrikeCard title="Projects by Assignee" minH={260}>
        <Box p={20} pt={16}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byOwner} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="owner" width={90} fontSize={11} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip />
              {Object.keys(STATUS_META).map(s => (
                <Bar key={s} dataKey={s} stackId="a" fill={STATUS_META[s].chart}
                  name={STATUS_META[s].label} radius={[0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <Group gap={12} mt={12} wrap="wrap" justify="center">
            {statusCounts.map(s => (
              <Group key={s.name} gap={4} align="center">
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <Text size="xs" c="dimmed">{s.name}</Text>
              </Group>
            ))}
          </Group>
        </Box>
      </WrikeCard>
    </SimpleGrid>
  );
}

// ── EXECUTIVE BOARD ───────────────────────────────────────────────────────
function ExecutiveBoard({ projects, summary, capDemData, hiringData, hireRoles }: {
  projects: ProjectResponse[];
  summary: any;
  capDemData: any[];
  hiringData: any[];
  hireRoles: string[];
}) {
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

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: '#94a3b8', textTransform: 'none',
    letterSpacing: 0, padding: '10px 16px', background: 'transparent',
    borderBottom: '1px solid #e2e8f0',
  };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f8fafc', fontSize: 13, color: '#1e293b' };

  // Health score: simple heuristic
  const getHealthDot = (score: number) => ({
    color: score >= 4 ? '#22c55e' : score >= 2.5 ? '#f59e0b' : '#ef4444',
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: number) => formatHours(v)} />
                  <Line type="monotone" dataKey="capacity" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Capacity" />
                  <Line type="monotone" dataKey="demand" stroke="#fcd34d" strokeWidth={2.5} dot={false} name="Planned Demand" />
                </LineChart>
              </ResponsiveContainer>
              <Group gap={20} mt={12} justify="center">
                <Group gap={6}><Box style={{ width: 12, height: 3, background: '#fcd34d', borderRadius: 2 }} /><Text size="xs" c="dimmed">Planned demand</Text></Group>
                <Group gap={6}><Box style={{ width: 12, height: 3, background: '#22c55e', borderRadius: 2 }} /><Text size="xs" c="dimmed">Capacity</Text></Group>
              </Group>
            </Box>
          </WrikeCard>
        </Box>

        {/* KPI stack */}
        <Stack gap="lg">
          <KpiNumberCard label="Completion Progress" value={`${completionPct}%`} sub={`${completedCount} of ${projects.length} projects`} />
          <KpiNumberCard label="Total Capacity Hours" value={totalBudgetHours >= 1000 ? `${(totalBudgetHours / 1000).toFixed(0)}k h` : `${Math.round(totalBudgetHours)} h`} sub="Full year across all PODs" />
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
                  : p.priority === 'P0' ? 2.5
                  : p.priority === 'P1' ? 3.5
                  : 4.0;
                const dot = getHealthDot(healthScore);
                return (
                  <tr key={p.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}><StatusPill status={p.status} /></td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Box style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 12,
                        background: p.priority === 'P0' ? '#fef2f2' : p.priority === 'P1' ? '#fff7ed' : p.priority === 'P2' ? '#eff6ff' : '#f8fafc',
                        color: p.priority === 'P0' ? '#dc2626' : p.priority === 'P1' ? '#ea580c' : p.priority === 'P2' ? '#3b82f6' : '#64748b',
                      }}>
                        {p.priority}
                      </Box>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>
                      {p.owner.split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' ')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                      {p.targetDate ? new Date(p.targetDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Group gap={4} justify="center">
                        <Text size="sm" fw={600} style={{ color: '#1e293b' }}>{dot.label}</Text>
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
          color: STATUS_META[status]?.chart ?? '#94a3b8',
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
          <text x={x + 8} y={y + 18} fontSize={11} fontWeight={600} fill="#1e293b">
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
    fontSize: 12, fontWeight: 500, color: '#94a3b8', textTransform: 'none',
    letterSpacing: 0, padding: '10px 16px', background: 'transparent',
    borderBottom: '1px solid #e2e8f0',
  };
  const tdStyle: React.CSSProperties = { padding: '11px 16px', borderBottom: '1px solid #f8fafc', fontSize: 13, color: '#1e293b' };

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
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="owner" width={85} fontSize={11} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip />
                {Object.keys(STATUS_META).map(s => (
                  <Bar key={s} dataKey={s} stackId="a" fill={STATUS_META[s].chart}
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
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}>{row.status}</td>
                  {owners.map(o => (
                    <td key={o} style={{ ...tdStyle, textAlign: 'center', color: row[o] > 0 ? '#1e293b' : '#cbd5e1', fontWeight: row[o] > 0 ? 600 : 400 }}>
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

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [activeBoard, setActiveBoard] = useState<string>('team');

  // ── AI Insights summary ───────────────────────────────────────────────────
  const [insightCounts, setInsightCounts] = useState<{
    high: number; medium: number; low: number; total: number;
  } | null>(null);
  useEffect(() => {
    apiClient.get<{ high: number; medium: number; low: number; total: number }>('/insights/summary')
      .then(({ data }) => setInsightCounts(data))
      .catch(() => { /* silently ignore — widget simply won't render counts */ });
  }, []);

  const { data: projects = [] } = useProjects();
  const { data: summary, isLoading: summaryLoading } = useExecutiveSummary();
  const { data: heatmapCells, isLoading: heatmapLoading } = useUtilizationHeatmap();
  const { data: hiringData, isLoading: hiringLoading } = useHiringForecast();
  const { data: capDemData = [], isLoading: capDemLoading } = useCapacityDemandSummary();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const navigate = useNavigate();
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';

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

  if (summaryLoading) return <LoadingSpinner variant="dashboard" message="Loading dashboard..." />;

  const boardTitles: Record<string, string> = {
    team: 'Team dashboard',
    executive: 'Executive board',
    analyst: 'Analyst board',
  };

  return (
    <Stack pb="xl">
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
        />
      )}
      {activeBoard === 'analyst' && <AnalystBoard projects={projects} />}

      {/* ── Legacy resource widgets below (always visible) ── */}
      <Box mt={8}>
        <Text size="xs" fw={700} tt="uppercase" style={{ color: '#94a3b8', letterSpacing: '0.7px', marginBottom: 12 }}>
          Resource & Capacity Overview
        </Text>
        <WidgetGrid pageKey="dashboard">
          {/* KPI Summary */}
          <Widget id="kpi-cards" title="KPI Summary">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <SummaryCard title="Total Resources" value={summary?.totalResources ?? 0}
                icon={<IconUsers size={20} color="#339af0" />} onClick={() => navigate('/resources')} />
              <SummaryCard title="Active Projects" value={summary?.activeProjects ?? 0}
                icon={<IconBriefcase size={20} color="#845ef7" />} onClick={() => navigate('/projects')} />
              <SummaryCard title="Overall Utilization" value={formatPercent(summary?.overallUtilizationPct ?? 0)}
                icon={<IconFlame size={20} color="#fd7e14" />}
                color={(summary?.overallUtilizationPct ?? 0) > 100 ? 'red' : undefined}
                onClick={() => navigate('/reports/utilization')} sparkData={utilizationSparkline} />
              <SummaryCard title="POD-Months in Deficit" value={summary?.podMonthsInDeficit ?? 0}
                icon={<IconAlertTriangle size={20} color="#fa5252" />}
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
                  style={{ borderLeft: '4px solid #fa5252', background: '#fff5f5' }}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.5px' }}>High</Text>
                  <Text size="xl" fw={800} c="#fa5252">{insightCounts.high}</Text>
                </Paper>
                {/* MEDIUM */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: '4px solid #fd7e14', background: '#fff4e6' }}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.5px' }}>Medium</Text>
                  <Text size="xl" fw={800} c="#fd7e14">{insightCounts.medium}</Text>
                </Paper>
                {/* LOW */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: '4px solid #339af0', background: '#e7f5ff' }}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.5px' }}>Low</Text>
                  <Text size="xl" fw={800} c="#339af0">{insightCounts.low}</Text>
                </Paper>
                {/* TOTAL */}
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: `4px solid ${DEEP_BLUE}`, background: '#f8f9fa' }}>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.5px' }}>Total Active</Text>
                  <Text size="xl" fw={800} style={{ color: DEEP_BLUE }}>{insightCounts.total}</Text>
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
                        <Text size="xl" fw={700} style={{ color: DEEP_BLUE }}>{activePodCount} Active POD{activePodCount !== 1 ? 's' : ''}</Text>
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
                      borderLeft: `4px solid ${supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : supportHealth === 'green' ? '#51cf66' : '#adb5bd'}`,
                    }}>
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: `linear-gradient(135deg, ${supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : '#51cf66'}, ${supportHealth === 'red' ? '#e03131' : supportHealth === 'orange' ? '#f08c00' : '#40c057'})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconHeadset size={22} color="white" />
                        </div>
                        <div>
                          <Text size="sm" c="dimmed" fw={500}>Support Queue</Text>
                          <Text size="xl" fw={700} style={{ color: supportHealth === 'red' ? '#fa5252' : supportHealth === 'orange' ? '#fd7e14' : '#2f9e44' }}>{supportTotal} Open</Text>
                        </div>
                      </Group>
                      <Group gap="xs" align="center" mt={4}>
                        {supportStale > 0 && <Badge size="sm" variant="light" color={supportHealth === 'red' ? 'red' : 'orange'}>{supportStale} stale</Badge>}
                        <IconArrowRight size={16} color={supportHealth === 'red' ? '#fa5252' : AQUA} />
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
                const statusColor = st === 'ON_TRACK' ? '#10b981' : st === 'AT_RISK' ? '#f59e0b' : st === 'COMPLETED' ? AQUA : '#94a3b8';
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
                        <Text size="sm" fw={600} style={{ color: '#1e293b', fontFamily: FONT_FAMILY }}>
                          {obj.title}
                        </Text>
                      </Group>
                      <Badge size="xs" variant="dot" color={mantineColor}>
                        {statusLabel}
                      </Badge>
                    </Group>
                    <Group gap={8}>
                      <Box style={{ flex: 1, height: 4, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
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
  );
}
