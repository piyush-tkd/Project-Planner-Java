export enum Role {
  DEVELOPER = 'DEVELOPER',
  QA = 'QA',
  BSA = 'BSA',
  TECH_LEAD = 'TECH_LEAD',
}

const roleDisplayNames: Record<string, string> = {
  TECH_LEAD: 'Tech Lead',
  DEVELOPER: 'Developer',
  QA: 'QA',
  BSA: 'BSA',
};

export function formatRole(role: string): string {
  return roleDisplayNames[role] ?? role.replace(/_/g, ' ');
}

export enum Location {
  US = 'US',
  INDIA = 'INDIA',
}

export enum Priority {
  HIGHEST = 'HIGHEST',
  HIGH    = 'HIGH',
  MEDIUM  = 'MEDIUM',
  LOW     = 'LOW',
  LOWEST  = 'LOWEST',
  BLOCKER = 'BLOCKER',
  MINOR   = 'MINOR',
}

export enum ProjectStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_DISCOVERY = 'IN_DISCOVERY',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TshirtSize {
  XS = 'XS',
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
  XXL = 'XXL',
}

export type MonthLabel = {
  monthIndex: number;
  label: string;
};

export enum UtilizationLevel {
  UNDER = 'UNDER',
  NORMAL = 'NORMAL',
  OVER = 'OVER',
  CRITICAL = 'CRITICAL',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
