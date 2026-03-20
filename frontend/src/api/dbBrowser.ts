import { useQuery } from '@tanstack/react-query';
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
