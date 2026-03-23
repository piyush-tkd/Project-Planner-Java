import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title, Text, Stack, Group, Button, Card, Table, Modal, Select, NumberInput, TextInput, Textarea, ActionIcon, Badge, Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconEdit, IconCopy } from '@tabler/icons-react';
import NlpBreadcrumb from '../components/common/NlpBreadcrumb';
import { useProject, useUpdateProject, useDeleteProject, useProjectPodPlannings, useUpdatePodPlannings, useCopyProject } from '../api/projects';
import { usePods } from '../api/pods';
import { useEffortPatterns } from '../api/refData';
import { useReleases } from '../api/releases';
import { Priority, ProjectStatus } from '../types';
import type { ProjectRequest, ProjectPodPlanningRequest } from '../types';
import { deriveTshirtSize } from '../types/project';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatProjectDate } from '../utils/formatting';
import { useMonthLabels } from '../hooks/useMonthLabels';

const priorityOptions = Object.values(Priority).map(p => ({ value: p, label: p }));
const statusOptions = Object.values(ProjectStatus).map(s => ({ value: s, label: s.replace(/_/g, ' ') }));

// ── Extracted outside parent to prevent remount on every state change ────
function PodPlanForm({ plan, setPlan, releaseOptions, patternOptions }: {
  plan: ProjectPodPlanningRequest;
  setPlan: (p: ProjectPodPlanningRequest) => void;
  releaseOptions: { value: string; label: string }[];
  patternOptions: { value: string; label: string }[];
}) {
  const totalHours = (plan.devHours || 0) + (plan.qaHours || 0) + (plan.bsaHours || 0) + (plan.techLeadHours || 0);
  const withContingency = totalHours * (1 + (plan.contingencyPct || 0) / 100);
  const toNum = (v: number | string): number => {
    if (typeof v === 'number') return v;
    const parsed = parseFloat(v);
    return isNaN(parsed) ? 0 : parsed;
  };
  return (
    <Stack gap="sm">
      <Group grow>
        <NumberInput label="Dev Hours" value={plan.devHours} onChange={v => setPlan({ ...plan, devHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
        <NumberInput label="QA Hours" value={plan.qaHours} onChange={v => setPlan({ ...plan, qaHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
      </Group>
      <Group grow>
        <NumberInput label="BSA Hours" value={plan.bsaHours} onChange={v => setPlan({ ...plan, bsaHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
        <NumberInput label="Tech Lead Hours" value={plan.techLeadHours} onChange={v => setPlan({ ...plan, techLeadHours: toNum(v) })} min={0} decimalScale={1} allowDecimal hideControls={false} />
      </Group>
      <NumberInput
        label="Contingency %"
        description="Buffer added on top of total hours"
        value={plan.contingencyPct}
        onChange={v => setPlan({ ...plan, contingencyPct: toNum(v) })}
        min={0} max={100} suffix="%" decimalScale={1} allowDecimal
      />
      {totalHours > 0 && (
        <Text size="sm" c="dimmed">
          Total: <b>{totalHours.toFixed(0)}h</b>
          {plan.contingencyPct > 0 && <> → with contingency: <b>{withContingency.toFixed(0)}h</b></>}
          {' '}· Size: <Badge variant="light" size="sm">{deriveTshirtSize(withContingency)}</Badge>
        </Text>
      )}
      <Select
        label="Target Release"
        data={releaseOptions}
        value={plan.targetReleaseId ? String(plan.targetReleaseId) : ''}
        onChange={v => setPlan({ ...plan, targetReleaseId: v ? Number(v) : null })}
        clearable
      />
      <Select
        label="Effort Pattern"
        description="Override the project default for this POD"
        data={patternOptions}
        value={plan.effortPattern ?? ''}
        onChange={v => setPlan({ ...plan, effortPattern: v || null })}
        clearable
      />
    </Stack>
  );
}

const emptyPlan = (): ProjectPodPlanningRequest => ({
  podId: 0,
  devHours: 0,
  qaHours: 0,
  bsaHours: 0,
  techLeadHours: 0,
  contingencyPct: 0,
  targetReleaseId: null,
  effortPattern: null,
  podStartMonth: null,
  durationOverride: null,
});

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { data: plannings, isLoading: planningsLoading } = useProjectPodPlannings(projectId);
  const { data: pods } = usePods();
  const { data: releases } = useReleases();
  const updateProject = useUpdateProject();
  const updatePlannings = useUpdatePodPlannings();
  const deleteProject = useDeleteProject();
  const copyProject = useCopyProject();

  const { data: effortPatterns } = useEffortPatterns();
  const patternOptions = [
    { value: '', label: '— use project default —' },
    ...(effortPatterns ?? []).map(p => ({ value: p.name, label: p.name })),
  ];
  const releaseOptions = [
    { value: '', label: '— no target release —' },
    ...(releases ?? []).map(r => ({
      value: String(r.id),
      label: `${r.name}${r.type === 'SPECIAL' ? ' ⭐' : ''}`,
    })),
  ];
  const podOptions = (pods ?? []).map(p => ({ value: String(p.id), label: p.name }));
  const { monthLabels } = useMonthLabels();

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<ProjectRequest>({
    name: '', priority: Priority.P2, owner: '', startMonth: 1, durationMonths: 3,
    defaultPattern: 'Flat', status: ProjectStatus.ACTIVE, notes: null,
    startDate: null, targetDate: null, client: null,
  });
  const [nameError, setNameError] = useState<string>('');

  const [addModal, setAddModal] = useState(false);
  const [editPlanModal, setEditPlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState<ProjectPodPlanningRequest>(emptyPlan());
  const [editingPodId, setEditingPodId] = useState<number | null>(null);

  const planningToRequest = (p: { podId: number; devHours: number; qaHours: number; bsaHours: number; techLeadHours: number; contingencyPct: number; targetReleaseId: number | null; effortPattern: string | null; podStartMonth: number | null; durationOverride: number | null; }): ProjectPodPlanningRequest => ({
    podId: p.podId,
    devHours: p.devHours,
    qaHours: p.qaHours,
    bsaHours: p.bsaHours,
    techLeadHours: p.techLeadHours,
    contingencyPct: p.contingencyPct,
    targetReleaseId: p.targetReleaseId,
    effortPattern: p.effortPattern,
    podStartMonth: p.podStartMonth,
    durationOverride: p.durationOverride,
  });

  const handleAddPod = () => {
    if (!newPlan.podId) return;
    const existing = (plannings ?? []).map(planningToRequest);
    updatePlannings.mutate({ projectId, data: [...existing, newPlan] }, {
      onSuccess: () => {
        setAddModal(false);
        setNewPlan(emptyPlan());
        notifications.show({ title: 'Added', message: 'POD assignment added', color: 'green' });
      },
    });
  };

  const openEditPlan = (podId: number) => {
    const p = (plannings ?? []).find(x => x.podId === podId);
    if (!p) return;
    setNewPlan(planningToRequest(p));
    setEditingPodId(podId);
    setEditPlanModal(true);
  };

  const handleEditPlan = () => {
    const others = (plannings ?? []).filter(p => p.podId !== editingPodId).map(planningToRequest);
    updatePlannings.mutate({ projectId, data: [...others, newPlan] }, {
      onSuccess: () => {
        setEditPlanModal(false);
        setNewPlan(emptyPlan());
        notifications.show({ title: 'Updated', message: 'POD assignment updated', color: 'green' });
      },
    });
  };

  const handleRemovePod = (podId: number) => {
    const remaining = (plannings ?? []).filter(p => p.podId !== podId).map(planningToRequest);
    updatePlannings.mutate({ projectId, data: remaining }, {
      onSuccess: () => notifications.show({ title: 'Removed', message: 'POD removed', color: 'orange' }),
    });
  };

  const openEditProject = () => {
    if (!project) return;
    setEditForm({
      name: project.name,
      priority: project.priority,
      owner: project.owner,
      startMonth: project.startMonth ?? 1,
      durationMonths: project.durationMonths,
      defaultPattern: project.defaultPattern,
      status: project.status,
      notes: project.notes,
      startDate: project.startDate ?? null,
      targetDate: project.targetDate ?? null,
      client: project.client ?? null,
    });
    setEditModal(true);
  };

  const handleEditProject = () => {
    setNameError('');
    updateProject.mutate({ id: projectId, data: editForm }, {
      onSuccess: () => {
        setEditModal(false);
        setNameError('');
        notifications.show({ title: 'Updated', message: 'Project updated', color: 'green' });
      },
      onError: (error: any) => {
        if (error.response?.status === 409) {
          setNameError('A project with this name already exists');
        } else {
          notifications.show({ title: 'Error', message: error.message || 'Failed to update project', color: 'red' });
        }
      },
    });
  };

  const handleDeleteProject = () => {
    deleteProject.mutate(projectId, { onSuccess: () => navigate('/projects') });
  };

  const handleCopyProject = () => {
    copyProject.mutate(projectId, {
      onSuccess: (newProject) => {
        notifications.show({ title: 'Duplicated', message: 'Project duplicated successfully', color: 'green' });
        navigate(`/projects/${newProject.id}`);
      },
    });
  };

  // Total hours across all pods → derived T-shirt size
  const totalAllPodHours = (plannings ?? []).reduce((sum, p) => sum + p.totalHoursWithContingency, 0);

  if (isLoading || planningsLoading) return <LoadingSpinner variant="cards" message="Loading project details..." />;
  if (!project) return <Text c="red">Project not found</Text>;

  // PodPlanForm is now defined outside the component to prevent focus loss

  return (
    <Stack className="page-enter stagger-children">
      <NlpBreadcrumb />
      <Group className="detail-header">
        <Title order={2}>{project.name}</Title>
        <PriorityBadge priority={project.priority} />
        <StatusBadge status={project.status} />
        {totalAllPodHours > 0 && (
          <Tooltip label={`${totalAllPodHours.toFixed(0)}h total across all pods (incl. contingency)`}>
            <Badge variant="outline" color="gray">{deriveTshirtSize(totalAllPodHours)}</Badge>
          </Tooltip>
        )}
        <Button variant="light" size="xs" leftSection={<IconEdit size={14} />} onClick={openEditProject}>Edit</Button>
        <Button variant="light" size="xs" leftSection={<IconCopy size={14} />} onClick={handleCopyProject} loading={copyProject.isPending}>Duplicate</Button>
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
        {project.client && (
          <Text mt="xs" size="sm"><Text span c="dimmed">Client: </Text>{project.client}</Text>
        )}
        {project.notes && (
          <Text mt="sm" size="sm" c="dimmed">{project.notes}</Text>
        )}
      </Card>

      <Group justify="space-between">
        <Title order={3}>POD Assignments</Title>
        <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => { setNewPlan(emptyPlan()); setAddModal(true); }}>
          Add POD
        </Button>
      </Group>

      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>POD</Table.Th>
            <Table.Th>Dev h</Table.Th>
            <Table.Th>QA h</Table.Th>
            <Table.Th>BSA h</Table.Th>
            <Table.Th>TL h</Table.Th>
            <Table.Th>Contingency %</Table.Th>
            <Table.Th>Total (w/ contingency)</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Target Release</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(plannings ?? []).map(p => (
            <Table.Tr key={p.id}>
              <Table.Td fw={500}>{p.podName}</Table.Td>
              <Table.Td>{p.devHours}</Table.Td>
              <Table.Td>{p.qaHours}</Table.Td>
              <Table.Td>{p.bsaHours}</Table.Td>
              <Table.Td>{p.techLeadHours}</Table.Td>
              <Table.Td>{p.contingencyPct > 0 ? `${p.contingencyPct}%` : '-'}</Table.Td>
              <Table.Td fw={500}>{p.totalHoursWithContingency}h</Table.Td>
              <Table.Td><Badge variant="light">{deriveTshirtSize(p.totalHoursWithContingency)}</Badge></Table.Td>
              <Table.Td>{p.targetReleaseName ?? '-'}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="subtle" onClick={() => openEditPlan(p.podId)}>
                    <IconEdit size={14} />
                  </ActionIcon>
                  <ActionIcon color="red" variant="subtle" onClick={() => handleRemovePod(p.podId)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {(plannings ?? []).length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={10}>
                <Text ta="center" c="dimmed" py="md">No PODs assigned yet</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Group>
        <Button color="red" variant="outline" onClick={handleDeleteProject}>Delete Project</Button>
      </Group>

      {/* Edit Project Modal */}
      <Modal opened={editModal} onClose={() => { setEditModal(false); setNameError(''); }} title="Edit Project" size="xl">
        <Stack>
          <TextInput
            label="Name"
            value={editForm.name}
            onChange={e => {
              setEditForm({ ...editForm, name: e.target.value });
              setNameError('');
            }}
            error={nameError}
            required
          />
          <Group grow>
            <Select label="Priority" data={priorityOptions} value={editForm.priority} onChange={v => setEditForm({ ...editForm, priority: v as Priority })} required />
            <Select label="Status" data={statusOptions} value={editForm.status} onChange={v => setEditForm({ ...editForm, status: v as ProjectStatus })} required />
          </Group>
          <TextInput label="Owner" value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} />
          <TextInput label="Client" placeholder="Optional — external client name" value={editForm.client ?? ''} onChange={e => setEditForm({ ...editForm, client: e.target.value || null })} />
          <Group grow>
            <DateInput label="Start Date" value={editForm.startDate ? new Date(editForm.startDate + 'T00:00:00') : null} onChange={d => setEditForm({ ...editForm, startDate: d ? d.toISOString().slice(0, 10) : null })} clearable valueFormat="MMM DD, YYYY" />
            <DateInput label="Launch Date" value={editForm.targetDate ? new Date(editForm.targetDate + 'T00:00:00') : null} onChange={d => setEditForm({ ...editForm, targetDate: d ? d.toISOString().slice(0, 10) : null })} clearable valueFormat="MMM DD, YYYY" />
          </Group>
          <Select label="Default Pattern" data={(effortPatterns ?? []).map(p => ({ value: p.name, label: p.name }))} value={editForm.defaultPattern} onChange={v => setEditForm({ ...editForm, defaultPattern: v ?? 'Flat' })} />
          <Textarea label="Notes" value={editForm.notes ?? ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value || null })} />
          <Button onClick={handleEditProject} loading={updateProject.isPending}>Save Changes</Button>
        </Stack>
      </Modal>

      {/* Add POD Modal */}
      <Modal opened={addModal} onClose={() => setAddModal(false)} title="Add POD Assignment" size="md">
        <Stack>
          <Select label="POD" data={podOptions} value={newPlan.podId ? String(newPlan.podId) : null} onChange={v => setNewPlan({ ...newPlan, podId: Number(v) })} required />
          <PodPlanForm plan={newPlan} setPlan={setNewPlan} releaseOptions={releaseOptions} patternOptions={patternOptions} />
          <Button onClick={handleAddPod} loading={updatePlannings.isPending} disabled={!newPlan.podId}>Add</Button>
        </Stack>
      </Modal>

      {/* Edit POD Modal */}
      <Modal opened={editPlanModal} onClose={() => setEditPlanModal(false)} title="Edit POD Assignment" size="md">
        <Stack>
          <Text fw={500} size="sm">POD: {(pods ?? []).find(p => p.id === editingPodId)?.name}</Text>
          <PodPlanForm plan={newPlan} setPlan={setNewPlan} releaseOptions={releaseOptions} patternOptions={patternOptions} />
          <Button onClick={handleEditPlan} loading={updatePlannings.isPending}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
