import { useState, useEffect, useCallback } from 'react';
import {
  Title, Text, Paper, Group, Stack, Badge, Button, PasswordInput,
  Select, TextInput, Alert, ThemeIcon, Divider, Loader, Box,
  Tabs, NumberInput, Switch, ActionIcon, Tooltip, SimpleGrid,
} from '@mantine/core';
import {
  IconBrain, IconBuilding, IconUser, IconAlertCircle, IconCheck,
  IconTrash, IconCloud, IconLock, IconServer, IconRobot,
  IconArrowUp, IconArrowDown, IconPlus, IconX, IconRefresh,
  IconSettings, IconCircleCheck, IconCircleX, IconLoader2,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useUserAiConfig, useAiStatus, useSaveUserAiConfig, useDeleteUserAiConfig,
} from '../../api/userAiConfig';
import {
  useNlpConfig, useUpdateNlpConfig, useNlpHealth,
  NlpConfigRequest,
} from '../../api/nlp';
import apiClient from '../../api/client';
import { FONT_FAMILY } from '../../brandTokens';

const CLOUD_PROVIDERS = [
  { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
  { value: 'OPENAI',    label: 'OpenAI (GPT)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  ANTHROPIC: 'claude-haiku-4-5-20251001',
  OPENAI:    'gpt-4o-mini',
};

const STRATEGY_OPTIONS = [
  { value: 'DETERMINISTIC', label: 'Deterministic',      icon: <IconRobot  size={15} />, desc: 'Instant keyword matching — fastest, no AI needed',          color: 'teal'   },
  { value: 'LOCAL_LLM',     label: 'Local LLM (Ollama)', icon: <IconServer size={15} />, desc: 'Local model via Ollama — private, no cloud cost',           color: 'violet' },
  { value: 'RULE_BASED',    label: 'Rule-Based',         icon: <IconRobot  size={15} />, desc: 'Regex + pattern rules — reliable fallback',                 color: 'blue'   },
  { value: 'CLOUD_LLM',     label: 'Cloud LLM',          icon: <IconCloud  size={15} />, desc: 'Anthropic / OpenAI — most capable, uses your API key',      color: 'orange' },
];

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

function StatusDot({ status }: { status: TestStatus }) {
  if (status === 'idle')    return null;
  if (status === 'testing') return <IconLoader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />;
  if (status === 'ok')      return <IconCircleCheck size={15} color="var(--mantine-color-green-6)" />;
  return <IconCircleX size={15} color="var(--mantine-color-red-6)" />;
}

export default function UserAiSettingsPage() {
  // ── Cloud key ─────────────────────────────────────────────────────────────
  const { data: config, isLoading: configLoading } = useUserAiConfig();
  const { data: status, isLoading: statusLoading } = useAiStatus();
  const saveConfig   = useSaveUserAiConfig();
  const deleteConfig = useDeleteUserAiConfig();

  const [provider, setProvider]   = useState('ANTHROPIC');
  const [model, setModel]         = useState('claude-haiku-4-5-20251001');
  const [apiKey, setApiKey]       = useState('');
  const [keyDirty, setKeyDirty]   = useState(false);
  const [keyStatus, setKeyStatus] = useState<TestStatus>('idle');

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider ?? 'ANTHROPIC');
    setModel(config.model ?? DEFAULT_MODELS['ANTHROPIC']);
  }, [config]);

  // ── NLP engine ───────────────────────────────────────────────────────────
  const { data: nlpConfig, isLoading: nlpLoading, refetch: refetchNlp } = useNlpConfig();
  const updateNlp = useUpdateNlpConfig();
  const { data: nlpHealth, refetch: refetchHealth } = useNlpHealth();

  const [chain, setChain]                     = useState<string[]>(['DETERMINISTIC', 'LOCAL_LLM', 'RULE_BASED']);
  const [threshold, setThreshold]             = useState(0.75);
  const [localModel, setLocalModel]           = useState('qwen2.5:7b');
  const [localModelUrl, setLocalModelUrl]     = useState('http://localhost:11434');
  const [localTimeoutMs, setLocalTimeoutMs]   = useState(30000);
  const [cacheEnabled, setCacheEnabled]       = useState(true);
  const [logQueries, setLogQueries]           = useState(true);
  const [nlpDirty, setNlpDirty]               = useState(false);
  const [ollamaStatus, setOllamaStatus]       = useState<TestStatus>('idle');

  useEffect(() => {
    if (!nlpConfig) return;
    setChain(nlpConfig.strategyChain ?? ['DETERMINISTIC', 'LOCAL_LLM', 'RULE_BASED']);
    setThreshold(nlpConfig.confidenceThreshold ?? 0.75);
    setLocalModel(nlpConfig.localModel ?? 'qwen2.5:7b');
    setLocalModelUrl(nlpConfig.localModelUrl ?? 'http://localhost:11434');
    setLocalTimeoutMs(nlpConfig.localTimeoutMs ?? 30000);
    setCacheEnabled(nlpConfig.cacheEnabled ?? true);
    setLogQueries(nlpConfig.logQueries ?? true);
    setNlpDirty(false);
  }, [nlpConfig]);

  // ── Inline test: Cloud API key ────────────────────────────────────────────
  const testCloudKey = useCallback(async (key: string, prov: string, mdl: string) => {
    if (!key) return;
    setKeyStatus('testing');
    try {
      await apiClient.post('/user/ai-config/test', { provider: prov, model: mdl, apiKey: key });
      setKeyStatus('ok');
    } catch {
      setKeyStatus('fail');
    }
  }, []);

  // ── Inline test: Ollama ───────────────────────────────────────────────────
  const testOllama = useCallback(async (url: string, mdl: string) => {
    setOllamaStatus('testing');
    try {
      await apiClient.post('/nlp/test-ollama', { url, model: mdl });
      setOllamaStatus('ok');
    } catch {
      // fall back to health check if dedicated endpoint not available
      try {
        const health = await apiClient.get('/nlp/health').then(r => r.data);
        setOllamaStatus(health.ollama ? 'ok' : 'fail');
        refetchHealth();
      } catch {
        setOllamaStatus('fail');
      }
    }
  }, [refetchHealth]);

  // ── Cloud key handlers ────────────────────────────────────────────────────
  const handleProviderChange = (val: string | null) => {
    const p = val ?? 'ANTHROPIC';
    setProvider(p);
    setModel(DEFAULT_MODELS[p] ?? '');
    setKeyDirty(true);
    setKeyStatus('idle');
  };

  const handleSaveKey = () => {
    if (!apiKey && !config?.apiKeySet) {
      notifications.show({ title: 'API key required', message: 'Please enter your API key.', color: 'orange' });
      return;
    }
    saveConfig.mutate({ provider, model, apiKey: apiKey || undefined }, {
      onSuccess: () => {
        notifications.show({ title: 'Saved', message: 'AI key saved.', color: 'green' });
        setApiKey('');
        setKeyDirty(false);
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to save AI config.', color: 'red' }),
    });
  };

  const handleDeleteKey = () => {
    deleteConfig.mutate(undefined, {
      onSuccess: () => {
        notifications.show({ title: 'Removed', message: 'Personal AI key removed.', color: 'blue' });
        setApiKey('');
        setKeyDirty(false);
        setKeyStatus('idle');
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to remove AI key.', color: 'red' }),
    });
  };

  // ── NLP engine handlers ───────────────────────────────────────────────────
  const addStrategy = (val: string | null) => {
    if (!val || chain.includes(val)) return;
    setChain(prev => [...prev, val]);
    setNlpDirty(true);
  };

  const removeStrategy = (val: string) => {
    setChain(prev => prev.filter(s => s !== val));
    setNlpDirty(true);
  };

  const moveStrategy = (idx: number, dir: -1 | 1) => {
    const next = [...chain];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setChain(next);
    setNlpDirty(true);
  };

  const handleSaveNlp = () => {
    const req: NlpConfigRequest = {
      strategyChain: chain,
      confidenceThreshold: threshold,
      localModel,
      localModelUrl,
      localTimeoutMs,
      cacheEnabled,
      logQueries,
      cloudProvider: nlpConfig?.cloudProvider,
      cloudModel: nlpConfig?.cloudModel,
      maxTimeoutMs: nlpConfig?.maxTimeoutMs,
      cacheTtlMinutes: nlpConfig?.cacheTtlMinutes,
    };
    updateNlp.mutate(req, {
      onSuccess: () => {
        notifications.show({ title: 'Saved', message: 'AI engine config updated.', color: 'green' });
        setNlpDirty(false);
        refetchNlp();
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to save AI engine config.', color: 'red' }),
    });
  };

  if (configLoading || statusLoading || nlpLoading) {
    return <Group justify="center" mt="xl"><Loader size="sm" /></Group>;
  }

  const orgActive  = status?.orgKeyActive ?? false;
  const userKeySet = config?.apiKeySet ?? false;
  const availableToAdd = STRATEGY_OPTIONS.filter(s => !chain.includes(s.value));

  return (
    <Stack gap="lg" maw={720} mx="auto" py="md" className="page-enter stagger-children">

      <Group gap="xs" className="slide-in-left">
        <ThemeIcon size={36} variant="gradient" gradient={{ from: 'violet', to: 'indigo', deg: 135 }} radius="md">
          <IconBrain size={22} />
        </ThemeIcon>
        <div>
          <Title order={3} style={{ fontFamily: FONT_FAMILY }}>AI Settings</Title>
          <Text size="xs" c="dimmed">Configure your AI providers and the Ask AI engine strategy</Text>
        </div>
      </Group>

      <Tabs defaultValue="key" variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="key"    leftSection={<IconCloud size={15} />}>Cloud API Key</Tabs.Tab>
          <Tabs.Tab value="engine" leftSection={<IconSettings size={15} />}>AI Engine</Tabs.Tab>
        </Tabs.List>

        {/* ══ TAB 1: Cloud API Key ══════════════════════════════════════════ */}
        <Tabs.Panel value="key">
          <Stack gap="md">
            <Paper p="md" radius="md" withBorder>
              <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY }}>Active AI Key</Text>
              {orgActive ? (
                <Alert icon={<IconBuilding size={16} />} color="teal" variant="light" title="Org AI key is active">
                  <Text size="sm">Your organisation has configured a shared AI key — all AI features use it automatically.</Text>
                </Alert>
              ) : userKeySet ? (
                <Alert icon={<IconUser size={16} />} color="indigo" variant="light" title="Using your personal AI key">
                  <Text size="sm">
                    AI features are powered by your key{' '}
                    <Badge size="xs" variant="outline" color="indigo">{config?.provider}</Badge>{' '}
                    <Text component="span" ff="monospace" size="xs">{config?.maskedKey}</Text>
                  </Text>
                </Alert>
              ) : (
                <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" title="No AI key configured">
                  <Text size="sm">AI Content Studio, insights, and cloud AI features are unavailable. Add a key below.</Text>
                </Alert>
              )}
            </Paper>

            <Paper p="md" radius="md" withBorder>
              <Group gap="xs" mb="sm">
                <IconCloud size={18} />
                <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Personal AI Key</Text>
                {orgActive && <Badge size="xs" color="gray" variant="light" leftSection={<IconLock size={10} />}>Not used (org key active)</Badge>}
              </Group>
              <Stack gap="sm">
                <Select label="Provider" data={CLOUD_PROVIDERS} value={provider} onChange={handleProviderChange} size="sm" />
                <TextInput
                  label="Model"
                  value={model}
                  onChange={(e) => { setModel(e.currentTarget.value); setKeyDirty(true); setKeyStatus('idle'); }}
                  placeholder={DEFAULT_MODELS[provider]}
                  size="sm"
                />
                <PasswordInput
                  label="API Key"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.currentTarget.value); setKeyDirty(true); setKeyStatus('idle'); }}
                  onBlur={() => { if (apiKey) testCloudKey(apiKey, provider, model); }}
                  placeholder={userKeySet ? `Current: ${config?.maskedKey} — enter new key to replace` : 'Enter your API key'}
                  size="sm"
                  rightSection={<StatusDot status={keyStatus} />}
                  description={
                    keyStatus === 'ok'   ? '✓ Key is valid and reachable' :
                    keyStatus === 'fail' ? '✗ Key invalid or provider unreachable' :
                    keyStatus === 'testing' ? 'Testing…' :
                    'Leave the field to test automatically'
                  }
                />
                <Divider />
                <Group justify="space-between">
                  <Group gap="xs">
                    <Button leftSection={<IconCheck size={15} />} onClick={handleSaveKey} loading={saveConfig.isPending} disabled={!keyDirty && !apiKey} size="sm">Save Key</Button>
                    {userKeySet && (
                      <Button variant="subtle" color="red" leftSection={<IconTrash size={15} />} onClick={handleDeleteKey} loading={deleteConfig.isPending} size="sm">Remove Key</Button>
                    )}
                  </Group>
                  <Box>
                    {provider === 'ANTHROPIC' && (
                      <Text size="xs" c="dimmed">Get key at <Text component="a" href="https://console.anthropic.com" target="_blank" size="xs" c="blue" td="underline">console.anthropic.com</Text></Text>
                    )}
                    {provider === 'OPENAI' && (
                      <Text size="xs" c="dimmed">Get key at <Text component="a" href="https://platform.openai.com/api-keys" target="_blank" size="xs" c="blue" td="underline">platform.openai.com</Text></Text>
                    )}
                  </Box>
                </Group>
              </Stack>
            </Paper>

            <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-dark-7)">
              <Text size="xs" c="dimmed">Your key is stored securely and never visible to other users. The org key always takes priority.</Text>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* ══ TAB 2: AI Engine ═════════════════════════════════════════════ */}
        <Tabs.Panel value="engine">
          <Stack gap="md">

            {/* Strategy chain */}
            <Paper p="md" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <div>
                  <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Strategy Chain</Text>
                  <Text size="xs" c="dimmed">Ask AI tries strategies in order. First to exceed the confidence threshold wins.</Text>
                </div>
                <Tooltip label="Reload from server">
                  <ActionIcon variant="subtle" onClick={() => refetchNlp()} size="sm"><IconRefresh size={14} /></ActionIcon>
                </Tooltip>
              </Group>
              <Stack gap="xs">
                {chain.map((s, idx) => {
                  const opt = STRATEGY_OPTIONS.find(o => o.value === s);
                  const stratStatus = nlpHealth?.strategyAvailability?.[s];
                  return (
                    <Paper key={s} p="sm" radius="md" withBorder style={{ borderLeft: `3px solid var(--mantine-color-${opt?.color ?? 'gray'}-5)` }}>
                      <Group justify="space-between">
                        <Group gap="xs">
                          <Text size="xs" fw={700} style={{ fontFamily: 'monospace', minWidth: 22, textAlign: 'center' }} c="dimmed">{idx + 1}</Text>
                          {opt?.icon}
                          <div>
                            <Group gap={4}>
                              <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{opt?.label ?? s}</Text>
                              {idx === 0 && <Badge size="xs" color="teal" variant="light">Primary</Badge>}
                              {idx === chain.length - 1 && chain.length > 1 && <Badge size="xs" color="gray" variant="light">Fallback</Badge>}
                            </Group>
                            <Text size="xs" c="dimmed">{opt?.desc}</Text>
                          </div>
                        </Group>
                        <Group gap={4}>
                          {stratStatus !== undefined && (
                            <Badge size="xs" color={stratStatus ? 'green' : 'red'} variant="light">
                              {stratStatus ? '● Online' : '● Offline'}
                            </Badge>
                          )}
                          <ActionIcon size="xs" variant="subtle" onClick={() => moveStrategy(idx, -1)} disabled={idx === 0}><IconArrowUp size={12} /></ActionIcon>
                          <ActionIcon size="xs" variant="subtle" onClick={() => moveStrategy(idx, 1)} disabled={idx === chain.length - 1}><IconArrowDown size={12} /></ActionIcon>
                          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeStrategy(s)}><IconX size={12} /></ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
                {availableToAdd.length > 0 && (
                  <Select
                    placeholder="＋ Add strategy…"
                    data={availableToAdd.map(s => ({ value: s.value, label: s.label }))}
                    value={null}
                    onChange={addStrategy}
                    size="xs"
                    leftSection={<IconPlus size={13} />}
                    clearable={false}
                  />
                )}
              </Stack>
            </Paper>

            {/* Confidence threshold */}
            <Paper p="md" radius="md" withBorder>
              <Text fw={600} size="sm" mb={4} style={{ fontFamily: FONT_FAMILY }}>Confidence Threshold</Text>
              <Text size="xs" c="dimmed" mb="sm">Minimum score (0–1) before accepting a result. Lower = more permissive.</Text>
              <NumberInput
                value={threshold}
                onChange={(val) => { setThreshold(Number(val)); setNlpDirty(true); }}
                min={0.3} max={0.99} step={0.05} decimalScale={2}
                size="sm" style={{ maxWidth: 140 }}
              />
            </Paper>

            {/* Ollama config — only when LOCAL_LLM in chain */}
            {chain.includes('LOCAL_LLM') && (
              <Paper p="md" radius="md" withBorder style={{ borderLeft: `3px solid var(--mantine-color-violet-5)` }}>
                <Group gap="xs" mb="sm">
                  <IconServer size={16} />
                  <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Local LLM (Ollama)</Text>
                  <StatusDot status={ollamaStatus} />
                  {ollamaStatus === 'ok'   && <Text size="xs" c="green">Connected</Text>}
                  {ollamaStatus === 'fail' && <Text size="xs" c="red">Unreachable — check Ollama is running</Text>}
                </Group>
                <SimpleGrid cols={2} spacing="sm">
                  <TextInput
                    label="Ollama URL"
                    value={localModelUrl}
                    onChange={(e) => { setLocalModelUrl(e.currentTarget.value); setNlpDirty(true); setOllamaStatus('idle'); }}
                    onBlur={() => testOllama(localModelUrl, localModel)}
                    size="sm"
                    placeholder="http://localhost:11434"
                    description="Leave field to test"
                  />
                  <TextInput
                    label="Model name"
                    value={localModel}
                    onChange={(e) => { setLocalModel(e.currentTarget.value); setNlpDirty(true); setOllamaStatus('idle'); }}
                    onBlur={() => testOllama(localModelUrl, localModel)}
                    size="sm"
                    placeholder="qwen2.5:7b"
                    description="Must be pulled via `ollama pull`"
                  />
                </SimpleGrid>
                <NumberInput
                  label="Timeout (ms)"
                  value={localTimeoutMs}
                  onChange={(val) => { setLocalTimeoutMs(Number(val)); setNlpDirty(true); }}
                  min={5000} max={120000} step={5000}
                  size="sm" mt="sm" style={{ maxWidth: 180 }}
                  description="How long to wait before falling back"
                />
              </Paper>
            )}

            {/* Cache + logging */}
            <Paper p="md" radius="md" withBorder>
              <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY }}>Performance & Logging</Text>
              <Stack gap="xs">
                <Switch label="Enable query cache" description="Cache identical queries to avoid repeat LLM calls" checked={cacheEnabled} onChange={(e) => { setCacheEnabled(e.currentTarget.checked); setNlpDirty(true); }} size="sm" />
                <Switch label="Log all queries" description="Store query history for the NLP Optimizer" checked={logQueries} onChange={(e) => { setLogQueries(e.currentTarget.checked); setNlpDirty(true); }} size="sm" />
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button leftSection={<IconCheck size={15} />} onClick={handleSaveNlp} loading={updateNlp.isPending} disabled={!nlpDirty}>
                Save Engine Config
              </Button>
            </Group>

          </Stack>
        </Tabs.Panel>
      </Tabs>

    </Stack>
  );
}
