import { useComputedColorScheme } from '@mantine/core';

export function useDarkMode() {
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  return computedColorScheme === 'dark';
}
