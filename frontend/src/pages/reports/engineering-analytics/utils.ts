import { StatusBadge } from './state/types';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
export const JIRA_BASE = 'https://baylorgenetics.atlassian.net';

export function jiraLink(issueKey: string) {
  return `${JIRA_BASE}/browse/${issueKey}`;
}

export function statusBadge(pct: number): StatusBadge {
  if (pct >= 80) return { label: 'HEALTHY', color: 'green' };
  if (pct >= 50) return { label: 'CAUTION', color: 'yellow' };
  return { label: 'LOW', color: 'red' };
}

export function fmt1(n: number): string {
  return typeof n === 'number' ? n.toFixed(1) : '—';
}

export function fmt0(n: number): string {
  return typeof n === 'number' ? n.toFixed(0) : '—';
}

export function fmtDate(val: any): string {
  if (!val) return '—';
  const s = String(val);
  // Extract just the date part YYYY-MM-DD
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return s.slice(0, 10);
  const [year, month, day] = m[1].split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(month)-1]} ${parseInt(day)}, ${year}`;
}
