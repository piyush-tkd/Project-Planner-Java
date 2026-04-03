import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface LeaveEntryResponse {
  id: number;
  resourceId: number;
  resourceName: string;
  monthIndex: number;
  leaveYear: number;
  leaveHours: number;
  leaveType: string;
  notes?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  skippedNames: string[];
}

export function useLeaveEntries(year: number) {
  return useQuery<LeaveEntryResponse[]>({
    queryKey: ['leave', year],
    queryFn: () => apiClient.get('/leave', { params: { year } }).then(r => r.data),
  });
}

export function useImportLeave() {
  const qc = useQueryClient();
  return useMutation<ImportResult, Error, { file: File; year: number; replace: boolean }>({
    mutationFn: ({ file, year, replace }) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.post('/leave/import', form, {
        params: { year, replace },
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteLeaveEntry() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiClient.delete(`/leave/${id}`).then(() => {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
