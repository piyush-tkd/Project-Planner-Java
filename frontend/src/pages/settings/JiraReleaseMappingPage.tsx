import { useState, useMemo } from 'react';
import {
 Title, Text, Group, Button, Badge, Table, TextInput, Select, MultiSelect,
 Alert, ActionIcon, Tooltip, Stack, Paper, SimpleGrid, ScrollArea,
 ThemeIcon, Modal, Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
 IconPackage, IconSearch, IconWand, IconCheck, IconX, IconArrowRight,
 IconRefresh, IconDeviceFloppy, IconEdit, IconTrash, IconLink,
} from '@tabler/icons-react';
import {
 useReleaseMappings, useFixVersionsScan, useAutoMatchReleases,
 useSaveReleaseMapping, useDeleteReleaseMapping, useSaveBulkReleaseMapping,
 type ReleaseMappingResponse,
} from '../../api/jiraReleaseMapping';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import { DEEP_BLUE, DEEP_BLUE_HEX, AQUA, AQUA_HEX, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';

export default function JiraReleaseMappingPage() {
 const isDark = useDarkMode();
 const { data: mappings, isLoading, error, refetch } = useReleaseMappings();
 const { data: fixVersions } = useFixVersionsScan();
 const autoMatchMut = useAutoMatchReleases();
 const saveMut = useSaveReleaseMapping();
 const deleteMut = useDeleteReleaseMapping();
 const bulkSaveMut = useSaveBulkReleaseMapping();

 const [search, setSearch] = useState('');
 const [editingRelease, setEditingRelease] = useState<number | null>(null);
 const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
 const [linkModalOpen, setLinkModalOpen] = useState(false);
 const [linkTarget, setLinkTarget] = useState<ReleaseMappingResponse | null>(null);

 const versionOptions = useMemo(() => {
 if (!fixVersions) return [];
 return fixVersions.map(v => ({
 value: `${v.versionName}||${v.projectKey}`,
 label: `${v.projectKey}: ${v.versionName} (${v.issueCount} issues)`,
 }));
 }, [fixVersions]);

 const filtered = useMemo(() => {
 if (!mappings) return [];
 if (!search) return mappings;
 const q = search.toLowerCase();
 return mappings.filter(m =>
 m.releaseName.toLowerCase().includes(q) ||
 m.linkedVersions.some(v => v.versionName.toLowerCase().includes(q))
 );
 }, [mappings, search]);

 const linkedCount = useMemo(() => (mappings ?? []).filter(m => m.linkedVersions.length > 0).length, [mappings]);
 const unlinkedCount = useMemo(() => (mappings ?? []).filter(m => m.linkedVersions.length === 0).length, [mappings]);

 function handleAutoMatch() {
 autoMatchMut.mutate(undefined, {
 onSuccess: () => {
 notifications.show({ title: 'Auto-match complete', message: 'Release mappings updated', color: 'teal' });
 },
 });
 }

 function openLinkModal(release: ReleaseMappingResponse) {
 setLinkTarget(release);
 setSelectedVersions(
 release.linkedVersions.map(v => `${v.versionName}||${v.projectKey ?? ''}`)
 );
 setLinkModalOpen(true);
 }

 function handleSaveBulk() {
 if (!linkTarget) return;
 const mappingsToSave = selectedVersions.map(v => {
 const [versionName, projectKey] = v.split('||');
 return {
 releaseCalendarId: linkTarget.releaseCalendarId,
 jiraVersionName: versionName,
 jiraProjectKey: projectKey || null,
 mappingType: 'MANUAL',
 };
 });
 bulkSaveMut.mutate({ releaseCalendarId: linkTarget.releaseCalendarId, mappings: mappingsToSave }, {
 onSuccess: () => {
 setLinkModalOpen(false);
 setLinkTarget(null);
 notifications.show({ title: 'Saved', message: `Links updated for ${linkTarget.releaseName}`, color: 'green' });
 },
 });
 }

 function handleDeleteLink(mappingId: number) {
 deleteMut.mutate(mappingId, {
 onSuccess: () => {
 notifications.show({ title: 'Removed', message: 'Link removed', color: 'orange' });
 },
 });
 }

 if (isLoading) return <LoadingSpinner />;
 if (error) return <PageError context="loading release mappings" error={error} onRetry={() => refetch()} />;

 return (
 <Stack gap="md">
 <Group justify="space-between" align="flex-start">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>
 Jira Release Mapping
 </Title>
 <Text size="sm" c="dimmed" mt={4}>Link release calendar entries to Jira fix versions</Text>
 </div>
 <Group gap="xs">
 <Button
 variant="outline"
 size="xs"
 leftSection={<IconRefresh size={14} />}
 onClick={() => refetch()}
 >
 Refresh
 </Button>
 <Button
 size="xs"
 leftSection={<IconWand size={14} />}
 loading={autoMatchMut.isPending}
 onClick={handleAutoMatch}
 variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
 >
 Auto-Match
 </Button>
 </Group>
 </Group>

 {/* Stats */}
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
 <Paper withBorder p="sm" radius="md">
 <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Calendar Releases</Text>
 <Text size="xl" fw={700}>{mappings?.length ?? 0}</Text>
 </Paper>
 <Paper withBorder p="sm" radius="md">
 <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Jira Fix Versions</Text>
 <Text size="xl" fw={700}>{fixVersions?.length ?? 0}</Text>
 </Paper>
 <Paper withBorder p="sm" radius="md">
 <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Linked</Text>
 <Text size="xl" fw={700} c="green">{linkedCount}</Text>
 </Paper>
 <Paper withBorder p="sm" radius="md">
 <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Unlinked</Text>
 <Text size="xl" fw={700} c="yellow">{unlinkedCount}</Text>
 </Paper>
 </SimpleGrid>

 <Alert variant="light" color="teal" icon={<IconPackage size={16} />}>
 <Text size="sm">
 Auto-matching compares release names and dates with Jira fix version names.
 One release can map to multiple fix versions across different PODs.
 </Text>
 </Alert>

 <TextInput
 placeholder="Search by release name or version..."
 leftSection={<IconSearch size={14} />}
 value={search}
 onChange={e => setSearch(e.target.value)}
 style={{ maxWidth: 300 }}
 size="xs"
 />

 {/* Table */}
 <ScrollArea>
 <Table fz="xs" withColumnBorders withTableBorder>
 <Table.Thead>
 <Table.Tr>
 <Table.Th>Release</Table.Th>
 <Table.Th style={{ width: 100 }}>Release Date</Table.Th>
 <Table.Th style={{ width: 30 }}></Table.Th>
 <Table.Th>Linked Jira Fix Versions</Table.Th>
 <Table.Th style={{ width: 90 }}>Match Type</Table.Th>
 <Table.Th style={{ width: 80 }}>Status</Table.Th>
 <Table.Th style={{ width: 80 }}>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {filtered.map(m => (
 <Table.Tr key={m.releaseCalendarId} style={{
 background: m.linkedVersions.length === 0
 ? (isDark ? 'rgba(250,82,82,0.04)' : 'rgba(250,82,82,0.03)')
 : (isDark ? 'rgba(64,192,87,0.04)' : 'rgba(64,192,87,0.03)'),
 }}>
 <Table.Td>
 <div>
 <Text size="xs" fw={600}>{m.releaseName}</Text>
 <Group gap={4} mt={2}>
 <Badge size="xs" color={m.releaseType === 'SPECIAL' ? 'orange' : 'blue'} variant="light">
 {m.releaseType}
 </Badge>
 <Text size="xs" c="dimmed">Freeze: {m.codeFreezeDate}</Text>
 </Group>
 </div>
 </Table.Td>
 <Table.Td>
 <Text size="xs">{m.releaseDate}</Text>
 </Table.Td>
 <Table.Td>
 <IconArrowRight size={14} color={m.linkedVersions.length > 0 ? undefined : 'var(--mantine-color-red-5)'} />
 </Table.Td>
 <Table.Td>
 {m.linkedVersions.length > 0 ? (
 <Group gap={4} wrap="wrap">
 {m.linkedVersions.map(v => (
 <Group key={v.mappingId} gap={4} wrap="nowrap">
 <Badge size="xs" color="teal" variant="light">{v.projectKey}</Badge>
 <Text size="xs">{v.versionName}</Text>
 <Tooltip label="Remove link">
 <ActionIcon size="xs" color="red" variant="subtle" onClick={() => handleDeleteLink(v.mappingId)}>
 <IconX size={10} />
 </ActionIcon>
 </Tooltip>
 </Group>
 ))}
 </Group>
 ) : (
 <Text size="xs" c="dimmed" fs="italic">No linked versions</Text>
 )}
 </Table.Td>
 <Table.Td>
 {m.mappingType ? (
 <Badge size="xs" color={m.mappingType === 'MANUAL' ? 'indigo' : 'green'} variant="light">
 {m.mappingType === 'MANUAL' ? 'Manual' : 'Auto'}
 </Badge>
 ) : (
 <Text size="xs" c="dimmed">—</Text>
 )}
 </Table.Td>
 <Table.Td>
 <Badge size="xs" color={m.linkedVersions.length > 0 ? 'green' : 'red'}>
 {m.linkedVersions.length > 0 ? 'Linked' : 'Unlinked'}
 </Badge>
 </Table.Td>
 <Table.Td>
 <Tooltip label="Edit links">
 <ActionIcon size="sm" color="blue" variant="light" onClick={() => openLinkModal(m)}>
 <IconLink size={13} />
 </ActionIcon>
 </Tooltip>
 </Table.Td>
 </Table.Tr>
 ))}
 {filtered.length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={7}>
 <Text ta="center" c="dimmed" py="xl">
 {(mappings ?? []).length === 0
 ? 'No release calendar entries found — add releases first via the Release Calendar page'
 : 'No results match your search'}
 </Text>
 </Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>
 </ScrollArea>

 {/* Link modal */}
 <Modal
 opened={linkModalOpen}
 onClose={() => setLinkModalOpen(false)}
 title={`Link Fix Versions → ${linkTarget?.releaseName ?? ''}`}
 size="lg"
 >
 <Stack>
 {linkTarget && (
 <Alert variant="light" color="blue" mb="xs">
 <Text size="xs">
 Release: <strong>{linkTarget.releaseName}</strong> · Date: {linkTarget.releaseDate} · Freeze: {linkTarget.codeFreezeDate}
 </Text>
 </Alert>
 )}
 <MultiSelect
 label="Jira Fix Versions"
 description="Select one or more fix versions to link to this release"
 data={versionOptions}
 value={selectedVersions}
 onChange={setSelectedVersions}
 searchable
 clearable
 placeholder="Search and select versions..."
 />
 <Group justify="flex-end">
 <Button variant="outline" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
 <Button
 leftSection={<IconDeviceFloppy size={14} />}
 onClick={handleSaveBulk}
 loading={bulkSaveMut.isPending}
 variant="filled" style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
 >
 Save Links
 </Button>
 </Group>
 </Stack>
 </Modal>
 </Stack>
 );
}
