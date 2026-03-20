import { useState, useEffect } from 'react';
import {
  Title, Text, Button, Table, Badge, ActionIcon, Modal, TextInput,
  Switch, Group, Stack, Paper, Tooltip, Loader, Center, Alert, NumberInput,
} from '@mantine/core';
import {
  IconPlus, IconPencil, IconTrash, IconAlertCircle, IconRefresh,
} from '@tabler/icons-react';
import {
  useSupportBoards,
  useCreateSupportBoard, useUpdateSupportBoard, useDeleteSupportBoard,
  SupportBoard, BoardUpsertPayload,
} from '../../api/jira';
import { useJiraStatus } from '../../api/jira';

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SupportBoardsSettingsPage() {
  const { data: jiraStatus } = useJiraStatus();
  const { data: boards = [], isLoading } = useSupportBoards();

  const createBoard = useCreateSupportBoard();
  const updateBoard = useUpdateSupportBoard();
  const deleteBoard = useDeleteSupportBoard();

  const [modal, setModal]           = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<SupportBoard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportBoard | null>(null);

  function openCreate() { setEditTarget(null); setModal('create'); }
  function openEdit(b: SupportBoard) { setEditTarget(b); setModal('edit'); }

  function handleSave(payload: BoardUpsertPayload & { enabled: boolean }) {
    if (modal === 'create') {
      createBoard.mutate(payload, { onSuccess: () => setModal(null) });
    } else if (editTarget) {
      updateBoard.mutate({ id: editTarget.id, ...payload }, { onSuccess: () => setModal(null) });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteBoard.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}>
            Support Boards
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            Configure which Jira boards are shown in the Support Queue dashboard.
          </Text>
        </div>
        <Group gap="sm">
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate} size="sm">
            Add Board
          </Button>
        </Group>
      </Group>

      {!jiraStatus?.configured && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          Jira is not configured. Please add your Jira credentials in Settings → Jira Credentials first.
        </Alert>
      )}

      {isLoading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Board Name</Table.Th>
                <Table.Th>Project / Queue</Table.Th>
                <Table.Th>Stale After</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ width: 90 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {boards.map(b => (
                <Table.Tr key={b.id}>
                  <Table.Td>
                    <Text fw={600} size="sm" style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}>
                      {b.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {b.projectKey
                      ? <Text size="sm" fw={600} c="teal">{b.projectKey}{b.queueId ? ` · Queue ${b.queueId}` : ''}</Text>
                      : <Text size="sm" c="dimmed">SD #{b.boardId}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{b.staleThresholdDays ?? 3} biz days</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={b.enabled ? 'green' : 'gray'} variant="dot" size="sm">
                      {b.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Edit">
                        <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(b)}>
                          <IconPencil size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Remove">
                        <ActionIcon variant="subtle" color="red" size="sm"
                          onClick={() => setDeleteTarget(b)}>
                          <IconTrash size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {boards.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '24px' }}>
                    No support boards configured yet. Click "Add Board" to get started.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* ── Create / Edit Modal ── */}
      <BoardFormModal
        opened={modal !== null}
        mode={modal ?? 'create'}
        initial={editTarget}
        onClose={() => setModal(null)}
        onSave={(payload) => handleSave(payload)}
        saving={createBoard.isPending || updateBoard.isPending}
        error={
          (createBoard.error as Error | null)?.message ??
          (updateBoard.error as Error | null)?.message ?? null
        }
      />

      {/* ── Delete Modal ── */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Remove Support Board"
        size="sm"
      >
        <Text size="sm">
          Remove <strong>{deleteTarget?.name}</strong> from the support queue? This only removes
          the configuration — no Jira data is deleted.
        </Text>
        {deleteBoard.error && (
          <Alert color="red" mt="sm" icon={<IconAlertCircle size={16} />}>
            {(deleteBoard.error as Error).message}
          </Alert>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="red" loading={deleteBoard.isPending} onClick={handleDelete}>Remove</Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// ── Form Modal ─────────────────────────────────────────────────────────────────

interface FormProps {
  opened: boolean;
  mode: 'create' | 'edit';
  initial: SupportBoard | null;
  onClose: () => void;
  onSave: (payload: BoardUpsertPayload & { enabled: boolean }) => void;
  saving: boolean;
  error: string | null;
}

function BoardFormModal({
  opened, mode, initial, onClose, onSave, saving, error,
}: FormProps) {
  const [name,               setName]               = useState('');
  const [projectKey,         setProjectKey]         = useState('');
  const [queueId,            setQueueId]            = useState('');
  const [enabled,            setEnabled]            = useState(true);
  const [staleThresholdDays, setStaleThresholdDays] = useState<number>(3);

  // Populate form when opened/closed
  useEffect(() => {
    if (opened) {
      if (mode === 'edit' && initial) {
        setName(initial.name);
        setProjectKey(initial.projectKey ?? '');
        setQueueId(initial.queueId != null ? String(initial.queueId) : '');
        setEnabled(initial.enabled);
        setStaleThresholdDays(initial.staleThresholdDays ?? 3);
      } else {
        setName(''); setProjectKey(''); setQueueId('');
        setEnabled(true); setStaleThresholdDays(3);
      }
    }
  }, [opened]);

  function handleSave() {
    const pk = projectKey.trim().toUpperCase() || null;
    const qId = queueId ? Number(queueId) : null;
    if (!name.trim() || !pk) return;
    onSave({ name: name.trim(), projectKey: pk, queueId: qId, enabled, staleThresholdDays });
  }

  const canSave = !!name.trim() && !!projectKey.trim();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'Add Support Board' : `Edit — ${initial?.name}`}
      size="xl"
    >
      <Stack gap="sm">
        <TextInput
          label="Board Name"
          placeholder="e.g. Accessioning Queue"
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          required
        />

        {/* ── Preferred: project key + queue ID ── */}
        <Group grow align="flex-end">
          <TextInput
            label="Project Key"
            placeholder="e.g. AC"
            description="From the Jira URL: /projects/{key}/queues/..."
            value={projectKey}
            onChange={e => setProjectKey(e.currentTarget.value.toUpperCase())}
          />
          <TextInput
            label="Queue ID (optional)"
            placeholder="e.g. 1649"
            description="From the URL: /queues/custom/{id}"
            value={queueId}
            onChange={e => setQueueId(e.currentTarget.value.replace(/\D/g, ''))}
          />
        </Group>


        <NumberInput
          label="Stale threshold"
          description="Tickets with no activity for this many business days are flagged as stale"
          suffix=" business days"
          min={1}
          max={30}
          value={staleThresholdDays}
          onChange={v => setStaleThresholdDays(typeof v === 'number' ? v : 3)}
        />

        {mode === 'edit' && (
          <Switch
            label="Board active"
            checked={enabled}
            onChange={e => setEnabled(e.currentTarget.checked)}
          />
        )}

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!canSave} onClick={handleSave}>
            {mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
