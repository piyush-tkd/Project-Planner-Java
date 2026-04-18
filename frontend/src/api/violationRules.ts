import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuleType = 'required' | 'not-overdue' | 'threshold' | 'min-value' | 'one-of';
export type FieldType = 'string' | 'number' | 'date' | 'option' | 'user';

/**
 * A single evaluatable check within a ViolationRule.
 * One rule can have multiple checks, each independently scoped to
 * certain issue statuses and configured with its own parameters.
 */
export interface ViolationCheck {
  id: string;
  type: RuleType;
  /**
   * Issue statuses this check applies to.
   * Empty array = applies regardless of status.
   * Non-empty = only fires when issue.statusName is in this list.
   */
  statuses: string[];
  threshold?: number;
  allowedValues?: string[];
  /** Optional custom label for the violation badge. Falls back to rule label + type. */
  label?: string;
}

export interface ViolationRule {
  id: string;
  label: string;
  /** Global default: active when no per-type override exists */
  enabled: boolean;
  builtIn: boolean;
  fieldId?: string;
  fieldName?: string;
  fieldType?: FieldType;
  /** All checks to evaluate for this rule */
  checks: ViolationCheck[];
  /**
   * Per-issue-type enable overrides.
   * Key = issue type name. Value = true/false.
   * Absent key → use global `enabled`.
   */
  typeEnabled?: Record<string, boolean>;
}

export interface AvailableField {
  fieldId: string;
  fieldName: string;
  fieldType: FieldType;
}

// ── Check/field helpers ───────────────────────────────────────────────────────

/** Generate a short unique ID for a new check */
export function newCheckId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Default checks to create when a custom field rule is first added */
export function defaultChecksForField(fieldType: FieldType): ViolationCheck[] {
  switch (fieldType) {
    case 'date':
      // Date fields: two checks by default — missing + overdue
      return [
        { id: newCheckId(), type: 'required',    statuses: [] },
        { id: newCheckId(), type: 'not-overdue', statuses: [] },
      ];
    case 'number':
      return [{ id: newCheckId(), type: 'min-value', statuses: [], threshold: 1 }];
    case 'option':
    case 'user':
      return [{ id: newCheckId(), type: 'one-of', statuses: [], allowedValues: [] }];
    default:
      return [{ id: newCheckId(), type: 'required', statuses: [] }];
  }
}

/** Which rule-type options to show for a given field type */
export function ruleTypeOptionsForField(fieldType: FieldType): { value: RuleType; label: string }[] {
  const req = { value: 'required' as RuleType, label: 'Required (not empty)' };
  if (fieldType === 'date') {
    return [req, { value: 'not-overdue', label: 'Not Overdue (must be future date)' }];
  }
  if (fieldType === 'number') {
    return [req, { value: 'min-value', label: 'Minimum Value (numeric ≥ threshold)' }];
  }
  if (fieldType === 'option' || fieldType === 'user') {
    return [req, { value: 'one-of', label: 'Must be one of (allowed values)' }];
  }
  return [req];
}

/**
 * Normalise a persisted rule to always use the `checks` array format.
 * Handles legacy rules that stored `ruleType`/`threshold`/`allowedValues`
 * at root level (pre-checks model).
 */
export function normaliseRule(raw: any): ViolationRule {
  if (Array.isArray(raw.checks) && raw.checks.length > 0) {
    return {
      ...raw,
      checks: raw.checks.map((c: any) => ({ ...c, statuses: c.statuses ?? [] })),
    } as ViolationRule;
  }
  // Legacy format: wrap single ruleType into checks array
  return {
    ...raw,
    checks: [{
      id: 'default',
      type:          raw.ruleType ?? 'required',
      statuses:      [],
      threshold:     raw.threshold,
      allowedValues: raw.allowedValues,
    }],
  } as ViolationRule;
}

// ── isRuleActiveForType ───────────────────────────────────────────────────────

export function isRuleActiveForType(
  rule: ViolationRule,
  issueType: string | null | undefined,
): boolean {
  if (!issueType) return rule.enabled;
  if (rule.typeEnabled && issueType in rule.typeEnabled) {
    return rule.typeEnabled[issueType];
  }
  return rule.enabled;
}

// ── Query keys ────────────────────────────────────────────────────────────────

const RULES_KEY       = ['violation-rules'] as const;
const FIELDS_KEY      = ['violation-rules', 'available-fields'] as const;
const ISSUE_TYPES_KEY = ['violation-rules', 'issue-types'] as const;
const STATUSES_KEY    = ['violation-rules', 'statuses'] as const;

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useViolationRules() {
  return useQuery<ViolationRule[]>({
    queryKey: RULES_KEY,
    queryFn: () =>
      apiClient.get<any[]>('/violation-rules').then(r => r.data.map(normaliseRule)),
    staleTime: 10 * 60_000,
    placeholderData: defaultRules,
  });
}

export function useSaveViolationRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: ViolationRule[]) =>
      apiClient.put('/violation-rules', JSON.stringify(rules), {
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (_data, rules) => {
      qc.setQueryData(RULES_KEY, rules);
    },
  });
}

export function useAvailableViolationFields() {
  return useQuery<AvailableField[]>({
    queryKey: FIELDS_KEY,
    queryFn: () =>
      apiClient.get<AvailableField[]>('/violation-rules/available-fields').then(r => r.data),
    staleTime: 30 * 60_000,
  });
}

export function useAvailableIssueTypes() {
  return useQuery<string[]>({
    queryKey: ISSUE_TYPES_KEY,
    queryFn: () =>
      apiClient.get<string[]>('/violation-rules/issue-types').then(r => r.data),
    staleTime: 30 * 60_000,
  });
}

/** Distinct issue status names — used to populate status-filter multiselects */
export function useAvailableStatuses() {
  return useQuery<string[]>({
    queryKey: STATUSES_KEY,
    queryFn: () =>
      apiClient.get<string[]>('/violation-rules/statuses').then(r => r.data),
    staleTime: 30 * 60_000,
  });
}

/** Distinct values for a specific custom field — used by the 'one-of' check editor */
export function useFieldValues(fieldId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['violation-rules', 'field-values', fieldId],
    queryFn: () =>
      apiClient.get<string[]>(`/violation-rules/field-values/${fieldId}`).then(r => r.data),
    enabled: !!fieldId,
    staleTime: 15 * 60_000,
  });
}

export function useSyncFieldNames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ status: string; fields_updated: number; message: string }>(
        '/power-dashboard/fields/sync-names'
      ).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FIELDS_KEY });
    },
  });
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const defaultRules: ViolationRule[] = [
  { id: 'missing-date',    label: 'Missing Due Date',     enabled: true,  builtIn: true,
    checks: [{ id: 'c1', type: 'required',    statuses: [] }] },
  { id: 'overdue',         label: 'Overdue',              enabled: true,  builtIn: true,
    checks: [{ id: 'c1', type: 'not-overdue', statuses: [] }] },
  { id: 'no-version',      label: 'No Fix Version',       enabled: true,  builtIn: true,
    checks: [{ id: 'c1', type: 'required',    statuses: [] }] },
  { id: 'long-running',    label: 'Long Running',         enabled: true,  builtIn: true,
    checks: [{ id: 'c1', type: 'threshold',   statuses: [], threshold: 5 }] },
  { id: 'no-story-points', label: 'Missing Story Points', enabled: false, builtIn: true,
    checks: [{ id: 'c1', type: 'required',    statuses: [] }] },
];
