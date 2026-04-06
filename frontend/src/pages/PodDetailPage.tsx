import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 Title, Text, Stack, Group, Card, Table, Badge, ActionIcon, SimpleGrid, Tooltip, ScrollArea, Avatar} from '@mantine/core';
import { IconBriefcase, IconUsers, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import NlpBreadcrumb from '../components/common/NlpBreadcrumb';
import { usePods } from '../api/pods';
import { usePodProjects } from '../api/projects';
import { useResources, useAllAvailability } from '../api/resources';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTableSort } from '../hooks/useTableSort';
import { formatRole } from '../types';
import { deriveTshirtSize } from '../types/project';
import { DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import SortableHeader from '../components/common/SortableHeader';
import SummaryCard from '../components/charts/SummaryCard';
import StatusBadge from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useDarkMode } from '../hooks/useDarkMode';

const FULL_TIME_HOURS = [176, 176, 168, 176, 176, 184, 168, 176, 176, 168, 184, 168];

export default function PodDetailPage() {
 const isDark = useDarkMode();
 const { id } = useParams<{ id: string }>();
 const podId = Number(id);
 const navigate = useNavigate();
 const { data: pods, isLoading: podsLoading } = usePods();
 const { data: podProjects, isLoading: projectsLoading } = usePodProjects(podId);
 const { data: resources, isLoading: resourcesLoading } = useResources();
 const { data: availability } = useAllAvailability();
 const { monthLabels } = useMonthLabels();

 const pod = pods?.find(p => p.id === podId);

 const members = useMemo(() => {
 if (!resources) return [];
 return resources.filter(r => r.podAssignment?.podId === podId);
 }, [resources, podId]);

 /* ── Over-allocation check per resource ──── */
 const overAllocMap = useMemo(() => {
 const map = new Map<number, number>();
 if (!availability) return map;
 for (const row of availability) {
 if (row.capacityFte >= 1) continue;
 let count = 0;
 for (let m = 1; m <= 12; m++) {
 const hours = row.months[m] ?? 0;
 const max = Math.round(FULL_TIME_HOURS[m - 1] * row.capacityFte);
 if (hours > max) count++;
 }
 if (count > 0) map.set(row.resourceId, count);
 }
 return map;
 }, [availability]);

 const stats = useMemo(() => {
 const projects = podProjects ?? [];
 const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
 const overAllocCount = members.filter(m => overAllocMap.has(m.id)).length;
 return {
 totalProjects: projects.length,
 activeProjects,
 members: members.length,
 totalFte: members.reduce((s, m) => s + (m.podAssignment?.capacityFte ?? 0), 0),
 overAllocCount,
 };
 }, [podProjects, members, overAllocMap]);

 const { sorted: sortedProjects, sortKey: pSortKey, sortDir: pSortDir, onSort: onPSort } = useTableSort(podProjects ?? []);
 const { sorted: sortedMembers, sortKey: mSortKey, sortDir: mSortDir, onSort: onMSort } = useTableSort(members);

 if (podsLoading || projectsLoading || resourcesLoading) return <LoadingSpinner variant="cards" message="Loading POD details..." />;
 if (!pod) return <Text c="red">POD not found</Text>;

 return (
 <Stack className="page-enter stagger-children">
 <NlpBreadcrumb />
 <Group className="detail-header">
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>{pod.name}</Title>
 {pod.active && <Badge color="green">Active</Badge>}
 </Group>

 <SimpleGrid cols={{ base: 2, sm: 4 }} className="stagger-grid">
 <SummaryCard title="Projects" value={stats.totalProjects} icon={<IconBriefcase size={20} color="#339af0" />} />
 <SummaryCard title="Active Projects" value={stats.activeProjects} icon={<IconBriefcase size={20} color="#40c057" />} />
 <SummaryCard title="Members" value={stats.members} icon={<IconUsers size={20} color="#845ef7" />} />
 <SummaryCard title="Total FTE" value={stats.totalFte.toFixed(1)} icon={<IconClock size={20} color="#fd7e14" />} />
 </SimpleGrid>

 <Card withBorder padding="md">
 <Title order={4} mb={4}>Projects Assigned</Title>
 <Text size="sm" c="dimmed" mb="sm">All projects this POD is working on</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <SortableHeader sortKey="projectName" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Project</SortableHeader>
 <SortableHeader sortKey="priority" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Priority</SortableHeader>
 <SortableHeader sortKey="owner" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Owner</SortableHeader>
 <SortableHeader sortKey="totalHoursWithContingency" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Size</SortableHeader>
 <Table.Th>Pattern</Table.Th>
 <SortableHeader sortKey="podStartMonth" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Start</SortableHeader>
 <SortableHeader sortKey="durationOverride" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Duration</SortableHeader>
 <SortableHeader sortKey="status" currentKey={pSortKey} dir={pSortDir} onSort={onPSort}>Status</SortableHeader>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sortedProjects.map(p => (
 <Table.Tr key={p.planningId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.projectId}`)}>
 <Table.Td fw={500}>{p.projectName}</Table.Td>
 <Table.Td><PriorityBadge priority={p.priority} /></Table.Td>
 <Table.Td>{p.owner}</Table.Td>
 <Table.Td><Badge variant="light">{deriveTshirtSize(p.totalHoursWithContingency)}</Badge></Table.Td>
 <Table.Td>{p.effortPattern ?? p.defaultPattern}</Table.Td>
 <Table.Td>{monthLabels[p.podStartMonth ?? p.projectStartMonth] ?? `M${p.podStartMonth ?? p.projectStartMonth}`}</Table.Td>
 <Table.Td>{p.durationOverride ?? p.projectDurationMonths}m</Table.Td>
 <Table.Td><StatusBadge status={p.status} /></Table.Td>
 </Table.Tr>
 ))}
 {sortedProjects.length === 0 && (
 <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="md">No projects assigned</Text></Table.Td></Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Card>

 <Card withBorder padding="md">
 <Group mb={4} gap="sm">
 <Title order={4}>Team Members</Title>
 {stats.overAllocCount > 0 && (
 <Badge color="orange" variant="light" size="sm" leftSection={<IconAlertTriangle size={12} />}>
 {stats.overAllocCount} over-allocated
 </Badge>
 )}
 </Group>
 <Text size="sm" c="dimmed" mb="sm">Resources with this POD as their home</Text>
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <SortableHeader sortKey="name" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Name</SortableHeader>
 <SortableHeader sortKey="role" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Role</SortableHeader>
 <SortableHeader sortKey="location" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Location</SortableHeader>
 <SortableHeader sortKey="podAssignment.capacityFte" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>FTE</SortableHeader>
 <SortableHeader sortKey="active" currentKey={mSortKey} dir={mSortDir} onSort={onMSort}>Active</SortableHeader>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sortedMembers.map(r => {
 const fte = r.podAssignment?.capacityFte ?? 1;
 const isPartTime = fte < 1;
 const overCount = overAllocMap.get(r.id);
 return (
 <Table.Tr key={r.id}>
 <Table.Td fw={500}>
 <Group gap={6} wrap="nowrap">
 <Tooltip label={r.jiraAccountId ? 'Jira connected' : r.name} withArrow position="top">
 <Avatar
 src={r.avatarUrl ?? null}
 size={24}
 radius="xl"
 color={r.jiraAccountId ? 'teal' : 'blue'}
 >
 {r.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
 </Avatar>
 </Tooltip>
 {r.name}
 {overCount && (
 <Tooltip label={`${overCount} month(s) exceed ${Math.round(fte * 100)}% FTE cap`}>
 <IconAlertTriangle size={16} color="orange" />
 </Tooltip>
 )}
 </Group>
 </Table.Td>
 <Table.Td>{formatRole(r.role)}</Table.Td>
 <Table.Td>{r.location}</Table.Td>
 <Table.Td>
 <Badge variant="light" color={isPartTime ? 'orange' : 'green'} size="sm">
 {isPartTime ? `${Math.round(fte * 100)}%` : '100%'}
 </Badge>
 </Table.Td>
 <Table.Td>{r.active ? 'Yes' : 'No'}</Table.Td>
 </Table.Tr>
 );
 })}
 {sortedMembers.length === 0 && (
 <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">No members assigned</Text></Table.Td></Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </Card>
 </Stack>
 );
}
