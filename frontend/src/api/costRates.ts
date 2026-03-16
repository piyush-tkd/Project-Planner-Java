import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export interface CostRateResponse {
  id: number;
  role: string;
  location: string;
  hourlyRate: number;
}

export function useCostRates() {
  return useQuery<CostRateResponse[]>({
    queryKey: ['cost-rates'],
    queryFn: () => apiClient.get('/cost-rates').then(r => r.data),
  });
}
