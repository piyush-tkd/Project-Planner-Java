import { useState } from 'react';
import {
 Container, Title, Text, Paper, Group, Stack, Badge, Button,
 Table, ActionIcon, Tooltip, Tabs, Box, Skeleton, ScrollArea,
 Modal, Code, SimpleGrid, ThemeIcon, useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
 IconAlertTriangle, IconBug, IconDeviceDesktop, IconServer,
 IconCheck, IconTrash, IconClearAll, IconApi,
} from '@tabler/icons-react';
import {
 useErrorLogs, useResolveError, useDeleteErrorLog, useClearResolvedErrors,
 AppErrorLog,
} from '../../api/errorLogs';
import { AQUA, COLOR_ERROR_DEEP, COLOR_ORANGE_DARK, DEEP_BLUE, GRAY_200, SURFACE_RED_FAINT} from '../../brandTokens';

const SOURCE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
 FRONTEND: { icon: <IconDeviceDesktop size={14} />, color: 'blue', label: 'Frontend' },
 BACKEND: { icon: <IconServer size={14} />, color: 'orange', label: 'Backend' },
 API: { icon: <IconApi size={14} />, color: 'grape', label: 'API' },
};

const SEVERITY_COLOR: Record<string, string> = {
 ERROR: 'red',
 WARN: 'orange',
 INFO: 'blue',
};

export default function ErrorLogPage() {
 const { data: logs, isLoading } = useErrorLogs();
 const resolveError = useResolveError();
 const deleteError = useDeleteErrorLog();
 const clearResolved = useClearResolvedErrors();
 const [activeTab, setActiveTab] = useState<string | null>('all');
 const [detailModal, setDetailModal] = useState<AppErrorLog | null>(null);
 const { colorScheme } = useMantineColorScheme();
 const isDark = colorScheme === 'dark';
 const headingColor = isDark ? GRAY_200 : DEEP_BLUE;

 const filtered = logs?.filter(log => {
 if (activeTab === 'all') return true;
 if (activeTab === 'frontend') return log.source === 'FRONTEND';
 if (activeTab === 'backend') return log.source === 'BACKEND' || log.source === 'API';
 if (activeTab === 'unresolved') return !log.resolved;
 if (activeTab === 'resolved') return log.resolved;
 return true;
 }) ?? [];

 const counts = {
 all: logs?.length ?? 0,
 frontend: logs?.filter(l => l.source === 'FRONTEND').length ?? 0,
 backend: logs?.filter(l => l.source === 'BACKEND' || l.source === 'API').length ?? 0,
 unresolved: logs?.filter(l => !l.resolved).length ?? 0,
 resolved: logs?.filter(l => l.resolved).length ?? 0,
 errors: logs?.filter(l => l.severity === 'ERROR').length ?? 0,
 warnings: logs?.filter(l => l.severity === 'WARN').length ?? 0,
 };

 const handleResolve = (id: number) => {
 resolveError.mutate(id, {
 onSuccess: () => notifications.show({ title: 'Resolved', message: 'Error marked as resolved', color: 'teal' }),
 });
 };

 const handleDelete = (id: number) => {
 deleteError.mutate(id, {
 onSuccess: () => {
 notifications.show({ title: 'Deleted', message: 'Error log removed', color: 'gray' });
 setDetailModal(null);
 },
 });
 };

 const handleClearResolved = () => {
 clearResolved.mutate(undefined, {
 onSuccess: (data) => {
 notifications.show({ title: 'Cleared', message: `Removed ${data.deleted} resolved entries`, color: 'teal' });
 },
 });
 };

 return (
 <Container size="xl" py="md" className="page-enter stagger-children">
 <Group justify="space-between" align="flex-start" mb="lg" className="slide-in-left">
 <div>
 <Title order={2} style={{ color: headingColor, fontWeight: 700 }}>
 Error Log
 </Title>
 <Text size="sm" c="dimmed" mt={4}>
 Application errors captured from frontend and backend
 </Text>
 </div>
 <Button
 variant="light"
 color="red"
 leftSection={<IconClearAll size={16} />}
 onClick={handleClearResolved}
 loading={clearResolved.isPending}
 disabled={counts.resolved === 0}>
 Clear Resolved ({counts.resolved})
 </Button>
 </Group>

 {/* ── Summary Cards ── */}
 <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }} mb="lg">
 <SummaryCard label="Total" value={counts.all} color={DEEP_BLUE} icon={<IconAlertTriangle size={18} />} />
 <SummaryCard label="Unresolved" value={counts.unresolved} color={COLOR_ERROR_DEEP} icon={<IconBug size={18} />} />
 <SummaryCard label="Frontend" value={counts.frontend} color="#1c7ed6" icon={<IconDeviceDesktop size={18} />} />
 <SummaryCard label="Backend" value={counts.backend} color={COLOR_ORANGE_DARK} icon={<IconServer size={18} />} />
 <SummaryCard label="Errors" value={counts.errors} color={COLOR_ERROR_DEEP} icon={<IconAlertTriangle size={18} />} />
 <SummaryCard label="Warnings" value={counts.warnings} color={COLOR_ORANGE_DARK} icon={<IconAlertTriangle size={18} />} />
 <SummaryCard label="Resolved" value={counts.resolved} color="#2b8a3e" icon={<IconCheck size={18} />} />
 </SimpleGrid>

 {/* ── Tabs ── */}
 <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md" keepMounted={false}>
 <Tabs.List mb="md">
 <Tabs.Tab value="all">All ({counts.all})</Tabs.Tab>
 <Tabs.Tab value="unresolved" leftSection={<IconBug size={14} />}>
 Unresolved ({counts.unresolved})
 </Tabs.Tab>
 <Tabs.Tab value="frontend" leftSection={<IconDeviceDesktop size={14} />}>
 Frontend ({counts.frontend})
 </Tabs.Tab>
 <Tabs.Tab value="backend" leftSection={<IconServer size={14} />}>
 Backend ({counts.backend})
 </Tabs.Tab>
 <Tabs.Tab value="resolved" leftSection={<IconCheck size={14} />}>
 Resolved ({counts.resolved})
 </Tabs.Tab>
 </Tabs.List>

 {(['all', 'unresolved', 'frontend', 'backend', 'resolved'] as const).map(tabValue => (
 <Tabs.Panel key={tabValue} value={tabValue}>
 <Paper shadow="xs" radius="md" withBorder>
 <ScrollArea h={560}>
 {isLoading ? (
 <Skeleton height={200} radius="sm" />
 ) : filtered.length === 0 ? (
 <Box p="xl" ta="center">
 <ThemeIcon size={48} radius="xl" variant="light" color="teal" mx="auto" mb="sm">
 <IconCheck size={24} />
 </ThemeIcon>
 <Text c="dimmed">No error logs found. The application is running smoothly!</Text>
 </Box>
 ) : (
 <Table fz="xs" highlightOnHover withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Timestamp</Table.Th>
 <Table.Th>Source</Table.Th>
 <Table.Th>Severity</Table.Th>
 <Table.Th>Type</Table.Th>
 <Table.Th>Message</Table.Th>
 <Table.Th>Component / Page</Table.Th>
 <Table.Th>User</Table.Th>
 <Table.Th>Status</Table.Th>
 <Table.Th>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {filtered.map((log) => {
 const src = SOURCE_CONFIG[log.source] ?? SOURCE_CONFIG.FRONTEND;
 return (
 <Table.Tr
 key={log.id}
 style={{ cursor: 'pointer', opacity: log.resolved ? 0.6 : 1 }}
 onClick={() => setDetailModal(log)}
 >
 <Table.Td>
 <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
 {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
 </Text>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="light" color={src.color} leftSection={src.icon}>
 {src.label}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Badge size="xs" variant="filled" color={SEVERITY_COLOR[log.severity] ?? 'gray'}>
 {log.severity}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Text size="xs">
 {log.errorType ?? '—'}
 </Text>
 </Table.Td>
 <Table.Td maw={300}>
 <Text size="xs" lineClamp={2}>
 {log.message}
 </Text>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c="dimmed">
 {log.component || log.pageUrl || '—'}
 </Text>
 </Table.Td>
 <Table.Td>
 <Text size="xs" c="dimmed">{log.username ?? '—'}</Text>
 </Table.Td>
 <Table.Td>
 {log.resolved ? (
 <Badge size="xs" variant="light" color="teal">Resolved</Badge>
 ) : (
 <Badge size="xs" variant="light" color="red">Open</Badge>
 )}
 </Table.Td>
 <Table.Td>
 <Group gap={4}>
 {!log.resolved && (
 <Tooltip label="Mark Resolved">
 <ActionIcon size="xs" variant="subtle" color="teal"
 onClick={(e) => { e.stopPropagation(); handleResolve(log.id); }}
      aria-label="Confirm"
    >
 <IconCheck size={14} />
 </ActionIcon>
 </Tooltip>
 )}
 <Tooltip label="Delete">
 <ActionIcon size="xs" variant="subtle" color="red"
 onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
      aria-label="Delete"
    >
 <IconTrash size={14} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Table.Td>
 </Table.Tr>
 );
 })}
 </Table.Tbody>
 </Table>
 )}
 </ScrollArea>
 </Paper>
 </Tabs.Panel>
 ))}
 </Tabs>

 {/* ── Detail Modal ── */}
 <Modal
 opened={detailModal !== null}
 onClose={() => setDetailModal(null)}
 title={
 <Group gap={8}>
 <IconAlertTriangle size={20} color={COLOR_ERROR_DEEP} />
 <Text fw={600} style={{ color: headingColor }}>Error Detail</Text>
 </Group>
 }
 size="lg"
 centered
 >
 {detailModal && (
 <Stack gap="md">
 <Group gap="sm">
 <Badge variant="light" color={SOURCE_CONFIG[detailModal.source]?.color ?? 'gray'}>
 {SOURCE_CONFIG[detailModal.source]?.label ?? detailModal.source}
 </Badge>
 <Badge variant="filled" color={SEVERITY_COLOR[detailModal.severity] ?? 'gray'}>
 {detailModal.severity}
 </Badge>
 {detailModal.httpStatus && (
 <Badge variant="outline" color="gray">HTTP {detailModal.httpStatus}</Badge>
 )}
 {detailModal.resolved ? (
 <Badge variant="light" color="teal">Resolved</Badge>
 ) : (
 <Badge variant="light" color="red">Open</Badge>
 )}
 </Group>

 <div>
 <Text size="xs" c="dimmed">Error Type</Text>
 <Text size="sm" fw={600}>{detailModal.errorType ?? 'Unknown'}</Text>
 </div>

 <div>
 <Text size="xs" c="dimmed">Message</Text>
 <Paper withBorder p="sm" radius="md" style={{ backgroundColor: isDark ? 'rgba(200, 42, 42, 0.1)' : SURFACE_RED_FAINT }}>
 <Text size="sm" style={{ color: isDark ? GRAY_200 : undefined }}>{detailModal.message}</Text>
 </Paper>
 </div>

 {detailModal.stackTrace && (
 <div>
 <Text size="xs" c="dimmed" mb={4}>Stack Trace</Text>
 <Code block style={{ maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
 {detailModal.stackTrace}
 </Code>
 </div>
 )}

 <SimpleGrid cols={2}>
 <div>
 <Text size="xs" c="dimmed">Page URL</Text>
 <Text size="sm">{detailModal.pageUrl ?? '—'}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">API Endpoint</Text>
 <Text size="sm">{detailModal.apiEndpoint ?? '—'}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">Component</Text>
 <Text size="sm">{detailModal.component ?? '—'}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">User</Text>
 <Text size="sm">{detailModal.username ?? '—'}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">Timestamp</Text>
 <Text size="sm">{new Date(detailModal.createdAt).toLocaleString()}</Text>
 </div>
 <div>
 <Text size="xs" c="dimmed">User Agent</Text>
 <Text size="xs" lineClamp={2}>{detailModal.userAgent ?? '—'}</Text>
 </div>
 </SimpleGrid>

 <Group justify="flex-end">
 <Button
 variant="subtle" color="red"
 leftSection={<IconTrash size={14} />}
 onClick={() => handleDelete(detailModal.id)}>
 Delete
 </Button>
 {!detailModal.resolved && (
 <Button
 leftSection={<IconCheck size={16} />}
 onClick={() => { handleResolve(detailModal.id); setDetailModal(null); }}
 style={{ backgroundColor: isDark ? AQUA : DEEP_BLUE, color: isDark ? DEEP_BLUE : '#fff' }}
 >
 Mark Resolved
 </Button>
 )}
 </Group>
 </Stack>
 )}
 </Modal>
 </Container>
 );
}

// ── Summary Card ──

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
 return (
 <Paper shadow="xs" radius="md" p="md" withBorder>
 <Group gap="sm" align="flex-start">
 <ThemeIcon size={36} radius="md" variant="light" style={{ color, backgroundColor: `${color}15` }}>
 {icon}
 </ThemeIcon>
 <div>
 <Text size="xs" c="dimmed">{label}</Text>
 <Text size="xl" fw={700} style={{ color }}>{value}</Text>
 </div>
 </Group>
 </Paper>
 );
}
