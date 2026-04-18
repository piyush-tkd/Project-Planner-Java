import { useState } from 'react';
import {
  Title, Text, Stack, Group, Badge, Button, Table, Modal, TextInput,
  Select, Switch, ActionIcon, Tooltip, Skeleton, Center, Textarea, NumberInput, Box,
} from '@mantine/core';
import { IconPlus, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { DEEP_BLUE } from '../../brandTokens';
import type { FieldDefinition } from '../../components/common/CustomFieldsRenderer';
import {
  InlineTextCell, InlineSelectCell, InlineSwitchCell,
} from '../../components/common/InlineCell';
import { useInlineEdit } from '../../hooks/useInlineEdit';

// @ts-expect-error -- unused
const TYPE_COLOR: Record<string, string> = {
  text: 'blue', number: 'teal', date: 'violet', select: 'orange',
};
const TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (dropdown)' },
];
const BLANK = { fieldName: '', fieldLabel: '', fieldType: 'text', optionsJson: '', required: false, sortOrder: 0 };

export default function CustomFieldsAdminPage() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<FieldDefinition | null>(null);
  const [form,    setForm]    = useState(BLANK);
  const { isEditing, startEdit, stopEdit } = useInlineEdit();

  const { data: defs = [], isLoading } = useQuery<FieldDefinition[]>({
    queryKey: ['custom-field-defs-all'],
    queryFn: async () => { const r = await apiClient.get('/custom-fields/definitions/all'); return r.data; },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK, sortOrder: defs.length });
    setModal(true);
  }

  // @ts-expect-error -- unused
  function openEdit(d: FieldDefinition) {
    setEditing(d);
    let optionsRaw = '';
    if (d.optionsJson) {
      try { optionsRaw = JSON.parse(d.optionsJson).join('\n'); } catch { optionsRaw = d.optionsJson; }
    }
    setForm({
      fieldName: d.fieldName, fieldLabel: d.fieldLabel,
      fieldType: d.fieldType, optionsJson: optionsRaw,
      required: d.required, sortOrder: d.sortOrder,
    });
    setModal(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lines = (form.optionsJson ?? '').split('\n').map(l => l.trim()).filter(Boolean);
      const body = {
        ...form,
        optionsJson: lines.length > 0 ? JSON.stringify(lines) : null,
      };
      if (editing) {
        await apiClient.put(`/custom-fields/definitions/${editing.id}`, body);
      } else {
        await apiClient.post('/custom-fields/definitions', body);
      }
    },
    onSuccess: () => {
      notifications.show({ message: editing ? 'Field updated' : 'Field created', color: 'teal' });
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
      qc.invalidateQueries({ queryKey: ['custom-field-defs'] });
      setModal(false);
    },
    onError: (e: any) => notifications.show({
      message: e?.response?.data?.error ?? 'Failed to save field',
      color: 'red',
    }),
  });

  const toggleActive = useMutation({
    mutationFn: async (def: FieldDefinition) => {
      await apiClient.put(`/custom-fields/definitions/${def.id}`, { active: !def.active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] }),
  });

  // @ts-expect-error -- unused
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/custom-fields/definitions/${id}`); },
    onSuccess: () => {
      notifications.show({ message: 'Field deactivated', color: 'gray' });
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
    },
  });

  // Inline edit mutations for individual fields
  const updateFieldLabelMutation = useMutation({
    mutationFn: async ({ id, fieldLabel }: { id: number; fieldLabel: string }) => {
      await apiClient.put(`/custom-fields/definitions/${id}`, { fieldLabel });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
      qc.invalidateQueries({ queryKey: ['custom-field-defs'] });
    },
    onError: (e: any) => notifications.show({
      message: e?.response?.data?.error ?? 'Failed to update field',
      color: 'red',
    }),
  });

  const updateFieldTypeMutation = useMutation({
    mutationFn: async ({ id, fieldType }: { id: number; fieldType: string }) => {
      await apiClient.put(`/custom-fields/definitions/${id}`, { fieldType });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
      qc.invalidateQueries({ queryKey: ['custom-field-defs'] });
    },
    onError: (e: any) => notifications.show({
      message: e?.response?.data?.error ?? 'Failed to update field',
      color: 'red',
    }),
  });

  const updateRequiredMutation = useMutation({
    mutationFn: async ({ id, required }: { id: number; required: boolean }) => {
      await apiClient.put(`/custom-fields/definitions/${id}`, { required });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
      qc.invalidateQueries({ queryKey: ['custom-field-defs'] });
    },
    onError: (e: any) => notifications.show({
      message: e?.response?.data?.error ?? 'Failed to update field',
      color: 'red',
    }),
  });

  const updateOptionsJsonMutation = useMutation({
    mutationFn: async ({ id, optionsJson }: { id: number; optionsJson: string | null }) => {
      await apiClient.put(`/custom-fields/definitions/${id}`, { optionsJson });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
      qc.invalidateQueries({ queryKey: ['custom-field-defs'] });
    },
    onError: (e: any) => notifications.show({
      message: e?.response?.data?.error ?? 'Failed to update field',
      color: 'red',
    }),
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2} c={DEEP_BLUE}>Custom Project Fields</Title>
          <Text size="sm" c="dimmed">
            Define extra metadata fields that appear on every project
          </Text>
        </div>
        <Button leftSection={<IconPlus size={15} />} onClick={openCreate}>Add Field</Button>
      </Group>

      {isLoading ? (
        <Stack gap="xs">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>
      ) : defs.length === 0 ? (
        <Center h={200}>
          <Text c="dimmed">
            No custom fields yet. Add one to start extending projects.
          </Text>
        </Center>
      ) : (
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Order</Table.Th>
              <Table.Th>Field Name</Table.Th>
              <Table.Th>Label</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Default Value</Table.Th>
              <Table.Th>Options</Table.Th>
              <Table.Th>Required</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {defs.map(d => (
              <Table.Tr key={d.id} style={{ opacity: d.active ? 1 : 0.5 }}>
                <Table.Td c="dimmed">{d.sortOrder}</Table.Td>
                <Table.Td><code style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.fieldName}</code></Table.Td>
                <Table.Td>
                  <InlineTextCell
                    value={d.fieldLabel}
                    isEditing={isEditing(d.id, 'fieldLabel')}
                    onStartEdit={() => startEdit(d.id, 'fieldLabel')}
                    onCancel={() => stopEdit()}
                    onSave={async (newLabel) => {
                      await updateFieldLabelMutation.mutateAsync({ id: d.id, fieldLabel: newLabel });
                      stopEdit();
                    }}
                    placeholder="Enter label…"
                  />
                </Table.Td>
                <Table.Td>
                  <InlineSelectCell
                    value={d.fieldType}
                    options={TYPE_OPTIONS}
                    isEditing={isEditing(d.id, 'fieldType')}
                    onStartEdit={() => startEdit(d.id, 'fieldType')}
                    onCancel={() => stopEdit()}
                    onSave={async (newType) => {
                      await updateFieldTypeMutation.mutateAsync({ id: d.id, fieldType: newType });
                      stopEdit();
                    }}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">—</Text>
                </Table.Td>
                <Table.Td>
                  {d.fieldType === 'select' ? (
                    <InlineTextCell
                      value={
                        (() => {
                          try {
                            return d.optionsJson ? JSON.parse(d.optionsJson).join(', ') : '';
                          } catch { return d.optionsJson ?? ''; }
                        })()
                      }
                      isEditing={isEditing(d.id, 'optionsJson')}
                      onStartEdit={() => startEdit(d.id, 'optionsJson')}
                      onCancel={() => stopEdit()}
                      onSave={async (newOptions) => {
                        const lines = newOptions.split(',').map(l => l.trim()).filter(Boolean);
                        await updateOptionsJsonMutation.mutateAsync({
                          id: d.id,
                          optionsJson: lines.length > 0 ? JSON.stringify(lines) : null,
                        });
                        stopEdit();
                      }}
                      placeholder="comma-separated…"
                      maxWidth={200}
                    />
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <InlineSwitchCell
                    value={d.required}
                    onSave={async (newRequired) => {
                      await updateRequiredMutation.mutateAsync({ id: d.id, required: newRequired });
                    }}
                  />
                </Table.Td>
                <Table.Td>
                  <Badge color={d.active ? 'teal' : 'gray'} variant="light" size="xs">
                    {d.active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label={d.active ? 'Deactivate' : 'Activate'}>
                      <ActionIcon variant="subtle" color={d.active ? 'orange' : 'teal'} size="sm"
                        onClick={() => toggleActive.mutate(d)}
      aria-label="View"
    >
                        {d.active ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Create / Edit modal */}
      <Modal
        opened={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Custom Field' : 'Add Custom Field'}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Field Name (internal key)"
            placeholder="e.g. budget_code"
            value={form.fieldName}
            onChange={e => setForm(f => ({ ...f, fieldName: e.currentTarget.value.replace(/\s+/g, '_') }))}
            required
            disabled={!!editing} // can't rename existing fields
            description="Lowercase letters, numbers and underscores only. Cannot be changed later."
          />
          <TextInput
            label="Display Label"
            placeholder="e.g. Budget Code"
            value={form.fieldLabel}
            onChange={e => setForm(f => ({ ...f, fieldLabel: e.currentTarget.value }))}
            required
          />
          <Select
            label="Field Type"
            data={[
              { value: 'text',   label: 'Text' },
              { value: 'number', label: 'Number' },
              { value: 'date',   label: 'Date' },
              { value: 'select', label: 'Select (dropdown)' },
            ]}
            value={form.fieldType}
            onChange={v => setForm(f => ({ ...f, fieldType: v ?? 'text' }))}
            disabled={!!editing}
          />
          {form.fieldType === 'select' && (
            <Textarea
              label="Options (one per line)"
              placeholder={'Option A\nOption B\nOption C'}
              value={form.optionsJson}
              onChange={e => setForm(f => ({ ...f, optionsJson: e.currentTarget.value }))}
              autosize minRows={3}
            />
          )}
          <Group grow>
            <NumberInput
              label="Sort Order"
              value={form.sortOrder}
              onChange={v => setForm(f => ({ ...f, sortOrder: Number(v) || 0 }))}
              min={0} max={999}
              />
            <Box pt={24}>
              <Switch
                label="Required"
                checked={form.required}
                onChange={e => setForm(f => ({ ...f, required: e.currentTarget.checked }))}
              />
            </Box>
          </Group>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={() => setModal(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!form.fieldName || !form.fieldLabel}
            >
              {editing ? 'Save Changes' : 'Create Field'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
