import { useState, useMemo } from 'react';
import { Title, Stack, Table, Text, Badge, Tooltip, Group, TextInput, Select, Button, ScrollArea} from '@mantine/core';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import { useResourceAllocation } from '../../api/reports';
import { useAllAvailability } from '../../api/resources';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { formatPercent, formatResourceName } from '../../utils/formatting';
import MonthHeader from '../../components/common/MonthHeader';
import SortableHeader from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { formatRole } from '../../types';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';

export default function ResourceAllocationPage() {
 const { data, isLoading, error } = useResourceAllocation();
 const { data: availability } = useAllAvailability();
 const { monthLabels, currentMonthIndex, workingHoursPerMonth } = useMonthLabels();
 const dark = useDarkMode();
 const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
 const months = Array.from({ length: 12 }, (_, i) => i + 1);

 const [search, setSearch] = useState('');
 const [podFilter, setPodFilter] = useState<string | null>(null);
 const [roleFilter, setRoleFilter] = useState<string | null>(null);

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

 const podOptions = useMemo(() => {
 const pods = [...new Set(resourceRows.map(r => r.podName))].sort();
 return pods.map(p => ({ value: p, label: p }));
 }, [resourceRows]);

 const roleOptions = useMemo(() => {
 const roles = [...new Set(resourceRows.map(r => r.role))].sort();
 return roles.map(r => ({ value: r, label: formatRole(r) }));
 }, [resourceRows]);

 const filteredRows = useMemo(() => {
 let list = resourceRows;
 if (search.trim()) {
 const q = search.trim().toLowerCase();
 list = list.filter(r => r.resourceName.toLowerCase().includes(q));
 }
 if (podFilter) list = list.filter(r => r.podName === podFilter);
 if (roleFilter) list = list.filter(r => r.role === roleFilter);
 return list;
 }, [resourceRows, search, podFilter, roleFilter]);

 const rowsWithAvg = useMemo(() => filteredRows.map(r => {
 const utils = months.map(m => r.monthlyUtilization.get(m) ?? 0).filter(u => u > 0);
 const avgUtil = utils.length > 0 ? utils.reduce((s, u) => s + u, 0) / utils.length : 0;
 return { ...r, avgUtil };
 }), [filteredRows, months]);

 const { sorted, sortKey, sortDir, onSort } = useTableSort(rowsWithAvg);

 const hasFilters = search.trim() !== '' || podFilter !== null || roleFilter !== null;

 if (isLoading) return <LoadingSpinner variant="table" message="Loading resource allocation..." />;
 if (error) return <PageError context="loading resource allocation data" error={error} />;

 return (
 <Stack className="page-enter stagger-children">
 <Group className="slide-in-left">
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>Resource Allocation</Title>
 </Group>

 <Group gap="sm" align="flex-end" wrap="wrap" className="stagger-children">
 <TextInput
 placeholder="Search by name…"
 leftSection={<IconSearch size={15} />}
 value={search}
 onChange={e => setSearch(e.currentTarget.value)}
 style={{ flex: '1 1 200px', maxWidth: 280 }}
 size="sm"
 />
 <Select
 placeholder="All PODs"
 data={podOptions}
 value={podFilter}
 onChange={setPodFilter}
 clearable
 searchable
 style={{ flex: '1 1 180px', maxWidth: 240 }}
 size="sm"
 />
 <Select
 placeholder="All Roles"
 data={roleOptions}
 value={roleFilter}
 onChange={setRoleFilter}
 clearable
 style={{ flex: '1 1 150px', maxWidth: 200 }}
 size="sm"
 />
 {hasFilters && (
 <Button variant="subtle" color="gray" size="sm"
 onClick={() => { setSearch(''); setPodFilter(null); setRoleFilter(null); }}>
 Clear filters
 </Button>
 )}
 <Text size="sm" c="dimmed" ml="auto">
 {sorted.length} of {resourceRows.length} resources
 </Text>
 </Group>

 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <SortableHeader sortKey="resourceName" currentKey={sortKey} dir={sortDir} onSort={onSort} style={{ minWidth: 200, whiteSpace: 'nowrap' }}>Resource</SortableHeader>
 <SortableHeader sortKey="role" currentKey={sortKey} dir={sortDir} onSort={onSort} style={{ minWidth: 80, whiteSpace: 'nowrap' }}>Role</SortableHeader>
 <Table.Th style={{ minWidth: 70, whiteSpace: 'nowrap' }}>FTE</Table.Th>
 <SortableHeader sortKey="podName" currentKey={sortKey} dir={sortDir} onSort={onSort} style={{ minWidth: 100, whiteSpace: 'nowrap' }}>POD</SortableHeader>
 <SortableHeader sortKey="avgUtil" currentKey={sortKey} dir={sortDir} onSort={onSort} style={{ minWidth: 70, whiteSpace: 'nowrap' }}>Avg %</SortableHeader>
 <MonthHeader monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} />
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sorted.map((row, i) => {
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
 <Table.Td style={{ textAlign: 'center', fontWeight: 600, fontSize: 12 }}>
 {row.avgUtil > 0 ? formatPercent(row.avgUtil) : '-'}
 </Table.Td>
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
 {sorted.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={17}><Text ta="center" c="dimmed" py="md">No resources match the current filters</Text></Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Stack>
 );
}
