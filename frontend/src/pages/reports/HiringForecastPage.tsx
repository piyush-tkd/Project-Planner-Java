import { useState, useMemo } from 'react';
import { Title, Stack, Table, Text, Group, Select, Button } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useHiringForecast } from '../../api/reports';
import { formatHours, formatFte } from '../../utils/formatting';
import { formatRole } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ExportableChart from '../../components/common/ExportableChart';
import ChartCard from '../../components/common/ChartCard';
import SortableHeader from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';

export default function HiringForecastPage() {
  const { data, isLoading, error } = useHiringForecast();
  const [podFilter, setPodFilter]   = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const allPods = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(d => d.podName))].sort().map(p => ({ value: p, label: p }));
  }, [data]);

  const roles = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(d => d.role))];
  }, [data]);

  const roleOptions = useMemo(() => roles.map(r => ({ value: r, label: formatRole(r) })), [roles]);

  const filteredData = useMemo(() => {
    let list = data ?? [];
    if (podFilter)  list = list.filter(d => d.podName === podFilter);
    if (roleFilter) list = list.filter(d => d.role === roleFilter);
    return list;
  }, [data, podFilter, roleFilter]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filteredData);

  const chartData = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>();
    filteredData.forEach(d => {
      const existing = monthMap.get(d.monthLabel) ?? {};
      existing[d.role] = (existing[d.role] ?? 0) + d.ftesNeeded;
      monthMap.set(d.monthLabel, existing);
    });
    return Array.from(monthMap.entries()).map(([month, r]) => ({ month, ...r }));
  }, [filteredData]);

  const roleColors: Record<string, string> = {
    DEVELOPER: '#339af0', QA: '#ff922b', BSA: '#51cf66', TECH_LEAD: '#845ef7',
  };

  const hasFilters = podFilter !== null || roleFilter !== null;

  if (isLoading) return <LoadingSpinner variant="chart" message="Loading hiring forecast..." />;
  if (error) return <PageError context="loading hiring forecast" error={error} />;

  return (
    <Stack className="page-enter stagger-children">
      <Group className="slide-in-left">
        <Title order={2}>Hiring Forecast</Title>
      </Group>

      <Group gap="sm" align="flex-end" wrap="wrap" className="stagger-children">
        <Select
          placeholder="All PODs"
          data={allPods}
          value={podFilter}
          onChange={setPodFilter}
          clearable
          searchable
          style={{ minWidth: 200, maxWidth: 280 }}
          size="sm"
        />
        <Select
          placeholder="All Roles"
          data={roleOptions}
          value={roleFilter}
          onChange={setRoleFilter}
          clearable
          style={{ minWidth: 160, maxWidth: 200 }}
          size="sm"
        />
        {hasFilters && (
          <Button variant="subtle" color="gray" size="sm"
            onClick={() => { setPodFilter(null); setRoleFilter(null); }}>
            Clear filters
          </Button>
        )}
        <Text size="sm" c="dimmed" ml="auto">
          {sorted.length} of {(data ?? []).length} rows
        </Text>
      </Group>

      <Table.ScrollContainer minWidth={600}>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <SortableHeader sortKey="podName" currentKey={sortKey} dir={sortDir} onSort={onSort}>POD</SortableHeader>
              <SortableHeader sortKey="role" currentKey={sortKey} dir={sortDir} onSort={onSort}>Role</SortableHeader>
              <SortableHeader sortKey="monthIndex" currentKey={sortKey} dir={sortDir} onSort={onSort}>Month</SortableHeader>
              <SortableHeader sortKey="deficitHours" currentKey={sortKey} dir={sortDir} onSort={onSort}>Deficit Hours</SortableHeader>
              <SortableHeader sortKey="ftesNeeded" currentKey={sortKey} dir={sortDir} onSort={onSort}>FTEs Needed</SortableHeader>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((d, i) => (
              <Table.Tr key={i}>
                <Table.Td>{d.podName}</Table.Td>
                <Table.Td>{formatRole(d.role)}</Table.Td>
                <Table.Td>{d.monthLabel}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatHours(d.deficitHours)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatFte(d.ftesNeeded)}</Table.Td>
              </Table.Tr>
            ))}
            {sorted.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">No hiring needs identified</Text></Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {chartData.length > 0 && (
        <ChartCard title="Hiring Needs Over Time" minHeight={350}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              {roles.filter(r => !roleFilter || r === roleFilter).map(role => (
                <Bar key={role} dataKey={role} name={formatRole(role)} stackId="a" fill={roleColors[role] ?? '#868e96'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </Stack>
  );
}
