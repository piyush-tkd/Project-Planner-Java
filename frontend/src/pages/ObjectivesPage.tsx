import { useState } from 'react';
import {
  Title,
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
  Loader,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { IconTargetArrow, IconChartBar, IconRocket, IconEdit, IconTrash, IconDots } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../api/client';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';

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
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const { data: objectives = [], isLoading, error } = useQuery({
    queryKey: ['objectives'],
    queryFn: async () => {
      const res = await apiClient.get('/objectives');
      return res.data;
    },
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
        <Icon size={64} color="#0C2340" opacity={0.2} />
        <Stack gap={4} align="center">
          <Text fw={600} size="lg" style={{ fontFamily: FONT_FAMILY }}>
            {title}
          </Text>
          <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>
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
        background: 'white',
        boxShadow: '0 1px 4px rgba(12, 35, 64, 0.06)',
      }}
    >
      <Group justify="space-between" mb="sm">
        <Stack gap={0} style={{ flex: 1 }}>
          <Group justify="space-between">
            <Text fw={600} style={{ fontFamily: FONT_FAMILY }}>
              {objective.title}
            </Text>
            <Menu shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={() => openEditModal(objective)}
                >
                  Edit
                </Menu.Item>
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
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            {objective.quarter}
          </Text>
          {objective.description && (
            <Text size="xs" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
              {objective.description}
            </Text>
          )}
          {objective.owner && (
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              Owner: {objective.owner}
            </Text>
          )}
        </Stack>
        <Badge color="blue" variant="light">
          {objective.progress}%
        </Badge>
      </Group>
      <Progress value={objective.progress} color={AQUA} size="md" radius="md" />
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          Status: {objective.status}
        </Text>
        {objective.targetDate && (
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Due: {objective.targetDate}
          </Text>
        )}
      </Group>
    </Card>
  );

  if (isLoading) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* Header with Button */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 600 }}>
            Objectives
          </Title>
          <Text c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            Track OKRs and strategic goals
          </Text>
        </div>
        <Button
          color={AQUA}
          onClick={openCreateModal}
          styles={{ root: { backgroundColor: AQUA, color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 600 } }}
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
            onChange={(val) => setFormData({ ...formData, progress: val || 0 })}
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
    </Stack>
  );
}
