import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface ExcelImportResponse {
  success: boolean;
  message: string;
  counts: Record<string, number>;
  warnings: string[];
}

export function useImportExcel() {
  const qc = useQueryClient();
  return useMutation<ExcelImportResponse, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/data/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
