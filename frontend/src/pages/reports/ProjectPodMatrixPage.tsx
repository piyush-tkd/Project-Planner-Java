import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Stack, Text, Table, Badge, SimpleGrid, SegmentedControl,
  Group, TextInput, MultiSelect, Select,
} from '@mantine/core';
import { IconBriefcase, IconHexagons, IconLink, IconFlame, IconSearch } from '@tabler/icons-react';
import { useProjectPodMatrix } from '../../api/projects';
import { deriveTshirtSize } from '../../types/project';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { useTableSort } from '../../hooks/useTableSort';
import SortableHeader from '../../components/common/SortableHeader';
import SummaryCard from '../../components/charts/SummaryCard';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ProjectPodMatrixPage() {
  const { data, isLoading, error } = useProjectPodMatrix();
  const { monthLabels } = useMonthLabels();
  const navigate = useNavigate();

  // ── Filter state ──
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [podFilter, setPodFilter] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string | null>(null);

  // ── Derive unique values for filter dropdowns ──
  const filterOptions = useMemo(() => {
    const all = data ?? [];
    const pods = [...new Set(all.map(d => d.podName))].sort();
    const owners = [...new Set(all.map(d => d.owner))].sort();
    const priorities = [...new Set(all.map(d => d.priority))].sort();
    return { pods, owners, priorities };
  }, [data]);

  // ── Apply all filters ──
  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data;

    if (statusFilter !== 'ALL') {
      result = result.filter(d => d.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(d =>
        d.projectName.toLowerCase().includes(q) ||
        d.podName.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q)
      );
    }
    if (podFilter.length > 0) {
      result = result.filter(d => podFilter.includes(d.podName));
    }
    if (ownerFilter.length > 0) {
      result = result.filter(d => ownerFilter.includes(d.owner));
    }
    if (priorityFilter.length > 0) {
      result = result.filter(d => priorityFilter.includes(d.priority));
    }
    if (sizeFilter) {
      result = result.filter(d => (d.tshirtSize ?? deriveTshirtSize(d.totalHours)) === sizeFilter);
    }
    return result;
  }, [data, statusFilter, search, podFilter, ownerFilter, priorityFilter, sizeFilter]);

  const stats = useMemo(() => {
    const all = data ?? [];
    const uniqueProjects = new Set(all.map(d => d.projectId)).size;
    const uniquePods = new Set(all.map(d => d.podId)).size;
    const activeAssignments = all.filter(d => d.status === 'ACTIVE').length;
    return { totalAssignments: all.length, uniqueProjects, uniquePods, activeAssignments };
  }, [data]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered);

  if (isLoading) return <LoadingSpinner variant="table" message="Loading project-POD matrix..." />;
  if (error) return <Text c="red">Error loading project-POD matrix</Text>;

  const hasActiveFilters = search.trim() || podFilter.length > 0 || ownerFilter.length > 0 || priorityFilter.length > 0 || sizeFilter;

  return (
    <Stack>
      <Title order={2}>Project-POD Matrix</Title>
      <Text size="sm" c="dimmed">All project-to-POD assignments in one view</Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <SummaryCard title="Total Assignments" value={stats.totalAssignments} icon={<IconLink size={20} color="#339af0" />} />
        <SummaryCard title="Projects" value={stats.uniqueProjects} icon={<IconBriefcase size={20} color="#845ef7" />} />
        <SummaryCard title="PODs Involved" value={stats.uniquePods} icon={<IconHexagons size={20} color="#40c057" />} />
        <SummaryCard title="Active Assignments" value={stats.activeAssignments} icon={<IconFlame size={20} color="#fd7e14" />} />
      </SimpleGrid>

      <SegmentedControl
        value={statusFilter}
        onChange={setStatusFilter}
        data={[
          { value: 'ALL', label: 'All' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'ON_HOLD', label: 'On Hold' },
          { value: 'NOT_STARTED', label: 'Not Started' },
          { value: 'IN_DISCOVERY', label: 'In Discovery' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ]}
      />

      {/* ── Filters row ── */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search project, POD, or owner…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          size="xs"
          style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
        />
        <MultiSelect
          placeholder="Filter by POD"
          data={filterOptions.pods}
          value={podFilter}
          onChange={setPodFilter}
          searchable
          clearable
          size="xs"
          style={{ minWidth: 180 }}
        />
        <MultiSelect
          placeholder="Filter by Owner"
          data={filterOptions.owners}
          value={ownerFilter}
          onChange={setOwnerFilter}
          searchable
          clearable
          size="xs"
          style={{ minWidth: 180 }}
        />
        <MultiSelect
          placeholder="Filter by Priority"
          data={filterOptions.priorities}
          value={priorityFilter}
          onChange={setPriorityFilter}
          clearable
          size="xs"
          style={{ minWidth: 160 }}
        />
        <Select
          placeholder="Filter by Size"
          data={['XS', 'S', 'M', 'L', 'XL']}
          value={sizeFilter}
          onChange={setSizeFilter}
          clearable
          size="xs"
          style={{ minWidth: 120 }}
        />
      </Group>

      {hasActiveFilters && (
        <Text size="xs" c="dimmed">
          Showing {sorted.length} of {(data ?? []).length} assignments
        </Text>
      )}

      <Table.ScrollContainer minWidth={1100}>
        <Table withTableBorder withColumnBorders striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              <SortableHeader sortKey="projectName" currentKey={sortKey} dir={sortDir} onSort={onSort}>Project</SortableHeader>
              <SortableHeader sortKey="podName" currentKey={sortKey} dir={sortDir} onSort={onSort}>POD</SortableHeader>
              <SortableHeader sortKey="priority" currentKey={sortKey} dir={sortDir} onSort={onSort}>Priority</SortableHeader>
              <SortableHeader sortKey="owner" currentKey={sortKey} dir={sortDir} onSort={onSort}>Owner</SortableHeader>
              <SortableHeader sortKey="tshirtSize" currentKey={sortKey} dir={sortDir} onSort={onSort}>Size</SortableHeader>
              <Table.Th>Pattern</Table.Th>
              <SortableHeader sortKey="podStartMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>POD Start</SortableHeader>
              <Table.Th>Duration</Table.Th>
              <SortableHeader sortKey="status" currentKey={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((row, idx) => (
              <Table.Tr key={row.planningId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${row.projectId}`)}>
                <Table.Td c="dimmed" style={{ fontSize: 12 }}>{idx + 1}</Table.Td>
                <Table.Td fw={500}>{row.projectName}</Table.Td>
                <Table.Td>
                  <Text
                    c="blue" fw={500} size="sm" style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); navigate(`/pods/${row.podId}`); }}
                  >
                    {row.podName}
                  </Text>
                </Table.Td>
                <Table.Td><PriorityBadge priority={row.priority} /></Table.Td>
                <Table.Td>{row.owner}</Table.Td>
                <Table.Td><Badge variant="light">{row.tshirtSize ?? deriveTshirtSize(row.totalHours)}</Badge></Table.Td>
                <Table.Td>{row.effortPattern ?? row.defaultPattern}</Table.Td>
                <Table.Td>{monthLabels[row.podStartMonth ?? row.projectStartMonth] ?? `M${row.podStartMonth ?? row.projectStartMonth}`}</Table.Td>
                <Table.Td>{row.durationOverride ?? row.projectDurationMonths}m</Table.Td>
                <Table.Td><StatusBadge status={row.status} /></Table.Td>
              </Table.Tr>
            ))}
            {sorted.length === 0 && (
              <Table.Tr><Table.Td colSpan={10}><Text ta="center" c="dimmed" py="md">No assignments found</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
