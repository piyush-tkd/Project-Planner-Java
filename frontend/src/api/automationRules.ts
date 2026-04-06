import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutomationRule {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;

  // Trigger
  triggerEvent: string;
  triggerValue: string | null;

  // Optional condition
  conditionField: string | null;
  conditionOperator: string | null;
  conditionValue: string | null;

  // Action
  actionType: string;
  actionPayload: Record<string, unknown>;

  // Stats
  lastFiredAt: string | null;
  fireCount: number;
}

export type AutomationRuleRequest = Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'lastFiredAt' | 'fireCount' | 'createdBy'>;

// ── Trigger + Action catalogue (drives the rule builder UI) ──────────────────

export const TRIGGER_EVENTS: { value: string; label: string; description: string; hasValue: boolean }[] = [
  { value: 'PROJECT_STATUS_CHANGED',    label: 'Project status changes',       description: "Fires whenever a project's status is updated",                    hasValue: true },
  { value: 'TARGET_DATE_PASSED',        label: 'Target date passes',           description: 'Fires when today > target date and project is not completed',       hasValue: false },
  { value: 'PROJECT_CREATED',           label: 'New project created',          description: 'Fires whenever a new project is added',                            hasValue: false },
  { value: 'UTILIZATION_EXCEEDED',      label: 'Utilization exceeds threshold', description: "Fires when a resource's utilization % goes above the trigger value", hasValue: true },
  { value: 'SPRINT_STARTED',            label: 'Sprint starts',                description: 'Fires when a new sprint is kicked off',                            hasValue: false },
  { value: 'RESOURCE_OVERALLOCATED',    label: 'Resource over-allocated',      description: 'Fires when a resource is allocated more than 100%',                 hasValue: false },
];

export const CONDITION_FIELDS: { value: string; label: string }[] = [
  { value: 'status',         label: 'Status' },
  { value: 'priority',       label: 'Priority' },
  { value: 'owner',          label: 'Owner' },
  { value: 'durationMonths', label: 'Duration (months)' },
];

export const CONDITION_OPERATORS: { value: string; label: string }[] = [
  { value: 'EQUALS',        label: 'equals' },
  { value: 'NOT_EQUALS',    label: 'does not equal' },
  { value: 'CONTAINS',      label: 'contains' },
  { value: 'GREATER_THAN',  label: 'is greater than' },
  { value: 'LESS_THAN',     label: 'is less than' },
];

export const ACTION_TYPES: { value: string; label: string; description: string; fields: string[] }[] = [
  { value: 'SEND_NOTIFICATION', label: 'Send notification',  description: 'Create an in-app alert for specified recipients', fields: ['recipients', 'message'] },
  { value: 'FLAG_PROJECT',      label: 'Flag project',       description: 'Attach a coloured flag to the project',           fields: ['flagColor', 'reason'] },
  { value: 'CHANGE_STATUS',     label: 'Change status',      description: 'Automatically update the project status',         fields: ['newStatus'] },
  { value: 'LOG_ACTIVITY',      label: 'Log activity',       description: 'Write an entry to the project activity log',      fields: ['logMessage'] },
  { value: 'ADD_RISK',          label: 'Create risk item',   description: 'Add a risk entry in the Risk Register',           fields: ['title', 'severity'] },
];

// ── Hooks ──────────────────────────────────────────────────────────────────────

const QK = ['automation-rules'] as const;

export function useAutomationRules() {
  return useQuery<AutomationRule[]>({
    queryKey: QK,
    queryFn: () => apiClient.get('/automation-rules').then(r => r.data),
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AutomationRuleRequest) =>
      apiClient.post('/automation-rules', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AutomationRuleRequest }) =>
      apiClient.put(`/automation-rules/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.patch(`/automation-rules/${id}/toggle`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/automation-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useFireAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.post(`/automation-rules/${id}/fire`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
