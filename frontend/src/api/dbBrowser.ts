import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface DbTableMeta {
  table_name: string;
  row_count: number;
  column_count: number;
  table_comment: string | null;
}

export interface DbColumnSchema {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  ordinal_position: number;
  is_primary_key: boolean;
}

export interface DbTableData {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export function useDbTables() {
  return useQuery<DbTableMeta[]>({
    queryKey: ['admin', 'db', 'tables'],
    queryFn: () => apiClient.get('/admin/db/tables').then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDbSchema(tableName: string | null) {
  return useQuery<DbColumnSchema[]>({
    queryKey: ['admin', 'db', 'schema', tableName],
    queryFn: () => apiClient.get(`/admin/db/tables/${tableName}/schema`).then(r => r.data),
    enabled: !!tableName,
    staleTime: 60_000,
  });
}

export function useDbTableData(
  tableName: string | null,
  page: number,
  size: number,
  search: string,
  sortCol: string,
  sortDir: 'ASC' | 'DESC',
) {
  return useQuery<DbTableData>({
    queryKey: ['admin', 'db', 'data', tableName, page, size, search, sortCol, sortDir],
    queryFn: () =>
      apiClient.get(`/admin/db/tables/${tableName}/data`, {
        params: { page, size, search, sortCol, sortDir },
      }).then(r => r.data),
    enabled: !!tableName,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

// ── SQL Query Execution ─────────────────────────────────────────────────────

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
  success: boolean;
  error?: string;
  mutationType?: 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface ExecuteQueryParams {
  sql: string;
  noLimit?: boolean;
}

export function useExecuteQuery() {
  return useMutation<QueryResult, Error, ExecuteQueryParams>({
    mutationFn: ({ sql, noLimit }: ExecuteQueryParams) =>
      apiClient.post('/admin/db/query', { sql, noLimit: noLimit ?? false }).then(r => r.data),
  });
}

// ── Saved Queries (stored via UserWidgetPreference with pageKey="saved_queries") ──

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: string;
}

interface SavedQueriesData {
  queries: SavedQuery[];
}

const SAVED_QUERIES_KEY = 'saved_queries';
const EMPTY_SAVED: SavedQueriesData = { queries: [] };

export function useSavedQueries() {
  const qc = useQueryClient();

  const { data = EMPTY_SAVED, isLoading } = useQuery<SavedQueriesData>({
    queryKey: ['widget-prefs', SAVED_QUERIES_KEY],
    queryFn: () =>
      apiClient.get(`/widget-preferences/${SAVED_QUERIES_KEY}`).then(r => ({
        queries: Array.isArray(r.data?.queries) ? r.data.queries : [],
      })),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const persist = useMutation({
    mutationFn: (updated: SavedQueriesData) =>
      apiClient.put(`/widget-preferences/${SAVED_QUERIES_KEY}`, updated),
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: ['widget-prefs', SAVED_QUERIES_KEY] });
      qc.setQueryData(['widget-prefs', SAVED_QUERIES_KEY], updated);
    },
  });

  const addQuery = (name: string, sql: string) => {
    const newQ: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      sql,
      createdAt: new Date().toISOString(),
    };
    persist.mutate({ queries: [...data.queries, newQ] });
  };

  const removeQuery = (id: string) => {
    persist.mutate({ queries: data.queries.filter(q => q.id !== id) });
  };

  const updateQuery = (id: string, name: string, sql: string) => {
    persist.mutate({
      queries: data.queries.map(q => q.id === id ? { ...q, name, sql } : q),
    });
  };

  return {
    queries: data.queries,
    isLoading,
    addQuery,
    removeQuery,
    updateQuery,
  };
}
