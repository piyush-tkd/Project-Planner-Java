/**
 * CustomDashboardPage — drag-to-arrange widget dashboard.
 *
 * Users choose from a widget library, place them on a 12-column responsive
 * grid, resize/remove them, and save their layout persistently.
 *
 * Widget types:
 *   kpi_project_count | kpi_at_risk | kpi_resources | kpi_overdue
 *   chart_status_dist | chart_priority_dist | chart_pod_load
 *   table_recent_projects | table_top_risks | table_my_approvals
 */
import { useState, useMemo } from 'react';
import {
  Title, Text, Stack, Group, Button, Paper, SimpleGrid, Badge,
  ActionIcon, Tooltip, Modal, Card, ThemeIcon, Divider,
  Menu, NumberInput, Select, TextInput, Alert, Skeleton,
  RingProgress, Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconX, IconCheck, IconRefresh, IconLayoutDashboard,
  IconChartPie, IconTable, IconTrendingUp, IconAlertTriangle,
  IconUsers, IconBriefcase, IconClock, IconShieldCheck,
  IconGripVertical, IconEdit, IconChartBar, IconTarget,
  IconArrowUp, IconArrowDown,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { useProjects } from '../api/projects';
import { useResources } from '../api/resources';
import { usePendingApprovals } from '../api/projectApprovals';
import {
  DashboardWidget,
  useDashboardWidgets,
  useSaveDashboardLayout,
  useDeleteDashboardWidget,
} from '../api/dashboardWidgets';

// ── Widget registry ──────────────────────────────────────────────────────────

const WIDGET_DEFS = [
  { type: 'kpi_project_count', label: 'Total Projects',      icon: <IconBriefcase size={18} />,    color: 'teal',   defaultSpan: 1 },
  { type: 'kpi_at_risk',       label: 'At-Risk Projects',    icon: <IconAlertTriangle size={18} />, color: 'orange', defaultSpan: 1 },
  { type: 'kpi_resources',     label: 'Total Resources',     icon: <IconUsers size={18} />,         color: 'blue',   defaultSpan: 1 },
  { type: 'kpi_overdue',       label: 'Overdue Projects',    icon: <IconClock size={18} />,         color: 'red',    defaultSpan: 1 },
  { type: 'chart_status_dist', label: 'Status Distribution', icon: <IconChartPie size={18} />,      color: 'violet', defaultSpan: 2 },
  { type: 'chart_priority_dist', label: 'Priority Mix',      icon: <IconChartBar size={18} />,      color: 'indigo', defaultSpan: 2 },
  { type: 'table_recent_projects', label: 'Recent Projects', icon: <IconTable size={18} />,         color: 'teal',   defaultSpan: 2 },
  { type: 'table_top_risks',   label: 'Top Risks',           icon: <IconShieldCheck size={18} />,   color: 'red',    defaultSpan: 2 },
  { type: 'table_my_approvals', label: 'Pending Approvals',  icon: <IconTarget size={18} />,        color: 'yellow', defaultSpan: 2 },
];

// ── Widget renderers ─────────────────────────────────────────────────────────

function KpiWidget({ type, isDark, projects, resources }: {
  type: string; isDark: boolean;
  projects: any[]; resources: any[];
}) {
  const today = new Date();
  const metrics = useMemo(() => {
    const total    = projects.length;
    const atRisk   = projects.filter(p => ['AT_RISK', 'ON_HOLD'].includes(p.status)).length;
    const overdue  = projects.filter(p => p.targetDate && new Date(p.targetDate) < today && p.status !== 'COMPLETED').length;
    const resCount = resources.length;
    return { total, atRisk, overdue, resCount };
  }, [projects, resources]);

  const cfg: Record<string, { value: number; label: string; color: string; icon: React.ReactNode; trend?: string }> = {
    kpi_project_count: { value: metrics.total,    label: 'Total Projects',   color: 'teal',   icon: <IconBriefcase size={22} /> },
    kpi_at_risk:       { value: metrics.atRisk,   label: 'At Risk',          color: 'orange', icon: <IconAlertTriangle size={22} />, trend: metrics.atRisk > 3 ? '⚠ High' : 'OK' },
    kpi_resources:     { value: metrics.resCount, label: 'Resources',        color: 'blue',   icon: <IconUsers size={22} /> },
    kpi_overdue:       { value: metrics.overdue,  label: 'Overdue',          color: 'red',    icon: <IconClock size={22} />, trend: metrics.overdue > 0 ? '⚠' : '✓' },
  };
  const c = cfg[type];
  if (!c) return null;

  return (
    <Group gap="md" align="center">
      <ThemeIcon size={44} radius="md" variant="light" color={c.color}>
        {c.icon}
      </ThemeIcon>
      <div>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ fontFamily: FONT_FAMILY, letterSpacing: '0.04em' }}>
          {c.label}
        </Text>
        <Group gap={6} align="baseline">
          <Text size="xl" fw={800} style={{ fontFamily: FONT_FAMILY, fontSize: 32, lineHeight: 1, color: isDark ? '#fff' : DEEP_BLUE }}>
            {c.value}
          </Text>
          {c.trend && (
            <Text size="xs" c={c.color} fw={600}>{c.trend}</Text>
          )}
        </Group>
      </div>
    </Group>
  );
}

function ChartWidget({ type, isDark, projects }: { type: string; isDark: boolean; projects: any[] }) {
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : '#e9ecef';

  if (type === 'chart_status_dist') {
    const counts = useMemo(() => {
      const map: Record<string, number> = {};
      projects.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [projects]);

    const total = projects.length || 1;
    const COLOR_MAP: Record<string, string> = {
      ACTIVE: 'teal', NOT_STARTED: 'gray', IN_DISCOVERY: 'blue',
      ON_HOLD: 'yellow', AT_RISK: 'orange', COMPLETED: 'green', CANCELLED: 'red',
    };
    return (
      <Stack gap="xs" mt="xs">
        {counts.slice(0, 6).map(([status, count]) => (
          <div key={status}>
            <Group justify="space-between" mb={3}>
              <Text size="xs" fw={500} style={{ fontFamily: FONT_FAMILY }}>{status.replace(/_/g, ' ')}</Text>
              <Text size="xs" c="dimmed">{count}</Text>
            </Group>
            <Progress value={(count / total) * 100} color={COLOR_MAP[status] || 'gray'} size="sm" radius="xl" />
          </div>
        ))}
      </Stack>
    );
  }

  if (type === 'chart_priority_dist') {
    const PRIORITY = ['P0', 'P1', 'P2', 'P3'];
    const PCOLOR: Record<string, string> = { P0: 'red', P1: 'orange', P2: 'blue', P3: 'gray' };
    const counts = useMemo(() => {
      const map: Record<string, number> = {};
      projects.forEach(p => { const pri = p.priority || 'P2'; map[pri] = (map[pri] || 0) + 1; });
      return PRIORITY.map(p => [p, map[p] || 0] as [string, number]);
    }, [projects]);
    const total = projects.length || 1;
    return (
      <Stack gap="xs" mt="xs">
        {counts.map(([p, count]) => (
          <div key={p}>
            <Group justify="space-between" mb={3}>
              <Badge size="xs" color={PCOLOR[p]} variant="light">{p}</Badge>
              <Text size="xs" c="dimmed">{count} ({Math.round((count / total) * 100)}%)</Text>
            </Group>
            <Progress value={(count / total) * 100} color={PCOLOR[p]} size="sm" radius="xl" />
          </div>
        ))}
      </Stack>
    );
  }

  return null;
}

function TableWidget({ type, isDark, projects, pendingApprovals }: {
  type: string; isDark: boolean; projects: any[]; pendingApprovals: any[];
}) {
  const rowBg = isDark ? 'var(--mantine-color-dark-6)' : '#f8f9fa';
  const borderColor = isDark ? 'var(--mantine-color-dark-4)' : '#e9ecef';

  if (type === 'table_recent_projects') {
    const recent = useMemo(() =>
      [...projects].sort((a, b) => {
        const da = a.createdAt || a.startDate || '';
        const db = b.createdAt || b.startDate || '';
        return db.localeCompare(da);
      }).slice(0, 5), [projects]);

    return (
      <Stack gap={4} mt="xs">
        {recent.map(p => (
          <Paper key={p.id} p="xs" radius="sm"
            style={{ background: rowBg, border: `1px solid ${borderColor}` }}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }} lineClamp={1}>{p.name}</Text>
              <Badge size="xs" variant="light" color={
                p.status === 'ACTIVE' ? 'teal' : p.status === 'AT_RISK' ? 'orange' :
                p.status === 'COMPLETED' ? 'green' : 'gray'
              }>{p.status?.replace(/_/g, ' ')}</Badge>
            </Group>
          </Paper>
        ))}
        {recent.length === 0 && <Text size="xs" c="dimmed">No projects</Text>}
      </Stack>
    );
  }

  if (type === 'table_top_risks') {
    const risks = useMemo(() =>
      projects.filter(p => ['AT_RISK', 'ON_HOLD'].includes(p.status)).slice(0, 5), [projects]);
    return (
      <Stack gap={4} mt="xs">
        {risks.map(p => (
          <Paper key={p.id} p="xs" radius="sm"
            style={{ background: rowBg, border: `1px solid ${borderColor}` }}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <IconAlertTriangle size={13} color="#f97316" />
                <Text size="xs" fw={600} lineClamp={1} style={{ fontFamily: FONT_FAMILY }}>{p.name}</Text>
              </Group>
              <Badge size="xs" color="orange" variant="light">{p.status?.replace(/_/g, ' ')}</Badge>
            </Group>
          </Paper>
        ))}
        {risks.length === 0 && <Text size="xs" c="dimmed" ta="center" mt="sm">No at-risk projects 🎉</Text>}
      </Stack>
    );
  }

  if (type === 'table_my_approvals') {
    return (
      <Stack gap={4} mt="xs">
        {pendingApprovals.slice(0, 5).map(a => (
          <Paper key={a.id} p="xs" radius="sm"
            style={{ background: rowBg, border: `1px solid ${borderColor}` }}>
            <Group justify="space-between">
              <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>Project #{a.projectId}</Text>
              <Badge size="xs" color="yellow" variant="light">Pending</Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={2}>by {a.requestedBy}</Text>
          </Paper>
        ))}
        {pendingApprovals.length === 0 && <Text size="xs" c="dimmed" ta="center" mt="sm">No pending approvals ✓</Text>}
      </Stack>
    );
  }

  return null;
}

// ── Single widget card ───────────────────────────────────────────────────────

function WidgetCard({
  widget, isDark, onRemove, onMoveUp, onMoveDown,
  projects, resources, pendingApprovals,
}: {
  widget: DashboardWidget;
  isDark: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  projects: any[];
  resources: any[];
  pendingApprovals: any[];
}) {
  const def = WIDGET_DEFS.find(d => d.type === widget.widgetType);
  const isKpi = widget.widgetType.startsWith('kpi_');
  const isChart = widget.widgetType.startsWith('chart_');

  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      h="100%"
      style={{
        background: isDark ? 'var(--mantine-color-dark-7)' : '#fff',
        borderColor: isDark ? 'var(--mantine-color-dark-4)' : '#e9ecef',
        position: 'relative',
        minHeight: isKpi ? 100 : 200,
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb={isKpi ? 'xs' : 'sm'}>
        <Group gap="xs">
          <ThemeIcon size={22} radius="sm" variant="light" color={def?.color || 'teal'}>
            {def?.icon}
          </ThemeIcon>
          <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>
            {widget.title || def?.label}
          </Text>
        </Group>
        <Group gap={4}>
          <Tooltip label="Move up" position="top">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onMoveUp}>
              <IconArrowUp size={12} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Move down" position="top">
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={onMoveDown}>
              <IconArrowDown size={12} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remove widget" position="top">
            <ActionIcon size="xs" variant="subtle" color="red" onClick={onRemove}>
              <IconX size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Content */}
      {isKpi && (
        <KpiWidget type={widget.widgetType} isDark={isDark} projects={projects} resources={resources} />
      )}
      {isChart && (
        <ChartWidget type={widget.widgetType} isDark={isDark} projects={projects} />
      )}
      {widget.widgetType.startsWith('table_') && (
        <TableWidget
          type={widget.widgetType} isDark={isDark}
          projects={projects} pendingApprovals={pendingApprovals}
        />
      )}
    </Paper>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function CustomDashboardPage() {
  const isDark = useDarkMode();
  const { data: savedWidgets = [], isLoading } = useDashboardWidgets();
  const { data: projects   = [] } = useProjects();
  const { data: resources  = [] } = useResources();
  const { data: pendingApprovals = [] } = usePendingApprovals();
  const saveLayout  = useSaveDashboardLayout();

  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [dirty, setDirty]     = useState(false);

  // Sync from server on first load
  useMemo(() => {
    if (savedWidgets.length > 0 && widgets.length === 0) {
      setWidgets(savedWidgets);
    }
  }, [savedWidgets]);

  // If no saved layout, show default
  const displayWidgets = dirty ? widgets : (savedWidgets.length > 0 ? savedWidgets : [
    { widgetType: 'kpi_project_count', gridCol: 0, gridRow: 0, colSpan: 1, rowSpan: 1 },
    { widgetType: 'kpi_at_risk',       gridCol: 1, gridRow: 0, colSpan: 1, rowSpan: 1 },
    { widgetType: 'kpi_resources',     gridCol: 2, gridRow: 0, colSpan: 1, rowSpan: 1 },
    { widgetType: 'kpi_overdue',       gridCol: 3, gridRow: 0, colSpan: 1, rowSpan: 1 },
    { widgetType: 'chart_status_dist', gridCol: 0, gridRow: 1, colSpan: 2, rowSpan: 1 },
    { widgetType: 'table_recent_projects', gridCol: 2, gridRow: 1, colSpan: 2, rowSpan: 1 },
  ] as DashboardWidget[]);

  const activeWidgets = dirty ? widgets : displayWidgets;

  function addWidget(type: string) {
    const def = WIDGET_DEFS.find(d => d.type === type)!;
    const newW: DashboardWidget = {
      widgetType: type,
      gridCol: 0,
      gridRow: activeWidgets.length,
      colSpan: def.defaultSpan,
      rowSpan: 1,
    };
    const next = [...activeWidgets, newW];
    setWidgets(next);
    setDirty(true);
    setAddOpen(false);
  }

  function removeWidget(idx: number) {
    const next = activeWidgets.filter((_, i) => i !== idx);
    setWidgets(next);
    setDirty(true);
  }

  function moveWidget(idx: number, dir: -1 | 1) {
    const next = [...activeWidgets];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setWidgets(next);
    setDirty(true);
  }

  async function handleSave() {
    try {
      await saveLayout.mutateAsync(activeWidgets);
      setDirty(false);
      notifications.show({ title: 'Layout saved', message: 'Your dashboard layout has been saved.', color: 'teal', icon: <IconCheck size={16} /> });
    } catch {
      notifications.show({ title: 'Save failed', message: 'Could not save layout. Please try again.', color: 'red' });
    }
  }

  const kpiWidgets = activeWidgets.filter(w => w.widgetType.startsWith('kpi_'));
  const otherWidgets = activeWidgets.filter(w => !w.widgetType.startsWith('kpi_'));

  return (
    <Stack gap="lg" className="page-enter">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            My Dashboard
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            Personalized view — add, remove, and reorder widgets to fit your workflow.
          </Text>
        </div>
        <Group gap="xs">
          {dirty && (
            <Button variant="subtle" size="sm" onClick={() => { setWidgets(savedWidgets); setDirty(false); }}>
              Discard
            </Button>
          )}
          <Button leftSection={<IconPlus size={15} />} variant="default" size="sm" onClick={() => setAddOpen(true)}>
            Add widget
          </Button>
          <Button
            leftSection={<IconCheck size={15} />}
            color="teal" size="sm"
            onClick={handleSave}
            loading={saveLayout.isPending}
            disabled={!dirty}
          >
            Save layout
          </Button>
        </Group>
      </Group>

      {isLoading && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {[1,2,3,4].map(i => <Skeleton key={i} height={100} radius="md" />)}
        </SimpleGrid>
      )}

      {!isLoading && (
        <>
          {/* KPI row */}
          {kpiWidgets.length > 0 && (
            <SimpleGrid cols={{ base: 2, sm: Math.min(kpiWidgets.length, 4) }} spacing="md">
              {kpiWidgets.map((w, i) => (
                <WidgetCard
                  key={i}
                  widget={w}
                  isDark={isDark}
                  onRemove={() => removeWidget(activeWidgets.indexOf(w))}
                  onMoveUp={() => moveWidget(activeWidgets.indexOf(w), -1)}
                  onMoveDown={() => moveWidget(activeWidgets.indexOf(w), 1)}
                  projects={projects}
                  resources={resources}
                  pendingApprovals={pendingApprovals}
                />
              ))}
            </SimpleGrid>
          )}

          {/* Other widgets — 2-column grid */}
          {otherWidgets.length > 0 && (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {otherWidgets.map((w, i) => (
                <WidgetCard
                  key={i}
                  widget={w}
                  isDark={isDark}
                  onRemove={() => removeWidget(activeWidgets.indexOf(w))}
                  onMoveUp={() => moveWidget(activeWidgets.indexOf(w), -1)}
                  onMoveDown={() => moveWidget(activeWidgets.indexOf(w), 1)}
                  projects={projects}
                  resources={resources}
                  pendingApprovals={pendingApprovals}
                />
              ))}
            </SimpleGrid>
          )}

          {activeWidgets.length === 0 && (
            <Paper withBorder radius="lg" p="xl" style={{ textAlign: 'center', background: isDark ? 'var(--mantine-color-dark-7)' : '#f8f9fa' }}>
              <IconLayoutDashboard size={48} color={AQUA} style={{ marginBottom: 12 }} />
              <Title order={4} mb={4} style={{ fontFamily: FONT_FAMILY }}>Your dashboard is empty</Title>
              <Text size="sm" c="dimmed" mb="md">Click "Add widget" to start building your personalized view.</Text>
              <Button leftSection={<IconPlus size={15} />} color="teal" onClick={() => setAddOpen(true)}>
                Add first widget
              </Button>
            </Paper>
          )}
        </>
      )}

      {/* Add widget modal */}
      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Add widget" size="lg">
        <SimpleGrid cols={3} spacing="sm">
          {WIDGET_DEFS.map(def => (
            <Card
              key={def.type}
              withBorder
              radius="md"
              p="sm"
              style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onClick={() => addWidget(def.type)}
            >
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon size={28} radius="sm" variant="light" color={def.color}>
                  {def.icon}
                </ThemeIcon>
                <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>
                  {def.label}
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Modal>

      {/* Dirty banner */}
      {dirty && (
        <Paper
          withBorder radius="md" p="sm"
          style={{
            background: isDark ? 'var(--mantine-color-dark-6)' : '#fffbe6',
            borderColor: isDark ? 'var(--mantine-color-yellow-8)' : '#ffe066',
            position: 'sticky', bottom: 16,
          }}
        >
          <Group justify="space-between">
            <Text size="sm" fw={500} c={isDark ? 'yellow' : 'orange.8'}>
              Layout has unsaved changes
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="subtle" color="gray" onClick={() => { setWidgets(savedWidgets); setDirty(false); }}>
                Discard
              </Button>
              <Button size="xs" color="teal" leftSection={<IconCheck size={13} />}
                onClick={handleSave} loading={saveLayout.isPending}>
                Save now
              </Button>
            </Group>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
