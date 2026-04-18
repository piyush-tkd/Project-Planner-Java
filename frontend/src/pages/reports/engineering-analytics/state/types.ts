/* ── Types ───────────────────────────────────────────────────────────────── */
export type TabType = 'overview' | 'quality' | 'delivery' | 'team' | 'operations';

export interface ProjectOption {
  value: string;
  label: string;
}

export interface StatusBadge {
  label: string;
  color: string;
}
