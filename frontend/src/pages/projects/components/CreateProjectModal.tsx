import { Modal, Stack, TextInput, Select, Group, Textarea, Button } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useCallback } from 'react';
import type { ProjectRequest } from '../../../types';
import { Priority, ProjectStatus } from '../../../types';
import { priorityOptions } from '../constants';

interface CreateProjectModalProps {
  opened: boolean;
  onClose: () => void;
  form: ProjectRequest;
  onFormChange: (form: ProjectRequest) => void;
  nameError: string;
  onNameErrorChange: (error: string) => void;
  effortPatterns: Array<{ name: string }> | undefined;
  statusOptions: Array<{ value: string; label: string }>;
  existingNames: Set<string>;
  isLoading: boolean;
  onCreate: () => void;
}

export function CreateProjectModal({
  opened,
  onClose,
  form,
  onFormChange,
  nameError,
  onNameErrorChange,
  effortPatterns,
  statusOptions,
  existingNames,
  isLoading,
  onCreate,
}: CreateProjectModalProps) {
  const checkDuplicateName = useCallback((name: string) => {
    if (!name.trim()) return '';
    if (existingNames.has(name.trim().toLowerCase())) {
      return 'A project with this name already exists';
    }
    return '';
  }, [existingNames]);

  return (
    <Modal opened={opened} onClose={onClose} title="Add Project" size="xl">
      <Stack>
        <TextInput
          label="Name"
          value={form.name}
          onChange={e => {
            const val = e.target.value;
            onFormChange({ ...form, name: val });
            onNameErrorChange(checkDuplicateName(val));
          }}
          error={nameError}
          required
        />
        <Group grow>
          <Select label="Priority" data={priorityOptions} value={form.priority} onChange={v => onFormChange({ ...form, priority: v as Priority })} required />
          <Select label="Status" data={statusOptions} value={form.status} onChange={v => onFormChange({ ...form, status: v as ProjectStatus })} required />
        </Group>
        <TextInput label="Owner" value={form.owner} onChange={e => onFormChange({ ...form, owner: e.target.value })} />
        <TextInput label="Client" placeholder="Optional — external client name" value={form.client ?? ''} onChange={e => onFormChange({ ...form, client: e.target.value || null })} />
        <Group grow>
          <DateInput
            label="Start Date"
            value={form.startDate ? new Date(form.startDate + 'T00:00:00') : null}
            onChange={d => onFormChange({ ...form, startDate: d ? d.toISOString().slice(0, 10) : null })}
            clearable
            valueFormat="MMM DD, YYYY"
          />
          <DateInput
            label="Launch Date"
            value={form.targetDate ? new Date(form.targetDate + 'T00:00:00') : null}
            onChange={d => onFormChange({ ...form, targetDate: d ? d.toISOString().slice(0, 10) : null })}
            clearable
            valueFormat="MMM DD, YYYY"
          />
        </Group>
        <Select
          label="Default Pattern"
          data={(effortPatterns ?? []).map(p => ({ value: p.name, label: p.name }))}
          value={form.defaultPattern}
          onChange={v => onFormChange({ ...form, defaultPattern: v ?? 'Flat' })}
          clearable={false}
        />
        <Textarea label="Notes" value={form.notes ?? ''} onChange={e => onFormChange({ ...form, notes: e.target.value || null })} />
        <Button onClick={onCreate} loading={isLoading} disabled={!!nameError}>
          Create
        </Button>
      </Stack>
    </Modal>
  );
}
