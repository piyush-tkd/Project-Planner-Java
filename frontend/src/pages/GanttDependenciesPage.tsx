import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Badge, Button, Paper, Card,
  Select, Tooltip, Stack, SimpleGrid, Divider,
  ScrollArea, SegmentedControl, Progress, Center, Skeleton,
} from '@mantine/core';
import {
  IconGitBranch, IconArrowRight, IconAlertTriangle,
  IconCircleCheck, IconFilter, IconDownload, IconUsers,
  IconCode, IconTestPipe,
} from '@tabler/icons-react';
import { PPPageLayout } from '../components/pp';
import SavedViews from '../components/common/SavedViews';
import { AQUA_HEX, AQUA, BORDER_STRONG, COLOR_BLUE_STRONG, COLOR_EMERALD, COLOR_ERROR_DARK, COLOR_ERROR_STRONG, COLOR_GREEN_STRONG, COLOR_ORANGE_DEEP, COLOR_VIOLET, DEEP_BLUE, GRAY_100, SURFACE_AMBER, SURFACE_BLUE, SURFACE_FAINT, SURFACE_LIGHT, SURFACE_RED_FAINT, SURFACE_SUCCESS_LIGHT, TEXT_GRAY, TEXT_SUBTLE } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { useProjects } from '../api/projects';
import { useProjectPodMatrix } from '../api/projects';
import { useResources } from '../api/resources';
import { ResourceResponse, ProjectResponse, ProjectPodMatrixResponse } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoleCount { devs: number; qa: number; ux?: number; }
interface ResourceDep { pod: string; needs: RoleCount; }
interface GanttProject {
  id: number; name: string; status: string; priority: string;
  startWeek: number; durationWeeks: number; pod: string;
  ownUse: RoleCount; resourceDeps: ResourceDep[];
}

// ── API → GanttProject mapper ────────────────────────────────────────────────

/** Normalise backend status strings to the values STATUS_COLORS expects */
const STATUS_NORM: Record<string, string> = {
  ACTIVE: 'ACTIVE', NOT_STARTED: 'NOT STARTED', IN_DISCOVERY: 'IN DISCOVERY',
  ON_HOLD: 'ON HOLD', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
};

function toGanttProject(
  proj: ProjectResponse,
  matrix: ProjectPodMatrixResponse[],
): GanttProject {
  const today  = Date.now();
  const start  = proj.startDate  ? new Date(proj.startDate).getTime()  : today;
  const end    = proj.targetDate ? new Date(proj.targetDate).getTime() : 0;
  const msWeek = 7 * 86_400_000;

  const startWeek     = Math.max(0, Math.round((start - today) / msWeek));
  const durationWeeks = (end > start)
    ? Math.max(1, Math.round((end - start) / msWeek))
    : Math.max(1, Math.round((proj.durationMonths ?? 3) * 4.3));

  // Primary pod = the matrix row for this project with the most dev hours
  const podRows = matrix
    .filter(m => m.projectId === proj.id)
    .sort((a, b) => b.devHours - a.devHours);
  const primaryRow = podRows[0];
  // Estimate headcount: devHours / (durationMonths × 160 hrs/FTE/month)
  const monthHrs = Math.max(1, (proj.durationMonths ?? 1)) * 160;
  const devCount = primaryRow ? Math.max(1, Math.round(primaryRow.devHours / monthHrs)) : 2;
  const qaCount  = primaryRow ? Math.max(0, Math.round(primaryRow.qaHours  / monthHrs)) : 1;

  return {
    id:            proj.id,
    name:          proj.name,
    status:        STATUS_NORM[proj.status] ?? proj.status,
    priority:      proj.priority ?? 'MEDIUM',
    startWeek,
    durationWeeks: Math.min(durationWeeks, TOTAL_WEEKS),
    pod:           primaryRow?.podName ?? 'Unassigned',
    ownUse:        { devs: devCount, qa: qaCount },
    resourceDeps:  [], // cross-POD deps not stored in DB yet
  };
}

/** Derive POD headcount from the resources list (active + counts-in-capacity) */
function computePodCapacities(
  resources: ResourceResponse[],
): Record<string, Required<RoleCount>> {
  const caps: Record<string, Required<RoleCount>> = {};
  resources
    .filter(r => r.active && r.countsInCapacity && r.podAssignment)
    .forEach(r => {
      const pod  = r.podAssignment!.podName;
      if (!caps[pod]) caps[pod] = { devs: 0, qa: 0, ux: 0 };
      const role = r.role.toUpperCase();
      if (role.includes('QA') || role.includes('QUALITY'))
        caps[pod].qa++;
      else if (role.includes('UX') || role.includes('DESIGN'))
        caps[pod].ux++;
      else
        caps[pod].devs++;
    });
  return caps;
}

// ── Capacity helpers ──────────────────────────────────────────────────────────

function podAllocatedAtWeek(
  ganttProjects: GanttProject[],
  podName: string, week: number, excludeId: number,
): Required<RoleCount> {
  let devs = 0, qa = 0, ux = 0;
  for (const p of ganttProjects) {
    if (p.id === excludeId) continue;
    if (week < p.startWeek || week >= p.startWeek + p.durationWeeks) continue;
    if (p.pod === podName) { devs += p.ownUse.devs; qa += p.ownUse.qa; ux += p.ownUse.ux ?? 0; }
    for (const rd of p.resourceDeps) {
      if (rd.pod === podName) { devs += rd.needs.devs; qa += rd.needs.qa; ux += rd.needs.ux ?? 0; }
    }
  }
  return { devs, qa, ux };
}

interface CapacityResult {
  conflict: boolean;
  minAvailDevs: number; minAvailQa: number;
  neededDevs: number;   neededQa: number;
  podTotalDevs: number; podTotalQa: number;
  shortfallDevs: number; shortfallQa: number;
}

function checkCapacity(
  ganttProjects: GanttProject[],
  podCapacities: Record<string, Required<RoleCount>>,
  project: GanttProject,
  depPod: string,
): CapacityResult {
  const cap = podCapacities[depPod] ?? { devs: 0, qa: 0, ux: 0 };
  const dep = project.resourceDeps.find(d => d.pod === depPod);
  const neededDevs = dep?.needs.devs ?? 0;
  const neededQa   = dep?.needs.qa   ?? 0;
  let minAvailDevs = cap.devs, minAvailQa = cap.qa;
  for (let w = project.startWeek; w < project.startWeek + project.durationWeeks; w++) {
    const alloc = podAllocatedAtWeek(ganttProjects, depPod, w, project.id);
    minAvailDevs = Math.min(minAvailDevs, cap.devs - alloc.devs);
    minAvailQa   = Math.min(minAvailQa,   cap.qa   - alloc.qa);
  }
  const shortfallDevs = Math.max(0, neededDevs - minAvailDevs);
  const shortfallQa   = Math.max(0, neededQa   - minAvailQa);
  return { conflict: shortfallDevs > 0 || shortfallQa > 0, minAvailDevs, minAvailQa, neededDevs, neededQa, podTotalDevs: cap.devs, podTotalQa: cap.qa, shortfallDevs, shortfallQa };
}

// ── Colours — muted, professional ────────────────────────────────────────────

const POD_HEX: Record<string, string> = {
  'Accessioning':       '#0891b2',  // cyan-600
  'Enterprise Systems': COLOR_VIOLET,  // violet-700
  'Integrations':       '#b45309',  // amber-700
  'LIS/Reporting':      '#1d4ed8',  // blue-700
  'Portal V1':          COLOR_EMERALD,  // emerald-600
  'Portal V2':          '#be185d',  // pink-700
};
const getPodColor = (pod: string) => POD_HEX[pod] ?? TEXT_GRAY;

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'ACTIVE':        { bg: SURFACE_SUCCESS_LIGHT, color: '#15803d', border: '#bbf7d0' },
  'NOT STARTED':   { bg: SURFACE_FAINT, color: TEXT_GRAY, border: BORDER_STRONG },
  'IN DISCOVERY':  { bg: SURFACE_BLUE, color: '#1d4ed8', border: '#bfdbfe' },
  'ON HOLD':       { bg: SURFACE_AMBER, color: '#b45309', border: '#fde68a' },
  'COMPLETED':     { bg: SURFACE_SUCCESS_LIGHT, color: '#15803d', border: '#86efac' },
};
const PRIORITY_COLORS: Record<string, string> = {
  P0: COLOR_ERROR_DARK, P1: COLOR_ORANGE_DEEP, P2: COLOR_BLUE_STRONG, P3: COLOR_GREEN_STRONG,
};

// ── Gantt geometry ────────────────────────────────────────────────────────────

const TOTAL_WEEKS   = 24;
const WEEK_WIDTH    = 38;
const ROW_HEIGHT    = 54;
const HEADER_HEIGHT = 44;
const LABEL_WIDTH   = 280;

/** Smooth bezier path between two Gantt bars */
function depPath(fromX: number, fromY: number, toX: number, toY: number): string {
  // Always exit the source bar going right, then curve toward the target
  const exitX = fromX + 14;
  const entryX = toX;
  // Control points pull horizontally away from each endpoint
  const cpSpan = Math.max(40, Math.abs(entryX - exitX) * 0.45);
  const c1x = exitX  + cpSpan;
  const c2x = entryX - cpSpan;
  return `M ${fromX},${fromY} L ${exitX},${fromY} C ${c1x},${fromY} ${c2x},${toY} ${entryX},${toY}`;
}

// ── Capacity progress bar (reusable) ─────────────────────────────────────────

function CapBar({ label, icon, used, total, needed, conflict, isDark }: {
  label: string; icon: React.ReactNode;
  used: number; total: number; needed: number; conflict: boolean; isDark: boolean;
}) {
  const pctUsed   = Math.min(100, (used   / total) * 100);
  const pctNeeded = Math.min(100 - pctUsed, (needed / total) * 100);
  const avail     = total - used;
  return (
    <Box>
      <Group gap={4} mb={3}>
        {icon}
        <Text size="10px" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>{label}</Text>
        <Text size="10px" c="dimmed" style={{ marginLeft: 'auto' }}>
          {avail}/{total} free — need {needed}
        </Text>
        {conflict
          ? <Badge size="xs" color="red"   variant="light">−{needed - avail}</Badge>
          : <Badge size="xs" color="green" variant="light">OK</Badge>
        }
      </Group>
      <Box style={{ position: 'relative', height: 8, borderRadius: 4, background: isDark ? 'var(--mantine-color-dark-4)' : GRAY_100, overflow: 'hidden' }}>
        <Box style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctUsed}%`, background: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1', borderRadius: 4 }} />
        <Box style={{ position: 'absolute', left: `${pctUsed}%`, top: 0, height: '100%', width: `${pctNeeded}%`, background: conflict ? COLOR_ERROR_STRONG : AQUA, borderRadius: 4 }} />
      </Box>
    </Box>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GanttDependenciesPage() {
  const isDark = useDarkMode();
  const [filterPod, setFilterPod] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [view, setView] = useState('gantt');
  const [savedViewId, setSavedViewId] = useState<string | null>(null);

  const currentFilters = { filterPod, filterStatus };
  const applyView = (filters: Record<string, string | null>) => {
    if ('filterPod'    in filters) setFilterPod(filters.filterPod);
    if ('filterStatus' in filters) setFilterStatus(filters.filterStatus);
  };

  // ── Live data ──────────────────────────────────────────────────────────────
  const { data: rawProjects = [], isLoading: projLoading }   = useProjects();
  const { data: matrix      = [], isLoading: matrixLoading } = useProjectPodMatrix();
  const { data: resources   = [], isLoading: resLoading }    = useResources();

  const ganttProjects = useMemo<GanttProject[]>(() => {
    if (!rawProjects.length) return [];
    return rawProjects
      .filter(p => p.status !== 'CANCELLED' && p.status !== 'COMPLETED')
      .map(p => toGanttProject(p as ProjectResponse, matrix as ProjectPodMatrixResponse[]));
  }, [rawProjects, matrix]);

  const podCapacities = useMemo<Record<string, Required<RoleCount>>>(
    () => computePodCapacities(resources as ResourceResponse[]),
    [resources],
  );

  /** Dynamic pod list derived from live data (for filter select + legend) */
  const livePods = useMemo<string[]>(
    () => Array.from(new Set(ganttProjects.map(p => p.pod))).sort(),
    [ganttProjects],
  );

  const isLoading = projLoading || matrixLoading || resLoading;

  const filtered = useMemo(() => {
    let list = ganttProjects;
    if (filterPod)    list = list.filter(p => p.pod === filterPod);
    if (filterStatus) list = list.filter(p => p.status === filterStatus);
    return list;
  }, [filterPod, filterStatus, ganttProjects]);

  // ── Critical path (longest path through dep graph) ────────────────────────
  const criticalPathIds = useMemo<Set<number>>(() => {
    // Build adjacency: blocker -> downstream IDs
    const downstream = new Map<number, number[]>();
    for (const p of ganttProjects) {
      p.resourceDeps.forEach(({ pod: depPod }) => {
        const blocker = [...ganttProjects]
          .filter(b => b.pod === depPod && b.id !== p.id)
          .sort((a, b) => (b.startWeek + b.durationWeeks) - (a.startWeek + a.durationWeeks))[0];
        if (!blocker) return;
        if (!downstream.has(blocker.id)) downstream.set(blocker.id, []);
        downstream.get(blocker.id)!.push(p.id);
      });
    }
    // Forward pass: compute earliest finish for each project
    const ef = new Map<number, number>();
    for (const p of ganttProjects) ef.set(p.id, p.startWeek + p.durationWeeks);

    // Find the maximum total end week considering dependencies
    const longestEnd = Math.max(...Array.from(ef.values()), 0);

    // Mark critical path: projects whose EF equals the global latest end,
    // or any project with EF within 1 week of the critical chain end
    const critSet = new Set<number>();
    // Walk backward: find projects that lie on the longest end-to-end chain
    const endProjects = ganttProjects.filter(p => ef.get(p.id) === longestEnd);
    const walk = (id: number) => {
      critSet.add(id);
      // Find which blocker leads to this project
      const proj = ganttProjects.find(p => p.id === id);
      if (!proj) return;
      proj.resourceDeps.forEach(({ pod: depPod }) => {
        const blocker = [...ganttProjects]
          .filter(b => b.pod === depPod && b.id !== id)
          .sort((a, b) => (b.startWeek + b.durationWeeks) - (a.startWeek + a.durationWeeks))[0];
        if (blocker) walk(blocker.id);
      });
    };
    endProjects.forEach(p => walk(p.id));
    return critSet;
  }, [ganttProjects]);

  const capacityMap = useMemo(() => {
    const map = new Map<string, CapacityResult>();
    for (const p of ganttProjects)
      for (const rd of p.resourceDeps)
        map.set(`${p.id}::${rd.pod}`, checkCapacity(ganttProjects, podCapacities, p, rd.pod));
    return map;
  }, [ganttProjects, podCapacities]);

  const projectHasConflict = (p: GanttProject) =>
    p.resourceDeps.some(rd => capacityMap.get(`${p.id}::${rd.pod}`)?.conflict);

  const conflicts = useMemo(() => {
    const list: { project: string; depPod: string; shortfallDevs: number; shortfallQa: number }[] = [];
    for (const p of filtered)
      for (const rd of p.resourceDeps) {
        const c = capacityMap.get(`${p.id}::${rd.pod}`);
        if (c?.conflict) list.push({ project: p.name, depPod: rd.pod, shortfallDevs: c.shortfallDevs, shortfallQa: c.shortfallQa });
      }
    return list;
  }, [filtered, capacityMap]);

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i * 7);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Smooth bezier dependency arrows
  const dependencyPaths = useMemo(() => {
    const paths: { key: string; d: string; color: string; isConflict: boolean }[] = [];
    filtered.forEach((project, projIdx) => {
      project.resourceDeps.forEach(({ pod: depPod }) => {
        const c = capacityMap.get(`${project.id}::${depPod}`);
        const isConflict = c?.conflict ?? false;
        // Find the project in depPod with the latest end that overlaps our window
        const blocker = [...ganttProjects]
          .filter(p => p.pod === depPod && p.id !== project.id)
          .filter(p => p.startWeek < project.startWeek + project.durationWeeks)
          .sort((a, b) => (b.startWeek + b.durationWeeks) - (a.startWeek + a.durationWeeks))[0];
        if (!blocker) return;
        const blockerIdx = filtered.findIndex(p => p.id === blocker.id);
        if (blockerIdx === -1) return;
        const fromX = (blocker.startWeek + blocker.durationWeeks) * WEEK_WIDTH;
        const fromY = blockerIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const toX   = project.startWeek * WEEK_WIDTH;
        const toY   = projIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        paths.push({
          key: `${blocker.id}->${project.id}(${depPod})`,
          d: depPath(fromX, fromY, toX, toY),
          color: isConflict ? COLOR_ERROR_STRONG : AQUA,
          isConflict,
        });
      });
    });
    return paths;
  }, [filtered, capacityMap, ganttProjects]);

  const totalDevs = Object.values(podCapacities).reduce((s, c) => s + c.devs, 0);
  const totalQa   = Object.values(podCapacities).reduce((s, c) => s + c.qa,   0);

  if (isLoading) return (
    <Skeleton height={320} radius="sm" />
  );

  return (
    <PPPageLayout title="Gantt & Dependencies" subtitle="Critical path visualisation and cross-team resource dependencies" animate>
    <Box className="page-enter" style={{ paddingBottom: 32 }}>

      {/* Toolbar */}
      <Group justify="flex-end" mb="lg">
        <Button leftSection={<IconDownload size={15} />} variant="outline" color="teal" size="sm">Export</Button>
      </Group>

      {/* KPIs */}
      <SimpleGrid cols={4} spacing="md" mb="lg">
        {[
          { label: 'Total Projects',        value: ganttProjects.length,                                           color: DEEP_BLUE },
          { label: 'With POD Dependencies', value: ganttProjects.filter(p => p.resourceDeps.length > 0).length, color: COLOR_BLUE_STRONG },
          { label: 'Capacity Conflicts',    value: conflicts.length,                                           color: conflicts.length > 0 ? COLOR_ERROR_DARK : '#15803d' },
          { label: 'Eng Headcount',         value: `${totalDevs}d · ${totalQa}q`,                            color: COLOR_VIOLET },
        ].map(s => (
          <Card key={s.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: TEXT_SUBTLE }}>{s.label}</Text>
            <Text fw={800} mt={4} style={{ color: s.color, fontSize: typeof s.value === 'string' ? 20 : 28 }}>{s.value}</Text>
          </Card>
        ))}
      </SimpleGrid>

      {/* Conflict banner */}
      {conflicts.length > 0 && (
        <Paper withBorder radius="md" p="md" mb="lg" style={{ background: isDark ? 'rgba(239,68,68,0.1)' : SURFACE_RED_FAINT, borderColor: isDark ? 'rgba(239,68,68,0.35)' : '#fecdd3' }}>
          <Group gap="xs" mb="xs">
            <IconAlertTriangle size={15} color={COLOR_ERROR_DARK} />
            <Text size="sm" fw={700} c="red">{conflicts.length} capacity conflict{conflicts.length !== 1 ? 's' : ''}</Text>
          </Group>
          <Stack gap={3}>
            {conflicts.map((c, i) => (
              <Text key={i} size="sm" style={{ color: '#991b1b' }}>
                • <strong>{c.project}</strong> needs resources from <strong>{c.depPod}</strong>
                {c.shortfallDevs > 0 ? ` — ${c.shortfallDevs} dev${c.shortfallDevs > 1 ? 's' : ''} short` : ''}
                {c.shortfallQa   > 0 ? `, ${c.shortfallQa} QA short` : ''}
              </Text>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Controls */}
      <Paper withBorder radius="md" p="sm" mb="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm">
            <Select placeholder="All PODs" data={livePods} value={filterPod} onChange={setFilterPod}
              clearable size="sm" leftSection={<IconFilter size={14} />} style={{ width: 180 }} />
            <Select placeholder="All statuses"
              data={['ACTIVE','NOT STARTED','IN DISCOVERY','ON HOLD']}
              value={filterStatus} onChange={setFilterStatus}
              clearable size="sm" style={{ width: 160 }} />
            <SavedViews
              pageKey="gantt_dependencies"
              currentFilters={currentFilters}
              onApply={applyView}
              activeViewId={savedViewId}
              onActiveViewChange={setSavedViewId}
            />
          </Group>
          <SegmentedControl size="sm" value={view} onChange={setView}
            data={[{ label: 'Gantt Chart', value: 'gantt' }, { label: 'Capacity Detail', value: 'list' }, { label: 'POD Headcount', value: 'pods' }]}
            style={{ background: isDark ? 'var(--mantine-color-dark-6)' : SURFACE_LIGHT }}
          />
        </Group>
      </Paper>

      {/* ══════════ GANTT ══════════ */}
      {view === 'gantt' && (
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
          <ScrollArea type="auto">
            <Box style={{ minWidth: LABEL_WIDTH + TOTAL_WEEKS * WEEK_WIDTH }}>

              {/* Column header */}
              <Box style={{ display: 'flex', background: DEEP_BLUE, height: HEADER_HEIGHT, position: 'sticky', top: 0, zIndex: 10 }}>
                <Box style={{ width: LABEL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                  <Text size="11px" fw={700} tt="uppercase" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '1px' }}>Project</Text>
                </Box>
                {weeks.map((w, i) => (
                  <Box key={i} style={{ width: WEEK_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: i % 4 === 0 ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.03)' }}>
                    {i % 4 === 0 && (
                      <Text size="9px" style={{ color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{w}</Text>
                    )}
                  </Box>
                ))}
              </Box>

              {/* Rows */}
              <Box style={{ position: 'relative' }}>
                {filtered.map((project, ri) => {
                  const podColor    = getPodColor(project.pod);
                  const hasConflict = projectHasConflict(project);
                  const hasDeps     = project.resourceDeps.length > 0;
                  const isEven      = ri % 2 === 0;
                  const depSummary  = project.resourceDeps.map(rd => {
                    const c = capacityMap.get(`${project.id}::${rd.pod}`);
                    return `${rd.pod} — need ${rd.needs.devs}d${rd.needs.qa ? `/${rd.needs.qa}q` : ''} · ${c?.conflict ? `⚠ ${c.shortfallDevs}d short` : `✓ ${c?.minAvailDevs}d free`}`;
                  }).join('\n');

                  return (
                    <Box
                      key={project.id}
                      style={{
                        display: 'flex', height: ROW_HEIGHT, alignItems: 'center',
                        background: isDark
                          ? (hasConflict ? 'rgba(239,68,68,0.07)' : isEven ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-dark-6)')
                          : (hasConflict ? '#fff8f8' : isEven ? '#ffffff' : '#fafbfc'),
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(14,165,233,0.09)' : '#f0f9ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = isDark
                        ? (hasConflict ? 'rgba(239,68,68,0.07)' : isEven ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-dark-6)')
                        : (hasConflict ? '#fff8f8' : isEven ? '#ffffff' : '#fafbfc'))}
                    >
                      {/* Label */}
                      <Box style={{
                        width: LABEL_WIDTH, flexShrink: 0, height: '100%',
                        borderRight: '1px solid var(--mantine-color-default-border)',
                        display: 'flex', alignItems: 'center',
                        padding: '0 14px 0 12px', gap: 8,
                        borderLeft: `3px solid ${hasConflict ? COLOR_ERROR_STRONG : podColor}`,
                      }}>
                        {hasDeps && (
                          <Tooltip label={depSummary} withArrow multiline w={260} position="right">
                            <Box style={{ flexShrink: 0, cursor: 'default', lineHeight: 1 }}>
                              {hasConflict
                                ? <IconAlertTriangle size={13} color={COLOR_ERROR_STRONG} />
                                : <IconGitBranch     size={13} color={AQUA} />
                              }
                            </Box>
                          </Tooltip>
                        )}
                        <Box style={{ overflow: 'hidden', flex: 1 }}>
                          <Text size="xs" fw={600} style={{ color: isDark ? 'var(--mantine-color-gray-2)' : DEEP_BLUE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {project.name}
                          </Text>
                          <Group gap={5} mt={2}>
                            <Text size="10px" style={{ color: podColor, fontWeight: 600 }}>{project.pod}</Text>
                            <Text size="10px" c="dimmed">·</Text>
                            <Text size="10px" c="dimmed">{project.ownUse.devs}d / {project.ownUse.qa}q</Text>
                            <Badge size="xs" style={{ fontSize: 9, padding: '0 4px', background: `${PRIORITY_COLORS[project.priority]}14`, color: PRIORITY_COLORS[project.priority], border: `1px solid ${PRIORITY_COLORS[project.priority]}30` }}>
                              {project.priority}
                            </Badge>
                          </Group>
                        </Box>
                      </Box>

                      {/* Timeline cells + bar */}
                      <Box style={{ display: 'flex', flex: 1, height: '100%', position: 'relative' }}>
                        {weeks.map((_, wi) => (
                          <Box key={wi} style={{
                            width: WEEK_WIDTH, flexShrink: 0,
                            borderLeft: wi % 4 === 0
                              ? '1px solid var(--mantine-color-default-border)'
                              : isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f4f6f8',
                            height: '100%',
                          }} />
                        ))}
                        {(() => {
                          const isCritical = criticalPathIds.has(project.id);
                          const barColor = isCritical ? '#f59f00' : podColor;
                          const barBorder = isCritical ? '2px solid #e67700' : undefined;
                          const tooltipLines = [
                            `${project.name}${isCritical ? '  ★ Critical Path' : ''}`,
                            `Wk ${project.startWeek} → ${project.startWeek + project.durationWeeks}  ·  ${project.status}`,
                            `Own team: ${project.ownUse.devs} devs, ${project.ownUse.qa} QA`,
                          ].join('\n');
                          return (
                            <Tooltip label={tooltipLines} withArrow multiline>
                              <Box style={{
                                position: 'absolute',
                                left:  project.startWeek * WEEK_WIDTH + 3,
                                width: project.durationWeeks * WEEK_WIDTH - 6,
                                top: '50%', transform: 'translateY(-50%)',
                                height: isCritical ? 34 : 30, borderRadius: 6,
                                background: barColor,
                                border: barBorder,
                                boxShadow: isCritical ? '0 0 8px rgba(245,159,0,0.55)' : undefined,
                                opacity: project.status === 'NOT STARTED' ? 0.42 : 0.88,
                                display: 'flex', alignItems: 'center',
                                padding: '0 10px', overflow: 'hidden',
                                cursor: 'default', zIndex: isCritical ? 4 : 2,
                              }}>
                                <Text size="11px" fw={600} style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.01em' }}>
                                  {isCritical && '★ '}{project.name}
                                </Text>
                              </Box>
                            </Tooltip>
                          );
                        })()}
                      </Box>
                    </Box>
                  );
                })}

                {/* Smooth dependency arrows */}
                <svg style={{
                  position: 'absolute', top: 0, left: LABEL_WIDTH,
                  width: TOTAL_WEEKS * WEEK_WIDTH, height: filtered.length * ROW_HEIGHT,
                  pointerEvents: 'none', overflow: 'visible', zIndex: 5,
                }}>
                  <defs>
                    <marker id="arr-ok"       markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <polygon points="0 1, 7 4, 0 7" fill={AQUA_HEX} />
                    </marker>
                    <marker id="arr-conflict" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <polygon points="0 1, 7 4, 0 7" fill={COLOR_ERROR_STRONG} />
                    </marker>
                  </defs>
                  {dependencyPaths.map(({ key, d, color, isConflict }) => (
                    <path key={key} d={d} stroke={color} strokeWidth={1.5} fill="none"
                      strokeDasharray={isConflict ? '6 3' : undefined}
                      markerEnd={`url(#${isConflict ? 'arr-conflict' : 'arr-ok'})`}
                      opacity={0.75}
                    />
                  ))}
                  {/* Today marker — vertical red dashed line at week 0 */}
                  <line
                    x1={0} y1={0} x2={0} y2={filtered.length * ROW_HEIGHT}
                    stroke="#ef4444" strokeWidth={2} strokeDasharray="5 4" opacity={0.85}
                  />
                  <text x={4} y={14} fill="#ef4444" fontSize={10} fontWeight={700} opacity={0.9}>Today</text>
                </svg>
              </Box>
            </Box>
          </ScrollArea>

          {/* Legend */}
          <Box style={{ padding: '10px 16px', borderTop: '1px solid var(--mantine-color-default-border)', background: isDark ? 'var(--mantine-color-dark-6)' : '#fafbfc' }}>
            <Group gap="lg" wrap="wrap" align="center">
              <Group gap="xs">
                <Text size="11px" c="dimmed" fw={600}>PODs:</Text>
                {livePods.map(pod => (
                  <Group key={pod} gap={5}>
                    <Box style={{ width: 10, height: 10, borderRadius: 3, background: getPodColor(pod), flexShrink: 0 }} />
                    <Text size="11px" c="dimmed">{pod}</Text>
                  </Group>
                ))}
              </Group>
              <Divider orientation="vertical" />
              <Group gap={5}>
                <Box style={{ width: 20, height: 1.5, background: AQUA }} />
                <Text size="11px" c="dimmed">capacity OK</Text>
              </Group>
              <Group gap={5}>
                <Box style={{ width: 20, height: 1.5, background: COLOR_ERROR_STRONG, borderStyle: 'dashed' }} />
                <Text size="11px" c="dimmed">conflict</Text>
              </Group>
              <Divider orientation="vertical" />
              <Group gap={5}>
                <Box style={{ width: 14, height: 14, borderRadius: 3, background: '#f59f00', boxShadow: '0 0 6px rgba(245,159,0,0.5)', flexShrink: 0 }} />
                <Text size="11px" c="dimmed">★ critical path</Text>
              </Group>
              <Group gap={5}>
                <Box style={{ width: 2, height: 14, background: '#ef4444', flexShrink: 0 }} />
                <Text size="11px" c="dimmed">today</Text>
              </Group>
              <Text size="11px" c="dimmed">Dimmed bars = NOT STARTED</Text>
            </Group>
          </Box>
        </Paper>
      )}

      {/* ══════════ CAPACITY DETAIL ══════════ */}
      {view === 'list' && (
        <Stack gap="md">
          {filtered.map(project => {
            const podColor    = getPodColor(project.pod);
            const statusCfg   = STATUS_COLORS[project.status] ?? STATUS_COLORS['NOT STARTED'];
            const hasConflict = projectHasConflict(project);
            return (
              <Paper key={project.id} withBorder radius="md" p="lg"
                style={{ borderLeft: `4px solid ${hasConflict ? COLOR_ERROR_STRONG : podColor}` }}>
                <Group justify="space-between" mb="md">
                  <Box>
                    <Group gap="sm">
                      <Text fw={700} size="sm" style={{ color: isDark ? 'var(--mantine-color-gray-2)' : DEEP_BLUE }}>{project.name}</Text>
                      <Badge size="xs" style={{ background: `${PRIORITY_COLORS[project.priority]}14`, color: PRIORITY_COLORS[project.priority], border: `1px solid ${PRIORITY_COLORS[project.priority]}30` }}>{project.priority}</Badge>
                      <Badge size="sm" style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>{project.status}</Badge>
                    </Group>
                    <Group gap="xs" mt={4}>
                      <IconUsers size={12} color={podColor} />
                      <Text size="xs" c="dimmed">
                        Wk {project.startWeek}–{project.startWeek + project.durationWeeks} · run by <strong>{project.pod}</strong> ({project.ownUse.devs}d / {project.ownUse.qa}q own team)
                      </Text>
                    </Group>
                  </Box>
                  {hasConflict
                    ? <Badge color="red"   size="sm" leftSection={<IconAlertTriangle size={11} />}>Capacity conflict</Badge>
                    : <Badge color="green" size="sm" leftSection={<IconCircleCheck   size={11} />}>All clear</Badge>
                  }
                </Group>

                {project.resourceDeps.length === 0 ? (
                  <Group gap={6}><IconCircleCheck size={14} color={COLOR_GREEN_STRONG} /><Text size="xs" c="dimmed">No cross-POD resource dependencies</Text></Group>
                ) : (
                  <Stack gap="md">
                    {project.resourceDeps.map(rd => {
                      const c        = capacityMap.get(`${project.id}::${rd.pod}`)!;
                      const depColor = getPodColor(rd.pod);
                      const allocDevs = c.podTotalDevs - c.minAvailDevs;
                      const allocQa   = c.podTotalQa   - c.minAvailQa;
                      return (
                        <Paper key={rd.pod} withBorder p="md" radius="sm"
                          style={{ background: isDark ? (c.conflict ? 'rgba(239,68,68,0.09)' : 'rgba(0,200,183,0.07)') : (c.conflict ? SURFACE_RED_FAINT : '#f8fffe'), borderColor: isDark ? (c.conflict ? 'rgba(239,68,68,0.35)' : 'rgba(0,200,183,0.35)') : (c.conflict ? '#fecdd3' : '#cef0f1') }}>
                          <Group gap="sm" mb="md">
                            <IconUsers size={14} color={depColor} />
                            <Text size="sm" fw={700} style={{ color: depColor }}>{rd.pod} POD</Text>
                            <Text size="xs" c="dimmed">total: {podCapacities[rd.pod]?.devs ?? '?'}d / {podCapacities[rd.pod]?.qa ?? '?'}q</Text>
                            <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>during wk {project.startWeek}–{project.startWeek + project.durationWeeks}</Text>
                          </Group>
                          <Stack gap={10}>
                            <CapBar label="Developers"    icon={<IconCode     size={11} color={TEXT_SUBTLE} />} used={allocDevs} total={c.podTotalDevs} needed={rd.needs.devs} conflict={c.shortfallDevs > 0} isDark={isDark} />
                            <CapBar label="QA Engineers"  icon={<IconTestPipe size={11} color={TEXT_SUBTLE} />} used={allocQa}   total={c.podTotalQa}   needed={rd.needs.qa}   conflict={c.shortfallQa   > 0} isDark={isDark} />
                          </Stack>
                          {c.conflict && (
                            <Text size="xs" c="red" mt="sm" fw={500}>
                              ⚠ At peak overlap, {rd.pod} has {c.minAvailDevs} Dev / {c.minAvailQa} QA free — this project needs {rd.needs.devs} Dev / {rd.needs.qa} QA. Consider shifting start week or rebalancing the {rd.pod} backlog.
                            </Text>
                          )}
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* ══════════ POD HEADCOUNT ══════════ */}
      {view === 'pods' && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {livePods.map(pod => {
            const cap        = podCapacities[pod] ?? { devs: 0, qa: 0, ux: 0 };
            const podColor   = getPodColor(pod);
            const podProjects = ganttProjects.filter(p => p.pod === pod);
            let peakDevs = 0, peakQa = 0;
            for (let w = 0; w < TOTAL_WEEKS; w++) {
              const alloc = podAllocatedAtWeek(ganttProjects, pod, w, -1);
              peakDevs = Math.max(peakDevs, alloc.devs);
              peakQa   = Math.max(peakQa,   alloc.qa);
            }
            const inbound = ganttProjects.filter(p => p.pod !== pod && p.resourceDeps.some(rd => rd.pod === pod));
            return (
              <Paper key={pod} withBorder radius="md" p="lg" style={{ borderTop: `3px solid ${podColor}` }}>
                <Group justify="space-between" mb="md">
                  <Group gap={8}><IconUsers size={15} color={podColor} /><Text fw={700} size="sm" style={{ color: isDark ? 'var(--mantine-color-gray-2)' : DEEP_BLUE }}>{pod}</Text></Group>
                  <Badge size="sm" style={{ background: `${podColor}12`, color: podColor, border: `1px solid ${podColor}30` }}>
                    {cap.devs} Dev · {cap.qa} QA{cap.ux ? ` · ${cap.ux} UX` : ''}
                  </Badge>
                </Group>
                <Stack gap={8} mb="md">
                  {[
                    { label: 'Devs', icon: <IconCode size={11} color={TEXT_SUBTLE} />, peak: peakDevs, total: cap.devs },
                    { label: 'QA',   icon: <IconTestPipe size={11} color={TEXT_SUBTLE} />, peak: peakQa,   total: cap.qa   },
                  ].map(row => (
                    <Box key={row.label}>
                      <Group gap={4} mb={3}>
                        {row.icon}
                        <Text size="10px" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>{row.label}</Text>
                        <Text size="10px" c="dimmed" style={{ marginLeft: 'auto' }}>peak {row.peak} of {row.total}</Text>
                      </Group>
                      <Progress value={Math.min(100, (row.peak / row.total) * 100)}
                        color={row.peak > row.total ? 'red' : row.peak >= row.total * 0.85 ? 'orange' : 'teal'}
                        size={7} radius="xl" />
                    </Box>
                  ))}
                </Stack>
                <Divider mb="sm" />
                <Text size="11px" c="dimmed" fw={600} mb={4}>Owns {podProjects.length} project{podProjects.length !== 1 ? 's' : ''}</Text>
                {podProjects.map(p => (
                  <Group key={p.id} gap={6} mb={3}>
                    <Box style={{ width: 6, height: 6, borderRadius: '50%', background: podColor, flexShrink: 0, marginTop: 2 }} />
                    <Text size="xs" style={{ color: isDark ? 'var(--mantine-color-gray-3)' : DEEP_BLUE, flex: 1 }}>{p.name}</Text>
                    <Text size="10px" c="dimmed">{p.ownUse.devs} Dev · {p.ownUse.qa} QA</Text>
                  </Group>
                ))}
                {inbound.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text size="11px" c="dimmed" fw={600} mb={4}>Lending to</Text>
                    {inbound.map(p => {
                      const rd = p.resourceDeps.find(d => d.pod === pod)!;
                      const c  = capacityMap.get(`${p.id}::${pod}`);
                      return (
                        <Group key={p.id} gap={6} mb={3}>
                          <Box style={{ width: 6, height: 6, borderRadius: '50%', background: c?.conflict ? COLOR_ERROR_STRONG : AQUA, flexShrink: 0, marginTop: 2 }} />
                          <Text size="xs" style={{ color: isDark ? 'var(--mantine-color-gray-3)' : DEEP_BLUE, flex: 1 }}>{p.name}</Text>
                          <Text size="10px" c="dimmed">{rd.needs.devs} Dev · {rd.needs.qa} QA {c?.conflict ? '⚠' : '✓'}</Text>
                        </Group>
                      );
                    })}
                  </>
                )}
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
    </PPPageLayout>
  );
}
