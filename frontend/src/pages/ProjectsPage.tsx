import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button, Group, Table, Modal, TextInput, Select, MultiSelect, NumberInput, Textarea, Stack, Text, SegmentedControl, SimpleGrid, ActionIcon, Tooltip,
ScrollArea, ThemeIcon, Badge, Checkbox, Alert, Loader, Divider, Tabs, Box, Popover, Switch, Skeleton, Collapse,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { AQUA, AQUA_HEX, AQUA_TINTS, BORDER_STRONG, COLOR_AMBER, COLOR_BLUE, COLOR_BLUE_LIGHT, COLOR_ERROR, COLOR_ERROR_STRONG, COLOR_SUCCESS, COLOR_VIOLET_ALT, COLOR_VIOLET_LIGHT, COLOR_WARNING, DEEP_BLUE, DEEP_BLUE_HEX, FONT_FAMILY, TEXT_SUBTLE} from '../brandTokens';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useToast } from '../hooks/useToast';
import { IconPlus, IconBriefcase, IconFlame, IconClock, IconAlertTriangle, IconSearch, IconCopy, IconPlugConnected, IconDownload, IconCheck, IconX, IconLayoutList, IconLayoutKanban, IconChevronRight, IconChevronDown, IconColumns, IconHexagons, IconTicket, IconPencil, IconCloudUpload, IconTrash, IconTimeline, IconRefresh } from '@tabler/icons-react';
import { useProjects, useCreateProject, useCopyProject, useProjectPodMatrix, useUpdateProject, usePatchProjectStatus, useDeleteProject } from '../api/projects';
import { useProjectsHealth } from '../api/projectHealth';
import HealthBadge from '../components/common/HealthBadge';
import { usePendingApprovals } from '../api/projectApprovals';
import type { ProjectPodMatrixResponse, ProjectResponse } from '../types';
import ProjectSourceBadge from '../components/projects/ProjectSourceBadge';
import ProjectFlagChips from '../components/projects/ProjectFlagChips';
import type { SourceType } from '../types/project';
import { useEffortPatterns } from '../api/refData';
import { useJiraInitiatives, DEFAULT_INITIATIVE_JQL, useJiraAllProjectsSimple } from '../api/jira';
import KanbanBoardView from '../components/projects/KanbanBoardView';
import GanttView from '../components/projects/GanttView';
import { Priority, ProjectStatus } from '../types';
import type { ProjectRequest } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import SavedViews from '../components/common/SavedViews';
import FilterPills from '../components/common/FilterPills';
import AdvancedFilterPanel, { applyAdvancedFilters } from '../components/common/AdvancedFilterPanel';
import type { AdvancedFilters, FilterField } from '../components/common/AdvancedFilterPanel';
import PriorityBadge from '../components/common/PriorityBadge';
import SummaryCard from '../components/charts/SummaryCard';
import { PageInsightCard } from '../components/common/PageInsightCard';
import SortableHeader from '../components/common/SortableHeader';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageError from '../components/common/PageError';
import apiClient from '../api/client';
import TablePagination from '../components/common/TablePagination';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTableSort } from '../hooks/useTableSort';
import { usePagination } from '../hooks/usePagination';
import { formatProjectDate } from '../utils/formatting';
import EmptyState from '../components/common/EmptyState';
import { IconBriefcase as IconBriefcaseEmpty, IconFilter } from '@tabler/icons-react';

const PRIORITY_LABELS: Record<string, string> = {
  HIGHEST: 'Highest', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
  LOWEST: 'Lowest', BLOCKER: 'Blocker', MINOR: 'Minor',
};
const priorityOptions = Object.values(Priority).map(p => ({ value: p, label: PRIORITY_LABELS[p] ?? p }));
// Base enum statuses — custom project statuses discovered from data are appended at runtime
const BASE_STATUS_OPTIONS = Object.values(ProjectStatus).map(s => ({ value: s, label: s.replace(/_/g, ' ') }));

/**
 * Classify a project for the status tabs.
 * Jira-synced projects store the raw Jira status string in `status` and
 * may have `jiraStatusCategory` set. Older imports may have category=null,
 * so we fall back to keyword matching on the raw status string.
 */
function projectMatchesTab(
  p: { status: string; jiraStatusCategory?: string | null; sourceType?: string | null },
  tab: string,
): boolean {
  const cat  = p.jiraStatusCategory;
  const raw  = (p.status ?? '').toUpperCase();
  const isJira = p.sourceType === 'JIRA_SYNCED' || p.sourceType === 'PUSHED_TO_JIRA';

  switch (tab) {
    case ProjectStatus.ACTIVE:
      // PP enum match, Jira category "indeterminate", or Jira raw active patterns
      return (
        p.status === ProjectStatus.ACTIVE ||
        cat === 'indeterminate' ||
        (isJira && cat == null && /ACTIVE|IN.PROGRESS|IN.DEV|DEVELOPMENT|TESTING|REVIEW|ONGOING|IMPLEMENTATION|WIP|STARTED|PROGRES/.test(raw))
      );

    case ProjectStatus.COMPLETED:
      return (
        p.status === ProjectStatus.COMPLETED ||
        cat === 'done' ||
        (isJira && cat == null && /DONE|COMPLET|CLOSED|RELEASED|SHIPPED|RESOLVED|FINISH/.test(raw))
      );

    case ProjectStatus.NOT_STARTED:
      return (
        p.status === ProjectStatus.NOT_STARTED ||
        cat === 'new' ||
        (isJira && cat == null && /NOT.START|NEW|BACKLOG|OPEN|TODO|TO.DO|FUNNEL|DRAFT/.test(raw))
      );

    case ProjectStatus.ON_HOLD:
      return (
        p.status === ProjectStatus.ON_HOLD ||
        /HOLD|PAUSED|BLOCKED|DEFERRED|PARKED|SUSPEND|WAIT/.test(raw)
      );

    case ProjectStatus.CANCELLED:
      return (
        p.status === ProjectStatus.CANCELLED ||
        /CANCEL|REJECT|ABANDON|SCRAP/.test(raw)
      );

    case ProjectStatus.IN_DISCOVERY:
      return (
        p.status === ProjectStatus.IN_DISCOVERY ||
        /DISCOVERY|PLANNING|SCOPING|INCEPTION|ASSESS/.test(raw)
      );

    default:
      return p.status === tab;
  }
}

const emptyForm: ProjectRequest = {
  name: '',
  priority: Priority.MEDIUM,
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
  const toast = useToast();
  const isDark = useDarkMode();
  const { data: projects, isLoading, error, dataUpdatedAt: projectsUpdatedAt } = useProjects();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const patchStatusMutation = usePatchProjectStatus();
  const copyMutation = useCopyProject();
  const deleteMutation = useDeleteProject();

  // Track which projects have pending approvals for the badge
  const { data: pendingApprovals = [] } = usePendingApprovals();
  const pendingProjectIds = useMemo(
    () => new Set(pendingApprovals.map(a => a.projectId)),
    [pendingApprovals]
  );

  const { data: healthData = [] } = useProjectsHealth();
  const healthByProjectId = useMemo(
    () => new Map(healthData.map(h => [h.projectId, h])),
    [healthData]
  );

  // ── Row selection + delete confirmation ───────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<number[] | null>(null); // null = closed

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

  // ── Inline table editing ──────────────────────────────────────────────
  type EditableField = 'name' | 'owner' | 'priority' | 'status' | 'startDate' | 'targetDate' | 'estimatedBudget';
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [editDateDraft, setEditDateDraft] = useState<Date | null>(null);
  const [editNumberDraft, setEditNumberDraft] = useState<number | null>(null);
  // Inline add-row state
  const [addRowActive, setAddRowActive] = useState(false);
  const [addRowForm, setAddRowForm] = useState<{ name: string; priority: string; owner: string; status: string; startMonth: number; durationMonths: number; defaultPattern: string }>({
    name: '', priority: 'MEDIUM', owner: '', status: 'ACTIVE', startMonth: 1, durationMonths: 3, defaultPattern: 'Flat',
  });
  const { data: effortPatterns } = useEffortPatterns();
  const navigate = useNavigate();
  const { monthLabels } = useMonthLabels();
  // ── Jira → PP mapping helpers ────────────────────────────────────────────
  const mapJiraPriorityToPP = (jiraPriority?: string): Priority => {
    switch ((jiraPriority ?? '').trim().toUpperCase()) {
      case 'HIGHEST': case 'CRITICAL': case 'BLOCKER': return Priority.HIGHEST;
      case 'HIGH':    return Priority.HIGH;
      case 'LOW':     return Priority.LOW;
      case 'LOWEST':  case 'TRIVIAL': return Priority.LOWEST;
      default:        return Priority.MEDIUM;
    }
  };

  const mapJiraStatusToPP = (statusName?: string, categoryKey?: string): ProjectStatus => {
    const s = (statusName ?? '').trim().toUpperCase();
    switch (s) {
      case 'BACKLOG': case 'FUNNEL': case 'READY': case 'TO DO': case 'TODO':
      case 'OPEN': case 'SELECTED FOR DEVELOPMENT': case 'READY FOR DEV':
      case 'READY FOR DEVELOPMENT': case 'READY TO START': case 'PLANNING':
      case 'PROPOSED': case 'DISCOVERY': case 'IDEATION': case 'DRAFT':
      case 'NEW': case 'IN SCOPING':
        return ProjectStatus.NOT_STARTED;
      case 'IN PROGRESS': case 'IN-PROGRESS': case 'REVIEW': case 'IN DEVELOPMENT':
      case 'IN REVIEW': case 'IN-REVIEW': case 'CODE REVIEW': case 'TESTING':
      case 'IN TESTING': case 'QA': case 'IN QA': case 'UAT': case 'ACTIVE':
      case 'UNDER REVIEW': case 'PEER REVIEW': case 'TECH REVIEW':
      case 'STEERING COMMITTEE REVIEW': case 'TECHNOLOGY REVIEW':
      case 'COMPLIANCE REVIEW': case 'ONGOING': case 'DEVELOPMENT':
      case 'IMPLEMENTATION': case 'READY FOR QA': case 'READY FOR REVIEW':
        return ProjectStatus.ACTIVE;
      case 'DONE': case 'CLOSED': case 'RESOLVED': case 'COMPLETED':
      case 'RELEASED': case 'DEPLOYED': case 'MERGED': case 'FINISHED':
        return ProjectStatus.COMPLETED;
      case 'BLOCKED': case 'ON HOLD': case 'ON-HOLD': case 'HOLD':
      case 'HOLD/PAUSED': case 'ON PAUSE': case 'PAUSED': case 'WAITING':
      case 'DEFERRED': case 'PARKED': case 'SUSPENDED': case 'PENDING':
        return ProjectStatus.ON_HOLD;
      case 'CANCELLED': case 'CANCELED': case 'REJECTED': case 'WONT DO':
      case 'ABANDONED': case 'WITHDRAWN':
        return ProjectStatus.CANCELLED;
      default: break;
    }
    // Fall back to category key
    switch ((categoryKey ?? '').toLowerCase()) {
      case 'new':  return ProjectStatus.NOT_STARTED;
      case 'done': return ProjectStatus.COMPLETED;
      default:     return ProjectStatus.ACTIVE;
    }
  };

  // viewMode persisted in URL query param (?view=table|board|gantt) so it survives navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get('view') as 'table' | 'board' | 'gantt') || 'table';
  const setViewMode = (v: 'table' | 'board' | 'gantt') =>
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('view', v); return next; }, { replace: true });
  const [modalOpen, setModalOpen] = useState(false);
  const [jiraSyncing, setJiraSyncing] = useState(false);
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
  const [jiraImportOpen, setJiraImportOpen] = useState(false);
  const [jiraImportSearch, setJiraImportSearch] = useState('');
  const [jiraJql, setJiraJql] = useState(DEFAULT_INITIATIVE_JQL);
  const [jiraJqlInput, setJiraJqlInput] = useState(DEFAULT_INITIATIVE_JQL);
  const [jiraSearchEnabled, setJiraSearchEnabled] = useState(true);
  const [jiraSelectedProjects, setJiraSelectedProjects] = useState<string[]>([]);
  const [jiraIssueType, setJiraIssueType] = useState('Initiative');
  const [jiraShowAdvanced, setJiraShowAdvanced] = useState(false);
  const { data: allJiraProjectsList = [] } = useJiraAllProjectsSimple();
  const { data: jiraProjects = [], isLoading: jiraProjectsLoading, isError: jiraProjectsError } = useJiraInitiatives(jiraJql, jiraImportOpen && jiraSearchEnabled);
  const [selectedJiraKeys, setSelectedJiraKeys] = useState<Set<string>>(new Set());
  const [importingCount, setImportingCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [form, setForm] = useState<ProjectRequest>(emptyForm);
  const [nameError, setNameError] = useState<string>('');

  // ── Column visibility (persisted to localStorage) ────────────────────
  const ALL_COLS = ['#', 'Priority', 'Owner', 'Start', 'End', 'Duration', 'Pattern', 'Status', 'Budget', 'Health', 'Created'] as const;
  type ColKey = typeof ALL_COLS[number];
  const DEFAULT_VISIBLE_ARRAY: ColKey[] = ['#', 'Priority', 'Owner', 'Start', 'End', 'Status'];
  const [visibleColsArray, setVisibleColsArray] = useLocalStorage<ColKey[]>('pp_projects_visible_cols', DEFAULT_VISIBLE_ARRAY);
  const visibleCols = new Set<ColKey>(visibleColsArray);
  const toggleCol = (col: ColKey) => {
    const next = new Set<ColKey>(visibleColsArray);
    if (next.has(col)) next.delete(col); else next.add(col);
    setVisibleColsArray(Array.from(next) as ColKey[]);
  };

  // ── Row density (persisted to localStorage) ──────────────────────────
  type Density = 'compact' | 'normal' | 'comfortable';
  const [density, setDensity] = useLocalStorage<Density>('pp_projects_density', 'normal');
  const densitySpacing: Record<Density, string> = { compact: 'xs', normal: 'sm', comfortable: 'md' };

  // ── Sprint 9: Advanced filters + Saved Views ──────────────────────────
  const EMPTY_ADV: AdvancedFilters = { logic: 'AND', conditions: [] };
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_ADV);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

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

  // Existing jiraEpicKeys for deduplication (key-based is more reliable than name-based)
  const existingJiraKeys = useMemo(() => {
    return new Set((projects ?? []).map(p => p.jiraEpicKey).filter(Boolean) as string[]);
  }, [projects]);

  // Jira issues not already in portfolio — check by jiraEpicKey first, fallback to name
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

  // Build JQL from project picker + issue type — called when user clicks Search
  const buildAndRunJql = useCallback((projects: string[], issueType: string, advJql: string) => {
    const parts: string[] = [];
    if (issueType.trim()) parts.push(`issuetype = "${issueType.trim()}"`);
    if (projects.length > 0) {
      const keys = projects.map(k => `"${k}"`).join(', ');
      parts.push(`project in (${keys})`);
    }
    if (advJql.trim()) parts.push(`(${advJql.trim()})`);
    const jql = (parts.length > 0 ? parts.join(' AND ') : 'issuetype = "Initiative"') + ' ORDER BY created DESC';
    setJiraJql(jql);
    setJiraJqlInput(jql);
    setJiraSearchEnabled(true);
    setSelectedJiraKeys(new Set());
    setJiraImportSearch('');
  }, []);

  const toggleJiraKey = (key: string) => {
    setSelectedJiraKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
          // Store the raw Jira status string so it shows as-is in the UI.
          // jiraStatusCategory will be populated on the next epic sync.
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
  // Auto-open Add Project modal when navigated here with ?new=true (e.g. from sidebar + button)
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

  // Read initial filter values from URL query params (e.g., /projects?priority=P0&status=ACTIVE)
  const urlPriority = searchParams.get('priority');
  const urlStatus = searchParams.get('status');
  const urlOwner = searchParams.get('owner');

  const [statusFilter, setStatusFilter]   = useState<string>(urlStatus ?? 'ALL');
  const [cardFilter, setCardFilter]       = useState<string | null>(
    urlPriority === 'HIGHEST' || urlPriority === 'HIGH' || urlPriority === 'P0' || urlPriority === 'P1' ? 'CRITICAL' : urlStatus && urlStatus !== 'ALL' ? urlStatus : null
  );
  const [search, setSearch]               = useState('');
  const [ownerFilter, setOwnerFilter]     = useState<string | null>(urlOwner ?? null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(urlPriority ?? null);
  const [sourceFilter, setSourceFilter]   = useState<SourceType | 'ALL' | 'ARCHIVED'>('ALL');

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
        setStatusFilter('ALL'); // CRITICAL is priority-based
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
    // Source filter: ARCHIVED shows only archived; others hide archived by default
    if (sourceFilter === 'ARCHIVED') {
      list = list.filter(p => p.archived);
    } else {
      list = list.filter(p => !p.archived);
      if (sourceFilter !== 'ALL') {
        list = list.filter(p => p.sourceType === sourceFilter);
      }
    }
    if (cardFilter === 'CRITICAL') {
      list = list.filter(p => p.priority === Priority.HIGHEST || p.priority === Priority.HIGH || p.priority === Priority.BLOCKER);
    } else if (statusFilter !== 'ALL') {
      // Use the shared classifier so tabs and cards are always consistent
      list = list.filter(p => projectMatchesTab(p, statusFilter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
    if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);
    // Apply advanced AND/OR filters last
    list = applyAdvancedFilters(list as unknown as Record<string, unknown>[], advFilters) as unknown as typeof list;
    return list;
  }, [projects, cardFilter, statusFilter, search, ownerFilter, priorityFilter, sourceFilter, advFilters]);

  // Board view ignores the status segment filter — columns already group by status.
  // Only apply search + owner + priority filters so all status columns show correctly.
  const boardProjects = useMemo(() => {
    let list = projects ?? [];
    if (cardFilter === 'CRITICAL') {
      list = list.filter(p => p.priority === Priority.HIGHEST || p.priority === Priority.HIGH || p.priority === Priority.BLOCKER);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (ownerFilter) list = list.filter(p => p.owner === ownerFilter);
    if (priorityFilter) list = list.filter(p => p.priority === priorityFilter);
    list = applyAdvancedFilters(list as unknown as Record<string, unknown>[], advFilters) as unknown as typeof list;
    return list;
  }, [projects, cardFilter, search, ownerFilter, priorityFilter, advFilters]);

  const { sorted: sortedProjects, sortKey, sortDir, onSort } = useTableSort(filtered, 'createdAt', 'desc');
  const { paginatedData: pagedProjects, ...pagination } = usePagination(sortedProjects, 25);

  // Dynamic status options — includes any custom statuses found in loaded projects (must be before projectFilterFields)
  const statusOptions = useMemo(() => {
    const base = new Set<string>(BASE_STATUS_OPTIONS.map(o => o.value as string));
    const extras = (projects ?? [])
      .map(p => p.status as string)
      .filter(s => s && !base.has(s))
      .filter((s, i, arr) => arr.indexOf(s) === i); // unique
    return [
      ...BASE_STATUS_OPTIONS,
      ...extras.map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
    ];
  }, [projects]);

  // ── Advanced filter field definitions for Projects ───────────────────
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
    // Exclude archived projects — consistent with the table's default view
    const all = (projects ?? []).filter(p => !p.archived);
    const active  = all.filter(p => projectMatchesTab(p, ProjectStatus.ACTIVE)).length;
    const onHold  = all.filter(p => projectMatchesTab(p, ProjectStatus.ON_HOLD)).length;
    const critical = all.filter(p => p.priority === Priority.HIGHEST || p.priority === Priority.HIGH || p.priority === Priority.BLOCKER).length;
    const avgDuration = all.length > 0 ? Math.round(all.reduce((s, p) => s + p.durationMonths, 0) / all.length * 10) / 10 : 0;
    return { total: all.length, active, onHold, p0p1: critical, avgDuration };
  }, [projects]);

  // ── Shared approval-required error handler ────────────────────────────
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

  // ── Board drag-and-drop status change ────────────────────────────────
  const handleBoardStatusChange = useCallback((projectId: number, newStatus: string) => {
    patchStatusMutation.mutate({ id: projectId, status: newStatus }, {
      onError: handleStatusChangeError,
    });
  }, [patchStatusMutation, handleStatusChangeError]);

  // ── Inline cell editing helpers ───────────────────────────────────────
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
    let updatedBudget = project.estimatedBudget ?? null;
    let updated = { ...project };
    if (isDateField) {
      const isoStr = editDateDraft ? editDateDraft.toISOString().split('T')[0] : null;
      if (editingCell.field === 'startDate') updatedStartDate = isoStr;
      else updatedTargetDate = isoStr;
    } else if (isNumberField) {
      updatedBudget = editNumberDraft;
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

  // ── Inline add-row submit ─────────────────────────────────────────────
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
    <PPPageLayout
      title="Projects"
      animate
      dataUpdatedAt={projectsUpdatedAt}
      actions={
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
              <Tabs.Tab value="gantt" leftSection={<IconTimeline size={14} />}>Timeline</Tabs.Tab>
            </Tabs.List>
          </Tabs>
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
          <Button
            variant="filled"
            leftSection={<IconRefresh size={16} />}
            loading={jiraSyncing}
            onClick={handleJiraSync}
            style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
          >
            Sync from Jira
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>Add Project</Button>
        </Group>
      }
    >
      <PageInsightCard pageKey="projects" data={projects} />
      <Stack gap={16} className="stagger-children">
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} className="stagger-grid">
        <SummaryCard
          title="Total Projects"
          value={stats.total}
          icon={<IconBriefcase size={20} color={COLOR_BLUE_LIGHT} />}
          onClick={() => { setCardFilter(null); setStatusFilter('ALL'); }}
          active={cardFilter === null && statusFilter === 'ALL'}
          filterLabel={null}
        />
        <SummaryCard
          title="Active"
          value={stats.active}
          icon={<IconFlame size={20} color={COLOR_SUCCESS} />}
          onClick={() => applyCardFilter('ACTIVE')}
          active={cardFilter === 'ACTIVE'}
        />
        <SummaryCard
          title="On Hold"
          value={stats.onHold}
          icon={<IconAlertTriangle size={20} color={COLOR_AMBER} />}
          color={stats.onHold > 0 ? 'yellow' : undefined}
          onClick={() => applyCardFilter('ON_HOLD')}
          active={cardFilter === 'ON_HOLD'}
        />
        <SummaryCard
          title="Critical"
          value={stats.p0p1}
          icon={<IconFlame size={20} color={COLOR_ERROR} />}
          color={stats.p0p1 > 0 ? 'red' : undefined}
          onClick={() => applyCardFilter('CRITICAL')}
          active={cardFilter === 'CRITICAL'}
        />
        <SummaryCard
          title="Avg Duration"
          value={`${stats.avgDuration}m`}
          icon={<IconClock size={20} color={COLOR_VIOLET_LIGHT} />}
        />
      </SimpleGrid>

      {viewMode === 'table' && (
        <SegmentedControl
          value={statusFilter}
          onChange={handleSegmentedChange}
          data={[
            { value: 'ALL', label: 'All' },
            ...BASE_STATUS_OPTIONS,
          ]}
        />
      )}

      {/* ── Source filter pills ── */}
      <Group gap="xs">
        {([
          { key: 'ALL',            label: 'All Sources',     color: 'gray',   icon: null },
          { key: 'MANUAL',         label: 'Manual',          color: 'blue',   icon: <IconPencil size={11} /> },
          { key: 'JIRA_SYNCED',    label: 'Jira Synced',     color: 'teal',   icon: <IconTicket size={11} /> },
          { key: 'PUSHED_TO_JIRA', label: 'Pushed to Jira',  color: 'violet', icon: <IconCloudUpload size={11} /> },
          { key: 'ARCHIVED',       label: 'Archived',        color: 'gray',   icon: null },
        ] as const).map(pill => (
          <Badge
            key={pill.key}
            size="sm"
            color={pill.color}
            variant={sourceFilter === pill.key ? 'filled' : 'light'}
            leftSection={pill.icon}
            style={{ cursor: 'pointer' }}
            onClick={() => setSourceFilter(pill.key as SourceType | 'ALL' | 'ARCHIVED')}
          >
            {pill.label}
          </Badge>
        ))}
      </Group>

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
        {/* Advanced filter builder */}
        <AdvancedFilterPanel
          fields={projectFilterFields}
          value={advFilters}
          onChange={setAdvFilters}
        />
        {(search || ownerFilter || priorityFilter || advFilters.conditions.length > 0) && (
          <Button variant="subtle" color="gray" size="sm"
            onClick={() => { setSearch(''); setOwnerFilter(null); setPriorityFilter(null); setAdvFilters(EMPTY_ADV); setActiveViewId(null); }}>
            Clear all
          </Button>
        )}
        <Text size="sm" c="dimmed" ml="auto">
          {filtered.length} of {(projects ?? []).length} projects
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
        <Popover width={200} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <Tooltip label="Toggle columns">
              <ActionIcon variant="light" size="sm" color="gray">
                <IconColumns size={14} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="xs" fw={600} mb="xs" style={{ color: 'var(--pp-text)', fontFamily: FONT_FAMILY }}>Visible Columns</Text>
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

      {/* ── Saved view tabs (Sprint 9) ───────────────────────────────── */}
      <SavedViews
        pageKey="projects"
        variant="tabs"
        activeViewId={activeViewId}
        onActiveViewChange={setActiveViewId}
        currentFilters={{
          search: search || null,
          ownerFilter: ownerFilter,
          priorityFilter: priorityFilter,
          statusFilter: statusFilter !== 'ALL' ? statusFilter : null,
          sourceFilter: sourceFilter !== 'ALL' ? sourceFilter : null,
          advFilters: advFilters.conditions.length > 0 ? JSON.stringify(advFilters) : null,
        }}
        onApply={v => {
          setSearch(v.search ?? '');
          setOwnerFilter(v.ownerFilter ?? null);
          setPriorityFilter(v.priorityFilter ?? null);
          setStatusFilter(v.statusFilter ?? 'ALL');
          setSourceFilter((v.sourceFilter ?? 'ALL') as SourceType | 'ALL' | 'ARCHIVED');
          if (v.advFilters) { try { setAdvFilters(JSON.parse(v.advFilters)); } catch { setAdvFilters(EMPTY_ADV); } }
          else setAdvFilters(EMPTY_ADV);
          setCardFilter(null);
        }}
      />

      {/* ── Active filter pills (Sprint 9) ──────────────────────────── */}
      <FilterPills
        onClearAll={() => { setSearch(''); setOwnerFilter(null); setPriorityFilter(null); setStatusFilter('ALL'); setSourceFilter('ALL'); setAdvFilters(EMPTY_ADV); setActiveViewId(null); setCardFilter(null); }}
        pills={[
          ...(search ? [{ key: 'search', label: `Name: "${search}"`, color: 'blue', onRemove: () => setSearch('') }] : []),
          ...(ownerFilter ? [{ key: 'owner', label: `Owner: ${ownerFilter}`, color: 'teal', onRemove: () => setOwnerFilter(null) }] : []),
          ...(priorityFilter ? [{ key: 'priority', label: `Priority: ${priorityFilter}`, color: 'orange', onRemove: () => setPriorityFilter(null) }] : []),
          ...(statusFilter !== 'ALL' ? [{ key: 'status', label: `Status: ${statusFilter.replace(/_/g, ' ')}`, color: 'violet', onRemove: () => setStatusFilter('ALL') }] : []),
          ...(cardFilter === 'CRITICAL' ? [{ key: 'critical', label: 'Priority: Critical (Highest / High / Blocker)', color: 'red', onRemove: () => setCardFilter(null) }] : []),
          ...advFilters.conditions
            .filter(c => Array.isArray(c.value) ? c.value.length > 0 : c.value !== '')
            .map(c => {
              const field = projectFilterFields.find(f => f.key === c.fieldKey);
              const valLabel = Array.isArray(c.value) ? c.value.join(', ') : c.value;
              return {
                key: c.id,
                label: `${field?.label ?? c.fieldKey}: ${valLabel}`,
                color: 'grape',
                onRemove: () => setAdvFilters(prev => ({ ...prev, conditions: prev.conditions.filter(x => x.id !== c.id) })),
              };
            }),
        ]}
      />

      {/* ── Bulk-selection action bar ── */}
      {selectedRows.size > 0 && viewMode === 'table' && (
        <Group
          gap="sm"
          p="xs"
          style={{
            background: isDark ? 'var(--mantine-color-dark-6)' : '#fff8f8',
            border: '1px solid var(--mantine-color-red-3)',
            borderRadius: 8,
          }}
        >
          <Text size="sm" fw={600} c="red">
            {selectedRows.size} project{selectedRows.size !== 1 ? 's' : ''} selected
          </Text>
          <Button
            size="xs"
            color="red"
            variant="light"
            leftSection={<IconTrash size={13} />}
            onClick={() => confirmDelete(Array.from(selectedRows))}
          >
            Delete selected
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => setSelectedRows(new Set())}
          >
            Clear selection
          </Button>
        </Group>
      )}

      {viewMode === 'table' && (
        <>
          <ScrollArea>
            <Table fz={density === 'comfortable' ? 'sm' : 'xs'} verticalSpacing={densitySpacing[density]} highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  {/* Select-all checkbox */}
                  <Table.Th style={{ width: 36 }}>
                    <Checkbox
                      size="xs"
                      checked={pagedProjects.length > 0 && selectedRows.size === pagedProjects.length}
                      indeterminate={selectedRows.size > 0 && selectedRows.size < pagedProjects.length}
                      onChange={toggleSelectAll}
                      onClick={e => e.stopPropagation()}
                    />
                  </Table.Th>
                  {/* Expand chevron */}
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
                  {visibleCols.has('Budget') && <Table.Th style={{ whiteSpace: 'nowrap' }}>Est. Budget</Table.Th>}
                  {visibleCols.has('Health') && <Table.Th style={{ whiteSpace: 'nowrap' }}>Health</Table.Th>}
                  {visibleCols.has('Created') && <SortableHeader sortKey="createdAt" currentKey={sortKey} dir={sortDir} onSort={onSort}>Created</SortableHeader>}
                  <Table.Th style={{ width: 110 }}>Source</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pagedProjects.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={13} style={{ padding: '0' }}>
                      {/* PP-13 §7: standardised empty state — distinguishes "no data" from "filtered empty" */}
                      {(projects ?? []).length === 0 ? (
                        <EmptyState
                          icon={<IconBriefcaseEmpty size={40} />}
                          title="No projects yet"
                          description="Create your first project to start planning and tracking work across your portfolio."
                          action={{
                            label: '+ Create Project',
                            onClick: () => setModalOpen(true),
                            variant: 'filled',
                            color: 'teal',
                          }}
                          secondaryAction={{
                            label: 'Import from Jira',
                            onClick: () => setJiraImportOpen(true),
                            variant: 'light',
                          }}
                          tips={['Tip: use ⌘K to quickly jump to any project', 'Set up Jira integration to auto-sync epics and sprints']}
                          size="lg"
                        />
                      ) : (
                        <EmptyState
                          icon={<IconFilter size={36} />}
                          title="No projects match your filters"
                          description="Try adjusting or clearing the filters above."
                          action={{
                            label: 'Clear all filters',
                            onClick: () => {
                              setSearch('');
                              setStatusFilter('ALL');
                              setOwnerFilter(null);
                              setPriorityFilter(null);
                              setSourceFilter('ALL');
                              setAdvFilters(EMPTY_ADV);
                            },
                            variant: 'light',
                            color: 'gray',
                          }}
                          size="md"
                        />
                      )}
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
                        {/* Row checkbox */}
                        <Table.Td style={{ padding: '8px 6px' }} onClick={e => toggleRowSelect(p.id, e)}>
                          <Checkbox
                            size="xs"
                            checked={selectedRows.has(p.id)}
                            onChange={() => {}}
                            onClick={e => e.stopPropagation()}
                          />
                        </Table.Td>
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
                        <Table.Td fw={600} style={{ color: 'var(--pp-text)', minWidth: 160 }}
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
                          ) : (
                            <Group gap={6} wrap="nowrap">
                              <span>{p.name}</span>
                              <ProjectFlagChips project={p} compact />
                              {pendingProjectIds.has(p.id) && (
                                <Badge size="xs" color="yellow" variant="filled" style={{ flexShrink: 0 }}>
                                  Pending Approval
                                </Badge>
                              )}
                            </Group>
                          )}
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
                        {/* Inline-editable startDate */}
                        {visibleCols.has('Start') && (
                          <Table.Td style={{ cursor: 'pointer', minWidth: 120 }}
                            onClick={e => { e.stopPropagation(); startEdit(p.id, 'startDate', p.startDate ?? ''); }}>
                            {editingCell?.id === p.id && editingCell.field === 'startDate' ? (
                              <DateInput
                                size="xs"
                                value={editDateDraft}
                                autoFocus
                                clearable
                                onChange={d => setEditDateDraft(d)}
                                onBlur={() => commitEdit(p)}
                                onClick={e => e.stopPropagation()}
                                valueFormat="MMM D, YYYY"
                                popoverProps={{ withinPortal: true }}
                              />
                            ) : (
                              <span style={{ color: p.startDate ? 'inherit' : 'var(--mantine-color-dimmed)' }}>
                                {formatProjectDate(p.startDate, p.startMonth, monthLabels)}
                              </span>
                            )}
                          </Table.Td>
                        )}
                        {/* Inline-editable targetDate */}
                        {visibleCols.has('End') && (
                          <Table.Td style={{ cursor: 'pointer', minWidth: 120 }}
                            onClick={e => { e.stopPropagation(); startEdit(p.id, 'targetDate', p.targetDate ?? ''); }}>
                            {editingCell?.id === p.id && editingCell.field === 'targetDate' ? (
                              <DateInput
                                size="xs"
                                value={editDateDraft}
                                autoFocus
                                clearable
                                onChange={d => setEditDateDraft(d)}
                                onBlur={() => commitEdit(p)}
                                onClick={e => e.stopPropagation()}
                                valueFormat="MMM D, YYYY"
                                popoverProps={{ withinPortal: true }}
                              />
                            ) : (() => {
                              const isPastDue = p.targetDate && new Date(p.targetDate + 'T00:00:00') < new Date() && p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
                              return (
                                <span style={{
                                  color: isPastDue
                                    ? 'var(--mantine-color-red-6)'
                                    : p.targetDate ? 'inherit' : 'var(--mantine-color-dimmed)',
                                  fontWeight: isPastDue ? 600 : undefined,
                                }}>
                                  {formatProjectDate(p.targetDate, p.targetEndMonth, monthLabels)}
                                </span>
                              );
                            })()}
                          </Table.Td>
                        )}
                        {visibleCols.has('Duration') && <Table.Td>{p.durationMonths}m</Table.Td>}
                        {visibleCols.has('Pattern') && <Table.Td>{p.defaultPattern}</Table.Td>}
                        {/* Inline-editable status */}
                        {visibleCols.has('Status') && (
                          <Table.Td onClick={e => { e.stopPropagation(); startEdit(p.id, 'status', p.status); }}>
                            {editingCell?.id === p.id && editingCell.field === 'status' ? (
                              <Select size="xs" data={statusOptions} value={editDraft} autoFocus
                                onChange={v => {
                                  const newStatus = v ?? p.status;
                                  setEditDraft(newStatus);
                                  // Commit immediately on selection — avoids stale-closure bug with onBlur
                                  updateMutation.mutate(
                                    { id: p.id, data: { name: p.name, priority: p.priority, owner: p.owner ?? '', startMonth: p.startMonth ?? 1, durationMonths: p.durationMonths ?? 1, defaultPattern: p.defaultPattern ?? 'Flat', status: newStatus, notes: p.notes ?? null, startDate: p.startDate, targetDate: p.targetDate, client: p.client ?? null } },
                                    {
                                      onError: (error: any) => {
                                        const reason = error?.response?.data?.message ?? error?.response?.data ?? '';
                                        if (String(reason).includes('APPROVAL_REQUIRED')) {
                                          toast.warning('Approval required', 'Status change submitted for approval.');
                                        } else {
                                          toast.error('Save failed', 'Could not update status');
                                        }
                                      },
                                    }
                                  );
                                  setEditingCell(null);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : <StatusBadge status={p.status} jiraStatusCategory={p.jiraStatusCategory} />}
                          </Table.Td>
                        )}
                        {visibleCols.has('Budget') && (
                          <Table.Td style={{ whiteSpace: 'nowrap', fontSize: 12, cursor: 'pointer', minWidth: 140 }}
                            onClick={e => { e.stopPropagation(); startEdit(p.id, 'estimatedBudget', p.estimatedBudget); }}>
                            {editingCell?.id === p.id && editingCell.field === 'estimatedBudget' ? (
                              <NumberInput
                                size="xs"
                                value={editNumberDraft ?? ''}
                                autoFocus
                                onChange={v => setEditNumberDraft(v === '' ? null : v ? Number(v) : null)}
                                onBlur={() => commitEdit(p)}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') cancelEdit(); }}
                                onClick={e => e.stopPropagation()}
                                prefix="$"
                                decimalScale={0}
                                min={0}
                              />
                            ) : (
                              p.estimatedBudget != null
                                ? <span style={{ color: (p.actualCost ?? 0) > p.estimatedBudget ? 'var(--mantine-color-red-6)' : 'inherit' }}>
                                    ${p.estimatedBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    {p.actualCost != null && (
                                      <span style={{ color: 'var(--mantine-color-dimmed)', marginLeft: 4, fontSize: 11 }}>
                                        ({Math.round((p.actualCost / p.estimatedBudget) * 100)}%)
                                      </span>
                                    )}
                                  </span>
                                : <span style={{ color: 'var(--mantine-color-dimmed)' }}>—</span>
                            )}
                          </Table.Td>
                        )}
                        {visibleCols.has('Health') && (
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            {(() => {
                              const h = healthByProjectId.get(p.id);
                              if (!h) return <span style={{ color: 'var(--mantine-color-dimmed)' }}>—</span>;
                              return (
                                <HealthBadge
                                  rag={h.ragStatus}
                                  score={h.overallScore ?? undefined}
                                  variant="score"
                                  size="xs"
                                  tooltip={[h.scheduleLabel, h.budgetLabel, h.riskLabel].filter(Boolean).join(' · ')}
                                />
                              );
                            })()}
                          </Table.Td>
                        )}
                        {visibleCols.has('Created') && <Table.Td c="dimmed" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Table.Td>}
                        <Table.Td onClick={e => e.stopPropagation()}>
                          <ProjectSourceBadge sourceType={p.sourceType ?? 'MANUAL'} jiraEpicKey={p.jiraEpicKey} />
                        </Table.Td>
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
                            <Tooltip label="Delete project" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                color="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDelete([p.id]);
                                }}
                              >
                                <IconTrash size={15} />
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
                          {/* Checkbox placeholder — keeps column alignment */}
                          <Table.Td />
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
                                { label: 'Dev', val: pod.devHours, color: COLOR_BLUE },
                                { label: 'QA', val: pod.qaHours, color: COLOR_VIOLET_ALT },
                                { label: 'BSA', val: pod.bsaHours, color: COLOR_WARNING },
                                { label: 'TL', val: pod.techLeadHours, color: COLOR_ERROR_STRONG },
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
                                <Text size="xs" fw={700} style={{ color: isDark ? TEXT_SUBTLE : '#475569', whiteSpace: 'nowrap' }}>
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
                    {/* checkbox */}
                    <Table.Td />
                    {/* expand chevron — always present in header */}
                    <Table.Td />
                    {/* # */}
                    {visibleCols.has('#') && <Table.Td />}
                    {/* Name — always visible */}
                    <Table.Td style={{ minWidth: 180 }}>
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
                          onChange={v => setAddRowForm(f => ({ ...f, priority: v ?? 'MEDIUM' }))} style={{ minWidth: 80 }} />
                      </Table.Td>
                    )}
                    {/* Owner */}
                    {visibleCols.has('Owner') && (
                      <Table.Td>
                        <TextInput size="xs" placeholder="Owner" value={addRowForm.owner}
                          onChange={e => setAddRowForm(f => ({ ...f, owner: e.currentTarget.value }))} />
                      </Table.Td>
                    )}
                    {/* Start month */}
                    {visibleCols.has('Start') && (
                      <Table.Td style={{ minWidth: 70 }}>
                        <NumberInput size="xs" placeholder="M1" value={addRowForm.startMonth}
                          min={1} max={12} hideControls
                          onChange={v => setAddRowForm(f => ({ ...f, startMonth: Number(v) || 1 }))} />
                      </Table.Td>
                    )}
                    {/* End — computed, not editable inline */}
                    {visibleCols.has('End') && <Table.Td />}
                    {/* Duration */}
                    {visibleCols.has('Duration') && (
                      <Table.Td style={{ minWidth: 70 }}>
                        <NumberInput size="xs" placeholder="3" value={addRowForm.durationMonths}
                          min={1} max={60} hideControls
                          onChange={v => setAddRowForm(f => ({ ...f, durationMonths: Number(v) || 3 }))} />
                      </Table.Td>
                    )}
                    {/* Pattern */}
                    {visibleCols.has('Pattern') && (
                      <Table.Td>
                        <Select size="xs"
                          data={(effortPatterns ?? []).map(ep => ({ value: ep.name, label: ep.name }))}
                          value={addRowForm.defaultPattern}
                          onChange={v => setAddRowForm(f => ({ ...f, defaultPattern: v ?? 'Flat' }))} />
                      </Table.Td>
                    )}
                    {/* Status */}
                    {visibleCols.has('Status') && (
                      <Table.Td>
                        <Select size="xs" data={statusOptions} value={addRowForm.status}
                          onChange={v => setAddRowForm(f => ({ ...f, status: v ?? 'ACTIVE' }))} style={{ minWidth: 100 }} />
                      </Table.Td>
                    )}
                    {visibleCols.has('Created') && <Table.Td />}
                    {/* Source — always visible in header */}
                    <Table.Td />
                    {/* Actions */}
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
                    <Table.Td colSpan={12} style={{ textAlign: 'center', padding: '8px', color: TEXT_SUBTLE, fontSize: 12 }}>
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
          onDeleteProject={(id) => confirmDelete([id])}
          onAddProject={(status) => {
            setForm({ ...emptyForm, status });
            setNameError('');
            setModalOpen(true);
          }}
        />
      )}

      {viewMode === 'gantt' && (
        <GanttView
          projects={filtered}
          monthLabels={monthLabels}
          onEdit={(p) => navigate(`/projects/${p.id}`)}
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
        onClose={() => { setJiraImportOpen(false); setJiraImportSearch(''); setJiraJqlInput(''); setJiraJql(DEFAULT_INITIATIVE_JQL); setJiraSearchEnabled(true); setJiraSelectedProjects([]); setJiraIssueType('Initiative'); setJiraShowAdvanced(false); }}
        title={
          <Group gap="xs">
            <IconPlugConnected size={20} color="#0052CC" />
            <Text fw={600}>Import Initiatives from Jira Roadmap</Text>
          </Group>
        }
        size="xl"
        centered
      >
        <Stack gap="sm">
          {/* ── Filter controls ── */}
          <Stack gap="xs">
            {/* Issue Type + Project picker */}
            <Group gap="xs" grow>
              <Select
                label="Issue type"
                size="sm"
                data={['Initiative', 'Epic', 'Story', 'Feature', 'Theme', 'Task']}
                value={jiraIssueType}
                onChange={v => setJiraIssueType(v ?? 'Initiative')}
                allowDeselect={false}
              />
              <MultiSelect
                label="Jira projects (leave empty for all)"
                size="sm"
                data={(allJiraProjectsList ?? []).map(p => ({ value: p.key, label: `${p.key} — ${p.name}` }))}
                value={jiraSelectedProjects}
                onChange={setJiraSelectedProjects}
                placeholder="All projects"
                searchable
                clearable
                maxDropdownHeight={220}
              />
            </Group>

            {/* Advanced JQL toggle */}
            <Group gap="xs">
              <Button
                size="sm"
                leftSection={<IconSearch size={14} />}
                loading={jiraProjectsLoading}
                onClick={() => buildAndRunJql(jiraSelectedProjects, jiraIssueType, jiraShowAdvanced ? jiraJqlInput : '')}
              >
                Search
              </Button>
              <Button
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => setJiraShowAdvanced(v => !v)}
              >
                {jiraShowAdvanced ? 'Hide advanced JQL' : 'Advanced JQL'}
              </Button>
            </Group>

            <Collapse in={jiraShowAdvanced}>
              <Stack gap={4}>
                <Text size="xs" c="dimmed">Additional JQL filter (appended with AND). The issue type and project selections above take precedence.</Text>
                <Group gap="xs">
                  <TextInput
                    style={{ flex: 1 }}
                    size="sm"
                    ff="monospace"
                    placeholder='e.g. labels = "portfolio" AND priority = "High"'
                    value={jiraJqlInput}
                    onChange={e => setJiraJqlInput(e.currentTarget.value)}
                    onKeyDown={e => { if (e.key === 'Enter') buildAndRunJql(jiraSelectedProjects, jiraIssueType, jiraJqlInput); }}
                  />
                </Group>
                {jiraJql && (
                  <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all' }}>
                    Running: {jiraJql}
                  </Text>
                )}
              </Stack>
            </Collapse>
          </Stack>

          <Divider />

          {jiraProjectsLoading ? (
            <Stack gap="xs">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height={36} radius="sm" />
              ))}
            </Stack>
          ) : jiraProjectsError ? (
            <Alert color="red" icon={<IconAlertTriangle size={14} />}>
              JQL query failed. Check your syntax and try again.
            </Alert>
          ) : jiraProjects.length === 0 ? (
            <Alert color="orange" icon={<IconAlertTriangle size={14} />}>
              No results for this JQL query. Try a different issue type — for example, change{' '}
              <Text span ff="monospace" size="sm">"Initiative"</Text> to{' '}
              <Text span ff="monospace" size="sm">"Epic"</Text>.
            </Alert>
          ) : (
            <>
              {/* Stats */}
              <Group gap="xs">
                <Badge size="sm" color="blue" variant="light">
                  {jiraProjects.length} found
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
                  {/* Search filter */}
                  <TextInput
                    placeholder="Search projects by name or key…"
                    leftSection={<IconSearch size={14} />}
                    value={jiraImportSearch}
                    onChange={e => setJiraImportSearch(e.currentTarget.value)}
                    size="sm"
                  />
                  {/* Select all / deselect all */}
                  <Group justify="space-between">
                    <Checkbox
                      label={
                        <Text size="sm" fw={600}>
                          Select all
                          {jiraImportSearch.trim()
                            ? ` (${filteredImportableProjects.length} of ${importableJiraProjects.length})`
                            : ` (${importableJiraProjects.length})`}
                        </Text>
                      }
                      checked={
                        filteredImportableProjects.length > 0 &&
                        filteredImportableProjects.every(p => selectedJiraKeys.has(p.key))
                      }
                      indeterminate={
                        filteredImportableProjects.some(p => selectedJiraKeys.has(p.key)) &&
                        !filteredImportableProjects.every(p => selectedJiraKeys.has(p.key))
                      }
                      onChange={toggleAllImportable}
                    />
                    {selectedJiraKeys.size > 0 && (
                      <Badge size="sm" color="indigo" variant="filled">
                        {selectedJiraKeys.size} selected
                      </Badge>
                    )}
                  </Group>

                  {/* Importable initiative list */}
                  <ScrollArea.Autosize mah={320}>
                    <Stack gap={4}>
                      {filteredImportableProjects.length === 0 ? (
                        <Text size="sm" c="dimmed" ta="center" py="md">
                          No initiatives match "{jiraImportSearch}"
                        </Text>
                      ) : null}
                      {filteredImportableProjects.map(jp => (
                        <Box
                          key={jp.key}
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
                          <Group gap="sm" wrap="nowrap">
                            <Checkbox
                              checked={selectedJiraKeys.has(jp.key)}
                              onChange={() => toggleJiraKey(jp.key)}
                              size="sm"
                              onClick={e => e.stopPropagation()}
                            />
                            <Badge size="sm" variant="light" color="blue" ff="monospace" style={{ flexShrink: 0 }}>{jp.key}</Badge>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {jp.name}
                              </Text>
                              <Group gap={6} mt={2}>
                                {jp.status && (
                                  <Badge size="xs" variant="dot" color="gray">{jp.status}</Badge>
                                )}
                                {jp.startDate && (
                                  <Text size="xs" c="dimmed">Start: {jp.startDate}</Text>
                                )}
                                {jp.dueDate && (
                                  <Text size="xs" c="dimmed">Due: {jp.dueDate}</Text>
                                )}
                                {jp.assignee && (
                                  <Text size="xs" c="dimmed">👤 {jp.assignee}</Text>
                                )}
                              </Group>
                            </Box>
                          </Group>
                        </Box>
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
                <Button variant="light" onClick={() => { setJiraImportOpen(false); setJiraImportSearch(''); setJiraJqlInput(''); setJiraJql(DEFAULT_INITIATIVE_JQL); setJiraSearchEnabled(true); setJiraSelectedProjects([]); setJiraIssueType('Initiative'); setJiraShowAdvanced(false); }} size="sm">
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={
          <Group gap="xs">
            <IconTrash size={18} color="var(--mantine-color-red-6)" />
            <Text fw={600} c="red">
              {deleteTarget && deleteTarget.length > 1
                ? `Delete ${deleteTarget.length} Projects`
                : 'Delete Project'}
            </Text>
          </Group>
        }
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            {deleteTarget && deleteTarget.length > 1 ? (
              <>
                You are about to permanently delete{' '}
                <Text span fw={700}>{deleteTarget.length} projects</Text>.
                This will also remove all associated POD assignments and planning data.
              </>
            ) : (
              <>
                You are about to permanently delete{' '}
                <Text span fw={700}>
                  {deleteTarget && projects?.find(p => p.id === deleteTarget[0])?.name}
                </Text>
                . This will also remove all associated POD assignments and planning data.
              </>
            )}
          </Text>
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
            <Text size="xs">This action cannot be undone.</Text>
          </Alert>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              Delete{deleteTarget && deleteTarget.length > 1 ? ` ${deleteTarget.length} Projects` : ''}
            </Button>
          </Group>
        </Stack>
      </Modal>
      </Stack>
    </PPPageLayout>
  );
}
