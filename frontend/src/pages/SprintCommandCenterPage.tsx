import React, { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Stack, Group, Text, Badge, Paper, SimpleGrid,
  Progress, Table, ThemeIcon, Alert, Tooltip,
  Box, RingProgress, Divider, Drawer, Button,
  UnstyledButton, ScrollArea, Tabs,
} from '@mantine/core';
import {
  IconRocket, IconCheckbox, IconClock, IconAlertTriangle,
  IconCircleDot, IconListCheck, IconUsersGroup, IconHeadset,
  IconTrendingUp, IconTrendingDown, IconMinus,
  IconSnowflake, IconExternalLink, IconChevronRight,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { PPPageLayout } from '../components/pp';
import { useJiraPods, PodMetrics, useSupportSnapshot, useSupportHistory, useSupportMonthlyThroughput, useJiraStatus, SupportTicket } from '../api/jira';
import { useReleases } from '../api/releases';
import SprintViolationsTab from './tabs/SprintViolationsTab';
import { EfficiencyTab } from './reports/engineering-analytics/components/EfficiencyTab';
import {
  DEEP_BLUE, AQUA, UX_ERROR,
  TEXT_SECONDARY, BORDER_DEFAULT,
} from '../brandTokens';
import { LineChart, Line, CartesianGrid } from 'recharts';

// ── helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function sprintTimePct(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── drawer state ──────────────────────────────────────────────────────────────

type DrawerContent =
  | { type: 'kpi';       label: string; field: 'done' | 'inProgress' | 'toDo' | 'total' | 'sp' }
  | { type: 'pod';       pod: PodMetrics }
  | { type: 'priority';  priority: string }
  | { type: 'issuetype'; issueType: string }
  | null;

// ── clickable card shell ──────────────────────────────────────────────────────

function Clickable({
  children, onClick, style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.1s',
        ...style,
      }}
      styles={{
        root: {
          '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.10)', transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' },
        },
      }}
    >
      {children}
    </UnstyledButton>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

function KpiCard({ label, value, sub, icon, color, onClick }: KpiCardProps) {
  const inner = (
    <Paper withBorder p="md" radius="md" style={{ height: '100%' }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            {label}
          </Text>
          <Text size="xl" fw={700} c={DEEP_BLUE}>{value}</Text>
          {sub && <Text size="xs" c="dimmed">{sub}</Text>}
        </Stack>
        <ThemeIcon variant="light" size="lg" radius="md" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
      {onClick && (
        <Group gap={4} mt={8}>
          <Text size="xs" c="dimmed">View breakdown</Text>
          <IconChevronRight size={10} color="gray" />
        </Group>
      )}
    </Paper>
  );

  if (!onClick) return inner;
  return <Clickable onClick={onClick}>{inner}</Clickable>;
}

// ── countdown banner ──────────────────────────────────────────────────────────

interface CountdownBannerProps {
  label: string;
  days: number;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

function CountdownBanner({ label, days, icon, onClick }: CountdownBannerProps) {
  const urgent = days <= 3;
  return (
    <Clickable onClick={onClick}>
      <Paper
        withBorder
        p="sm"
        radius="md"
        style={{ borderColor: urgent ? UX_ERROR : BORDER_DEFAULT, borderLeftWidth: 4 }}
      >
        <Group gap="sm" wrap="nowrap" justify="space-between">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" size="md" radius="md" color={urgent ? 'red' : 'blue'}>
              {icon}
            </ThemeIcon>
            <Box>
              <Text size="xs" c="dimmed" fw={500}>{label}</Text>
              <Text size="sm" fw={700} c={urgent ? UX_ERROR : DEEP_BLUE}>
                {days <= 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
              </Text>
            </Box>
          </Group>
          <IconExternalLink size={12} color="gray" />
        </Group>
      </Paper>
    </Clickable>
  );
}

// ── POD sprint card ───────────────────────────────────────────────────────────

interface PodSprintCardProps {
  pod: PodMetrics;
  workPct: number;
  timePct: number | null;
  onClick: () => void;
}

function PodSprintCard({ pod, workPct, timePct, onClick }: PodSprintCardProps) {
  const sp = pod.activeSprint!;
  const gap = timePct !== null ? workPct - timePct : null;
  const health: 'ahead' | 'behind' | 'on-track' =
    gap === null ? 'on-track' :
    gap >= 5 ? 'ahead' :
    gap <= -10 ? 'behind' : 'on-track';

  const daysLeft = daysUntil(sp.endDate);

  return (
    <Clickable onClick={onClick}>
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          {/* Header */}
          <Group justify="space-between" wrap="nowrap">
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={700} c={DEEP_BLUE} truncate>{pod.podDisplayName}</Text>
              <Text size="xs" c="dimmed" truncate>{sp.name}</Text>
            </Box>
            <Badge
              size="sm" variant="light"
              color={health === 'ahead' ? 'green' : health === 'behind' ? 'red' : 'yellow'}
              leftSection={
                health === 'ahead' ? <IconTrendingUp size={10} /> :
                health === 'behind' ? <IconTrendingDown size={10} /> :
                <IconMinus size={10} />
              }
            >
              {health === 'ahead' ? 'Ahead' : health === 'behind' ? 'Behind' : 'On Track'}
            </Badge>
          </Group>

          {/* Ring + bars */}
          <Group justify="space-between" wrap="nowrap">
            <Tooltip label={`${sp.doneSP} / ${sp.totalSP} SP done`}>
              <RingProgress
                size={64} thickness={6}
                sections={[{ value: workPct, color: AQUA }]}
                label={<Text size="xs" fw={700} ta="center">{workPct}%</Text>}
              />
            </Tooltip>
            <Stack gap={4} style={{ flex: 1 }}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Issues done</Text>
                <Text size="xs" fw={600}>{sp.doneIssues} / {sp.totalIssues}</Text>
              </Group>
              <Progress value={workPct} color={AQUA} size="sm" radius="xl" />
              {timePct !== null && (
                <>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Time used</Text>
                    <Text size="xs" fw={600}>{timePct}%</Text>
                  </Group>
                  <Progress value={timePct} color={DEEP_BLUE} size="sm" radius="xl" />
                </>
              )}
            </Stack>
          </Group>

          {/* Footer */}
          <Divider />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{sp.doneSP} / {sp.totalSP} SP</Text>
            <Group gap={4}>
              {daysLeft !== null && (
                <Text size="xs" c={daysLeft <= 3 ? 'red' : 'dimmed'} fw={daysLeft <= 3 ? 600 : 400}>
                  {daysLeft <= 0 ? 'Sprint ended' : `${daysLeft}d left`}
                </Text>
              )}
              <IconChevronRight size={11} color="gray" />
            </Group>
          </Group>
        </Stack>
      </Paper>
    </Clickable>
  );
}

// ── priority breakdown table ──────────────────────────────────────────────────

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const PRIORITY_COLOR: Record<string, string> = {
  Highest: 'red', High: 'orange', Medium: 'yellow', Low: 'blue', Lowest: 'gray',
};

interface PriorityRow {
  priority: string;
  total: number;
  done: number;
  inProgress: number;
}

interface PriorityTableProps {
  rows: PriorityRow[];
  onRowClick: (priority: string) => void;
}

function PriorityTable({ rows, onRowClick }: PriorityTableProps) {
  return (
    <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
      <Box p="sm" style={{ borderBottom: `1px solid ${BORDER_DEFAULT}` }}>
        <Text size="sm" fw={600} c={DEEP_BLUE}>Priority Breakdown</Text>
        <Text size="xs" c="dimmed" mt={2}>Click a row to see per-POD breakdown</Text>
      </Box>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Priority</Table.Th>
            <Table.Th ta="center">Total</Table.Th>
            <Table.Th ta="center">Done</Table.Th>
            <Table.Th ta="center">In Progress</Table.Th>
            <Table.Th ta="center">Remaining</Table.Th>
            <Table.Th>Progress</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(r => {
            const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <Table.Tr
                key={r.priority}
                style={{ cursor: 'pointer' }}
                onClick={() => onRowClick(r.priority)}
              >
                <Table.Td>
                  <Badge size="sm" color={PRIORITY_COLOR[r.priority] ?? 'gray'} variant="light">
                    {r.priority}
                  </Badge>
                </Table.Td>
                <Table.Td ta="center"><Text size="sm" fw={600}>{r.total}</Text></Table.Td>
                <Table.Td ta="center"><Text size="sm" c="green">{r.done}</Text></Table.Td>
                <Table.Td ta="center"><Text size="sm" c="blue">{r.inProgress}</Text></Table.Td>
                <Table.Td ta="center"><Text size="sm" c="dimmed">{r.total - r.done - r.inProgress}</Text></Table.Td>
                <Table.Td style={{ minWidth: 120 }}>
                  <Group gap={6} wrap="nowrap">
                    <Progress value={pct} size="sm" radius="xl" style={{ flex: 1 }} color={AQUA} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{pct}%</Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text size="sm" c="dimmed" ta="center" p="md">No active sprint data</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

// ── issue type breakdown table ────────────────────────────────────────────────

// Preferred display order for common Jira issue types
const ISSUE_TYPE_ORDER = ['Story', 'Bug', 'Task', 'Sub-task', 'Epic', 'Improvement', 'Spike'];
const ISSUE_TYPE_COLOR: Record<string, string> = {
  Story: 'green', Bug: 'red', Task: 'blue', 'Sub-task': 'cyan',
  Epic: 'violet', Improvement: 'teal', Spike: 'orange',
};

interface IssueTypeRow {
  issueType: string;
  total: number;
  done: number;
  inProgress: number;
}

interface IssueTypeTableProps {
  rows: IssueTypeRow[];
  onRowClick: (issueType: string) => void;
}

function IssueTypeTable({ rows, onRowClick }: IssueTypeTableProps) {
  return (
    <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
      <Box p="sm" style={{ borderBottom: `1px solid ${BORDER_DEFAULT}` }}>
        <Text size="sm" fw={600} c={DEEP_BLUE}>Issue Type Breakdown</Text>
        <Text size="xs" c="dimmed" mt={2}>Click a row to see which PODs are carrying that type</Text>
      </Box>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th ta="center">Total</Table.Th>
            <Table.Th ta="center">Done</Table.Th>
            <Table.Th ta="center">In Progress</Table.Th>
            <Table.Th ta="center">Remaining</Table.Th>
            <Table.Th>Progress</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(r => {
            const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <Table.Tr
                key={r.issueType}
                style={{ cursor: 'pointer' }}
                onClick={() => onRowClick(r.issueType)}
              >
                <Table.Td>
                  <Badge
                    size="sm"
                    color={ISSUE_TYPE_COLOR[r.issueType] ?? 'gray'}
                    variant="light"
                  >
                    {r.issueType}
                  </Badge>
                </Table.Td>
                <Table.Td ta="center"><Text size="sm" fw={600}>{r.total}</Text></Table.Td>
                <Table.Td ta="center"><Text size="sm" c="green">{r.done}</Text></Table.Td>
                <Table.Td ta="center"><Text size="sm" c="blue">{r.inProgress}</Text></Table.Td>
                <Table.Td ta="center">
                  <Text size="sm" c="dimmed">{r.total - r.done - r.inProgress}</Text>
                </Table.Td>
                <Table.Td style={{ minWidth: 120 }}>
                  <Group gap={6} wrap="nowrap">
                    <Progress value={pct} size="sm" radius="xl" style={{ flex: 1 }} color={AQUA} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{pct}%</Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text size="sm" c="dimmed" ta="center" p="md">No active sprint data</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

// ── drawer: KPI detail ────────────────────────────────────────────────────────

interface KpiDrawerContentProps {
  label: string;
  field: DrawerContent & { type: 'kpi' } extends { field: infer F } ? F : never;
  activePods: PodMetrics[];
  onNavigate: () => void;
}

function KpiDrawerContent({ label, field, activePods, onNavigate }: KpiDrawerContentProps) {
  const rows = activePods
    .filter(p => p.activeSprint)
    .map(p => {
      const sp = p.activeSprint!;
      let count = 0;
      if (field === 'done')       count = sp.doneIssues;
      else if (field === 'inProgress') count = sp.inProgressIssues;
      else if (field === 'toDo')  count = sp.todoIssues;
      else if (field === 'total') count = sp.totalIssues;
      else if (field === 'sp')    count = sp.doneSP;
      const total = field === 'sp' ? sp.totalSP : sp.totalIssues;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { name: p.podDisplayName, count, total, pct };
    })
    .sort((a, b) => b.count - a.count);

  const grandTotal = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {label} breakdown across all active sprints.
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>POD</Table.Th>
            <Table.Th ta="right">{field === 'sp' ? 'Done SP' : 'Issues'}</Table.Th>
            <Table.Th ta="right">% of Sprint</Table.Th>
            <Table.Th>Progress</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(r => (
            <Table.Tr key={r.name}>
              <Table.Td><Text size="sm" fw={500}>{r.name}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" fw={600}>{r.count}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" c="dimmed">{r.pct}%</Text></Table.Td>
              <Table.Td style={{ minWidth: 80 }}>
                <Progress value={r.pct} size="xs" radius="xl" color={AQUA} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Td><Text size="sm" fw={700}>Total</Text></Table.Td>
            <Table.Td ta="right"><Text size="sm" fw={700}>{grandTotal}</Text></Table.Td>
            <Table.Td /><Table.Td />
          </Table.Tr>
        </Table.Tfoot>
      </Table>
      <Button
        variant="light" size="xs" rightSection={<IconExternalLink size={12} />}
        onClick={onNavigate}
      >
        Open Sprint Backlog
      </Button>
    </Stack>
  );
}

// ── drawer: POD detail ────────────────────────────────────────────────────────

function PodDrawerContent({ pod, onNavigate }: { pod: PodMetrics; onNavigate: () => void }) {
  const sp = pod.activeSprint!;
  const workPct = sp.totalIssues > 0 ? Math.round((sp.doneIssues / sp.totalIssues) * 100) : 0;
  const timePct = sprintTimePct(sp.startDate, sp.endDate);

  const statusRows = Object.entries(pod.statusBreakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const typeRows   = Object.entries(pod.issueTypeBreakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const memberRows = Object.entries(pod.memberIssueCount ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const hourRows   = Object.entries(pod.hoursByMember ?? {}).sort((a, b) => b[1] - a[1]);

  const velocityData = (pod.velocity ?? []).slice(-6).map(v => ({
    name: v.sprintName.replace(/.*sprint\s*/i, 'S').slice(0, 10),
    committed: v.committedSP,
    completed: v.completedSP,
  }));

  return (
    <Stack gap="md">
      {/* Sprint summary */}
      <Paper withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Sprint</Text>
            <Text size="xs" fw={600}>{sp.name}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Dates</Text>
            <Text size="xs">{fmtDate(sp.startDate)} → {fmtDate(sp.endDate)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Story Points</Text>
            <Text size="xs" fw={600}>{sp.doneSP} / {sp.totalSP} SP done</Text>
          </Group>
          <Divider />
          <Group justify="space-between" mb={2}>
            <Text size="xs" c="dimmed">Work done</Text>
            <Text size="xs" fw={600}>{workPct}%</Text>
          </Group>
          <Progress value={workPct} size="sm" color={AQUA} radius="xl" />
          {timePct !== null && (
            <>
              <Group justify="space-between" mb={2}>
                <Text size="xs" c="dimmed">Time elapsed</Text>
                <Text size="xs" fw={600}>{timePct}%</Text>
              </Group>
              <Progress value={timePct} size="sm" color={DEEP_BLUE} radius="xl" />
            </>
          )}
        </Stack>
      </Paper>

      {/* Velocity history */}
      {velocityData.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">
            Velocity — Last {velocityData.length} Sprints
          </Text>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={velocityData} barSize={10}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <RechartsTooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(val: number, name: string) =>
                  [val, name === 'committed' ? 'Committed SP' : 'Completed SP']}
              />
              <Bar dataKey="committed" fill={`${DEEP_BLUE}55`} radius={[2, 2, 0, 0]} />
              <Bar dataKey="completed" fill={AQUA} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Group gap="md" justify="center" mt={4}>
            <Group gap={4}>
              <Box w={10} h={10} style={{ background: `${DEEP_BLUE}55`, borderRadius: 2 }} />
              <Text size="xs" c="dimmed">Committed</Text>
            </Group>
            <Group gap={4}>
              <Box w={10} h={10} style={{ background: AQUA, borderRadius: 2 }} />
              <Text size="xs" c="dimmed">Completed</Text>
            </Group>
          </Group>
        </Box>
      )}

      {/* Status breakdown */}
      {statusRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">By Status</Text>
          <Stack gap={6}>
            {statusRows.map(([status, count]) => {
              const pct = sp.totalIssues > 0 ? Math.round((count / sp.totalIssues) * 100) : 0;
              return (
                <Group key={status} justify="space-between" wrap="nowrap">
                  <Text size="xs" style={{ minWidth: 120 }} truncate>{status}</Text>
                  <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    <Progress value={pct} size="xs" radius="xl" style={{ flex: 1 }} color={AQUA} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{count}</Text>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Issue type breakdown */}
      {typeRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">By Issue Type</Text>
          <Stack gap={6}>
            {typeRows.map(([type, count]) => {
              const pct = sp.totalIssues > 0 ? Math.round((count / sp.totalIssues) * 100) : 0;
              return (
                <Group key={type} justify="space-between" wrap="nowrap">
                  <Badge size="xs" color={ISSUE_TYPE_COLOR[type] ?? 'gray'} variant="light" style={{ minWidth: 80 }}>
                    {type}
                  </Badge>
                  <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    <Progress value={pct} size="xs" radius="xl" style={{ flex: 1 }} color={ISSUE_TYPE_COLOR[type] ?? 'gray'} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{count}</Text>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Issues by member */}
      {memberRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">Issues by Member</Text>
          <Stack gap={4}>
            {memberRows.map(([name, count]) => {
              const pct = sp.totalIssues > 0 ? Math.round((count / sp.totalIssues) * 100) : 0;
              return (
                <Group key={name} justify="space-between" wrap="nowrap">
                  <Text size="xs" style={{ minWidth: 110 }} truncate>{name}</Text>
                  <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    <Progress value={pct} size="xs" radius="xl" style={{ flex: 1 }} color={AQUA} />
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{count}</Text>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Hours logged by member */}
      {hourRows.length > 0 && (
        <Box>
          <Text size="xs" fw={600} c={DEEP_BLUE} mb="xs">Hours Logged by Member</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member</Table.Th>
                <Table.Th ta="right">Hours</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {hourRows.map(([name, hrs]) => (
                <Table.Tr key={name}>
                  <Table.Td><Text size="xs">{name}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="xs" fw={600}>{hrs.toFixed(1)}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      <Divider />
      <Group>
        <Button variant="light" size="xs" rightSection={<IconExternalLink size={12} />} onClick={onNavigate}>
          Sprint Backlog
        </Button>
        <Button variant="subtle" size="xs" color="gray" rightSection={<IconExternalLink size={12} />}
          component="a" href="/delivery/jira">
          POD Dashboard
        </Button>
      </Group>
    </Stack>
  );
}

// ── drawer: priority detail ───────────────────────────────────────────────────

function PriorityDrawerContent({
  priority, activePods, onNavigate,
}: { priority: string; activePods: PodMetrics[]; onNavigate: () => void }) {
  const rows = activePods
    .map(p => {
      const count = p.priorityBreakdown?.[priority] ?? 0;
      const total = p.activeSprint?.totalIssues ?? 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { name: p.podDisplayName, count, pct };
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const grandTotal = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge size="sm" color={PRIORITY_COLOR[priority] ?? 'gray'} variant="light">
          {priority}
        </Badge>
        <Text size="sm" c="dimmed">{grandTotal} issues total across all PODs</Text>
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>POD</Table.Th>
            <Table.Th ta="right">Issues</Table.Th>
            <Table.Th ta="right">% of Sprint</Table.Th>
            <Table.Th>Share</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text size="sm" c="dimmed" ta="center" p="sm">No issues with this priority</Text>
              </Table.Td>
            </Table.Tr>
          ) : rows.map(r => (
            <Table.Tr key={r.name}>
              <Table.Td><Text size="sm" fw={500}>{r.name}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" fw={600}>{r.count}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" c="dimmed">{r.pct}%</Text></Table.Td>
              <Table.Td style={{ minWidth: 80 }}>
                <Progress
                  value={grandTotal > 0 ? Math.round((r.count / grandTotal) * 100) : 0}
                  size="xs" radius="xl" color={PRIORITY_COLOR[priority] ?? 'gray'}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Button
        variant="light" size="xs" rightSection={<IconExternalLink size={12} />}
        onClick={onNavigate}
      >
        Open Sprint Backlog
      </Button>
    </Stack>
  );
}

// ── drawer: issue type detail ─────────────────────────────────────────────────

function IssueTypeDrawerContent({
  issueType, activePods, onNavigate,
}: { issueType: string; activePods: PodMetrics[]; onNavigate: () => void }) {
  const rows = activePods
    .map(p => {
      const count = p.issueTypeBreakdown?.[issueType] ?? 0;
      const total = p.activeSprint?.totalIssues ?? 0;
      // Estimate done/inProgress for this type using same proportional approach
      const doneCount = Object.entries(p.statusBreakdown ?? {})
        .filter(([s]) => s.toLowerCase() === 'done')
        .reduce((s, [, v]) => s + v, 0);
      const ipCount = Object.entries(p.statusBreakdown ?? {})
        .filter(([s]) => /in progress|in dev|dev done/i.test(s))
        .reduce((s, [, v]) => s + v, 0);
      const share = total > 0 ? count / total : 0;
      const done = Math.round(doneCount * share);
      const inProgress = Math.round(ipCount * share);
      const pct = count > 0 ? Math.round((done / count) * 100) : 0;
      return { name: p.podDisplayName, count, done, inProgress, pct };
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const grandTotal = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge size="sm" color={ISSUE_TYPE_COLOR[issueType] ?? 'gray'} variant="light">
          {issueType}
        </Badge>
        <Text size="sm" c="dimmed">{grandTotal} issues across all PODs</Text>
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>POD</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
            <Table.Th ta="right">Done</Table.Th>
            <Table.Th ta="right">In Progress</Table.Th>
            <Table.Th>Completion</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed" ta="center" p="sm">No issues of this type found</Text>
              </Table.Td>
            </Table.Tr>
          ) : rows.map(r => (
            <Table.Tr key={r.name}>
              <Table.Td><Text size="sm" fw={500}>{r.name}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" fw={600}>{r.count}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" c="green">{r.done}</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" c="blue">{r.inProgress}</Text></Table.Td>
              <Table.Td style={{ minWidth: 100 }}>
                <Group gap={6} wrap="nowrap">
                  <Progress
                    value={r.pct} size="xs" radius="xl" style={{ flex: 1 }}
                    color={ISSUE_TYPE_COLOR[issueType] ?? 'gray'}
                  />
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{r.pct}%</Text>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        {rows.length > 0 && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Td><Text size="sm" fw={700}>Total</Text></Table.Td>
              <Table.Td ta="right"><Text size="sm" fw={700}>{grandTotal}</Text></Table.Td>
              <Table.Td ta="right">
                <Text size="sm" fw={700} c="green">
                  {rows.reduce((s, r) => s + r.done, 0)}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" fw={700} c="blue">
                  {rows.reduce((s, r) => s + r.inProgress, 0)}
                </Text>
              </Table.Td>
              <Table.Td />
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
      <Button
        variant="light" size="xs" rightSection={<IconExternalLink size={12} />}
        onClick={onNavigate}
      >
        Open Sprint Backlog
      </Button>
    </Stack>
  );
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const navigate = useNavigate();
  const { data: pods = [], isLoading: podsLoading, error: podsError } = useJiraPods();
  const { data: releases = [] } = useReleases();

  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

  // ── Countdowns ────────────────────────────────────────────────────────────
  const countdowns = useMemo(() => {
    const now = Date.now();
    return releases
      .filter(r => new Date(r.releaseDate).getTime() > now - 7 * 86400_000)
      .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime())
      .slice(0, 3)
      .flatMap(r => {
        const items = [];
        const cfDays = daysUntil(r.codeFreezeDate);
        const relDays = daysUntil(r.releaseDate);
        if (cfDays !== null && cfDays >= 0 && cfDays <= 30)
          items.push({ label: `${r.name} — Code Freeze`, days: cfDays, type: 'freeze' as const });
        if (relDays !== null && relDays >= 0 && relDays <= 30)
          items.push({ label: `${r.name} — Release`, days: relDays, type: 'release' as const });
        return items;
      })
      .slice(0, 4);
  }, [releases]);

  // ── Aggregated KPIs ───────────────────────────────────────────────────────
  const activePods = useMemo(
    () => pods.filter(p => p.activeSprint !== null && !p.errorMessage),
    [pods],
  );

  const kpis = useMemo(() => {
    const total      = activePods.reduce((s, p) => s + (p.activeSprint?.totalIssues ?? 0), 0);
    const done       = activePods.reduce((s, p) => s + (p.activeSprint?.doneIssues ?? 0), 0);
    const inProgress = activePods.reduce((s, p) => s + (p.activeSprint?.inProgressIssues ?? 0), 0);
    const toDo       = activePods.reduce((s, p) => s + (p.activeSprint?.todoIssues ?? 0), 0);
    const totalSP    = activePods.reduce((s, p) => s + (p.activeSprint?.totalSP ?? 0), 0);
    const doneSP     = activePods.reduce((s, p) => s + (p.activeSprint?.doneSP ?? 0), 0);
    return { total, done, inProgress, toDo, totalSP, doneSP };
  }, [activePods]);

  // ── Per-POD cards ─────────────────────────────────────────────────────────
  const podCards = useMemo(
    () => activePods.map(p => ({
      pod: p,
      workPct: p.activeSprint!.totalIssues > 0
        ? Math.round((p.activeSprint!.doneIssues / p.activeSprint!.totalIssues) * 100) : 0,
      timePct: sprintTimePct(p.activeSprint!.startDate, p.activeSprint!.endDate),
    })),
    [activePods],
  );

  // ── Priority rows ─────────────────────────────────────────────────────────
  const priorityRows = useMemo(() => {
    const agg: Record<string, { done: number; inProgress: number; total: number }> = {};
    for (const p of activePods) {
      const doneCount = Object.entries(p.statusBreakdown ?? {})
        .filter(([s]) => s.toLowerCase() === 'done')
        .reduce((s, [, v]) => s + v, 0);
      const ipCount = Object.entries(p.statusBreakdown ?? {})
        .filter(([s]) => /in progress|in dev|dev done/i.test(s))
        .reduce((s, [, v]) => s + v, 0);
      const total = p.activeSprint?.totalIssues ?? 0;

      for (const [priority, count] of Object.entries(p.priorityBreakdown ?? {})) {
        if (!agg[priority]) agg[priority] = { done: 0, inProgress: 0, total: 0 };
        agg[priority].total += count;
        if (total > 0) {
          const share = count / total;
          agg[priority].done += Math.round(doneCount * share);
          agg[priority].inProgress += Math.round(ipCount * share);
        }
      }
    }
    return PRIORITY_ORDER.filter(p => agg[p]).map(p => ({ priority: p, ...agg[p] }));
  }, [activePods]);

  // ── Issue type rows ───────────────────────────────────────────────────────
  const issueTypeRows = useMemo(() => {
    const agg: Record<string, { done: number; inProgress: number; total: number }> = {};
    for (const p of activePods) {
      const doneCount = Object.entries(p.statusBreakdown ?? {})
        .filter(([s]) => s.toLowerCase() === 'done')
        .reduce((s, [, v]) => s + v, 0);
      const ipCount = Object.entries(p.statusBreakdown ?? {})
        .filter(([s]) => /in progress|in dev|dev done/i.test(s))
        .reduce((s, [, v]) => s + v, 0);
      const total = p.activeSprint?.totalIssues ?? 0;

      for (const [issueType, count] of Object.entries(p.issueTypeBreakdown ?? {})) {
        if (!agg[issueType]) agg[issueType] = { done: 0, inProgress: 0, total: 0 };
        agg[issueType].total += count;
        if (total > 0) {
          const share = count / total;
          agg[issueType].done += Math.round(doneCount * share);
          agg[issueType].inProgress += Math.round(ipCount * share);
        }
      }
    }
    // Sort: known types first in preferred order, then any others alphabetically
    const known = ISSUE_TYPE_ORDER.filter(t => agg[t]);
    const others = Object.keys(agg)
      .filter(t => !ISSUE_TYPE_ORDER.includes(t))
      .sort();
    return [...known, ...others].map(t => ({ issueType: t, ...agg[t] }));
  }, [activePods]);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const drawerTitle =
    drawerContent?.type === 'pod'       ? drawerContent.pod.podDisplayName :
    drawerContent?.type === 'kpi'       ? drawerContent.label :
    drawerContent?.type === 'priority'  ? `${drawerContent.priority} Priority Issues` :
    drawerContent?.type === 'issuetype' ? `${drawerContent.issueType} — by POD` : '';

  if (podsError) {
    return (
      <Alert icon={<IconAlertTriangle size={14} />} color="red" mt="md">
        Failed to load sprint data from Jira. Check your Jira credentials.
      </Alert>
    );
  }

  return (
    <>
      <Stack gap="lg" pb="xl">
        {/* ── Countdown banners ─────────────────────────────────────────── */}
        {countdowns.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {countdowns.map((c, i) => (
              <CountdownBanner
                key={i}
                label={c.label}
                days={c.days}
                color={AQUA}
                icon={c.type === 'freeze' ? <IconSnowflake size={14} /> : <IconRocket size={14} />}
                onClick={() => navigate('/delivery/releases')}
              />
            ))}
          </SimpleGrid>
        )}

        {/* ── KPI row ────────────────────────────────────────────────────── */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          <KpiCard label="Total Issues"  value={kpis.total}      icon={<IconListCheck size={16} />}  color="blue"
            onClick={() => setDrawerContent({ type: 'kpi', label: 'Total Issues', field: 'total' })} />
          <KpiCard label="Done"          value={kpis.done}       icon={<IconCheckbox size={16} />}   color="green"
            sub={kpis.total > 0 ? `${Math.round((kpis.done / kpis.total) * 100)}%` : undefined}
            onClick={() => setDrawerContent({ type: 'kpi', label: 'Done Issues', field: 'done' })} />
          <KpiCard label="In Progress"   value={kpis.inProgress} icon={<IconCircleDot size={16} />}  color="teal"
            onClick={() => setDrawerContent({ type: 'kpi', label: 'In Progress', field: 'inProgress' })} />
          <KpiCard label="To Do"         value={kpis.toDo}       icon={<IconClock size={16} />}       color="gray"
            onClick={() => setDrawerContent({ type: 'kpi', label: 'To Do Issues', field: 'toDo' })} />
          <KpiCard label="Story Points"  value={`${kpis.doneSP} / ${kpis.totalSP}`}
            icon={<IconTrendingUp size={16} />} color="violet" sub="done / total"
            onClick={() => setDrawerContent({ type: 'kpi', label: 'Story Points', field: 'sp' })} />
          <KpiCard label="Active PODs"   value={activePods.length} icon={<IconUsersGroup size={16} />} color="cyan" />
        </SimpleGrid>

        {/* ── Per-POD sprint health cards ─────────────────────────────────── */}
        {activePods.length === 0 && !podsLoading ? (
          <Alert icon={<IconAlertTriangle size={14} />} color="yellow">
            No active sprints found. Make sure your Jira boards are synced and have active sprints.
          </Alert>
        ) : (
          <>
            <Box>
              <Text size="sm" fw={600} c={DEEP_BLUE} mb={4}>Sprint Health by POD</Text>
              <Text size="xs" mb="md" style={{ color: TEXT_SECONDARY }}>
                Work % vs Time % — click a card for full sprint breakdown.
              </Text>
            </Box>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {podCards.map(({ pod, workPct, timePct }) => (
                <PodSprintCard
                  key={pod.podId ?? pod.podDisplayName}
                  pod={pod}
                  workPct={workPct}
                  timePct={timePct}
                  onClick={() => setDrawerContent({ type: 'pod', pod })}
                />
              ))}
            </SimpleGrid>
          </>
        )}

        {/* ── Teams side-by-side summary ──────────────────────────────────── */}
        {activePods.length > 1 && (
          <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
            <Box p="sm" style={{ borderBottom: `1px solid ${BORDER_DEFAULT}` }}>
              <Text size="sm" fw={600} c={DEEP_BLUE}>All Teams — Side-by-Side</Text>
              <Text size="xs" c="dimmed" mt={2}>Click a row for velocity history, member breakdown, and hours logged.</Text>
            </Box>
            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover style={{ minWidth: 700 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>POD</Table.Th>
                    <Table.Th>Sprint</Table.Th>
                    <Table.Th ta="center">Work %</Table.Th>
                    <Table.Th ta="center">Time %</Table.Th>
                    <Table.Th ta="center">Gap</Table.Th>
                    <Table.Th ta="center">Issues</Table.Th>
                    <Table.Th ta="center">SP Done</Table.Th>
                    <Table.Th ta="center">Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {podCards.map(({ pod, workPct, timePct }) => {
                    const gap    = timePct !== null ? workPct - timePct : null;
                    const health = gap === null ? 'on-track' : gap >= 5 ? 'ahead' : gap <= -10 ? 'behind' : 'on-track';
                    const sp     = pod.activeSprint!;
                    return (
                      <Table.Tr key={pod.podId ?? pod.podDisplayName} style={{ cursor: 'pointer' }}
                        onClick={() => setDrawerContent({ type: 'pod', pod })}>
                        <Table.Td><Text size="sm" fw={600}>{pod.podDisplayName}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed" truncate style={{ maxWidth: 160 }}>{sp.name}</Text></Table.Td>
                        <Table.Td ta="center"><Text size="sm" fw={600}>{workPct}%</Text></Table.Td>
                        <Table.Td ta="center"><Text size="sm" c="dimmed">{timePct !== null ? `${timePct}%` : '—'}</Text></Table.Td>
                        <Table.Td ta="center">
                          {gap !== null
                            ? <Text size="sm" fw={600} c={gap >= 0 ? 'green' : 'red'}>{gap >= 0 ? `+${gap}%` : `${gap}%`}</Text>
                            : <Text size="sm" c="dimmed">—</Text>}
                        </Table.Td>
                        <Table.Td ta="center"><Text size="xs" c="dimmed">{sp.doneIssues} / {sp.totalIssues}</Text></Table.Td>
                        <Table.Td ta="center"><Text size="xs" c="dimmed">{sp.doneSP} / {sp.totalSP}</Text></Table.Td>
                        <Table.Td ta="center">
                          <Badge size="xs" variant="light"
                            color={health === 'ahead' ? 'green' : health === 'behind' ? 'red' : 'yellow'}>
                            {health === 'ahead' ? 'Ahead' : health === 'behind' ? 'Behind' : 'On Track'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        )}

        {/* ── Priority breakdown ──────────────────────────────────────────── */}
        <PriorityTable
          rows={priorityRows}
          onRowClick={priority => setDrawerContent({ type: 'priority', priority })}
        />

        {/* ── Issue type breakdown ────────────────────────────────────────── */}
        <IssueTypeTable
          rows={issueTypeRows}
          onRowClick={issueType => setDrawerContent({ type: 'issuetype', issueType })}
        />
      </Stack>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      <Drawer
        opened={drawerContent !== null}
        onClose={() => setDrawerContent(null)}
        position="right"
        size="md"
        title={
          <Text size="sm" fw={700} c={DEEP_BLUE}>{drawerTitle}</Text>
        }
        padding="lg"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {drawerContent?.type === 'kpi' && (
          <KpiDrawerContent
            label={drawerContent.label}
            field={drawerContent.field}
            activePods={activePods}
            onNavigate={() => { setDrawerContent(null); navigate('/sprint-backlog'); }}
          />
        )}
        {drawerContent?.type === 'pod' && (
          <PodDrawerContent
            pod={drawerContent.pod}
            onNavigate={() => { setDrawerContent(null); navigate('/sprint-backlog'); }}
          />
        )}
        {drawerContent?.type === 'priority' && (
          <PriorityDrawerContent
            priority={drawerContent.priority}
            activePods={activePods}
            onNavigate={() => { setDrawerContent(null); navigate('/sprint-backlog'); }}
          />
        )}
        {drawerContent?.type === 'issuetype' && (
          <IssueTypeDrawerContent
            issueType={drawerContent.issueType}
            activePods={activePods}
            onNavigate={() => { setDrawerContent(null); navigate('/sprint-backlog'); }}
          />
        )}
      </Drawer>
    </>
  );
}

// ── Support Tab ───────────────────────────────────────────────────────────────

const PRIORITY_COLORS_SUPPORT: Record<string, string> = {
  Critical: '#f03e3e', Blocker: '#f03e3e', Highest: '#f03e3e',
  High: '#fd7e14',
  Medium: '#fab005',
  Low: '#74c0fc',
  Lowest: '#adb5bd',
};

const SLA_DAYS: Record<string, number> = {
  Critical: 1, Blocker: 1, Highest: 1, High: 3, Medium: 7, Low: 14, Lowest: 14,
};

function ageDaysSupport(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function slaStatus(ticket: SupportTicket): 'breached' | 'at_risk' | 'ok' {
  const threshold = SLA_DAYS[ticket.priority ?? ''] ?? 7;
  const age = ageDaysSupport(ticket.created);
  if (age >= threshold) return 'breached';
  if (age >= threshold * 0.7) return 'at_risk';
  return 'ok';
}

const SLA_LABEL = { breached: 'SLA Breached', at_risk: 'At Risk', ok: 'OK' };

// KPI filter type for support tab
type SupportKpiFilter = 'ALL' | 'OPEN' | 'STALE' | 'BREACHED';

function SupportTab() {
  const { data: snapshot, isLoading: snapLoading } = useSupportSnapshot();
  const { data: history } = useSupportHistory(30);
  const { data: throughput } = useSupportMonthlyThroughput(6);
  const { data: jiraStatus } = useJiraStatus();
  const jiraBase = jiraStatus?.baseUrl ?? '';

  const [boardFilter, setBoardFilter] = useState<string>('ALL');
  const [kpiFilter, setKpiFilter] = useState<SupportKpiFilter>('ALL');

  const allTickets: (SupportTicket & { boardName: string })[] = useMemo(() => {
    if (!snapshot?.boards) return [];
    return snapshot.boards.flatMap(b =>
      (b.tickets ?? []).map(t => ({ ...t, boardName: b.boardName }))
    );
  }, [snapshot]);

  // Board-filtered base (used for KPI counts and charts)
  const boardFiltered = useMemo(() =>
    boardFilter === 'ALL' ? allTickets : allTickets.filter(t => t.boardName === boardFilter),
    [allTickets, boardFilter]
  );

  // KPI counts always reflect board filter only
  const openCount    = boardFiltered.filter(t => t.statusCategory !== 'done').length;
  const staleCount   = boardFiltered.filter(t => t.stale).length;
  const breachedCount = boardFiltered.filter(t => slaStatus(t) === 'breached').length;
  const avgAge = boardFiltered.length > 0
    ? Math.round(boardFiltered.reduce((s, t) => s + ageDaysSupport(t.created), 0) / boardFiltered.length)
    : 0;

  // Table-filtered: apply board + KPI filter
  const filteredTickets = useMemo(() => {
    return boardFiltered.filter(t => {
      if (kpiFilter === 'OPEN')     return t.statusCategory !== 'done';
      if (kpiFilter === 'STALE')    return t.stale;
      if (kpiFilter === 'BREACHED') return slaStatus(t) === 'breached';
      return true;
    });
  }, [boardFiltered, kpiFilter]);

  const boardNames = useMemo(() =>
    Array.from(new Set((snapshot?.boards ?? []).map(b => b.boardName))),
    [snapshot]
  );
  const boardOptions = [{ value: 'ALL', label: 'All Boards' }, ...boardNames.map(n => ({ value: n, label: n }))];

  const trendData = useMemo(() => {
    if (!history?.length) return [];
    const byDate: Record<string, { open: number; stale: number }> = {};
    history.forEach(b =>
      b.history.forEach(pt => {
        if (!byDate[pt.date]) byDate[pt.date] = { open: 0, stale: 0 };
        byDate[pt.date].open  += pt.openCount;
        byDate[pt.date].stale += pt.staleCount;
      })
    );
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        Open: v.open,
        Stale: v.stale,
      }));
  }, [history]);

  const throughputData = useMemo(() => {
    if (!throughput?.length) return [];
    const byMonth: Record<string, { created: number; closed: number }> = {};
    throughput.forEach(b =>
      b.months.forEach(pt => {
        if (!byMonth[pt.month]) byMonth[pt.month] = { created: 0, closed: 0 };
        byMonth[pt.month].created += pt.created;
        byMonth[pt.month].closed  += pt.closed;
      })
    );
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: new Date(month + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        Created: v.created,
        Closed: v.closed,
      }));
  }, [throughput]);

  if (snapLoading) {
    return (
      <Stack align="center" justify="center" h={260}>
        <Text c="dimmed" size="sm">Loading support data…</Text>
      </Stack>
    );
  }

  if (!snapshot?.boards?.length) {
    return (
      <Alert color="blue" title="No support boards configured" mt="md">
        Configure support boards in Settings → Jira Support to see queue data here.
      </Alert>
    );
  }

  // KPI card helper
  const kpiCard = (
    id: SupportKpiFilter,
    label: string,
    value: number,
    sub: string,
    activeColor: string,
    warnWhen: boolean,
  ) => {
    const active = kpiFilter === id;
    return (
      <Paper
        withBorder p="md" radius="md"
        onClick={() => setKpiFilter(active ? 'ALL' : id)}
        style={{
          cursor: 'pointer',
          borderColor: active ? activeColor : undefined,
          borderWidth: active ? 2 : 1,
          boxShadow: active ? `0 0 0 1px ${activeColor}33` : undefined,
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}
      >
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>{label}</Text>
        <Text fw={800} size="xl" mt={4} c={warnWhen ? activeColor : DEEP_BLUE}>{value}</Text>
        <Text size="xs" c="dimmed" mt={2}>{sub}</Text>
        {active && (
          <Text size="xs" mt={4} fw={600} c={activeColor}>● Filtering</Text>
        )}
      </Paper>
    );
  };

  return (
    <Stack gap="lg">
      {/* Board filter — top of page */}
      <Group gap="sm" align="center">
        <Text size="sm" fw={500} c="dimmed">Board:</Text>
        {boardOptions.map(o => (
          <Badge
            key={o.value}
            variant={boardFilter === o.value ? 'filled' : 'outline'}
            color={boardFilter === o.value ? 'blue' : 'gray'}
            style={{ cursor: 'pointer' }}
            onClick={() => setBoardFilter(o.value)}
          >
            {o.label}
          </Badge>
        ))}
        {kpiFilter !== 'ALL' && (
          <Badge
            variant="light" color="orange" style={{ cursor: 'pointer' }}
            onClick={() => setKpiFilter('ALL')}
          >
            ✕ Clear filter
          </Badge>
        )}
      </Group>

      {/* KPI cards — clickable to filter table */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        {kpiCard('OPEN',     'Open Tickets', openCount,     'click to filter',  '#228be6', false)}
        {kpiCard('STALE',    'Stale',        staleCount,    'no update recently','#fd7e14', staleCount > 0)}
        {kpiCard('BREACHED', 'SLA Breached', breachedCount, 'past threshold',   '#f03e3e', breachedCount > 0)}
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Avg Age</Text>
          <Text fw={800} size="xl" mt={4} c={avgAge > 7 ? '#fd7e14' : DEEP_BLUE}>{avgAge}d</Text>
          <Text size="xs" c="dimmed" mt={2}>per ticket</Text>
        </Paper>
      </SimpleGrid>

      {/* Charts */}
      {(trendData.length > 0 || throughputData.length > 0) && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {trendData.length > 0 && (
            <Paper withBorder p="md" radius="md">
              <Text size="sm" fw={600} mb="sm">Open & Stale Trend (30d)</Text>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Open" stroke={AQUA} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Stale" stroke="#fd7e14" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}
          {throughputData.length > 0 && (
            <Paper withBorder p="md" radius="md">
              <Text size="sm" fw={600} mb="sm">Monthly Throughput (6mo)</Text>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Created" fill="#74c0fc" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Closed" fill="#40c057" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}
        </SimpleGrid>
      )}

      {/* Ticket table */}
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm">
          <Text size="sm" fw={600}>
            Live Queue
            {kpiFilter !== 'ALL' && (
              <Text component="span" size="xs" c="dimmed" ml="xs">
                — {kpiFilter === 'OPEN' ? 'Open' : kpiFilter === 'STALE' ? 'Stale' : 'SLA Breached'}
              </Text>
            )}
          </Text>
          <Text size="xs" c="dimmed">
            {filteredTickets.length} tickets · {snapshot?.fetchedAt
              ? new Date(snapshot.fetchedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </Text>
        </Group>
        <ScrollArea>
          <Table striped highlightOnHover style={{ tableLayout: 'fixed', minWidth: 700 }}>
            <colgroup>
              <col style={{ width: 110 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 55 }} />
              <col style={{ width: 105 }} />
            </colgroup>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Key</Table.Th>
                <Table.Th>Summary</Table.Th>
                <Table.Th>Assignee</Table.Th>
                <Table.Th>Priority</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Age</Table.Th>
                <Table.Th>SLA</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredTickets.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text size="sm" c="dimmed" ta="center" p="sm">No tickets match the current filter</Text>
                  </Table.Td>
                </Table.Tr>
              ) : filteredTickets.map(t => {
                const sla = slaStatus(t);
                const age = ageDaysSupport(t.created);
                return (
                  <Table.Tr
                    key={`${t.boardName}-${t.key}`}
                    style={t.stale ? { backgroundColor: 'rgba(253,126,20,0.06)' } : undefined}
                  >
                    {/* Key — Jira link */}
                    <Table.Td style={{ overflow: 'hidden' }}>
                      {jiraBase ? (
                        <a
                          href={`${jiraBase}/browse/${t.key}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, fontFamily: 'monospace', color: AQUA, fontWeight: 600, textDecoration: 'none' }}
                        >
                          {t.key}
                        </a>
                      ) : (
                        <Text size="xs" ff="monospace">{t.key}</Text>
                      )}
                    </Table.Td>

                    {/* Summary — hover for full text */}
                    <Table.Td style={{ overflow: 'hidden' }}>
                      <Tooltip label={t.summary} openDelay={300} withArrow multiline maw={400}>
                        <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.summary}
                        </Text>
                      </Tooltip>
                    </Table.Td>

                    {/* Assignee — avatar + name */}
                    <Table.Td style={{ overflow: 'hidden' }}>
                      {t.assignee ? (
                        <Tooltip label={t.assignee} openDelay={300} withArrow>
                          <Group gap={6} wrap="nowrap" style={{ overflow: 'hidden' }}>
                            {t.assigneeAvatarUrl ? (
                              <img
                                src={t.assigneeAvatarUrl}
                                alt={t.assignee}
                                style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                background: AQUA + '33', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 9, fontWeight: 700, color: AQUA,
                              }}>
                                {t.assignee.split(' ').map(w => w[0]).slice(0, 2).join('')}
                              </div>
                            )}
                            <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.assignee}
                            </Text>
                          </Group>
                        </Tooltip>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>

                    {/* Priority */}
                    <Table.Td>
                      <Badge
                        size="xs"
                        variant="light"
                        style={{
                          backgroundColor: (PRIORITY_COLORS_SUPPORT[t.priority ?? ''] ?? '#adb5bd') + '22',
                          color: PRIORITY_COLORS_SUPPORT[t.priority ?? ''] ?? '#adb5bd',
                          border: 'none',
                        }}
                      >
                        {t.priority ?? '—'}
                      </Badge>
                    </Table.Td>

                    {/* Status — tooltip for overflow */}
                    <Table.Td style={{ overflow: 'hidden' }}>
                      <Tooltip label={t.status ?? '—'} openDelay={300} withArrow>
                        <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.status ?? '—'}
                        </Text>
                      </Tooltip>
                    </Table.Td>

                    {/* Age */}
                    <Table.Td ta="right">
                      <Text size="xs" fw={age > 7 ? 600 : 400} c={age > 7 ? '#fd7e14' : undefined}>
                        {age}d
                      </Text>
                    </Table.Td>

                    {/* SLA */}
                    <Table.Td>
                      <Badge size="xs" variant="dot" color={sla === 'breached' ? 'red' : sla === 'at_risk' ? 'orange' : 'green'}>
                        {SLA_LABEL[sla]}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ── Embeddable content (used by EngineeringAnalyticsPage) ────────────────────

const TABS = [
  { value: 'dashboard',  label: 'Dashboard',  icon: <IconRocket size={14} /> },
  { value: 'violations', label: 'Violations', icon: <IconAlertTriangle size={14} /> },
  { value: 'support',    label: 'Support',    icon: <IconHeadset size={14} /> },
];

/** Embeddable — renders the Command Center tabs without the PPPageLayout shell.
 *  Used by EngineeringAnalyticsPage as a nested tab. */
export function SprintCommandCenterContent({
  projectKey = null,
  days = 90,
  avatars = {},
}: {
  projectKey?: string | null;
  days?: number;
  avatars?: Record<string, string>;
}) {
  const [tab, setTab] = useState('dashboard');

  const CONTENT_TABS = [
    ...TABS,
    { value: 'efficiency', label: 'Efficiency', icon: <IconClock size={14} /> },
  ];

  return (
    <Tabs value={tab} onChange={v => setTab(v ?? 'dashboard')} variant="outline" keepMounted={false}>
      <Tabs.List>
        {CONTENT_TABS.map(t => (
          <Tabs.Tab key={t.value} value={t.value} leftSection={t.icon}>{t.label}</Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value="dashboard"  pt="lg"><DashboardTab /></Tabs.Panel>
      <Tabs.Panel value="violations" pt="lg"><SprintViolationsTab /></Tabs.Panel>
      <Tabs.Panel value="support"    pt="lg"><SupportTab /></Tabs.Panel>
      <Tabs.Panel value="efficiency" pt="lg"><EfficiencyTab projectKey={projectKey} days={days} avatars={avatars} /></Tabs.Panel>
    </Tabs>
  );
}

export default function SprintCommandCenterPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'dashboard';

  return (
    <PPPageLayout
      title="Sprint / Release Command Center"
      subtitle="Live sprint health, delivery pace, and release readiness across all PODs"
      tabs={TABS}
      activeTab={tab}
      onTabChange={v => setParams({ tab: v })}
      breadcrumbs={[
        { label: 'Delivery' },
        { label: 'Sprint Command Center' },
      ]}
    >
      {tab === 'dashboard'  && <DashboardTab />}
      {tab === 'violations' && <SprintViolationsTab />}
      {tab === 'support'    && <SupportTab />}
    </PPPageLayout>
  );
}
