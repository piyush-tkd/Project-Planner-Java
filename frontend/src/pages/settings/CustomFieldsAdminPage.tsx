import { useState } from 'react';
import {
  Title, Text, Stack, Group, Badge, Button, Table, Modal, TextInput,
  Select, Switch, ActionIcon, Tooltip, Loader, Center, Textarea, NumberInput,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconEye, IconEyeOff, IconGripVertical } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import type { FieldDefinition } from '../../components/common/CustomFieldsRenderer';

const TYPE_COLOR: Record<string, string> = {
  text: 'blue', number: 'teal', date: 'violet', select: 'orange',
};
const BLANK = { fieldName: '', fieldLabel: '', fieldType: 'text', optionsJson: '', required: false, sortOrder: 0 };

export default function CustomFieldsAdminPage() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<FieldDefinition | null>(null);
  const [form,    setForm]    = useState(BLANK);

  const { data: defs = [], isLoading } = useQuery<FieldDefinition[]>({
    queryKey: ['custom-field-defs-all'],
    queryFn: async () => { const r = await apiClient.get('/custom-fields/definitions/all'); return r.data; },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK, sortOrder: defs.length });
    setModal(true);
  }

  function openEdit(d: FieldDefinition) {
    setEditing(d);
    setForm({
      fieldName: d.fieldName, fieldLabel: d.fieldLabel,
      fieldType: d.fieldType, optionsJson: d.optionsJson ?? '',
      required: d.required, sortOrder: d.sortOrder,
    });
    setModal(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        optionsJson: form.optionsJson?.trim() || null,
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/custom-fields/definitions/${id}`); },
    onSuccess: () => {
      notifications.show({ message: 'Field deactivated', color: 'gray' });
      qc.invalidateQueries({ queryKey: ['custom-field-defs-all'] });
    },
  });

  return (
    <Stack gap="lg" style={{ fontFamily: FONT_FAMILY }}>
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Custom Project Fields</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Define extra metadata fields that appear on every project
          </Text>
        </div>
        <Button leftSection={<IconPlus size={15} />} onClick={openCreate}>Add Field</Button>
      </Group>

      {isLoading ? (
        <Center h={200}><Loader /></Center>
      ) : defs.length === 0 ? (
        <Center h={200}>
          <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            No custom fields yet. Add one to start extending projects.
          </Text>
        </Center>
      ) : (
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Order</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Field Name</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Label</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Type</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Required</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Status</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {defs.map(d => (
              <Table.Tr key={d.id} style={{ opacity: d.active ? 1 : 0.5 }}>
                <Table.Td c="dimmed">{d.sortOrder}</Table.Td>
                <Table.Td><code style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.fieldName}</code></Table.Td>
                <Table.Td fw={500}>{d.fieldLabel}</Table.Td>
                <Table.Td><Badge color={TYPE_COLOR[d.fieldType] ?? 'gray'} size="xs">{d.fieldType}</Badge></Table.Td>
                <Table.Td>{d.required ? <Badge color="red" size="xs">Required</Badge> : <Text c="dimmed" size="xs">Optional</Text>}</Table.Td>
                <Table.Td>
                  <Badge color={d.active ? 'teal' : 'gray'} variant="light" size="xs">
                    {d.active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => openEdit(d)}>
                      <IconEdit size={14} />
                    </ActionIcon>
                    <Tooltip label={d.active ? 'Deactivate' : 'Activate'}>
                      <ActionIcon variant="subtle" color={d.active ? 'orange' : 'teal'} size="sm"
                        onClick={() => toggleActive.mutate(d)}>
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
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <TextInput
            label="Display Label"
            placeholder="e.g. Budget Code"
            value={form.fieldLabel}
            onChange={e => setForm(f => ({ ...f, fieldLabel: e.currentTarget.value }))}
            required
            styles={{ input: { fontFamily: FONT_FAMILY } }}
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
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          {form.fieldType === 'select' && (
            <Textarea
              label="Options (one per line)"
              placeholder={'Option A\nOption B\nOption C'}
              value={
                (() => {
                  try {
                    return form.optionsJson ? JSON.parse(form.optionsJson).join('\n') : '';
                  } catch { return form.optionsJson ?? ''; }
                })()
              }
              onChange={e => {
                const lines = e.currentTarget.value.split('\n').map(l => l.trim()).filter(Boolean);
                setForm(f => ({ ...f, optionsJson: JSON.stringify(lines) }));
              }}
              autosize minRows={3}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          )}
          <Group grow>
            <NumberInput
              label="Sort Order"
              value={form.sortOrder}
              onChange={v => setForm(f => ({ ...f, sortOrder: Number(v) || 0 }))}
              min={0} max={999}
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
            <div style={{ paddingTop: 24 }}>
              <Switch
                label="Required"
                checked={form.required}
                onChange={e => setForm(f => ({ ...f, required: e.currentTarget.checked }))}
              />
            </div>
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
