import { Priority, ProjectStatus } from '../../types';
import type { ProjectRequest } from '../../types';

export const PRIORITY_LABELS: Record<string, string> = {
  HIGHEST: 'Highest',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  LOWEST: 'Lowest',
  BLOCKER: 'Blocker',
  MINOR: 'Minor',
};

export const priorityOptions = Object.values(Priority).map(p => ({
  value: p,
  label: PRIORITY_LABELS[p] ?? p,
}));

export const BASE_STATUS_OPTIONS = Object.values(ProjectStatus).map(s => ({
  value: s,
  label: s.replace(/_/g, ' '),
}));

export const ALL_COLS = ['#', 'Priority', 'Owner', 'Start', 'End', 'Duration', 'Pattern', 'Status', 'Budget', 'Health', 'Created'] as const;

export const DEFAULT_VISIBLE_COLS: typeof ALL_COLS[number][] = ['#', 'Priority', 'Owner', 'Start', 'End', 'Status'];

export const DENSITY_SPACING: Record<'compact' | 'normal' | 'comfortable', string> = {
  compact: 'xs',
  normal: 'sm',
  comfortable: 'md',
};

export const EMPTY_FORM: ProjectRequest = {
  name: '',
  priority: Priority.MEDIUM,
  owner: '',
  startMonth: 1,
  durationMonths: 3,
  defaultPattern: 'Flat',
  status: ProjectStatus.ACTIVE,
  notes: null,
  startDate: null,
  targetDate: null,
  client: null,
};

export const EMPTY_FILTERS = { logic: 'AND' as const, conditions: [] };

export const DEFAULT_INITIATIVE_JQL = 'issuetype = "Initiative" ORDER BY created DESC';
