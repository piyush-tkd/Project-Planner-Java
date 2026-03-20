export function formatHours(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatFte(n: number): string {
  return n.toFixed(1);
}

export function formatGapHours(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toLocaleString();
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `−${formatted}`;
  return formatted;
}

export function formatGapFte(n: number): string {
  const abs = Math.abs(n).toFixed(1);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

export function formatMonth(index: number, labels: Record<number, string>): string {
  return labels[index] ?? `M${index}`;
}

/** Replace raw role enum values in a resource name with display-friendly text. */
export function formatResourceName(name: string): string {
  return name
    .replace(/TECH_LEAD/g, 'Tech Lead')
    .replace(/DEVELOPER/g, 'Developer');
}

/** Format a project date for display, falling back to month label if no date.
 * Returns "TBD" when both isoDate and monthIndex are absent. */
export function formatProjectDate(
  isoDate: string | null | undefined,
  monthIndex: number | null | undefined,
  monthLabels: Record<number, string>,
): string {
  if (isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (monthIndex == null) return 'TBD';
  return monthLabels[monthIndex] ?? `M${monthIndex}`;
}
