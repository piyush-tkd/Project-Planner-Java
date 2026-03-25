import { Role, Location } from './common';

export interface ResourcePodAssignmentInfo {
  podId: number;
  podName: string;
  capacityFte: number;
}

export interface ResourceResponse {
  id: number;
  name: string;
  email: string | null;
  role: string;
  location: string;
  active: boolean;
  countsInCapacity: boolean;
  actualRate: number | null;
  podAssignment: ResourcePodAssignmentInfo | null;
  jiraDisplayName: string | null;
  jiraAccountId: string | null;
}

export interface ResourceRequest {
  name: string;
  email: string | null;
  role: string;
  location: string;
  active: boolean;
  countsInCapacity: boolean;
  homePodId: number | null;
  capacityFte: number;
  jiraDisplayName: string | null;
  jiraAccountId: string | null;
}

export interface ResourcePodAssignment {
  id: number;
  resourceId: number;
  podId: number;
  podName: string;
  allocationPercent: number;
  startMonth: number;
  endMonth: number;
}

export interface AvailabilityData {
  resourceId: number;
  resourceName: string;
  capacityFte: number;
  months: Record<number, number>;
}
