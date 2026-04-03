import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Title, Button, Group, Table, Modal, TextInput, Select, NumberInput, Textarea, Stack, Text, SegmentedControl, SimpleGrid, ActionIcon, Tooltip,
ScrollArea, ThemeIcon, Badge, Checkbox, Alert, Loader, Divider,
} from '@mantine/core';
import { AQUA, AQUA_TINTS, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconBriefcase, IconFlame, IconClock, IconAlertTriangle, IconSearch, IconCopy, IconPlugConnected, IconDownload, IconCheck } from '@tabler/icons-react';
import { useProjects, useCreateProject, useCopyProject } from '../api/projects';
import { useEffortPatterns } from '../api/refData';
import { useJiraAllProjectsSimple } from '../api/jira';
import CsvToolbar from '../components/common/CsvToolbar';
import { projectColumns } from '../utils/csvColumns';
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
  const copyMutation = useCopyProject();
  const { data: effortPatterns } = useEffortPatterns();
  const { data: jiraProjects = [], isLoading: jiraProjectsLoading } = useJiraAllProjectsSimple();
  const navigate = useNavigate();
  const { monthLabels } = useMonthLabels();
  const [modalOpen, setModalOpen] = useState(false);
  const [jiraImportOpen, setJiraImportOpen] = useState(false);
  const [selectedJiraKeys, setSelectedJiraKeys] = useState<Set<string>>(new Set());
  const [importingCount, setImportingCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [form, setForm] = useState<ProjectRequest>(emptyForm);
  const [nameError, setNameError] = useState<string>('');

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
      <Group justify="space-between" className="slide-in-left">
        <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>Projects</Title>
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

      <ScrollArea>
        <Table fz="xs" highlightOnHover withTableBorder withColumnBorders>
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
              <SortableHeader sortKey="createdAt" currentKey={sortKey} dir={sortDir} onSort={onSort}>Created</SortableHeader>
              <Table.Th style={{ width: 50 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pagedProjects.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="dimmed" size="sm">No projects match the current filters.</Text>
                </Table.Td>
              </Table.Tr>
            )}
            {pagedProjects.map((p, idx) => (
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
                <Table.Td c="dimmed" style={{ fontSize: 12 }}>{pagination.startIndex + idx + 1}</Table.Td>
                <Table.Td fw={500}>{p.name}</Table.Td>
                <Table.Td><PriorityBadge priority={p.priority} /></Table.Td>
                <Table.Td>{p.owner}</Table.Td>
                <Table.Td>{formatProjectDate(p.startDate, p.startMonth, monthLabels)}</Table.Td>
                <Table.Td>{formatProjectDate(p.targetDate, p.targetEndMonth, monthLabels)}</Table.Td>
                <Table.Td>{p.durationMonths}m</Table.Td>
                <Table.Td>{p.defaultPattern}</Table.Td>
                <Table.Td><StatusBadge status={p.status} /></Table.Td>
                <Table.Td c="dimmed" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Table.Td>
                <Table.Td>
                  <Tooltip label="Duplicate project">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyMutation.mutate(p.id, {
                          onSuccess: (newProject) => {
                            notifications.show({ title: 'Duplicated', message: 'Project duplicated successfully', color: 'green' });
                          },
                        });
                      }}
                      loading={copyMutation.isPending}
                    >
                      <IconCopy size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <TablePagination {...pagination} />

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
