import { useState, useEffect } from 'react';
import {
  Container, Title, Text, Button, Table, Badge, ActionIcon, Modal, TextInput,
  Switch, Group, Stack, Paper, Tooltip, Loader, Box, Alert, NumberInput,
  ScrollArea, SimpleGrid, ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconPencil, IconTrash, IconAlertCircle, IconHeadset,
  IconCheck, IconX,
} from '@tabler/icons-react';
import {
  useSupportBoards,
  useCreateSupportBoard, useUpdateSupportBoard, useDeleteSupportBoard,
  SupportBoard, BoardUpsertPayload,
} from '../../api/jira';
import { useJiraStatus } from '../../api/jira';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';

export default function SupportBoardsSettingsPage() {
  const { data: jiraStatus } = useJiraStatus();
  const { data: boards = [], isLoading } = useSupportBoards();

  const createBoard = useCreateSupportBoard();
  const updateBoard = useUpdateSupportBoard();
  const deleteBoard = useDeleteSupportBoard();

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<SupportBoard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportBoard | null>(null);

  function openCreate() { setEditTarget(null); setModal('create'); }
  function openEdit(b: SupportBoard) { setEditTarget(b); setModal('edit'); }

  function handleSave(payload: BoardUpsertPayload & { enabled: boolean }) {
    if (modal === 'create') {
      createBoard.mutate(payload, {
        onSuccess: () => {
          setModal(null);
          notifications.show({ title: 'Created', message: 'Support board added', color: 'teal', icon: <IconCheck size={16} /> });
        },
      });
    } else if (editTarget) {
      updateBoard.mutate({ id: editTarget.id, ...payload }, {
        onSuccess: () => {
          setModal(null);
          notifications.show({ title: 'Updated', message: 'Support board updated', color: 'teal', icon: <IconCheck size={16} /> });
        },
      });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteBoard.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        notifications.show({ title: 'Removed', message: 'Support board removed', color: 'gray' });
      },
    });
  }

  const activeCount = boards.filter(b => b.enabled).length;
  const disabledCount = boards.filter(b => !b.enabled).length;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Support Boards
          </Title>
          <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            Configure which Jira boards appear in the Support Queue dashboard
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={14} />}
          size="sm"
          onClick={openCreate}
          style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}
        >
          Add Board
        </Button>
      </Group>

      {!jiraStatus?.configured && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />} mb="lg" radius="md"
          styles={{ message: { fontFamily: FONT_FAMILY } }}>
          Jira is not configured. Please add your Jira credentials in Settings → Jira Credentials first.
        </Alert>
      )}

      {/* ── Summary Cards ── */}
      <SimpleGrid cols={{ base: 2, sm: 3 }} mb="lg">
        <Paper shadow="xs" radius="md" p="md" withBorder>
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" variant="light" style={{ color: DEEP_BLUE, backgroundColor: `${DEEP_BLUE}15` }}>
              <IconHeadset size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Total Boards</Text>
              <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{boards.length}</Text>
            </div>
          </Group>
        </Paper>
        <Paper shadow="xs" radius="md" p="md" withBorder>
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" variant="light" style={{ color: '#2b8a3e', backgroundColor: '#2b8a3e15' }}>
              <IconCheck size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Active</Text>
              <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: '#2b8a3e' }}>{activeCount}</Text>
            </div>
          </Group>
        </Paper>
        <Paper shadow="xs" radius="md" p="md" withBorder>
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" variant="light" style={{ color: '#868e96', backgroundColor: '#868e9615' }}>
              <IconX size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Disabled</Text>
              <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: '#868e96' }}>{disabledCount}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ── Table ── */}
      <Paper shadow="xs" radius="md" withBorder>
        <ScrollArea h={480}>
          {isLoading ? (
            <Box p="xl" ta="center"><Loader color={AQUA} /></Box>
          ) : boards.length === 0 ? (
            <Box p="xl" ta="center">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto" mb="sm">
                <IconHeadset size={24} />
              </ThemeIcon>
              <Text c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                No support boards configured yet. Click "Add Board" to get started.
              </Text>
            </Box>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Board Name</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Project / Queue</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Stale After</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Status</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, width: 90 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {boards.map(b => (
                  <Table.Tr key={b.id}>
                    <Table.Td>
                      <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{b.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      {b.projectKey ? (
                        <Group gap={4}>
                          <Badge size="sm" variant="light" color="teal" style={{ fontFamily: FONT_FAMILY }}>
                            {b.projectKey}
                          </Badge>
                          {b.queueId && (
                            <Badge size="xs" variant="outline" color="gray" style={{ fontFamily: FONT_FAMILY }}>
                              Queue {b.queueId}
                            </Badge>
                          )}
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>SD #{b.boardId}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                        {b.staleThresholdDays ?? 3} biz days
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={b.enabled ? 'green' : 'gray'}
                        leftSection={b.enabled ? <IconCheck size={10} /> : <IconX size={10} />}
                      >
                        {b.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" size="xs" color="blue" onClick={() => openEdit(b)}>
                            <IconPencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Remove">
                          <ActionIcon variant="subtle" color="red" size="xs" onClick={() => setDeleteTarget(b)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>
      </Paper>

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
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: '#c92a2a' }}>Remove Support Board</Text>}
        size="sm"
        centered
      >
        <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
          Remove <strong>{deleteTarget?.name}</strong> from the support queue? This only removes
          the configuration — no Jira data is deleted.
        </Text>
        {deleteBoard.error && (
          <Alert color="red" mt="sm" icon={<IconAlertCircle size={16} />} radius="md">
            {(deleteBoard.error as Error).message}
          </Alert>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteTarget(null)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
          <Button color="red" loading={deleteBoard.isPending} onClick={handleDelete} style={{ fontFamily: FONT_FAMILY }}>
            Remove
          </Button>
        </Group>
      </Modal>
    </Container>
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
  const [name, setName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [queueId, setQueueId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [staleThresholdDays, setStaleThresholdDays] = useState<number>(3);

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
      title={
        <Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
          {mode === 'create' ? 'Add Support Board' : `Edit — ${initial?.name}`}
        </Text>
      }
      size="lg"
      centered
    >
      <Stack gap="sm">
        <TextInput
          label="Board Name"
          placeholder="e.g. Accessioning Queue"
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          required
          styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
        />

        <Group grow align="flex-end">
          <TextInput
            label="Project Key"
            placeholder="e.g. AC"
            description="From the Jira URL: /projects/{key}/queues/..."
            value={projectKey}
            onChange={e => setProjectKey(e.currentTarget.value.toUpperCase())}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY }, description: { fontFamily: FONT_FAMILY } }}
          />
          <TextInput
            label="Queue ID (optional)"
            placeholder="e.g. 1649"
            description="From the URL: /queues/custom/{id}"
            value={queueId}
            onChange={e => setQueueId(e.currentTarget.value.replace(/\D/g, ''))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY }, description: { fontFamily: FONT_FAMILY } }}
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
          styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY }, description: { fontFamily: FONT_FAMILY } }}
        />

        {mode === 'edit' && (
          <Switch
            label="Board active"
            checked={enabled}
            onChange={e => setEnabled(e.currentTarget.checked)}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
        )}

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} radius="md">{error}</Alert>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
          <Button loading={saving} disabled={!canSave} onClick={handleSave}
            style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
            {mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
