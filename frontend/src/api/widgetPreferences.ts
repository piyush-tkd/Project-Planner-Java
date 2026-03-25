import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface PageWidgetPrefs {
  /** Widget IDs in the user's preferred order. */
  order: string[];
  /** Widget IDs the user has hidden. */
  hidden: string[];
}

const EMPTY: PageWidgetPrefs = { order: [], hidden: [] };

export function useWidgetPreferences(pageKey: string) {
  const qc = useQueryClient();

  const { data = EMPTY, isLoading } = useQuery<PageWidgetPrefs>({
    queryKey: ['widget-prefs', pageKey],
    queryFn: () =>
      apiClient.get(`/widget-preferences/${pageKey}`).then(r => ({
        order:  Array.isArray(r.data?.order)  ? r.data.order  : [],
        hidden: Array.isArray(r.data?.hidden) ? r.data.hidden : [],
      })),
    staleTime: Infinity,   // preferences don't change unless the user changes them
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (prefs: PageWidgetPrefs) =>
      apiClient.put(`/widget-preferences/${pageKey}`, prefs),
    onMutate: async (prefs) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['widget-prefs', pageKey] });
      qc.setQueryData(['widget-prefs', pageKey], prefs);
    },
  });

  return {
    prefs: data,
    isLoading,
    save: mutation.mutate,
  };
}

// ── Sidebar Order Preferences ────────────────────────────────────────────

export interface SidebarOrderPrefs {
  groupOrder: string[];
  itemOrder: Record<string, string[]>;
}

const EMPTY_SIDEBAR: SidebarOrderPrefs = { groupOrder: [], itemOrder: {} };

export function useSidebarOrder() {
  const { data = EMPTY_SIDEBAR, isLoading } = useQuery<SidebarOrderPrefs>({
    queryKey: ['widget-prefs', 'sidebar_order'],
    queryFn: () =>
      apiClient.get('/widget-preferences/sidebar_order').then(r => ({
        groupOrder: Array.isArray(r.data?.groupOrder) ? r.data.groupOrder : [],
        itemOrder: r.data?.itemOrder && typeof r.data.itemOrder === 'object' ? r.data.itemOrder : {},
      })),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return { sidebarOrder: data, isLoading };
}
