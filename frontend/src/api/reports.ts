import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import {
  ExecutiveSummary,
  CapacityGapData,
  PodMonthUtilization,
  HiringForecastData,
  ConcurrencyRiskData,
  ResourceAllocationData,
  CapacityDemandSummaryData,
  PodResourceSummary,
} from '../types';

export function useExecutiveSummary() {
  return useQuery<ExecutiveSummary>({
    queryKey: ['reports', 'executive-summary'],
    queryFn: () => apiClient.get('/reports/executive-summary').then(r => r.data),
  });
}

export function useCapacityGap(unit: 'hours' | 'fte' = 'hours') {
  return useQuery<CapacityGapData>({
    queryKey: ['reports', 'capacity-gap', unit],
    queryFn: () => apiClient.get('/reports/capacity-gap', { params: { unit } }).then(r => r.data),
  });
}

export function useUtilizationHeatmap() {
  return useQuery<PodMonthUtilization[]>({
    queryKey: ['reports', 'utilization-heatmap'],
    queryFn: () => apiClient.get('/reports/utilization-heatmap').then(r => r.data.cells),
  });
}

export function useHiringForecast() {
  return useQuery<HiringForecastData[]>({
    queryKey: ['reports', 'hiring-forecast'],
    queryFn: () => apiClient.get('/reports/hiring-forecast').then(r => r.data.hires),
  });
}

export function useConcurrencyRisk() {
  return useQuery<ConcurrencyRiskData[]>({
    queryKey: ['reports', 'concurrency-risk'],
    queryFn: () => apiClient.get('/reports/concurrency-risk').then(r => r.data.risks),
  });
}

export function useResourceAllocation() {
  return useQuery<ResourceAllocationData[]>({
    queryKey: ['reports', 'resource-allocation'],
    queryFn: () => apiClient.get('/reports/resource-allocation').then(r => r.data.allocations),
  });
}

export function useCapacityDemandSummary() {
  return useQuery<CapacityDemandSummaryData[]>({
    queryKey: ['reports', 'capacity-demand-summary'],
    queryFn: () => apiClient.get('/reports/capacity-demand-summary').then(r => r.data.months),
  });
}

export function usePodResourceSummary() {
  return useQuery<PodResourceSummary[]>({
    queryKey: ['reports', 'pod-resource-summary'],
    queryFn: () => apiClient.get('/reports/pod-resource-summary').then(r => r.data.pods),
  });
}
