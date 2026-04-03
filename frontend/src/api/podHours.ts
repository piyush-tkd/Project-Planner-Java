import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export type PeriodType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface PodHoursEntry {
  podId: number;
  podName: string;
  hours: number;
  issueCount: number;
  buffer: boolean;
}

export interface ResourceRow {
  resourceId: number | null;
  authorName: string;
  role: string | null;
  location: string | null;
  homePodName: string | null;
  totalHours: number;
  pods: PodHoursEntry[];
}

export interface PodInfo {
  podId: number;
  podName: string;
  totalHours: number;
  resourceCount: number;
  bufferCount: number;
}

export interface PodHoursSummary {
  year: number;
  periodType: PeriodType;
  periodIndex: number;
  periodLabel: string;
  totalHours: number;
  totalResources: number;
  totalPods: number;
  bufferHours: number;
  podSummaries: PodInfo[];
  resources: ResourceRow[];
}

export function usePodHours(year: number, period: PeriodType, periodIndex: number) {
  return useQuery<PodHoursSummary>({
    queryKey: ['pod-hours', year, period, periodIndex],
    queryFn: () =>
      apiClient
        .get('/reports/pod-hours', { params: { year, period, periodIndex } })
        .then(r => r.data),
  });
}
