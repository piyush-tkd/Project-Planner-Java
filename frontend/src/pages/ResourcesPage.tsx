import { useState, useMemo } from 'react';
import {
  Title, Button, Group, Table, Modal, TextInput, Select, Switch, NumberInput, Stack, Text, ActionIcon, SimpleGrid,
  Badge, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconUsers, IconCode, IconTestPipe, IconUserStar, IconMapPin, IconAlertTriangle } from '@tabler/icons-react';
import { useResources, useCreateResource, useDeleteResource, useUpdateResource, useSetAssignment, useAllAvailability } from '../api/resources';
import { usePods } from '../api/pods';
import { Role, Location, formatRole } from '../types';
import type { ResourceRequest, ResourceResponse } from '../types';
import SummaryCard from '../components/charts/SummaryCard';
import SortableHeader from '../components/common/SortableHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CsvToolbar from '../components/common/CsvToolbar';
import { resourceColumns } from '../utils/csvColumns';
import { useTableSort } from '../hooks/useTableSort';

const FULL_TIME_HOURS = [176, 176, 168, 176, 176, 184, 168, 176, 176, 168, 184, 168];

const roleOptions = Object.values(Role).map(r => ({ value: r, label: formatRole(r) }));
const locationOptions = Object.values(Location).map(l => ({ value: l, label: l }));

const emptyForm: ResourceRequest = {
  name: '',
  role: Role.DEVELOPER,
  location: Location.US,
  active: true,
  countsInCapacity: true,
  homePodId: null,
  capacityFte: 1.0,
};

export default function ResourcesPage() {
  const { data: resources, isLoading, error } = useResources();
  const { data: pods } = usePods();
  const { data: availability } = useAllAvailability();
  const createMutation = useCreateResource();
  const deleteMutation = useDeleteResource();
  const updateMutation = useUpdateResource();
  const assignMutation = useSetAssignment();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ResourceRequest>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const podOptions = (pods ?? []).map(p => ({ value: String(p.id), label: p.name }));

  /* ── Over-allocation check per resource ──── */
  const overAllocMap = useMemo(() => {
    const map = new Map<number, number>(); // resourceId → count of over-allocated months
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
    const all = resources ?? [];
    const active = all.filter(r => r.active).length;
    const devs = all.filter(r => r.role === Role.DEVELOPER).length;
    const qa = all.filter(r => r.role === Role.QA).length;
    const bsa = all.filter(r => r.role === Role.BSA).length;
    const techLead = all.filter(r => r.role === Role.TECH_LEAD).length;
    const us = all.filter(r => r.location === Location.US).length;
    const india = all.filter(r => r.location === Location.INDIA).length;
    return { total: all.length, active, devs, qa, bsa, techLead, us, india };
  }, [resources]);

  const { sorted: sortedResources, sortKey, sortDir, onSort } = useTableSort(resources ?? []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (r: ResourceResponse) => {
    setForm({
      name: r.name,
      role: r.role,
      location: r.location,
      active: r.active,
      countsInCapacity: r.countsInCapacity,
      homePodId: r.podAssignment?.podId ?? null,
      capacityFte: r.podAssignment?.capacityFte ?? 1.0,
    });
    setEditId(r.id);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    const saveAssignment = (resourceId: number) => {
      if (form.homePodId) {
        assignMutation.mutate({
          resourceId,
          podId: form.homePodId,
          capacityFte: form.capacityFte,
        });
      }
    };

    if (editId) {
      updateMutation.mutate({ id: editId, data: form }, {
        onSuccess: () => {
          saveAssignment(editId);
          setModalOpen(false);
          notifications.show({ title: 'Updated', message: 'Resource updated', color: 'green' });
        },
      });
    } else {
      createMutation.mutate(form, {
        onSuccess: (created: ResourceResponse) => {
          saveAssignment(created.id);
          setModalOpen(false);
          notifications.show({ title: 'Created', message: 'Resource created', color: 'green' });
        },
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteConfirm(null);
        notifications.show({ title: 'Deleted', message: 'Resource deleted', color: 'red' });
      },
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading resources</Text>;

  const totalOverAlloc = Array.from(overAllocMap.values()).reduce((s, v) => s + v, 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={2}>Resources</Title>
          {totalOverAlloc > 0 && (
            <Tooltip label={`${overAllocMap.size} resource(s) have availability hours exceeding their FTE capacity`}>
              <Badge color="orange" variant="light" size="lg" leftSection={<IconAlertTriangle size={14} />}>
                {overAllocMap.size} over-allocated
              </Badge>
            </Tooltip>
          )}
        </Group>
        <Group gap="sm">
          <CsvToolbar
            data={resources ?? []}
            columns={resourceColumns}
            filename="resources"
            onImport={(rows) => {
              rows.forEach(row => {
                const podMatch = (pods ?? []).find(p => p.name.toLowerCase() === (row['podAssignment.podName'] ?? '').toLowerCase());
                createMutation.mutate({
                  name: row.name ?? '',
                  role: row.role ?? 'DEVELOPER',
                  location: row.location ?? 'US',
                  active: (row.active ?? 'Yes').toLowerCase() !== 'no',
                  countsInCapacity: (row.countsInCapacity ?? 'Yes').toLowerCase() !== 'no',
                  homePodId: podMatch?.id ?? null,
                  capacityFte: Number(row['podAssignment.capacityFte']) || 1.0,
                });
              });
            }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Resource</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <SummaryCard title="Total" value={stats.total} icon={<IconUsers size={20} color="#339af0" />} />
        <SummaryCard title="Active" value={stats.active} icon={<IconUsers size={20} color="#40c057" />} />
        <SummaryCard title="Developers" value={stats.devs} icon={<IconCode size={20} color="#845ef7" />} />
        <SummaryCard title="QA" value={stats.qa} icon={<IconTestPipe size={20} color="#fd7e14" />} />
        <SummaryCard title="BSA" value={stats.bsa} icon={<IconUserStar size={20} color="#e64980" />} />
        <SummaryCard title="Tech Lead" value={stats.techLead} icon={<IconUserStar size={20} color="#fab005" />} />
        <SummaryCard title="US" value={stats.us} icon={<IconMapPin size={20} color="#339af0" />} />
        <SummaryCard title="India" value={stats.india} icon={<IconMapPin size={20} color="#20c997" />} />
      </SimpleGrid>

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              <SortableHeader sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader>
              <SortableHeader sortKey="role" currentKey={sortKey} dir={sortDir} onSort={onSort}>Role</SortableHeader>
              <SortableHeader sortKey="location" currentKey={sortKey} dir={sortDir} onSort={onSort}>Location</SortableHeader>
              <SortableHeader sortKey="active" currentKey={sortKey} dir={sortDir} onSort={onSort}>Active</SortableHeader>
              <Table.Th>Counts in Capacity</Table.Th>
              <SortableHeader sortKey="podAssignment.podName" currentKey={sortKey} dir={sortDir} onSort={onSort}>Home POD</SortableHeader>
              <SortableHeader sortKey="podAssignment.capacityFte" currentKey={sortKey} dir={sortDir} onSort={onSort}>Capacity FTE</SortableHeader>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedResources.map((r, idx) => {
              const fte = r.podAssignment?.capacityFte ?? 1;
              const isPartTime = fte < 1;
              const overCount = overAllocMap.get(r.id);
              return (
                <Table.Tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
                  <Table.Td c="dimmed" style={{ fontSize: 12 }}>{idx + 1}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={500}>{r.name}</Text>
                      {overCount && (
                        <Tooltip label={`${overCount} month(s) exceed ${Math.round(fte * 100)}% FTE capacity`}>
                          <IconAlertTriangle size={16} color="orange" />
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>{formatRole(r.role)}</Table.Td>
                  <Table.Td>{r.location}</Table.Td>
                  <Table.Td>{r.active ? 'Yes' : 'No'}</Table.Td>
                  <Table.Td>{r.countsInCapacity ? 'Yes' : 'No'}</Table.Td>
                  <Table.Td>{r.podAssignment?.podName ?? '-'}</Table.Td>
                  <Table.Td>
                    {r.podAssignment ? (
                      <Badge
                        variant="light"
                        color={isPartTime ? 'orange' : 'green'}
                        size="sm"
                      >
                        {isPartTime ? `${Math.round(fte * 100)}%` : '100%'}
                      </Badge>
                    ) : '-'}
                  </Table.Td>
                  <Table.Td onClick={e => e.stopPropagation()}>
                    <ActionIcon color="red" variant="subtle" onClick={() => setDeleteConfirm(r.id)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Resource' : 'Add Resource'}>
        <Stack>
          <TextInput label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Select label="Role" data={roleOptions} value={form.role} onChange={v => setForm({ ...form, role: v as Role })} required />
          <Select label="Location" data={locationOptions} value={form.location} onChange={v => setForm({ ...form, location: v as Location })} required />
          <Switch label="Active" checked={form.active} onChange={e => setForm({ ...form, active: e.currentTarget.checked })} />
          <Switch label="Counts in Capacity" checked={form.countsInCapacity} onChange={e => setForm({ ...form, countsInCapacity: e.currentTarget.checked })} />
          <Select label="Home POD" data={podOptions} value={form.homePodId ? String(form.homePodId) : null} onChange={v => setForm({ ...form, homePodId: v ? Number(v) : null })} clearable />
          <NumberInput
            label="Capacity FTE"
            description={form.capacityFte < 1 ? `Part-time — ${Math.round(form.capacityFte * 100)}% allocation` : 'Full-time'}
            value={form.capacityFte}
            onChange={v => setForm({ ...form, capacityFte: Number(v) })}
            min={0}
            max={1}
            step={0.05}
            decimalScale={2}
          />
          <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
            {editId ? 'Update' : 'Create'}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Confirm Delete">
        <Stack>
          <Text>Are you sure you want to delete this resource?</Text>
          <Group>
            <Button variant="default" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button color="red" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} loading={deleteMutation.isPending}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
