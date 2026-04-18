import React, { useCallback, useContext } from 'react';
import { Card, Box, Group, Text, HoverCard, ActionIcon, Tooltip, Stack, Loader, Divider } from '@mantine/core';
import { IconEdit, IconCopy, IconTrash } from '@tabler/icons-react';
import { WidgetConfig, Widget, DrillFilter } from '../../state/types';
import { useWidgetData } from '../../state/hooks';
import { DrillContext, GlobalFilterContext } from '../../state/contexts';
import { parseConfig, generateInsights, getWidgetColor } from '../helpers';
import { WIDGET_HELP } from '../constants';
import { renderWidget } from '../WidgetRegistry';
import { EmptyState } from '../ChartWidgets';
import WidgetLayoutPopover from './WidgetLayoutPopover';

function WidgetCard({ widget, dark, onEdit, onDelete, onDuplicate, onReposition }: {
  widget: Widget; dark: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
  onReposition: (pos: { x: number; y: number; w: number; h: number }) => void;
}) {
  const baseConfig = parseConfig(widget.config);
  const { drill }          = useContext(DrillContext);
  const { globalFilters }  = useContext(GlobalFilterContext);

  // Merge global filters + drill filter into config
  const config: WidgetConfig = React.useMemo(() => {
    // Skip merging for text/layout widgets
    if (['text_block','section_header','countdown'].includes(baseConfig.source ?? '')) return baseConfig;

    const extra: { field: string; op: string; value: string }[] = [];
    // Global filters
    if (globalFilters.date_preset) {/* handled below */}
    if (globalFilters.project_key) extra.push({ field: 'project_key', op: 'eq', value: globalFilters.project_key });
    if (globalFilters.assignee)    extra.push({ field: 'assignee_display_name', op: 'like', value: globalFilters.assignee });
    if (globalFilters.sprint_name) extra.push({ field: 'sprint_name', op: 'eq', value: globalFilters.sprint_name });
    // Drill filter
    if (drill && baseConfig.groupBy) {
      const alreadyFiltered = baseConfig.filters.some(f => f.field === drill.field);
      if (!alreadyFiltered) extra.push({ field: drill.field, op: 'eq', value: drill.value });
    }
    if (!extra.length && !globalFilters.date_preset) return baseConfig;
    return {
      ...baseConfig,
      dateRange: globalFilters.date_preset ? { preset: globalFilters.date_preset } : baseConfig.dateRange,
      filters: [...(baseConfig.filters ?? []), ...extra],
    };
  }, [baseConfig, drill, globalFilters]);

  const { data: qData, isLoading, isError } = useWidgetData(config, true);
  const rows    = qData?.data ?? [];
  const cols    = qData?.columns ?? [];

  const { setDrill, openDrawer } = useContext(DrillContext);
  const handleDrill = useCallback((field: string, value: string) => {
    const isAll = field === '__all__';
    const df: DrillFilter = {
      field,
      value,
      label: isAll ? `All issues — ${widget.title}` : `${field.replace(/_/g, ' ')} = "${value}"`,
      widgetFilters: baseConfig.filters ?? [],
      widgetDateRange: baseConfig.dateRange,
    };
    setDrill(df);
    openDrawer();
  }, [setDrill, openDrawer, baseConfig, widget.title]);

  // Threshold status for KPI cards
  const thresholdStatus: 'ok' | 'warning' | 'critical' = React.useMemo(() => {
    if (widget.widget_type !== 'kpi_card') return 'ok';
    const val   = Number(rows[0]?.value ?? 0);
    const warn  = baseConfig.threshold_warning;
    const crit  = baseConfig.threshold_critical;
    const dir   = baseConfig.threshold_direction ?? 'above';
    if (crit !== undefined && (dir === 'above' ? val > crit : val < crit)) return 'critical';
    if (warn !== undefined && (dir === 'above' ? val > warn : val < warn)) return 'warning';
    return 'ok';
  }, [rows, baseConfig, widget.widget_type]);

  const HEADER_H = 38;
  const borderColor = thresholdStatus === 'critical' ? '#e74c3c' : thresholdStatus === 'warning' ? '#f39c12' : undefined;

  const CAT_COLORS: Record<string, string> = {
    violet: '#9c36b5', blue: '#1971c2', cyan: '#0c8599', grape: '#862e9c',
    indigo: '#3b5bdb', teal: '#0f9e8d', orange: '#e67700', green: '#2f9e44',
    yellow: '#e67700', pink: '#c2255c', gray: '#868e96',
  };
  const catColor = getWidgetColor(widget.widget_type);
  const catHex   = CAT_COLORS[catColor] ?? '#4ECDC4';

  return (
    <Card p={0} style={{
      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#fff',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: borderColor
        ? `2px solid ${borderColor}`
        : `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
      borderRadius: 10,
      boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.3s, box-shadow 0.2s',
    }}>
      {/* Color accent bar at top */}
      <Box style={{ height: 3, background: catHex, flexShrink: 0 }} />

      {/* Header — drag handle */}
      <Group px={10} py={6} justify="space-between" wrap="nowrap"
        className="widget-drag-handle"
        style={{
          height: HEADER_H - 3, cursor: 'grab',
          borderBottom: `1px solid ${dark ? '#232323' : '#f0f2f5'}`,
          userSelect: 'none',
        }}>
        <HoverCard width={260} shadow="md" openDelay={500} closeDelay={100} withinPortal>
          <HoverCard.Target>
            <Group gap={6} wrap="nowrap" style={{ overflow: 'hidden', flex: 1, cursor: 'default' }}>
              <Box style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: catHex }} />
              <Text size="sm" fw={600} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                {widget.title}
              </Text>
            </Group>
          </HoverCard.Target>
          <HoverCard.Dropdown p="sm" style={{ border: `1px solid ${dark ? '#333' : '#e8ecf0'}` }}>
            <Stack gap={6}>
              <Group gap={6}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: catHex }} />
                <Text size="xs" fw={700} tt="uppercase" style={{ color: catHex, letterSpacing: '0.05em' }}>
                  {widget.widget_type.replace(/_/g, ' ')}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" lh={1.5}>
                {WIDGET_HELP[widget.widget_type] ?? 'Configure this widget using the Edit button.'}
              </Text>
              {rows.length > 0 && (() => {
                try {
                  const ins = generateInsights(rows, config, widget.widget_type);
                  return (
                    <>
                      <Divider my={2} />
                      <Text size="xs" fw={600} mb={2}>📊 Current data</Text>
                      {ins.map((line, i) => (
                        <Text key={i} size="xs" c="dimmed">• {line}</Text>
                      ))}
                    </>
                  );
                } catch { return null; }
              })()}
              <Text size="xs" c="dimmed" mt={4} style={{ fontStyle: 'italic', opacity: 0.6 }}>
                Click ✏️ to edit · ⊞ to resize/move · 🔍 Click chart to drill-through
              </Text>
            </Stack>
          </HoverCard.Dropdown>
        </HoverCard>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          <WidgetLayoutPopover widget={widget} dark={dark} onReposition={onReposition} />
          <Tooltip label="Edit" withArrow><ActionIcon size="xs" variant="subtle" color="gray" onClick={onEdit}
      aria-label="Edit"
    ><IconEdit size={12} /></ActionIcon></Tooltip>
          <Tooltip label="Duplicate" withArrow><ActionIcon size="xs" variant="subtle" color="gray" onClick={onDuplicate}
      aria-label="Copy"
    ><IconCopy size={12} /></ActionIcon></Tooltip>
          <Tooltip label="Remove" withArrow><ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}
      aria-label="Delete"
    ><IconTrash size={12} /></ActionIcon></Tooltip>
        </Group>
      </Group>

      {/* Body — flex fills remaining height of the RGL cell */}
      <Box style={{ flex: 1, padding: '6px 4px 4px 4px', overflow: 'hidden', minHeight: 0 }}>
        {isLoading ? (
          <Stack align="center" justify="center" h="100%"><Loader size="sm" color="teal" /></Stack>
        ) : isError ? (
          <EmptyState reason={(qData as unknown as { error?: string })?.error ?? 'Query failed — click edit to check config'} />
        ) : (
          renderWidget(widget.widget_type, rows, cols, config, dark, handleDrill)
        )}
      </Box>
    </Card>
  );
}

export { WidgetCard };
