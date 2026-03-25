import React, { useMemo, useState } from 'react';
import {
 Box,
 Button,
 Group,
 Loader,
 MultiSelect,
 Popover,
 ScrollArea,
 SegmentedControl,
 Stack,
 Text,
 Title,
 Badge,
 Tooltip,
 Paper,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useProjectPodMatrix } from '../../api/projects';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

interface ProjectPodMatrixResponse {
 planningId: number;
 projectId: number;
 projectName: string;
 priority: string;
 owner: string;
 status: string;
 projectStartMonth: number;
 projectDurationMonths: number;
 defaultPattern: string;
 podId: number;
 podName: string;
 tshirtSize: string | null;
 complexityOverride: number | null;
 effortPattern: string | null;
 podStartMonth: number | null;
 durationOverride: number | null;
}

const STATUS_COLORS: Record<string, string> = {
 ACTIVE: '#d3f9d8',
 ON_HOLD: '#fff3bf',
 COMPLETED: '#d0ebff',
 CANCELLED: '#f1f3f5',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
 ACTIVE: '#2f9e44',
 ON_HOLD: '#e67700',
 COMPLETED: '#1971c2',
 CANCELLED: '#868e96',
};

const TSHIRT_BADGE_COLORS: Record<string, string> = {
 XS: 'gray',
 S: 'blue',
 M: 'cyan',
 L: 'orange',
 XL: 'red',
};

export default function PodProjectMatrixPage() {
 const { data: matrixData = [], isLoading, isError } = useProjectPodMatrix();
 const navigate = useNavigate();
 const dark = useDarkMode();
 const headingColor = dark ? '#e0e0e0' : DEEP_BLUE;

 const [selectedPods, setSelectedPods] = useState<string[]>([]);
 const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
 const [expandedCell, setExpandedCell] = useState<string | null>(null);

 // Extract unique PODs and Projects
 const { pods, projects } = useMemo(() => {
 const podMap = new Map<number, string>();
 const projectSet = new Map<number, ProjectPodMatrixResponse>();

 matrixData.forEach((item) => {
 podMap.set(item.podId, item.podName);
 if (!projectSet.has(item.projectId)) {
 projectSet.set(item.projectId, item);
 }
 });

 const podList = Array.from(podMap.entries())
 .sort((a, b) => a[1].localeCompare(b[1]))
 .map(([id, name]) => ({ id, name }));

 const projectList = Array.from(projectSet.values())
 .sort((a, b) => a.projectStartMonth - b.projectStartMonth)
 .map((p) => ({
 id: p.projectId,
 name: p.projectName,
 priority: p.priority,
 status: p.status,
 owner: p.owner,
 startMonth: p.projectStartMonth,
 }));

 return { pods: podList, projects: projectList };
 }, [matrixData]);

 // Filter data based on selections
 const filteredData = useMemo(() => {
 return matrixData.filter((item) => {
 const podMatch =
 selectedPods.length === 0 || selectedPods.includes(item.podName);
 const statusMatch =
 selectedStatus === 'ALL' || item.status === selectedStatus;
 return podMatch && statusMatch;
 });
 }, [matrixData, selectedPods, selectedStatus]);

 // Build matrix
 const matrix = useMemo(() => {
 const lookup = new Map<string, ProjectPodMatrixResponse>();
 filteredData.forEach((item) => {
 const key = `${item.podId}:${item.projectId}`;
 lookup.set(key, item);
 });
 return lookup;
 }, [filteredData]);

 const podOptions = pods.map((p) => ({ value: p.name, label: p.name }));
 const statusOptions = [
 { value: 'ALL', label: 'All Statuses' },
 { value: 'ACTIVE', label: 'Active' },
 { value: 'ON_HOLD', label: 'On Hold' },
 { value: 'COMPLETED', label: 'Completed' },
 { value: 'CANCELLED', label: 'Cancelled' },
 ];

 if (isLoading) return <LoadingSpinner variant="table" message="Loading POD-project matrix..." />;
 if (isError) return <Text color="red">Failed to load matrix data</Text>;

 const formatMonthRange = (startMonth: number | null, duration: number | null) => {
 if (startMonth === null || duration === null) return '';
 const endMonth = startMonth + duration - 1;
 return `M${startMonth}→M${endMonth}`;
 };

 const handleCellClick = (item: ProjectPodMatrixResponse) => {
 navigate(`/projects/${item.projectId}`);
 };

 const truncateText = (text: string, maxLen: number = 12) => {
 return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
 };

 return (
 <Stack gap="md" p="md" className="page-enter stagger-children">
 <Group className="slide-in-left">
 <div>
 <Title order={2} style={{ color: headingColor, fontFamily: FONT_FAMILY, fontWeight: 700 }}>POD-Project Matrix</Title>
 <Text size="sm" c="dimmed">
 Assign PODs to projects and track allocation by timeline
 </Text>
 </div>
 </Group>

 <Group gap="md" align="flex-end" className="stagger-children">
 <MultiSelect
 label="Filter PODs"
 placeholder="Select PODs..."
 data={podOptions}
 value={selectedPods}
 onChange={setSelectedPods}
 style={{ flex: 1, maxWidth: 300 }}
 />
 <SegmentedControl
 data={statusOptions}
 value={selectedStatus}
 onChange={setSelectedStatus}
 />
 </Group>

 <Paper p="md" radius="md" withBorder>
 <Stack gap="sm">
 <Text size="sm" fw={500}>
 Legend
 </Text>
 <Group gap="lg">
 {Object.entries(TSHIRT_BADGE_COLORS).map(([size, color]) => (
 <Group key={size} gap="xs">
 <Badge color={color}>{size}</Badge>
 <Text size="xs">{size}</Text>
 </Group>
 ))}
 </Group>
 </Stack>
 </Paper>

 <ScrollArea>
 <table
 style={{
 borderCollapse: 'collapse',
 fontFamily: FONT_FAMILY,
 fontSize: '14px',
 minWidth: '100%',
 }}
 >
 <thead>
 <tr>
 <th
 style={{
 backgroundColor: DEEP_BLUE,
 color: 'white',
 padding: '12px',
 textAlign: 'left',
 fontWeight: 600,
 minWidth: 120,
 position: 'sticky',
 left: 0,
 zIndex: 2,
 }}
 >
 POD
 </th>
 {projects.map((project) => (
 <th
 key={project.id}
 style={{
 backgroundColor: DEEP_BLUE,
 color: 'white',
 padding: '12px',
 textAlign: 'center',
 fontWeight: 600,
 minWidth: 100,
 }}
 >
 <Tooltip label={project.name} position="top">
 <span>{truncateText(project.name, 12)}</span>
 </Tooltip>
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {pods.map((pod) => (
 <tr key={pod.id}>
 <td
 style={{
 backgroundColor: DEEP_BLUE,
 color: 'white',
 padding: '12px',
 fontWeight: 600,
 position: 'sticky',
 left: 0,
 zIndex: 1,
 }}
 >
 {pod.name}
 </td>
 {projects.map((project) => {
 const key = `${pod.id}:${project.id}`;
 const item = matrix.get(key);

 if (!item) {
 return (
 <td
 key={key}
 style={{
 backgroundColor: dark ? '#25262b' : '#f8f9fa',
 padding: '12px',
 textAlign: 'center',
 color: '#999',
 borderBottom: '1px solid #e9ecef',
 }}
 >
 —
 </td>
 );
 }

 const bgColor = STATUS_COLORS[item.status] || '#f8f9fa';
 const textColor = STATUS_TEXT_COLORS[item.status] || '#868e96';
 const monthRange = formatMonthRange(
 item.podStartMonth,
 item.durationOverride || item.projectDurationMonths
 );

 return (
 <Popover
 key={key}
 position="bottom"
 withArrow
 shadow="md"
 opened={expandedCell === key}
 onChange={(opened) =>
 setExpandedCell(opened ? key : null)
 }
 >
 <Popover.Target>
 <td
 onClick={() => handleCellClick(item)}
 style={{
 backgroundColor: bgColor,
 padding: '12px',
 textAlign: 'center',
 borderBottom: '1px solid #e9ecef',
 cursor: 'pointer',
 transition: 'opacity 0.2s',
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.opacity = '0.8';
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.opacity = '1';
 }}
 >
 <Stack gap={2}>
 <Badge
 color={
 TSHIRT_BADGE_COLORS[item.tshirtSize ?? ''] || 'gray'
 }
 size="sm"
 >
 {item.tshirtSize ?? '–'}
 </Badge>
 <Text size="xs" fw={500} c={textColor}>
 {monthRange}
 </Text>
 </Stack>
 </td>
 </Popover.Target>
 <Popover.Dropdown>
 <Stack gap="xs">
 <div>
 <Text fw={600} size="sm">
 {item.projectName}
 </Text>
 <Text size="xs" c="dimmed">
 ID: {item.projectId}
 </Text>
 </div>
 <Group gap="md">
 <div>
 <Text size="xs" fw={500}>
 Priority
 </Text>
 <Badge size="sm">{item.priority}</Badge>
 </div>
 <div>
 <Text size="xs" fw={500}>
 Status
 </Text>
 <Badge size="sm">{item.status}</Badge>
 </div>
 </Group>
 <div>
 <Text size="xs" fw={500}>
 Owner
 </Text>
 <Text size="xs">{item.owner}</Text>
 </div>
 <div>
 <Text size="xs" fw={500}>
 T-Shirt Size
 </Text>
 <Badge
 color={TSHIRT_BADGE_COLORS[item.tshirtSize ?? ''] || 'gray'}
 >
 {item.tshirtSize ?? '–'}
 </Badge>
 </div>
 <div>
 <Text size="xs" fw={500}>
 Timeline
 </Text>
 <Text size="xs">
 {monthRange}
 </Text>
 </div>
 <Button
 variant="light"
 size="xs"
 fullWidth
 onClick={() => handleCellClick(item)}
 >
 View Project
 </Button>
 </Stack>
 </Popover.Dropdown>
 </Popover>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </ScrollArea>
 </Stack>
 );
}
