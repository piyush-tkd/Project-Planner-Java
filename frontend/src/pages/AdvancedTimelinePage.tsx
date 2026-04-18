/**
 * AdvancedTimelinePage — critical path, baseline comparison, and milestones.
 *
 * Tabs:
 *  1. Timeline  — SVG Gantt with critical-path highlighting + baseline ghost bars
 *  2. Baselines — per-project baseline vs. actual comparison table
 *  3. Milestones — milestone projects with snap-baseline controls
 */
import { useState, useMemo } from 'react';
import {
  Text, Stack, Group, Button, Paper, Badge, Select, Tabs,
  Table, ScrollArea, ThemeIcon, Tooltip, ActionIcon, Modal, TextInput,
  Skeleton, Divider, SimpleGrid, Alert,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { notifications } from '@mantine/notifications';
import {
  IconLayoutBoard, IconFlag, IconHistory, IconCheck, IconPlus,
  IconTrash, IconAlertTriangle, IconZoomIn, IconZoomOut,
  IconTarget, IconLock,
} from '@tabler/icons-react';
import { useProjects } from '../api/projects';
import {
  useProjectBaselines, useSnapBaseline, useDeleteBaseline,
  ProjectBaseline,
} from '../api/projectBaselines';
import { AQUA, COLOR_ERROR, COLOR_ORANGE_DARK, COLOR_SUCCESS, FONT_FAMILY, GRAY_100, GRAY_BORDER, TEXT_DIM} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import type { ProjectResponse } from '../types/project';

// ── Helpers ───────────────────────────────────────────────────────────────

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  const d = parseDate(s);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

// @ts-expect-error -- unused
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: AQUA, NOT_STARTED: TEXT_DIM, ON_HOLD: '#f59f00',
  COMPLETED: COLOR_SUCCESS, CANCELLED: COLOR_ERROR,
};

// ── Critical path computation ─────────────────────────────────────────────
// Traverse the blockedById chain, returning IDs on the longest dependency path.

function computeCriticalPath(projects: ProjectResponse[]): Set<number> {
  const byId = new Map(projects.map(p => [p.id, p]));

  // Build forward adjacency: blocker → blocked list
  const blockedBy = new Map<number, number>(); // child → parent
  for (const p of projects) {
    if (p.blockedById) blockedBy.set(p.id, p.blockedById);
  }

  // DFS: total days in chain starting at p (following blockedById as prerequisites)
  const memo = new Map<number, number>();
  function chainDays(id: number): number {
    if (memo.has(id)) return memo.get(id)!;
    const p = byId.get(id);
    if (!p) return 0;
    const s = parseDate(p.startDate);
    const t = parseDate(p.targetDate);
    const own = s && t ? daysBetween(s, t) : (p.durationMonths || 1) * 30;
    const parentId = blockedBy.get(id);
    const total = own + (parentId ? chainDays(parentId) : 0);
    memo.set(id, total);
    return total;
  }

  // Find maximum chain length
  let maxLen = 0;
  for (const p of projects) {
    const l = chainDays(p.id);
    if (l > maxLen) maxLen = l;
  }

  // All projects on chains with length >= 80% of max are "critical"
  const threshold = maxLen * 0.8;
  const critical = new Set<number>();
  for (const p of projects) {
    if (chainDays(p.id) >= threshold && maxLen > 0) critical.add(p.id);
  }
  return critical;
}

// ── GANTT ROW ─────────────────────────────────────────────────────────────

interface GanttRowProps {
  project: ProjectResponse;
  baseline?: ProjectBaseline;
  isCritical: boolean;
  minDate: Date;
  totalDays: number;
  rowHeight: number;
  width: number;
  isDark: boolean;
}

function GanttRow({ project, baseline, isCritical, minDate, totalDays, rowHeight, width, isDark }: GanttRowProps) {
  const [hovered, setHovered] = useState(false);
  const s = parseDate(project.startDate);
  const t = parseDate(project.targetDate);
  if (!s || !t || totalDays === 0) return null;

  const x1 = (daysBetween(minDate, s) / totalDays) * width;
  const x2 = (daysBetween(minDate, t) / totalDays) * width;
  const barW = Math.max(x2 - x1, 6);

  const color = isCritical ? '#f59f00' : (STATUS_COLOR[project.status] ?? AQUA);
  const opacity = project.status === 'CANCELLED' ? 0.4 : 1;

  // Baseline ghost bar
  const bs = parseDate(baseline?.plannedStart);
  const bt = parseDate(baseline?.plannedTarget);
  const bx1 = bs ? (daysBetween(minDate, bs) / totalDays) * width : null;
  const bx2 = bt ? (daysBetween(minDate, bt) / totalDays) * width : null;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* baseline ghost */}
      {bx1 !== null && bx2 !== null && (
        <rect
          x={bx1} y={rowHeight * 0.35}
          width={Math.max(bx2 - bx1, 4)} height={rowHeight * 0.12}
          rx={3} ry={3}
          fill={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}
          stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
          strokeWidth={1}
          strokeDasharray="3,2"
        />
      )}
      {/* actual bar */}
      <rect
        x={x1} y={rowHeight * 0.2}
        width={barW} height={rowHeight * 0.6}
        rx={4} ry={4}
        fill={color}
        opacity={opacity}
        stroke={isCritical ? COLOR_ORANGE_DARK : 'transparent'}
        strokeWidth={isCritical ? 1.5 : 0}
      />
      {/* label inside bar */}
      {barW > 60 && (
        <text
          x={x1 + 6} y={rowHeight * 0.57}
          fill={isCritical ? '#1a1a1a' : '#fff'}
          fontSize={10}
          fontFamily={FONT_FAMILY}
          clipPath={`inset(0 0 0 0)`}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {project.name.length > 28 ? project.name.slice(0, 26) + '…' : project.name}
        </text>
      )}
      {/* hover tooltip bg */}
      {hovered && (
        <>
          <rect x={x1} y={-2} width={Math.max(barW, 180)} height={rowHeight + 4}
            fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} rx={4} />
        </>
      )}
    </g>
  );
}

// ── TIMELINE TAB ──────────────────────────────────────────────────────────

function TimelineTab({ projects, isDark }: { projects: ProjectResponse[]; isDark: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const criticalSet = useMemo(() => computeCriticalPath(projects), [projects]);

  const filtered = useMemo(() =>
    projects.filter(p => {
      if (filterStatus && p.status !== filterStatus) return false;
      return parseDate(p.startDate) && parseDate(p.targetDate);
    }),
  [projects, filterStatus]);

  // Date range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const dates = filtered.flatMap(p => [parseDate(p.startDate), parseDate(p.targetDate)]).filter(Boolean) as Date[];
    if (dates.length === 0) return { minDate: new Date(), maxDate: new Date(), totalDays: 0 };
    const mn = new Date(Math.min(...dates.map(d => d.getTime())));
    const mx = new Date(Math.max(...dates.map(d => d.getTime())));
    mn.setDate(mn.getDate() - 7); mx.setDate(mx.getDate() + 14);
    return { minDate: mn, maxDate: mx, totalDays: daysBetween(mn, mx) };
  }, [filtered]);

  const ROW_H = 36;
  const LABEL_W = 200;
  const CHART_W = Math.round(900 * zoom);
  const CHART_H = Math.max(filtered.length * ROW_H + 40, 120);

  // Month tick marks
  const ticks = useMemo(() => {
    const result: { label: string; x: number }[] = [];
    if (totalDays === 0) return result;
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const x = (daysBetween(minDate, cur) / totalDays) * CHART_W;
      result.push({
        label: cur.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        x,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate, totalDays, CHART_W]);

  const axisColor = isDark ? 'rgba(255,255,255,0.12)' : GRAY_BORDER;
  const textColor = isDark ? 'rgba(255,255,255,0.45)' : TEXT_DIM;
  const bgColor   = isDark ? 'var(--mantine-color-dark-7)' : '#fff';

  if (filtered.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<IconLayoutBoard size={16} />} radius="sm">
        No projects with both start and target dates. Set dates on your projects to see the timeline.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Select
            placeholder="All statuses"
            clearable
            size="xs"
            data={['ACTIVE','NOT_STARTED','ON_HOLD','COMPLETED','CANCELLED']}
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 160 }}
          />
          <Badge size="sm" color="orange" variant="light">
            {criticalSet.size} critical-path project{criticalSet.size !== 1 ? 's' : ''}
          </Badge>
        </Group>
        <Group gap={4}>
          <ActionIcon size="sm" variant="light" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
      aria-label="Zoom"
    >
            <IconZoomOut size={14} />
          </ActionIcon>
          <Text size="xs" c="dimmed">{Math.round(zoom * 100)}%</Text>
          <ActionIcon size="sm" variant="light" onClick={() => setZoom(z => Math.min(3, z + 0.25))}
      aria-label="Zoom"
    >
            <IconZoomIn size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Legend */}
      <Group gap="md" fz="xs">
        {[
          { color: AQUA, label: 'Active' },
          { color: '#f59f00', label: 'Critical path' },
          { color: COLOR_SUCCESS, label: 'Completed' },
          { color: COLOR_ERROR, label: 'Cancelled' },
        ].map(l => (
          <Group key={l.label} gap={4}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
            <Text size="xs" c="dimmed">{l.label}</Text>
          </Group>
        ))}
        <Group gap={4}>
          <div style={{ width: 24, height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', border: '1px dashed gray' }} />
          <Text size="xs" c="dimmed">Baseline</Text>
        </Group>
      </Group>

      <ScrollArea>
        <div style={{ display: 'flex' }}>
          {/* Labels column */}
          <div style={{ width: LABEL_W, flexShrink: 0, paddingTop: 32 }}>
            {filtered.map((p) => (
              <div
                key={p.id}
                style={{
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  paddingRight: 8,
                  borderBottom: `1px solid ${axisColor}`,
                }}
              >
                {criticalSet.has(p.id) && (
                  <Tooltip label="Critical path" withArrow>
                    <ThemeIcon size={14} color="orange" variant="transparent" mr={4}>
                      <IconAlertTriangle size={11} />
                    </ThemeIcon>
                  </Tooltip>
                )}
                {p.blockedById && (
                  <Tooltip label={`Blocked by #${p.blockedById}`} withArrow>
                    <ThemeIcon size={14} color="gray" variant="transparent" mr={4}>
                      <IconLock size={11} />
                    </ThemeIcon>
                  </Tooltip>
                )}
                <Text
                  size="xs"
                  style={{
                    maxWidth: LABEL_W - 40,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: criticalSet.has(p.id) ? '#f59f00' : undefined,
                  }}
                >
                  {p.name}
                </Text>
              </div>
            ))}
          </div>

          {/* SVG chart */}
          <ScrollArea style={{ flex: 1 }}>
            <svg width={CHART_W} height={CHART_H} style={{ background: bgColor, display: 'block' }}>
              {/* Month ticks */}
              <g transform="translate(0,0)">
                {ticks.map((tick, i) => (
                  <g key={i} transform={`translate(${tick.x},0)`}>
                    <line x1={0} y1={24} x2={0} y2={CHART_H} stroke={axisColor} strokeWidth={1} />
                    <text x={3} y={16} fill={textColor} fontSize={10} fontFamily={FONT_FAMILY}>{tick.label}</text>
                  </g>
                ))}
              </g>

              {/* Today line */}
              {(() => {
                const todayX = (daysBetween(minDate, new Date()) / totalDays) * CHART_W;
                if (todayX < 0 || todayX > CHART_W) return null;
                return (
                  <g>
                    <line x1={todayX} y1={24} x2={todayX} y2={CHART_H} stroke={COLOR_ERROR} strokeWidth={1.5} strokeDasharray="4,3" />
                    <text x={todayX + 3} y={20} fill={COLOR_ERROR} fontSize={9} fontFamily={FONT_FAMILY}>Today</text>
                  </g>
                );
              })()}

              {/* Project rows */}
              {filtered.map((project, i) => (
                <g key={project.id} transform={`translate(0, ${32 + i * ROW_H})`}>
                  {/* Row bg */}
                  <rect x={0} y={0} width={CHART_W} height={ROW_H}
                    fill={i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : 'transparent'}
                  />
                  <line x1={0} y1={ROW_H} x2={CHART_W} y2={ROW_H} stroke={axisColor} strokeWidth={1} />
                  <GanttRow
                    project={project}
                    isCritical={criticalSet.has(project.id)}
                    minDate={minDate}
                    totalDays={totalDays}
                    rowHeight={ROW_H}
                    width={CHART_W}
                    isDark={isDark}
                  />
                </g>
              ))}
            </svg>
          </ScrollArea>
        </div>
      </ScrollArea>
    </Stack>
  );
}

// ── BASELINES TAB ─────────────────────────────────────────────────────────

function BaselinesTab({ projects, isDark }: { projects: ProjectResponse[]; isDark: boolean }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [snapLabel, setSnapLabel]   = useState('');
  const [snapOpen, setSnapOpen]     = useState(false);

  const project = projects.find(p => p.id === selectedId);
  const { data: baselines = [], isLoading } = useProjectBaselines(selectedId ?? 0);
  const snapMutation   = useSnapBaseline(selectedId ?? 0);
  const deleteMutation = useDeleteBaseline(selectedId ?? 0);

  const projectOptions = projects.map(p => ({ value: String(p.id), label: p.name }));

  const cardBg      = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  async function handleSnap() {
    if (!selectedId || !snapLabel.trim()) return;
    try {
      await snapMutation.mutateAsync(snapLabel.trim());
      notifications.show({ title: 'Baseline saved', message: `"${snapLabel}" baseline snapped.`, color: 'teal', icon: <IconCheck size={14} /> });
      setSnapOpen(false);
      setSnapLabel('');
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to snap baseline.', color: 'red' });
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync(id);
      notifications.show({ title: 'Deleted', message: 'Baseline removed.', color: 'blue' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete baseline.', color: 'red' });
    }
  }

  function dateDiff(actual: string | null, planned: string | undefined) {
    if (!actual || !planned) return null;
    const a = parseDate(actual), p = parseDate(planned);
    if (!a || !p) return null;
    return daysBetween(p, a); // positive = delayed
  }

  return (
    <Stack gap="md">
      <Group gap="sm">
        <Select
          placeholder="Select a project…"
          data={projectOptions}
          value={selectedId ? String(selectedId) : null}
          onChange={v => setSelectedId(v ? Number(v) : null)}
          searchable
          style={{ maxWidth: 320 }}
        />
        {selectedId && (
          <Button
            size="sm"
            color="teal"
            leftSection={<IconPlus size={14} />}
            onClick={() => setSnapOpen(true)}
          >
            Snap baseline
          </Button>
        )}
      </Group>

      {selectedId && project && (
        <Paper withBorder radius="md" p="md" style={{ background: cardBg, borderColor }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600} style={{ fontFamily: FONT_FAMILY }}>{project.name}</Text>
              <Badge color={project.status === 'ACTIVE' ? 'teal' : 'gray'} variant="light">
                {project.status.replace('_', ' ')}
              </Badge>
            </Group>
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">Actual Start</Text>
                <Text size="sm" fw={500}>{fmtDate(project.startDate)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Actual Target</Text>
                <Text size="sm" fw={500}>{fmtDate(project.targetDate)}</Text>
              </div>
            </Group>
          </Stack>
        </Paper>
      )}

      {selectedId && isLoading && (
        <Stack gap="xs">{[1,2].map(i => <Skeleton key={i} height={48} radius="md" />)}</Stack>
      )}

      {selectedId && !isLoading && baselines.length === 0 && (
        <Alert color="blue" variant="light" icon={<IconHistory size={16} />} radius="sm">
          No baselines yet. Click "Snap baseline" to record the current dates as a baseline.
        </Alert>
      )}

      {selectedId && !isLoading && baselines.length > 0 && (
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Planned Start</Table.Th>
              <Table.Th>Planned Target</Table.Th>
              <Table.Th>Start Δ</Table.Th>
              <Table.Th>Target Δ</Table.Th>
              <Table.Th>Snapped by</Table.Th>
              <Table.Th>Snapped at</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {baselines.map(b => {
              const startDiff  = dateDiff(project?.startDate ?? null, b.plannedStart);
              const targetDiff = dateDiff(project?.targetDate ?? null, b.plannedTarget);
              return (
                <Table.Tr key={b.id}>
                  <Table.Td fw={600}>{b.label}</Table.Td>
                  <Table.Td>{fmtDate(b.plannedStart)}</Table.Td>
                  <Table.Td>{fmtDate(b.plannedTarget)}</Table.Td>
                  <Table.Td>
                    {startDiff !== null ? (
                      <Badge size="xs" color={startDiff > 0 ? 'red' : startDiff < 0 ? 'teal' : 'gray'} variant="light">
                        {startDiff > 0 ? `+${startDiff}d` : startDiff < 0 ? `${startDiff}d` : 'on time'}
                      </Badge>
                    ) : '—'}
                  </Table.Td>
                  <Table.Td>
                    {targetDiff !== null ? (
                      <Badge size="xs" color={targetDiff > 0 ? 'red' : targetDiff < 0 ? 'teal' : 'gray'} variant="light">
                        {targetDiff > 0 ? `+${targetDiff}d` : targetDiff < 0 ? `${targetDiff}d` : 'on time'}
                      </Badge>
                    ) : '—'}
                  </Table.Td>
                  <Table.Td c="dimmed">{b.snappedBy}</Table.Td>
                  <Table.Td c="dimmed">{fmtDate(b.snappedAt)}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      size="sm"
                      color="red"
                      variant="subtle"
                      onClick={() => handleDelete(b.id)}
                      loading={deleteMutation.isPending}
                      aria-label="Delete"
                    >
                      <IconTrash size={13} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {!selectedId && (
        <Alert color="gray" variant="light" icon={<IconHistory size={16} />} radius="sm">
          Select a project above to view or manage its baselines.
        </Alert>
      )}

      {/* Snap modal */}
      <Modal
        opened={snapOpen}
        onClose={() => { setSnapOpen(false); setSnapLabel(''); }}
        title="Snap baseline"
        size="sm"
      >
        <Stack gap="md">
          <Alert color="teal" variant="light" icon={<IconTarget size={15} />} radius="sm">
            <Text size="sm">
              Records the current dates of <strong>{project?.name}</strong> as a named baseline for future comparison.
            </Text>
          </Alert>
          <TextInput
            label="Baseline label"
            placeholder="e.g. Sprint 15 kickoff, Post-discovery"
            value={snapLabel}
            onChange={e => setSnapLabel(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" onClick={() => { setSnapOpen(false); setSnapLabel(''); }}>Cancel</Button>
            <Button
              color="teal"
              disabled={!snapLabel.trim()}
              onClick={handleSnap}
              loading={snapMutation.isPending}
              leftSection={<IconCheck size={14} />}
            >
              Snap
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── MILESTONES TAB ────────────────────────────────────────────────────────

function MilestonesTab({ projects, isDark }: { projects: ProjectResponse[]; isDark: boolean }) {
  const cardBg      = isDark ? 'var(--mantine-color-dark-7)' : '#fff';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : GRAY_100;

  // Milestones = projects where start == target OR duration <= 0 OR name has "milestone"
  const milestones = useMemo(() =>
    projects.filter(p => {
      if (!p.startDate && !p.targetDate) return false;
      const keyword = p.name.toLowerCase().includes('milestone') || p.name.toLowerCase().includes('go-live') || p.name.toLowerCase().includes('launch');
      const sameDate = p.startDate && p.targetDate && p.startDate === p.targetDate;
      const zeroDur  = p.durationMonths === 0;
      return keyword || sameDate || zeroDur;
    }),
  [projects]);

  const upcoming = milestones.filter(p => {
    const t = parseDate(p.targetDate ?? p.startDate);
    return t && t >= new Date();
  }).sort((a, b) => {
    const ta = parseDate(a.targetDate ?? a.startDate)?.getTime() ?? 0;
    const tb = parseDate(b.targetDate ?? b.startDate)?.getTime() ?? 0;
    return ta - tb;
  });

  const past = milestones.filter(p => {
    const t = parseDate(p.targetDate ?? p.startDate);
    return !t || t < new Date();
  });

  function MilestoneCard({ p }: { p: ProjectResponse }) {
    const date  = parseDate(p.targetDate ?? p.startDate);
    const today = new Date();
    const daysTo = date ? daysBetween(today, date) : null;
    const isPast = date ? date < today : false;

    return (
      <Paper withBorder radius="md" p="md" style={{ background: cardBg, borderColor }}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              size={36}
              radius="xl"
              variant="light"
              color={isPast ? 'gray' : p.status === 'COMPLETED' ? 'teal' : 'orange'}
            >
              <IconFlag size={18} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{p.name}</Text>
              <Text size="xs" c="dimmed">{fmtDate(p.targetDate ?? p.startDate)}</Text>
            </div>
          </Group>
          <Stack gap={4} align="flex-end">
            <Badge
              size="xs"
              color={p.status === 'COMPLETED' ? 'teal' : p.status === 'CANCELLED' ? 'red' : 'orange'}
              variant="light"
            >
              {p.status.replace('_', ' ')}
            </Badge>
            {daysTo !== null && !isPast && (
              <Text size="xs" c="dimmed">in {daysTo}d</Text>
            )}
            {isPast && p.status !== 'COMPLETED' && (
              <Badge size="xs" color="red" variant="light">Overdue</Badge>
            )}
          </Stack>
        </Group>
        {p.owner && (
          <Text size="xs" c="dimmed" mt={6}>Owner: {p.owner}</Text>
        )}
      </Paper>
    );
  }

  if (milestones.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<IconFlag size={16} />} radius="sm">
        No milestones detected. Projects with "milestone" or "launch" in their name, or a zero-day duration, will appear here.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      {upcoming.length > 0 && (
        <>
          <Text fw={600} size="sm" c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Upcoming ({upcoming.length})
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {upcoming.map(p => <MilestoneCard key={p.id} p={p} />)}
          </SimpleGrid>
        </>
      )}
      {past.length > 0 && (
        <>
          <Divider label="Past milestones" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {past.map(p => <MilestoneCard key={p.id} p={p} />)}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdvancedTimelinePage() {
  const isDark = useDarkMode();
  const { data: projects = [], isLoading } = useProjects();

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={40} w={300} />
        {[1,2,3,4].map(i => <Skeleton key={i} height={48} radius="md" />)}
      </Stack>
    );
  }

  return (
    <PPPageLayout title="Advanced Timeline" subtitle="Critical path, baselines and milestone tracking" animate>
      <Tabs defaultValue="timeline" variant="outline" radius="sm" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="timeline"   leftSection={<IconLayoutBoard size={14} />}>Timeline</Tabs.Tab>
          <Tabs.Tab value="baselines"  leftSection={<IconHistory size={14} />}>Baselines</Tabs.Tab>
          <Tabs.Tab value="milestones" leftSection={<IconFlag size={14} />}>Milestones</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="timeline">
          <TimelineTab projects={projects} isDark={isDark} />
        </Tabs.Panel>

        <Tabs.Panel value="baselines">
          <BaselinesTab projects={projects} isDark={isDark} />
        </Tabs.Panel>

        <Tabs.Panel value="milestones">
          <MilestonesTab projects={projects} isDark={isDark} />
        </Tabs.Panel>
      </Tabs>
    </PPPageLayout>
  );
}
