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
