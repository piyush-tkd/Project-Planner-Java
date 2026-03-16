import { Role } from './common';

export interface PodResponse {
  id: number;
  name: string;
  complexityMultiplier: number;
  displayOrder: number;
  active: boolean;
}

export interface BauAssumptionResponse {
  id: number;
  podId: number;
  podName: string;
  role: string;
  bauPct: number;
}

export interface BauAssumptionRequest {
  podId: number;
  role: string;
  bauPct: number;
}
