import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title, Text, Stack, Group, Card, Table, Badge, SimpleGrid,
  Tooltip, ScrollArea, Avatar, Button, Modal, TextInput, Alert,
  ActionIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PPPageLayout } from '../components/pp';
import {
  IconBriefcase, IconUsers, IconClock, IconAlertTriangle,
  IconPencil, IconTrash, IconArrowLeft, IconChartBar,
  IconCheck, IconX, IconHexagons, IconFlame, IconArrowsShuffle,
  IconChartAreaLine,
} from '@tabler/icons-react';
import ConnectedPages from '../components/common/ConnectedPages';
import { usePods, useUpdatePod, useDeletePod } from '../api/pods';
import { usePodProjects } from '../api/projects';
import { useResources, useAllAvailability } from '../api/resources';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTableSort } from '../hooks/useTableSort';
import { formatRole } from '../types';
import { deriveTshirtSize } from '../types/project';
import { COLOR_BLUE_LIGHT, COLOR_ORANGE, COLOR_SUCCESS, COLOR_VIOLET_LIGHT, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import SortableHeader from '../components/common/SortableHeader';
import SummaryCard from '../components/charts/SummaryCard';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useDarkMode } from '../hooks/useDarkMode';

const FULL_TIME_HOURS = [176, 176, 168, 176, 176, 184, 168, 176, 176, 168, 184, 168];

export default function PodDetailPage() {
  const isDark = useDarkMode();
  const { id } = useParams<{ id: string }>();
  const podId = Number(id);
  const navigate = useNavigate();

  const { data: pods, isLoading: podsLoading } = usePods();
  const { data: podProjects, isLoading: projectsLoading } = usePodProjects(podId);
  const { data: resources, isLoading: resourcesLoading } = useResources();
  const { data: availability } = useAllAvailability();
  const { monthLabels } = useMonthLabels();

  const updatePod = useUpdatePod();
  const deletePod = useDeletePod();

  // ── Rename state ───────────────────────────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const openRename = () => {
    setRenameDraft(pod?.name ?? '');
    setRenameOpen(true);
  };

  const commitRename = () => {
    if (!renameDraft.trim()) return;
    updatePod.mutate({ id: podId, data: { name: renameDraft.trim() } }, {
      onSuccess: () => {
        setRenameOpen(false);
        notifications.show({ title: 'Renamed', message: 'POD name updated', color: 'green' });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to rename POD', color: 'red' }),
    });
  };

  // ── Delete state ────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    deletePod.mutate(podId, {
      onSuccess: () => {
        setDeleteOpen(false);
        notifications.show({ title: 'Deleted', message: 'POD has been removed', color: 'red' });
        navigate('/pods');
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to delete POD', color: 'red' }),
    });
  };

  const pod = pods?.find(p => p.id === podId);

  const members = useMemo(() => {
    if (!resources) return [];
    return resources.filter(r => r.podAssignment?.podId === podId);
  }, [resources, podId]);

  /* ── Over-allocation check per resource ──── */
  const overAllocMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!availability) return map;
    for (const row of availability) {
      if (row.capacityFte >= 1) continue;
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const hours = row.months[m] ?? 0;
        const max = Math.round(FULL_TIME_HOURS[m - 1] * row.capacityFte);
        if (hours > max) count++;
      }
      if (count > 0) map.set(row.resourceId, count);
    }
    return map;
  }, [availability]);

  const stats = useMemo(() => {
    const projects = podProjects ?? [];
    const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
    const overAllocCount = members.filter(m => overAllocMap.has(m.id)).length;
    return {
      totalProjects: projects.length,
      activeProjects,
      members: members.length,
      totalFte: members.reduce((s, m) => s + (m.podAssignment?.capacityFte ?? 0), 0),
      overAllocCount,
    };
  }, [podProjects, members, overAllocMap]);

  const { sorted: sortedProjects, sortKey: pSortKey, sortDir: pSortDir, onSort: onPSort } = useTableSort(podProjects ?? []);
  const { sorted: sortedMembers, sortKey: mSortKey, sortDir: mSortDir, onSort: onMSort } = useTableSort(members);

  if (podsLoading || projectsLoading || resourcesLoading) return <LoadingSpinner variant="cards" message="Loading POD details..." />;
  if (!pod) return <Text c="red" p="xl">POD not found.</Text>;

  return (
    <PPPageLayout
      title={pod.name}
      animate
      actions={
        <Group gap="sm">
          {/* Back to list */}
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate('/pods')}
            size="sm"
          >
            All PODs
          </Button>

          {/* Jira Dashboard shortcut */}
          <Button
            variant="light"
            color="teal"
            leftSection={<IconChartBar size={14} />}
            onClick={() => navigate('/delivery/jira')}
            size="sm"
          >
            Jira Dashboard
          </Button>

          {/* Rename */}
          <Tooltip label="Rename this POD">
            <Button
              variant="light"
              color="blue"
              leftSection={<IconPencil size={14} />}
              onClick={openRename}
              size="sm"
            >
              Rename
            </Button>
          </Tooltip>

          {/* Delete */}
          <Tooltip label="Delete this POD">
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => setDeleteOpen(true)}
              size="sm"
            >
              Delete
            </Button>
          </Tooltip>
        </Group>
      }
    >
      <Stack className="stagger-children">
        {/* Active badge */}
        <Group>
          {pod.active
            ? <Badge color="green">Active</Badge>
            : <Badge color="gray">Inactive</Badge>}
          {(pod.complexityMultiplier ?? 1) !== 1 && (
            <Badge color="violet" variant="light">Complexity ×{(pod.complexityMultiplier ?? 1).toFixed(2)}</Badge>
          )}
        </Group>

        {/* Summary cards */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} className="stagger-grid">
          <SummaryCard title="Projects" value={stats.totalProjects} icon={<IconBriefcase size={20} color={COLOR_BLUE_LIGHT} />} />
          <SummaryCard title="Active Projects" value={stats.activeProjects} icon={<IconBriefcase size={20} color={COLOR_SUCCESS} />} />
          <SummaryCard title="Members" value={stats.members} icon={<IconUsers size={20} color={COLOR_VIOLET_LIGHT} />} />
          <SummaryCard title="Total FTE" value={stats.totalFte.toFixed(1)} icon={<IconClock size={20} color={COLOR_ORANGE} />} />
        </SimpleGrid>

        {/* Projects table */}
        <Card withBorder padding="md">
          <Title order={4} mb={4}>Projects Assigned</Title>
          <Text size="sm" c="dimmed" mb="sm">All projects this POD is working on</Text>
          <ScrollArea>
            <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SortableHeader sortKey="projectName" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Project</SortableHeader>
                  <SortableHeader sortKey="priority" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Priority</SortableHeader>
                  <SortableHeader sortKey="owner" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Owner</SortableHeader>
                  <SortableHeader sortKey="totalHoursWithContingency" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Size</SortableHeader>
                  <Table.Th>Pattern</Table.Th>
                  <SortableHeader sortKey="podStartMonth" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Start</SortableHeader>
                  <SortableHeader sortKey="durationOverride" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Duration</SortableHeader>
                  <SortableHeader sortKey="status" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Status</SortableHeader>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedProjects.map(p => (
                  <Table.Tr key={p.planningId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.projectId}`)}>
                    <Table.Td fw={500}>{p.projectName}</Table.Td>
                    <Table.Td><PriorityBadge priority={p.priority} /></Table.Td>
                    <Table.Td>{p.owner}</Table.Td>
                    <Table.Td><Badge variant="light">{deriveTshirtSize(p.totalHoursWithContingency)}</Badge></Table.Td>
                    <Table.Td>{p.effortPattern ?? p.defaultPattern}</Table.Td>
                    <Table.Td>{monthLabels[p.podStartMonth ?? p.projectStartMonth] ?? `M${p.podStartMonth ?? p.projectStartMonth}`}</Table.Td>
                    <Table.Td>{p.durationOverride ?? p.projectDurationMonths}m</Table.Td>
                    <Table.Td><StatusBadge status={p.status} /></Table.Td>
                  </Table.Tr>
                ))}
                {sortedProjects.length === 0 && (
                  <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="md">No projects assigned</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Team Members table */}
        <Card withBorder padding="md">
          <Group mb={4} gap="sm">
            <Title order={4}>Team Members</Title>
            {stats.overAllocCount > 0 && (
              <Badge color="orange" variant="light" size="sm" leftSection={<IconAlertTriangle size={12} />}>
                {stats.overAllocCount} over-allocated
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" mb="sm">
            Resources with this POD as their home —{' '}
            <Text
              span
              size="sm"
              c="teal"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/people/resources?tab=overrides')}
            >
              manage overrides →
            </Text>
          </Text>
          <ScrollArea>
            <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SortableHeader sortKey="name" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Name</SortableHeader>
                  <SortableHeader sortKey="role" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Role</SortableHeader>
                  <SortableHeader sortKey="location" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Location</SortableHeader>
                  <SortableHeader sortKey="podAssignment.capacityFte" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>FTE</SortableHeader>
                  <SortableHeader sortKey="active" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Active</SortableHeader>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedMembers.map(r => {
                  const fte = r.podAssignment?.capacityFte ?? 1;
                  const isPartTime = fte < 1;
                  const overCount = overAllocMap.get(r.id);
                  return (
                    <Table.Tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/people/resources?tab=directory&highlight=${r.id}`)}
                    >
                      <Table.Td fw={500}>
                        <Group gap={6} wrap="nowrap">
                          <Tooltip label={r.jiraAccountId ? 'Jira connected' : r.name} withArrow position="top">
                            <Avatar
                              src={r.avatarUrl ?? null}
                              size={24}
                              radius="xl"
                              color={r.jiraAccountId ? 'teal' : 'blue'}
                            >
                              {r.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                            </Avatar>
                          </Tooltip>
                          {r.name}
                          {overCount && (
                            <Tooltip label={`${overCount} month(s) exceed ${Math.round(fte * 100)}% FTE cap`}>
                              <IconAlertTriangle size={16} color="orange" />
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{formatRole(r.role)}</Table.Td>
                      <Table.Td>{r.location}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={isPartTime ? 'orange' : 'green'} size="sm">
                          {isPartTime ? `${Math.round(fte * 100)}%` : '100%'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{r.active ? 'Yes' : 'No'}</Table.Td>
                    </Table.Tr>
                  );
                })}
                {sortedMembers.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">No members assigned</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      </Stack>

      {/* ── Rename Modal ──────────────────────────────────────────────────── */}
      <Modal
        opened={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={<Group gap="xs"><IconPencil size={16} /><Text fw={600}>Rename POD</Text></Group>}
        size="sm"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="POD Name"
            value={renameDraft}
            onChange={e => setRenameDraft(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); }}
            autoFocus
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" leftSection={<IconX size={14} />} onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={14} />}
              onClick={commitRename}
              loading={updatePod.isPending}
              disabled={!renameDraft.trim()}
            >
              Save Name
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Connected Pages ───────────────────────────────────────────────── */}
      <ConnectedPages pages={[
        { label: 'All PODs', path: '/pods', icon: <IconHexagons size={16} />, color: 'teal', description: 'Back to the full POD management list' },
        { label: 'Jira POD Dashboard', path: '/delivery/jira', icon: <IconChartBar size={16} />, color: 'blue', description: 'Sprint velocity and ticket metrics for all Jira PODs' },
        { label: 'POD Capacity', path: '/reports/pod-capacity', icon: <IconFlame size={16} />, color: 'orange', description: 'Available vs allocated hours for this and other PODs' },
        { label: 'Resources', path: '/people/resources', icon: <IconUsers size={16} />, color: 'green', description: 'Manage people and POD assignments' },
        { label: 'Overrides', path: '/people/resources?tab=overrides', icon: <IconArrowsShuffle size={16} />, color: 'pink', description: 'Temporary cross-POD allocation adjustments' },
        { label: 'Project–POD Matrix', path: '/reports/project-pod-matrix', icon: <IconChartAreaLine size={16} />, color: 'violet', description: 'Full matrix of project assignments across all PODs' },
      ]} />

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={<Group gap="xs"><IconTrash size={16} color="var(--mantine-color-red-6)" /><Text fw={600} c="red">Delete POD</Text></Group>}
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete <Text span fw={700}>{pod.name}</Text>? Resources assigned
            to this POD will remain but lose their home POD assignment.
          </Text>
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
            <Text size="xs">This action cannot be undone.</Text>
          </Alert>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button color="red" leftSection={<IconTrash size={14} />} onClick={handleDelete} loading={deletePod.isPending}>
              Delete POD
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PPPageLayout>
  );
}
