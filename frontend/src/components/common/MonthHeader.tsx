import { Table } from '@mantine/core';
import { useDarkMode } from '../../hooks/useDarkMode';
import { GRAY_300, SURFACE_SUBTLE } from '../../brandTokens';

interface MonthHeaderProps {
  monthLabels: Record<number, string>;
  currentMonthIndex?: number;
}

export default function MonthHeader({ monthLabels, currentMonthIndex }: MonthHeaderProps) {
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;

  return (
    <>
      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
        <Table.Th
          key={m}
          style={{
            textAlign: 'center',
            fontSize: 12,
            minWidth: 70,
            ...(currentMonthIndex && m < currentMonthIndex
              ? { color: GRAY_300, backgroundColor: pastBg }
              : {}),
          }}
        >
          {monthLabels[m] ?? `M${m}`}
        </Table.Th>
      ))}
    </>
  );
}
