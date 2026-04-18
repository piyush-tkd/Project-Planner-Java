
export interface PodResponse {
  id: number;
  name: string;
  complexityMultiplier: number | null;
  displayOrder: number;
  active: boolean;
  description?: string | null;
  podType?: string | null;
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
