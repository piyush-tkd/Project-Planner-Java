import { Role, Location } from './common';

export interface ResourcePodAssignmentInfo {
  podId: number;
  podName: string;
  capacityFte: number;
}

export interface ResourceResponse {
  id: number;
  name: string;
  role: string;
  location: string;
  active: boolean;
  countsInCapacity: boolean;
  podAssignment: ResourcePodAssignmentInfo | null;
}

export interface ResourceRequest {
  name: string;
  role: string;
  location: string;
  active: boolean;
  countsInCapacity: boolean;
  homePodId: number | null;
  capacityFte: number;
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
