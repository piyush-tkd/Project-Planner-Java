import { useState, useEffect } from 'react';
import {
 Title, Text, Group, Button, TextInput, PasswordInput,
 Alert, Loader, ThemeIcon, Box, Stack, Divider, Badge,
 Paper, Anchor,
} from '@mantine/core';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { notifications } from '@mantine/notifications';
import {
 IconKey, IconDeviceFloppy, IconAlertTriangle, IconCircleCheck,
 IconInfoCircle, IconRefresh, IconLink,
} from '@tabler/icons-react';
import {
 useJiraCredentials, useSaveJiraCredentials, useJiraStatus, useClearJiraCache,
 useCapexSettings, useSaveCapexSettings,
} from '../../api/jira';
import { DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS, FONT_FAMILY } from '../../brandTokens';
import apiClient from '../../api/client';

// ── CapEx Field Section ────────────────────────────────────────────────

function CapexFieldSection() {
 const { data: settings, isLoading } = useCapexSettings();
 const save = useSaveCapexSettings();
 const [fieldId, setFieldId] = useState('');
 const [dirty, setDirty] = useState(false);

 useEffect(() => {
 if (settings?.capexFieldId !== undefined) {
 setFieldId(settings.capexFieldId);
 setDirty(false);
 }
 }, [settings]);

 return (
 <Paper withBorder p="lg" radius="md" mt="md">
 <Group gap="xs" mb="sm">
 <ThemeIcon size={28} radius="sm" style={{ backgroundColor: DEEP_BLUE }}>
 <IconKey size={15} color="white" />
 </ThemeIcon>
 <div>
 <Text fw={700} style={{ color: DEEP_BLUE }}>CapEx / OpEx Field</Text>
 <Text size="xs" c="dimmed">Custom field used to classify IDS vs NON-IDS tickets</Text>
 </div>
 </Group>
 <Divider mb="sm" />
 {isLoading ? (
 <Loader size="xs" />
 ) : (
 <Stack gap="sm">
 <TextInput
 label="Jira Custom Field ID"
 description='The field that stores IDS / NON-IDS on each ticket (e.g. customfield_10060). You can find this in Jira → Project Settings → Fields, or using the field picker on the CapEx/OpEx page.'
 placeholder="customfield_XXXXX"
 value={fieldId}
 onChange={e => { setFieldId(e.currentTarget.value); setDirty(true); }}
 />
 <Group>
 <Button
 size="xs"
 disabled={!dirty}
 loading={save.isPending}
 style={{ backgroundColor: DEEP_BLUE }}
 onClick={() => {
 save.mutate({ capexFieldId: fieldId.trim() }, {
 onSuccess: () => {
 setDirty(false);
 notifications.show({
 title: 'Saved',
 message: 'CapEx field ID saved.',
 color: 'teal',
 });
 },
 });
 }}
 >
 Save Field ID
 </Button>
 {settings?.capexFieldId && (
 <Badge variant="outline" color="teal" size="sm">
 Current: {settings.capexFieldId}
 </Badge>
 )}
 </Group>
 </Stack>
 )}
 </Paper>
 );
}

export default function JiraCredentialsPage() {
 const { data: saved, isLoading } = useJiraCredentials();
 const { data: status } = useJiraStatus();
 const save = useSaveJiraCredentials();
 const clearCache = useClearJiraCache();

 const [baseUrl, setBaseUrl] = useState('');
 const [email, setEmail] = useState('');
 const [apiToken, setApiToken] = useState('');
 const [dirty, setDirty] = useState(false);
 const [testing, setTesting] = useState(false);

 // Pre-fill from server when data loads
 useEffect(() => {
 if (saved && !dirty) {
 setBaseUrl(saved.baseUrl ?? '');
 setEmail(saved.email ?? '');
 // Show placeholder when token is already saved (don't expose it)
 setApiToken(saved.hasToken ? '••••••••••••••••' : '');
 }
 }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

 const handleChange = (field: 'baseUrl' | 'email' | 'apiToken', value: string) => {
 if (field === 'baseUrl') setBaseUrl(value);
 if (field === 'email') setEmail(value);
 if (field === 'apiToken') setApiToken(value);
 setDirty(true);
 };

 const handleSave = () => {
 if (!baseUrl.trim() || !email.trim()) {
 notifications.show({ message: 'Base URL and email are required.', color: 'orange' });
 return;
 }
 save.mutate(
 { baseUrl: baseUrl.trim(), email: email.trim(), apiToken: apiToken.trim() },
 {
 onSuccess: () => {
 setDirty(false);
 notifications.show({
 title: 'Credentials saved',
 message: 'Jira connection settings updated. All caches cleared.',
 color: 'teal',
 });
 },
 onError: (err: Error) => {
 notifications.show({ title: 'Save failed', message: err.message, color: 'red' });
 },
 }
 );
 };

 const handleTestConnection = async () => {
 setTesting(true);
 try {
 const { data } = await apiClient.get('/jira/test');
 if (data.ok) {
 notifications.show({
 title: 'Connection successful',
 message: `Connected as: ${JSON.stringify(data.response).slice(0, 120)}`,
 color: 'teal',
 });
 } else {
 notifications.show({
 title: 'Connection failed',
 message: data.error ?? 'Unknown error',
 color: 'red',
 });
 }
 } catch (e: unknown) {
 notifications.show({ title: 'Test failed', message: String(e), color: 'red' });
 } finally {
 setTesting(false);
 }
 };

 if (isLoading) return <LoadingSpinner variant="form" message="Loading credentials..." />;

 const isConfigured = status?.configured ?? false;

 return (
 <Box p="md" maw={620} className="page-enter stagger-children">
 {/* Header */}
 <Group mb="lg" gap="sm" className="slide-in-left">
 <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
 <IconKey size={22} color="white" />
 </ThemeIcon>
 <div>
 <Title order={3} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
 Jira Credentials
 </Title>
 <Text size="sm" c="dimmed">
 Configure your Jira Cloud connection from the UI — no YAML edits needed
 </Text>
 </div>
 </Group>

 {/* Status badge */}
 <Group mb="md" gap="xs">
 {isConfigured ? (
 <Badge
 size="md"
 color="teal"
 variant="light"
 leftSection={<IconCircleCheck size={13} />}
 >
 Connected · {status?.baseUrl}
 </Badge>
 ) : (
 <Badge
 size="md"
 color="orange"
 variant="light"
 leftSection={<IconAlertTriangle size={13} />}
 >
 Not configured
 </Badge>
 )}
 {saved?.source === 'database' && (
 <Badge size="sm" color="blue" variant="outline">Saved in database</Badge>
 )}
 {saved?.source === 'config-file' && (
 <Badge size="sm" color="gray" variant="outline">From config file (fallback)</Badge>
 )}
 </Group>

 <Alert
 icon={<IconInfoCircle size={14} />}
 color="blue"
 variant="light"
 mb="lg"
 >
 Credentials saved here take priority over{' '}
 <code>application-local.yml</code>. If both are configured, the
 database values are used. Leave the API Token field unchanged (showing{' '}
 <code>••••••••</code>) to keep the existing token.
 <br /><br />
 To generate a Jira API token:{' '}
 <Anchor
 href="https://id.atlassian.com/manage-profile/security/api-tokens"
 target="_blank"
 size="sm"
 style={{ color: AQUA }}
 >
 id.atlassian.com → Security → API tokens
 <IconLink size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
 </Anchor>
 </Alert>

 <Paper withBorder p="lg" radius="md">
 <Stack gap="md">
 <TextInput
 label="Jira Base URL"
 description="Your Jira Cloud instance URL (no trailing slash)"
 placeholder="https://yourcompany.atlassian.net"
 value={baseUrl}
 onChange={e => handleChange('baseUrl', e.currentTarget.value)}
 leftSection={<IconLink size={15} />}
 styles={{ input: { fontFamily: FONT_FAMILY } }}
 />

 <TextInput
 label="Email"
 description="The email address associated with your Jira account"
 placeholder="you@yourcompany.com"
 value={email}
 onChange={e => handleChange('email', e.currentTarget.value)}
 styles={{ input: { fontFamily: FONT_FAMILY } }}
 />

 <PasswordInput
 label="API Token"
 description={
 saved?.hasToken
 ? 'A token is already saved — type a new value to replace it, or leave as-is'
 : 'Paste your Jira API token here'
 }
 placeholder={saved?.hasToken ? '(unchanged)' : 'Paste API token…'}
 value={apiToken}
 onChange={e => handleChange('apiToken', e.currentTarget.value)}
 styles={{ input: { fontFamily: FONT_FAMILY } }}
 />

 <Divider />

 <Group justify="space-between">
 <Group gap="xs">
 <Button
 variant="light"
 size="sm"
 leftSection={<IconRefresh size={14} />}
 loading={testing}
 disabled={!isConfigured}
 onClick={handleTestConnection}
 >
 Test Connection
 </Button>
 <Button
 variant="subtle"
 size="sm"
 color="orange"
 leftSection={<IconRefresh size={14} />}
 loading={clearCache.isPending}
 onClick={() => clearCache.mutate(undefined, {
 onSuccess: () => notifications.show({
 title: 'Cache cleared',
 message: 'All Jira caches cleared. Next load fetches live data.',
 color: 'teal',
 }),
 })}
 >
 Clear Jira Cache
 </Button>
 </Group>
 <Button
 size="sm"
 leftSection={<IconDeviceFloppy size={15} />}
 disabled={!dirty}
 loading={save.isPending}
 style={{ backgroundColor: DEEP_BLUE }}
 onClick={handleSave}
 >
 Save Credentials
 </Button>
 </Group>
 </Stack>
 </Paper>

 {/* ── CapEx / OpEx Field Setting ── */}
 <CapexFieldSection />

 {!isConfigured && (
 <Alert
 icon={<IconAlertTriangle size={14} />}
 color="orange"
 variant="light"
 mt="md"
 title="Still not configured?"
 >
 If you've already saved credentials above but the status still shows "Not configured",
 try clearing the browser cache or refreshing the page. Alternatively,{' '}
 add credentials to{' '}
 <code>backend/src/main/resources/application-local.yml</code> as a fallback:
 <pre style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
{`jira:
 base-url: https://yourcompany.atlassian.net
 email: you@yourcompany.com
 api-token: your-api-token`}
 </pre>
 </Alert>
 )}
 </Box>
 );
}
