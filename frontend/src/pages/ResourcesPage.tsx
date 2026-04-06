import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Title, Button, Group, Table, Modal, TextInput, Select, Switch, NumberInput, Stack, Text, ActionIcon, SimpleGrid,
  Badge, Tooltip, Checkbox, ScrollArea, ThemeIcon, Avatar, Popover, SegmentedControl,
} from '@mantine/core';
import { AQUA, AQUA_TINTS, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconTrash, IconUsers, IconCode, IconTestPipe, IconUserStar, IconMapPin,
  IconAlertTriangle, IconSearch, IconUserOff, IconClock, IconBuildingSkyscraper,
  IconDownload, IconWand, IconColumns, IconPencil, IconCheck, IconX,
} from '@tabler/icons-react';
import { useResources, useCreateResource, useDeleteResource, useUpdateResource, useSetAssignment, useAllAvailability } from '../api/resources';
import { usePods } from '../api/pods';
import { useJiraUsers, useAutoMatchSuggestions, useApplyAutoMatch } from '../api/jiraBuffer';
import { Role, Location, formatRole } from '../types';
import type { ResourceRequest, ResourceResponse } from '../types';
import SummaryCard from '../components/charts/SummaryCard';
import SortableHeader from '../components/common/SortableHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageError from '../components/common/PageError';
import CsvToolbar from '../components/common/CsvToolbar';
import NlpBreadcrumb from '../components/common/NlpBreadcrumb';
import TablePagination from '../components/common/TablePagination';
import SavedViews from '../components/common/SavedViews';
import BulkActions from '../components/common/BulkActions';
import { resourceColumns } from '../utils/csvColumns';
import { downloadCsv } from '../utils/csv';
import { useTableSort } from '../hooks/useTableSort';
import { usePagination } from '../hooks/usePagination';
import { useRowSelection } from '../hooks/useRowSelection';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLocalStorage } from '../hooks/useLocalStorage';

const FULL_TIME_HOURS = [176, 176, 168, 176, 176, 184, 168, 176, 176, 168, 184, 168];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.substring(0, 2)?.toUpperCase() ?? '?';
}

const roleOptions = Object.values(Role).map(r => ({ value: r, label: formatRole(r) }));
const locationOptions = Object.values(Location).map(l => ({ value: l, label: l }));

const emptyForm: ResourceRequest = {
  name: '',
  email: null,
  role: Role.DEVELOPER,
  location: Location.US,
  active: true,
  countsInCapacity: true,
  homePodId: null,
  capacityFte: 1.0,
  jiraDisplayName: null,
  jiraAccountId: null,
};

// Toggleable columns for Resources table
const RES_ALL_COLS = ['#', 'Jira User', 'Role', 'Location', 'Active', 'Capacity', 'Home POD', 'FTE'] as const;
type ResColKey = typeof RES_ALL_COLS[number];
const RES_DEFAULT_VISIBLE: ResColKey[] = ['#', 'Role', 'Location', 'Active', 'Home POD', 'FTE'];

export default function ResourcesPage() {
  const isDark = useDarkMode();

  // ── Column visibility (persisted) ────────────────────────────────────
  const [visibleColsArray, setVisibleColsArray] = useLocalStorage<ResColKey[]>('pp_resources_visible_cols', RES_DEFAULT_VISIBLE);
  const visibleCols = new Set<ResColKey>(visibleColsArray);
  const toggleCol = (col: ResColKey) => {
    const next = new Set<ResColKey>(visibleColsArray);
    if (next.has(col)) next.delete(col); else next.add(col);
    setVisibleColsArray(Array.from(next) as ResColKey[]);
  };

  // ── Row density (persisted) ───────────────────────────────────────────
  type Density = 'compact' | 'normal' | 'comfortable';
  const [density, setDensity] = useLocalStorage<Density>('pp_resources_density', 'normal');
  const densitySpacing: Record<Density, string> = { compact: 'xs', normal: 'sm', comfortable: 'md' };

  const { data: resources, isLoading, error } = useResources();
  const { data: pods } = usePods();
  const { data: availability } = useAllAvailability();
  const { data: jiraUsers } = useJiraUsers();
  const { data: suggestions } = useAutoMatchSuggestions();
  const autoMatchMut = useApplyAutoMatch();
  const createMutation = useCreateResource();
  const deleteMutation = useDeleteResource();
  const updateMutation = useUpdateResource();
  const assignMutation = useSetAssignment();
  const [modalOpen, setModalOpen]         = useState(false);
  const [form, setForm]                   = useState<ResourceRequest>(emptyForm);
  const [editId, setEditId]               = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [nameError, setNameError]         = useState<string>('');

  // ── Inline editing ────────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineForm, setInlineForm] = useState<{ name: string; role: Role; location: Location; active: boolean; capacityFte: number }>({
    name: '', role: Role.DEVELOPER, location: Location.US, active: true, capacityFte: 1.0,
  });

  const startInlineEdit = (r: ResourceResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineEditId(r.id);
    setInlineForm({ name: r.name, role: r.role as Role, location: r.location as Location, active: r.active, capacityFte: r.podAssignment?.capacityFte ?? 1.0 });
  };

  const cancelInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineEditId(null);
  };

  const saveInlineEdit = (r: ResourceResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      id: r.id,
      data: {
        name: inlineForm.name,
        email: r.email ?? null,
        role: inlineForm.role,
        location: inlineForm.location,
        active: inlineForm.active,
        countsInCapacity: r.countsInCapacity,
        homePodId: r.podAssignment?.podId ?? null,
        capacityFte: inlineForm.capacityFte,
        jiraDisplayName: r.jiraDisplayName ?? null,
        jiraAccountId: r.jiraAccountId ?? null,
      },
    }, {
      onSuccess: () => {
        if (r.podAssignment?.podId && inlineForm.capacityFte !== r.podAssignment.capacityFte) {
          assignMutation.mutate({ resourceId: r.id, podId: r.podAssignment.podId, capacityFte: inlineForm.capacityFte });
        }
        setInlineEditId(null);
        notifications.show({ message: `${inlineForm.name} updated`, color: 'green' });
      },
      onError: () => notifications.show({ message: 'Update failed', color: 'red' }),
    });
  };

  // Filters
  const [activeCard, setActiveCard]       = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [podFilter, setPodFilter]         = useState<string | null>(null);
  const [roleFilter, setRoleFilter]       = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  // Highlight support from NLP drill-down (?highlight=id)
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null;
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  /* ── Over-allocation check per resource (must be before filteredResources) ──── */
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

  // Filter and sort resources
  const { sorted: sortedResources, sortKey, sortDir, onSort } = useTableSort(useMemo(() => {
    let list = resources ?? [];

    // Card quick-filter
    switch (activeCard) {
      case 'ACTIVE':     list = list.filter(r => r.active); break;
      case 'INACTIVE':   list = list.filter(r => !r.active); break;
      case 'DEVELOPER':  list = list.filter(r => r.role === Role.DEVELOPER); break;
      case 'QA':         list = list.filter(r => r.role === Role.QA); break;
      case 'BSA':        list = list.filter(r => r.role === Role.BSA); break;
      case 'TECH_LEAD':  list = list.filter(r => r.role === Role.TECH_LEAD); break;
      case 'US':         list = list.filter(r => r.location === Location.US); break;
      case 'INDIA':      list = list.filter(r => r.location === Location.INDIA); break;
      case 'PART_TIME':  list = list.filter(r => (r.podAssignment?.capacityFte ?? 1) < 1); break;
      case 'OVER_ALLOC': list = list.filter(r => overAllocMap.has(r.id)); break;
    }

    // Text search (name)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }

    // POD filter
    if (podFilter) {
      if (podFilter === '__none__') {
        list = list.filter(r => !r.podAssignment?.podId);
      } else {
        list = list.filter(r => String(r.podAssignment?.podId) === podFilter);
      }
    }

    // Role filter (dropdown, stacks on top of card filter)
    if (roleFilter) {
      list = list.filter(r => r.role === roleFilter);
    }

    // Location filter
    if (locationFilter) {
      list = list.filter(r => r.location === locationFilter);
    }

    return list;
  }, [resources, activeCard, search, podFilter, roleFilter, locationFilter, overAllocMap]));

  const { paginatedData: pagedResources, ...pagination } = usePagination(sortedResources, 25);

  // Initialize row selection with all sorted resources
  const {
    selectedIds,
    toggle: toggleRow,
    selectAll: selectAllRows,
    clearSelection,
    isSelected,
    selectedCount,
  } = useRowSelection(sortedResources);

  useEffect(() => {
    if (highlightId && resources && resources.some(r => r.id === highlightId)) {
      setFlashId(highlightId);
      // Scroll into view after a short delay for DOM rendering
      setTimeout(() => {
        highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      // Clear the flash after 3s
      const timer = setTimeout(() => setFlashId(null), 3000);
      // Remove the query param so refreshing doesn't keep re-highlighting
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(timer);
    }
  }, [highlightId, resources]);

  const podOptions = (pods ?? []).map(p => ({ value: String(p.id), label: p.name }));
  const podFilterOptions = [{ value: '__none__', label: 'No POD assigned' }, ...podOptions];

  const jiraUserOptions = useMemo(() => (jiraUsers ?? []).map(j => ({
    value: j.displayName,
    label: `${j.displayName}${j.hoursLogged > 0 ? ` (${Math.round(j.hoursLogged)}h)` : ''}`,
  })), [jiraUsers]);

  const stats = useMemo(() => {
    const all = resources ?? [];
    const active   = all.filter(r => r.active).length;
    const inactive = all.filter(r => !r.active).length;
    const devs     = all.filter(r => r.role === Role.DEVELOPER).length;
    const qa       = all.filter(r => r.role === Role.QA).length;
    const bsa      = all.filter(r => r.role === Role.BSA).length;
    const techLead = all.filter(r => r.role === Role.TECH_LEAD).length;
    const us       = all.filter(r => r.location === Location.US).length;
    const india    = all.filter(r => r.location === Location.INDIA).length;
    const partTime = all.filter(r => (r.podAssignment?.capacityFte ?? 1) < 1).length;
    const overAlloc = overAllocMap.size;
    return { total: all.length, active, inactive, devs, qa, bsa, techLead, us, india, partTime, overAlloc };
  }, [resources, overAllocMap]);


  function toggleCard(key: string) {
    setActiveCard(prev => (prev === key ? null : key));
    // Clear dropdown filters when a card is clicked so they don't double-filter by role/location
    if (key === 'DEVELOPER' || key === 'QA' || key === 'BSA' || key === 'TECH_LEAD') setRoleFilter(null);
    if (key === 'US' || key === 'INDIA') setLocationFilter(null);
  }

  function clearAllFilters() {
    setActiveCard(null);
    setSearch('');
    setPodFilter(null);
    setRoleFilter(null);
    setLocationFilter(null);
  }

  const hasActiveFilters = activeCard !== null || search.trim() !== '' || podFilter !== null || roleFilter !== null || locationFilter !== null;

  // Current filters for SavedViews
  const currentFilters = useMemo(() => ({
    search,
    podFilter,
    roleFilter,
    locationFilter,
  }), [search, podFilter, roleFilter, locationFilter]);

  // Apply saved view filters
  const handleApplySavedView = (filters: Record<string, string | null>) => {
    setSearch(filters.search || '');
    setPodFilter(filters.podFilter || null);
    setRoleFilter(filters.roleFilter || null);
    setLocationFilter(filters.locationFilter || null);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (r: ResourceResponse) => {
    setForm({
      name: r.name,
      email: r.email ?? null,
      role: r.role,
      location: r.location,
      active: r.active,
      countsInCapacity: r.countsInCapacity,
      homePodId: r.podAssignment?.podId ?? null,
      capacityFte: r.podAssignment?.capacityFte ?? 1.0,
      jiraDisplayName: r.jiraDisplayName ?? null,
      jiraAccountId: r.jiraAccountId ?? null,
    });
    setEditId(r.id);
    setModalOpen(true);
  };

  const handleSubmit = () => {
    setNameError('');
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
          setNameError('');
          notifications.show({ title: 'Updated', message: 'Resource updated', color: 'green' });
        },
        onError: (error: any) => {
          if (error.response?.status === 409) {
            setNameError('A resource with this name already exists');
          } else {
            notifications.show({ title: 'Error', message: error.message || 'Failed to update resource', color: 'red' });
          }
        },
      });
    } else {
      createMutation.mutate(form, {
        onSuccess: (created: ResourceResponse) => {
          saveAssignment(created.id);
          setModalOpen(false);
          setNameError('');
          notifications.show({ title: 'Created', message: 'Resource created', color: 'green' });
        },
        onError: (error: any) => {
          if (error.response?.status === 409) {
            setNameError('A resource with this name already exists');
          } else {
            notifications.show({ title: 'Error', message: error.message || 'Failed to create resource', color: 'red' });
          }
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

  // Bulk actions handlers
  const handleExportSelected = () => {
    const selectedResources = sortedResources.filter(r => selectedIds.has(r.id));
    if (selectedResources.length === 0) {
      notifications.show({ title: 'No selection', message: 'Please select resources to export', color: 'yellow' });
      return;
    }
    downloadCsv(`resources_selected_${Date.now()}`, selectedResources, resourceColumns);
    notifications.show({ title: 'Exported', message: `${selectedResources.length} resource(s) exported`, color: 'green' });
  };

  const handleDeleteSelected = () => {
    const selectedResources = sortedResources.filter(r => selectedIds.has(r.id));
    if (selectedResources.length === 0) {
      notifications.show({ title: 'No selection', message: 'Please select resources to delete', color: 'yellow' });
      return;
    }
    // Show confirmation modal with count
    setDeleteConfirm(-1); // Use -1 as a sentinel for bulk delete
  };

  if (isLoading) return <LoadingSpinner variant="table" message="Loading resources..." />;
  if (error) return <PageError context="loading resources" error={error} />;

  const totalOverAlloc = Array.from(overAllocMap.values()).reduce((s, v) => s + v, 0);

  return (
    <Stack className="page-enter stagger-children">
      <NlpBreadcrumb />
      <Group justify="space-between" className="slide-in-left">
        <Group gap="sm">
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>Resources</Title>
          {totalOverAlloc > 0 && (
            <Tooltip label={`${overAllocMap.size} resource(s) have availability hours exceeding their FTE capacity`}>
              <Badge color="orange" variant="light" size="lg" leftSection={<IconAlertTriangle size={14} />}>
                {overAllocMap.size} over-allocated
              </Badge>
            </Tooltip>
          )}
        </Group>
        <Group gap="sm">
          {suggestions && suggestions.length > 0 && (
            <Tooltip label={`${suggestions.length} Jira users can be auto-matched to resources`}>
              <Button
                variant="light"
                color="teal"
                size="sm"
                leftSection={<IconWand size={16} />}
                loading={autoMatchMut.isPending}
                onClick={() => {
                  autoMatchMut.mutate(0.50, {
                    onSuccess: (data) => {
                      notifications.show({
                        title: 'Auto-Match Complete',
                        message: `${data} resource(s) matched to Jira users`,
                        color: 'teal',
                      });
                    },
                    onError: () => {
                      notifications.show({
                        title: 'Error',
                        message: 'Failed to auto-match resources',
                        color: 'red',
                      });
                    },
                  });
                }}
              >
                Auto-Match ({suggestions.length})
              </Button>
            </Tooltip>
          )}
          <CsvToolbar
            data={resources ?? []}
            columns={resourceColumns}
            filename="resources"
            onImport={(rows) => {
              rows.forEach(row => {
                const podMatch = (pods ?? []).find(p => p.name.toLowerCase() === (row['podAssignment.podName'] ?? '').toLowerCase());
                createMutation.mutate({
                  name: row.name ?? '',
                  email: row.email ?? null,
                  role: row.role ?? 'DEVELOPER',
                  location: row.location ?? 'US',
                  active: (row.active ?? 'Yes').toLowerCase() !== 'no',
                  countsInCapacity: (row.countsInCapacity ?? 'Yes').toLowerCase() !== 'no',
                  homePodId: podMatch?.id ?? null,
                  capacityFte: Number(row['podAssignment.capacityFte']) || 1.0,
                  jiraDisplayName: row.jiraDisplayName ?? null,
                  jiraAccountId: row.jiraAccountId ?? null,
                });
              });
            }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Resource</Button>
        </Group>
      </Group>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 6 }}>
        <SummaryCard
          title="Total"
          value={stats.total}
          icon={<IconUsers size={20} color="#339af0" />}
          onClick={clearAllFilters}
          active={!hasActiveFilters}
        />
        <SummaryCard
          title="Active"
          value={stats.active}
          icon={<IconUsers size={20} color="#40c057" />}
          onClick={() => toggleCard('ACTIVE')}
          active={activeCard === 'ACTIVE'}
        />
        <SummaryCard
          title="Inactive"
          value={stats.inactive}
          icon={<IconUserOff size={20} color="#868e96" />}
          onClick={() => toggleCard('INACTIVE')}
          active={activeCard === 'INACTIVE'}
        />
        <SummaryCard
          title="Part-Time"
          value={stats.partTime}
          icon={<IconClock size={20} color="#fd7e14" />}
          onClick={() => toggleCard('PART_TIME')}
          active={activeCard === 'PART_TIME'}
        />
        <SummaryCard
          title="Over-Allocated"
          value={stats.overAlloc}
          icon={<IconAlertTriangle size={20} color="#fa5252" />}
          onClick={() => toggleCard('OVER_ALLOC')}
          active={activeCard === 'OVER_ALLOC'}
        />
        <SummaryCard
          title="Developers"
          value={stats.devs}
          icon={<IconCode size={20} color="#845ef7" />}
          onClick={() => toggleCard('DEVELOPER')}
          active={activeCard === 'DEVELOPER'}
        />
        <SummaryCard
          title="QA"
          value={stats.qa}
          icon={<IconTestPipe size={20} color="#fd7e14" />}
          onClick={() => toggleCard('QA')}
          active={activeCard === 'QA'}
        />
        <SummaryCard
          title="BSA"
          value={stats.bsa}
          icon={<IconUserStar size={20} color="#e64980" />}
          onClick={() => toggleCard('BSA')}
          active={activeCard === 'BSA'}
        />
        <SummaryCard
          title="Tech Lead"
          value={stats.techLead}
          icon={<IconUserStar size={20} color="#fab005" />}
          onClick={() => toggleCard('TECH_LEAD')}
          active={activeCard === 'TECH_LEAD'}
        />
        <SummaryCard
          title="US"
          value={stats.us}
          icon={<IconMapPin size={20} color="#339af0" />}
          onClick={() => toggleCard('US')}
          active={activeCard === 'US'}
        />
        <SummaryCard
          title="India"
          value={stats.india}
          icon={<IconMapPin size={20} color="#20c997" />}
          onClick={() => toggleCard('INDIA')}
          active={activeCard === 'INDIA'}
        />
      </SimpleGrid>

      {/* ── Filter Bar ──────────────────────────────────────── */}
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
          placeholder="All PODs"
          leftSection={<IconBuildingSkyscraper size={15} />}
          data={podFilterOptions}
          value={podFilter}
          onChange={setPodFilter}
          clearable
          searchable
          style={{ flex: '1 1 180px', maxWidth: 240 }}
          size="sm"
        />
        <Select
          placeholder="All Roles"
          data={roleOptions}
          value={roleFilter}
          onChange={v => { setRoleFilter(v); setActiveCard(null); }}
          clearable
          style={{ flex: '1 1 150px', maxWidth: 200 }}
          size="sm"
        />
        <Select
          placeholder="All Locations"
          data={locationOptions}
          value={locationFilter}
          onChange={v => { setLocationFilter(v); setActiveCard(null); }}
          clearable
          style={{ flex: '1 1 150px', maxWidth: 180 }}
          size="sm"
        />
        {hasActiveFilters && (
          <Button variant="subtle" color="gray" size="sm" onClick={clearAllFilters}>
            Clear filters
          </Button>
        )}
        <SavedViews
          pageKey="resources"
          currentFilters={currentFilters}
          onApply={handleApplySavedView}
        />
        <Text size="sm" c="dimmed" ml="auto">
          {sortedResources.length} of {(resources ?? []).length} resources
        </Text>
        {/* Row density selector */}
        <SegmentedControl
          size="xs"
          value={density}
          onChange={v => setDensity(v as Density)}
          data={[
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Cozy', value: 'comfortable' },
          ]}
          styles={{ root: { background: 'transparent' }, label: { fontSize: 11 } }}
        />
        {/* Column visibility toggle */}
        <Popover width={210} position="bottom-end" withArrow shadow="md">
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
              {RES_ALL_COLS.map(col => (
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

      {/* ── Table ───────────────────────────────────────────── */}
      <ScrollArea>
        <Table fz={density === 'comfortable' ? 'sm' : 'xs'} verticalSpacing={densitySpacing[density]} highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  checked={pagedResources.length > 0 && pagedResources.every(r => isSelected(r.id))}
                  indeterminate={pagedResources.length > 0 && pagedResources.some(r => isSelected(r.id)) && !pagedResources.every(r => isSelected(r.id))}
                  onChange={() => {
                    if (pagedResources.every(r => isSelected(r.id))) {
                      pagedResources.forEach(r => toggleRow(r.id));
                    } else {
                      pagedResources.forEach(r => {
                        if (!isSelected(r.id)) toggleRow(r.id);
                      });
                    }
                  }}
                  aria-label="Select all visible rows"
                />
              </Table.Th>
              {visibleCols.has('#') && <Table.Th style={{ width: 40 }}>#</Table.Th>}
              <SortableHeader sortKey="name" currentKey={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader>
              {visibleCols.has('Jira User') && <Table.Th>Jira User</Table.Th>}
              {visibleCols.has('Role') && <SortableHeader sortKey="role" currentKey={sortKey} dir={sortDir} onSort={onSort}>Role</SortableHeader>}
              {visibleCols.has('Location') && <SortableHeader sortKey="location" currentKey={sortKey} dir={sortDir} onSort={onSort}>Location</SortableHeader>}
              {visibleCols.has('Active') && <SortableHeader sortKey="active" currentKey={sortKey} dir={sortDir} onSort={onSort}>Active</SortableHeader>}
              {visibleCols.has('Capacity') && <Table.Th>Counts in Capacity</Table.Th>}
              {visibleCols.has('Home POD') && <SortableHeader sortKey="podAssignment.podName" currentKey={sortKey} dir={sortDir} onSort={onSort}>Home POD</SortableHeader>}
              {visibleCols.has('FTE') && <SortableHeader sortKey="podAssignment.capacityFte" currentKey={sortKey} dir={sortDir} onSort={onSort}>Capacity FTE</SortableHeader>}
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pagedResources.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3 + visibleColsArray.length} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="dimmed" size="sm">No resources match the current filters.</Text>
                </Table.Td>
              </Table.Tr>
            ) : pagedResources.map((r, idx) => {
              const fte = r.podAssignment?.capacityFte ?? 1;
              const isPartTime = fte < 1;
              const overCount = overAllocMap.get(r.id);
              return (
                <Table.Tr
                  key={r.id}
                  ref={r.id === highlightId || r.id === flashId ? highlightRowRef : undefined}
                  style={{
                    cursor: inlineEditId === r.id ? 'default' : 'pointer',
                    ...(inlineEditId === r.id ? {
                      background: isDark ? 'rgba(34,139,230,0.08)' : 'rgba(34,139,230,0.05)',
                      outline: `2px solid rgba(34,139,230,0.3)`,
                      outlineOffset: -1,
                    } : r.id === flashId ? {
                      backgroundColor: AQUA_TINTS[10],
                      transition: 'background-color 1s ease-out',
                      boxShadow: `0 0 0 2px ${AQUA}`,
                    } : overCount ? {
                      background: isDark ? 'rgba(250,82,82,0.04)' : 'rgba(250,82,82,0.03)',
                    } : !r.active ? {
                      background: isDark ? 'rgba(144,146,150,0.06)' : 'rgba(0,0,0,0.02)',
                    } : {}),
                  }}
                  onClick={() => inlineEditId !== r.id && openEdit(r)}
                >
                  <Table.Td onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected(r.id)}
                      onChange={() => toggleRow(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  </Table.Td>
                  {visibleCols.has('#') && (
                    <Table.Td>
                      <Text size="xs" c="dimmed" fw={500}>{pagination.startIndex + idx + 1}</Text>
                    </Table.Td>
                  )}
                  <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                    <Group gap="xs" wrap="nowrap">
                      <Avatar
                        src={r.avatarUrl ?? null}
                        size={26}
                        radius="xl"
                        color={r.active ? 'blue' : 'gray'}
                        variant="light"
                      >
                        <Text size="xs" fw={700}>{initials(inlineEditId === r.id ? inlineForm.name : r.name)}</Text>
                      </Avatar>
                      {inlineEditId === r.id ? (
                        <TextInput
                          size="xs"
                          value={inlineForm.name}
                          onChange={e => setInlineForm(f => ({ ...f, name: e.target.value }))}
                          style={{ width: 140 }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div>
                          <Group gap={4} wrap="nowrap">
                            <Text size="xs" fw={500}>{r.name}</Text>
                            {overCount && (
                              <Tooltip label={`${overCount} month(s) exceed ${Math.round(fte * 100)}% FTE capacity`}>
                                <IconAlertTriangle size={14} color="orange" />
                              </Tooltip>
                            )}
                            {!r.active && <Badge size="xs" color="gray" variant="light">Inactive</Badge>}
                          </Group>
                          {r.email && (
                            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{r.email}</Text>
                          )}
                        </div>
                      )}
                    </Group>
                  </Table.Td>
                  {visibleCols.has('Jira User') && (
                    <Table.Td>
                      {r.jiraDisplayName ? (
                        <Badge size="xs" variant="light" color="teal">{r.jiraDisplayName}</Badge>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                  )}
                  {visibleCols.has('Role') && (
                    <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                      {inlineEditId === r.id ? (
                        <Select
                          size="xs"
                          data={roleOptions}
                          value={inlineForm.role}
                          onChange={v => v && setInlineForm(f => ({ ...f, role: v as Role }))}
                          style={{ minWidth: 120 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <Badge size="xs" variant="light" color={
                          r.role === 'DEVELOPER' ? 'violet' :
                          r.role === 'QA' ? 'orange' :
                          r.role === 'BSA' ? 'pink' :
                          r.role === 'TECH_LEAD' ? 'yellow' : 'gray'
                        }>{formatRole(r.role)}</Badge>
                      )}
                    </Table.Td>
                  )}
                  {visibleCols.has('Location') && (
                    <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                      {inlineEditId === r.id ? (
                        <Select
                          size="xs"
                          data={locationOptions}
                          value={inlineForm.location}
                          onChange={v => v && setInlineForm(f => ({ ...f, location: v as Location }))}
                          style={{ minWidth: 100 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <Badge size="xs" variant="light" color={r.location === 'US' ? 'blue' : 'teal'}>
                          {r.location}
                        </Badge>
                      )}
                    </Table.Td>
                  )}
                  {visibleCols.has('Active') && (
                    <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                      {inlineEditId === r.id ? (
                        <Switch
                          size="xs"
                          checked={inlineForm.active}
                          onChange={e => setInlineForm(f => ({ ...f, active: e.currentTarget.checked }))}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        r.active
                          ? <Badge size="xs" color="green" variant="light">Yes</Badge>
                          : <Badge size="xs" color="gray" variant="light">No</Badge>
                      )}
                    </Table.Td>
                  )}
                  {visibleCols.has('Capacity') && (
                    <Table.Td>
                      {r.countsInCapacity
                        ? <Badge size="xs" color="green" variant="light">Yes</Badge>
                        : <Badge size="xs" color="gray" variant="light">No</Badge>
                      }
                    </Table.Td>
                  )}
                  {visibleCols.has('Home POD') && (
                    <Table.Td>
                      <Text size="xs">{r.podAssignment?.podName ?? <Text span size="xs" c="dimmed">—</Text>}</Text>
                    </Table.Td>
                  )}
                  {visibleCols.has('FTE') && (
                    <Table.Td onClick={e => inlineEditId === r.id && e.stopPropagation()}>
                      {inlineEditId === r.id && r.podAssignment ? (
                        <NumberInput
                          size="xs"
                          value={inlineForm.capacityFte}
                          onChange={v => setInlineForm(f => ({ ...f, capacityFte: Number(v) }))}
                          min={0} max={1} step={0.1} decimalScale={2}
                          style={{ width: 80 }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : r.podAssignment ? (
                        <Badge variant="light" color={isPartTime ? 'orange' : 'green'} size="sm">
                          {isPartTime ? `${Math.round(fte * 100)}%` : '100%'}
                        </Badge>
                      ) : '-'}
                    </Table.Td>
                  )}
                  <Table.Td onClick={e => e.stopPropagation()}>
                    {inlineEditId === r.id ? (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Save">
                          <ActionIcon
                            size="sm" color="green" variant="filled"
                            loading={updateMutation.isPending}
                            onClick={e => saveInlineEdit(r, e)}
                          >
                            <IconCheck size={13} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel">
                          <ActionIcon size="sm" color="gray" variant="subtle" onClick={cancelInlineEdit}>
                            <IconX size={13} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    ) : (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Quick edit">
                          <ActionIcon size="sm" color="blue" variant="subtle" onClick={e => startInlineEdit(r, e)}>
                            <IconPencil size={13} />
                          </ActionIcon>
                        </Tooltip>
                        <ActionIcon color="red" variant="subtle" size="sm" onClick={() => setDeleteConfirm(r.id)}>
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <TablePagination {...pagination} />

      {/* ── Bulk Actions Bar ────────────────────────────────── */}
      <BulkActions
        selectedCount={selectedCount}
        totalCount={sortedResources.length}
        onSelectAll={() => selectAllRows(sortedResources.map(r => r.id))}
        onClearSelection={clearSelection}
        actions={[
          {
            label: 'Export Selected',
            icon: <IconDownload size={14} />,
            onClick: handleExportSelected,
          },
          {
            label: 'Delete Selected',
            icon: <IconTrash size={14} />,
            color: 'red',
            onClick: handleDeleteSelected,
          },
        ]}
      />

      <Modal opened={modalOpen} onClose={() => { setModalOpen(false); setNameError(''); }} title={editId ? 'Edit Resource' : 'Add Resource'}>
        <Stack>
          <TextInput
            label="Name"
            value={form.name}
            onChange={e => {
              setForm({ ...form, name: e.target.value });
              setNameError('');
            }}
            error={nameError}
            required
          />
          <TextInput
            label="Email"
            placeholder="e.g. john.smith@company.com"
            description="Optional — used for accurate Jira resource matching"
            value={form.email ?? ''}
            onChange={e => setForm({ ...form, email: e.target.value || null })}
          />
          <Select
            label="Jira User"
            placeholder="Search Jira user..."
            description="Map this resource to a Jira display name"
            data={jiraUserOptions}
            value={form.jiraDisplayName}
            onChange={v => {
              const match = (jiraUsers ?? []).find(j => j.displayName === v);
              setForm({ ...form, jiraDisplayName: v || null, jiraAccountId: match?.accountId ?? null });
            }}
            searchable
            clearable
          />
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
          {deleteConfirm === -1 ? (
            <>
              <Text>Are you sure you want to delete {selectedCount} selected resource(s)? This action cannot be undone.</Text>
              <Group>
                <Button variant="default" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button
                  color="red"
                  onClick={() => {
                    const selectedResources = sortedResources.filter(r => selectedIds.has(r.id));
                    selectedResources.forEach(r => {
                      deleteMutation.mutate(r.id, {
                        onSuccess: () => {
                          notifications.show({
                            title: 'Deleted',
                            message: `Resource "${r.name}" deleted`,
                            color: 'red',
                          });
                        },
                      });
                    });
                    setDeleteConfirm(null);
                    clearSelection();
                  }}
                  loading={deleteMutation.isPending}
                >
                  Delete All
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Text>Are you sure you want to delete this resource?</Text>
              <Group>
                <Button variant="default" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button color="red" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} loading={deleteMutation.isPending}>
                  Delete
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
