import { AnalyticsBreakdown } from '../../../../api/jira';

export function sortAndLimitData(
  data: AnalyticsBreakdown[] | undefined | null,
  sortBy: string = 'count',
  direction: string = 'desc',
  limit: number = 10,
): AnalyticsBreakdown[] {
  let sorted = [...(data ?? [])];
  if (sortBy === 'count') {
    sorted.sort((a, b) => direction === 'desc' ? b.count - a.count : a.count - b.count);
  } else if (sortBy === 'sp') {
    sorted.sort((a, b) => direction === 'desc' ? (b.sp || 0) - (a.sp || 0) : (a.sp || 0) - (b.sp || 0));
  } else if (sortBy === 'hours') {
    sorted.sort((a, b) => direction === 'desc' ? (b.hours || 0) - (a.hours || 0) : (a.hours || 0) - (b.hours || 0));
  } else if (sortBy === 'name') {
    sorted.sort((a, b) => direction === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  }
  return sorted.slice(0, limit);
}

export function generateCsvFromData(title: string, data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvContent = [
    [title],
    headers.map(h => `"${h}"`).join(','),
    ...data.map(row => headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
      return String(v);
    }).join(',')),
  ].join('\n');
  return csvContent;
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function sizeToSpan(size: string): number {
  if (size === 'full') return 12;
  if (size === 'half') return 6;
  if (size === 'third') return 4;
  if (size === 'quarter') return 3;
  return 6;
}

export function joinsForDim(dim: string): ('worklogs' | 'labels' | 'components' | 'fixVersions')[] {
  if (dim === 'labels') return ['labels'];
  if (dim === 'components') return ['components'];
  if (dim === 'fixVersions') return ['fixVersions'];
  return [];
}
