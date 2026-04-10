/**
 * DashboardStore — React Context for dashboard global filters and cross-filtering.
 * 
 * Global filters: Apply to all widgets. User sets from filter bar.
 * Cross-filter: Set by clicking a chart element. Other widgets dim/filter to match.
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface GlobalFilters {
  dateRange?: [Date | null, Date | null];
  projectStatus?: string[];    // e.g. ['IN_PROGRESS', 'AT_RISK']
  podIds?: number[];
  priorities?: string[];       // ['HIGH', 'CRITICAL']
  ownerUsername?: string;
  customFilters?: Record<string, string | string[]>;
}

export interface CrossFilter {
  sourceWidgetId: string;      // which widget set the filter
  dimension: string;           // e.g. 'status'
  value: string;               // e.g. 'IN_PROGRESS'
}

export interface DashboardState {
  // Global filters
  globalFilters: GlobalFilters;
  setGlobalFilters: (filters: GlobalFilters) => void;
  updateGlobalFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  clearGlobalFilters: () => void;
  
  // Cross-filtering
  crossFilter: CrossFilter | null;
  setCrossFilter: (cf: CrossFilter | null) => void;
  clearCrossFilter: () => void;
  isCrossFiltered: (widgetId: string) => boolean;
  
  // Edit mode
  isEditMode: boolean;
  setEditMode: (v: boolean) => void;
  
  // Active dashboard ID
  activeDashboardId: number | null;
  setActiveDashboardId: (id: number | null) => void;
  
  // Refresh counter (increment to trigger all widgets to refetch)
  refreshCounter: number;
  triggerRefresh: () => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [globalFilters, setGlobalFiltersState] = useState<GlobalFilters>({});
  const [crossFilter, setCrossFilterState] = useState<CrossFilter | null>(null);
  const [isEditMode, setEditMode] = useState(false);
  const [activeDashboardId, setActiveDashboardId] = useState<number | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const setGlobalFilters = useCallback((filters: GlobalFilters) => {
    setGlobalFiltersState(filters);
  }, []);

  const updateGlobalFilter = useCallback(
    <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
      setGlobalFiltersState((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const clearGlobalFilters = useCallback(() => {
    setGlobalFiltersState({});
  }, []);

  const setCrossFilter = useCallback((cf: CrossFilter | null) => {
    setCrossFilterState(cf);
  }, []);

  const clearCrossFilter = useCallback(() => {
    setCrossFilterState(null);
  }, []);

  const isCrossFiltered = useCallback(
    (widgetId: string): boolean => {
      return crossFilter !== null && crossFilter.sourceWidgetId !== widgetId;
    },
    [crossFilter]
  );

  const triggerRefresh = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  const value: DashboardState = {
    globalFilters,
    setGlobalFilters,
    updateGlobalFilter,
    clearGlobalFilters,
    crossFilter,
    setCrossFilter,
    clearCrossFilter,
    isCrossFiltered,
    isEditMode,
    setEditMode,
    activeDashboardId,
    setActiveDashboardId,
    refreshCounter,
    triggerRefresh,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
