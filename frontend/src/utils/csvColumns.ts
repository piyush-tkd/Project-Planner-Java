import type { CsvColumnDef } from './csv';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Projects ────────────────────────────────────────────────
export const projectColumns: CsvColumnDef<any>[] = [
  { key: 'name', header: 'Name' },
  { key: 'priority', header: 'Priority' },
  { key: 'owner', header: 'Owner' },
  { key: 'startMonth', header: 'Start Month' },
  { key: 'durationMonths', header: 'Duration (Months)' },
  { key: 'defaultPattern', header: 'Default Pattern' },
  { key: 'status', header: 'Status' },
  { key: 'notes', header: 'Notes' },
  { key: 'startDate', header: 'Start Date' },
  { key: 'targetDate', header: 'Target Date' },
];

// ─── Resources ───────────────────────────────────────────────
export const resourceColumns: CsvColumnDef<any>[] = [
  { key: 'name', header: 'Name' },
  { key: 'role', header: 'Role' },
  { key: 'location', header: 'Location' },
  { key: 'active', header: 'Active', format: (r) => r.active ? 'Yes' : 'No' },
  { key: 'countsInCapacity', header: 'Counts in Capacity', format: (r) => r.countsInCapacity ? 'Yes' : 'No' },
  { key: 'podAssignment.podName', header: 'Home POD' },
  { key: 'podAssignment.capacityFte', header: 'Capacity FTE' },
];

// ─── Pods ────────────────────────────────────────────────────
export const podColumns: CsvColumnDef<any>[] = [
  { key: 'name', header: 'Name' },
  { key: 'complexityMultiplier', header: 'Complexity Multiplier' },
  { key: 'active', header: 'Active', format: (r) => r.active ? 'Yes' : 'No' },
];

// ─── BAU Assumptions ─────────────────────────────────────────
export const bauColumns: CsvColumnDef<any>[] = [
  { key: 'podName', header: 'POD' },
  { key: 'role', header: 'Role' },
  { key: 'bauPct', header: 'BAU %' },
];

// ─── Availability (pivot: resource × 12 months) ─────────────
export function availabilityColumns(monthLabels: Record<number, string>): CsvColumnDef<any>[] {
  const cols: CsvColumnDef<any>[] = [
    { key: 'resourceName', header: 'Resource' },
    { key: 'capacityFte', header: 'FTE' },
  ];
  for (let m = 1; m <= 12; m++) {
    const label = monthLabels[m] ?? `M${m}`;
    cols.push({
      key: `months.${m}`,
      header: label,
      format: (row) => row.months?.[m] ?? 0,
    });
  }
  return cols;
}

// ─── Overrides ───────────────────────────────────────────────
export const overrideColumns: CsvColumnDef<any>[] = [
  { key: 'resourceName', header: 'Resource' },
  { key: 'toPodName', header: 'To POD' },
  { key: 'startMonth', header: 'Start Month' },
  { key: 'endMonth', header: 'End Month' },
  { key: 'allocationPct', header: 'Allocation %' },
  { key: 'notes', header: 'Notes' },
];

// ─── T-shirt Sizes ───────────────────────────────────────────
export const tshirtSizeColumns: CsvColumnDef<any>[] = [
  { key: 'name', header: 'Name' },
  { key: 'baseHours', header: 'Base Hours' },
  { key: 'displayOrder', header: 'Display Order' },
];

// ─── Effort Patterns ─────────────────────────────────────────
export const effortPatternColumns: CsvColumnDef<any>[] = [
  { key: 'name', header: 'Name' },
  { key: 'description', header: 'Description' },
  {
    key: 'weights',
    header: 'Weights',
    format: (r) =>
      Object.entries(r.weights ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(', '),
  },
];

// ─── Role Effort Mix ─────────────────────────────────────────
export const roleMixColumns: CsvColumnDef<any>[] = [
  { key: 'role', header: 'Role' },
  { key: 'mixPct', header: 'Mix %' },
];

// ─── Working Hours (Timeline) ────────────────────────────────
export function workingHoursColumns(monthLabels: Record<number, string>): CsvColumnDef<any>[] {
  const cols: CsvColumnDef<any>[] = [];
  for (let m = 1; m <= 12; m++) {
    cols.push({
      key: `M${m}`,
      header: monthLabels[m] ?? `M${m}`,
    });
  }
  return cols;
}
