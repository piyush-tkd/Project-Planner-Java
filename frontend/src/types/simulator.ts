export interface TimelineOverride {
  projectId: number;
  newStartMonth: number;
  newDurationMonths: number;
}

export interface ScenarioOverride {
  projectId: number;
  newStartMonth?: number;
  newDurationMonths?: number;
  newPriority?: string;
  removePod?: number;
  addPod?: number;
}

export interface SimulationRequest {
  overrides: TimelineOverride[];
}
