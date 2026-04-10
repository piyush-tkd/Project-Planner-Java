import { useState, useMemo } from 'react';
import {
  Title, Text, Group, Button, Badge, Table, TextInput, Select,
  Alert, ActionIcon, Tooltip, Stack, Paper, SimpleGrid, ScrollArea,
  ThemeIcon, Box, Collapse, Avatar,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUsers, IconSearch, IconWand, IconCheck, IconX, IconArrowRight,
  IconRefresh, IconDeviceFloppy, IconUserOff, IconEdit, IconTrash,
  IconAlertTriangle, IconChevronDown, IconChevronUp, IconLink, IconLinkOff, IconPhoto,
} from '@tabler/icons-react';
import {
  useResourceMappings, useResourceMappingStats, useAutoMatch,
  useSaveResourceMapping, useDeleteResourceMapping, useBulkAcceptMappings,
  useUnmappedResources, useClearResourceMapping, useSyncAvatars,
  ResourceMappingResponse,
} from '../../api/jiraResourceMapping';
import { useResources } from '../../api/resources';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { AQUA, DARK_BORDER, DEEP_BLUE, FONT_FAMILY, GRAY_100, GRAY_BORDER} from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import { InlineSelectCell, InlineSelectOption } from '../../components/common/InlineCell';

type FilterTab = 'all' | 'mapped' | 'unmapped' | 'auto' | 'manual';

function confidenceColor(c: number | null): string {
  if (c === null || c === 0) return 'gray';
  if (c >= 0.85) return 'green';
  if (c >= 0.60) return 'yellow';
  return 'red';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.substring(0, 2)?.toUpperCase() ?? '?';
}

interface ResourceRow {
  resourceId: number;
  resourceName: string;
  resourceRole: string;
  resourceEmail: string | null;
  resourceAvatarUrl: string | null;
  resourceLocation: string;
  // Mapping info (null if unmapped)
  mappingId: number | null;
  jiraDisplayName: string | null;
  jiraAccountId: string | null;
  mappingType: string | null;       // AUTO | MANUAL | EXCLUDED
  confidence: number | null;
  confirmed: boolean;
  issueCount: number;
  hoursLogged: number;
}

export default function JiraResourceMappingPage() {
  const isDark = useDarkMode();
  const { data: mappings, isLoading, error, refetch } = useResourceMappings();
  const { data: stats, refetch: refetchStats } = useResourceMappingStats();
  const { data: resources, isLoading: resLoading } = useResources();
  const autoMatchMut = useAutoMatch();
  const saveMut = useSaveResourceMapping();
  const deleteMut = useDeleteResourceMapping();
  const clearMut = useClearResourceMapping();
  const bulkAcceptMut = useBulkAcceptMappings();
  const syncAvatarsMut = useSyncAvatars();
  const { editingCell, startEdit, stopEdit, isEditing } = useInlineEdit();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editJiraName, setEditJiraName] = useState<string | null>(null);
  const [showBuffer, setShowBuffer] = useState(false);

  // Build resource-first rows: one row per active resource
  const resourceRows = useMemo<ResourceRow[]>(() => {
    if (!resources) return [];
    const activeResources = resources.filter(r => r.active);
    // Index mappings by resourceId for fast lookup
    const mappingByResourceId = new Map<number, ResourceMappingResponse>();
    if (mappings) {
      for (const m of mappings) {
        if (m.resourceId) mappingByResourceId.set(m.resourceId, m);
      }
    }
    return activeResources.map(r => {
      const m = mappingByResourceId.get(r.id);
      return {
        resourceId: r.id,
        resourceName: r.name,
        resourceRole: r.role,
        resourceEmail: r.email ?? null,
        resourceAvatarUrl: r.avatarUrl ?? null,
        resourceLocation: r.location,
        mappingId: m?.id ?? null,
        jiraDisplayName: m?.jiraDisplayName ?? r.jiraDisplayName ?? null,
        jiraAccountId: m?.jiraAccountId ?? r.jiraAccountId ?? null,
        mappingType: m?.mappingType ?? null,
        confidence: m?.confidence ?? null,
        confirmed: m?.confirmed ?? false,
        issueCount: m?.issueCount ?? 0,
        hoursLogged: m?.hoursLogged ?? 0,
      };
    });
  }, [resources, mappings]);

  // Jira name options for dropdown (all known Jira names)
  const jiraNameOptions = useMemo(() => {
    if (!mappings) return [];
    const seen = new Set<string>();
    return mappings
      .filter(m => { if (seen.has(m.jiraDisplayName)) return false; seen.add(m.jiraDisplayName); return true; })
      .map(m => ({
        value: m.jiraDisplayName,
        label: `${m.jiraDisplayName}${m.jiraAccountId ? ` (${m.jiraAccountId.substring(0, 12)}...)` : ''}`,
      }));
  }, [mappings]);

  // Resource options for inline select (mapped resource column)
  const resourceOptions = useMemo<InlineSelectOption[]>(() => {
    if (!resources) return [];
    return resources
      .filter(r => r.active)
      .map(r => ({
        value: String(r.id),
        label: r.name,
      }));
  }, [resources]);

  // Confidence level options
  const confidenceOptions = useMemo<InlineSelectOption[]>(() => [
    { value: 'HIGH', label: 'HIGH (0.85+)' },
    { value: 'MEDIUM', label: 'MEDIUM (0.60-0.84)' },
    { value: 'LOW', label: 'LOW (<0.60)' },
  ], []);

  // Buffer rows: Jira users in configured PODs who aren't mapped to any resource
  const bufferRows = useMemo(() => {
    if (!mappings) return [];
    return mappings.filter(m => !m.resourceId && m.resourceCategory === 'BUFFER');
  }, [mappings]);

  // Counts
  const totalResources = resourceRows.length;
  const mappedCount = resourceRows.filter(r => r.jiraDisplayName).length;
  const unmappedCount = resourceRows.filter(r => !r.jiraDisplayName).length;
  const autoCount = resourceRows.filter(r => r.mappingType === 'AUTO' && r.jiraDisplayName).length;
  const manualCount = resourceRows.filter(r => r.mappingType === 'MANUAL').length;

  // Filter rows
  const filtered = useMemo(() => {
    let list = resourceRows;
    if (tab === 'mapped') list = list.filter(r => r.jiraDisplayName);
    else if (tab === 'unmapped') list = list.filter(r => !r.jiraDisplayName);
    else if (tab === 'auto') list = list.filter(r => r.mappingType === 'AUTO' && r.jiraDisplayName);
    else if (tab === 'manual') list = list.filter(r => r.mappingType === 'MANUAL');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.resourceName.toLowerCase().includes(q) ||
        (r.jiraDisplayName ?? '').toLowerCase().includes(q) ||
        (r.resourceEmail ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [resourceRows, tab, search]);

  function handleAutoMatch() {
    autoMatchMut.mutate(undefined, {
      onSuccess: () => {
        refetchStats();
        notifications.show({ title: 'Auto-match complete', message: 'Mappings have been updated', color: 'teal' });
      },
    });
  }

  function handleBulkAccept() {
    bulkAcceptMut.mutate({ minConfidence: 0.85 }, {
      onSuccess: (data) => {
        refetchStats();
        notifications.show({ title: 'Bulk accept', message: `${data.accepted} mappings confirmed`, color: 'green' });
      },
    });
  }

  function handleSave(jiraDisplayName: string, resourceId: number | null, mappingType: string) {
    saveMut.mutate({ jiraDisplayName, resourceId, mappingType }, {
      onSuccess: () => {
        setEditingRow(null);
        setEditJiraName(null);
        refetchStats();
        notifications.show({ title: 'Saved', message: `Mapping saved`, color: 'green' });
      },
    });
  }

  function handleClearMapping(resourceId: number) {
    clearMut.mutate(resourceId, {
      onSuccess: () => {
        setEditingRow(null);
        setEditJiraName(null);
        refetchStats();
        notifications.show({ title: 'Unmapped', message: 'Jira user removed from this resource', color: 'orange' });
      },
    });
  }

  function handleDelete(m: { mappingId: number | null; jiraDisplayName: string | null }) {
    if (!m.mappingId) return;
    deleteMut.mutate(m.mappingId, {
      onSuccess: () => {
        refetchStats();
        notifications.show({ title: 'Removed', message: `Mapping removed`, color: 'orange' });
      },
    });
  }

  function statusBadge(row: ResourceRow) {
    if (!row.jiraDisplayName) return <Badge size="xs" color="red">Unmapped</Badge>;
    if (row.mappingType === 'MANUAL') return <Badge size="xs" color="indigo">Manual</Badge>;
    if (row.confirmed) return <Badge size="xs" color="green">Confirmed</Badge>;
    return <Badge size="xs" color="teal">Auto-Matched</Badge>;
  }

  if (isLoading || resLoading) return <LoadingSpinner />;
  if (error) return <PageError context="loading resource mappings" error={error} onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
            Jira Resource Mapping
          </Title>
          <Text size="sm" c="dimmed" mt={4}>Map your resources to Jira users for accurate time tracking</Text>
        </div>
        <Group gap="xs">
          <Button
            variant="outline"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={() => { refetch(); refetchStats(); }}
          >
            Refresh
          </Button>
          <Button
            size="xs"
            leftSection={<IconWand size={14} />}
            loading={autoMatchMut.isPending}
            onClick={handleAutoMatch}
            style={{ backgroundColor: AQUA, color: DEEP_BLUE }}
          >
            Smart Match All
          </Button>
          <Button
            size="xs"
            variant="outline"
            leftSection={<IconPhoto size={14} />}
            loading={syncAvatarsMut.isPending}
            onClick={() => syncAvatarsMut.mutate(undefined, {
              onSuccess: (data) => notifications.show({
                title: 'Avatars synced',
                message: `Updated ${data.synced} profile photo${data.synced !== 1 ? 's' : ''} from Jira`,
                color: 'teal',
              }),
              onError: () => notifications.show({
                title: 'Sync failed',
                message: 'Could not fetch avatars from Jira. Check your Jira configuration.',
                color: 'red',
              }),
            })}
          >
            Sync Photos
          </Button>
        </Group>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Resources</Text>
          <Text size="xl" fw={700}>{totalResources}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md" style={{ borderColor: 'var(--mantine-color-green-5)', borderWidth: 1.5 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Mapped</Text>
          <Text size="xl" fw={700} c="green">{mappedCount}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md" style={{ borderColor: 'var(--mantine-color-red-5)', borderWidth: 1.5 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Unmapped</Text>
          <Text size="xl" fw={700} c="red">{unmappedCount}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Auto-Matched</Text>
          <Text size="xl" fw={700} c="teal">{autoCount}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Manual</Text>
          <Text size="xl" fw={700} c="indigo">{manualCount}</Text>
        </Paper>
      </SimpleGrid>

      {/* Help Alert */}
      <Alert variant="light" color="teal" icon={<IconLink size={16} />}>
        <Text size="sm">
          Resources are sourced from your <strong>Resources</strong> page. Click <strong>Smart Match All</strong> to
          automatically find Jira users using email, name, and fuzzy matching. Add <strong>emails</strong> to resources for highest accuracy.
        </Text>
      </Alert>

      {/* Filter Tabs */}
      <Group gap={0} style={{ borderBottom: `2px solid ${isDark ? DARK_BORDER : GRAY_BORDER}` }}>
        {([
          ['all', 'All Resources', totalResources, 'gray'],
          ['mapped', 'Mapped', mappedCount, 'green'],
          ['unmapped', 'Unmapped', unmappedCount, 'red'],
          ['auto', 'Auto-Matched', autoCount, 'teal'],
          ['manual', 'Manual', manualCount, 'indigo'],
        ] as const).map(([key, label, count, color]) => (
          <Box
            key={key}
            onClick={() => setTab(key as FilterTab)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: tab === key ? `2px solid ${AQUA}` : '2px solid transparent',
              marginBottom: -2,
              fontFamily: FONT_FAMILY,
              fontSize: 13,
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? AQUA : undefined,
            }}
          >
            {label} <Badge size="xs" color={color} ml={4}>{count}</Badge>
          </Box>
        ))}
      </Group>

      {/* Toolbar */}
      <Group justify="space-between">
        <TextInput
          placeholder="Search by resource name, Jira user, or email..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 340 }}
          size="xs"
        />
        <Group gap="xs">
          {autoCount > 0 && (
            <Button
              variant="light"
              size="xs"
              color="green"
              leftSection={<IconCheck size={14} />}
              loading={bulkAcceptMut.isPending}
              onClick={handleBulkAccept}
            >
              Accept All High-Confidence (&gt;85%)
            </Button>
          )}
        </Group>
      </Group>

      {/* Resource-First Table */}
      <ScrollArea>
        <Table fz="xs" withColumnBorders withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              <Table.Th style={{ minWidth: 200 }}>Resource Name</Table.Th>
              <Table.Th style={{ width: 30 }}></Table.Th>
              <Table.Th style={{ minWidth: 220 }}>Jira User (Read-Only)</Table.Th>
              <Table.Th style={{ minWidth: 180 }}>Mapped Resource</Table.Th>
              <Table.Th style={{ width: 100 }}>Confidence</Table.Th>
              <Table.Th style={{ width: 100 }}>Status</Table.Th>
              <Table.Th style={{ width: 130 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((row, idx) => {
              const isEditingRow = editingRow === row.resourceId;
              const isEditingJiraUser = isEditing(row.resourceId, 'jiraUser');
              const isEditingMappedResource = isEditing(row.resourceId, 'mappedResource');

              return (
                <Table.Tr key={row.resourceId} style={{
                  background: !row.jiraDisplayName
                    ? (isDark ? 'rgba(250,82,82,0.04)' : 'rgba(250,82,82,0.03)')
                    : row.confirmed
                      ? (isDark ? 'rgba(64,192,87,0.04)' : 'rgba(64,192,87,0.03)')
                      : 'transparent',
                }}>
                  {/* # */}
                  <Table.Td>
                    <Text size="xs" c="dimmed" fw={500}>{idx + 1}</Text>
                  </Table.Td>

                  {/* Resource Name */}
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Avatar
                        src={row.resourceAvatarUrl}
                        size={26}
                        radius="xl"
                        color="blue"
                        variant="light"
                      >
                        <Text size="xs" fw={700}>{initials(row.resourceName)}</Text>
                      </Avatar>
                      <div>
                        <Text size="xs" fw={600}>{row.resourceName}</Text>
                        <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                          {row.resourceRole} · {row.resourceLocation}
                          {row.resourceEmail ? ` · ${row.resourceEmail}` : ''}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>

                  {/* Arrow */}
                  <Table.Td>
                    <IconArrowRight size={14} color={row.jiraDisplayName ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-red-5)'} />
                  </Table.Td>

                  {/* Jira User (Read-Only Display) */}
                  <Table.Td>
                    {row.jiraDisplayName ? (
                      <Group gap="xs" wrap="nowrap">
                        <ThemeIcon size={22} radius="xl" color="teal" variant="light">
                          <Text size="xs" fw={700}>{initials(row.jiraDisplayName)}</Text>
                        </ThemeIcon>
                        <div>
                          <Text size="xs" fw={500}>{row.jiraDisplayName}</Text>
                          {row.jiraAccountId && (
                            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{row.jiraAccountId}</Text>
                          )}
                          {(row.issueCount > 0 || row.hoursLogged > 0) && (
                            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                              {row.issueCount} issues · {Math.round(row.hoursLogged)}h
                            </Text>
                          )}
                        </div>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed" fs="italic">—</Text>
                    )}
                  </Table.Td>

                  {/* Mapped Resource - Inline Editable */}
                  <Table.Td>
                    <InlineSelectCell
                      value={row.resourceId ? String(row.resourceId) : null}
                      options={resourceOptions}
                      isEditing={isEditingMappedResource}
                      onStartEdit={() => startEdit(row.resourceId, 'mappedResource')}
                      onCancel={() => stopEdit()}
                      onSave={async (resourceIdStr) => {
                        const newResourceId = resourceIdStr ? parseInt(resourceIdStr, 10) : null;
                        await saveMut.mutateAsync({
                          jiraDisplayName: row.jiraDisplayName || '',
                          resourceId: newResourceId,
                          mappingType: 'MANUAL',
                        });
                        stopEdit();
                        refetchStats();
                        notifications.show({ title: 'Saved', message: 'Resource mapping updated', color: 'green' });
                      }}
                      placeholder="No resource"
                    />
                  </Table.Td>

                  {/* Confidence */}
                  <Table.Td>
                    {row.mappingType === 'MANUAL' ? (
                      <Text size="xs" c="dimmed">—</Text>
                    ) : row.confidence ? (
                      <Group gap={4} wrap="nowrap">
                        <div style={{
                          width: 40, height: 5, borderRadius: 3,
                          background: isDark ? '#2c2e33' : GRAY_100,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${(row.confidence ?? 0) * 100}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: `var(--mantine-color-${confidenceColor(row.confidence)}-6)`,
                          }} />
                        </div>
                        <Text size="xs" c={confidenceColor(row.confidence)} fw={600}>
                          {Math.round(row.confidence * 100)}%
                        </Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>

                  {/* Status */}
                  <Table.Td>{statusBadge(row)}</Table.Td>

                  {/* Actions */}
                  <Table.Td>
                    <Group gap={4}>
                      {isEditingRow ? (
                        <>
                          <Tooltip label={editJiraName ? 'Save mapping' : 'Save as unmapped'}>
                            <ActionIcon
                              size="sm" color="green" variant="light"
                              onClick={() => {
                                if (editJiraName) {
                                  handleSave(editJiraName, row.resourceId, 'MANUAL');
                                } else {
                                  // Save with empty = clear this resource's mapping
                                  handleClearMapping(row.resourceId);
                                }
                              }}
                              loading={saveMut.isPending || clearMut.isPending}
                            >
                              <IconDeviceFloppy size={13} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Cancel">
                            <ActionIcon size="sm" color="gray" variant="light" onClick={() => { setEditingRow(null); setEditJiraName(null); }}>
                              <IconX size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      ) : row.jiraDisplayName && !row.confirmed && row.mappingType === 'AUTO' ? (
                        <>
                          <Tooltip label="Accept match">
                            <ActionIcon
                              size="sm" color="green" variant="light"
                              onClick={() => handleSave(row.jiraDisplayName!, row.resourceId, 'AUTO')}
                              loading={saveMut.isPending}
                            >
                              <IconCheck size={13} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Change Jira user">
                            <ActionIcon
                              size="sm" color="blue" variant="light"
                              onClick={() => { setEditingRow(row.resourceId); setEditJiraName(row.jiraDisplayName); }}
                            >
                              <IconEdit size={13} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remove mapping">
                            <ActionIcon
                              size="sm" color="orange" variant="light"
                              onClick={() => handleClearMapping(row.resourceId)}
                              loading={clearMut.isPending}
                            >
                              <IconLinkOff size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      ) : row.jiraDisplayName ? (
                        <>
                          <Tooltip label="Change Jira user">
                            <ActionIcon
                              size="sm" color="blue" variant="light"
                              onClick={() => { setEditingRow(row.resourceId); setEditJiraName(row.jiraDisplayName); }}
                            >
                              <IconEdit size={13} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remove mapping">
                            <ActionIcon
                              size="sm" color="orange" variant="light"
                              onClick={() => handleClearMapping(row.resourceId)}
                              loading={clearMut.isPending}
                            >
                              <IconLinkOff size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          <Tooltip label="Assign Jira user">
                            <ActionIcon
                              size="sm" color="blue" variant="light"
                              onClick={() => { setEditingRow(row.resourceId); setEditJiraName(null); }}
                            >
                              <IconEdit size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed" py="xl">
                    {resourceRows.length === 0
                      ? 'No active resources found — add resources in the Resources page first'
                      : 'No results match your filters'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Text size="xs" c="dimmed">Showing {filtered.length} of {totalResources} resources</Text>

      {/* Buffer Section - Jira users who log hours but aren't named resources */}
      {bufferRows.length > 0 && (
        <Paper withBorder p="sm" radius="md" mt="sm">
          <Group
            justify="space-between"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowBuffer(!showBuffer)}
          >
            <Group gap="xs">
              <ThemeIcon size={24} radius="xl" color="orange" variant="light">
                <IconUsers size={14} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={600} style={{ color: isDark ? '#fff' : DEEP_BLUE }}>
                  Buffer Jira Users
                </Text>
                <Text size="xs" c="dimmed">
                  {bufferRows.length} Jira user{bufferRows.length !== 1 ? 's' : ''} logging hours but not mapped to any resource
                </Text>
              </div>
            </Group>
            <ActionIcon variant="subtle" size="sm">
              {showBuffer ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </ActionIcon>
          </Group>
          <Collapse in={showBuffer}>
            <ScrollArea mt="sm">
              <Table fz="xs" withColumnBorders withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>#</Table.Th>
                    <Table.Th>Jira Display Name</Table.Th>
                    <Table.Th style={{ width: 100 }}>Issues</Table.Th>
                    <Table.Th style={{ width: 100 }}>Hours</Table.Th>
                    <Table.Th style={{ width: 90 }}>Category</Table.Th>
                    <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {bufferRows.map((m, idx) => (
                    <Table.Tr key={m.jiraDisplayName}>
                      <Table.Td><Text size="xs" c="dimmed">{idx + 1}</Text></Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ThemeIcon size={22} radius="xl" color="orange" variant="light">
                            <Text size="xs" fw={700}>{initials(m.jiraDisplayName)}</Text>
                          </ThemeIcon>
                          <div>
                            <Text size="xs" fw={500}>{m.jiraDisplayName}</Text>
                            {m.jiraAccountId && (
                              <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{m.jiraAccountId}</Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="xs">{m.issueCount}</Text></Table.Td>
                      <Table.Td><Text size="xs">{Math.round(m.hoursLogged)}h</Text></Table.Td>
                      <Table.Td>
                        <Badge size="xs" color="orange" variant="filled">Buffer</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Mark non-billable">
                            <ActionIcon
                              size="sm" color="gray" variant="light"
                              onClick={() => handleSave(m.jiraDisplayName, null, 'EXCLUDED')}
                              loading={saveMut.isPending}
                            >
                              <IconUserOff size={13} />
                            </ActionIcon>
                          </Tooltip>
                          {m.id && (
                            <Tooltip label="Remove">
                              <ActionIcon size="sm" color="red" variant="light" onClick={() => deleteMut.mutate(m.id!, {
                                onSuccess: () => {
                                  refetchStats();
                                  notifications.show({ title: 'Removed', message: 'Buffer entry removed', color: 'orange' });
                                },
                              })} loading={deleteMut.isPending}>
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Collapse>
        </Paper>
      )}
    </Stack>
  );
}
