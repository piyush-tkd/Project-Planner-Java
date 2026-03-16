export interface ProjectResponse {
  id: number;
  name: string;
  priority: string;
  owner: string;
  startMonth: number;
  targetEndMonth: number;
  durationMonths: number;
  defaultPattern: string;
  status: string;
  notes: string | null;
  blockedById: number | null;
  targetDate: string | null;
  startDate: string | null;
  capacityNote: string | null;
}

export interface ProjectRequest {
  name: string;
  priority: string;
  owner: string;
  startMonth: number;
  durationMonths: number;
  defaultPattern: string;
  status: string;
  notes: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface ProjectPodPlanningResponse {
  id: number;
  podId: number;
  podName: string;
  tshirtSize: string;
  complexityOverride: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
}

export interface ProjectPodMatrixResponse {
  planningId: number;
  projectId: number;
  projectName: string;
  priority: string;
  owner: string;
  status: string;
  projectStartMonth: number;
  projectDurationMonths: number;
  defaultPattern: string;
  podId: number;
  podName: string;
  tshirtSize: string;
  complexityOverride: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
}

export interface ProjectPodPlanningRequest {
  podId: number;
  tshirtSize: string;
  complexityOverride: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
}
