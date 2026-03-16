import { useMemo } from 'react';
import { Title, Stack, Table, Text, Badge, Tooltip, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useResourceAllocation } from '../../api/reports';
import { useAllAvailability } from '../../api/resources';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { formatPercent, formatResourceName } from '../../utils/formatting';
import MonthHeader from '../../components/common/MonthHeader';
import { formatRole } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ResourceAllocationPage() {
  const { data, isLoading, error } = useResourceAllocation();
  const { data: availability } = useAllAvailability();
  const { monthLabels, currentMonthIndex, workingHoursPerMonth } = useMonthLabels();
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  /* ── FTE and over-alloc lookup ── */
  const fteMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!availability) return map;
    for (const row of availability) map.set(row.resourceId, row.capacityFte);
    return map;
  }, [availability]);

  const overAllocMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!availability) return map;
    for (const row of availability) {
      if (row.capacityFte >= 1) continue;
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const hours = row.months[m] ?? 0;
        const max = Math.round((workingHoursPerMonth[m] ?? 160) * row.capacityFte);
        if (hours > max) count++;
      }
      if (count > 0) map.set(row.resourceId, count);
    }
    return map;
  }, [availability, workingHoursPerMonth]);

  const resourceRows = useMemo(() => {
    if (!data) return [];
    const rowMap = new Map<string, { resourceId: number; resourceName: string; role: string; podName: string; monthlyUtilization: Map<number, number> }>();
    data.forEach(d => {
      const key = `${d.resourceId}-${d.podName}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, { resourceId: d.resourceId, resourceName: d.resourceName, role: d.role, podName: d.podName, monthlyUtilization: new Map() });
      }
      rowMap.get(key)!.monthlyUtilization.set(d.monthIndex, d.utilizationPct);
    });
    return Array.from(rowMap.values());
  }, [data]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading resource allocation data</Text>;

  return (
    <Stack>
      <Title order={2}>Resource Allocation</Title>

      <Table.ScrollContainer minWidth={1300}>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 200, whiteSpace: 'nowrap' }}>Resource</Table.Th>
              <Table.Th style={{ minWidth: 80, whiteSpace: 'nowrap' }}>Role</Table.Th>
              <Table.Th style={{ minWidth: 70, whiteSpace: 'nowrap' }}>FTE</Table.Th>
              <Table.Th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>POD</Table.Th>
              <MonthHeader monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resourceRows.map((row, i) => {
              const fte = fteMap.get(row.resourceId) ?? 1;
              const isPartTime = fte < 1;
              const overCount = overAllocMap.get(row.resourceId);
              return (
              <Table.Tr key={i}>
                <Table.Td fw={500} style={{ whiteSpace: 'nowrap' }}>
                  <Group gap={6} wrap="nowrap">
                    {formatResourceName(row.resourceName)}
                    {overCount && (
                      <Tooltip label={`${overCount} month(s) exceed ${Math.round(fte * 100)}% FTE cap`}>
                        <IconAlertTriangle size={16} color="orange" />
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatRole(row.role)}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={isPartTime ? 'orange' : 'green'} size="sm">
                    {isPartTime ? `${Math.round(fte * 100)}%` : '100%'}
                  </Badge>
                </Table.Td>
                <Table.Td>{row.podName}</Table.Td>
                {months.map(m => {
                  const util = row.monthlyUtilization.get(m) ?? 0;
                  return (
                    <Table.Td
                      key={m}
                      style={{
                        textAlign: 'center',
                        ...(m < currentMonthIndex
                          ? { opacity: 0.5, backgroundColor: pastBg }
                          : { backgroundColor: util > 0 ? getUtilizationBgColor(util, dark) : undefined }),
                      }}
                    >
                      <Text size="xs">{util > 0 ? formatPercent(util) : '-'}</Text>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
              );
            })}
            {resourceRows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={16}><Text ta="center" c="dimmed" py="md">No data</Text></Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
