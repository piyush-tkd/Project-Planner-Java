import _React, { useState, useEffect } from 'react';
import { Modal, Box, Text, Stack, TextInput, Select, ScrollArea, Group, Button, Divider } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { WidgetConfig, FieldMeta, MetricMeta } from '../../state/types';
import { WIDGET_TYPES, DEFAULT_CONFIG } from '../constants';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { WidgetPreview } from './WidgetPreview';

function WidgetModal({ opened, onClose, onSave, initial, fields, customFields, dark }: {
  opened: boolean; onClose: () => void;
  onSave: (title: string, type: string, config: WidgetConfig) => void;
  initial?: { title: string; type: string; config: WidgetConfig } | null;
  fields: Record<string, { dimensions: FieldMeta[]; metrics: MetricMeta[] }> | undefined;
  customFields: { field_id: string; field_name: string; issue_count: number }[] | undefined;
  dark: boolean;
}) {
  const [title,      setTitle]      = useState(initial?.title ?? 'New Widget');
  const [widgetType, setWidgetType] = useState(initial?.type ?? 'bar');
  const [config,     setConfig]     = useState<WidgetConfig>(initial?.config ?? { ...DEFAULT_CONFIG });

  useEffect(() => {
    if (opened) {
      setTitle(initial?.title ?? 'New Widget');
      setWidgetType(initial?.type ?? 'bar');
      setConfig(initial?.config ?? { ...DEFAULT_CONFIG });
    }
  }, [opened, initial]);

  return (
    <Modal
      opened={opened} onClose={onClose}
      title={<Text fw={700} size="lg">Configure Widget</Text>}
      size="90vw"
      styles={{
        body: { padding: 0 },
        content: { maxWidth: 1400, margin: '0 auto' },
        inner: { padding: '20px' },
      }}
    >
      <Box style={{ display: 'flex', height: 'calc(90vh - 80px)', overflow: 'hidden' }}>
        {/* LEFT — Config panel (fixed width, scrollable) */}
        <Box style={{
          width: 420, flexShrink: 0,
          borderRight: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`,
          display: 'flex', flexDirection: 'column',
        }}>
          <Box p="md" style={{ borderBottom: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}` }}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={8}>Widget Setup</Text>
            <Stack gap="xs">
              <TextInput label="Title" value={title} onChange={e => setTitle(e.target.value)} size="sm" />
              <Select size="sm" label="Chart type" value={widgetType}
                data={WIDGET_TYPES.map(t => ({ value: t.value, label: t.label }))}
                onChange={v => setWidgetType(v ?? 'bar')} />
            </Stack>
          </Box>
          <ScrollArea style={{ flex: 1 }} p="md">
            <Stack gap="sm">
              <Divider label="Data" labelPosition="left" />
              <WidgetConfigPanel config={config} onChange={setConfig}
                fields={fields} customFields={customFields} dark={dark} />
            </Stack>
          </ScrollArea>
          <Box p="md" style={{ borderTop: `1px solid ${dark ? '#2a2a2a' : '#e8e8e8'}` }}>
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" leftSection={<IconDeviceFloppy size={15} />}
                onClick={() => { onSave(title, widgetType, config); onClose(); }}>
                Save Widget
              </Button>
            </Group>
          </Box>
        </Box>

        {/* RIGHT — Live preview (fills remaining space) */}
        <Box style={{ flex: 1, padding: '20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">Live Preview</Text>
          <WidgetPreview widgetType={widgetType} config={config} dark={dark} />
          <Box style={{
            flex: 1,
            backgroundColor: dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.015)',
            borderRadius: 8, border: `1px dashed ${dark ? '#333' : '#ddd'}`,
            padding: 12, minHeight: 120,
          }}>
            <Text size="xs" c="dimmed" fw={600} mb={6}>QUERY CONFIGURATION</Text>
            <Text size="xs" c="dimmed" ff="monospace" style={{ lineBreak: 'anywhere' }}>
              Source: <b>{config.source}</b> · Metric: <b>{config.metric}</b>
              {config.groupBy ? ` · Group by: ${config.groupBy}` : ''}
              {config.groupBy2 ? ` × ${config.groupBy2}` : ''}
              {config.filters.length > 0 ? ` · ${config.filters.length} filter(s)` : ''}
              {' · '}{config.dateRange?.preset ?? 'custom date range'}
              {' · '} Limit: {config.limit} · Sort: {config.sortBy}
            </Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

export { WidgetModal };
