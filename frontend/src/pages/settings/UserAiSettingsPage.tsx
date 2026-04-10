import { useState, useEffect } from 'react';
import {
  Title, Text, Paper, Group, Stack, Badge, Button, PasswordInput,
  Select, TextInput, Alert, ThemeIcon, Divider, Loader, Box,
} from '@mantine/core';
import {
  IconBrain, IconBuilding, IconUser, IconAlertCircle, IconCheck,
  IconTrash, IconCloud, IconLock,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useUserAiConfig, useAiStatus, useSaveUserAiConfig, useDeleteUserAiConfig,
} from '../../api/userAiConfig';
import { FONT_FAMILY } from '../../brandTokens';

const CLOUD_PROVIDERS = [
  { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
  { value: 'OPENAI',    label: 'OpenAI (GPT)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  ANTHROPIC: 'claude-haiku-4-5-20251001',
  OPENAI:    'gpt-4o-mini',
};

export default function UserAiSettingsPage() {
  const { data: config, isLoading: configLoading } = useUserAiConfig();
  const { data: status, isLoading: statusLoading } = useAiStatus();
  const saveConfig  = useSaveUserAiConfig();
  const deleteConfig = useDeleteUserAiConfig();

  const [provider, setProvider] = useState('ANTHROPIC');
  const [model, setModel]       = useState('claude-haiku-4-5-20251001');
  const [apiKey, setApiKey]     = useState('');
  const [dirty, setDirty]       = useState(false);

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider ?? 'ANTHROPIC');
    setModel(config.model ?? DEFAULT_MODELS['ANTHROPIC']);
  }, [config]);

  const handleProviderChange = (val: string | null) => {
    const p = val ?? 'ANTHROPIC';
    setProvider(p);
    setModel(DEFAULT_MODELS[p] ?? '');
    setDirty(true);
  };

  const handleSave = () => {
    if (!apiKey && !config?.apiKeySet) {
      notifications.show({ title: 'API key required', message: 'Please enter your API key.', color: 'orange' });
      return;
    }
    saveConfig.mutate({ provider, model, apiKey: apiKey || undefined }, {
      onSuccess: () => {
        notifications.show({ title: 'Saved', message: 'Your personal AI key has been saved.', color: 'green' });
        setApiKey('');
        setDirty(false);
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to save AI config.', color: 'red' }),
    });
  };

  const handleDelete = () => {
    deleteConfig.mutate(undefined, {
      onSuccess: () => {
        notifications.show({ title: 'Removed', message: 'Personal AI key removed.', color: 'blue' });
        setApiKey('');
        setDirty(false);
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to remove AI key.', color: 'red' }),
    });
  };

  if (configLoading || statusLoading) {
    return <Group justify="center" mt="xl"><Loader size="sm" /></Group>;
  }

  const orgActive  = status?.orgKeyActive ?? false;
  const userKeySet = config?.apiKeySet ?? false;

  return (
    <Stack gap="lg" maw={680} mx="auto" py="md" className="page-enter stagger-children">

      {/* ── Header ── */}
      <Group gap="xs" className="slide-in-left">
        <ThemeIcon size={36} variant="gradient" gradient={{ from: 'violet', to: 'indigo', deg: 135 }} radius="md">
          <IconBrain size={22} />
        </ThemeIcon>
        <div>
          <Title order={3} style={{ fontFamily: FONT_FAMILY }}>My AI Settings</Title>
          <Text size="xs" c="dimmed">Configure your personal AI provider — used when the org hasn't set a key</Text>
        </div>
      </Group>

      {/* ── Active Key Status ── */}
      <Paper p="md" radius="md" withBorder>
        <Text fw={600} size="sm" mb="sm" style={{ fontFamily: FONT_FAMILY }}>Active AI Key</Text>
        {orgActive ? (
          <Alert
            icon={<IconBuilding size={16} />}
            color="teal"
            variant="light"
            title="Org AI key is active"
          >
            <Text size="sm">
              Your organisation has configured a shared AI key — all AI features in the app use it automatically.
              You don't need a personal key, but you can still configure one (it won't be used while the org key is set).
            </Text>
          </Alert>
        ) : userKeySet ? (
          <Alert
            icon={<IconUser size={16} />}
            color="indigo"
            variant="light"
            title="Using your personal AI key"
          >
            <Text size="sm">
              No org key is configured. AI features are powered by your personal key{' '}
              <Badge size="xs" variant="outline" color="indigo">{config?.provider}</Badge>{' '}
              <Text component="span" ff="monospace" size="xs">{config?.maskedKey}</Text>
            </Text>
          </Alert>
        ) : (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="orange"
            variant="light"
            title="No AI key configured"
          >
            <Text size="sm">
              AI features (AI Content Studio, insights, etc.) are unavailable. Add your personal key below, or ask your admin to configure an org key.
            </Text>
          </Alert>
        )}
      </Paper>

      {/* ── Personal Key Form ── */}
      <Paper p="md" radius="md" withBorder>
        <Group gap="xs" mb="sm">
          <IconCloud size={18} />
          <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>Personal AI Key</Text>
          {orgActive && (
            <Badge size="xs" color="gray" variant="light" leftSection={<IconLock size={10} />}>
              Not used (org key active)
            </Badge>
          )}
        </Group>

        <Stack gap="sm">
          <Select
            label="Provider"
            data={CLOUD_PROVIDERS}
            value={provider}
            onChange={handleProviderChange}
            size="sm"
          />
          <TextInput
            label="Model"
            value={model}
            onChange={(e) => { setModel(e.currentTarget.value); setDirty(true); }}
            placeholder={DEFAULT_MODELS[provider]}
            size="sm"
          />
          <PasswordInput
            label="API Key"
            value={apiKey}
            onChange={(e) => { setApiKey(e.currentTarget.value); setDirty(true); }}
            placeholder={userKeySet ? `Current: ${config?.maskedKey} — enter new key to replace` : 'Enter your API key'}
            size="sm"
          />

          <Divider />

          <Group justify="space-between">
            <Group gap="xs">
              <Button
                leftSection={<IconCheck size={15} />}
                onClick={handleSave}
                loading={saveConfig.isPending}
                disabled={!dirty && !apiKey}
                size="sm"
              >
                Save Key
              </Button>
              {userKeySet && (
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={15} />}
                  onClick={handleDelete}
                  loading={deleteConfig.isPending}
                  size="sm"
                >
                  Remove Key
                </Button>
              )}
            </Group>
            <Box>
              {provider === 'ANTHROPIC' && (
                <Text size="xs" c="dimmed">
                  Get your key at{' '}
                  <Text component="a" href="https://console.anthropic.com" target="_blank" size="xs" c="blue" td="underline">
                    console.anthropic.com
                  </Text>
                </Text>
              )}
              {provider === 'OPENAI' && (
                <Text size="xs" c="dimmed">
                  Get your key at{' '}
                  <Text component="a" href="https://platform.openai.com/api-keys" target="_blank" size="xs" c="blue" td="underline">
                    platform.openai.com
                  </Text>
                </Text>
              )}
            </Box>
          </Group>
        </Stack>
      </Paper>

      {/* ── Info ── */}
      <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-dark-7)">
        <Text size="xs" c="dimmed">
          Your API key is stored securely and is never visible to other users or admins.
          Usage charges apply directly to your provider account.
          The org key always takes priority — if an admin configures one, your personal key is not used.
        </Text>
      </Paper>

    </Stack>
  );
}
