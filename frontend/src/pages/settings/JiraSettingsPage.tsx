import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Title, Text, Group, Button, Select, Badge,
 Alert, Loader, ActionIcon, Tooltip, Paper, Divider,
 ThemeIcon, Box, Stack, MultiSelect, Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
 IconTicket, IconRefresh, IconInfoCircle, IconDeviceFloppy,
 IconAlertTriangle, IconPlus, IconTrash, IconGripVertical,
} from '@tabler/icons-react';
import {
 useJiraStatus, useJiraAllProjectsSimple, useClearJiraCache,
 usePodWatchConfig, useSavePodWatchConfig,
 PodConfigRequest,
} from '../../api/jira';
import { usePods } from '../../api/pods';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';

interface PodRow {
 key: string; // local temp key
 podDisplayName: string;
 enabled: boolean;
 boardKeys: string[];
}

function makeRow(overrides: Partial<PodRow> = {}): PodRow {
 return {
 key: crypto.randomUUID(),
 podDisplayName: '',
 enabled: true,
 boardKeys: [],
 ...overrides,
 };
}

export default function JiraSettingsPage() {
 const navigate = useNavigate();

 const { data: status, isLoading: statusLoading } = useJiraStatus();
 // Full project list — needed so users can pick any Jira project for a new POD mapping
 const { data: jiraProjects = [], isLoading: projectsLoading, refetch: refetchProjects } = useJiraAllProjectsSimple();
 const { data: savedConfig = [], isLoading: configLoading } = usePodWatchConfig();
 const { data: ppPods = [], isLoading: ppPodsLoading } = usePods();
 const save = useSavePodWatchConfig();
 const clearCache = useClearJiraCache();

 const [rows, setRows] = useState<PodRow[]>([]);
 const [dirty, setDirty] = useState(false);

 // Sync from server when config loads (but don't clobber user edits)
 useEffect(() => {
 if (!dirty && savedConfig.length > 0) {
 setRows(savedConfig.map(c => makeRow({
 podDisplayName: c.podDisplayName,
 enabled: c.enabled,
 boardKeys: c.boardKeys,
 })));
 }
 }, [savedConfig]); // eslint-disable-line react-hooks/exhaustive-deps

 const addPod = () => {
 setRows(r => [...r, makeRow()]);
 setDirty(true);
 };

 const removePod = (key: string) => {
 setRows(r => r.filter(row => row.key !== key));
 setDirty(true);
 };

 const updatePod = useCallback((key: string, patch: Partial<PodRow>) => {
 setRows(r => r.map(row => row.key === key ? { ...row, ...patch } : row));
 setDirty(true);
 }, []);

 const handleSave = async () => {
 const valid = rows.filter(r => r.podDisplayName.trim() && r.boardKeys.length > 0);
 if (valid.length === 0) {
 notifications.show({ message: 'Add at least one POD with boards assigned.', color: 'orange' });
 return;
 }
 const payload: PodConfigRequest[] = valid.map(r => ({
 podDisplayName: r.podDisplayName.trim(),
 enabled: r.enabled,
 boardKeys: r.boardKeys,
 }));
 try {
 await save.mutateAsync(payload);
 setDirty(false);
 notifications.show({
 title: 'Saved',
 message: `${valid.length} POD(s) configured.`,
 color: 'teal',
 });
 } catch {
 notifications.show({ title: 'Save failed', message: 'Please try again.', color: 'red' });
 }
 };

 // Build board picker options — exclude boards already assigned to OTHER rows
 const allBoardOptions = jiraProjects.map(p => ({
 value: p.key,
 label: `${p.key} – ${p.name}`,
 }));

 function availableBoardOptions(forRowKey: string) {
 const usedElsewhere = new Set(
 rows.filter(r => r.key !== forRowKey).flatMap(r => r.boardKeys)
 );
 return allBoardOptions.map(o => ({
 ...o,
 disabled: usedElsewhere.has(o.value),
 }));
 }

 // Build POD picker options — PP POD names, disabled if already used in another row
 const allPpPodOptions = ppPods.map(p => ({ value: p.name, label: p.name }));

 function availablePodOptions(forRowKey: string) {
 const usedElsewhere = new Set(
 rows.filter(r => r.key !== forRowKey && r.podDisplayName).map(r => r.podDisplayName)
 );
 return allPpPodOptions.map(o => ({
 ...o,
 disabled: usedElsewhere.has(o.value),
 }));
 }

 const loading = statusLoading || configLoading;
 const enabledCount = rows.filter(r => r.enabled && r.boardKeys.length > 0).length;
 const totalBoards = rows.reduce((n, r) => n + r.boardKeys.length, 0);
 const allPodsAssigned = ppPods.length > 0 && rows.length >= ppPods.length;

 return (
 <Box p="md" maw={900} className="page-enter stagger-children">
 {/* ── Page header ── */}
 <Group mb="lg" gap="sm" className="slide-in-left">
 <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
 <IconTicket size={22} color="white" />
 </ThemeIcon>
 <div>
 <Title order={3} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
 Jira Board Settings
 </Title>
 <Text size="sm" c="dimmed">
 Link your Portfolio Planner PODs to Jira boards. Multiple boards per POD are
 aggregated in the{' '}
 <Anchor size="sm" onClick={() => navigate('/jira-pods')}>POD Dashboard</Anchor>
 {' '}and{' '}
 <Anchor size="sm" onClick={() => navigate('/jira-actuals')}>Jira Actuals</Anchor>.
 </Text>
 </div>
 </Group>

 {/* ── Jira not configured ── */}
 {!statusLoading && !status?.configured && (
 <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured" mb="md">
 Add your Jira credentials in{' '}
 <Anchor size="sm" onClick={() => navigate('/settings/jira-credentials')}>
 Settings → Jira Credentials
 </Anchor>{' '}
 — no YAML file edits required.
 </Alert>
 )}

 {/* ── No PP PODs defined ── */}
 {!ppPodsLoading && ppPods.length === 0 && status?.configured && (
 <Alert icon={<IconInfoCircle />} color="blue" title="No PODs defined yet" mb="md">
 You need to create PODs in the{' '}
 <Text
 component="span" size="sm" fw={600}
 style={{ cursor: 'pointer', textDecoration: 'underline' }}
 onClick={() => navigate('/pods')}
 >
 PODs page
 </Text>
 {' '}before you can link them to Jira boards.
 </Alert>
 )}

 {loading && (
 <Stack align="center" py="xl">
 <Loader size="sm" />
 <Text size="sm" c="dimmed">Loading…</Text>
 </Stack>
 )}

 {!loading && status?.configured && (
 <Paper withBorder radius="md" p="md">

 {/* ── Toolbar ── */}
 <Group justify="space-between" mb="md">
 <Group gap="xs">
 <Badge color="teal" size="sm">{enabledCount} active PODs</Badge>
 <Badge color="blue" size="sm" variant="outline">{totalBoards} boards assigned</Badge>
 {dirty && <Badge color="orange" size="sm" variant="light">Unsaved changes</Badge>}
 </Group>
 <Group gap="xs">
 <Tooltip label="Refresh board list from Jira">
 <ActionIcon variant="light" loading={projectsLoading} onClick={() => refetchProjects()}>
 <IconRefresh size={16} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Clear all Jira caches (forces fresh data across all Integration pages)">
 <Button
 size="xs"
 variant="light"
 color="orange"
 loading={clearCache.isPending}
 onClick={() =>
 clearCache.mutate(undefined, {
 onSuccess: () => {
 notifications.show({
 title: 'Cache cleared',
 message: 'All Jira caches cleared — next load will fetch live data.',
 color: 'teal',
 });
 refetchProjects();
 },
 })
 }
 >
 Clear Cache
 </Button>
 </Tooltip>
 <Tooltip label={allPodsAssigned ? 'All PODs are already configured' : 'Add a POD'}>
 <Button
 size="sm"
 leftSection={<IconPlus size={14} />}
 variant="light"
 onClick={addPod}
 disabled={ppPods.length === 0 || allPodsAssigned}
 >
 Add POD
 </Button>
 </Tooltip>
 <Button
 size="sm"
 leftSection={<IconDeviceFloppy size={15} />}
 style={{ backgroundColor: DEEP_BLUE }}
 loading={save.isPending}
 disabled={!dirty}
 onClick={handleSave}
 >
 Save
 </Button>
 </Group>
 </Group>

 <Alert icon={<IconInfoCircle size={15} />} color="blue" variant="light" mb="md" p="xs">
 <Text size="xs">
 Select a POD from your Portfolio Planner and assign one or more Jira boards to it.
 A board can only belong to one POD. Disabled PODs are hidden from dashboards
 but their config is kept.
 </Text>
 </Alert>

 <Divider mb="md" />

 {/* ── POD rows ── */}
 {ppPodsLoading || projectsLoading ? (
 <Stack align="center" py="lg">
 <Loader size="sm" />
 <Text size="sm" c="dimmed">Loading PODs and boards…</Text>
 </Stack>
 ) : rows.length === 0 ? (
 <Stack align="center" py="xl" gap="sm">
 <Text size="sm" c="dimmed">No Jira boards linked to any POD yet.</Text>
 {ppPods.length > 0 && (
 <Button
 size="sm"
 leftSection={<IconPlus size={14} />}
 variant="light"
 onClick={addPod}
 >
 Link your first POD
 </Button>
 )}
 </Stack>
 ) : (
 <Stack gap="sm">
 {rows.map((row, idx) => (
 <PodRow
 key={row.key}
 row={row}
 index={idx}
 podOptions={availablePodOptions(row.key)}
 boardOptions={availableBoardOptions(row.key)}
 ppPodsLoading={ppPodsLoading}
 onChange={patch => updatePod(row.key, patch)}
 onRemove={() => removePod(row.key)}
 />
 ))}
 </Stack>
 )}

 {/* ── Bottom save bar ── */}
 {dirty && rows.length > 0 && (
 <>
 <Divider mt="md" mb="sm" />
 <Group justify="flex-end">
 <Button
 size="sm"
 variant="default"
 onClick={() => {
 setRows(savedConfig.map(c => makeRow({
 podDisplayName: c.podDisplayName,
 enabled: c.enabled,
 boardKeys: c.boardKeys,
 })));
 setDirty(false);
 }}
 >
 Discard Changes
 </Button>
 <Button
 size="sm"
 leftSection={<IconDeviceFloppy size={15} />}
 style={{ backgroundColor: DEEP_BLUE }}
 loading={save.isPending}
 onClick={handleSave}
 >
 Save
 </Button>
 </Group>
 </>
 )}
 </Paper>
 )}
 </Box>
 );
}

// ── POD row component ─────────────────────────────────────────────────

function PodRow({
 row, index, podOptions, boardOptions, ppPodsLoading, onChange, onRemove,
}: {
 row: PodRow;
 index: number;
 podOptions: { value: string; label: string; disabled?: boolean }[];
 boardOptions: { value: string; label: string; disabled?: boolean }[];
 ppPodsLoading: boolean;
 onChange: (patch: Partial<PodRow>) => void;
 onRemove: () => void;
}) {
 const noBoardsYet = row.boardKeys.length === 0;

 return (
 <Paper
 withBorder
 p="sm"
 radius="sm"
 style={{
 borderLeft: `4px solid ${row.enabled ? AQUA : '#CBD5E1'}`,
 opacity: row.enabled ? 1 : 0.6,
 }}
 >
 <Group gap="sm" wrap="nowrap" align="flex-start">
 {/* Drag handle (visual only for now) */}
 <Box pt={8} style={{ color: '#94A3B8', cursor: 'grab', flexShrink: 0 }}>
 <IconGripVertical size={16} />
 </Box>

 {/* POD index badge */}
 <Box
 style={{
 flexShrink: 0, width: 28, height: 28, borderRadius: 6,
 background: DEEP_BLUE, display: 'flex', alignItems: 'center',
 justifyContent: 'center', marginTop: 6,
 }}
 >
 <Text size="xs" fw={700} style={{ color: '#fff' }}>{index + 1}</Text>
 </Box>

 {/* POD picker + board picker */}
 <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
 <Group gap="sm" wrap="nowrap">
 {/* ── POD selector (picks from PP PODs) ── */}
 <Select
 placeholder={ppPodsLoading ? 'Loading PODs…' : 'Select a POD…'}
 data={podOptions}
 value={row.podDisplayName || null}
 onChange={v => onChange({ podDisplayName: v ?? '' })}
 searchable
 size="sm"
 style={{ flex: 1 }}
 error={row.podDisplayName.trim() === '' ? 'Select a POD' : undefined}
 disabled={ppPodsLoading}
 nothingFoundMessage="No matching PODs"
 />
 <Tooltip label={row.enabled ? 'Click to disable' : 'Click to enable'}>
 <Badge
 size="sm"
 variant={row.enabled ? 'filled' : 'outline'}
 color={row.enabled ? 'teal' : 'gray'}
 style={{ cursor: 'pointer', flexShrink: 0 }}
 onClick={() => onChange({ enabled: !row.enabled })}
 >
 {row.enabled ? 'Enabled' : 'Disabled'}
 </Badge>
 </Tooltip>
 </Group>

 {/* ── Board picker ── */}
 <MultiSelect
 placeholder={boardOptions.length === 0 ? 'No Jira boards available' : 'Assign Jira boards…'}
 data={boardOptions}
 value={row.boardKeys}
 onChange={keys => onChange({ boardKeys: keys })}
 searchable
 size="xs"
 nothingFoundMessage="No matching boards"
 error={noBoardsYet ? 'Add at least one board' : undefined}
 styles={{
 input: { minHeight: 32 },
 pill: { backgroundColor: `${DEEP_BLUE}18`, color: DEEP_BLUE, fontWeight: 600 },
 }}
 />

 {row.boardKeys.length > 0 && (
 <Group gap={4}>
 {row.boardKeys.map(k => (
 <Badge key={k} size="xs" variant="outline" color="blue">{k}</Badge>
 ))}
 </Group>
 )}
 </Stack>

 {/* Remove button */}
 <Tooltip label="Remove">
 <ActionIcon
 color="red"
 variant="subtle"
 size="sm"
 mt={6}
 onClick={onRemove}
 >
 <IconTrash size={14} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Paper>
 );
}
