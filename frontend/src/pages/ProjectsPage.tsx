import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Button, Group, Table, Modal, TextInput, Select, NumberInput, Textarea, Stack, Text, SegmentedControl, SimpleGrid,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconBriefcase, IconFlame, IconClock, IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import { useProjects, useCreateProject } from '../api/projects';
import { useEffortPatterns } from '../api/refData';
import CsvToolbar from '../components/common/CsvToolbar';
import { projectColumns } from '../utils/csvColumns';
import { Priority, ProjectStatus } from '../types';
import type { ProjectRequest } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import SummaryCard from '../components/charts/SummaryCard';
import SortableHeader from '../components/common/SortableHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTableSort } from '../hooks/useTableSort';
import { formatProjectDate } from '../utils/formatting';

const priorityOptions = Object.values(Priority).map(p => ({ value: p, label: p }));
const statusOptions = Object.values(ProjectStatus).map(s => ({ value: s, label: s.replace('_', ' ') }));

const emptyForm: ProjectRequest = {
  name: '',
  priority: Priority.P2,
  owner: '',
  startMonth: 1,
  durationMonths: 3,
  defaultPattern: 'Flat',
  status: ProjectStatus.ACTIVE,
  notes: null,
  startDate: null,
  targetDate: null,
  client: null,
};

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const createMutation = useCreateProject();
  const { data: effortPatterns } = useEffortPatterns();
  const navigate = useNavigate();
  const { monthLabels } = useMonthLabels();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProjectRequest>(emptyForm);
  const [statusFilter, setStatusFilter]   = useState<string>('ALL');
  const [cardFilter, setCardFilter]       = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [ownerFilter, setOwnerFilter]     = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  // Clicking a card toggles a quick-filter; also syncs the segmented control
  function applyCardFilter(key: string) {
    if (cardFilter === key) {
      // toggle off → clear everything
      setCardFilter(null);
      setStatusFilter('ALL');
    } else {
      setCardFilter(key);
      if (key === 'ACTIVE' || key === 'ON_HOLD') {
        setStatusFilter(key);
      } else {
        setStatusFilter('ALL'); // P0P1 is priority-based
      }
    }
  }

  // Also clear card-filter when segmented control is used manually
  function handleSegmentedChange(val: string) {
    setStatusFilter(val);
    setCardFilter(null);
  }

  const ownerOptions = useMemo(() => {
    const owners = [...new Set((projects ?? []).map(p => p.owner).filter(Boolean))].sort();
    return owners.map(o => ({ value: o, label: o }));
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects ?? [];
    if (cardFilter === 'P0P1') {
      list = list.filter(p => p.priority === Priority.P0 || p.priority === Priority.P1);
    } else if (statusFilter !== 'ALL') {
      list = list.filter(p => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
    if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);
    return list;
  }, [projects, cardFilter, statusFilter, search, ownerFilter, priorityFilter]);

  const { sorted: sortedProjects, sortKey, sortDir, onSort } = useTableSort(filtered);

  const stats = useMemo(() => {
    const all = projects ?? [];
    const active = all.filter(p => p.status === ProjectStatus.ACTIVE).length;
    const onHold = all.filter(p => p.status === ProjectStatus.ON_HOLD).length;
    const p0p1 = all.filter(p => p.priority === Priority.P0 || p.priority === Priority.P1).length;
    const avgDuration = all.length > 0 ? Math.round(all.reduce((s, p) => s + p.durationMonths, 0) / all.length * 10) / 10 : 0;
    return { total: all.length, active, onHold, p0p1, avgDuration };
  }, [projects]);

  const handleCreate = () => {
    createMutation.mutate(form, {
      onSuccess: () => {
        setModalOpen(false);
        setForm(emptyForm);
        notifications.show({ title: 'Created', message: 'Project created', color: 'green' });
      },
    });
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading projects</Text>;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Projects</Title>
        <Group gap="sm">
          <CsvToolbar
            data={projects ?? []}
            columns={projectColumns}
            filename="projects"
            onImport={(rows) => {
              rows.forEach(row => {
                createMutation.mutate({
                  name: row.name ?? '',
                  priority: row.priority ?? 'P2',
                  owner: row.owner ?? '',
                  startMonth: Number(row.startMonth) || 1,
                  durationMonths: Number(row.durationMonths) || 3,
                  defaultPattern: row.defaultPattern ?? 'Flat',
                  status: row.status ?? 'ACTIVE',
                  notes: row.notes || null,
                  startDate: row.startDate || null,
                  targetDate: row.targetDate || null,
                });
              });
            }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>Add Project</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
        <SummaryCard
          title="Total Projects"
          value={stats.total}
          icon={<IconBriefcase size={20} color="#339af0" />}
          onClick={() => { setCardFilter(null); setStatusFilter('ALL'); }}
          active={cardFilter === null && statusFilter === 'ALL'}
        />
        <SummaryCard
          title="Active"
          value={stats.active}
          icon={<IconFlame size={20} color="#40c057" />}
          onClick={() => applyCardFilter('ACTIVE')}
          active={cardFilter === 'ACTIVE'}
        />
        <SummaryCard
          title="On Hold"
          value={stats.onHold}
          icon={<IconAlertTriangle size={20} color="#fab005" />}
          color={stats.onHold > 0 ? 'yellow' : undefined}
          onClick={() => applyCardFilter('ON_HOLD')}
          active={cardFilter === 'ON_HOLD'}
        />
        <SummaryCard
          title="P0 / P1"
          value={stats.p0p1}
          icon={<IconFlame size={20} color="#fa5252" />}
          color={stats.p0p1 > 0 ? 'red' : undefined}
          onClick={() => applyCardFilter('P0P1')}
          active={cardFilter === 'P0P1'}
        />
        <SummaryCard
          title="Avg Duration"
          value={`${stats.avgDuration}m`}
          icon={<IconClock size={20} color="#845ef7" />}
        />
      </SimpleGrid>

      <SegmentedControl
        value={statusFilter}
        onChange={handleSegmentedChange}
        data={[
          { value: 'ALL', label: 'All' },
          ...statusOptions,
        ]}
      />

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          placeholder="Search by name…"
          leftSection={<IconSearch size={15} />}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          style={{ flex: '1 1 200px', maxWidth: 300 }}
          size="sm"
        />
        <Select
          placeholder="All Owners"
          data={ownerOptions}
          value={ownerFilter}
          onChange={setOwnerFilter}
          clearable
          searchable
          style={{ flex: '1 1 160px', maxWidth: 240 }}
          size="sm"
        />
        <Select
          placeholder="All Priorities"
          data={priorityOptions}
          value={priorityFilter}
          onChange={v => { setPriorityFilter(v); setCardFilter(null); }}
          clearable
          style={{ flex: '1 1 140px', maxWidth: 180 }}
          size="sm"
        />
        {(search || ownerFilter || priorityFilter) && (
          <Button variant="subtle" color="gray" size="sm"
            onClick={() => { setSearch(''); setOwnerFilter(null); setPriorityFilter(null); }}>
            Clear filters
          </Button>
        )}
        <Text size="sm" c="dimmed" ml="auto">
          {filtered.length} of {(projects ?? []).length} projects
        </Text>
      </Group>

      <Table.ScrollContainer minWidth={900}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              <SortableHeader sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader>
              <SortableHeader sortKey="priority" currentKey={sortKey} dir={sortDir} onSort={onSort}>Priority</SortableHeader>
              <SortableHeader sortKey="owner" currentKey={sortKey} dir={sortDir} onSort={onSort}>Owner</SortableHeader>
              <SortableHeader sortKey="startMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>Start</SortableHeader>
              <SortableHeader sortKey="targetEndMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>End</SortableHeader>
              <SortableHeader sortKey="durationMonths" currentKey={sortKey} dir={sortDir} onSort={onSort}>Duration</SortableHeader>
              <Table.Th>Pattern</Table.Th>
              <SortableHeader sortKey="status" currentKey={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedProjects.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="dimmed" size="sm">No projects match the current filters.</Text>
                </Table.Td>
              </Table.Tr>
            )}
            {sortedProjects.map((p, idx) => (
              <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                <Table.Td c="dimmed" style={{ fontSize: 12 }}>{idx + 1}</Table.Td>
                <Table.Td fw={500}>{p.name}</Table.Td>
                <Table.Td><PriorityBadge priority={p.priority} /></Table.Td>
                <Table.Td>{p.owner}</Table.Td>
                <Table.Td>{formatProjectDate(p.startDate, p.startMonth, monthLabels)}</Table.Td>
                <Table.Td>{formatProjectDate(p.targetDate, p.targetEndMonth, monthLabels)}</Table.Td>
                <Table.Td>{p.durationMonths}m</Table.Td>
                <Table.Td>{p.defaultPattern}</Table.Td>
                <Table.Td><StatusBadge status={p.status} /></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add Project" size="xl">
        <Stack>
          <TextInput label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Group grow>
            <Select label="Priority" data={priorityOptions} value={form.priority} onChange={v => setForm({ ...form, priority: v as Priority })} required />
            <Select label="Status" data={statusOptions} value={form.status} onChange={v => setForm({ ...form, status: v as ProjectStatus })} required />
          </Group>
          <TextInput label="Owner" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
          <TextInput label="Client" placeholder="Optional — external client name" value={form.client ?? ''} onChange={e => setForm({ ...form, client: e.target.value || null })} />
          <Group grow>
            <DateInput
              label="Start Date"
              value={form.startDate ? new Date(form.startDate + 'T00:00:00') : null}
              onChange={d => setForm({ ...form, startDate: d ? d.toISOString().slice(0, 10) : null })}
              clearable
              valueFormat="MMM DD, YYYY"
            />
            <DateInput
              label="Launch Date"
              value={form.targetDate ? new Date(form.targetDate + 'T00:00:00') : null}
              onChange={d => setForm({ ...form, targetDate: d ? d.toISOString().slice(0, 10) : null })}
              clearable
              valueFormat="MMM DD, YYYY"
            />
          </Group>
          <Select
            label="Default Pattern"
            data={(effortPatterns ?? []).map(p => ({ value: p.name, label: p.name }))}
            value={form.defaultPattern}
            onChange={v => setForm({ ...form, defaultPattern: v ?? 'Flat' })}
            clearable={false}
          />
          <Textarea label="Notes" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value || null })} />
          <Button onClick={handleCreate} loading={createMutation.isPending}>Create</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
