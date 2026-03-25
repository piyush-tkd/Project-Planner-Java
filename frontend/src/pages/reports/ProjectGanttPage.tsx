import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Title, Stack, Text, Table, Box, Group, Chip, ScrollArea} from '@mantine/core';
import { useProjects } from '../../api/projects';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { useDarkMode } from '../../hooks/useDarkMode';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';
import PriorityBadge from '../../components/common/PriorityBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const PRIORITY_COLORS: Record<string, string> = {
 P0: '#dc2626',
 P1: '#ea580c',
 P2: '#2563eb',
 P3: '#64748b',
};

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

export default function ProjectGanttPage() {
 const { data: projects, isLoading } = useProjects();
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const navigate = useNavigate();
 const dark = useDarkMode();
 const months = Array.from({ length: 12 }, (_, i) => i + 1);
 const [selectedPriorities, setSelectedPriorities] = useState<string[]>(PRIORITIES);

 const activeProjects = useMemo(() => {
 if (!projects) return [];
 return projects
 .filter(p => p.status === 'ACTIVE' && selectedPriorities.includes(p.priority))
 .sort((a, b) => {
 const po: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
 return (po[a.priority] ?? 9) - (po[b.priority] ?? 9) || a.startMonth - b.startMonth;
 });
 }, [projects, selectedPriorities]);

 if (isLoading) return <LoadingSpinner variant="chart" message="Loading Gantt chart..." />;

 return (
 <Stack className="page-enter stagger-children">
 <Group className="slide-in-left">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>Project Gantt</Title>
 <Text size="sm" c="dimmed">
 {activeProjects.length} active projects sorted by priority then start month
 </Text>
 </div>
 </Group>

 <Group gap="xs" className="stagger-children">
 <Text size="xs" fw={600} c="dimmed">Filter by priority:</Text>
 <Chip.Group multiple value={selectedPriorities} onChange={setSelectedPriorities}>
 <Group gap={6}>
 {PRIORITIES.map(pri => (
 <Chip key={pri} value={pri} size="xs" variant="filled" color={
 pri === 'P0' ? 'red' : pri === 'P1' ? 'orange' : pri === 'P2' ? 'blue' : 'gray'
 }>
 {pri}
 </Chip>
 ))}
 </Group>
 </Chip.Group>
 </Group>

 <Box mb="xs" style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
 {Object.entries(PRIORITY_COLORS).map(([pri, color]) => (
 <Box key={pri} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
 <Box style={{ width: 12, height: 12, background: color, borderRadius: 2 }} />
 <Text size="xs">{pri}</Text>
 </Box>
 ))}
 </Box>

 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ width: 200 }}>Project</Table.Th>
 <Table.Th style={{ width: 50 }}>Pri</Table.Th>
 <Table.Th style={{ width: 70 }}>Owner</Table.Th>
 {months.map(m => (
 <Table.Th
 key={m}
 style={{
 textAlign: 'center',
 fontSize: 11,
 width: 65,
 ...(m < currentMonthIndex ? { color: '#94a3b8', fontWeight: 400, fontStyle: 'italic' } : {}),
 }}
 >
 {monthLabels[m] ?? `M${m}`}
 </Table.Th>
 ))}
 <Table.Th style={{ width: 60 }}>Dur</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {activeProjects.map(project => {
 const startIdx = project.startMonth;
 const endIdx = startIdx + project.durationMonths - 1;
 const color = PRIORITY_COLORS[project.priority] ?? '#64748b';

 return (
 <Table.Tr
 key={project.id}
 style={{ cursor: 'pointer' }}
 onClick={() => navigate(`/projects/${project.id}`)}
 >
 <Table.Td fw={600} style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
 {project.name}
 </Table.Td>
 <Table.Td><PriorityBadge priority={project.priority} /></Table.Td>
 <Table.Td style={{ fontSize: 11 }}>{project.owner}</Table.Td>
 {months.map(m => {
 const active = m >= startIdx && m <= endIdx;
 const isFirst = m === startIdx;
 const isLast = m === endIdx || m === Math.min(endIdx, 12);
 const isPast = m < currentMonthIndex;

 if (!active) {
 return (
 <Table.Td
 key={m}
 style={{
 padding: 0,
 background: isPast
 ? (dark ? 'rgba(255,255,255,0.02)' : '#f1f5f9')
 : (dark ? 'rgba(255,255,255,0.04)' : '#f8fafc'),
 }}
 />
 );
 }

 return (
 <Table.Td
 key={m}
 style={{
 padding: 0,
 background: color,
 borderRadius: `${isFirst ? '6px' : '0'} ${isLast ? '6px' : '0'} ${isLast ? '6px' : '0'} ${isFirst ? '6px' : '0'}`,
 ...(isPast ? { opacity: 0.4 } : {}),
 }}
 >
 {isFirst && endIdx - startIdx >= 2 && (
 <Text size="xs" c="white" fw={600} style={{ padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: '22px' }}>
 {project.name}
 </Text>
 )}
 </Table.Td>
 );
 })}
 <Table.Td style={{ fontSize: 11, textAlign: 'center' }}>{project.durationMonths}m</Table.Td>
 </Table.Tr>
 );
 })}
 {activeProjects.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={months.length + 4}>
 <Text ta="center" c="dimmed" py="md">No active projects</Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Stack>
 );
}
