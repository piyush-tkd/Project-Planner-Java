export type SourceType = 'MANUAL' | 'JIRA_SYNCED' | 'PUSHED_TO_JIRA';

export interface ProjectResponse {
  id: number;
  name: string;
  priority: string;
  owner: string;
  startMonth: number | null;
  targetEndMonth: number | null;
  durationMonths: number;
  defaultPattern: string;
  status: string;
  notes: string | null;
  blockedById: number | null;
  targetDate: string | null;
  startDate: string | null;
  capacityNote: string | null;
  client: string | null;
  createdAt: string | null;
  // ── Jira source-of-truth fields ────────────────────────────────────────
  sourceType: SourceType;
  jiraEpicKey: string | null;
  jiraBoardId: number | null;
  jiraLastSyncedAt: string | null;
  jiraSyncError: boolean;
  /** Raw Jira statusCategory.key: "new" / "indeterminate" / "done". Null for non-Jira projects. */
  jiraStatusCategory: string | null;
  archived: boolean;
  // ── Budget tracking ─────────────────────────────────────────────────────
  estimatedBudget: number | null;
  actualCost: number | null;
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
  client?: string | null;
  estimatedBudget?: number | null;
  actualCost?: number | null;
  /** Set to 'JIRA_SYNCED' when importing from Jira */
  sourceType?: 'MANUAL' | 'JIRA_SYNCED' | 'PUSHED_TO_JIRA';
  /** Jira issue key (e.g. "PMO-1234") */
  jiraEpicKey?: string | null;
}

export interface ProjectPodPlanningResponse {
  id: number;
  podId: number;
  podName: string;
  devHours: number;
  qaHours: number;
  bsaHours: number;
  techLeadHours: number;
  contingencyPct: number;
  totalHours: number;
  totalHoursWithContingency: number;
  targetReleaseId: number | null;
  targetReleaseName: string | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
  // Phase scheduling
  devStartDate: string | null;
  devEndDate: string | null;
  qaStartDate: string | null;
  qaEndDate: string | null;
  uatStartDate: string | null;
  uatEndDate: string | null;
  scheduleLocked: boolean;
  // Resource counts
  devCount: number;
  qaCount: number;
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
  devHours: number;
  qaHours: number;
  bsaHours: number;
  techLeadHours: number;
  contingencyPct: number;
  totalHours: number;
  totalHoursWithContingency: number;
  targetReleaseId: number | null;
  targetReleaseName: string | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
  tshirtSize: string | null;
  complexityOverride: number | null;
}

export interface ProjectPodPlanningRequest {
  podId: number;
  devHours: number;
  qaHours: number;
  bsaHours: number;
  techLeadHours: number;
  contingencyPct: number;
  targetReleaseId: number | null;
  effortPattern: string | null;
  podStartMonth: number | null;
  durationOverride: number | null;
  // Phase scheduling
  devStartDate?: string | null;
  devEndDate?: string | null;
  qaStartDate?: string | null;
  qaEndDate?: string | null;
  uatStartDate?: string | null;
  uatEndDate?: string | null;
  scheduleLocked?: boolean;
  // Resource counts
  devCount?: number;
  qaCount?: number;
}

// T-shirt size derived from total hours (display only)
export function deriveTshirtSize(totalHours: number): string {
  if (totalHours < 100) return 'XS';
  if (totalHours < 300) return 'S';
  if (totalHours < 600) return 'M';
  if (totalHours < 1200) return 'L';
  return 'XL';
}

// Sprint and Release Calendar types
export interface SprintResponse {
  id: number;
  name: string;
  type: 'SPRINT' | 'IP_WEEK';
  startDate: string;
  endDate: string;
  requirementsLockInDate: string | null;
}

export interface SprintRequest {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  requirementsLockInDate: string | null;
}

export interface ReleaseCalendarResponse {
  id: number;
  name: string;
  releaseDate: string;
  codeFreezeDate: string;
  type: 'REGULAR' | 'SPECIAL';
  notes: string | null;
}

export interface ReleaseCalendarRequest {
  name: string;
  releaseDate: string;
  codeFreezeDate: string;
  type: string;
  notes: string | null;
}

// ── Phase Scheduling Types ───────────────────────────────────────────────
export interface PhaseScheduleResponse {
  podPlanningId: number;
  podId: number;
  podName: string;
  devStartDate: string | null;
  devEndDate: string | null;
  qaStartDate: string | null;
  qaEndDate: string | null;
  uatStartDate: string | null;
  uatEndDate: string | null;
  scheduleLocked: boolean;
}

export interface PhaseScheduleRequest {
  podPlanningId: number;
  devStartDate: string | null;
  devEndDate: string | null;
  qaStartDate: string | null;
  qaEndDate: string | null;
  uatStartDate: string | null;
  uatEndDate: string | null;
  scheduleLocked: boolean;
}

export interface SchedulingRulesResponse {
  id: number | null;
  projectId: number | null;
  qaLagDays: number;
  uatGapDays: number;
  uatDurationDays: number;
  e2eGapDays: number;
  e2eDurationDays: number;
  // Parallelization factors
  devParallelPct: number;
  qaParallelPct: number;
  uatParallelPct: number;
}

export interface SchedulingRulesRequest {
  qaLagDays?: number;
  uatGapDays?: number;
  uatDurationDays?: number;
  e2eGapDays?: number;
  e2eDurationDays?: number;
  // Parallelization factors
  devParallelPct?: number;
  qaParallelPct?: number;
  uatParallelPct?: number;
}

export interface ProjectMilestonesRequest {
  e2eStartDate: string | null;
  e2eEndDate: string | null;
  codeFreezeDateMilestone: string | null;
  releaseDateMilestone: string | null;
}
