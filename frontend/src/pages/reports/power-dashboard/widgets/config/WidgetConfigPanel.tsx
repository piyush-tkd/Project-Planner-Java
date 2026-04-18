import _React, { useState } from 'react';
import { Stack, Select, Group, NumberInput, Textarea, Divider, Text, TextInput, Button, Box, Collapse } from '@mantine/core';
import { IconPlus, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { WidgetConfig, FieldMeta, MetricMeta } from '../../state/types';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../../../api/client';
import { SOURCES, SORT_OPTIONS, DATE_PRESETS } from '../constants';
import { FilterRow } from './FilterRow';

// @ts-expect-error -- unused
function WidgetConfigPanel({ config, onChange, fields, customFields, dark }: { config: WidgetConfig; onChange: (c: WidgetConfig) => void; fields: Record<string, { dimensions: FieldMeta[]; metrics: MetricMeta[] }> | undefined; customFields: { field_id: string; field_name: string; issue_count: number }[] | undefined; dark: boolean }) {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const qc = useQueryClient();
  const srcFields = fields?.[config.source];
  const baseDims = (srcFields?.dimensions ?? [])
    .filter(d => d.key !== 'label')
    .map(d => ({ value: d.key, label: d.label }));

  const dimOptions = [
    ...baseDims,
    ...(config.source === 'issues' ? [{ value: 'label', label: '🏷️ Label (individual tag)' }] : []),
    ...(config.source === 'issues' ? (customFields ?? []).map(f => {
      const rawId    = f.field_id;
      const numPart  = rawId.replace('customfield_', '');
      const display  = f.field_name && f.field_name.trim()
        ? f.field_name
        : `Custom Field ${numPart}`;
      return { value: `cf_${rawId}`, label: `🔧 ${display} (${f.issue_count} issues)` };
    }) : []),
  ];

  const seen = new Set<string>();
  const uniqueDimOptions = dimOptions.filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true; });

  const metricSeen = new Set<string>();
  const metricOptions = (srcFields?.metrics ?? [])
    .map(m => ({ value: m.key, label: m.label }))
    .filter(o => { if (metricSeen.has(o.value)) return false; metricSeen.add(o.value); return true; });

  const setField = (key: keyof WidgetConfig, val: unknown) => onChange({ ...config, [key]: val });

  return (
    <Stack gap="sm">
      <Select label="Data Source" value={config.source} data={SOURCES}
        onChange={v => onChange({ ...config, source: v ?? 'issues', groupBy: undefined, metric: 'count' })} />

      <Select label="Measure (metric)" value={config.metric} data={metricOptions}
        searchable onChange={v => setField('metric', v ?? 'count')} />

      <Select label="Group by (dimension)" value={config.groupBy ?? null} data={uniqueDimOptions}
        searchable clearable placeholder="No grouping"
        onChange={v => setField('groupBy', v ?? undefined)} />

      <Select label="Second dimension (heatmap / stacked)" value={config.groupBy2 ?? null}
        data={uniqueDimOptions} searchable clearable placeholder="Optional"
        onChange={v => setField('groupBy2', v ?? undefined)} />

      <Select label="Date range" value={config.dateRange?.preset ?? 'last_90d'}
        data={DATE_PRESETS}
        onChange={v => setField('dateRange', { preset: v ?? 'last_90d' })} />

      <Group grow>
        <Select label="Sort by" value={config.sortBy} data={SORT_OPTIONS}
          onChange={v => setField('sortBy', v ?? 'metric_desc')} />
        <NumberInput label="Row limit" value={config.limit} min={1} max={500}
          onChange={v => setField('limit', Number(v ?? 20))} />
      </Group>

      <Select size="xs" label="🔄 Auto-refresh"
        value={String(config.refresh_interval_minutes ?? 0)}
        data={[
          { value: '0',  label: 'Off (manual refresh only)' },
          { value: '5',  label: 'Every 5 minutes' },
          { value: '15', label: 'Every 15 minutes' },
          { value: '30', label: 'Every 30 minutes' },
          { value: '60', label: 'Every hour' },
        ]}
        onChange={v => setField('refresh_interval_minutes', Number(v ?? 0))} />

      {(config.source === 'text_block' || config.source === 'section_header' || config.source === undefined) && (
        <>
          <Divider label="Text Content" labelPosition="left" />
          <Textarea label="Content (use # for header)" rows={4}
            placeholder="# My Section&#10;Add notes, context, or a section title here..."
            value={config.text_content ?? ''}
            onChange={e => setField('text_content', e.target.value)} />
          <Group grow>
            <Select size="xs" label="Alignment" value={config.text_align ?? 'left'}
              data={[{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]}
              onChange={v => setField('text_align', v ?? 'left')} />
            <Select size="xs" label="Text size" value={config.text_size ?? 'sm'}
              data={[{value:'xs',label:'XS'},{value:'sm',label:'SM'},{value:'md',label:'MD'},{value:'lg',label:'LG'},{value:'xl',label:'XL'}]}
              onChange={v => setField('text_size', v ?? 'sm')} />
          </Group>
        </>
      )}

      <Divider label="Alert Thresholds" labelPosition="left" />
      <Text size="xs" c="dimmed">
        Set warning/critical levels on the metric value. Works on any widget.
      </Text>
      <Group grow>
        <NumberInput size="xs" label="⚠️ Warning"
          placeholder="e.g. 50"
          value={config.threshold_warning ?? ''}
          onChange={v => setField('threshold_warning', v === '' ? undefined : Number(v))} />
        <NumberInput size="xs" label="🔴 Critical"
          placeholder="e.g. 100"
          value={config.threshold_critical ?? ''}
          onChange={v => setField('threshold_critical', v === '' ? undefined : Number(v))} />
      </Group>
      <Select size="xs" label="Trigger direction"
        value={config.threshold_direction ?? 'above'}
        data={[
          { value: 'above', label: '↑ Alert when value ABOVE threshold' },
          { value: 'below', label: '↓ Alert when value BELOW threshold' },
        ]}
        onChange={v => setField('threshold_direction', v ?? 'above')} />

      {config.source === 'issues' && (customFields ?? []).some(f => !f.field_name?.trim()) && (
        <Group gap={6} align="center">
          <Text size="xs" c="dimmed" style={{ flex: 1 }}>
            Some custom fields show raw IDs — sync names from Jira.
          </Text>
          <Button size="xs" variant="light" color="teal"
            onClick={async () => {
              try {
                const r = await apiClient.post('/power-dashboard/fields/sync-names');
                notifications.show({ title: 'Field names synced', message: r.data.message, color: 'teal' });
                qc.invalidateQueries({ queryKey: ['power-dashboard-custom-fields'] });
              } catch (e) {
                notifications.show({ title: 'Sync failed', message: 'Check Jira credentials', color: 'red' });
              }
            }}>
            🔄 Sync names from Jira
          </Button>
        </Group>
      )}

      <Divider label="Column Labels (optional)" labelPosition="left" />
      <Group grow>
        <TextInput size="xs" label={`Dimension label${config.groupBy ? ` (${config.groupBy})` : ''}`}
          placeholder="e.g. Assignee"
          value={config.label_name ?? ''}
          onChange={e => setField('label_name', e.target.value || undefined)} />
        {config.groupBy2 && (
          <TextInput size="xs" label={`2nd dimension (${config.groupBy2})`}
            placeholder="e.g. Project"
            value={config.label2_name ?? ''}
            onChange={e => setField('label2_name', e.target.value || undefined)} />
        )}
      </Group>
      <TextInput size="xs" label={`Value label (${config.metric})`}
        placeholder="e.g. Issue Count, Hours, SP"
        value={config.value_name ?? ''}
        onChange={e => setField('value_name', e.target.value || undefined)} />

      <Box>
        <Group justify="space-between" mb={4} style={{ cursor: 'pointer' }}
          onClick={() => setFiltersOpen(o => !o)}>
          <Text size="sm" fw={600}>Filters ({config.filters.length})</Text>
          {filtersOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </Group>
        <Collapse in={filtersOpen}>
          <Stack gap={6}>
            {config.filters.map((f, i) => (
              <FilterRow key={i} filter={f} source={config.source} dimOptions={uniqueDimOptions}
                onChange={updated => {
                  const nf = [...config.filters];
                  nf[i] = updated;
                  setField('filters', nf);
                }}
                onRemove={() => setField('filters', config.filters.filter((_, j) => j !== i))} />
            ))}
            <Button size="xs" variant="light" leftSection={<IconPlus size={12} />}
              onClick={() => setField('filters', [...config.filters, { field: '', op: 'eq', value: '' }])}>
              Add filter
            </Button>
          </Stack>
        </Collapse>
      </Box>
    </Stack>
  );
}

export { WidgetConfigPanel };
