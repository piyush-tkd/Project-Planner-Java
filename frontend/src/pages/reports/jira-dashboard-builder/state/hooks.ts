import { useState, useMemo, useCallback, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import {
  useJiraAnalytics, useJiraAnalyticsFilters,
  useJiraDashboards, useSaveDashboard, useCloneDashboard,
  useJiraSyncStatus, useTriggerJiraSync, useAllFixVersions,
  useJiraAnalyticsFields,
  type AnalyticsBreakdown,
  type JiraDashboardConfig,
} from '../../../../api/jira';
import { ExtendedDashboardWidget } from './types';
import { WIDGET_CATALOG, DASHBOARD_TEMPLATES } from './constants';

export function useJiraDashboardBuilder() {
  const [months, setMonths] = useState(3);
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [selectedSupportBoards, setSelectedSupportBoards] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<ExtendedDashboardWidget | null>(null);
  const [dashName, setDashName] = useState('');
  const [dashDesc, setDashDesc] = useState('');
  const [saveDashOpen, setSaveDashOpen] = useState(false);
  const [loadDashOpen, setLoadDashOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [renameDashOpen, setRenameDashOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [datePreset, setDatePreset] = useState<'week' | 'month' | 'quarter' | 'year' | 'last30' | 'last90' | 'custom'>('month');
  const [drillDown, setDrillDown] = useState<{ title: string; items: AnalyticsBreakdown[] } | null>(null);
  const [drillDownLimit, setDrillDownLimit] = useState(20);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const [selectedBoards] = useState<string[]>([]);

  // Widget state
  const [widgets, setWidgets] = useState<ExtendedDashboardWidget[]>([]);
  const [dashId, setDashId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const podsParam = selectedPods.length > 0 ? selectedPods.join(',') : undefined;
  const supportBoardsParam = selectedSupportBoards.length > 0 ? selectedSupportBoards.join(',') : undefined;
  const { data, isLoading, isFetching, error, refetch } = useJiraAnalytics(months, podsParam, supportBoardsParam);
  const { data: filters } = useJiraAnalyticsFilters();
  const { data: dashboards = [] } = useJiraDashboards();
  const { data: analyticsFields = [] } = useJiraAnalyticsFields(podsParam);
  const saveDashboard = useSaveDashboard();
  const cloneDashboard = useCloneDashboard();
  const { data: syncStatus } = useJiraSyncStatus();
  const triggerSync = useTriggerJiraSync();
  const { data: allFixVersions = [] } = useAllFixVersions();

  // Load default dashboard on first mount
  useEffect(() => {
    if (widgets.length === 0 && dashboards.length > 0) {
      const defaultDash = dashboards.find(d => d.isDefault) ?? dashboards[0];
      loadDashConfig(defaultDash);
    }
  }, [dashboards]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashConfig = useCallback((dash: JiraDashboardConfig) => {
    try {
      const parsed = JSON.parse(dash.widgetsJson) as ExtendedDashboardWidget[];
      setWidgets(parsed);
      setDashId(dash.id);
      setDashName(dash.name);
      setDashDesc(dash.description ?? '');
      setDirty(false);
    } catch {
      setWidgets([]);
    }
  }, []);

  const podOptions = useMemo(() => {
    const sprintItems = (filters?.pods ?? []).map(p => ({
      value: `pod-${p.id}`,
      label: p.name,
    }));
    const supportItems = (filters?.supportBoards ?? []).map(sb => ({
      value: `sb-${sb.id}`,
      label: `[Support] ${sb.name}`,
    }));
    // Mantine v7 uses flat array; prepend a disabled separator item when both types exist
    if (sprintItems.length > 0 && supportItems.length > 0) {
      return [
        ...sprintItems,
        { value: '__sep__', label: '── Support Boards ──', disabled: true },
        ...supportItems,
      ];
    }
    return [...sprintItems, ...supportItems];
  }, [filters]);

  // Split combined selection back into pod IDs and support board IDs
  const splitPodSelection = useCallback((combined: string[]) => {
    const pods: string[] = [];
    const sbs: string[] = [];
    combined.forEach(v => {
      if (v.startsWith('sb-')) sbs.push(v.replace('sb-', ''));
      else pods.push(v.replace('pod-', ''));
    });
    setSelectedPods(pods);
    setSelectedSupportBoards(sbs);
  }, []);

  // Combined selection for the single MultiSelect
  const combinedPodSelection = useMemo(() => [
    ...selectedPods.map(id => `pod-${id}`),
    ...selectedSupportBoards.map(id => `sb-${id}`),
  ], [selectedPods, selectedSupportBoards]);

  const versionOptions = useMemo(() =>
    allFixVersions.map(v => ({ value: v.name, label: v.name })),
    [allFixVersions],
  );

  const typeOptions = useMemo(() =>
    (data?.byType ?? []).map(t => ({ value: t.name, label: t.name })),
    [data?.byType],
  );


  const boardOptions = useMemo(() => {
    const boards: { value: string; label: string }[] = [];
    (filters?.pods ?? []).forEach(pod => {
      pod.projectKeys.forEach(pk => {
        if (!boards.find(b => b.value === pk)) {
          boards.push({ value: pk, label: `${pk} (${pod.name})` });
        }
      });
    });
    return boards;
  }, [filters]);

  // ── Client-side filtering (version, type, board) ────
  const filteredData = useMemo(() => {
    if (!data) return data;
    // Defensive normalizer: ensure every array field is actually an array
    // (guards against API bugs returning null/object instead of [])
    const sa = <T,>(v: T[] | null | undefined): T[] => Array.isArray(v) ? v : [];
    return {
      ...data,
      // Apply filters + normalize
      byFixVersion: selectedVersions.length > 0
        ? sa(data.byFixVersion).filter(v => selectedVersions.includes(v.name))
        : sa(data.byFixVersion),
      byType: selectedTypes.length > 0
        ? sa(data.byType).filter(t => selectedTypes.includes(t.name))
        : sa(data.byType),
      // Normalize all remaining array fields
      createdVsResolved: sa(data.createdVsResolved),
      workload: sa(data.workload),
      aging: sa(data.aging),
      cycleTime: sa(data.cycleTime),
      bugTrend: sa(data.bugTrend),
      byStatus: sa(data.byStatus),
      byPriority: sa(data.byPriority),
      byAssignee: sa(data.byAssignee),
      byLabel: sa(data.byLabel),
      byComponent: sa(data.byComponent),
      byPod: sa(data.byPod),
      byEpic: sa(data.byEpic),
      byReporter: sa(data.byReporter),
      byResolution: sa(data.byResolution),
      bySprint: sa(data.bySprint),
      byProject: sa(data.byProject),
      byStatusCategory: sa(data.byStatusCategory),
      byCreator: sa(data.byCreator),
      byCreatedMonth: sa(data.byCreatedMonth),
      byResolvedMonth: sa(data.byResolvedMonth),
      byWorklogAuthor: sa(data.byWorklogAuthor),
      kpis: (data.kpis != null && typeof data.kpis === 'object') ? data.kpis : {} as typeof data.kpis,
      statusCategoryBreakdown: (data.statusCategoryBreakdown != null && typeof data.statusCategoryBreakdown === 'object') ? data.statusCategoryBreakdown : {} as Record<string, number>,
    };
  }, [data, selectedVersions, selectedTypes]);

  // ── Date preset handler ────────────────────────────────────────────
  const handleDatePreset = useCallback((preset: string) => {
    const presetMap: Record<string, number> = {
      week: 0.25,
      month: 1,
      quarter: 3,
      year: 12,
      last30: 1,
      last90: 3,
    };
    const m = Math.ceil(presetMap[preset] || 3);
    setMonths(m);
    setDatePreset(preset as any);
  }, []);

  // ── Widget CRUD ───────────────────────────────────────────────────
  const addWidget = useCallback((catalogType: string) => {
    const catalog = WIDGET_CATALOG.find(c => c.type === catalogType);
    if (!catalog) return;
    const needsDataKey = ['donut', 'horizontalBar', 'stackedBar', 'pivotTable', 'issueTable', 'gauge', 'singleKpi', 'trendSpark', 'heatmap', 'twoDimensional'].includes(catalogType);
    const needsConfig = ['countdown'].includes(catalogType);
    const newWidget: ExtendedDashboardWidget = {
      id: `${catalogType}-${Date.now()}`,
      type: catalogType,
      title: catalog.label,
      size: catalog.defaultSize,
      enabled: true,
      showLegend: true,
      showLabels: false,
      sortBy: 'count',
      sortDirection: 'desc',
      limit: 10,
      ...(needsDataKey ? { dataKey: 'byType' } : {}),
      ...(catalogType === 'twoDimensional' ? { dataKey: 'byStatus', secondaryDataKey: 'byPriority' } : {}),
      ...(catalogType === 'countdown' ? { targetDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], targetLabel: 'Sprint End' } : {}),
    };
    setWidgets(prev => [...prev, newWidget]);
    setDirty(true);
    setAddWidgetOpen(false);
    if (needsDataKey || needsConfig) {
      setEditingWidget(newWidget);
    }
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    setDirty(true);
  }, []);

  const updateWidget = useCallback((updated: ExtendedDashboardWidget) => {
    setWidgets(prev => prev.map(w => w.id === updated.id ? updated : w));
    setDirty(true);
    setEditingWidget(null);
  }, []);

  const moveWidget = useCallback((id: string, direction: -1 | 1) => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    setDirty(true);
  }, []);

  const loadTemplate = useCallback((template: typeof DASHBOARD_TEMPLATES[0]) => {
    const newWidgets = template.widgets.map((w, i) => ({
      ...w,
      id: `${w.type}-${Date.now()}-${i}`,
      enabled: true,
    } as ExtendedDashboardWidget));
    setWidgets(newWidgets);
    setDashName(template.name);
    setDashDesc(template.description);
    setDirty(true);
    setTemplatesOpen(false);
  }, []);

  // ── Save/Load ─────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const wJson = JSON.stringify(widgets);
    const fJson = JSON.stringify({ months, pods: selectedPods, supportBoards: selectedSupportBoards, versions: selectedVersions, types: selectedTypes, boards: selectedBoards });
    saveDashboard.mutate({
      id: dashId ?? undefined,
      name: dashName || 'Untitled Dashboard',
      description: dashDesc || undefined,
      widgetsJson: wJson,
      filtersJson: fJson,
    }, {
      onSuccess: (saved) => {
        setDashId(saved.id);
        setDirty(false);
        setSaveDashOpen(false);
        notifications.show({ title: 'Dashboard saved', message: `"${dashName || 'Untitled Dashboard'}" saved successfully.`, color: 'teal' });
      },
      onError: (e: unknown) => notifications.show({ title: 'Save failed', message: (e as Error).message || 'Could not save dashboard.', color: 'red' }),
    });
  }, [widgets, months, selectedPods, selectedSupportBoards, selectedTypes, selectedBoards, dashId, dashName, dashDesc, saveDashboard]);

  /** Reset to a blank canvas so the user can build a new dashboard from scratch */
  const handleNewDashboard = useCallback(() => {
    setWidgets([]);
    setDashId(null);
    setDashName('New Dashboard');
    setDashDesc('');
    setDirty(false);
    setLoadDashOpen(false);
  }, []);

  return {
    // State - Filters
    months,
    setMonths,
    selectedPods,
    selectedSupportBoards,
    datePreset,
    setDatePreset,
    selectedVersions,
    setSelectedVersions,
    selectedTypes,
    setSelectedTypes,
    combinedPodSelection,
    splitPodSelection,

    // State - UI
    editMode,
    setEditMode,
    addWidgetOpen,
    setAddWidgetOpen,
    editingWidget,
    setEditingWidget,
    dashName,
    setDashName,
    dashDesc,
    setDashDesc,
    saveDashOpen,
    setSaveDashOpen,
    loadDashOpen,
    setLoadDashOpen,
    templatesOpen,
    setTemplatesOpen,
    renameDashOpen,
    setRenameDashOpen,
    renameValue,
    setRenameValue,
    drillDown,
    setDrillDown,
    drillDownLimit,
    setDrillDownLimit,

    // State - Widgets & Dashboard
    widgets,
    setWidgets,
    dashId,
    setDashId,
    dirty,
    setDirty,

    // API hooks
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    filters,
    dashboards,
    analyticsFields,
    saveDashboard,
    cloneDashboard,
    syncStatus,
    triggerSync,
    allFixVersions,

    // Computed options
    podOptions,
    versionOptions,
    typeOptions,
    boardOptions: boardOptions,
    filteredData,
    podsParam,
    supportBoardsParam,

    // Handlers
    loadDashConfig,
    handleDatePreset,
    addWidget,
    removeWidget,
    updateWidget,
    moveWidget,
    loadTemplate,
    handleSave,
    handleNewDashboard,
  };
}
