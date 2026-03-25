import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

export interface PeriodMetrics {
  periodLabel: string;
  periodIndex: number;
  hoursLogged: number;
  dollarValue: number;
  storyCount: number;
  bugCount: number;
  taskCount: number;
  totalIssues: number;
  storyPointsCompleted: number;
  commitsCount: number;
}

export interface ResourceMetrics {
  resourceId: number;
  resourceName: string;
  role: string;
  location: string;
  hourlyRate: number;
  periods: PeriodMetrics[];
}

export interface PerformanceSummary {
  year: number;
  periodType: string;
  totalHours: number;
  totalDollarValue: number;
  totalStories: number;
  totalBugs: number;
  totalIssues: number;
  totalStoryPoints: number;
  totalResources: number;
  mappedResources: number;
  resources: ResourceMetrics[];
}

export interface ResourceIssue {
  issueKey: string;
  summary: string;
  issueType: string;
  status: string;
  statusCategory: string;
  priority: string;
  storyPoints: number | null;
  hoursLogged: number;
  resolutionDate: string | null;
}

export function useResourcePerformance(year: number, period: string) {
  return useQuery<PerformanceSummary>({
    queryKey: ['resource-performance', year, period],
    queryFn: () => apiClient.get('/reports/resource-performance', {
      params: { year, period },
    }).then(r => r.data),
  });
}

export function useResourceIssues(resourceId: number | null, year: number, period: string, periodIndex: number) {
  return useQuery<ResourceIssue[]>({
    queryKey: ['resource-issues', resourceId, year, period, periodIndex],
    queryFn: () => apiClient.get(`/reports/resource-performance/${resourceId}/issues`, {
      params: { year, period, periodIndex },
    }).then(r => r.data),
    enabled: resourceId != null && resourceId > 0,
  });
}
