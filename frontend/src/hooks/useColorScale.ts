import { useCallback } from 'react';
import { getUtilizationColor, getUtilizationBgColor } from '../utils/colors';
import { useDarkMode } from './useDarkMode';

export function useColorScale() {
  const dark = useDarkMode();
  const getColor = useCallback((percent: number) => getUtilizationColor(percent), []);
  const getBgColor = useCallback((percent: number) => getUtilizationBgColor(percent, dark), [dark]);

  return { getColor, getBgColor, dark };
}
