import { useMemo } from 'react';
import { Title, Stack, Table, Text, Badge, Tooltip, Group, ScrollArea} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { usePodResourceSummary } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import MonthHeader from '../../components/common/MonthHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { useDarkMode } from '../../hooks/useDarkMode';
import { DEEP_BLUE, SURFACE_ERROR, SURFACE_SUBTLE, SURFACE_SUCCESS } from '../../brandTokens';

const ROLES = ['DEVELOPER', 'QA', 'BSA', 'TECH_LEAD'];
const ROLE_COLORS: Record<string, string> = {
 DEVELOPER: 'blue',
 QA: 'orange',
 BSA: 'green',
 TECH_LEAD: 'violet'
};

function getFteCellStyle(effectiveFte: number, homeFte: number, dark = false) {
 const diff = Math.round((effectiveFte - homeFte) * 100) / 100;
 if (diff > 0) return { backgroundColor: dark ? 'rgba(64, 192, 87, 0.15)' : SURFACE_SUCCESS };
 if (diff < 0) return { backgroundColor: dark ? 'rgba(250, 82, 82, 0.15)' : SURFACE_ERROR };
 return {};
}

function fmtFte(v: number) {
 return v % 1 === 0 ? String(v) : v.toFixed(1);
}

export default function PodResourceSummaryPage() {
 const { data, isLoading, error } = usePodResourceSummary();
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const dark = useDarkMode();
 const pastBg = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;
 const months = Array.from({ length: 12 }, (_, i) => i + 1);

 const pods = useMemo(() => data ?? [], [data]);

 if (isLoading) return <LoadingSpinner variant="table" message="Loading POD resources..." />;
 if (error) return <PageError context="loading POD resource summary" error={error} />;

 return (
 <Stack className="page-enter stagger-children">
 <Group className="slide-in-left">
 <Title order={2} style={{color: dark ? '#fff' : DEEP_BLUE }}>POD Resources</Title>
 </Group>

 <Title order={4}>Home Assignments</Title>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 160 }}>POD</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Headcount</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>FTE</Table.Th>
 {ROLES.map(r => (
 <Table.Th key={r} style={{ textAlign: 'center' }}>{r}</Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {pods.map(pod => (
 <Table.Tr key={pod.podId}>
 <Table.Td fw={500}>{pod.podName}</Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Badge size="lg" variant="filled" color="gray">{pod.homeCount}</Badge>
 </Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Badge
 size="lg"
 variant="light"
 color={pod.homeFte < pod.homeCount ? 'orange' : 'gray'}
 leftSection={pod.homeFte < pod.homeCount ? <IconAlertTriangle size={12} /> : undefined}
 >
 {fmtFte(pod.homeFte)}
 </Badge>
 {pod.homeFte < pod.homeCount && (
 <Tooltip label={`${pod.homeCount - Math.floor(pod.homeFte)} part-time resource(s) in this POD`}>
 <Text size="xs" c="orange" ta="center" mt={2}>
 {pod.homeCount - Math.floor(pod.homeFte)} part-time
 </Text>
 </Tooltip>
 )}
 </Table.Td>
 {ROLES.map(r => {
 const count = pod.homeCountByRole[r] ?? 0;
 const fte = pod.homeFteByRole[r] ?? 0;
 const hasPartTime = fte < count;
 const label = count === fte ? String(count) : `${count} (${fmtFte(fte)})`;
 return (
 <Table.Td key={r} style={{ textAlign: 'center' }}>
 <Badge
 variant="light"
 color={hasPartTime ? 'orange' : ROLE_COLORS[r]}
 leftSection={hasPartTime ? <IconAlertTriangle size={10} /> : undefined}
 >
 {label}
 </Badge>
 </Table.Td>
 );
 })}
 </Table.Tr>
 ))}
 {pods.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={3 + ROLES.length}>
 <Text ta="center" c="dimmed" py="md">No data</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>

 <Title order={4} mt="lg">Effective FTE per Month (post-override)</Title>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 160 }}>POD</Table.Th>
 <Table.Th style={{ textAlign: 'center' }}>Home FTE</Table.Th>
 <MonthHeader monthLabels={monthLabels} currentMonthIndex={currentMonthIndex} />
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {pods.map(pod => (
 <Table.Tr key={pod.podId}>
 <Table.Td fw={500}>{pod.podName}</Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <Text size="sm" fw={600}>{fmtFte(pod.homeFte)}</Text>
 </Table.Td>
 {months.map(m => {
 const me = pod.monthlyEffective.find(e => e.monthIndex === m);
 const fte = me?.effectiveFte ?? 0;
 const diff = Math.round((fte - pod.homeFte) * 100) / 100;
 return (
 <Table.Td
 key={m}
 style={{
 textAlign: 'center',
 ...(m < currentMonthIndex
 ? { opacity: 0.5, backgroundColor: pastBg }
 : getFteCellStyle(fte, pod.homeFte, dark))}}
 >
 <Text size="xs" fw={diff !== 0 ? 700 : 400}>
 {fmtFte(fte)}
 </Text>
 </Table.Td>
 );
 })}
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Stack>
 );
}
