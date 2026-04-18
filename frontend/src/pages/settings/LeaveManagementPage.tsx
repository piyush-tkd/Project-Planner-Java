import { useState, useMemo, useRef } from 'react';
import {
  Title, Text, Group, Button, Badge, Table, ActionIcon, Tooltip,
  Stack, Paper, Select, Modal, Alert, Progress, SimpleGrid, ThemeIcon,
  Box, ScrollArea, Avatar,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarOff, IconUpload, IconTrash, IconCheck, IconAlertTriangle,
  IconUsers, IconClock, IconCalendarEvent,
} from '@tabler/icons-react';
import { useLeaveEntries, useImportLeave, useDeleteLeaveEntry } from '../../api/leave';
import { useResources } from '../../api/resources';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { DEEP_BLUE, DEEP_BLUE_HEX, AQUA, AQUA_HEX, SURFACE_FAINT } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function LeaveManagementPage({ embedded = false }: { embedded?: boolean } = {}) {
  const isDark = useDarkMode();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replaceExisting, _setReplaceExisting] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: entries = [], isLoading, error, refetch } = useLeaveEntries(year);
  const importMut = useImportLeave();
  const deleteMut = useDeleteLeaveEntry();
  const { data: allResources = [] } = useResources();
  const avatarMap = useMemo(() => {
    const m = new Map<number, { avatarUrl?: string | null; jiraAccountId?: string | null }>();
    for (const r of allResources) m.set(r.id, { avatarUrl: r.avatarUrl, jiraAccountId: r.jiraAccountId });
    return m;
  }, [allResources]);

  // Group by resource
  const grouped = useMemo(() => {
    const map: Record<string, { resourceId: number; months: Record<number, number> }> = {};
    for (const e of entries) {
      if (!map[e.resourceName]) {
        map[e.resourceName] = { resourceId: e.resourceId, months: {} };
      }
      map[e.resourceName].months[e.monthIndex] =
        (map[e.resourceName].months[e.monthIndex] ?? 0) + e.leaveHours;
    }
    return map;
  }, [entries]);

  // Stats
  const stats = useMemo(() => {
    const totalHours = entries.reduce((s, e) => s + e.leaveHours, 0);
    const uniqueResources = new Set(entries.map(e => e.resourceId)).size;
    const monthsAffected = new Set(entries.map(e => e.monthIndex)).size;
    return { totalHours, uniqueResources, monthsAffected };
  }, [entries]);

  // Flat rows for table (resource + month)
  const tableRows = useMemo(() => {
    const rows: { id: number; resourceName: string; monthIndex: number; leaveHours: number; leaveType: string }[] = [];
    for (const e of entries) {
      rows.push(e);
    }
    rows.sort((a, b) => a.monthIndex - b.monthIndex || a.resourceName.localeCompare(b.resourceName));
    return rows;
  }, [entries]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  }

  function handleImport() {
    if (!selectedFile) {
      notifications.show({ message: 'Please select a file', color: 'red' });
      return;
    }
    importMut.mutate(
      { file: selectedFile, year, replace: replaceExisting },
      {
        onSuccess: (result) => {
          notifications.show({
            message: `Imported ${result.imported} leave records. ${result.skipped} names skipped.`,
            color: result.skipped > 0 ? 'yellow' : 'green',
          });
          if (result.skippedNames.length > 0) {
            console.warn('Skipped leave names:', result.skippedNames);
          }
          setImportModalOpen(false);
          setSelectedFile(null);
        },
        onError: (e: any) =>
          notifications.show({
            message: e?.response?.data?.message ?? 'Import failed',
            color: 'red',
          }),
      }
    );
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - 1 + i));

  if (isLoading) return <LoadingSpinner />;
  if (error) return <PageError context="loading leave entries" error={error} onRetry={refetch} />;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        {!embedded && (
          <div>
            <Title order={2} style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
              Leave Management
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Planned and sick leave entries — automatically deducted from resource capacity calculations
            </Text>
          </div>
        )}
        <Group gap="xs">
          <Select
            size="xs"
            value={String(year)}
            onChange={v => v && setYear(Number(v))}
            data={yearOptions}
            w={90}
          />
          <Button
            size="xs"
            leftSection={<IconUpload size={14} />}
            variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
            onClick={() => setImportModalOpen(true)}
          >
            Import Leave Planner
          </Button>
        </Group>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 3 }} spacing="sm">
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs">
            <ThemeIcon color="blue" variant="light" size="sm"><IconUsers size={14} /></ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Resources on Leave</Text>
          </Group>
          <Text size="xl" fw={700} c="blue" mt={4}>{stats.uniqueResources}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="sm"><IconClock size={14} /></ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Leave Hours</Text>
          </Group>
          <Text size="xl" fw={700} c="orange" mt={4}>{stats.totalHours}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs">
            <ThemeIcon color="violet" variant="light" size="sm"><IconCalendarEvent size={14} /></ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Months Affected</Text>
          </Group>
          <Text size="xl" fw={700} c="violet" mt={4}>{stats.monthsAffected}</Text>
        </Paper>
      </SimpleGrid>

      {/* Table */}
      {tableRows.length > 0 ? (
        <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
          <Box
            px="md" py="xs"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : SURFACE_FAINT,
              borderBottom: `1px solid var(--pp-border)`,
            }}
          >
            <Text fw={700} size="sm" style={{ color: isDark ? AQUA : DEEP_BLUE }}>
              Leave Entries — {year}
              <Text span size="xs" c="dimmed" ml={8}>
                {tableRows.length} records · {stats.totalHours} hrs total
              </Text>
            </Text>
          </Box>
          <ScrollArea>
            <Table highlightOnHover withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Resource</Table.Th>
                  <Table.Th>Month</Table.Th>
                  <Table.Th>Hours</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tableRows.map(row => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        {(() => {
                          const resourceId = grouped[row.resourceName]?.resourceId;
                          const info = resourceId != null ? avatarMap.get(resourceId) : undefined;
                          return (
                            <Tooltip label={info?.jiraAccountId ? 'Jira connected' : row.resourceName} withArrow position="top">
                              <Avatar src={info?.avatarUrl ?? null} size={22} radius="xl" color={info?.jiraAccountId ? 'teal' : 'gray'}>
                                {row.resourceName.charAt(0).toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          );
                        })()}
                        <Text size="sm" fw={500}>{row.resourceName}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{MONTHS[row.monthIndex]}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600} c="orange">{row.leaveHours} hrs</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" color="gray" variant="light">
                        {row.leaveType}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Delete">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          loading={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(row.id, {
                            onSuccess: () => notifications.show({ message: 'Leave entry removed', color: 'orange' }),
                          })}
                          aria-label="Delete"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      ) : (
        <Paper withBorder p="xl" radius="md" style={{ textAlign: 'center' }}>
          <IconCalendarOff size={40} color="gray" />
          <Text c="dimmed" mt="sm">No leave entries for {year}</Text>
          <Button
            size="xs" mt="md"
            leftSection={<IconUpload size={14} />}
            onClick={() => setImportModalOpen(true)}
          >
            Import Leave Planner
          </Button>
        </Paper>
      )}

      {/* Import Modal */}
      <Modal
        opened={importModalOpen}
        onClose={() => { setImportModalOpen(false); setSelectedFile(null); }}
        title={<Text fw={700} c={DEEP_BLUE}>Import Leave Planner</Text>}
        size="sm"
      >
        <Stack gap="sm">
          <Alert icon={<IconAlertTriangle size={16} />} color="blue" variant="light">
            Upload a Leave Planner Excel (.xlsx) in the standard format (POD | Name | date columns with PL/SL/HD codes).
          </Alert>

          <input
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            leftSection={<IconUpload size={14} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? selectedFile.name : 'Choose .xlsx file'}
          </Button>

          {selectedFile && (
            <Text size="xs" c="dimmed">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </Text>
          )}

          {importMut.isPending && (
            <Progress value={100} animated size="sm" />
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => { setImportModalOpen(false); setSelectedFile(null); }}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={14} />}
              loading={importMut.isPending}
              disabled={!selectedFile}
              onClick={handleImport}
              variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
            >
              Import
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
