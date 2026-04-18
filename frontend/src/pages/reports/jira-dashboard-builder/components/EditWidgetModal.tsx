import { useState, useEffect } from 'react';
import {
  Modal, Stack, TextInput, Select, Divider, Grid, Checkbox, Group, Button, ColorInput, Switch,
} from '@mantine/core';
import { Text } from '@mantine/core';
import {
  DATA_KEY_OPTIONS, SIZE_OPTIONS, SORT_OPTIONS, DIRECTION_OPTIONS, LIMIT_OPTIONS,
  PIE_COLORS, PIVOT_DIM_OPTIONS, PIVOT_METRIC_OPTIONS, PIVOT_VIEW_OPTIONS,
} from '../state/constants';
import { AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY } from '../../../../brandTokens';
import { JqlAutocomplete } from '../../../../components/common/JqlAutocomplete';
import { ExtendedDashboardWidget } from '../state/types';

interface EditWidgetModalProps {
  opened: boolean;
  widget: ExtendedDashboardWidget | null;
  analyticsFields: any[];
  podsParam?: string;
  onClose: () => void;
  onApply: (widget: ExtendedDashboardWidget) => void;
}

export function EditWidgetModal({
  opened, widget, analyticsFields, podsParam, onClose, onApply,
}: EditWidgetModalProps) {
  const [editingWidget, setEditingWidget] = useState<ExtendedDashboardWidget | null>(widget);

  useEffect(() => {
    setEditingWidget(widget);
  }, [widget]);

  const handleApply = () => {
    if (editingWidget) {
      onApply(editingWidget);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE_HEX }}>Configure Widget</Text>}
      size="lg"
    >
      {editingWidget && (
        <Stack gap="md">
          <TextInput
            label="Title"
            value={editingWidget.title}
            onChange={e => setEditingWidget({ ...editingWidget, title: e.target.value })}
          />
          <Select
            label="Size"
            data={SIZE_OPTIONS}
            value={editingWidget.size}
            onChange={v => v && setEditingWidget({ ...editingWidget, size: v as ExtendedDashboardWidget['size'] })}
          />

          {['donut', 'horizontalBar', 'stackedBar', 'pivotTable', 'issueTable', 'gauge', 'singleKpi', 'trendSpark', 'heatmap', 'twoDimensional'].includes(editingWidget.type) && (
            <Select
              label={editingWidget.type === 'twoDimensional' ? 'Row Dimension' : 'Data Dimension'}
              data={DATA_KEY_OPTIONS}
              value={editingWidget.dataKey ?? 'byType'}
              onChange={v => v && setEditingWidget({ ...editingWidget, dataKey: v })}
            />
          )}

          {['twoDimensional', 'heatmap'].includes(editingWidget.type) && (
            <Select
              label="Column Dimension"
              data={DATA_KEY_OPTIONS}
              value={editingWidget.secondaryDataKey ?? 'byPriority'}
              onChange={v => v && setEditingWidget({ ...editingWidget, secondaryDataKey: v })}
            />
          )}

          {editingWidget.type === 'countdown' && (
            <>
              <TextInput
                label="Target Date"
                type="date"
                value={editingWidget.targetDate ?? ''}
                onChange={e => setEditingWidget({ ...editingWidget, targetDate: e.target.value })}
              />
              <TextInput
                label="Target Label"
                placeholder="e.g. Sprint End, Release Date"
                value={editingWidget.targetLabel ?? ''}
                onChange={e => setEditingWidget({ ...editingWidget, targetLabel: e.target.value })}
              />
            </>
          )}

          {editingWidget.type === 'productivityComparison' && (
            <Select
              label="Period Granularity"
              description="Choose how to bucket data for comparison"
              data={[
                { value: 'week', label: 'Week over Week' },
                { value: 'month', label: 'Month over Month' },
                { value: 'quarter', label: 'Quarter over Quarter' },
                { value: 'year', label: 'Year over Year' },
              ]}
              value={editingWidget.periodType ?? 'month'}
              onChange={v => v && setEditingWidget({ ...editingWidget, periodType: v as ExtendedDashboardWidget['periodType'] })}
            />
          )}

          {/* ── Pivot Builder config ─────────────────────────────────────── */}
          {editingWidget.type === 'pivotBuilder' && (
            <>
              <Divider label={<Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>🔲 Pivot Configuration</Text>} labelPosition="left" />
              <Grid gutter="sm">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Row Dimension"
                    data={PIVOT_DIM_OPTIONS}
                    value={editingWidget.pivotRowDim ?? 'issueType'}
                    onChange={v => v && setEditingWidget({ ...editingWidget, pivotRowDim: v })}
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Column Dimension"
                    data={[{ value: '', label: 'None (flat list)' }, ...PIVOT_DIM_OPTIONS]}
                    value={editingWidget.pivotColDim ?? 'priority'}
                    onChange={v => setEditingWidget({ ...editingWidget, pivotColDim: v || undefined })}
                    searchable
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Metric"
                    data={PIVOT_METRIC_OPTIONS}
                    value={editingWidget.pivotMetric ?? 'count'}
                    onChange={v => v && setEditingWidget({ ...editingWidget, pivotMetric: v as ExtendedDashboardWidget['pivotMetric'] })}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="View Mode"
                    data={PIVOT_VIEW_OPTIONS}
                    value={editingWidget.pivotView ?? 'table'}
                    onChange={v => v && setEditingWidget({ ...editingWidget, pivotView: v as ExtendedDashboardWidget['pivotView'] })}
                  />
                </Grid.Col>
              </Grid>
            </>
          )}

          {/* ── Power Analytics: JQL filter + Metric ───────────────────── */}
          <Divider label={<Text size="xs" fw={600} c="dimmed" style={{ fontFamily: FONT_FAMILY }}>⚡ Power Analytics</Text>} labelPosition="left" />

          {analyticsFields.length > 0 && (
            <Select
              label="Group By (Custom Field)"
              description="Override the data dimension with any Jira field including custom fields"
              placeholder="Use default dimension above…"
              data={analyticsFields.map(f => ({
                value: f.id,
                label: `${f.name}${f.category === 'custom' ? ' (custom)' : ''}`,
                group: f.category === 'custom' ? 'Custom Fields' : 'Standard Fields',
              }))}
              value={editingWidget.groupBy ?? null}
              onChange={v => setEditingWidget({ ...editingWidget, groupBy: v ?? undefined })}
              searchable
              clearable
              maxDropdownHeight={240}
            />
          )}

          <Select
            label="Metric"
            description="What value to aggregate per group"
            data={[
              { value: 'count', label: 'Issue Count' },
              { value: 'storyPoints', label: 'Story Points' },
            ]}
            value={editingWidget.metric ?? 'count'}
            onChange={v => v && setEditingWidget({ ...editingWidget, metric: v as 'count' | 'storyPoints' })}
          />

          <JqlAutocomplete
            label="JQL Filter"
            description="Filter this widget's data using JQL syntax — type a field name, operator, or value and autocomplete suggestions will appear"
            placeholder="e.g. priority in (High, Critical) AND status != Done"
            value={editingWidget.jql ?? ''}
            onChange={v => setEditingWidget({ ...editingWidget, jql: v })}
            pods={podsParam}
            fields={analyticsFields}
            minRows={2}
            maxRows={4}
          />

          <Divider />

          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Sort By"
                data={SORT_OPTIONS}
                value={editingWidget.sortBy || 'count'}
                onChange={v => v && setEditingWidget({ ...editingWidget, sortBy: v as any })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Direction"
                data={DIRECTION_OPTIONS}
                value={editingWidget.sortDirection || 'desc'}
                onChange={v => v && setEditingWidget({ ...editingWidget, sortDirection: v as any })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Limit"
                data={LIMIT_OPTIONS}
                value={String(editingWidget.limit ?? 10)}
                onChange={v => v && setEditingWidget({ ...editingWidget, limit: Number(v) })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <ColorInput
                label="Chart Color"
                value={editingWidget.color || AQUA_HEX}
                onChange={c => setEditingWidget({ ...editingWidget, color: c })}
                swatches={PIE_COLORS}
              />
            </Grid.Col>
          </Grid>

          <Group grow>
            <Checkbox
              label="Show Legend"
              checked={editingWidget.showLegend !== false}
              onChange={e => setEditingWidget({ ...editingWidget, showLegend: e.currentTarget.checked })}
            />
            <Checkbox
              label="Show Labels"
              checked={editingWidget.showLabels ?? false}
              onChange={e => setEditingWidget({ ...editingWidget, showLabels: e.currentTarget.checked })}
            />
          </Group>

          <Switch
            label="Enabled"
            checked={editingWidget.enabled}
            onChange={e => setEditingWidget({ ...editingWidget, enabled: e.currentTarget.checked })}
          />

          <Button onClick={handleApply}>Apply</Button>
        </Stack>
      )}
    </Modal>
  );
}
