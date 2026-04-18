import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stack, Box, Group, Text, Badge, Button, Tooltip, ActionIcon } from '@mantine/core';
import { IconArrowLeft, IconGripVertical } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import * as RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactGridLayout: any = (RGL as any).default ?? RGL;
// @ts-expect-error -- unused
type _Layout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; };
import 'react-resizable/css/styles.css';
import apiClient from '../../../api/client';
import { useDashboard, useFields, useCustomFields, useAlerts } from './state/hooks';
import { DrillContext, GlobalFilterContext } from './state/contexts';
import { Dashboard, Widget, WidgetConfig, DrillFilter, GlobalFilters } from './state/types';
import { parseConfig, parsePosition } from './widgets/helpers';
import { WidgetCard } from './widgets/common/WidgetCard';
import { WidgetModal } from './widgets/config/WidgetModal';
import { GlobalFilterBar } from './toolbars/GlobalFilterBar';
import { DrillDrawer } from './toolbars/DrillDrawer';

function DashboardView({ dashboard, dark, onBack }: {
  dashboard: Dashboard; dark: boolean; onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data: full, isLoading } = useDashboard(dashboard.id);
  const { data: fields } = useFields();
  const { data: customFields } = useCustomFields();
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drill, setDrill] = useState<DrillFilter | null>(null);
  const [drillDrawerOpen, setDrillDrawerOpen] = useState(false);
  const { data: alerts = [] } = useAlerts(dashboard.id);

  const initGf = React.useMemo(() => {
    const raw = full?.global_filters;
    if (!raw) return {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw as GlobalFilters;
  }, [full?.global_filters]);
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>(initGf);
  useEffect(() => { setGlobalFilters(initGf); }, [JSON.stringify(initGf)]);

  useEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setGridWidth(w);
    });
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [full]);

  const widgets = full?.widgets ?? [];

  const addWidget = useMutation({
    mutationFn: (payload: { title: string; widget_type: string; config: WidgetConfig }) =>
      apiClient.post(`/power-dashboard/dashboards/${dashboard.id}/widgets`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] });
      notifications.show({ title: 'Widget added', message: '', color: 'green' });
    },
  });

  const updateWidget = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: unknown }) =>
      apiClient.put(`/power-dashboard/dashboards/${dashboard.id}/widgets/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] }),
  });

  const deleteWidget = useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/power-dashboard/dashboards/${dashboard.id}/widgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['power-dashboard', dashboard.id] });
      notifications.show({ title: 'Widget removed', message: '', color: 'orange' });
    },
  });

  const handleSaveWidget = (title: string, type: string, config: WidgetConfig) => {
    if (editingWidget) {
      updateWidget.mutate({ id: editingWidget.id, payload: { title, widget_type: type, config } });
    } else {
      addWidget.mutate({ title, widget_type: type, config });
    }
    setEditingWidget(null);
    setWidgetModalOpen(false);
  };

  const handleDuplicate = (w: Widget) => {
    const cfg = parseConfig(w.config);
    addWidget.mutate({ title: w.title + ' (copy)', widget_type: w.widget_type, config: cfg });
  };

  const [_saving, setSaving] = useState(false);

  const rglLayout = widgets.map(w => {
    const pos = parsePosition(w.position);
    return {
      i: String(w.id),
      x: pos.x ?? 0,
      y: pos.y ?? 0,
      w: pos.w ?? 6,
      h: pos.h ?? 4,
      minW: 2,
      minH: 2,
    };
  });

  const savePosition = useCallback((item: any) => {
    const wid = parseInt(item.i);
    const widget = widgets.find(w => w.id === wid);
    if (!widget) return;
    const prev = parsePosition(widget.position);
    if (prev.x === item.x && prev.y === item.y && prev.w === item.w && prev.h === item.h) return;
    setSaving(true);
    updateWidget.mutate(
      { id: wid, payload: { position: { x: item.x, y: item.y, w: item.w, h: item.h } } },
      { onSettled: () => setSaving(false) }
    );
  }, [widgets, updateWidget]);

  const handleDragStop = useCallback((_l: any, _o: any, n: any) => savePosition(n), [savePosition]);
  const handleResizeStop = useCallback((_l: any, _o: any, n: any) => savePosition(n), [savePosition]);

  const handleReposition = useCallback((widgetId: number, pos: { x: number; y: number; w: number; h: number }) => {
    setSaving(true);
    updateWidget.mutate(
      { id: widgetId, payload: { position: pos } },
      { onSettled: () => setSaving(false) }
    );
  }, [updateWidget]);

  const ROW_H = 80;
  const COLS = 12;

  return (
    <GlobalFilterContext.Provider value={{ globalFilters, setGlobalFilters }}>
    <DrillContext.Provider value={{ drill, setDrill, openDrawer: () => setDrillDrawerOpen(true) }}>
    <DrillDrawer drill={drill} isOpen={drillDrawerOpen} dark={dark} onClose={() => { setDrillDrawerOpen(false); }} />
    <Stack gap="md">
      {/* Alert banner */}
      {alerts.length > 0 && (
        <Box style={{
          padding: '8px 14px', borderRadius: 8,
          backgroundColor: alerts.some(a => a.status === 'critical') ? 'rgba(231,76,60,0.12)' : 'rgba(243,156,18,0.12)',
          border: `1px solid ${alerts.some(a => a.status === 'critical') ? '#e74c3c' : '#f39c12'}`,
        }}>
          <Group gap={8} wrap="wrap">
            <Text size="sm" fw={700} c={alerts.some(a => a.status === 'critical') ? 'red' : 'yellow'}>
              {alerts.some(a => a.status === 'critical') ? '🔴' : '🟡'} {alerts.length} threshold alert{alerts.length > 1 ? 's' : ''}
            </Text>
            {alerts.map(a => (
              <Badge key={a.widget_id} size="sm" color={a.status === 'critical' ? 'red' : 'yellow'} variant="light">
                {a.title}: {a.value} {a.status === 'critical' ? '> critical' : '> warning'}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* Back button and title */}
      <Group gap="sm">
        <Tooltip label="Back to dashboards">
          <ActionIcon variant="subtle" onClick={onBack}
      aria-label="Go back"
    ><IconArrowLeft size={18} /></ActionIcon>
        </Tooltip>
        <div>
          <Text fw={700} size="lg">{dashboard.name}</Text>
          {dashboard.description && <Text size="xs" c="dimmed">{dashboard.description}</Text>}
        </div>
      </Group>

      {/* Global filter bar */}
      <GlobalFilterBar dashboardId={dashboard.id} filters={globalFilters} onChange={setGlobalFilters} dark={dark} />

      {/* Add widget button */}
      <Button leftSection={<IconGripVertical size={16} />} onClick={() => { setEditingWidget(null); setWidgetModalOpen(true); }}>
        Add Widget
      </Button>

      {/* Grid layout with widgets */}
      <Box ref={gridRef} style={{ position: 'relative', width: '100%' }}>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : widgets.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">No widgets yet. Add your first widget above.</Text>
        ) : (
          <ReactGridLayout
            className="layout"
            layout={rglLayout}
            cols={COLS}
            rowHeight={ROW_H}
            width={gridWidth}
            isDraggable
            isResizable
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            containerPadding={[0, 0]}
            margin={[10, 10]}
            compactType="vertical"
            preventCollision={false}
            draggableHandle=".widget-drag-handle"
          >
            {widgets.map(w => (
              <Box key={w.id} style={{ overflow: 'hidden' }}>
                <WidgetCard
                  widget={w}
                  dark={dark}
                  onEdit={() => { setEditingWidget(w); setWidgetModalOpen(true); }}
                  onDelete={() => deleteWidget.mutate(w.id)}
                  onDuplicate={() => handleDuplicate(w)}
                  onReposition={(pos) => handleReposition(w.id, pos)}
                />
              </Box>
            ))}
          </ReactGridLayout>
        )}
      </Box>
    </Stack>

    <WidgetModal
      opened={widgetModalOpen}
      onClose={() => { setWidgetModalOpen(false); setEditingWidget(null); }}
      onSave={handleSaveWidget}
      initial={editingWidget ? { title: editingWidget.title, type: editingWidget.widget_type, config: parseConfig(editingWidget.config) } : undefined}
      fields={fields}
      customFields={customFields}
      dark={dark}
    />
    </DrillContext.Provider>
    </GlobalFilterContext.Provider>
  );
}

export default DashboardView;
