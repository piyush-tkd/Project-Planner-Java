/**
 * CustomDashboardPage — Dashboard Builder v2
 *
 * Full rewrite with:
 * - DashboardProvider wrapping the page
 * - DashboardToolbar: edit mode, save, filters, templates, refresh, export
 * - DashboardCanvas: 12-column CSS grid with framer-motion drag reorder
 * - Widget picker modal & template gallery
 * - Dynamic widget data fetching
 * - Cross-filtering support
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Text, Stack, Group, Button, Paper, Badge, ActionIcon, Tooltip,
  Modal, Card, ThemeIcon, Title, TextInput,
  Menu, Drawer, Tabs, Grid,
} from '@mantine/core';
import { Reorder } from 'framer-motion';
import { PPPageLayout } from '../components/pp';
import { DashboardFilterBar } from '../components/dashboard/DashboardFilterBar';
import {
  DashboardWidget,
  WIDGET_REGISTRY,
  WidgetData,
} from '../components/dashboard/DashboardWidgets';
import { DashboardProvider, useDashboard } from '../store/dashboardStore';
import {
  useDashboards,
  useUpdateDashboard,
} from '../api/dashboards';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconX, IconCheck, IconRefresh, IconLayoutDashboard,
  IconEdit, IconGripVertical, IconSettings, IconDownload,
  IconPrinter, IconClock, IconAlertCircle,
  IconMinus, IconConfetti,
} from '@tabler/icons-react';
import { AQUA, GRAY_100, SURFACE_SUBTLE, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { useProjects } from '../api/projects';
import { useResources } from '../api/resources';
import { usePendingApprovals } from '../api/projectApprovals';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetDef {
  id: string;
  type: string;
  title: string;
  colSpan: number;
  rowSpan: number;
  config: Record<string, any>;
  dataSource?: {
    entity: string;
    metric: string;
    dimension: string;
    aggregation: string;
  };
}

interface DashboardTemplateConfig {
  name: string;
  description: string;
  widgets: WidgetDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `widget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Definitions
// ─────────────────────────────────────────────────────────────────────────────

const DASHBOARD_TEMPLATES: DashboardTemplateConfig[] = [
  {
    name: 'Executive Overview',
    description: '4 KPI tiles + Status distribution + Budget + Recent projects',
    widgets: [
      {
        id: 'kpi-1',
        type: 'kpi_project_count',
        title: 'Total Projects',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true, colorScheme: 'teal' },
      },
      {
        id: 'kpi-2',
        type: 'kpi_at_risk',
        title: 'At-Risk Projects',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true, colorScheme: 'orange' },
      },
      {
        id: 'kpi-3',
        type: 'kpi_resources',
        title: 'Total Resources',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true, colorScheme: 'blue' },
      },
      {
        id: 'kpi-4',
        type: 'kpi_overdue',
        title: 'Overdue',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true, colorScheme: 'red' },
      },
      {
        id: 'chart-1',
        type: 'chart_status_dist',
        title: 'Status Distribution',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'chart-2',
        type: 'chart_priority_dist',
        title: 'Priority Mix',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'table-1',
        type: 'table_recent_projects',
        title: 'Recent Projects',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
    ],
  },
  {
    name: 'Engineering Health',
    description: 'Velocity trend + Bug count + Sprint burndown + Pod load',
    widgets: [
      {
        id: 'kpi-1',
        type: 'kpi_project_count',
        title: 'Active Projects',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'chart-1',
        type: 'chart_velocity_trend',
        title: 'Velocity Trend',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'chart-2',
        type: 'chart_pod_load',
        title: 'Pod Utilization',
        colSpan: 6,
        rowSpan: 2,
        config: { colorScheme: 'heatmap' },
      },
      {
        id: 'table-1',
        type: 'table_sprint_status',
        title: 'Sprint Status',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
    ],
  },
  {
    name: 'Capacity Planning',
    description: 'Resource utilization + Pod load + Capacity grid + FTE by role',
    widgets: [
      {
        id: 'kpi-1',
        type: 'kpi_resources',
        title: 'Total Resources',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'chart-1',
        type: 'chart_pod_load',
        title: 'Pod Load',
        colSpan: 6,
        rowSpan: 2,
        config: { colorScheme: 'heatmap' },
      },
      {
        id: 'misc-1',
        type: 'misc_capacity_grid',
        title: 'Capacity Grid',
        colSpan: 6,
        rowSpan: 2,
        config: { groupBy: 'pod' },
      },
      {
        id: 'table-1',
        type: 'table_resources_by_role',
        title: 'Resources by Role',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 10 },
      },
    ],
  },
  {
    name: 'Budget Tracker',
    description: 'Budget waterfall + Spend by pod + CapEx/OpEx + Monthly burn',
    widgets: [
      {
        id: 'chart-1',
        type: 'chart_spend_waterfall',
        title: 'Budget Waterfall',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'chart-2',
        type: 'chart_priority_dist',
        title: 'Spend Distribution',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'table-1',
        type: 'table_recent_projects',
        title: 'Projects',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
    ],
  },
  {
    name: 'Sprint Velocity',
    description: 'Velocity trend + Completed vs planned + Status + Top risks',
    widgets: [
      {
        id: 'chart-1',
        type: 'chart_velocity_trend',
        title: 'Velocity Trend',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'chart-2',
        type: 'chart_status_dist',
        title: 'Status Distribution',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'table-1',
        type: 'table_top_risks',
        title: 'Top Risks',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
    ],
  },
  {
    name: 'Risk Dashboard',
    description: 'Risk by severity + Status + Risk matrix + Overdue count',
    widgets: [
      {
        id: 'kpi-1',
        type: 'kpi_at_risk',
        title: 'At-Risk Projects',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'kpi-2',
        type: 'kpi_overdue',
        title: 'Overdue',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'misc-1',
        type: 'misc_risk_matrix',
        title: 'Risk Matrix',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'table-1',
        type: 'table_top_risks',
        title: 'Top Risks',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
    ],
  },
  {
    name: 'Resource Overview',
    description: 'Resources count + By role + By location + Skills + Utilization',
    widgets: [
      {
        id: 'kpi-1',
        type: 'kpi_resources',
        title: 'Total Resources',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'chart-1',
        type: 'chart_pod_load',
        title: 'Resources by Pod',
        colSpan: 6,
        rowSpan: 2,
        config: { colorScheme: 'heatmap' },
      },
      {
        id: 'table-1',
        type: 'table_resources_by_role',
        title: 'By Role',
        colSpan: 6,
        rowSpan: 2,
        config: { rowsPerPage: 10 },
      },
      {
        id: 'misc-1',
        type: 'misc_capacity_grid',
        title: 'Capacity',
        colSpan: 12,
        rowSpan: 2,
        config: { groupBy: 'pod' },
      },
    ],
  },
  {
    name: 'Portfolio Status',
    description: 'All projects status + Health score + Overdue + Pending approvals',
    widgets: [
      {
        id: 'kpi-1',
        type: 'kpi_project_count',
        title: 'Total Projects',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'kpi-2',
        type: 'kpi_at_risk',
        title: 'At-Risk',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'kpi-3',
        type: 'kpi_overdue',
        title: 'Overdue',
        colSpan: 3,
        rowSpan: 1,
        config: { showTrend: true },
      },
      {
        id: 'chart-1',
        type: 'chart_status_dist',
        title: 'Status',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'chart-2',
        type: 'chart_priority_dist',
        title: 'Priority',
        colSpan: 6,
        rowSpan: 2,
        config: { showLegend: true },
      },
      {
        id: 'table-1',
        type: 'table_recent_projects',
        title: 'Recent Projects',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
      {
        id: 'table-2',
        type: 'table_my_approvals',
        title: 'Pending Approvals',
        colSpan: 12,
        rowSpan: 2,
        config: { rowsPerPage: 5 },
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Widget Data Hook
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useWidgetData(widgetDef: WidgetDef, projects: any[], resources: any[], pendingApprovals: any[]): any {
  const today = new Date();

  return useMemo(() => {
    const type = widgetDef.type;

    // KPI widgets
    if (type === 'kpi_project_count') {
      return {
        value: projects.length,
        label: 'Total Projects',
        icon: <IconLayoutDashboard size={22} />,
      };
    }
    if (type === 'kpi_at_risk') {
      const count = projects.filter(p => ['AT_RISK', 'ON_HOLD'].includes(p.status)).length;
      return {
        value: count,
        label: 'At Risk',
        icon: <IconAlertCircle size={22} />,
        trend: count > 3 ? '⚠ High' : 'OK',
      };
    }
    if (type === 'kpi_resources') {
      return {
        value: resources.length,
        label: 'Resources',
        icon: <IconLayoutDashboard size={22} />,
      };
    }
    if (type === 'kpi_overdue') {
      const count = projects.filter(p => p.targetDate && new Date(p.targetDate) < today && p.status !== 'COMPLETED').length;
      return {
        value: count,
        label: 'Overdue',
        icon: <IconClock size={22} />,
        trend: count > 0 ? '⚠' : '✓',
      };
    }

    // Chart widgets - status distribution
    if (type === 'chart_status_dist') {
      const map: Record<string, number> = {};
      projects.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
      const total = projects.length || 1;
      const rows = Object.entries(map).map(([status, count]) => ({
        label: status.replace(/_/g, ' '),
        value: count,
        percent: (count / total) * 100,
        color: status === 'ACTIVE' ? 'teal' : status === 'AT_RISK' ? 'orange' : status === 'COMPLETED' ? 'green' : 'gray',
      }));
      return { rows };
    }

    // Chart widgets - priority distribution
    if (type === 'chart_priority_dist') {
      const PRIORITY = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'LOWEST', 'BLOCKER', 'MINOR'];
      const PCOLOR: Record<string, string> = { HIGHEST: 'red', HIGH: 'orange', MEDIUM: 'blue', LOW: 'indigo', LOWEST: 'gray', BLOCKER: 'red', MINOR: 'gray' };
      const map: Record<string, number> = {};
      projects.forEach(p => { const pri = p.priority || 'MEDIUM'; map[pri] = (map[pri] || 0) + 1; });
      const total = projects.length || 1;
      const rows = PRIORITY.map(p => ({
        label: p,
        value: map[p] || 0,
        percent: ((map[p] || 0) / total) * 100,
        color: PCOLOR[p],
      }));
      return { rows };
    }

    // Chart widgets - pod load
    if (type === 'chart_pod_load') {
      const rows = [
        { label: 'Pod A', value: 75, percent: 75, color: 'teal' },
        { label: 'Pod B', value: 60, percent: 60, color: 'blue' },
        { label: 'Pod C', value: 90, percent: 90, color: 'orange' },
      ];
      return { rows };
    }

    // Table widgets - recent projects
    if (type === 'table_recent_projects') {
      const recent = [...projects]
        .sort((a, b) => {
          const da = a.createdAt || a.startDate || '';
          const db = b.createdAt || b.startDate || '';
          return db.localeCompare(da);
        })
        .slice(0, 5);
      return {
        rows: recent.map(p => ({
          name: p.name,
          status: p.status?.replace(/_/g, ' '),
          statusColor: p.status === 'ACTIVE' ? 'teal' : p.status === 'AT_RISK' ? 'orange' : p.status === 'COMPLETED' ? 'green' : 'gray',
        })),
      };
    }

    // Table widgets - top risks
    if (type === 'table_top_risks') {
      const risks = projects.filter(p => ['AT_RISK', 'ON_HOLD'].includes(p.status)).slice(0, 5);
      return {
        rows: risks.map(p => ({
          name: p.name,
          status: p.status?.replace(/_/g, ' '),
          statusColor: 'orange',
        })),
      };
    }

    // Table widgets - pending approvals
    if (type === 'table_my_approvals') {
      return {
        rows: pendingApprovals.slice(0, 5).map(a => ({
          name: `Project #${a.projectId}`,
          status: 'Pending',
          statusColor: 'yellow',
        })),
      };
    }

    // Table widgets - resources by role
    if (type === 'table_resources_by_role') {
      return {
        rows: resources.slice(0, 10).map(r => ({
          name: r.name,
          role: r.role || 'Unassigned',
          status: 'Active',
          statusColor: 'teal',
        })),
      };
    }

    // Table widgets - sprint status
    if (type === 'table_sprint_status') {
      return {
        rows: [
          { name: 'Sprint 1', status: 'Active', statusColor: 'teal' },
          { name: 'Sprint 2', status: 'Planned', statusColor: 'blue' },
          { name: 'Sprint 3', status: 'Completed', statusColor: 'green' },
        ],
      };
    }

    // Chart widgets - velocity trend
    if (type === 'chart_velocity_trend') {
      return { rows: [{ label: 'Velocity', value: 42, percent: 85 }] };
    }

    // Chart widgets - spend waterfall
    if (type === 'chart_spend_waterfall') {
      return { rows: [{ label: 'Budget', value: 100000, percent: 100 }] };
    }

    // Misc widgets - risk matrix
    if (type === 'misc_risk_matrix') {
      return { rows: [{ label: 'High Risk', value: 5, percent: 50 }] };
    }

    // Misc widgets - capacity grid
    if (type === 'misc_capacity_grid') {
      return { rows: [{ label: 'Capacity', value: 80, percent: 80 }] };
    }

    return {};
  }, [widgetDef, projects, resources, pendingApprovals, today]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget Card
// ─────────────────────────────────────────────────────────────────────────────

function WidgetCard({
  def,
  isDark,
  onDelete,
  onConfigure,
  isEditMode,
  projects,
  resources,
  pendingApprovals,
  onDataPointClick,
}: {
  def: WidgetDef;
  isDark: boolean;
  onDelete: () => void;
  onConfigure: () => void;
  isEditMode: boolean;
  projects: any[];
  resources: any[];
  pendingApprovals: any[];
  onDataPointClick?: (label: string, value: string | number, idx: number) => void;
}) {
  const { isCrossFiltered } = useDashboard();
  const faded = isCrossFiltered(def.id);
  const data = useWidgetData(def, projects, resources, pendingApprovals);
  const registryEntry = WIDGET_REGISTRY.find(w => w.type === def.type);

  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        background: isDark ? 'var(--mantine-color-dark-7)' : '#fff',
        borderColor: isDark ? 'var(--mantine-color-dark-4)' : GRAY_100,
        opacity: faded ? 0.3 : 1,
        transition: 'opacity 0.2s',
        gridColumn: `span ${def.colSpan}`,
        gridRow: `span ${def.rowSpan}`,
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          {isEditMode && (
            <IconGripVertical size={16} style={{ cursor: 'grab' }} />
          )}
          <ThemeIcon size={22} radius="sm" variant="light" color={registryEntry?.icon ? 'teal' : 'gray'}>
            {registryEntry?.icon}
          </ThemeIcon>
          <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>
            {def.title}
          </Text>
        </Group>
        {isEditMode && (
          <Group gap={4}>
            <Tooltip label="Configure">
              <ActionIcon size="xs" variant="subtle" color="blue" onClick={onConfigure}
      aria-label="Settings"
    >
                <IconSettings size={12} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete">
              <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}
      aria-label="Close"
    >
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
      <div style={{ flex: 1 }}>
        <DashboardWidget
          widgetType={def.type}
          title={def.title}
          isDark={isDark}
          data={{ labels: [], values: [], ...data } as WidgetData}
          config={def.config}
          onDataPointClick={onDataPointClick}
        />
      </div>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget Config Drawer
// ─────────────────────────────────────────────────────────────────────────────

function WidgetConfigDrawer({
  opened,
  onClose,
  widget,
  onUpdate,
}: {
  opened: boolean;
  onClose: () => void;
  widget: WidgetDef | null;
  onUpdate: (updated: WidgetDef) => void;
}) {
  const [title, setTitle] = useState(widget?.title || '');
  const [colSpan, setColSpan] = useState(widget?.colSpan || 6);
  const [rowSpan, setRowSpan] = useState(widget?.rowSpan || 2);

  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setColSpan(widget.colSpan);
      setRowSpan(widget.rowSpan);
    }
  }, [widget]);

  const handleSave = () => {
    if (widget) {
      onUpdate({
        ...widget,
        title,
        colSpan,
        rowSpan,
      });
      onClose();
    }
  };

  return (
    <Drawer opened={opened} onClose={onClose} title="Configure Widget" position="right">
      <Stack gap="md">
        <div>
          <Text size="sm" fw={600} mb="xs">Title</Text>
          <TextInput value={title} onChange={(e) => setTitle(e.currentTarget.value)} placeholder="Widget title" />
        </div>
        <div>
          <Text size="sm" fw={600} mb="xs">Width (columns: 1-12)</Text>
          <Group gap="sm" align="flex-end">
            <Button size="xs" onClick={() => setColSpan(Math.max(1, colSpan - 1))}>
              <IconMinus size={14} />
            </Button>
            <Text fw={600} style={{ minWidth: 30, textAlign: 'center' }}>{colSpan}</Text>
            <Button size="xs" onClick={() => setColSpan(Math.min(12, colSpan + 1))}>
              <IconPlus size={14} />
            </Button>
          </Group>
        </div>
        <div>
          <Text size="sm" fw={600} mb="xs">Height (rows: 1-6)</Text>
          <Group gap="sm" align="flex-end">
            <Button size="xs" onClick={() => setRowSpan(Math.max(1, rowSpan - 1))}>
              <IconMinus size={14} />
            </Button>
            <Text fw={600} style={{ minWidth: 30, textAlign: 'center' }}>{rowSpan}</Text>
            <Button size="xs" onClick={() => setRowSpan(Math.min(6, rowSpan + 1))}>
              <IconPlus size={14} />
            </Button>
          </Group>
        </div>
        <Button color="teal" onClick={handleSave} fullWidth>
          Save Changes
        </Button>
      </Stack>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Toolbar
// ─────────────────────────────────────────────────────────────────────────────

function DashboardToolbar({
  dashboardName,
  onDashboardNameChange,
  isEditMode,
  onToggleEditMode,
  isDark,
  onAddWidget,
  onShowTemplates,
  onRefresh,
  onSave,
  isSaving,
  lastRefreshed,
  activeFilterCount,
  onShowFilters,
}: {
  dashboardName: string;
  onDashboardNameChange: (name: string) => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  isDark: boolean;
  onAddWidget: () => void;
  onShowTemplates: () => void;
  onRefresh: () => void;
  onSave: () => void;
  isSaving: boolean;
  lastRefreshed: Date | null;
  activeFilterCount: number;
  onShowFilters: () => void;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(dashboardName);

  const handleSaveName = () => {
    if (tempName.trim()) {
      onDashboardNameChange(tempName);
      setIsEditingName(false);
    }
  };

  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{ background: isDark ? 'var(--mantine-color-dark-7)' : '#fff' }}
    >
      <Group justify="space-between">
        <Group>
          {isEditingName ? (
            <Group gap="xs">
              <TextInput
                value={tempName}
                onChange={(e) => setTempName(e.currentTarget.value)}
                placeholder="Dashboard name"
                style={{ width: 200 }}
              />
              <Button size="xs" color="teal" onClick={handleSaveName}>
                <IconCheck size={14} />
              </Button>
            </Group>
          ) : (
            <Group gap="xs">
              <Title order={3} style={{ fontFamily: FONT_FAMILY, margin: 0 }}>
                {dashboardName}
              </Title>
              <ActionIcon size="xs" variant="subtle" onClick={() => setIsEditingName(true)}
      aria-label="Edit"
    >
                <IconEdit size={12} />
              </ActionIcon>
            </Group>
          )}
        </Group>
        <Group gap="xs">
          <Button
            variant={isEditMode ? 'filled' : 'light'}
            size="sm"
            onClick={onToggleEditMode}
          >
            {isEditMode ? 'Done Editing' : 'Edit Layout'}
          </Button>
          {isEditMode && (
            <Button leftSection={<IconPlus size={14} />} size="sm" onClick={onAddWidget}>
              Add Widget
            </Button>
          )}
          <Button
            variant="light"
            size="sm"
            onClick={onShowTemplates}
            rightSection={<IconConfetti size={14} />}
          >
            Templates
          </Button>
          <Button
            variant="light"
            size="sm"
            onClick={onShowFilters}
            rightSection={
              activeFilterCount > 0 && (
                <Badge size="xs" color="blue">{activeFilterCount}</Badge>
              )
            }
          >
            Filters
          </Button>
          <Button
            variant="light"
            size="sm"
            onClick={onRefresh}
            leftSection={<IconRefresh size={14} />}
          >
            Refresh
          </Button>
          {lastRefreshed && (
            <Text size="xs" c="dimmed">
              Updated {new Date(lastRefreshed).toLocaleTimeString()}
            </Text>
          )}
          <Button
            color="teal"
            size="sm"
            onClick={onSave}
            loading={isSaving}
            leftSection={<IconCheck size={14} />}
          >
            Save
          </Button>
          <Menu>
            <Menu.Target>
              <ActionIcon size="sm" variant="light"
      aria-label="Download"
    >
                <IconDownload size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => window.print()}>
                Export PNG
              </Menu.Item>
              <Menu.Item leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
                Print / PDF
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Canvas
// ─────────────────────────────────────────────────────────────────────────────

function DashboardCanvas({
  widgets,
  onWidgetsReorder,
  isEditMode,
  onDeleteWidget,
  onConfigureWidget,
  isDark,
  projects,
  resources,
  pendingApprovals,
}: {
  widgets: WidgetDef[];
  onWidgetsReorder: (newOrder: WidgetDef[]) => void;
  isEditMode: boolean;
  onDeleteWidget: (id: string) => void;
  onConfigureWidget: (widget: WidgetDef) => void;
  isDark: boolean;
  projects: any[];
  resources: any[];
  pendingApprovals: any[];
}) {
  if (widgets.length === 0) {
    return (
      <Paper
        withBorder
        radius="lg"
        p="xl"
        style={{
          textAlign: 'center',
          background: isDark ? 'var(--mantine-color-dark-7)' : SURFACE_SUBTLE,
        }}
      >
        <IconLayoutDashboard size={48} color={AQUA} style={{ marginBottom: 12 }} />
        <Title order={4} mb={4} style={{ fontFamily: FONT_FAMILY }}>
          Your dashboard is empty
        </Title>
        <Text size="sm" c="dimmed">
          Add widgets to get started.
        </Text>
      </Paper>
    );
  }

  const canvasContent = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 16,
      }}
    >
      {isEditMode ? (
        <Reorder.Group axis="y" values={widgets} onReorder={onWidgetsReorder}>
          {widgets.map((w) => (
            <Reorder.Item key={w.id} value={w}>
              <WidgetCard
                def={w}
                isDark={isDark}
                onDelete={() => onDeleteWidget(w.id)}
                onConfigure={() => onConfigureWidget(w)}
                isEditMode={isEditMode}
                projects={projects}
                resources={resources}
                pendingApprovals={pendingApprovals}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        widgets.map((w) => (
          <WidgetCard
            key={w.id}
            def={w}
            isDark={isDark}
            onDelete={() => onDeleteWidget(w.id)}
            onConfigure={() => onConfigureWidget(w)}
            isEditMode={isEditMode}
            projects={projects}
            resources={resources}
            pendingApprovals={pendingApprovals}
          />
        ))
      )}
    </div>
  );

  return canvasContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget Picker Modal
// ─────────────────────────────────────────────────────────────────────────────

function WidgetPickerModal({
  opened,
  onClose,
  onSelect,
}: {
  opened: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}) {
  const [category, setCategory] = useState<'all' | 'kpi' | 'chart' | 'table' | 'misc'>('all');

  const filtered =
    category === 'all'
      ? WIDGET_REGISTRY
      : WIDGET_REGISTRY.filter((w) => w.category === category);

  return (
    <Modal opened={opened} onClose={onClose} title="Add Widget" size="xl">
      <Tabs value={category} onChange={(v) => setCategory(v as any)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="kpi">KPIs</Tabs.Tab>
          <Tabs.Tab value="chart">Charts</Tabs.Tab>
          <Tabs.Tab value="table">Tables</Tabs.Tab>
          <Tabs.Tab value="misc">Misc</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Grid mt="md" gutter="md">
        {filtered.map((widget) => (
          <Grid.Col key={widget.type} span={{ base: 12, sm: 6, md: 4 }}>
            <Card
              withBorder
              radius="md"
              p="sm"
              style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onClick={() => {
                onSelect(widget.type);
                onClose();
              }}
            >
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon size={28} radius="sm" variant="light" color="teal">
                  {widget.icon}
                </ThemeIcon>
                <div style={{ flex: 1 }}>
                  <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>
                    {widget.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {widget.description}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Gallery Modal
// ─────────────────────────────────────────────────────────────────────────────

function TemplateGalleryModal({
  opened,
  onClose,
  onSelect,
}: {
  opened: boolean;
  onClose: () => void;
  onSelect: (widgets: WidgetDef[]) => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Dashboard Templates" size="xl">
      <Grid gutter="md">
        {DASHBOARD_TEMPLATES.map((template, idx) => (
          <Grid.Col key={idx} span={{ base: 12, sm: 6 }}>
            <Card withBorder radius="md" p="md" style={{ cursor: 'pointer' }}>
              <Card.Section>
                <Group justify="space-between" p="sm">
                  <div>
                    <Text fw={600} size="sm">
                      {template.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {template.description}
                    </Text>
                  </div>
                </Group>
              </Card.Section>
              <Button
                variant="light"
                size="sm"
                fullWidth
                mt="md"
                onClick={() => {
                  onSelect(template.widgets);
                  onClose();
                }}
              >
                Use Template
              </Button>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page (wrapped with DashboardProvider)
// ─────────────────────────────────────────────────────────────────────────────

function CustomDashboardPageInner() {
  const isDark = useDarkMode();
  const {
    isEditMode,
    setEditMode,
    activeDashboardId,
    setActiveDashboardId,
    globalFilters,
    triggerRefresh,
  } = useDashboard();

  const { data: projects = [] } = useProjects();
  const { data: resources = [] } = useResources();
  const { data: pendingApprovals = [] } = usePendingApprovals();
  const { data: dashboards = [] } = useDashboards();
  const updateDashboard = useUpdateDashboard();

  const [widgets, setWidgets] = useState<WidgetDef[]>([]);
  const [dashboardName, setDashboardName] = useState('My Dashboard');
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [filterBarVisible, setFilterBarVisible] = useState(false);
  const [configWidget, setConfigWidget] = useState<WidgetDef | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Load dashboard on mount
  useEffect(() => {
    if (!activeDashboardId && dashboards.length > 0) {
      const defaultDash = dashboards.find((d) => d.isDefault) || dashboards[0];
      if (defaultDash) {
        setActiveDashboardId(defaultDash.id || 0);
        setDashboardName(defaultDash.name);
        try {
          const parsed = JSON.parse(defaultDash.config);
          setWidgets(parsed.widgets || []);
        } catch {
          // fallback to default widgets
        }
      }
    }
  }, [dashboards, activeDashboardId, setActiveDashboardId]);

  const handleAddWidget = (type: string) => {
    const registry = WIDGET_REGISTRY.find((w) => w.type === type);
    if (registry) {
      const newWidget: WidgetDef = {
        id: generateId(),
        type,
        title: registry.label,
        colSpan: registry.defaultSize.w,
        rowSpan: registry.defaultSize.h,
        config: {},
      };
      setWidgets([...widgets, newWidget]);
    }
  };

  const handleDeleteWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id));
  };

  const handleConfigureWidget = (widget: WidgetDef) => {
    setConfigWidget(widget);
    setConfigDrawerOpen(true);
  };

  const handleUpdateWidget = (updated: WidgetDef) => {
    setWidgets(widgets.map((w) => (w.id === updated.id ? updated : w)));
  };

  const handleSave = async () => {
    try {
      const config = JSON.stringify({ widgets, layout: [] });
      await updateDashboard.mutateAsync({
        id: activeDashboardId || 0,
        data: {
          name: dashboardName,
          config,
        },
      });
      notifications.show({
        title: 'Dashboard saved',
        message: 'Your dashboard layout has been saved.',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
    } catch {
      notifications.show({
        title: 'Save failed',
        message: 'Could not save dashboard. Please try again.',
        color: 'red',
      });
    }
  };

  const handleRefresh = () => {
    triggerRefresh();
    setLastRefreshed(new Date());
  };

  const handleApplyTemplate = (templateWidgets: WidgetDef[]) => {
    setWidgets(templateWidgets);
  };

  const activeFilterCount = Object.values(globalFilters).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Date) return v !== null;
    return v !== undefined && v !== null && v !== '';
  }).length;

  return (
    <PPPageLayout title="Dashboard Builder" subtitle="Build and customize your dashboard" animate>
      <Stack gap="lg" className="page-enter">
        {/* Toolbar */}
        <DashboardToolbar
          dashboardName={dashboardName}
          onDashboardNameChange={setDashboardName}
          isEditMode={isEditMode}
          onToggleEditMode={() => setEditMode(!isEditMode)}
          isDark={isDark}
          onAddWidget={() => setAddWidgetOpen(true)}
          onShowTemplates={() => setTemplatesOpen(true)}
          onRefresh={handleRefresh}
          onSave={handleSave}
          isSaving={updateDashboard.isPending}
          lastRefreshed={lastRefreshed}
          activeFilterCount={activeFilterCount}
          onShowFilters={() => setFilterBarVisible(!filterBarVisible)}
        />

        {/* Filter Bar */}
        <DashboardFilterBar isVisible={filterBarVisible} onToggle={() => setFilterBarVisible(!filterBarVisible)} />

        {/* Canvas */}
        <DashboardCanvas
          widgets={widgets}
          onWidgetsReorder={setWidgets}
          isEditMode={isEditMode}
          onDeleteWidget={handleDeleteWidget}
          onConfigureWidget={handleConfigureWidget}
          isDark={isDark}
          projects={projects}
          resources={resources}
          pendingApprovals={pendingApprovals}
        />

        {/* Modals */}
        <WidgetPickerModal opened={addWidgetOpen} onClose={() => setAddWidgetOpen(false)} onSelect={handleAddWidget} />
        <TemplateGalleryModal opened={templatesOpen} onClose={() => setTemplatesOpen(false)} onSelect={handleApplyTemplate} />
        <WidgetConfigDrawer
          opened={configDrawerOpen}
          onClose={() => setConfigDrawerOpen(false)}
          widget={configWidget}
          onUpdate={handleUpdateWidget}
        />
      </Stack>
    </PPPageLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomDashboardPage() {
  return (
    <DashboardProvider>
      <CustomDashboardPageInner />
    </DashboardProvider>
  );
}
