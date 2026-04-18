import { useState, useEffect, useCallback } from 'react';
import {
 Title, Text, Group, Button, Badge, TagsInput,
 Alert, Skeleton, ActionIcon, Tooltip, Paper, Divider,
 ThemeIcon, Box, Stack, Anchor, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
 IconTag, IconRefresh, IconDeviceFloppy, IconAlertTriangle,
 IconInfoCircle, IconLayersIntersect,
} from '@tabler/icons-react';
import {
 useJiraStatus, useReleaseConfig, useSaveReleaseConfig,
 usePodFixVersions, useClearJiraCache,
 ReleaseConfigResponse, ReleaseConfigRequest,
} from '../../api/jira';
import { useDarkMode } from '../../hooks/useDarkMode';
import { AQUA, DEEP_BLUE, SURFACE_SUCCESS_LIGHT } from '../../brandTokens';

// ── Per-pod version picker ────────────────────────────────────────────

interface PodVersionPickerProps {
 config: ReleaseConfigResponse;
 selectedVersions: string[];
 onChange: (versions: string[]) => void;
}

function PodVersionPicker({ config, selectedVersions, onChange }: PodVersionPickerProps) {
 const dark = useDarkMode();
 // Auto-load fix versions on mount so suggestions are immediately available
 const { data: fixVersions = [], isLoading, refetch: refetchVersions } = usePodFixVersions(config.podId);

 const options = fixVersions.map(v => ({
 value: v.name,
 label: v.released ? `${v.name} ✓` : v.name,
 disabled: false,
 }));

 // Merge any already-selected versions that might not be returned (e.g. archived)
 const allOptions = [...new Set([
 ...selectedVersions,
 ...options.map(o => o.value),
 ])].map(name => {
 const found = options.find(o => o.value === name);
 return found ?? { value: name, label: name };
 });

 return (
 <Paper withBorder p="md" radius="md" mb="xs">
 <Group justify="space-between" mb="sm">
 <Group gap="xs">
 <ThemeIcon size={26} radius="sm" style={{ backgroundColor: DEEP_BLUE }}>
 <IconTag size={14} color="white" />
 </ThemeIcon>
 <div>
 <Text fw={600} size="sm" style={{ color: dark ? '#fff' : DEEP_BLUE }}>
 {config.podDisplayName}
 </Text>
 <Group gap={4} mt={2}>
 {config.boardKeys.map(k => (
 <Badge key={k} size="xs" variant="outline" color="gray">{k}</Badge>
 ))}
 {!config.enabled && (
 <Badge size="xs" color="red" variant="light">disabled</Badge>
 )}
 </Group>
 </div>
 </Group>
 <Tooltip label="Reload fix versions from Jira">
 <ActionIcon
 size="sm"
 variant="light"
 color="teal"
 loading={isLoading}
 onClick={() => refetchVersions()}
 aria-label="Refresh"
>
 <IconRefresh size={13} />
 </ActionIcon>
 </Tooltip>
 </Group>

 <TagsInput
 placeholder={
 isLoading ? 'Loading fix versions from Jira…' : 'Select or type a version name, press Enter to add'
 }
 data={allOptions.map(o => o.value)}
 value={selectedVersions}
 onChange={onChange}
 clearable
 size="sm"
 styles={{ input: { } }}
 />

 {selectedVersions.length > 0 && (
 <Text size="xs" c="dimmed" mt={4}>
 {selectedVersions.length} version{selectedVersions.length !== 1 ? 's' : ''} tracked
 </Text>
 )}
 </Paper>
 );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function ReleaseSettingsPage() {
 const dark = useDarkMode();
 const { data: status, isLoading: statusLoading } = useJiraStatus();
 const { data: savedConfig = [], isLoading: configLoading, refetch } = useReleaseConfig();
 const save = useSaveReleaseConfig();
 const clearCache = useClearJiraCache();

 // Local state: podId → selected versions
 const [selections, setSelections] = useState<Record<number, string[]>>({});
 const [dirty, setDirty] = useState(false);

 // "Apply to all PODs" state
 const [globalVersion, setGlobalVersion] = useState('');

 // Sync from server when config loads
 useEffect(() => {
 if (!dirty && savedConfig.length > 0) {
 const init: Record<number, string[]> = {};
 savedConfig.forEach(c => { init[c.podId] = [...c.versions]; });
 setSelections(init);
 }
 }, [savedConfig, dirty]);

 const handleChange = useCallback((podId: number, versions: string[]) => {
 setSelections(prev => ({ ...prev, [podId]: versions }));
 setDirty(true);
 }, []);

 /** Add a single version to every enabled POD (skips PODs that already have it) */
 const handleApplyToAll = () => {
 const v = globalVersion.trim();
 if (!v) return;
 setSelections(prev => {
 const next = { ...prev };
 savedConfig.forEach(c => {
 const current = next[c.podId] ?? [];
 if (!current.includes(v)) {
 next[c.podId] = [...current, v];
 }
 });
 return next;
 });
 setDirty(true);
 setGlobalVersion('');
 notifications.show({
 title: 'Version queued',
 message: `"${v}" added to all PODs — click Save to persist.`,
 color: 'teal',
 });
 };

 const handleSave = () => {
 const requests: ReleaseConfigRequest[] = savedConfig.map(c => ({
 podId: c.podId,
 versions: selections[c.podId] ?? [],
 versionNotes: c.versionNotes ?? {}, // preserve existing notes
 }));
 save.mutate(requests, {
 onSuccess: () => {
 setDirty(false);
 notifications.show({
 title: 'Release config saved',
 message: 'Tracked release versions updated.',
 color: 'green',
 });
 },
 onError: (err: Error) => {
 notifications.show({
 title: 'Save failed',
 message: err.message,
 color: 'red',
 });
 },
 });
 };

 const handleRefreshVersions = () => {
 clearCache.mutate(undefined, { onSettled: () => refetch() });
 };

 if (statusLoading || configLoading) return <Stack gap="xs" p="md">{[...Array(4)].map((_, i) => <Skeleton key={i} height={48} radius="sm" />)}</Stack>;

 if (!status?.configured) {
 return (
 <Box p="xl">
 <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured">
 Add your Jira credentials to{' '}
 <code>backend/src/main/resources/application-local.yml</code> and restart
 the backend with <code>-Dspring.profiles.active=local</code>.
 </Alert>
 </Box>
 );
 }

 const totalTracked = Object.values(selections).reduce((s, vs) => s + vs.length, 0);

 return (
 <Box p="md" className="page-enter stagger-children">
 {/* ── Header ── */}
 <Group justify="space-between" mb="md" className="slide-in-left">
 <Group gap="sm">
 <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
 <IconTag size={22} color="white" />
 </ThemeIcon>
 <div>
 <Title order={3} style={{ color: dark ? '#fff' : DEEP_BLUE }}>
 Release Version Settings
 </Title>
 <Text size="sm" c="dimmed">
 Choose which Jira fix versions to track per POD
 {totalTracked > 0 && ` · ${totalTracked} version${totalTracked !== 1 ? 's' : ''} tracked`}
 </Text>
 </div>
 </Group>
 <Group gap="xs">
 <Tooltip label="Clear Jira caches and reload fix versions">
 <Button
 variant="light"
 size="sm"
 leftSection={<IconRefresh size={15} />}
 loading={clearCache.isPending}
 onClick={handleRefreshVersions}
 >
 Refresh Jira
 </Button>
 </Tooltip>
 <Button
 size="sm"
 leftSection={<IconDeviceFloppy size={15} />}
 disabled={!dirty}
 loading={save.isPending}
 style={{
 backgroundColor: dirty ? DEEP_BLUE : undefined,
 color: dirty ? '#ffffff' : undefined,
 }}
 onClick={handleSave}
 >
 Save
 </Button>
 </Group>
 </Group>

 <Alert
 icon={<IconInfoCircle size={14} />}
 color="blue"
 variant="light"
 mb="md"
 >
 Fix versions are loaded automatically from Jira. Select the versions you want to track for
 each POD, or type a version name manually and press Enter. Use the <strong>↺</strong> icon
 next to a POD to reload its latest versions from Jira. Changes are saved when you click <strong>Save</strong>.
 </Alert>

 {/* ── Apply a version to ALL PODs at once ─────────────────────── */}
 {savedConfig.length > 0 && (
 <Paper withBorder p="md" radius="md" mb="md" style={{ background: SURFACE_SUCCESS_LIGHT, borderColor: AQUA }}>
 <Group gap="xs" mb={8}>
 <ThemeIcon size={22} radius="sm" style={{ backgroundColor: AQUA }}>
 <IconLayersIntersect size={13} color="white" />
 </ThemeIcon>
 <Text fw={600} size="sm" style={{ color: dark ? '#fff' : DEEP_BLUE }}>Apply version to all PODs</Text>
 </Group>
 <Text size="xs" c="dimmed" mb={10}>
 Type a fix version name and click Apply — it will be added to every POD's tracked list at once.
 </Text>
 <Group gap="xs">
 <TextInput
 placeholder="e.g. March 2026 Release"
 value={globalVersion}
 onChange={e => setGlobalVersion(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter') handleApplyToAll(); }}
 style={{ flex: 1 }}
 size="sm"
 />
 <Button
 size="sm"
 variant="filled"
 color="teal"
 disabled={!globalVersion.trim()}
 onClick={handleApplyToAll}
 >
 Apply to All
 </Button>
 </Group>
 </Paper>
 )}

 <Divider mb="md" />

 {savedConfig.length === 0 ? (
 <Alert color="orange" icon={<IconAlertTriangle size={14} />}>
 No PODs configured yet. Set up PODs in{' '}
 <Anchor href="/settings/jira" size="sm">Jira Boards Settings</Anchor> first.
 </Alert>
 ) : (
 <Stack gap="xs">
 {savedConfig.map(config => (
 <PodVersionPicker
 key={config.podId}
 config={config}
 selectedVersions={selections[config.podId] ?? []}
 onChange={(versions) => handleChange(config.podId, versions)}
 />
 ))}
 </Stack>
 )}

 {dirty && savedConfig.length > 0 && (
 <Group justify="flex-end" mt="lg">
 <Button
 leftSection={<IconDeviceFloppy size={15} />}
 loading={save.isPending}
 style={{ backgroundColor: DEEP_BLUE, color: '#ffffff' }}
 onClick={handleSave}
 >
 Save Changes
 </Button>
 </Group>
 )}
 </Box>
 );
}
