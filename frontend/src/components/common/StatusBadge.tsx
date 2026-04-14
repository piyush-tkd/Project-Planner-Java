import { Badge } from '@mantine/core';
import { ProjectStatus } from '../../types';

const statusConfig: Record<string, { color: string; label: string }> = {
  [ProjectStatus.NOT_STARTED]: { color: 'gray', label: 'Not Started' },
  [ProjectStatus.IN_DISCOVERY]: { color: 'violet', label: 'In Discovery' },
  [ProjectStatus.ACTIVE]: { color: 'green', label: 'Active' },
  [ProjectStatus.ON_HOLD]: { color: 'yellow', label: 'On Hold' },
  [ProjectStatus.COMPLETED]: { color: 'blue', label: 'Completed' },
  [ProjectStatus.CANCELLED]: { color: 'red', label: 'Cancelled' },
};

/**
 * Derive a badge color from the raw Jira statusCategory.key.
 *  "done"          → teal (completed work)
 *  "indeterminate" → orange (in-progress / active work)
 *  "new"           → gray  (not yet started)
 *  unknown / null  → gray
 */
function colorFromCategory(category: string | null | undefined): string {
  switch (category) {
    case 'done':          return 'teal';
    case 'indeterminate': return 'orange';
    case 'new':           return 'gray';
    default:              return 'gray';
  }
}

/**
 * Fallback: derive a reasonable color from the raw status name alone
 * (used when no category is available, e.g. for imported-but-not-yet-synced rows).
 */
function colorFromStatusName(status: string): string {
  const s = status.toUpperCase();
  if (/DONE|COMPLETE|CLOSED|RELEASED|SHIPPED/.test(s))      return 'teal';
  if (/CANCEL/.test(s))                                       return 'red';
  if (/HOLD|BLOCKED|PARKED|DEFERRED|SUSPEND|PAUSE/.test(s)) return 'yellow';
  if (/DISCOVERY|FUNNEL|DRAFT|BACKLOG/.test(s))              return 'violet';
  if (
    /ACTIVE|IN.PROGRESS|IN.DEV|DEVELOPMENT|TESTING|REVIEW|ONGOING|IMPLEMENTATION/.test(s)
  )                                                           return 'orange';
  return 'gray';
}

interface StatusBadgeProps {
  status: string;
  /** Raw Jira statusCategory.key ("new" | "indeterminate" | "done"). Pass for Jira projects. */
  jiraStatusCategory?: string | null;
}

export default function StatusBadge({ status, jiraStatusCategory }: StatusBadgeProps) {
  // If this is a known PP enum status, use the pre-defined config unchanged.
  if (statusConfig[status]) {
    const cfg = statusConfig[status];
    return <Badge color={cfg.color} variant="light">{cfg.label}</Badge>;
  }

  // For raw Jira status strings: prefer category-derived color, fall back to name-derived.
  const color = jiraStatusCategory
    ? colorFromCategory(jiraStatusCategory)
    : colorFromStatusName(status);

  // Display the raw status as-is (preserve original capitalisation).
  return <Badge color={color} variant="light">{status}</Badge>;
}
