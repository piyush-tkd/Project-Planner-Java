import { Stack, Group, Badge, ActionIcon, Select } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconEye, IconEyeOff } from '@tabler/icons-react';
import ErrorBoundary from '../../../../components/common/ErrorBoundary';
import { EmptyState } from '../../../../components/ui';
import { IconLayoutGrid } from '@tabler/icons-react';
import { SIZE_OPTIONS } from '../state/constants';
import { sizeToSpan } from '../state/utils';
import { WidgetRenderer } from './WidgetRenderer';
import { ExtendedDashboardWidget, DashboardWidget } from '../state/types';
import { JiraAnalyticsData } from '../../../../api/jira';

interface WidgetGridProps {
  widgets: ExtendedDashboardWidget[];
  data: JiraAnalyticsData;
  editMode: boolean;
  rows: DashboardWidget[][];
  onRemoveWidget: (id: string) => void;
  onEditWidget: (widget: ExtendedDashboardWidget) => void;
  onMoveWidget: (id: string, direction: -1 | 1) => void;
  onUpdateWidget: (widget: ExtendedDashboardWidget) => void;
  onDrillDown: (title: string, items: any[]) => void;
  podsParam?: string;
  months: number;
}

export function WidgetGrid({
  widgets,
  data,
  editMode,
  rows,
  onRemoveWidget,
  onEditWidget,
  onMoveWidget,
  onUpdateWidget,
  onDrillDown,
  podsParam,
  months,
}: WidgetGridProps) {
  if (widgets.length === 0) {
    return (
      <Stack gap="md" p="md">
        <EmptyState
          icon={<IconLayoutGrid size={40} stroke={1.5} />}
          title="No widgets yet"
          description='Click "Edit Layout" → "Add Widget" to build your first dashboard.'
          actionLabel="Add Your First Widget"
          onAction={() => {}}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 16,
          }}
        >
          {row.map(w => (
            <div key={w.id} style={{ gridColumn: `span ${sizeToSpan(w.size)}` }}>
              {editMode && (
                <Group gap={4} mb={4} justify="space-between">
                  <Group gap={4}>
                    <Badge size="xs" variant="light">
                      {rows.findIndex(r => r.includes(w)) + 1}
                    </Badge>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => onMoveWidget(w.id, -1)}
                      title="Move up"
                      aria-label="Move up"
                    >
                      <IconArrowUp size={12} />
                    </ActionIcon>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => onMoveWidget(w.id, 1)}
                      title="Move down"
                      aria-label="Move down"
                    >
                      <IconArrowDown size={12} />
                    </ActionIcon>
                  </Group>
                  <Group gap={4}>
                    <Select
                      size="xs"
                      data={SIZE_OPTIONS}
                      value={w.size}
                      onChange={v =>
                        v && onUpdateWidget({ ...w, size: v as DashboardWidget['size'] })
                      }
                      style={{ width: 100 }}
                    />
                    <ActionIcon
                      size="xs"
                      variant="light"
                      color={w.enabled ? 'blue' : 'gray'}
                      onClick={() => onUpdateWidget({ ...w, enabled: !w.enabled })}
                      aria-label="View"
                    >
                      {w.enabled ? <IconEye size={12} /> : <IconEyeOff size={12} />}
                    </ActionIcon>
                  </Group>
                </Group>
              )}
              <ErrorBoundary compact>
                <WidgetRenderer
                  widget={w}
                  data={data}
                  editMode={editMode}
                  onRemove={() => onRemoveWidget(w.id)}
                  onEdit={() => onEditWidget(w)}
                  onDrillDown={(title, items) => {
                    onDrillDown(title, items);
                  }}
                  pods={podsParam}
                  months={months}
                />
              </ErrorBoundary>
            </div>
          ))}
        </div>
      ))}
    </Stack>
  );
}
