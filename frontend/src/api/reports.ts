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

// ── DORA Metrics ─────────────────────────────────────────────────────────────

export interface DoraMetricValue {
  value: number;
  label?: string;
  level: 'elite' | 'high' | 'medium' | 'low';
  unit: string;
  details?: Record<string, unknown>[];
  specialReleases?: number;
  totalReleases?: number;
  totalIssues?: number;
  bugCount?: number;
  recoveryEvents?: number;
  median?: number;
  sampleSize?: number;
}

export interface DoraMetricsData {
  lookbackMonths: number;
  source: 'jira' | 'release_calendar';
  projectKeys?: string[];
  totalReleases: number;
  totalSprints: number;
  deploymentFrequency: DoraMetricValue;
  leadTimeForChanges: DoraMetricValue;
  changeFailureRate: DoraMetricValue;
  meanTimeToRecovery: DoraMetricValue;
  trend: { month: string; releases: number; failures: number }[];
  upcoming: { name: string; releaseDate: string; codeFreezeDate: string; type: string; daysUntilRelease: number }[];
}

export function useDoraMetrics(months?: number, source?: 'jira' | 'db') {
  return useQuery<DoraMetricsData>({
    queryKey: ['reports', 'dora', months ?? 6, source ?? 'auto'],
    queryFn: () => apiClient.get('/reports/dora', {
      params: { ...(months ? { months } : {}), ...(source ? { source } : {}) },
    }).then(r => r.data),
    staleTime: 30 * 60_000,   // 30 min — use Refresh button for fresh data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ── DORA Monthly Breakdown (MBR) ─────────────────────────────────────────

export interface DoraMonthCard {
  month: string;
  deploymentFrequency: DoraMetricValue & { releases?: string[] };
  leadTimeForChanges: DoraMetricValue & { sampleSize?: number };
  changeFailureRate: DoraMetricValue & { bugCount?: number; totalIssues?: number };
  meanTimeToRecovery: DoraMetricValue & { recoveryEvents?: number };
  totalReleases: number;
  totalIssues: number;
}

export interface DoraMonthlyData {
  lookbackMonths: number;
  source: 'jira' | 'release_calendar';
  months: DoraMonthCard[];
}

export function useDoraMonthly(months?: number, source?: 'jira' | 'db') {
  return useQuery<DoraMonthlyData>({
    queryKey: ['reports', 'dora-monthly', months ?? 6, source ?? 'auto'],
    queryFn: () => apiClient.get('/reports/dora/monthly', {
      params: { ...(months ? { months } : {}), ...(source ? { source } : {}) },
    }).then(r => r.data),
    staleTime: 30 * 60_000,   // 30 min — use Refresh button for fresh data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ── Engineering Productivity Metrics ──────────────────────────────────────

export interface ProductivityProjectCost {
  id: number;
  name: string;
  status: string;
  priority: string;
  owner: string;
  totalHours: number;
  totalCost: number;
  pods: number;
  durationMonths: number;
  roleCosts: Record<string, number>;
}

export interface ProductivityPodSpend {
  pod: string;
  annualSpend: number;
  pct: number;
}

export interface ProductivityDoraSnapshot {
  deploymentFrequency: DoraMetricValue;
  leadTimeForChanges: DoraMetricValue;
  changeFailureRate: DoraMetricValue;
  meanTimeToRecovery: DoraMetricValue;
  source: string;
}

export interface ProductivityData {
  lookbackMonths: number;
  generatedAt: string;
  investment: {
    totalAnnualSpend: number;
    avgMonthlySpend: number;
    spendByPod: ProductivityPodSpend[];
    spendByProject: ProductivityProjectCost[];
  };
  output: {
    totalProjects: number;
    completedProjects: number;
    activeProjects: number;
    completionRate: number;
    statusBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
    criticalHighDelivered: number;
    projectEffortSummary: Array<{
      id: number; name: string; status: string; priority: string;
      owner: string; pods: number; totalHours: number; durationMonths: number;
    }>;
  };
  efficiency: {
    dora?: ProductivityDoraSnapshot;
    deliveredProjectCount: number;
    totalDeliveredCost: number;
    avgCostPerProjectDelivered: number;
    costPerProject: ProductivityProjectCost[];
    totalPlannedCost?: number;
    allProjectCosts?: ProductivityProjectCost[];
  };
  impact: {
    criticalHighPct: number;
    criticalHighEffortPct: number;
    totalPlannedEffortHours: number;
    effortByOwner: Array<{ owner: string; totalHours: number; pct: number }>;
  };
}

export function useProductivityMetrics(months?: number) {
  return useQuery<ProductivityData>({
    queryKey: ['reports', 'productivity', months ?? 6],
    queryFn: () => apiClient.get('/reports/productivity', {
      params: { ...(months ? { months } : {}) },
    }).then(r => r.data),
    staleTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
