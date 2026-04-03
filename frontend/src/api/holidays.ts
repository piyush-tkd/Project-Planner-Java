import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

export interface HolidayResponse {
  id: number;
  name: string;
  holidayDate: string;   // ISO yyyy-MM-dd
  location: string;      // US | INDIA | ALL
  year: number;
  dayOfWeek: string;
}

export interface HolidayRequest {
  name: string;
  holidayDate: string;
  location: string;
}

export function useHolidays(year: number, location?: string) {
  return useQuery<HolidayResponse[]>({
    queryKey: ['holidays', year, location ?? 'all'],
    queryFn: () =>
      apiClient.get('/holidays', {
        params: { year, ...(location ? { location } : {}) },
      }).then(r => r.data),
  });
}

export function useSaveHoliday() {
  const qc = useQueryClient();
  return useMutation<HolidayResponse, Error, HolidayRequest>({
    mutationFn: (req) => apiClient.post('/holidays', req).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation<HolidayResponse, Error, { id: number } & HolidayRequest>({
    mutationFn: ({ id, ...req }) => apiClient.put(`/holidays/${id}`, req).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => apiClient.delete(`/holidays/${id}`).then(() => {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

/** Holiday hour deductions per location per month: { US: {1: 8, 7: 16}, INDIA: {...} } */
export function useHolidayDeductions(year: number) {
  return useQuery<Record<string, Record<number, number>>>({
    queryKey: ['holidays', 'deductions', year],
    queryFn: () => apiClient.get('/holidays/deductions', { params: { year } }).then(r => r.data),
    enabled: year > 0,
  });
}
