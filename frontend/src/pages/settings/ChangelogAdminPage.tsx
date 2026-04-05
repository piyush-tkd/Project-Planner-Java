import { useState } from 'react';
import {
  Title, Text, Stack, Group, Badge, Button, Table, Modal, TextInput,
  Textarea, Select, Switch, ActionIcon, Tooltip, Loader, Center,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

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

  const { data: entries = [], isLoading } = useQuery<ChangelogEntry[]>({
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
    <Stack gap="lg" style={{ fontFamily: FONT_FAMILY }}>
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Changelog Admin</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Manage versioned release notes shown in "What's New"
          </Text>
        </div>
        <Button leftSection={<IconPlus size={15} />} onClick={openCreate}>New Entry</Button>
      </Group>

      {isLoading ? (
        <Center h={200}><Loader /></Center>
      ) : (
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Version</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Title</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Type</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Status</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Date</Table.Th>
              <Table.Th style={{ fontFamily: FONT_FAMILY }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
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
                      >
                        {e.published ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => openEdit(e)}>
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="sm"
                      onClick={() => deleteMutation.mutate(e.id)}>
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
              styles={{ input: { fontFamily: FONT_FAMILY } }}
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
              styles={{ input: { fontFamily: FONT_FAMILY } }}
            />
          </Group>
          <TextInput
            label="Title *"
            placeholder="Brief description of the change…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.currentTarget.value }))}
            required
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <Textarea
            label="Description *"
            placeholder="Details about what changed and why…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.currentTarget.value }))}
            required autosize minRows={3}
            styles={{ input: { fontFamily: FONT_FAMILY } }}
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
