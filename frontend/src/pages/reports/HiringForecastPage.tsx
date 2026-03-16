import { useMemo } from 'react';
import { Title, Stack, Table, Text } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useHiringForecast } from '../../api/reports';
import { formatHours, formatFte } from '../../utils/formatting';
import { formatRole } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ExportableChart from '../../components/common/ExportableChart';

export default function HiringForecastPage() {
  const { data, isLoading, error } = useHiringForecast();

  const chartData = useMemo(() => {
    if (!data) return [];
    const monthMap = new Map<string, Record<string, number>>();
    data.forEach(d => {
      const existing = monthMap.get(d.monthLabel) ?? {};
      existing[d.role] = (existing[d.role] ?? 0) + d.ftesNeeded;
      monthMap.set(d.monthLabel, existing);
    });
    return Array.from(monthMap.entries()).map(([month, roles]) => ({ month, ...roles }));
  }, [data]);

  const roles = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(d => d.role))];
  }, [data]);

  const roleColors: Record<string, string> = {
    DEVELOPER: '#339af0', QA: '#ff922b', BSA: '#51cf66', TECH_LEAD: '#845ef7',
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading hiring forecast</Text>;

  return (
    <Stack>
      <Title order={2}>Hiring Forecast</Title>

      <Table withTableBorder withColumnBorders striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>POD</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Month</Table.Th>
            <Table.Th>Deficit Hours</Table.Th>
            <Table.Th>FTEs Needed</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(data ?? []).map((d, i) => (
            <Table.Tr key={i}>
              <Table.Td>{d.podName}</Table.Td>
              <Table.Td>{formatRole(d.role)}</Table.Td>
              <Table.Td>{d.monthLabel}</Table.Td>
              <Table.Td>{formatHours(d.deficitHours)}</Table.Td>
              <Table.Td>{formatFte(d.ftesNeeded)}</Table.Td>
            </Table.Tr>
          ))}
          {(data ?? []).length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">No hiring needs identified</Text></Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {chartData.length > 0 && (
        <>
          <ExportableChart title="Hiring Needs Over Time">
            <Title order={4} mt="lg">Hiring Needs Over Time</Title>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                {roles.map(role => (
                  <Bar key={role} dataKey={role} name={formatRole(role)} stackId="a" fill={roleColors[role] ?? '#868e96'} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ExportableChart>
        </>
      )}
    </Stack>
  );
}
