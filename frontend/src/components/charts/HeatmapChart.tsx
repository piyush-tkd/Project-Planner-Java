import { Table, Text } from '@mantine/core';
import { useDarkMode } from '../../hooks/useDarkMode';

interface HeatmapRow {
  label: string;
  values: { month: number; value: number; display: string }[];
}

interface HeatmapChartProps {
  rows: HeatmapRow[];
  monthLabels: Record<number, string>;
  colorFn: (value: number, dark?: boolean) => string;
  currentMonthIndex?: number;
}

export default function HeatmapChart({ rows, monthLabels, colorFn, currentMonthIndex }: HeatmapChartProps) {
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <Table.ScrollContainer minWidth={900}>
      <Table striped={false} withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 140 }}>POD</Table.Th>
            {months.map(m => {
              const isPast = currentMonthIndex ? m < currentMonthIndex : false;
              return (
                <Table.Th
                  key={m}
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    minWidth: 70,
                    ...(isPast ? { color: '#adb5bd', backgroundColor: pastBg } : {}),
                  }}
                >
                  {monthLabels[m] ?? `M${m}`}
                </Table.Th>
              );
            })}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(row => (
            <Table.Tr key={row.label}>
              <Table.Td fw={500}>{row.label}</Table.Td>
              {months.map(m => {
                const cell = row.values.find(v => v.month === m);
                const val = cell?.value ?? 0;
                const display = cell?.display ?? '-';
                const isPast = currentMonthIndex ? m < currentMonthIndex : false;
                return (
                  <Table.Td
                    key={m}
                    style={{
                      textAlign: 'center',
                      backgroundColor: isPast ? pastBg : colorFn(val, dark),
                      ...(isPast ? { opacity: 0.5 } : {}),
                    }}
                  >
                    <Text size="xs" fw={500} c={isPast ? 'dimmed' : undefined}>{display}</Text>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
