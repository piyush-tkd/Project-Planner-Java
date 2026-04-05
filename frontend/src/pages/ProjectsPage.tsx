import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Title, Button, Group, Table, Modal, TextInput, Select, NumberInput, Textarea, Stack, Text, SegmentedControl, SimpleGrid, ActionIcon, Tooltip,
ScrollArea, ThemeIcon, Badge, Checkbox, Alert, Loader, Divider, Tabs, Box, Popover, Switch,
} from '@mantine/core';
import { AQUA, AQUA_TINTS, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconBriefcase, IconFlame, IconClock, IconAlertTriangle, IconSearch, IconCopy, IconPlugConnected, IconDownload, IconCheck, IconX, IconLayoutList, IconLayoutKanban, IconChevronRight, IconChevronDown, IconColumns, IconHexagons } from '@tabler/icons-react';
import { useProjects, useCreateProject, useCopyProject, useProjectPodMatrix, useUpdateProject, usePatchProjectStatus } from '../api/projects';
import type { ProjectPodMatrixResponse, ProjectResponse } from '../types';
import { useEffortPatterns } from '../api/refData';
import { useJiraAllProjectsSimple } from '../api/jira';
import CsvToolbar from '../components/common/CsvToolbar';
import { projectColumns } from '../utils/csvColumns';
import KanbanBoardView from '../components/projects/KanbanBoardView';
import { Priority, ProjectStatus } from '../types';
import type { ProjectRequest } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import SummaryCard from '../components/charts/SummaryCard';
import SortableHeader from '../components/common/SortableHeader';
import { useDarkMode } from '../hooks/useDarkMode';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageError from '../components/common/PageError';
import TablePagination from '../components/common/TablePagination';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTableSort } from '../hooks/useTableSort';
import { usePagination } from '../hooks/usePagination';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.substring(0, 2)?.toUpperCase() ?? '?';
}

export default function ProjectsPage() {
  const isDark = useDarkMode();
  const { data: projects, isLoading, error } = useProjects();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const patchStatusMutation = usePatchProjectStatus();
  const copyMutation = useCopyProject();

  // ── Inline table editing ──────────────────────────────────────────────
  type EditableField = 'name' | 'owner' | 'priority' | 'status';
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  // Inline add-row state
  const [addRowActive, setAddRowActive] = useState(false);
  const [addRowForm, setAddRowForm] = useState<{ name: string; priority: string; owner: string; status: string }>({
    name: '', priority: 'P2', owner: '', status: 'ACTIVE',
  });
  const { data: effortPatterns } = useEffortPatterns();
  const { data: jiraProjects = [], isLoading: jiraProjectsLoading } = useJiraAllProjectsSimple();
  const navigate = useNavigate();
  const { monthLabels } = useMonthLabels();
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [modalOpen, setModalOpen] = useState(false);
  const [jiraImportOpen, setJiraImportOpen] = useState(false);
  const [selectedJiraKeys, setSelectedJiraKeys] = useState<Set<string>>(new Set());
  const [importingCount, setImportingCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [form, setForm] = useState<ProjectRequest>(emptyForm);
  const [nameError, setNameError] = useState<string>('');

  // ── Column visibility ─────────────────────────────────────────────────
  const ALL_COLS = ['#', 'Priority', 'Owner', 'Start', 'End', 'Duration', 'Pattern', 'Status', 'Created'] as const;
  type ColKey = typeof ALL_COLS[number];
  const DEFAULT_VISIBLE: Set<ColKey> = new Set(['#', 'Priority', 'Owner', 'Start', 'End', 'Status']);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_VISIBLE);
  const toggleCol = (col: ColKey) => setVisibleCols(prev => {
    const next = new Set(prev);
    if (next.has(col)) next.delete(col); else next.add(col);
    return next;
  });

  // ── Accordion: expanded project rows ─────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const { data: podMatrix = [] } = useProjectPodMatrix();
  const podsByProject = useMemo(() => {
    const map = new Map<number, ProjectPodMatrixResponse[]>();
    podMatrix.forEach(entry => {
      if (!map.has(entry.projectId)) map.set(entry.projectId, []);
      map.get(entry.projectId)!.push(entry);
    });
    return map;
  }, [podMatrix]);

  // Existing project names for duplicate checking (case-insensitive)
  const existingNames = useMemo(() => {
    return new Set((projects ?? []).map(p => p.name.toLowerCase()));
  }, [projects]);

  // Real-time duplicate name check
  const checkDuplicateName = useCallback((name: string) => {
    if (!name.trim()) return '';
    if (existingNames.has(name.trim().toLowerCase())) {
      return 'A project with this name already exists';
    }
    return '';
  }, [existingNames]);

  // Jira projects not already in portfolio (by name match)
  const importableJiraProjects = useMemo(() => {
    return jiraProjects.filter(jp => !existingNames.has(jp.name.toLowerCase()));
  }, [jiraProjects, existingNames]);

  const alreadyImportedJiraProjects = useMemo(() => {
    return jiraProjects.filter(jp => existingNames.has(jp.name.toLowerCase()));
  }, [jiraProjects, existingNames]);

  const toggleJiraKey = (key: string) => {
    setSelectedJiraKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllImportable = () => {
    if (selectedJiraKeys.size === importableJiraProjects.length) {
      setSelectedJiraKeys(new Set());
    } else {
      setSelectedJiraKeys(new Set(importableJiraProjects.map(p => p.key)));
    }
  };

  const handleJiraImport = async () => {
    const toImport = importableJiraProjects.filter(p => selectedJiraKeys.has(p.key));
    if (toImport.length === 0) return;
    setImportingCount(toImport.length);
    setImportedCount(0);
    setImportErrors([]);

    let successCount = 0;
    const errors: string[] = [];

    for (const jp of toImport) {
      try {
        await createMutation.mutateAsync({
          name: jp.name,
          priority: Priority.P2,
          owner: '',
          startMonth: 1,
          durationMonths: 3,
          defaultPattern: 'Flat',
          status: ProjectStatus.NOT_STARTED,
          notes: `Imported from Jira project: ${jp.key}`,
          startDate: null,
          targetDate: null,
          client: null,
        });
        successCount++;
        setImportedCount(prev => prev + 1);
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Unknown error';
        errors.push(`${jp.key} (${jp.name}): ${msg}`);
      }
    }

    setImportErrors(errors);

    if (successCount > 0) {
      notifications.show({
        title: 'Import Complete',
        message: `${successCount} project${successCount !== 1 ? 's' : ''} imported from Jira${errors.length > 0 ? ` (${errors.length} failed)` : ''}.`,
        color: errors.length > 0 ? 'orange' : 'green',
      });
    }

    if (errors.length === 0) {
      setJiraImportOpen(false);
      setSelectedJiraKeys(new Set());
      setImportingCount(0);
    }
  };
  // URL search params — used for both NLP navigation filters and highlight
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open Add Project modal when navigated here with ?new=true (e.g. from sidebar + button)
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setModalOpen(true);
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('new'); return next; }, { replace: true });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Read initial filter values from URL query params (e.g., /projects?priority=P0&status=ACTIVE)
  const urlPriority = searchParams.get('priority');
  const urlStatus = searchParams.get('status');
  const urlOwner = searchParams.get('owner');

  const [statusFilter, setStatusFilter]   = useState<string>(urlStatus ?? 'ALL');
  const [cardFilter, setCardFilter]       = useState<string | null>(
    urlPriority === 'P0' || urlPriority === 'P1' ? 'P0P1' : urlStatus && urlStatus !== 'ALL' ? urlStatus : null
  );
  const [search, setSearch]               = useState('');
  const [ownerFilter, setOwnerFilter]     = useState<string | null>(urlOwner ?? null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(urlPriority ?? null);

  // Clean up filter params from URL after applying them (keep URL tidy)
  useEffect(() => {
    if (urlPriority || urlStatus || urlOwner) {
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('priority');
      cleaned.delete('status');
      cleaned.delete('owner');
      setSearchParams(cleaned, { replace: true });
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight support from NLP drill-down (?highlight=id)
  const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null;
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  useEffect(() => {
    if (highlightId && projects && projects.some(p => p.id === highlightId)) {
      setFlashId(highlightId);
      setTimeout(() => {
        highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      const timer = setTimeout(() => setFlashId(null), 3000);
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(timer);
    }
  }, [highlightId, projects]);

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

  // Board view ignores the status segment filter — columns already group by status.
  // Only apply search + owner + priority filters so all status columns show correctly.
  const boardProjects = useMemo(() => {
    let list = projects ?? [];
    if (cardFilter === 'P0P1') {
      list = list.filter(p => p.priority === Priority.P0 || p.priority === Priority.P1);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
    if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);
    return list;
  }, [projects, cardFilter, search, ownerFilter, priorityFilter]);

  const { sorted: sortedProjects, sortKey, sortDir, onSort } = useTableSort(filtered, 'createdAt', 'desc');
  const { paginatedData: pagedProjects, ...pagination } = usePagination(sortedProjects, 25);

  const stats = useMemo(() => {
    const all = projects ?? [];
    const active = all.filter(p => p.status === ProjectStatus.ACTIVE).length;
    const onHold = all.filter(p => p.status === ProjectStatus.ON_HOLD).length;
    const p0p1 = all.filter(p => p.priority === Priority.P0 || p.priority === Priority.P1).length;
    const avgDuration = all.length > 0 ? Math.round(all.reduce((s, p) => s + p.durationMonths, 0) / all.length * 10) / 10 : 0;
    return { total: all.length, active, onHold, p0p1, avgDuration };
  }, [projects]);

  // ── Board drag-and-drop status change ────────────────────────────────
  const handleBoardStatusChange = useCallback((projectId: number, newStatus: string) => {
    patchStatusMutation.mutate({ id: projectId, status: newStatus }, {
      onError: () => notifications.show({ color: 'red', title: 'Error', message: 'Failed to update project status' }),
    });
  }, [patchStatusMutation]);

  // ── Inline cell editing helpers ───────────────────────────────────────
  const startEdit = (id: number, field: EditableField, currentValue: string) => {
    setEditingCell({ id, field });
    setEditDraft(currentValue ?? '');
  };

  const commitEdit = (project: ProjectResponse) => {
    if (!editingCell || editingCell.id !== project.id) return;
    const updated = { ...project, [editingCell.field]: editDraft };
    updateMutation.mutate(
      { id: project.id, data: { name: updated.name, priority: updated.priority, owner: updated.owner ?? '', startMonth: updated.startMonth ?? 1, durationMonths: updated.durationMonths ?? 1, defaultPattern: updated.defaultPattern ?? 'Flat', status: updated.status, notes: updated.notes ?? null, startDate: updated.startDate ?? null, targetDate: updated.targetDate ?? null, client: updated.client ?? null } },
      {
        onError: () => notifications.show({ color: 'red', title: 'Error', message: 'Failed to save change' }),
      }
    );
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  // ── Inline add-row submit ─────────────────────────────────────────────
  const submitAddRow = () => {
    if (!addRowForm.name.trim()) { setAddRowActive(false); return; }
    createMutation.mutate(
      { name: addRowForm.name.trim(), priority: addRowForm.priority, owner: addRowForm.owner, startMonth: 1, durationMonths: 3, defaultPattern: 'Flat', status: addRowForm.status, notes: null, startDate: null, targetDate: null, client: null },
      {
        onSuccess: () => {
          setAddRowActive(false);
          setAddRowForm({ name: '', priority: 'P2', owner: '', status: 'ACTIVE' });
          notifications.show({ title: 'Created', message: 'Project created', color: 'green' });
        },
        onError: (err: any) => notifications.show({ color: 'red', title: 'Error', message: err?.response?.data?.message || 'Failed to create project' }),
      }
    );
  };

  const handleCreate = () => {
    // Real-time duplicate check before submitting
    const dupError = checkDuplicateName(form.name);
    if (dupError) {
      setNameError(dupError);
      return;
    }
    setNameError('');
    createMutation.mutate(form, {
      onSuccess: () => {
        setModalOpen(false);
        setForm(emptyForm);
        setNameError('');
        notifications.show({ title: 'Created', message: 'Project created', color: 'green' });
      },
      onError: (error: any) => {
        if (error.response?.status === 409) {
          setNameError('A project with this name already exists');
        } else {
          notifications.show({ title: 'Error', message: error.message || 'Failed to create project', color: 'red' });
        }
      },
    });
  };

  if (isLoading) return <LoadingSpinner variant="table" message="Loading projects..." />;
  if (error) return <PageError context="loading projects" error={error} />;

  return (
    <Stack className="page-enter stagger-children">
      <Group justify="space-between" className="slide-in-left" align="center">
        <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>Projects</Title>
        <Group gap="sm" align="center">
          {/* View switcher — Table / Board (Kanban) */}
          <Tabs
            value={viewMode}
            onChange={(v) => setViewMode(v as 'table' | 'board')}
            className="view-switcher-tabs"
          >
            <Tabs.List>
              <Tabs.Tab value="table" leftSection={<IconLayoutList size={14} />}>Table</Tabs.Tab>
              <Tabs.Tab value="board" leftSection={<IconLayoutKanban size={14} />}>Board</Tabs.Tab>
            </Tabs.List>
          </Tabs>
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
          <Button
            variant="light"
            color="blue"
            leftSection={<IconPlugConnected size={16} />}
            onClick={() => {
              setJiraImportOpen(true);
              setSelectedJiraKeys(new Set());
              setImportingCount(0);
              setImportedCount(0);
              setImportErrors([]);
            }}
          >
            Import from Jira
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>Add Project</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} className="stagger-grid">
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

      {viewMode === 'table' && (
        <SegmentedControl
          value={statusFilter}
          onChange={handleSegmentedChange}
          data={[
            { value: 'ALL', label: 'All' },
            ...statusOptions,
          ]}
        />
      )}

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
        {/* Column visibility toggle */}
        <Popover width={200} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <Tooltip label="Toggle columns">
              <ActionIcon variant="light" size="sm" color="gray">
                <IconColumns size={14} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="xs" fw={600} mb="xs" style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>Visible Columns</Text>
            <Stack gap={6}>
              {ALL_COLS.map(col => (
                <Switch
                  key={col}
                  label={col}
                  size="xs"
                  checked={visibleCols.has(col)}
                  onChange={() => toggleCol(col)}
                  color="teal"
                  styles={{ label: { fontFamily: FONT_FAMILY, fontSize: 12 } }}
                />
              ))}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>

      {viewMode === 'table' && (
        <>
          <ScrollArea>
            <Table fz="xs" highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 32 }} />
                  {visibleCols.has('#') && <Table.Th style={{ width: 40 }}>#</Table.Th>}
                  <SortableHeader sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader>
                  {visibleCols.has('Priority') && <SortableHeader sortKey="priority" currentKey={sortKey} dir={sortDir} onSort={onSort}>Priority</SortableHeader>}
                  {visibleCols.has('Owner') && <SortableHeader sortKey="owner" currentKey={sortKey} dir={sortDir} onSort={onSort}>Owner</SortableHeader>}
                  {visibleCols.has('Start') && <SortableHeader sortKey="startMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>Start</SortableHeader>}
                  {visibleCols.has('End') && <SortableHeader sortKey="targetEndMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>End</SortableHeader>}
                  {visibleCols.has('Duration') && <SortableHeader sortKey="durationMonths" currentKey={sortKey} dir={sortDir} onSort={onSort}>Duration</SortableHeader>}
                  {visibleCols.has('Pattern') && <Table.Th>Pattern</Table.Th>}
                  {visibleCols.has('Status') && <SortableHeader sortKey="status" currentKey={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>}
                  {visibleCols.has('Created') && <SortableHeader sortKey="createdAt" currentKey={sortKey} dir={sortDir} onSort={onSort}>Created</SortableHeader>}
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pagedProjects.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={12} style={{ textAlign: 'center', padding: '2rem' }}>
                      <Text c="dimmed" size="sm">No projects match the current filters.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {pagedProjects.map((p, idx) => {
                  const isExpanded = expandedRows.has(p.id);
                  const pods = podsByProject.get(p.id) ?? [];
                  const hasPods = pods.length > 0;
                  return (
                    <>
                      {/* ── Project row ── */}
                      <Table.Tr
                        key={p.id}
                        ref={p.id === highlightId || p.id === flashId ? highlightRowRef : undefined}
                        style={{
                          cursor: 'pointer',
                          ...(p.id === flashId ? {
                            backgroundColor: AQUA_TINTS[10],
                            transition: 'background-color 1s ease-out',
                            boxShadow: `0 0 0 2px ${AQUA}`,
                          } : {}),
                        }}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        {/* Expand chevron */}
                        <Table.Td style={{ padding: '8px 6px' }}>
                          {hasPods ? (
                            <ActionIcon
                              variant="subtle"
                              size="xs"
                              color={isExpanded ? 'teal' : 'gray'}
                              onClick={(e) => toggleExpand(p.id, e)}
                              style={{ transition: 'transform 150ms ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            >
                              <IconChevronRight size={14} />
                            </ActionIcon>
                          ) : (
                            <Box style={{ width: 22 }} />
                          )}
                        </Table.Td>
                        {visibleCols.has('#') && <Table.Td c="dimmed" style={{ fontSize: 12 }}>{pagination.startIndex + idx + 1}</Table.Td>}
                        {/* Inline-editable name */}
                        <Table.Td fw={600} style={{ color: isDark ? '#e2e8f0' : '#0f172a', minWidth: 160 }}
                          onClick={e => { e.stopPropagation(); startEdit(p.id, 'name', p.name); }}>
                          {editingCell?.id === p.id && editingCell.field === 'name' ? (
                            <TextInput
                              size="xs"
                              value={editDraft}
                              autoFocus
                              onChange={e => setEditDraft(e.currentTarget.value)}
                              onBlur={() => commitEdit(p)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') cancelEdit(); }}
                              onClick={e => e.stopPropagation()}
                              styles={{ input: { fontWeight: 600 } }}
                            />
                          ) : p.name}
                        </Table.Td>
                        {/* Inline-editable priority */}
                        {visibleCols.has('Priority') && (
                          <Table.Td onClick={e => { e.stopPropagation(); startEdit(p.id, 'priority', p.priority); }}>
                            {editingCell?.id === p.id && editingCell.field === 'priority' ? (
                              <Select size="xs" data={priorityOptions} value={editDraft} autoFocus
                                onChange={v => { setEditDraft(v ?? p.priority); }}
                                onBlur={() => commitEdit(p)}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : <PriorityBadge priority={p.priority} />}
                          </Table.Td>
                        )}
                        {/* Inline-editable owner */}
                        {visibleCols.has('Owner') && (
                          <Table.Td onClick={e => { e.stopPropagation(); startEdit(p.id, 'owner', p.owner ?? ''); }}>
                            {editingCell?.id === p.id && editingCell.field === 'owner' ? (
                              <TextInput size="xs" value={editDraft} autoFocus
                                onChange={e => setEditDraft(e.currentTarget.value)}
                                onBlur={() => commitEdit(p)}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') cancelEdit(); }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : p.owner}
                          </Table.Td>
                        )}
                        {visibleCols.has('Start') && <Table.Td>{formatProjectDate(p.startDate, p.startMonth, monthLabels)}</Table.Td>}
                        {visibleCols.has('End') && <Table.Td>{formatProjectDate(p.targetDate, p.targetEndMonth, monthLabels)}</Table.Td>}
                        {visibleCols.has('Duration') && <Table.Td>{p.durationMonths}m</Table.Td>}
                        {visibleCols.has('Pattern') && <Table.Td>{p.defaultPattern}</Table.Td>}
                        {/* Inline-editable status */}
                        {visibleCols.has('Status') && (
                          <Table.Td onClick={e => { e.stopPropagation(); startEdit(p.id, 'status', p.status); }}>
                            {editingCell?.id === p.id && editingCell.field === 'status' ? (
                              <Select size="xs" data={statusOptions} value={editDraft} autoFocus
                                onChange={v => { setEditDraft(v ?? p.status); }}
                                onBlur={() => commitEdit(p)}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : <StatusBadge status={p.status} />}
                          </Table.Td>
                        )}
                        {visibleCols.has('Created') && <Table.Td c="dimmed" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Table.Td>}
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="POD Planning" withArrow>
                              <ActionIcon
                                variant="light"
                                size="sm"
                                color="teal"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/projects/${p.id}`);
                                }}
                              >
                                <IconHexagons size={15} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Duplicate project">
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyMutation.mutate(p.id, {
                                    onSuccess: () => {
                                      notifications.show({ title: 'Duplicated', message: 'Project duplicated successfully', color: 'green' });
                                    },
                                  });
                                }}
                                loading={copyMutation.isPending}
                              >
                                <IconCopy size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>

                      {/* ── POD sub-rows (accordion) ── */}
                      {isExpanded && pods.map((pod) => (
                        <Table.Tr
                          key={`pod-${pod.planningId}`}
                          style={{
                            background: isDark ? 'rgba(45,204,211,0.04)' : '#f0fdfd',
                            cursor: 'default',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Indent indicator */}
                          <Table.Td style={{ padding: 0 }}>
                            <Box style={{ width: '100%', height: '100%', borderLeft: `3px solid ${AQUA}`, minHeight: 36 }} />
                          </Table.Td>
                          <Table.Td />
                          <Table.Td colSpan={1}>
                            <Group gap={6} align="center">
                              <Box style={{ width: 6, height: 6, borderRadius: '50%', background: AQUA, flexShrink: 0 }} />
                              <Text size="xs" fw={600} style={{ color: isDark ? AQUA : '#0e7490' }}>
                                {pod.podName}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td />
                          <Table.Td />
                          <Table.Td />
                          <Table.Td />
                          <Table.Td>
                            <Text size="xs" c="dimmed">{pod.durationOverride ?? '—'}m</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{pod.effortPattern ?? pod.defaultPattern ?? '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              {[
                                { label: 'Dev', val: pod.devHours, color: '#3b82f6' },
                                { label: 'QA', val: pod.qaHours, color: '#8b5cf6' },
                                { label: 'BSA', val: pod.bsaHours, color: '#f59e0b' },
                                { label: 'TL', val: pod.techLeadHours, color: '#ef4444' },
                              ].filter(r => r.val > 0).map(r => (
                                <Tooltip key={r.label} label={`${r.label}: ${r.val}h`}>
                                  <Badge
                                    size="xs"
                                    style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44`, cursor: 'default' }}
                                  >
                                    {r.label} {r.val}h
                                  </Badge>
                                </Tooltip>
                              ))}
                              {pod.totalHoursWithContingency > 0 && (
                                <Text size="xs" fw={700} style={{ color: isDark ? '#94a3b8' : '#475569', whiteSpace: 'nowrap' }}>
                                  = {Math.round(pod.totalHoursWithContingency)}h total
                                </Text>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            {pod.targetReleaseName ? (
                              <Badge size="xs" variant="light" color="teal">{pod.targetReleaseName}</Badge>
                            ) : <Text size="xs" c="dimmed">—</Text>}
                          </Table.Td>
                          <Table.Td />
                        </Table.Tr>
                      ))}
                    </>
                  );
                })}
                {/* ── Inline add-row ── */}
                {addRowActive ? (
                  <Table.Tr style={{ background: isDark ? 'rgba(45,204,211,0.06)' : '#f0fdfa' }}>
                    <Table.Td />
                    {visibleCols.has('#') && <Table.Td />}
                    {/* Name */}
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="Project name…"
                        value={addRowForm.name}
                        autoFocus
                        onChange={e => setAddRowForm(f => ({ ...f, name: e.currentTarget.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') submitAddRow(); if (e.key === 'Escape') { setAddRowActive(false); } }}
                      />
                    </Table.Td>
                    {/* Priority */}
                    {visibleCols.has('Priority') && (
                      <Table.Td>
                        <Select size="xs" data={priorityOptions} value={addRowForm.priority}
                          onChange={v => setAddRowForm(f => ({ ...f, priority: v ?? 'P2' }))} />
                      </Table.Td>
                    )}
                    {/* Owner */}
                    {visibleCols.has('Owner') && (
                      <Table.Td>
                        <TextInput size="xs" placeholder="Owner" value={addRowForm.owner}
                          onChange={e => setAddRowForm(f => ({ ...f, owner: e.currentTarget.value }))} />
                      </Table.Td>
                    )}
                    {visibleCols.has('Start') && <Table.Td />}
                    {visibleCols.has('End') && <Table.Td />}
                    {visibleCols.has('Duration') && <Table.Td />}
                    {visibleCols.has('Pattern') && <Table.Td />}
                    {/* Status */}
                    {visibleCols.has('Status') && (
                      <Table.Td>
                        <Select size="xs" data={statusOptions} value={addRowForm.status}
                          onChange={v => setAddRowForm(f => ({ ...f, status: v ?? 'ACTIVE' }))} />
                      </Table.Td>
                    )}
                    {visibleCols.has('Created') && <Table.Td />}
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon size="sm" color="teal" variant="light" onClick={submitAddRow} loading={createMutation.isPending}>
                          <IconCheck size={14} />
                        </ActionIcon>
                        <ActionIcon size="sm" color="red" variant="light" onClick={() => setAddRowActive(false)}>
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  <Table.Tr
                    style={{ cursor: 'pointer', opacity: 0.6 }}
                    onClick={() => setAddRowActive(true)}
                  >
                    <Table.Td colSpan={12} style={{ textAlign: 'center', padding: '8px', color: '#94a3b8', fontSize: 12 }}>
                      <Group gap={4} justify="center">
                        <IconPlus size={13} />
                        <span>Add project</span>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <TablePagination {...pagination} />
        </>
      )}

      {viewMode === 'board' && (
        <KanbanBoardView
          projects={boardProjects.map(p => ({ ...p, targetDate: p.targetDate ?? undefined }))}
          onProjectClick={(id) => navigate(`/projects/${id}`)}
          onStatusChange={handleBoardStatusChange}
        />
      )}

      <Modal opened={modalOpen} onClose={() => { setModalOpen(false); setNameError(''); }} title="Add Project" size="xl">
        <Stack>
          <TextInput
            label="Name"
            value={form.name}
            onChange={e => {
              const val = e.target.value;
              setForm({ ...form, name: val });
              setNameError(checkDuplicateName(val));
            }}
            error={nameError}
            required
          />
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
          <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!!nameError}>Create</Button>
        </Stack>
      </Modal>

      {/* ── Import from Jira Modal ── */}
      <Modal
        opened={jiraImportOpen}
        onClose={() => setJiraImportOpen(false)}
        title={
          <Group gap="xs">
            <IconPlugConnected size={20} color="#0052CC" />
            <Text fw={600}>Import Projects from Jira</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="sm">
          {jiraProjectsLoading ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Loading Jira projects...</Text>
            </Stack>
          ) : jiraProjects.length === 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={14} />}>
              No Jira projects found. Configure Jira boards in Settings first.
            </Alert>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                Select Jira projects to import as portfolio projects. Projects will be created with default settings (P2 priority, NOT_STARTED status, Flat pattern).
              </Text>

              {/* Stats */}
              <Group gap="xs">
                <Badge size="sm" color="blue" variant="light">
                  {jiraProjects.length} Jira projects
                </Badge>
                <Badge size="sm" color="teal" variant="light">
                  {importableJiraProjects.length} available to import
                </Badge>
                {alreadyImportedJiraProjects.length > 0 && (
                  <Badge size="sm" color="gray" variant="light">
                    {alreadyImportedJiraProjects.length} already exist
                  </Badge>
                )}
              </Group>

              {importableJiraProjects.length > 0 && (
                <>
                  <Divider />
                  {/* Select all / deselect all */}
                  <Group justify="space-between">
                    <Checkbox
                      label={<Text size="sm" fw={600}>Select all ({importableJiraProjects.length})</Text>}
                      checked={selectedJiraKeys.size === importableJiraProjects.length && importableJiraProjects.length > 0}
                      indeterminate={selectedJiraKeys.size > 0 && selectedJiraKeys.size < importableJiraProjects.length}
                      onChange={toggleAllImportable}
                    />
                    {selectedJiraKeys.size > 0 && (
                      <Badge size="sm" color="indigo" variant="filled">
                        {selectedJiraKeys.size} selected
                      </Badge>
                    )}
                  </Group>

                  {/* Importable project list */}
                  <ScrollArea.Autosize mah={320}>
                    <Stack gap={4}>
                      {importableJiraProjects.map(jp => (
                        <Group
                          key={jp.key}
                          gap="sm"
                          p="xs"
                          style={{
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: selectedJiraKeys.has(jp.key)
                              ? (isDark ? 'var(--mantine-color-indigo-9)' : 'var(--mantine-color-indigo-0)')
                              : 'transparent',
                          }}
                          onClick={() => toggleJiraKey(jp.key)}
                        >
                          <Checkbox
                            checked={selectedJiraKeys.has(jp.key)}
                            onChange={() => toggleJiraKey(jp.key)}
                            size="sm"
                          />
                          <Badge size="sm" variant="light" color="blue" ff="monospace">{jp.key}</Badge>
                          <Text size="sm">{jp.name}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>
                </>
              )}

              {/* Already existing projects */}
              {alreadyImportedJiraProjects.length > 0 && (
                <>
                  <Divider label="Already in Portfolio Planner" labelPosition="center" />
                  <ScrollArea.Autosize mah={120}>
                    <Stack gap={2}>
                      {alreadyImportedJiraProjects.map(jp => (
                        <Group key={jp.key} gap="sm" p="xs" style={{ opacity: 0.5 }}>
                          <IconCheck size={14} color="var(--mantine-color-green-6)" />
                          <Badge size="sm" variant="light" color="gray" ff="monospace">{jp.key}</Badge>
                          <Text size="sm" c="dimmed">{jp.name}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>
                </>
              )}

              {/* Import progress */}
              {importingCount > 0 && importedCount < importingCount && importErrors.length === 0 && (
                <Group gap="sm">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">Importing {importedCount} of {importingCount}...</Text>
                </Group>
              )}

              {/* Import errors */}
              {importErrors.length > 0 && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>{importErrors.length} project(s) failed:</Text>
                    {importErrors.map((e, i) => (
                      <Text key={i} size="xs" ff="monospace">{e}</Text>
                    ))}
                  </Stack>
                </Alert>
              )}

              {/* Action buttons */}
              <Group justify="flex-end">
                <Button variant="light" onClick={() => setJiraImportOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button
                  leftSection={<IconDownload size={14} />}
                  onClick={handleJiraImport}
                  loading={importingCount > 0 && importedCount < importingCount && importErrors.length === 0}
                  disabled={selectedJiraKeys.size === 0}
                  size="sm"
                >
                  Import {selectedJiraKeys.size > 0 ? `${selectedJiraKeys.size} Project${selectedJiraKeys.size !== 1 ? 's' : ''}` : ''}
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
