import { useState } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import {
  Text,
  Stack,
  Center,
  Button,
  Group,
  Card,
  Progress,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Skeleton,
  ActionIcon,
  Menu,
  Tooltip,
  ThemeIcon,
  Divider,
  ScrollArea,
  Popover,
  Alert,
} from '@mantine/core';
import {
  IconTargetArrow,
  IconEdit,
  IconTrash,
  IconDots,
  IconLink,
  IconUnlink,
  IconBriefcase,
  IconCircleCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { PPPageLayout } from '../components/pp';
import apiClient from '../api/client';
import { AQUA, AQUA_HEX, DEEP_BLUE, DEEP_BLUE_HEX, SURFACE_BG } from '../brandTokens';

interface LinkedProject {
  projectId: number;
  name: string;
  status: string;
  computedProgress: number;
}

interface Objective {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  status: 'NOT_STARTED' | 'ON_TRACK' | 'AT_RISK' | 'COMPLETED';
  progress: number;
  targetDate?: string;
  quarter?: string;
}

interface CreateObjectivePayload {
  title: string;
  description?: string;
  owner?: string;
  status: 'NOT_STARTED' | 'ON_TRACK' | 'AT_RISK' | 'COMPLETED';
  progress: number;
  targetDate?: string;
  quarter?: string;
}

export default function ObjectivesPage() {
  const dark = useDarkMode();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [linkModalObjectiveId, setLinkModalObjectiveId] = useState<string | null>(null);
  const [addProjectId, setAddProjectId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateObjectivePayload>({
    title: '',
    description: '',
    owner: '',
    status: 'NOT_STARTED',
    progress: 0,
    targetDate: '',
    quarter: '',
  });

  // Fetch objectives
  const { data: objectives = [], isLoading, isError } = useQuery({
    queryKey: ['objectives'],
    queryFn: async () => {
      const res = await apiClient.get('/objectives');
      return res.data;
    },
  });

  // Fetch all projects (for link dropdown)
  const { data: allProjects = [], isError: projectsError } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const res = await apiClient.get('/projects/all');
      return res.data;
    },
  });

  // Fetch links for current link modal objective
  const { data: currentLinks = [], refetch: refetchLinks } = useQuery<LinkedProject[]>({
    queryKey: ['objective-links', linkModalObjectiveId],
    queryFn: async () => {
      if (!linkModalObjectiveId) return [];
      const res = await apiClient.get(`/objectives/${linkModalObjectiveId}/links`);
      return res.data;
    },
    enabled: !!linkModalObjectiveId,
  });

  const addLinkMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiClient.post(`/objectives/${linkModalObjectiveId}/links`, { projectId });
    },
    onSuccess: () => {
      refetchLinks();
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setAddProjectId(null);
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to add link' }),
  });

  const removeLinkMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiClient.delete(`/objectives/${linkModalObjectiveId}/links/${projectId}`);
    },
    onSuccess: () => {
      refetchLinks();
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to remove link' }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateObjectivePayload) => {
      const res = await apiClient.post('/objectives', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Objective created successfully',
      });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to create objective',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: CreateObjectivePayload) => {
      if (!editingId) throw new Error('No ID provided');
      const res = await apiClient.put(`/objectives/${editingId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Objective updated successfully',
      });
      resetForm();
      setModalOpen(false);
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to update objective',
      });
    },
  });

  // Inline update mutation
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const res = await apiClient.put(`/objectives/${id}`, { [field]: value });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to update objective',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/objectives/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      notifications.show({
        color: 'green',
        title: 'Success',
        message: 'Objective deleted successfully',
      });
    },
    onError: (err: any) => {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: err.message || 'Failed to delete objective',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      owner: '',
      status: 'NOT_STARTED',
      progress: 0,
      targetDate: '',
      quarter: '',
    });
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (objective: Objective) => {
    setFormData({
      title: objective.title,
      description: objective.description || '',
      owner: objective.owner || '',
      status: objective.status,
      progress: objective.progress,
      targetDate: objective.targetDate || '',
      quarter: objective.quarter || '',
    });
    setEditingId(objective.id);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      notifications.show({
        color: 'yellow',
        title: 'Validation',
        message: 'Title is required',
      });
      return;
    }

    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this objective?')) {
      deleteMutation.mutate(id);
    }
  };

  const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
    <Center py={80}>
      <Stack align="center" gap="md">
        <Icon size={64} color={DEEP_BLUE} opacity={0.2} />
        <Stack gap={4} align="center">
          <Text fw={600} size="lg">
            {title}
          </Text>
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        </Stack>
      </Stack>
    </Center>
  );

  const ObjectiveCard = ({ objective }: { objective: Objective }) => (
    <Card
      padding="md"
      radius="md"
      withBorder
      style={{
        borderColor: AQUA,
        borderWidth: 2,
        background: dark ? 'rgba(255,255,255,0.04)' : SURFACE_BG,
        boxShadow: '0 1px 4px rgba(12, 35, 64, 0.06)',
      }}
    >
      <Group justify="space-between" mb="sm">
        <Stack gap={0} style={{ flex: 1 }}>
          <Group justify="space-between">
            {editingCell?.id === objective.id && editingCell?.field === 'title' ? (
              <TextInput
                autoFocus
                defaultValue={objective.title}
                size="sm"
                style={{ flex: 1 }}
                onBlur={(e) => {
                  inlineUpdateMutation.mutate({ id: objective.id, field: 'title', value: e.currentTarget.value });
                  setEditingCell(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingCell(null);
                  if (e.key === 'Enter') {
                    inlineUpdateMutation.mutate({ id: objective.id, field: 'title', value: e.currentTarget.value });
                    setEditingCell(null);
                  }
                }}
              />
            ) : (
              <Text fw={600} style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: objective.id, field: 'title' })}>
                {objective.title}
              </Text>
            )}
            <Group gap={4}>
              <Tooltip label="Link Projects — auto-computes progress from linked project timelines">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="sm"
                  onClick={() => setLinkModalObjectiveId(objective.id)}
                >
                  <IconLink size={14} />
                </ActionIcon>
              </Tooltip>
              <Menu shadow="md">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="sm">
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconLink size={14} />}
                    onClick={() => setLinkModalObjectiveId(objective.id)}
                  >
                    Link Projects
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTrash size={14} />}
                    color="red"
                    onClick={() => handleDelete(objective.id)}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
          {editingCell?.id === objective.id && editingCell?.field === 'quarter' ? (
            <TextInput
              autoFocus
              defaultValue={objective.quarter || ''}
              size="xs"
              placeholder="e.g., Q2 2026"
              onBlur={(e) => {
                inlineUpdateMutation.mutate({ id: objective.id, field: 'quarter', value: e.currentTarget.value });
                setEditingCell(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingCell(null);
                if (e.key === 'Enter') {
                  inlineUpdateMutation.mutate({ id: objective.id, field: 'quarter', value: e.currentTarget.value });
                  setEditingCell(null);
                }
              }}
            />
          ) : (
            <Text size="xs" c="dimmed" style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: objective.id, field: 'quarter' })}>
              {objective.quarter || 'Click to add quarter'}
            </Text>
          )}
          {objective.description && (
            <Text size="xs" c="dimmed" mt={4}>
              {objective.description}
            </Text>
          )}
          {editingCell?.id === objective.id && editingCell?.field === 'owner' ? (
            <TextInput
              autoFocus
              defaultValue={objective.owner || ''}
              size="xs"
              placeholder="Owner"
              mt={4}
              onBlur={(e) => {
                inlineUpdateMutation.mutate({ id: objective.id, field: 'owner', value: e.currentTarget.value });
                setEditingCell(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingCell(null);
                if (e.key === 'Enter') {
                  inlineUpdateMutation.mutate({ id: objective.id, field: 'owner', value: e.currentTarget.value });
                  setEditingCell(null);
                }
              }}
            />
          ) : (
            <Text size="xs" c="dimmed" style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: objective.id, field: 'owner' })} mt={4}>
              Owner: {objective.owner || 'Unassigned'}
            </Text>
          )}
        </Stack>
        <Stack gap={4} align="flex-end">
          {editingCell?.id === objective.id && editingCell?.field === 'progress' ? (
            <NumberInput
              autoFocus
              defaultValue={objective.progress}
              min={0}
              max={100}
              size="xs"
              w={80}
              onBlur={(e) => {
                const val = Number(e.currentTarget.value) || 0;
                inlineUpdateMutation.mutate({ id: objective.id, field: 'progress', value: val });
                setEditingCell(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingCell(null);
                if (e.key === 'Enter') {
                  const val = Number(e.currentTarget.value) || 0;
                  inlineUpdateMutation.mutate({ id: objective.id, field: 'progress', value: val });
                  setEditingCell(null);
                }
              }}
            />
          ) : (
            <Badge color="blue" variant="light" style={{ cursor: 'pointer' }} onClick={() => setEditingCell({ id: objective.id, field: 'progress' })}>
              {objective.progress}%
            </Badge>
          )}
          {editingCell?.id === objective.id && editingCell?.field === 'status' ? (
            <Select
              size="xs"
              data={[
                { value: 'NOT_STARTED', label: 'Not Started' },
                { value: 'ON_TRACK', label: 'On Track' },
                { value: 'AT_RISK', label: 'At Risk' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              defaultValue={objective.status}
              onBlur={(e) => {
                const val = e.currentTarget.value || objective.status;
                inlineUpdateMutation.mutate({ id: objective.id, field: 'status', value: val });
                setEditingCell(null);
              }}
              onChange={(val) => {
                if (val) {
                  inlineUpdateMutation.mutate({ id: objective.id, field: 'status', value: val });
                  setEditingCell(null);
                }
              }}
              autoFocus
            />
          ) : (
            <Badge color={
              objective.status === 'COMPLETED' ? 'teal' :
              objective.status === 'AT_RISK' ? 'red' :
              objective.status === 'ON_TRACK' ? 'green' : 'gray'
            } variant="dot" size="xs" style={{ cursor: 'pointer' }} onClick={() => setEditingCell({ id: objective.id, field: 'status' })}>
              {objective.status.replace('_', ' ')}
            </Badge>
          )}
        </Stack>
      </Group>
      <Progress value={objective.progress} color={AQUA} size="md" radius="md" />
      <Group justify="space-between" mt="sm">
        {editingCell?.id === objective.id && editingCell?.field === 'targetDate' ? (
          <TextInput
            autoFocus
            defaultValue={objective.targetDate || ''}
            size="xs"
            placeholder="yyyy-MM-dd"
            onBlur={(e) => {
              inlineUpdateMutation.mutate({ id: objective.id, field: 'targetDate', value: e.currentTarget.value });
              setEditingCell(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingCell(null);
              if (e.key === 'Enter') {
                inlineUpdateMutation.mutate({ id: objective.id, field: 'targetDate', value: e.currentTarget.value });
                setEditingCell(null);
              }
            }}
          />
        ) : (
          objective.targetDate && (
            <Text size="xs" c="dimmed" style={{ cursor: 'text' }} onClick={() => setEditingCell({ id: objective.id, field: 'targetDate' })}>
              Due: {objective.targetDate}
            </Text>
          )
        )}
      </Group>
    </Card>
  );

  if (isLoading) {
    return (
      <Stack gap="xs" p="md">{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} radius="sm" />)}</Stack>
    );
  }

  return (
    <PPPageLayout
      title="Objectives"
      subtitle="OKR tracking and strategic goal alignment"
      animate
    >
      {(isError || projectsError) && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" mb="md" mx="md" radius="md">
          Failed to load data. Please try again or refresh the page.
        </Alert>
      )}
      {/* Header with Button */}
      <Group justify="flex-end" mb="lg">
        <Button
          variant="filled"
          onClick={openCreateModal}
          style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
        >
          New Objective
        </Button>
      </Group>

      {/* Objectives List */}
      {objectives.length === 0 ? (
        <EmptyState
          icon={IconTargetArrow}
          title="No objectives yet"
          description="Create your first objective to get started"
        />
      ) : (
        <Stack gap="md">
          {objectives.map((obj: Objective) => (
            <ObjectiveCard key={obj.id} objective={obj} />
          ))}
        </Stack>
      )}

      {/* Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Objective' : 'Create New Objective'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Enter objective title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            placeholder="Describe the objective"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />
          <TextInput
            label="Owner"
            placeholder="Objective owner"
            value={formData.owner}
            onChange={(e) => setFormData({ ...formData, owner: e.currentTarget.value })}
          />
          <Select
            label="Status"
            placeholder="Select status"
            data={[
              { value: 'NOT_STARTED', label: 'Not Started' },
              { value: 'ON_TRACK', label: 'On Track' },
              { value: 'AT_RISK', label: 'At Risk' },
              { value: 'COMPLETED', label: 'Completed' },
            ]}
            value={formData.status}
            onChange={(val) => setFormData({ ...formData, status: (val as any) })}
          />
          <NumberInput
            label="Progress (%)"
            placeholder="0-100"
            min={0}
            max={100}
            value={formData.progress}
            onChange={(val) => setFormData({ ...formData, progress: Number(val) || 0 })}
          />
          <TextInput
            label="Target Date"
            placeholder="yyyy-MM-dd"
            value={formData.targetDate}
            onChange={(e) => setFormData({ ...formData, targetDate: e.currentTarget.value })}
          />
          <TextInput
            label="Quarter"
            placeholder="e.g., Q2 2026"
            value={formData.quarter}
            onChange={(e) => setFormData({ ...formData, quarter: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ background: AQUA, color: DEEP_BLUE }}
            >
              {editingId ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Link Projects Modal */}
      <Modal
        opened={!!linkModalObjectiveId}
        onClose={() => { setLinkModalObjectiveId(null); setAddProjectId(null); }}
        title={
          <Group gap="sm">
            <ThemeIcon color="blue" variant="light" size={28} radius="sm">
              <IconLink size={14} />
            </ThemeIcon>
            <Text fw={600}>Link Projects to Objective</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Linked project completion percentages are averaged to auto-compute objective progress.
          </Text>

          <Divider label="Add a project" labelPosition="left" />
          <Group gap="sm">
            <Select
              placeholder="Select project to link…"
              data={(allProjects as any[])
                .filter((p: any) => !currentLinks.some(l => l.projectId === p.id))
                .map((p: any) => ({ value: String(p.id), label: p.name }))}
              value={addProjectId}
              onChange={setAddProjectId}
              searchable
              style={{ flex: 1 }}
              clearable
            />
            <Button
              size="sm"
              disabled={!addProjectId}
              loading={addLinkMutation.isPending}
              onClick={() => addProjectId && addLinkMutation.mutate(Number(addProjectId))}
              style={{ background: AQUA, color: DEEP_BLUE }}
            >
              Link
            </Button>
          </Group>

          <Divider label="Linked projects" labelPosition="left" />
          {currentLinks.length === 0 ? (
            <Center py="md">
              <Stack align="center" gap="xs">
                <IconBriefcase size={32} opacity={0.2} />
                <Text size="sm" c="dimmed">No projects linked yet</Text>
              </Stack>
            </Center>
          ) : (
            <ScrollArea mah={240}>
              <Stack gap="xs">
                {currentLinks.map(lp => (
                  <Group key={lp.projectId} justify="space-between" p="xs"
                    style={{ borderRadius: 6, border: '1px solid var(--mantine-color-gray-2)' }}>
                    <Group gap="sm">
                      {lp.computedProgress >= 100
                        ? <IconCircleCheck size={16} color="var(--mantine-color-teal-6)" />
                        : lp.computedProgress < 30
                        ? <IconAlertTriangle size={16} color="var(--mantine-color-yellow-6)" />
                        : <IconBriefcase size={16} color="var(--mantine-color-blue-6)" />}
                      <div>
                        <Text size="sm" fw={500}>{lp.name}</Text>
                        <Text size="xs" c="dimmed">{lp.status} · {lp.computedProgress}% complete</Text>
                      </div>
                    </Group>
                    <Group gap="xs">
                      <Progress value={lp.computedProgress} size={4} w={60} color="blue" />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        loading={removeLinkMutation.isPending}
                        onClick={() => removeLinkMutation.mutate(lp.projectId)}
                      >
                        <IconUnlink size={13} />
                      </ActionIcon>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>
    </PPPageLayout>
  );
}
