import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useToast } from '../../../hooks/useToast';
import { useProjects, useCreateProject, useCopyProject, useProjectPodMatrix, useUpdateProject, usePatchProjectStatus, useDeleteProject } from '../../../api/projects';
import { useProjectsHealth } from '../../../api/projectHealth';
import { usePendingApprovals } from '../../../api/projectApprovals';
import type { ProjectPodMatrixResponse, ProjectResponse } from '../../../types';
import type { SourceType } from '../../../types/project';
import { useEffortPatterns } from '../../../api/refData';
import { useJiraInitiatives, useJiraAllProjectsSimple } from '../../../api/jira';
import type { ProjectRequest } from '../../../types';
import apiClient from '../../../api/client';
import { useMonthLabels } from '../../../hooks/useMonthLabels';
import { useTableSort } from '../../../hooks/useTableSort';
import { usePagination } from '../../../hooks/usePagination';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { priorityOptions, BASE_STATUS_OPTIONS, ALL_COLS, DEFAULT_VISIBLE_COLS, EMPTY_FORM, EMPTY_FILTERS, DEFAULT_INITIATIVE_JQL } from '../constants';
import { mapJiraPriorityToPP, filterProjects, filterBoardProjects, calculateProjectStats } from '../utils';
import type { AdvancedFilters, FilterField } from '../../../components/common/AdvancedFilterPanel';
import type { EditableField, AddRowForm, ViewMode, Density } from '../types';

export function useProjectsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { monthLabels } = useMonthLabels();

  // API calls
  const { data: projects, isLoading, error, dataUpdatedAt: projectsUpdatedAt } = useProjects();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const patchStatusMutation = usePatchProjectStatus();
  const copyMutation = useCopyProject();
  const deleteMutation = useDeleteProject();
  const { data: pendingApprovals = [] } = usePendingApprovals();
  const { data: healthData = [] } = useProjectsHealth();
  const { data: effortPatterns } = useEffortPatterns();
  const { data: allJiraProjectsList = [] } = useJiraAllProjectsSimple();

  // Pending approvals
  const pendingProjectIds = useMemo(
    () => new Set(pendingApprovals.map(a => a.projectId)),
    [pendingApprovals]
  );

  // Health data
  const healthByProjectId = useMemo(
    () => new Map(healthData.map(h => [h.projectId, h])),
    [healthData]
  );

  // Row selection + delete confirmation
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<number[] | null>(null);

  const toggleRowSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === pagedProjects.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pagedProjects.map(p => p.id)));
    }
  };

  const confirmDelete = (ids: number[]) => setDeleteTarget(ids);

  const handleDelete = async () => {
    if (!deleteTarget || deleteTarget.length === 0) return;
    let successCount = 0;
    for (const id of deleteTarget) {
      try {
        await deleteMutation.mutateAsync(id);
        successCount++;
      } catch {
        toast.error('Delete failed', `Failed to delete project #${id}`);
      }
    }
    if (successCount > 0) {
      toast.success('Projects deleted', `${successCount} project${successCount !== 1 ? 's' : ''} deleted`);
    }
    setSelectedRows(new Set());
    setDeleteTarget(null);
  };

  // Inline table editing
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [editDateDraft, setEditDateDraft] = useState<Date | null>(null);
  const [editNumberDraft, setEditNumberDraft] = useState<number | null>(null);

  // Inline add-row state
  const [addRowActive, setAddRowActive] = useState(false);
  const [addRowForm, setAddRowForm] = useState<AddRowForm>({
    name: '', priority: 'MEDIUM', owner: '', status: 'ACTIVE', startMonth: 1, durationMonths: 3, defaultPattern: 'Flat',
  });

  // Search/Filter state
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get('view') as ViewMode) || 'table';
  const setViewMode = (v: ViewMode) =>
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('view', v); return next; }, { replace: true });

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [jiraSyncing, setJiraSyncing] = useState(false);
  const [jiraImportOpen, setJiraImportOpen] = useState(false);
  const [jiraImportSearch, setJiraImportSearch] = useState('');
  const [jiraJql, setJiraJql] = useState(DEFAULT_INITIATIVE_JQL);
  const [jiraJqlInput, setJiraJqlInput] = useState(DEFAULT_INITIATIVE_JQL);
  const [jiraSearchEnabled, setJiraSearchEnabled] = useState(true);
  const [jiraSelectedProjects, setJiraSelectedProjects] = useState<string[]>([]);
  const [jiraIssueType, setJiraIssueType] = useState('Initiative');
  const [jiraShowAdvanced, setJiraShowAdvanced] = useState(false);
  const [selectedJiraKeys, setSelectedJiraKeys] = useState<Set<string>>(new Set());
  const [importingCount, setImportingCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const [form, setForm] = useState<ProjectRequest>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string>('');

  // Jira data
  const { data: jiraProjects = [], isLoading: jiraProjectsLoading, isError: jiraProjectsError } = useJiraInitiatives(jiraJql, jiraImportOpen && jiraSearchEnabled);

  const handleJiraSync = async () => {
    setJiraSyncing(true);
    try {
      const res = await apiClient.post('/jira-sync/run');
      const data = res.data as { created?: number; updated?: number; failed?: number };
      notifications.show({
        title: 'Jira sync complete',
        message: `Updated ${data.updated ?? 0} projects, created ${data.created ?? 0} new${data.failed ? `, ${data.failed} failed` : ''}`,
        color: 'teal',
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      notifications.show({ title: 'Sync failed', message: 'Could not reach Jira — check Settings → Integrations', color: 'red' });
    } finally {
      setJiraSyncing(false);
    }
  };

  // Column visibility (persisted to localStorage)
  type VisibleColKey = typeof ALL_COLS[number];
  const [visibleColsArray, setVisibleColsArray] = useLocalStorage<VisibleColKey[]>('pp_projects_visible_cols', DEFAULT_VISIBLE_COLS);
  const visibleCols = new Set<VisibleColKey>(visibleColsArray);
  const toggleCol = (col: VisibleColKey) => {
    const next = new Set<VisibleColKey>(visibleColsArray);
    if (next.has(col)) next.delete(col); else next.add(col);
    setVisibleColsArray(Array.from(next));
  };

  // Row density (persisted to localStorage)
  const [density, setDensity] = useLocalStorage<Density>('pp_projects_density', 'normal');

  // Advanced filters + Saved Views
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Accordion: expanded project rows
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

  // Existing project names for duplicate checking
  const existingNames = useMemo(() => {
    return new Set((projects ?? []).map(p => p.name.toLowerCase()));
  }, [projects]);

  const checkDuplicateName = useCallback((name: string) => {
    if (!name.trim()) return '';
    if (existingNames.has(name.trim().toLowerCase())) {
      return 'A project with this name already exists';
    }
    return '';
  }, [existingNames]);

  const existingJiraKeys = useMemo(() => {
    return new Set((projects ?? []).map(p => p.jiraEpicKey).filter(Boolean) as string[]);
  }, [projects]);

  const importableJiraProjects = useMemo(() => {
    return jiraProjects.filter(jp =>
      !existingJiraKeys.has(jp.key) && !existingNames.has(jp.name.toLowerCase())
    );
  }, [jiraProjects, existingJiraKeys, existingNames]);

  const alreadyImportedJiraProjects = useMemo(() => {
    return jiraProjects.filter(jp =>
      existingJiraKeys.has(jp.key) || existingNames.has(jp.name.toLowerCase())
    );
  }, [jiraProjects, existingJiraKeys, existingNames]);

  const filteredImportableProjects = useMemo(() => {
    const q = jiraImportSearch.trim().toLowerCase();
    if (!q) return importableJiraProjects;
    return importableJiraProjects.filter(jp =>
      jp.key.toLowerCase().includes(q) || jp.name.toLowerCase().includes(q)
    );
  }, [importableJiraProjects, jiraImportSearch]);

  const buildAndRunJql = useCallback((projList: string[], issueType: string, advJql: string) => {
    const parts: string[] = [];
    if (issueType.trim()) parts.push(`issuetype = "${issueType.trim()}"`);
    if (projList.length > 0) {
      const keys = projList.map(k => `"${k}"`).join(', ');
      parts.push(`project in (${keys})`);
    }
    if (advJql.trim()) parts.push(`(${advJql.trim()})`);
    const newJql = (parts.length > 0 ? parts.join(' AND ') : 'issuetype = "Initiative"') + ' ORDER BY created DESC';
    setJiraJql(newJql);
    setJiraJqlInput(newJql);
    setJiraSearchEnabled(true);
    setSelectedJiraKeys(new Set());
    setJiraImportSearch('');
  }, []);

  const toggleJiraKey = (key: string) => {
    setSelectedJiraKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllImportable = () => {
    const filteredKeys = filteredImportableProjects.map(p => p.key);
    const allFilteredSelected = filteredKeys.every(k => selectedJiraKeys.has(k));
    if (allFilteredSelected && filteredKeys.length > 0) {
      setSelectedJiraKeys(prev => {
        const next = new Set(prev);
        filteredKeys.forEach(k => next.delete(k));
        return next;
      });
    } else {
      setSelectedJiraKeys(prev => {
        const next = new Set(prev);
        filteredKeys.forEach(k => next.add(k));
        return next;
      });
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
          priority: mapJiraPriorityToPP(jp.priority),
          owner: jp.assignee || '',
          startMonth: 1,
          durationMonths: 3,
          defaultPattern: 'Flat',
          status: jp.status || 'ACTIVE',
          notes: null,
          startDate: jp.startDate ?? null,
          targetDate: jp.dueDate ?? null,
          client: null,
          sourceType: 'JIRA_SYNCED',
          jiraEpicKey: jp.key,
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
      if (errors.length > 0) {
        toast.warning('Import Complete', `${successCount} imported, ${errors.length} failed`);
      } else {
        toast.success('Import Complete', `${successCount} project${successCount !== 1 ? 's' : ''} imported from Jira`);
      }
    }

    if (errors.length === 0) {
      setJiraImportOpen(false);
      setSelectedJiraKeys(new Set());
      setImportingCount(0);
    }
  };

  // Auto-open modals via query params
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setModalOpen(true);
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('new'); return next; }, { replace: true });
    }
    if (searchParams.get('import') === 'jira') {
      setJiraImportOpen(true);
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('import'); return next; }, { replace: true });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Filter state from URL
  const urlPriority = searchParams.get('priority');
  const urlStatus = searchParams.get('status');
  const urlOwner = searchParams.get('owner');

  const [statusFilter, setStatusFilter] = useState<string>(urlStatus ?? 'ALL');
  const [cardFilter, setCardFilter] = useState<string | null>(
    urlPriority === 'HIGHEST' || urlPriority === 'HIGH' || urlPriority === 'P0' || urlPriority === 'P1' ? 'CRITICAL' : urlStatus && urlStatus !== 'ALL' ? urlStatus : null
  );
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string | null>(urlOwner ?? null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(urlPriority ?? null);
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'ALL' | 'ARCHIVED'>('ALL');

  // Clean up URL params
  useEffect(() => {
    if (urlPriority || urlStatus || urlOwner) {
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('priority');
      cleaned.delete('status');
      cleaned.delete('owner');
      setSearchParams(cleaned, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight support
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

  function applyCardFilter(key: string) {
    if (cardFilter === key) {
      setCardFilter(null);
      setStatusFilter('ALL');
    } else {
      setCardFilter(key);
      if (key === 'ACTIVE' || key === 'ON_HOLD') {
        setStatusFilter(key);
      } else {
        setStatusFilter('ALL');
      }
    }
  }

  function handleSegmentedChange(val: string) {
    setStatusFilter(val);
    setCardFilter(null);
  }

  const ownerOptions = useMemo(() => {
    const owners = [...new Set((projects ?? []).map(p => p.owner).filter(Boolean))].sort();
    return owners.map(o => ({ value: o, label: o }));
  }, [projects]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return filterProjects(projects, { cardFilter, statusFilter, search, ownerFilter, priorityFilter, sourceFilter, advFilters });
  }, [projects, cardFilter, statusFilter, search, ownerFilter, priorityFilter, sourceFilter, advFilters]);

  const boardProjects = useMemo(() => {
    if (!projects) return [];
    return filterBoardProjects(projects, { cardFilter, search, ownerFilter, priorityFilter, advFilters });
  }, [projects, cardFilter, search, ownerFilter, priorityFilter, advFilters]);

  const { sorted: sortedProjects, sortKey, sortDir, onSort } = useTableSort(filtered, 'createdAt', 'desc');
  const { paginatedData: pagedProjects, ...pagination } = usePagination(sortedProjects, 25);

  // Dynamic status options
  const statusOptions = useMemo(() => {
    const base = new Set<string>(BASE_STATUS_OPTIONS.map(o => o.value as string));
    const extras = (projects ?? [])
      .map(p => p.status as string)
      .filter(s => s && !base.has(s))
      .filter((s, i, arr) => arr.indexOf(s) === i);
    return [
      ...BASE_STATUS_OPTIONS,
      ...extras.map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
    ];
  }, [projects]);

  const projectFilterFields = useMemo((): FilterField[] => [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'owner', label: 'Owner', type: 'text' },
    { key: 'priority', label: 'Priority', type: 'multiselect', options: priorityOptions },
    { key: 'status', label: 'Status', type: 'multiselect', options: statusOptions },
    { key: 'client', label: 'Client', type: 'text' },
    { key: 'sourceType', label: 'Source', type: 'select', options: [
      { value: 'MANUAL', label: 'Manual' },
      { value: 'JIRA_SYNCED', label: 'Jira Synced' },
      { value: 'PUSHED_TO_JIRA', label: 'Pushed to Jira' },
    ]},
  ], [statusOptions]);

  const stats = useMemo(() => {
    if (!projects) return { total: 0, active: 0, onHold: 0, p0p1: 0, avgDuration: 0 };
    return calculateProjectStats(projects);
  }, [projects]);

  // Error handler for status changes
  const handleStatusChangeError = useCallback((error: any) => {
    const reason = error?.response?.data?.message ?? error?.response?.data ?? '';
    if (String(reason).includes('APPROVAL_REQUIRED')) {
      toast.warning('Approval required', 'This status change has been submitted for approval. Open the project to track its progress.');
    } else if (String(reason).includes('PENDING_APPROVAL_EXISTS')) {
      toast.warning('Pending approval exists', 'This project already has a pending approval. Resolve it before making another change.');
    } else {
      toast.error('Error', 'Failed to update project status');
    }
  }, [toast]);

  const handleBoardStatusChange = useCallback((projectId: number, newStatus: string) => {
    patchStatusMutation.mutate({ id: projectId, status: newStatus }, {
      onError: handleStatusChangeError,
    });
  }, [patchStatusMutation, handleStatusChangeError]);

  // Inline edit helpers
  const startEdit = (id: number, field: EditableField, currentValue: string | number | null) => {
    setEditingCell({ id, field });
    if (field === 'startDate' || field === 'targetDate') {
      const strVal = typeof currentValue === 'string' ? currentValue : '';
      setEditDateDraft(strVal ? new Date(strVal) : null);
    } else if (field === 'estimatedBudget') {
      setEditNumberDraft(typeof currentValue === 'number' ? currentValue : null);
    } else {
      setEditDraft(String(currentValue ?? ''));
    }
  };

  const commitEdit = (project: ProjectResponse) => {
    if (!editingCell || editingCell.id !== project.id) return;
    const isDateField = editingCell.field === 'startDate' || editingCell.field === 'targetDate';
    const isNumberField = editingCell.field === 'estimatedBudget';
    let updatedStartDate = project.startDate ?? null;
    let updatedTargetDate = project.targetDate ?? null;
    let updated = { ...project };
    if (isDateField) {
      const isoStr = editDateDraft ? editDateDraft.toISOString().split('T')[0] : null;
      if (editingCell.field === 'startDate') updatedStartDate = isoStr;
      else updatedTargetDate = isoStr;
    } else if (isNumberField) {
      updated = { ...project, estimatedBudget: editNumberDraft };
    } else {
      updated = { ...project, [editingCell.field]: editDraft };
    }
    updateMutation.mutate(
      { id: project.id, data: { name: updated.name, priority: updated.priority, owner: updated.owner ?? '', startMonth: updated.startMonth ?? 1, durationMonths: updated.durationMonths ?? 1, defaultPattern: updated.defaultPattern ?? 'Flat', status: updated.status, notes: updated.notes ?? null, startDate: updatedStartDate, targetDate: updatedTargetDate, client: updated.client ?? null } },
      {
        onError: (error: any) => {
          const reason = error?.response?.data?.message ?? error?.response?.data ?? '';
          if (String(reason).includes('APPROVAL_REQUIRED')) {
            toast.warning('Approval required', 'This change has been submitted for approval. Open the project to track its progress.');
          } else if (String(reason).includes('PENDING_APPROVAL_EXISTS')) {
            toast.warning('Pending approval exists', 'This project already has a pending approval. Resolve it first.');
          } else {
            toast.error('Save failed', 'Failed to save change');
          }
        },
      }
    );
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const submitAddRow = () => {
    if (!addRowForm.name.trim()) { setAddRowActive(false); return; }
    createMutation.mutate(
      { name: addRowForm.name.trim(), priority: addRowForm.priority, owner: addRowForm.owner, startMonth: addRowForm.startMonth, durationMonths: addRowForm.durationMonths, defaultPattern: addRowForm.defaultPattern, status: addRowForm.status, notes: null, startDate: null, targetDate: null, client: null },
      {
        onSuccess: () => {
          setAddRowActive(false);
          setAddRowForm({ name: '', priority: 'MEDIUM', owner: '', status: 'ACTIVE', startMonth: 1, durationMonths: 3, defaultPattern: 'Flat' });
          toast.success('Project created', 'New project added to the portfolio');
        },
        onError: (err: any) => toast.error('Create failed', err?.response?.data?.message || 'Failed to create project'),
      }
    );
  };

  const handleCreate = () => {
    const dupError = checkDuplicateName(form.name);
    if (dupError) {
      setNameError(dupError);
      return;
    }
    setNameError('');
    createMutation.mutate(form, {
      onSuccess: () => {
        setModalOpen(false);
        setForm(EMPTY_FORM);
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

  return {
    // Data loading
    isLoading,
    error,
    projectsUpdatedAt,
    projects,
    monthLabels,
    toast,

    // Mutations
    createMutation,
    updateMutation,
    patchStatusMutation,
    copyMutation,
    deleteMutation,

    // Pending approvals and health
    pendingProjectIds,
    healthByProjectId,

    // Row selection
    selectedRows,
    setSelectedRows,
    toggleRowSelect,
    toggleSelectAll,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    handleDelete,

    // Inline editing
    editingCell,
    setEditingCell,
    editDraft,
    setEditDraft,
    editDateDraft,
    setEditDateDraft,
    editNumberDraft,
    setEditNumberDraft,
    startEdit,
    commitEdit,
    cancelEdit,

    // Add row
    addRowActive,
    setAddRowActive,
    addRowForm,
    setAddRowForm,
    submitAddRow,
    effortPatterns,

    // View mode
    viewMode,
    setViewMode,

    // Modals
    modalOpen,
    setModalOpen,
    jiraSyncing,
    handleJiraSync,
    jiraImportOpen,
    setJiraImportOpen,
    form,
    setForm,
    nameError,
    setNameError,
    handleCreate,

    // Jira import
    jiraImportSearch,
    setJiraImportSearch,
    jiraJql,
    setJiraJql,
    jiraJqlInput,
    setJiraJqlInput,
    jiraSearchEnabled,
    setJiraSearchEnabled,
    jiraSelectedProjects,
    setJiraSelectedProjects,
    jiraIssueType,
    setJiraIssueType,
    jiraShowAdvanced,
    setJiraShowAdvanced,
    selectedJiraKeys,
    setSelectedJiraKeys,
    toggleJiraKey,
    toggleAllImportable,
    importingCount,
    setImportingCount,
    importedCount,
    setImportedCount,
    importErrors,
    setImportErrors,
    jiraProjects,
    jiraProjectsLoading,
    jiraProjectsError,
    allJiraProjectsList,
    importableJiraProjects,
    alreadyImportedJiraProjects,
    filteredImportableProjects,
    buildAndRunJql,
    handleJiraImport,

    // Column visibility
    visibleColsArray,
    setVisibleColsArray,
    visibleCols,
    toggleCol,

    // Row density
    density,
    setDensity,

    // Advanced filters
    advFilters,
    setAdvFilters,
    activeViewId,
    setActiveViewId,

    // Expanded rows
    expandedRows,
    toggleExpand,

    // Pod matrix
    podsByProject,

    // Existing names
    existingNames,
    checkDuplicateName,

    // Filtering and sorting
    statusFilter,
    setStatusFilter,
    cardFilter,
    setCardFilter,
    search,
    setSearch,
    ownerFilter,
    setOwnerFilter,
    priorityFilter,
    setPriorityFilter,
    sourceFilter,
    setSourceFilter,
    applyCardFilter,
    handleSegmentedChange,
    ownerOptions,
    filtered,
    boardProjects,
    sortedProjects,
    sortKey,
    sortDir,
    onSort: onSort,
    pagedProjects,
    pagination,
    statusOptions,
    projectFilterFields,
    stats,

    // Highlight
    highlightId,
    highlightRowRef,
    flashId,
    setFlashId,

    // Status change
    handleBoardStatusChange,

    // Utilities
    navigate,
  };
}
