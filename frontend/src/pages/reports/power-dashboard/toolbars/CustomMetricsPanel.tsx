import _React, { useState } from 'react';
import { Box, Group, Text, Button, Divider, Stack, Badge, ActionIcon, Tooltip, Modal, TextInput, Select } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../../api/client';
import { CustomMetric } from '../state/types';

const METRIC_OPTIONS = Object.entries({
  count: 'Count of Issues', count_done: 'Count Done', count_open: 'Count Open',
  sum_sp: 'Sum Story Points', avg_sp: 'Avg Story Points', velocity_sp: 'Velocity SP',
  avg_lead_time_days: 'Avg Lead Time', avg_cycle_time_days: 'Avg Cycle Time',
  sum_hours_logged: 'Sum Hours Logged', completion_rate_pct: 'Completion Rate %',
}).map(([k, v]) => ({ value: k, label: v }));

function CustomMetricForm({ initial, onSave, onCancel }: {
  initial: CustomMetric | null;
  onSave: (m: CustomMetric) => void;
  onCancel: () => void;
}) {
  const [m, setM] = useState<CustomMetric>(initial ?? {
    id: '', name: '', formula_type: 'pct', metric_a: 'count', metric_b: 'count_done', unit: '%',
  });
  return (
    <Stack gap="md" p="xs">
      <TextInput label="Metric name" description="A clear label like 'Bug Rate' or 'Done %'"
        placeholder="e.g. Bug Rate" value={m.name}
        onChange={e => setM({...m, name: e.target.value})} required />

      <Select label="Formula type" description="How A and B are combined"
        data={[
          { value: 'pct',      label: '% Percentage — A / B × 100' },
          { value: 'ratio',    label: '÷ Ratio — A ÷ B' },
          { value: 'subtract', label: '− Delta — A − B' },
        ]}
        value={m.formula_type}
        onChange={v => setM({...m, formula_type: v as CustomMetric['formula_type']})} />

      <Box style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '10px 12px' }}>
        <Text size="xs" fw={600} c="dimmed" mb={8}>FORMULA INPUTS</Text>
        <Group grow gap={8}>
          <Select label="Metric A" description="Numerator" data={METRIC_OPTIONS} searchable
            value={m.metric_a} onChange={v => setM({...m, metric_a: v ?? 'count'})} />
          <Select label="Metric B" description="Denominator" data={METRIC_OPTIONS} searchable
            value={m.metric_b} onChange={v => setM({...m, metric_b: v ?? 'count_done'})} />
        </Group>
        <Text size="xs" c="dimmed" mt={8} ta="center">
          Result = {m.metric_a} {m.formula_type === 'pct' ? '/ ' + m.metric_b + ' × 100' : m.formula_type === 'ratio' ? '÷ ' + m.metric_b : '− ' + m.metric_b}
        </Text>
      </Box>

      <TextInput label="Unit label" description="Shown after the value in widgets"
        placeholder="% or hrs or ratio"
        value={m.unit ?? ''} onChange={e => setM({...m, unit: e.target.value})} />

      <Group justify="flex-end" pt={4}>
        <Button variant="subtle" onClick={onCancel}>Cancel</Button>
        <Button disabled={!m.name.trim()} leftSection={<IconDeviceFloppy size={15} />}
          onClick={() => onSave(m)}>
          Save Metric
        </Button>
      </Group>
    </Stack>
  );
}

function CustomMetricsPanel({ dashboardId, dark }: { dashboardId: number; dark: boolean }) {
  const qc = useQueryClient();
  const [metrics, _setMetrics] = useState<CustomMetric[]>([]);
  const [editing, setEditing] = useState<CustomMetric | null>(null);
  const [showForm, setShowForm] = useState(false);

  const save = useMutation({
    mutationFn: (list: CustomMetric[]) =>
      apiClient.put(`/power-dashboard/dashboards/${dashboardId}/custom-metrics`, list),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-metrics', dashboardId] });
      setShowForm(false); setEditing(null);
      notifications.show({ title: 'Metrics saved', message: '', color: 'teal' });
    },
  });

  const handleSave = (m: CustomMetric) => {
    const next = editing
      ? metrics.map(x => x.id === m.id ? m : x)
      : [...metrics, { ...m, id: Date.now().toString() }];
    save.mutate(next);
  };
  const handleDelete = (id: string) => save.mutate(metrics.filter(m => m.id !== id));

  return (
    <Box p="md">
      <Group justify="space-between" align="center" mb="xs">
        <Box>
          <Text fw={700} size="md">Custom Metrics</Text>
          <Text size="xs" c="dimmed" mt={2}>
            Define ratio / % / delta metrics reusable in any widget
          </Text>
        </Box>
        <Button size="sm" leftSection={<IconPlus size={14} />}
          onClick={() => { setEditing(null); setShowForm(true); }}>
          New Metric
        </Button>
      </Group>

      <Divider mb="sm" />

      {metrics.length === 0 ? (
        <Box py="xl" style={{ textAlign: 'center' }}>
          <Text size="2rem" mb={8}>🔢</Text>
          <Text size="sm" c="dimmed" fw={500}>No custom metrics yet</Text>
          <Text size="xs" c="dimmed" mt={4}>
            Create a metric like "Bug Rate = Bugs ÷ Stories × 100%"
          </Text>
          <Button mt="md" size="sm" variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => { setEditing(null); setShowForm(true); }}>
            Create first metric
          </Button>
        </Box>
      ) : (
        <Stack gap="sm">
          {metrics.map(m => (
            <Group key={m.id} gap={10} p="sm" style={{
              borderRadius: 8,
              background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${dark ? '#2a2a2a' : '#e8ecf0'}`,
            }}>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600} style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {m.name}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {m.metric_a} {m.formula_type === 'ratio' ? '÷' : m.formula_type === 'subtract' ? '−' : '÷'} {m.metric_b}
                  {m.unit ? <Badge size="xs" variant="light" ml={4}>{m.unit}</Badge> : null}
                </Text>
              </Box>
              <Badge size="sm" variant="light" color={
                m.formula_type === 'ratio' ? 'blue' :
                m.formula_type === 'pct'   ? 'teal' :
                m.formula_type === 'subtract' ? 'orange' : 'gray'
              }>{m.formula_type}</Badge>
              <Group gap={4}>
                <Tooltip label="Edit"><ActionIcon size="sm" variant="subtle"
                  onClick={() => { setEditing(m); setShowForm(true); }}
      aria-label="Edit"
    ><IconEdit size={14} /></ActionIcon></Tooltip>
                <Tooltip label="Delete"><ActionIcon size="sm" variant="subtle" color="red"
                  onClick={() => handleDelete(m.id)}
      aria-label="Delete"
    ><IconTrash size={14} /></ActionIcon></Tooltip>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      <Modal opened={showForm} onClose={() => { setShowForm(false); setEditing(null); }}
        title={<Text fw={700}>{editing ? '✏️ Edit Metric' : '➕ New Custom Metric'}</Text>} size="sm">
        <Box p="xs">
          <CustomMetricForm initial={editing} onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }} />
        </Box>
      </Modal>
    </Box>
  );
}

export { CustomMetricsPanel };
