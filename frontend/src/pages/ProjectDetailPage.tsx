import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title, Text, Stack, Group, Button, Card, Table, Modal, Select, NumberInput, TextInput, Textarea, ActionIcon, Badge,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';
import { useProject, useUpdateProject, useDeleteProject, useProjectPodPlannings, useUpdatePodPlannings } from '../api/projects';
import { usePods } from '../api/pods';
import { useTshirtSizes } from '../api/refData';
import { Priority, ProjectStatus } from '../types';
import type { ProjectRequest, ProjectPodPlanningRequest } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatProjectDate } from '../utils/formatting';
import { useMonthLabels } from '../hooks/useMonthLabels';

const priorityOptions = Object.values(Priority).map(p => ({ value: p, label: p }));
const statusOptions = Object.values(ProjectStatus).map(s => ({ value: s, label: s.replace('_', ' ') }));

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { data: plannings, isLoading: planningsLoading } = useProjectPodPlannings(projectId);
  const { data: pods } = usePods();
  const { data: tshirtSizes } = useTshirtSizes();
  const updateProject = useUpdateProject();
  const updatePlannings = useUpdatePodPlannings();
  const deleteProject = useDeleteProject();

  const sizeOptions = (tshirtSizes ?? []).map(s => ({ value: s.name, label: `${s.name} (${s.baseHours}h)` }));
  const { monthLabels } = useMonthLabels();
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<ProjectRequest>({
    name: '', priority: Priority.P2, owner: '', startMonth: 1, durationMonths: 3, defaultPattern: 'Flat', status: ProjectStatus.ACTIVE, notes: null, startDate: null, targetDate: null,
  });

  const [addModal, setAddModal] = useState(false);
  const [newPlan, setNewPlan] = useState<ProjectPodPlanningRequest>({
    podId: 0,
    tshirtSize: 'M',
    complexityOverride: null,
    effortPattern: null,
    podStartMonth: null,
    durationOverride: null,
  });

  const podOptions = (pods ?? []).map(p => ({ value: String(p.id), label: p.name }));

  const handleAddPod = () => {
    if (!newPlan.podId) return;
    const existing = (plannings ?? []).map(p => ({
      podId: p.podId,
      tshirtSize: p.tshirtSize,
      complexityOverride: p.complexityOverride,
      effortPattern: p.effortPattern,
      podStartMonth: p.podStartMonth,
      durationOverride: p.durationOverride,
    }));
    updatePlannings.mutate({
      projectId,
      data: [...existing, newPlan],
    }, {
      onSuccess: () => {
        setAddModal(false);
        notifications.show({ title: 'Added', message: 'POD assignment added', color: 'green' });
      },
    });
  };

  const handleRemovePod = (podId: number) => {
    const remaining = (plannings ?? [])
      .filter(p => p.podId !== podId)
      .map(p => ({
        podId: p.podId,
        tshirtSize: p.tshirtSize,
        complexityOverride: p.complexityOverride,
        effortPattern: p.effortPattern,
        podStartMonth: p.podStartMonth,
        durationOverride: p.durationOverride,
      }));
    updatePlannings.mutate({ projectId, data: remaining });
  };

  const openEditProject = () => {
    if (!project) return;
    setEditForm({
      name: project.name,
      priority: project.priority,
      owner: project.owner,
      startMonth: project.startMonth,
      durationMonths: project.durationMonths,
      defaultPattern: project.defaultPattern,
      status: project.status,
      notes: project.notes,
      startDate: project.startDate ?? null,
      targetDate: project.targetDate ?? null,
    });
    setEditModal(true);
  };

  const handleEditProject = () => {
    updateProject.mutate({ id: projectId, data: editForm }, {
      onSuccess: () => {
        setEditModal(false);
        notifications.show({ title: 'Updated', message: 'Project updated', color: 'green' });
      },
    });
  };

  const handleDeleteProject = () => {
    deleteProject.mutate(projectId, {
      onSuccess: () => navigate('/projects'),
    });
  };

  if (isLoading || planningsLoading) return <LoadingSpinner />;
  if (!project) return <Text c="red">Project not found</Text>;

  return (
    <Stack>
      <Group>
        <ActionIcon variant="subtle" onClick={() => navigate('/projects')}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={2}>{project.name}</Title>
        <PriorityBadge priority={project.priority} />
        <StatusBadge status={project.status} />
        <Button variant="light" size="xs" leftSection={<IconEdit size={14} />} onClick={openEditProject}>Edit</Button>
      </Group>

      <Card withBorder padding="md">
        <Group grow>
          <div>
            <Text size="sm" c="dimmed">Owner</Text>
            <Text fw={500}>{project.owner}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Duration</Text>
            <Text fw={500}>
              {project.durationMonths} months ({formatProjectDate(project.startDate, project.startMonth, monthLabels)} — {formatProjectDate(project.targetDate, project.targetEndMonth, monthLabels)})
            </Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">Pattern</Text>
            <Text fw={500}>{project.defaultPattern}</Text>
          </div>
        </Group>
        {project.notes && (
          <Text mt="sm" size="sm" c="dimmed">{project.notes}</Text>
        )}
      </Card>

      <Group justify="space-between">
        <Title order={3}>POD Assignments</Title>
        <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => setAddModal(true)}>
          Add POD
        </Button>
      </Group>

      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>POD</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Complexity Override</Table.Th>
            <Table.Th>Effort Pattern</Table.Th>
            <Table.Th>Start Month</Table.Th>
            <Table.Th>Duration Override</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(plannings ?? []).map(p => (
            <Table.Tr key={p.id}>
              <Table.Td fw={500}>{p.podName}</Table.Td>
              <Table.Td><Badge variant="light">{p.tshirtSize}</Badge></Table.Td>
              <Table.Td>{p.complexityOverride ?? '-'}</Table.Td>
              <Table.Td>{p.effortPattern ?? '-'}</Table.Td>
              <Table.Td>{p.podStartMonth ? `M${p.podStartMonth}` : '-'}</Table.Td>
              <Table.Td>{p.durationOverride ?? '-'}</Table.Td>
              <Table.Td>
                <ActionIcon color="red" variant="subtle" onClick={() => handleRemovePod(p.podId)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
          {(plannings ?? []).length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text ta="center" c="dimmed" py="md">No PODs assigned yet</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Group>
        <Button color="red" variant="outline" onClick={handleDeleteProject}>Delete Project</Button>
      </Group>

      <Modal opened={editModal} onClose={() => setEditModal(false)} title="Edit Project" size="lg">
        <Stack>
          <TextInput label="Name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
          <Group grow>
            <Select label="Priority" data={priorityOptions} value={editForm.priority} onChange={v => setEditForm({ ...editForm, priority: v as Priority })} required />
            <Select label="Status" data={statusOptions} value={editForm.status} onChange={v => setEditForm({ ...editForm, status: v as ProjectStatus })} required />
          </Group>
          <TextInput label="Owner" value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} />
          <Group grow>
            <DateInput
              label="Start Date"
              value={editForm.startDate ? new Date(editForm.startDate + 'T00:00:00') : null}
              onChange={d => setEditForm({ ...editForm, startDate: d ? d.toISOString().slice(0, 10) : null })}
              clearable
              valueFormat="MMM DD, YYYY"
            />
            <DateInput
              label="Launch Date"
              value={editForm.targetDate ? new Date(editForm.targetDate + 'T00:00:00') : null}
              onChange={d => setEditForm({ ...editForm, targetDate: d ? d.toISOString().slice(0, 10) : null })}
              clearable
              valueFormat="MMM DD, YYYY"
            />
          </Group>
          <TextInput label="Default Pattern" value={editForm.defaultPattern} onChange={e => setEditForm({ ...editForm, defaultPattern: e.target.value })} />
          <Textarea label="Notes" value={editForm.notes ?? ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value || null })} />
          <Button onClick={handleEditProject} loading={updateProject.isPending}>Save Changes</Button>
        </Stack>
      </Modal>

      <Modal opened={addModal} onClose={() => setAddModal(false)} title="Add POD Assignment">
        <Stack>
          <Select label="POD" data={podOptions} value={newPlan.podId ? String(newPlan.podId) : null} onChange={v => setNewPlan({ ...newPlan, podId: Number(v) })} required />
          <Select label="Size" data={sizeOptions} value={newPlan.tshirtSize} onChange={v => setNewPlan({ ...newPlan, tshirtSize: v ?? 'M' })} />
          <NumberInput label="Complexity Override" value={newPlan.complexityOverride ?? ''} onChange={v => setNewPlan({ ...newPlan, complexityOverride: v ? Number(v) : null })} decimalScale={2} />
          <TextInput label="Effort Pattern" value={newPlan.effortPattern ?? ''} onChange={e => setNewPlan({ ...newPlan, effortPattern: e.target.value || null })} />
          <NumberInput label="Start Month" value={newPlan.podStartMonth ?? ''} onChange={v => setNewPlan({ ...newPlan, podStartMonth: v ? Number(v) : null })} min={1} max={12} />
          <NumberInput label="Duration Override" value={newPlan.durationOverride ?? ''} onChange={v => setNewPlan({ ...newPlan, durationOverride: v ? Number(v) : null })} min={1} />
          <Button onClick={handleAddPod} loading={updatePlannings.isPending}>Add</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
