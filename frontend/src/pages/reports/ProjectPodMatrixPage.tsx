import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Stack, Text, Table, Badge, SimpleGrid, SegmentedControl,
  Group, TextInput, MultiSelect, Select, ScrollArea, Tabs, Popover,
  Button, Box, Paper,
} from '@mantine/core';
import {
  IconBriefcase, IconHexagons, IconLink, IconFlame, IconSearch,
  IconLayoutColumns, IconList,
} from '@tabler/icons-react';
import { useProjectPodMatrix } from '../../api/projects';
import { deriveTshirtSize } from '../../types/project';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { useTableSort } from '../../hooks/useTableSort';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import SortableHeader from '../../components/common/SortableHeader';
import SummaryCard from '../../components/charts/SummaryCard';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { useDarkMode } from '../../hooks/useDarkMode';

// ── Shared types ──────────────────────────────────────────────────────────────

interface MatrixRow {
  planningId: number;
  projectId: number;
  projectName: string;
  priority: string;
  owner: string;
  status: string;
  projectStartMonth: number;
  projectDurationMonths: number;
  defaultPattern: string;
  podId: number;
  podName: string;
  tshirtSize: string | null;
  totalHours: number;
  complexityOverride: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
}

const TSHIRT_BADGE_COLORS: Record<string, string> = {
  XS: 'gray', S: 'blue', M: 'cyan', L: 'orange', XL: 'red',
};

const STATUS_BG: Record<string, string> = {
  ACTIVE:       '#d3f9d8',
  ON_HOLD:      '#fff3bf',
  COMPLETED:    '#d0ebff',
  NOT_STARTED:  '#f1f3f5',
  IN_DISCOVERY: '#f3d9fa',
  CANCELLED:    '#ffe3e3',
};
const STATUS_TEXT: Record<string, string> = {
  ACTIVE:       '#2f9e44',
  ON_HOLD:      '#e67700',
  COMPLETED:    '#1971c2',
  NOT_STARTED:  '#868e96',
  IN_DISCOVERY: '#862e9c',
  CANCELLED:    '#c92a2a',
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectPodMatrixPage() {
  const isDark = useDarkMode();
  const { data, isLoading, error } = useProjectPodMatrix();
  const { monthLabels } = useMonthLabels();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string | null>(
    () => localStorage.getItem('pp_pod_matrix_tab') ?? 'list'
  );

  function handleTabChange(tab: string | null) {
    setActiveTab(tab);
    if (tab) localStorage.setItem('pp_pod_matrix_tab', tab);
  }

  // Shared summary stats
  const stats = useMemo(() => {
    const all = data ?? [];
    const uniqueProjects = new Set(all.map(d => d.projectId)).size;
    const uniquePods     = new Set(all.map(d => d.podId)).size;
    const activeAssignments = all.filter(d => d.status === 'ACTIVE').length;
    return { totalAssignments: all.length, uniqueProjects, uniquePods, activeAssignments };
  }, [data]);

  if (isLoading) return <LoadingSpinner variant="table" message="Loading POD-project matrix..." />;
  if (error)     return <PageError context="loading POD-project matrix" error={error} />;

  return (
    <Stack className="page-enter stagger-children">
      <Group className="slide-in-left">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            POD · Project Matrix
          </Title>
          <Text size="sm" c="dimmed">All POD-to-project assignments — coverage grid and assignment list</Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} className="stagger-grid">
        <SummaryCard title="Total Assignments"  value={stats.totalAssignments}   icon={<IconLink      size={20} color="#339af0" />} />
        <SummaryCard title="Projects"           value={stats.uniqueProjects}     icon={<IconBriefcase size={20} color="#845ef7" />} />
        <SummaryCard title="PODs Involved"      value={stats.uniquePods}         icon={<IconHexagons  size={20} color="#40c057" />} />
        <SummaryCard title="Active Assignments" value={stats.activeAssignments}  icon={<IconFlame     size={20} color="#fd7e14" />} />
      </SimpleGrid>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        styles={{
          list: {
            padding: '3px 5px',
            gap: 2,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
            borderRadius: 10,
            border: `1px solid ${isDark ? 'rgba(45,204,211,0.12)' : 'rgba(12,35,64,0.08)'}`,
            marginBottom: 16,
            '&::before': { display: 'none' },
          },
          tab: {
            fontFamily: FONT_FAMILY,
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 7,
            padding: '7px 14px',
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(12,35,64,0.55)',
            border: 'none',
            transition: 'all 160ms ease',
            '&[data-active]': {
              background: isDark ? 'rgba(45,204,211,0.14)' : '#ffffff',
              color: isDark ? AQUA : DEEP_BLUE,
              boxShadow: isDark
                ? `0 0 0 1px ${AQUA}30, 0 2px 8px rgba(0,0,0,0.3)`
                : '0 1px 6px rgba(12,35,64,0.12), 0 0 0 1px rgba(12,35,64,0.06)',
              borderBottom: `2.5px solid ${AQUA}`,
            },
            '&:hover:not([data-active])': {
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,35,64,0.05)',
              color: isDark ? 'rgba(255,255,255,0.8)' : DEEP_BLUE,
            },
          },
          panel: { paddingTop: 4 },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="grid" leftSection={<IconLayoutColumns size={15} color={activeTab === 'grid' ? AQUA : undefined} />}>
            Coverage Grid
          </Tabs.Tab>
          <Tabs.Tab value="list" leftSection={<IconList size={15} color={activeTab === 'list' ? '#845ef7' : undefined} />}>
            Assignment List
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="grid">
          <CoverageGridTab data={data ?? []} isDark={isDark} onNavigate={id => navigate(`/projects/${id}`)} />
        </Tabs.Panel>

        <Tabs.Panel value="list">
          <AssignmentListTab data={data ?? []} monthLabels={monthLabels} isDark={isDark} onNavigateProject={id => navigate(`/projects/${id}`)} onNavigatePod={id => navigate(`/pods/${id}`)} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ── Tab 1: Coverage Grid ──────────────────────────────────────────────────────

function CoverageGridTab({
  data, isDark, onNavigate,
}: {
  data: MatrixRow[];
  isDark: boolean;
  onNavigate: (projectId: number) => void;
}) {
  const [selectedPods,  setSelectedPods]  = useState<string[]>([]);
  const [statusFilter,  setStatusFilter]  = useState('ALL');
  const [expandedCell,  setExpandedCell]  = useState<string | null>(null);

  const { pods, projects } = useMemo(() => {
    const podMap  = new Map<number, string>();
    const projMap = new Map<number, MatrixRow>();
    data.forEach(item => {
      podMap.set(item.podId, item.podName);
      if (!projMap.has(item.projectId)) projMap.set(item.projectId, item);
    });
    return {
      pods: Array.from(podMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ id, name })),
      projects: Array.from(projMap.values())
        .sort((a, b) => a.projectStartMonth - b.projectStartMonth)
        .map(p => ({ id: p.projectId, name: p.projectName, priority: p.priority, status: p.status })),
    };
  }, [data]);

  const filteredData = useMemo(() =>
    data.filter(item =>
      (selectedPods.length === 0 || selectedPods.includes(item.podName)) &&
      (statusFilter === 'ALL' || item.status === statusFilter)
    ), [data, selectedPods, statusFilter]);

  const matrix = useMemo(() => {
    const map = new Map<string, MatrixRow>();
    filteredData.forEach(item => map.set(`${item.podId}:${item.projectId}`, item));
    return map;
  }, [filteredData]);

  const podOptions = pods.map(p => ({ value: p.name, label: p.name }));

  const formatRange = (start: number | null, dur: number | null) =>
    start != null && dur != null ? `M${start}→M${start + dur - 1}` : '';

  const truncate = (s: string, n = 11) => s.length > n ? s.slice(0, n) + '…' : s;

  // visible projects based on filter
  const visibleProjects = statusFilter === 'ALL'
    ? projects
    : projects.filter(p => p.status === statusFilter);

  return (
    <Stack gap="sm">
      <Group gap="md" align="flex-end">
        <MultiSelect
          label="Filter PODs"
          placeholder="All PODs"
          data={podOptions}
          value={selectedPods}
          onChange={setSelectedPods}
          style={{ flex: 1, maxWidth: 280 }}
          size="xs"
          clearable
          searchable
        />
        <SegmentedControl
          size="xs"
          data={[
            { value: 'ALL',          label: 'All' },
            { value: 'ACTIVE',       label: 'Active' },
            { value: 'NOT_STARTED',  label: 'Not Started' },
            { value: 'IN_DISCOVERY', label: 'In Discovery' },
            { value: 'ON_HOLD',      label: 'On Hold' },
            { value: 'COMPLETED',    label: 'Completed' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </Group>

      {/* Legend */}
      <Paper p="xs" radius="md" withBorder>
        <Group gap="lg">
          {Object.entries(TSHIRT_BADGE_COLORS).map(([size, color]) => (
            <Group key={size} gap={4}>
              <Badge color={color} size="xs">{size}</Badge>
              <Text size="xs" c="dimmed">{size === 'XS' ? 'Extra Small' : size === 'S' ? 'Small' : size === 'M' ? 'Medium' : size === 'L' ? 'Large' : 'Extra Large'}</Text>
            </Group>
          ))}
          <Text size="xs" c="dimmed">— = POD not assigned</Text>
        </Group>
      </Paper>

      <ScrollArea>
        <table style={{ borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{
                background: DEEP_BLUE, color: '#fff', padding: '10px 14px',
                textAlign: 'left', fontWeight: 600, minWidth: 130,
                position: 'sticky', left: 0, zIndex: 2,
              }}>
                POD ╲ Project
              </th>
              {visibleProjects.map(p => (
                <th key={p.id} style={{
                  background: DEEP_BLUE, color: '#fff', padding: '10px 10px',
                  textAlign: 'center', fontWeight: 600, minWidth: 96,
                }}>
                  <Box style={{ fontSize: 11 }}>{truncate(p.name)}</Box>
                  <Box style={{ fontSize: 10, opacity: 0.65, fontWeight: 400 }}>{p.priority}</Box>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(selectedPods.length > 0 ? pods.filter(p => selectedPods.includes(p.name)) : pods).map(pod => (
              <tr key={pod.id}>
                <td style={{
                  background: DEEP_BLUE, color: '#fff', padding: '10px 14px',
                  fontWeight: 600, position: 'sticky', left: 0, zIndex: 1, fontSize: 12,
                }}>
                  {pod.name}
                </td>
                {visibleProjects.map(proj => {
                  const key  = `${pod.id}:${proj.id}`;
                  const item = matrix.get(key);

                  if (!item) {
                    return (
                      <td key={key} style={{
                        background: isDark ? '#25262b' : '#f8f9fa',
                        padding: '10px',
                        textAlign: 'center',
                        color: isDark ? 'rgba(255,255,255,0.2)' : '#ccc',
                        borderBottom: `1px solid ${isDark ? '#2c2e33' : '#e9ecef'}`,
                        fontSize: 18,
                      }}>
                        —
                      </td>
                    );
                  }

                  const bg   = STATUS_BG[item.status]   ?? '#f8f9fa';
                  const tc   = STATUS_TEXT[item.status] ?? '#868e96';
                  const size = item.tshirtSize ?? deriveTshirtSize(item.totalHours);
                  const range = formatRange(item.podStartMonth, item.durationOverride ?? item.projectDurationMonths);

                  return (
                    <Popover
                      key={key}
                      position="bottom"
                      withArrow
                      shadow="md"
                      opened={expandedCell === key}
                      onChange={o => setExpandedCell(o ? key : null)}
                    >
                      <Popover.Target>
                        <td
                          onClick={() => onNavigate(item.projectId)}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                          style={{
                            background: isDark ? `${bg}22` : bg,
                            padding: '8px 10px',
                            textAlign: 'center',
                            borderBottom: `1px solid ${isDark ? '#2c2e33' : '#e9ecef'}`,
                            cursor: 'pointer',
                            transition: 'opacity 150ms',
                          }}
                        >
                          <Stack gap={2} align="center">
                            <Badge color={TSHIRT_BADGE_COLORS[size] ?? 'gray'} size="sm">{size}</Badge>
                            {range && <Text size="xs" fw={500} c={isDark ? `${tc}cc` : tc}>{range}</Text>}
                          </Stack>
                        </td>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Stack gap="xs" style={{ minWidth: 200 }}>
                          <div>
                            <Text fw={700} size="sm">{item.projectName}</Text>
                            <Text size="xs" c="dimmed">{item.podName}</Text>
                          </div>
                          <Group gap="md">
                            <div><Text size="xs" fw={500} c="dimmed">Priority</Text><Badge size="xs">{item.priority}</Badge></div>
                            <div><Text size="xs" fw={500} c="dimmed">Status</Text><Badge size="xs" color={STATUS_TEXT[item.status] ? undefined : 'gray'}>{item.status.replace('_', ' ')}</Badge></div>
                            <div><Text size="xs" fw={500} c="dimmed">Size</Text><Badge size="xs" color={TSHIRT_BADGE_COLORS[size] ?? 'gray'}>{size}</Badge></div>
                          </Group>
                          <div><Text size="xs" fw={500} c="dimmed">Owner</Text><Text size="xs">{item.owner}</Text></div>
                          {range && <div><Text size="xs" fw={500} c="dimmed">Timeline</Text><Text size="xs">{range}</Text></div>}
                          <Button variant="light" size="xs" fullWidth onClick={() => onNavigate(item.projectId)}>
                            Open Project
                          </Button>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </Stack>
  );
}

// ── Tab 2: Assignment List ────────────────────────────────────────────────────

function AssignmentListTab({
  data, monthLabels, isDark, onNavigateProject, onNavigatePod,
}: {
  data: MatrixRow[];
  monthLabels: Record<number, string>;
  isDark: boolean;
  onNavigateProject: (id: number) => void;
  onNavigatePod:     (id: number) => void;
}) {
  void isDark; // used implicitly via mantine dark mode

  const [statusFilter,   setStatusFilter]   = useState('ALL');
  const [search,         setSearch]         = useState('');
  const [podFilter,      setPodFilter]      = useState<string[]>([]);
  const [ownerFilter,    setOwnerFilter]    = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sizeFilter,     setSizeFilter]     = useState<string | null>(null);

  const filterOptions = useMemo(() => ({
    pods:       [...new Set(data.map(d => d.podName))].sort(),
    owners:     [...new Set(data.map(d => d.owner))].sort(),
    priorities: [...new Set(data.map(d => d.priority))].sort(),
  }), [data]);

  const filtered = useMemo(() => {
    let r = data;
    if (statusFilter !== 'ALL') r = r.filter(d => d.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(d =>
        d.projectName.toLowerCase().includes(q) ||
        d.podName.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q)
      );
    }
    if (podFilter.length)      r = r.filter(d => podFilter.includes(d.podName));
    if (ownerFilter.length)    r = r.filter(d => ownerFilter.includes(d.owner));
    if (priorityFilter.length) r = r.filter(d => priorityFilter.includes(d.priority));
    if (sizeFilter)            r = r.filter(d => (d.tshirtSize ?? deriveTshirtSize(d.totalHours)) === sizeFilter);
    return r;
  }, [data, statusFilter, search, podFilter, ownerFilter, priorityFilter, sizeFilter]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered);
  const hasActiveFilters = search.trim() || podFilter.length || ownerFilter.length || priorityFilter.length || sizeFilter;

  return (
    <Stack gap="sm">
      <SegmentedControl
        size="xs"
        value={statusFilter}
        onChange={setStatusFilter}
        data={[
          { value: 'ALL',          label: 'All' },
          { value: 'ACTIVE',       label: 'Active' },
          { value: 'ON_HOLD',      label: 'On Hold' },
          { value: 'NOT_STARTED',  label: 'Not Started' },
          { value: 'IN_DISCOVERY', label: 'In Discovery' },
          { value: 'COMPLETED',    label: 'Completed' },
          { value: 'CANCELLED',    label: 'Cancelled' },
        ]}
      />

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
          searchable clearable size="xs"
          style={{ minWidth: 180 }}
        />
        <MultiSelect
          placeholder="Filter by Owner"
          data={filterOptions.owners}
          value={ownerFilter}
          onChange={setOwnerFilter}
          searchable clearable size="xs"
          style={{ minWidth: 180 }}
        />
        <MultiSelect
          placeholder="Filter by Priority"
          data={filterOptions.priorities}
          value={priorityFilter}
          onChange={setPriorityFilter}
          clearable size="xs"
          style={{ minWidth: 160 }}
        />
        <Select
          placeholder="Filter by Size"
          data={['XS', 'S', 'M', 'L', 'XL']}
          value={sizeFilter}
          onChange={setSizeFilter}
          clearable size="xs"
          style={{ minWidth: 120 }}
        />
      </Group>

      {hasActiveFilters && (
        <Text size="xs" c="dimmed">Showing {sorted.length} of {data.length} assignments</Text>
      )}

      <ScrollArea>
        <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              <SortableHeader sortKey="projectName"  currentKey={sortKey} dir={sortDir} onSort={onSort}>Project</SortableHeader>
              <SortableHeader sortKey="podName"      currentKey={sortKey} dir={sortDir} onSort={onSort}>POD</SortableHeader>
              <SortableHeader sortKey="priority"     currentKey={sortKey} dir={sortDir} onSort={onSort}>Priority</SortableHeader>
              <SortableHeader sortKey="owner"        currentKey={sortKey} dir={sortDir} onSort={onSort}>Owner</SortableHeader>
              <SortableHeader sortKey="tshirtSize"   currentKey={sortKey} dir={sortDir} onSort={onSort}>Size</SortableHeader>
              <Table.Th>Pattern</Table.Th>
              <SortableHeader sortKey="podStartMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>POD Start</SortableHeader>
              <Table.Th>Duration</Table.Th>
              <SortableHeader sortKey="status" currentKey={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((row, idx) => (
              <Table.Tr
                key={row.planningId}
                style={{ cursor: 'pointer' }}
                onClick={() => onNavigateProject(row.projectId)}
              >
                <Table.Td c="dimmed" style={{ fontSize: 12 }}>{idx + 1}</Table.Td>
                <Table.Td fw={500}>{row.projectName}</Table.Td>
                <Table.Td>
                  <Text
                    c="blue" fw={500} size="sm" style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); onNavigatePod(row.podId); }}
                  >
                    {row.podName}
                  </Text>
                </Table.Td>
                <Table.Td><PriorityBadge priority={row.priority} /></Table.Td>
                <Table.Td>{row.owner}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={TSHIRT_BADGE_COLORS[row.tshirtSize ?? deriveTshirtSize(row.totalHours)] ?? 'gray'}>
                    {row.tshirtSize ?? deriveTshirtSize(row.totalHours)}
                  </Badge>
                </Table.Td>
                <Table.Td>{row.effortPattern ?? row.defaultPattern}</Table.Td>
                <Table.Td>
                  {monthLabels[row.podStartMonth ?? row.projectStartMonth] ?? `M${row.podStartMonth ?? row.projectStartMonth}`}
                </Table.Td>
                <Table.Td>{row.durationOverride ?? row.projectDurationMonths}m</Table.Td>
                <Table.Td><StatusBadge status={row.status} /></Table.Td>
              </Table.Tr>
            ))}
            {sorted.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={10}>
                  <Text ta="center" c="dimmed" py="md">No assignments match the selected filters</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
