export const utilizationColors = {
  under: '#40c057',
  normal: '#fab005',
  over: '#fd7e14',
  critical: '#fa5252',
};

export const priorityColors: Record<string, string> = {
  P0: '#fa5252',
  P1: '#fd7e14',
  P2: '#339af0',
  P3: '#adb5bd',
};

export const statusColors: Record<string, string> = {
  ACTIVE: '#40c057',
  ON_HOLD: '#fab005',
  COMPLETED: '#339af0',
  CANCELLED: '#fa5252',
};

export const gapColors = {
  surplus: '#d3f9d8',
  deficit: '#ffe3e3',
  neutral: '#f8f9fa',
};

export const gapColorsDark = {
  surplus: 'rgba(64, 192, 87, 0.15)',
  deficit: 'rgba(250, 82, 82, 0.15)',
  neutral: 'rgba(255, 255, 255, 0.04)',
};

export function getUtilizationColor(percent: number): string {
  if (percent < 80) return utilizationColors.under;
  if (percent <= 100) return utilizationColors.normal;
  if (percent <= 120) return utilizationColors.over;
  return utilizationColors.critical;
}

export function getUtilizationBgColor(percent: number, dark = false): string {
  if (dark) {
    if (percent < 80) return 'rgba(64, 192, 87, 0.15)';
    if (percent <= 100) return 'rgba(250, 176, 5, 0.15)';
    if (percent <= 120) return 'rgba(253, 126, 20, 0.2)';
    return 'rgba(250, 82, 82, 0.2)';
  }
  if (percent < 80) return '#d3f9d8';
  if (percent <= 100) return '#fff3bf';
  if (percent <= 120) return '#ffe8cc';
  return '#ffe3e3';
}

export function getConcurrencyColor(count: number, dark = false): string {
  if (dark) {
    if (count <= 2) return 'rgba(64, 192, 87, 0.15)';
    if (count <= 4) return 'rgba(250, 176, 5, 0.15)';
    return 'rgba(250, 82, 82, 0.2)';
  }
  if (count <= 2) return '#d3f9d8';
  if (count <= 4) return '#fff3bf';
  return '#ffe3e3';
}

export function getConcurrencyColorByLevel(level: string, dark = false): string {
  if (dark) {
    if (level === 'LOW') return 'rgba(64, 192, 87, 0.15)';
    if (level === 'MEDIUM') return 'rgba(250, 176, 5, 0.15)';
    return 'rgba(250, 82, 82, 0.2)';
  }
  if (level === 'LOW') return '#d3f9d8';
  if (level === 'MEDIUM') return '#fff3bf';
  return '#ffe3e3';
}

export function getGapCellColor(gap: number, dark = false): string {
  const colors = dark ? gapColorsDark : gapColors;
  if (gap > 0) return colors.surplus;
  if (gap < 0) return colors.deficit;
  return colors.neutral;
}
