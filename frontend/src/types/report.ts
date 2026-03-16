export interface ExecutiveSummary {
  totalResources: number;
  activeProjects: number;
  totalPods: number;
  overallUtilizationPct: number;
  podMonthsInDeficit: number;
  highestRiskPod: string;
  projectsAtRisk: number;
  recommendedHiresNext3Months: number;
}

export interface PodMonthGap {
  podId: number;
  podName: string;
  monthIndex: number;
  monthLabel: string;
  demandHours: number;
  capacityHours: number;
  gapHours: number;
  gapFte: number;
}

export interface CapacityGapData {
  gaps: PodMonthGap[];
}

export interface PodMonthUtilization {
  podId: number;
  podName: string;
  monthIndex: number;
  monthLabel: string;
  utilizationPct: number;
  level: string;
}

export interface HiringForecastData {
  podId: number;
  podName: string;
  role: string;
  monthIndex: number;
  monthLabel: string;
  deficitHours: number;
  ftesNeeded: number;
}

export interface ConcurrencyRiskData {
  podId: number;
  podName: string;
  monthIndex: number;
  monthLabel: string;
  activeProjectCount: number;
  riskLevel: string;
}

export interface ResourceAllocationData {
  resourceId: number;
  resourceName: string;
  role: string;
  podName: string;
  monthIndex: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPct: number;
}

export interface CapacityDemandSummaryData {
  monthIndex: number;
  monthLabel: string;
  totalDemandHours: number;
  totalCapacityHours: number;
  netGapHours: number;
  utilizationPct: number;
}

export interface SimulationResult {
  baselineGaps: PodMonthGap[];
  simulatedGaps: PodMonthGap[];
  improvements: PodMonthGap[];
}

export interface PodResourceSummary {
  podId: number;
  podName: string;
  homeCount: number;
  homeFte: number;
  homeCountByRole: Record<string, number>;
  homeFteByRole: Record<string, number>;
  monthlyEffective: MonthEffective[];
}

export interface MonthEffective {
  monthIndex: number;
  monthLabel: string;
  effectiveFte: number;
  effectiveByRole: Record<string, number>;
}
