import { COLOR_AMBER, COLOR_BLUE_LIGHT, COLOR_ERROR, COLOR_ORANGE, COLOR_SUCCESS, GRAY_300, SURFACE_ERROR, SURFACE_SUBTLE, SURFACE_SUCCESS, SURFACE_WARNING } from '../brandTokens';
export const utilizationColors = {
  under: COLOR_SUCCESS,
  normal: COLOR_AMBER,
  over: COLOR_ORANGE,
  critical: COLOR_ERROR,
};

export const priorityColors: Record<string, string> = {
  HIGHEST: COLOR_ERROR,
  HIGH:    COLOR_ORANGE,
  MEDIUM:  COLOR_BLUE_LIGHT,
  LOW:     '#818cf8',  // indigo-400
  LOWEST:  GRAY_300,
  BLOCKER: COLOR_ERROR,
  MINOR:   GRAY_300,
};

export const statusColors: Record<string, string> = {
  ACTIVE: COLOR_SUCCESS,
  ON_HOLD: COLOR_AMBER,
  COMPLETED: COLOR_BLUE_LIGHT,
  CANCELLED: COLOR_ERROR,
};

export const gapColors = {
  surplus: SURFACE_SUCCESS,
  deficit: SURFACE_ERROR,
  neutral: SURFACE_SUBTLE,
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
  if (percent < 80) return SURFACE_SUCCESS;
  if (percent <= 100) return SURFACE_WARNING;
  if (percent <= 120) return '#ffe8cc';
  return SURFACE_ERROR;
}

export function getConcurrencyColor(count: number, dark = false): string {
  if (dark) {
    if (count <= 2) return 'rgba(64, 192, 87, 0.15)';
    if (count <= 4) return 'rgba(250, 176, 5, 0.15)';
    return 'rgba(250, 82, 82, 0.2)';
  }
  if (count <= 2) return SURFACE_SUCCESS;
  if (count <= 4) return SURFACE_WARNING;
  return SURFACE_ERROR;
}

export function getConcurrencyColorByLevel(level: string, dark = false): string {
  if (dark) {
    if (level === 'LOW') return 'rgba(64, 192, 87, 0.15)';
    if (level === 'MEDIUM') return 'rgba(250, 176, 5, 0.15)';
    return 'rgba(250, 82, 82, 0.2)';
  }
  if (level === 'LOW') return SURFACE_SUCCESS;
  if (level === 'MEDIUM') return SURFACE_WARNING;
  return SURFACE_ERROR;
}

export function getGapCellColor(gap: number, dark = false): string {
  const colors = dark ? gapColorsDark : gapColors;
  if (gap > 0) return colors.surplus;
  if (gap < 0) return colors.deficit;
  return colors.neutral;
}
