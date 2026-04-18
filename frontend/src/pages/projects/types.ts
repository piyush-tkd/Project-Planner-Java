import type { SourceType } from '../../types/project';
import type { AdvancedFilters } from '../../components/common/AdvancedFilterPanel';

export type ViewMode = 'table' | 'board' | 'gantt';
export type EditableField = 'name' | 'owner' | 'priority' | 'status' | 'startDate' | 'targetDate' | 'estimatedBudget';
export type Density = 'compact' | 'normal' | 'comfortable';
export type ColKey = '#' | 'Priority' | 'Owner' | 'Start' | 'End' | 'Duration' | 'Pattern' | 'Status' | 'Budget' | 'Health' | 'Created';

export interface EditingCell {
  id: number;
  field: EditableField;
}

export interface AddRowForm {
  name: string;
  priority: string;
  owner: string;
  status: string;
  startMonth: number;
  durationMonths: number;
  defaultPattern: string;
}

export interface ProjectStats {
  total: number;
  active: number;
  onHold: number;
  p0p1: number;
  avgDuration: number;
}

export interface FilterState {
  search: string;
  statusFilter: string;
  ownerFilter: string | null;
  priorityFilter: string | null;
  sourceFilter: SourceType | 'ALL' | 'ARCHIVED';
  advFilters: AdvancedFilters;
  cardFilter: string | null;
}

export interface ProjectPageState {
  modalOpen: boolean;
  jiraSyncing: boolean;
  jiraImportOpen: boolean;
  jiraImportSearch: string;
  jiraJql: string;
  jiraJqlInput: string;
  jiraSearchEnabled: boolean;
  jiraSelectedProjects: string[];
  jiraIssueType: string;
  jiraShowAdvanced: boolean;
  selectedJiraKeys: Set<string>;
  importingCount: number;
  importedCount: number;
  importErrors: string[];
  selectedRows: Set<number>;
  deleteTarget: number[] | null;
  editingCell: EditingCell | null;
  editDraft: string;
  editDateDraft: Date | null;
  editNumberDraft: number | null;
  addRowActive: boolean;
  addRowForm: AddRowForm;
  expandedRows: Set<number>;
  activeViewId: string | null;
}
