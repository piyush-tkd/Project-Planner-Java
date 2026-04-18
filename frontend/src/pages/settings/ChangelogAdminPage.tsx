import { useState } from 'react';
import {
  Title, Text, Stack, Group, Badge, Button, Table, Modal, TextInput,
  Textarea, Select, Switch, ActionIcon, Tooltip, Skeleton, Center, Alert, ThemeIcon,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconEye, IconEyeOff, IconAlertTriangle, IconNotes } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { DEEP_BLUE } from '../../brandTokens';

interface ChangelogEntry {
  id: number; version: string; title: string; description: string;
  changeType: string; published: boolean; createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
  feature: 'blue', improvement: 'teal', fix: 'orange', breaking: 'red',
};

const BLANK = { version: '', title: '', description: '', changeType: 'feature', published: false };

export default function ChangelogAdminPage() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [form,    setForm]    = useState(BLANK);

  const { data: entries = [], isLoading, isError } = useQuery<ChangelogEntry[]>({
    queryKey: ['changelog-all'],
    queryFn: async () => { const r = await apiClient.get('/changelog/all'); return r.data; },
  });

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setModal(true);
  }

  function openEdit(e: ChangelogEntry) {
    setEditing(e);
    setForm({ version: e.version, title: e.title, description: e.description, changeType: e.changeType, published: e.published });
    setModal(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await apiClient.put(`/changelog/${editing.id}`, form);
      } else {
        await apiClient.post('/changelog', form);
      }
    },
    onSuccess: () => {
      notifications.show({ message: editing ? 'Entry updated' : 'Entry created', color: 'teal' });
      qc.invalidateQueries({ queryKey: ['changelog-all'] });
      qc.invalidateQueries({ queryKey: ['changelog-published'] });
      qc.invalidateQueries({ queryKey: ['changelog-unread'] });
      setModal(false);
    },
    onError: () => notifications.show({ message: 'Failed to save', color: 'red' }),
  });

  const togglePublish = useMutation({
    mutationFn: async (entry: ChangelogEntry) => {
      await apiClient.put(`/changelog/${entry.id}`, { published: !entry.published });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['changelog-all'] });
      qc.invalidateQueries({ queryKey: ['changelog-published'] });
      qc.invalidateQueries({ queryKey: ['changelog-unread'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/changelog/${id}`); },
    onSuccess: () => {
      notifications.show({ message: 'Deleted', color: 'gray' });
      qc.invalidateQueries({ queryKey: ['changelog-all'] });
      qc.invalidateQueries({ queryKey: ['changelog-published'] });
    },
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2} c={DEEP_BLUE}>Changelog Admin</Title>
          <Text size="sm" c="dimmed">
            Manage versioned release notes shown in "What's New"
          </Text>
        </div>
        <Button leftSection={<IconPlus size={15} />} onClick={openCreate}>New Entry</Button>
      </Group>

      {isLoading ? (
        <Stack gap="xs">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>
      ) : isError ? (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} radius="md">
          Failed to load changelog entries. Please refresh the page to try again.
        </Alert>
      ) : (
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Version</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Center py="xl">
                    <Stack align="center" gap="xs">
                      <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                        <IconNotes size={24} />
                      </ThemeIcon>
                      <Text fw={600} c="dimmed" size="sm">No changelog entries yet</Text>
                      <Text c="dimmed" size="xs" ta="center" maw={320}>
                        Click <strong>+ New Entry</strong> to document a release, feature, or fix — entries will appear in the "What's New" panel for your team.
                      </Text>
                    </Stack>
                  </Center>
                </Table.Td>
              </Table.Tr>
            )}
            {entries.map(e => (
              <Table.Tr key={e.id}>
                <Table.Td><Badge variant="outline" size="xs">{e.version}</Badge></Table.Td>
                <Table.Td fw={500}>{e.title}</Table.Td>
                <Table.Td><Badge color={TYPE_COLOR[e.changeType] ?? 'blue'} size="xs">{e.changeType}</Badge></Table.Td>
                <Table.Td>
                  <Badge color={e.published ? 'teal' : 'gray'} variant="light" size="xs">
                    {e.published ? 'Published' : 'Draft'}
                  </Badge>
                </Table.Td>
                <Table.Td c="dimmed">{new Date(e.createdAt).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label={e.published ? 'Unpublish' : 'Publish'}>
                      <ActionIcon
                        variant="subtle" color={e.published ? 'orange' : 'teal'} size="sm"
                        loading={togglePublish.isPending}
                        onClick={() => togglePublish.mutate(e)}
                        aria-label="View"
                      >
                        {e.published ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => openEdit(e)}
      aria-label="Edit"
    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="sm"
                      onClick={() => deleteMutation.mutate(e.id)}
      aria-label="Delete"
    >
                      <IconTrash size={14} />
                    </ActionIcon>
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
        title={editing ? 'Edit Changelog Entry' : 'New Changelog Entry'}
        size="md"
      >
        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Version" placeholder="v14.0"
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.currentTarget.value }))}
            />
            <Select
              label="Type"
              data={[
                { value: 'feature',     label: 'Feature' },
                { value: 'improvement', label: 'Improvement' },
                { value: 'fix',         label: 'Fix' },
                { value: 'breaking',    label: 'Breaking Change' },
              ]}
              value={form.changeType}
              onChange={v => setForm(f => ({ ...f, changeType: v ?? 'feature' }))}
            />
          </Group>
          <TextInput
            label="Title *"
            placeholder="Brief description of the change…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.currentTarget.value }))}
            required
          />
          <Textarea
            label="Description *"
            placeholder="Details about what changed and why…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.currentTarget.value }))}
            required autosize minRows={3}
          />
          <Switch
            label="Publish immediately"
            checked={form.published}
            onChange={e => setForm(f => ({ ...f, published: e.currentTarget.checked }))}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={() => setModal(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!form.title || !form.description || !form.version}
            >
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
