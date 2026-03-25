import { useState, useEffect } from 'react';
import {
 Title, Text, Paper, Group, Stack, Badge, Button, TextInput,
 NumberInput, Switch, Select, Divider, Alert, Loader, SimpleGrid,
 ThemeIcon, ActionIcon, Tooltip, PasswordInput, rem,
} from '@mantine/core';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
 IconBrain, IconRefresh, IconCheck, IconX, IconAlertCircle,
 IconGripVertical, IconPlus, IconTrash, IconTestPipe, IconSettings,
 IconCloud, IconServer, IconRobot,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
 useNlpConfig, useUpdateNlpConfig, useTestNlpConnection,
 NlpConfigResponse, NlpConfigRequest,
} from '../../api/nlp';
import { FONT_FAMILY } from '../../brandTokens';

// ── Constants ────────────────────────────────────────────────────────────────

const STRATEGY_OPTIONS = [
 { value: 'RULE_BASED', label: 'Rule-Based', icon: <IconRobot size={16} />, desc: 'Fast regex pattern matching, no external dependencies' },
 { value: 'LOCAL_LLM', label: 'Local LLM (Ollama)', icon: <IconServer size={16} />, desc: 'Local model via Ollama — requires local setup' },
 { value: 'CLOUD_LLM', label: 'Cloud LLM', icon: <IconCloud size={16} />, desc: 'Cloud AI provider (Anthropic / OpenAI) — requires API key' },
];

const CLOUD_PROVIDERS = [
 { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
 { value: 'OPENAI', label: 'OpenAI (GPT)' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function NlpSettingsPage() {
 const { data: config, isLoading, refetch } = useNlpConfig();
 const updateConfig = useUpdateNlpConfig();
 const testConnection = useTestNlpConnection();

 // Local form state — populated from server config
 const [chain, setChain] = useState<string[]>(['RULE_BASED']);
 const [threshold, setThreshold] = useState(0.75);
 const [cloudProvider, setCloudProvider] = useState('ANTHROPIC');
 const [cloudModel, setCloudModel] = useState('claude-haiku-4-5-20251001');
 const [cloudApiKey, setCloudApiKey] = useState('');
 const [localModelUrl, setLocalModelUrl] = useState('http://localhost:11434');
 const [localModel, setLocalModel] = useState('llama3:8b');
 const [localTimeoutMs, setLocalTimeoutMs] = useState(10000);
 const [cacheEnabled, setCacheEnabled] = useState(true);
 const [cacheTtlMinutes, setCacheTtlMinutes] = useState(5);
 const [logQueries, setLogQueries] = useState(true);
 const [maxTimeoutMs, setMaxTimeoutMs] = useState(5000);
 const [dirty, setDirty] = useState(false);

 // Sync local state when config loads
 useEffect(() => {
 if (!config) return;
 setChain(config.strategyChain);
 setThreshold(config.confidenceThreshold);
 setCloudProvider(config.cloudProvider);
 setCloudModel(config.cloudModel);
 setLocalModelUrl(config.localModelUrl);
 setLocalModel(config.localModel);
 setLocalTimeoutMs(config.localTimeoutMs);
 setCacheEnabled(config.cacheEnabled);
 setCacheTtlMinutes(config.cacheTtlMinutes);
 setLogQueries(config.logQueries);
 setMaxTimeoutMs(config.maxTimeoutMs);
 setDirty(false);
 }, [config]);

 const markDirty = () => setDirty(true);

 const handleSave = () => {
 const req: NlpConfigRequest = {
 strategyChain: chain,
 confidenceThreshold: threshold,
 cloudProvider,
 cloudModel,
 cloudApiKey: cloudApiKey || undefined,
 localModelUrl,
 localModel,
 localTimeoutMs,
 cacheEnabled,
 cacheTtlMinutes,
 logQueries,
 maxTimeoutMs,
 };
 updateConfig.mutate(req, {
 onSuccess: (res) => {
 notifications.show({ title: 'Saved', message: 'NLP configuration updated.', color: 'green' });
 setDirty(false);
 refetch();
 },
 onError: () => {
 notifications.show({ title: 'Error', message: 'Failed to save NLP configuration.', color: 'red' });
 },
 });
 };

 const handleTestConnection = () => {
 testConnection.mutate(undefined, {
 onSuccess: (res) => {
 refetch();
 notifications.show({ title: 'Test complete', message: 'Strategy statuses refreshed.', color: 'blue' });
 },
 });
 };

 const addStrategy = (value: string) => {
 if (!chain.includes(value)) {
 setChain([...chain, value]);
 markDirty();
 }
 };

 const removeStrategy = (idx: number) => {
 setChain(chain.filter((_, i) => i !== idx));
 markDirty();
 };

 const moveStrategy = (idx: number, direction: 'up' | 'down') => {
 const newChain = [...chain];
 const target = direction === 'up' ? idx - 1 : idx + 1;
 if (target < 0 || target >= newChain.length) return;
 [newChain[idx], newChain[target]] = [newChain[target], newChain[idx]];
 setChain(newChain);
 markDirty();
 };

 if (isLoading) {
 return <LoadingSpinner variant="form" message="Loading NLP configuration..." />;
 }

 const statuses = config?.strategyStatuses ?? {};
 const availableToAdd = STRATEGY_OPTIONS.filter(s => !chain.includes(s.value));

 return (
 <Stack gap="lg" maw={800} mx="auto" py="md" className="page-enter stagger-children">
 {/* ── Header ── */}
 <Group justify="space-between" className="slide-in-left">
 <Group gap="xs">
 <ThemeIcon size={36} variant="gradient" gradient={{ from: 'teal', to: 'blue', deg: 135 }} radius="md">
 <IconBrain size={22} />
 </ThemeIcon>
 <div>
 <Title order={3} style={{ fontFamily: FONT_FAMILY }}>NLP Settings</Title>
 <Text size="xs" c="dimmed">Configure the strategy chain, LLM providers, and caching</Text>
 </div>
 </Group>
 <Group gap="xs">
 <Button
 variant="light"
 leftSection={<IconTestPipe size={16} />}
 onClick={handleTestConnection}
 loading={testConnection.isPending}
 size="sm"
 >
 Test Connections
 </Button>
 <Button
 leftSection={<IconCheck size={16} />}
 onClick={handleSave}
 loading={updateConfig.isPending}
 disabled={!dirty}
 size="sm"
 >
 Save Changes
 </Button>
 </Group>
 </Group>

 {/* ── Strategy Chain ── */}
 <Paper p="md" radius="md" withBorder>
 <Group justify="space-between" mb="sm">
 <div>
 <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Strategy Chain</Text>
 <Text size="xs" c="dimmed">
 Strategies are tried in order. The first to return confidence ≥ threshold wins.
 </Text>
 </div>
 {availableToAdd.length > 0 && (
 <Select
 placeholder="Add strategy…"
 data={availableToAdd.map(s => ({ value: s.value, label: s.label }))}
 onChange={(val) => val && addStrategy(val)}
 size="xs"
 w={180}
 clearable={false}
 />
 )}
 </Group>

 <Stack gap="xs">
 {chain.map((stratKey, idx) => {
 const info = STRATEGY_OPTIONS.find(s => s.value === stratKey);
 const status = statuses[stratKey];
 return (
 <Paper key={stratKey} p="sm" radius="sm" withBorder style={{ backgroundColor: 'var(--mantine-color-body)' }}>
 <Group justify="space-between" wrap="nowrap">
 <Group gap="sm" wrap="nowrap">
 <Group gap={2}>
 <ActionIcon size="xs" variant="subtle" onClick={() => moveStrategy(idx, 'up')} disabled={idx === 0}>
 <Text size="xs">↑</Text>
 </ActionIcon>
 <ActionIcon size="xs" variant="subtle" onClick={() => moveStrategy(idx, 'down')} disabled={idx === chain.length - 1}>
 <Text size="xs">↓</Text>
 </ActionIcon>
 </Group>
 <Badge size="sm" variant="light" color="gray" circle>{idx + 1}</Badge>
 <ThemeIcon size={24} variant="light" color="teal" radius="sm">
 {info?.icon ?? <IconSettings size={14} />}
 </ThemeIcon>
 <div>
 <Text size="sm" fw={500}>{info?.label ?? stratKey}</Text>
 <Text size="xs" c="dimmed">{info?.desc ?? ''}</Text>
 </div>
 </Group>
 <Group gap="xs">
 {status && (
 <Badge
 size="sm"
 color={status.available ? 'green' : 'red'}
 variant="light"
 leftSection={status.available ? <IconCheck size={10} /> : <IconX size={10} />}
 >
 {status.message ?? (status.available ? 'Connected' : 'Unavailable')}
 </Badge>
 )}
 <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeStrategy(idx)} disabled={chain.length <= 1}>
 <IconTrash size={14} />
 </ActionIcon>
 </Group>
 </Group>
 </Paper>
 );
 })}
 </Stack>

 <Group mt="sm">
 <NumberInput
 label="Confidence threshold"
 description="Minimum confidence to accept a strategy result"
 value={threshold}
 onChange={(v) => { setThreshold(Number(v) || 0.75); markDirty(); }}
 min={0.1} max={1.0} step={0.05} decimalScale={2}
 size="xs" w={200}
 />
 </Group>
 </Paper>

 {/* ── Local LLM Settings ── */}
 {chain.includes('LOCAL_LLM') && (
 <Paper p="md" radius="md" withBorder>
 <Group gap="xs" mb="sm">
 <IconServer size={18} />
 <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Local LLM (Ollama)</Text>
 </Group>
 <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
 <TextInput
 label="Ollama URL"
 value={localModelUrl}
 onChange={(e) => { setLocalModelUrl(e.currentTarget.value); markDirty(); }}
 size="xs"
 />
 <TextInput
 label="Model name"
 value={localModel}
 onChange={(e) => { setLocalModel(e.currentTarget.value); markDirty(); }}
 placeholder="llama3:8b"
 size="xs"
 />
 <NumberInput
 label="Timeout (ms)"
 value={localTimeoutMs}
 onChange={(v) => { setLocalTimeoutMs(Number(v) || 10000); markDirty(); }}
 min={1000} max={60000} step={1000}
 size="xs"
 />
 </SimpleGrid>
 <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" mt="sm" p="xs">
 <Text size="xs">
 Install Ollama from <b>ollama.com</b>, then run <code>ollama pull {localModel}</code> to download the model.
 </Text>
 </Alert>
 </Paper>
 )}

 {/* ── Cloud LLM Settings ── */}
 {chain.includes('CLOUD_LLM') && (
 <Paper p="md" radius="md" withBorder>
 <Group gap="xs" mb="sm">
 <IconCloud size={18} />
 <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Cloud LLM</Text>
 </Group>
 <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
 <Select
 label="Provider"
 data={CLOUD_PROVIDERS}
 value={cloudProvider}
 onChange={(v) => { setCloudProvider(v ?? 'ANTHROPIC'); markDirty(); }}
 size="xs"
 />
 <TextInput
 label="Model"
 value={cloudModel}
 onChange={(e) => { setCloudModel(e.currentTarget.value); markDirty(); }}
 size="xs"
 />
 <PasswordInput
 label="API Key"
 value={cloudApiKey}
 onChange={(e) => { setCloudApiKey(e.currentTarget.value); markDirty(); }}
 placeholder={config?.cloudApiKeySet ? '•••••••• (key is set)' : 'Enter API key'}
 size="xs"
 />
 <NumberInput
 label="Max timeout (ms)"
 value={maxTimeoutMs}
 onChange={(v) => { setMaxTimeoutMs(Number(v) || 5000); markDirty(); }}
 min={1000} max={30000} step={1000}
 size="xs"
 />
 </SimpleGrid>
 </Paper>
 )}

 {/* ── Cache & Logging ── */}
 <Paper p="md" radius="md" withBorder>
 <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY }}>Cache & Logging</Text>
 <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
 <Switch
 label="Enable response cache"
 description="Cache NLP responses to avoid re-processing identical queries"
 checked={cacheEnabled}
 onChange={(e) => { setCacheEnabled(e.currentTarget.checked); markDirty(); }}
 />
 <NumberInput
 label="Cache TTL (minutes)"
 value={cacheTtlMinutes}
 onChange={(v) => { setCacheTtlMinutes(Number(v) || 5); markDirty(); }}
 min={1} max={60} step={1}
 size="xs"
 disabled={!cacheEnabled}
 />
 <Switch
 label="Log queries"
 description="Store NLP query history for analytics"
 checked={logQueries}
 onChange={(e) => { setLogQueries(e.currentTarget.checked); markDirty(); }}
 />
 </SimpleGrid>
 </Paper>
 </Stack>
 );
}
