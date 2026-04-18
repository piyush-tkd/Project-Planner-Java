import { Table, TextInput, Select, Group, ActionIcon } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { AddRowForm } from '../types';

interface AddProjectRowProps {
  addRowForm: AddRowForm;
  setAddRowForm: (form: AddRowForm) => void;
  visibleCols: Set<string>;
  priorityOptions: { value: string; label: string }[];
  effortPatterns: any[] | undefined;
  statusOptions: { value: string; label: string }[];
  submitAddRow: () => void;
  setAddRowActive: (active: boolean) => void;
  isDark: boolean;
  createMutation: any;
}

export default function AddProjectRow({
  addRowForm,
  setAddRowForm,
  visibleCols,
  priorityOptions,
  statusOptions,
  submitAddRow,
  setAddRowActive,
  createMutation,
}: AddProjectRowProps) {
  return (
    <Table.Tr>
      <Table.Td />
      <Table.Td />
      <Table.Td>
        <TextInput
          placeholder="Project name"
          size="xs"
          value={addRowForm.name}
          onChange={e => setAddRowForm({ ...addRowForm, name: e.currentTarget.value })}
          onKeyDown={e => { if (e.key === 'Enter') submitAddRow(); if (e.key === 'Escape') setAddRowActive(false); }}
          autoFocus
        />
      </Table.Td>

      {visibleCols.has('Priority') && (
        <Table.Td>
          <Select
            size="xs"
            data={priorityOptions}
            value={addRowForm.priority}
            onChange={v => v && setAddRowForm({ ...addRowForm, priority: v })}
            style={{ width: 110 }}
          />
        </Table.Td>
      )}

      {visibleCols.has('Owner') && (
        <Table.Td>
          <TextInput
            size="xs"
            placeholder="Owner"
            value={addRowForm.owner}
            onChange={e => setAddRowForm({ ...addRowForm, owner: e.currentTarget.value })}
          />
        </Table.Td>
      )}

      {visibleCols.has('Start') && <Table.Td />}
      {visibleCols.has('End') && <Table.Td />}

      {visibleCols.has('Status') && (
        <Table.Td>
          <Select
            size="xs"
            data={statusOptions}
            value={addRowForm.status}
            onChange={v => v && setAddRowForm({ ...addRowForm, status: v })}
            style={{ width: 130 }}
          />
        </Table.Td>
      )}

      {visibleCols.has('Budget') && <Table.Td />}

      <Table.Td>
        <Group gap={4}>
          <ActionIcon
            size="sm"
            variant="filled"
            color="teal"
            loading={createMutation.isPending}
            onClick={submitAddRow}
            aria-label="Save new project"
          >
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setAddRowActive(false)} aria-label="Cancel">
            <IconX size={12} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
