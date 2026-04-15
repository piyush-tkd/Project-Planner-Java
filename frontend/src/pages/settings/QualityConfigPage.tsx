import { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Paper, Group, MultiSelect, Button, Badge,
  Alert, ThemeIcon, Loader, Divider,
} from '@mantine/core';
import { IconShieldCheck, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { FONT_FAMILY } from '../../brandTokens';

interface ConfigEntry { value: string; description: string; updated_at: string }
interface SchemaEntry  { key: string; label: string; hint: string }
interface Options      { phase_options: string[]; status_options: string[]; issue_type_options: string[] }

function useQualityConfig() {
  return useQuery<Record<string, ConfigEntry>>({
    queryKey: ['quality-config'],
    queryFn:  () => apiClient.get('/jira/quality-config').then(r => r.data),
    staleTime: 30 * 1000,
  });
}
function useSchema() {
  return useQuery<SchemaEntry[]>({
    queryKey: ['quality-config-schema'],
    queryFn:  () => apiClient.get('/jira/quality-config/schema').then(r => r.data),
    staleTime: Infinity,
  });
}
function useOptions() {
  return useQuery<Options>({
    queryKey: ['quality-config-options'],
    queryFn:  () => apiClient.get('/jira/quality-config/options').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

/** Which option list to use for each config key */
const OPTION_SOURCE: Record<string, keyof Options> = {
  escape_phases:        'phase_options',
  in_sprint_phases:     'phase_options',
  invalid_bug_statuses: 'status_options',
  bug_issue_types:      'issue_type_options',
};

/** Badge colour per key */
const BADGE_COLOR: Record<string, string> = {
  escape_phases:        'orange',
  in_sprint_phases:     'teal',
  invalid_bug_statuses: 'red',
  bug_issue_types:      'blue',
};

export default function QualityConfigPage() {
  const qc = useQueryClient();
  const { data: config, isLoading }  = useQualityConfig();
  const { data: schema = [] }        = useSchema();
  const { data: options }            = useOptions();

  // Local state: config key → selected values array
  const [values, setValues] = useState<Record<string, string[]>>({});
  const [dirty,  setDirty]  = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!config) return;
    const init: Record<string, string[]> = {};
    Object.entries(config).forEach(([k, v]) => {
      init[k] = v.value.split(',').map(s => s.trim()).filter(Boolean);
    });
    setValues(init);
    setDirty({});
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiClient.put(`/jira/quality-config/${key}`, { value }).then(r => r.data),
    onSuccess: (_, { key }) => {
      notifications.show({ color: 'green', message: `Saved: ${key.replace(/_/g, ' ')}` });
      setDirty(d => ({ ...d, [key]: false }));
      qc.invalidateQueries({ queryKey: ['quality-config'] });
      qc.invalidateQueries({ queryKey: ['q'] });
    },
    onError: () => notifications.show({ color: 'red', message: 'Save failed' }),
  });

  const handleChange = (key: string, selected: string[]) => {
    setValues(v => ({ ...v, [key]: selected }));
    setDirty(d => ({ ...d, [key]: true }));
  };

  const handleSave = (key: string) => {
    saveMutation.mutate({ key, value: (values[key] ?? []).join(',') });
  };

  // For keys not in OPTION_SOURCE (like phase_defect_field), skip rendering
  const renderableKeys = schema.filter(s => OPTION_SOURCE[s.key]);

  if (isLoading) return <Group justify="center" mt="xl"><Loader /></Group>;

  return (
    <Stack gap="lg" maw={740} mx="auto" py="md">
      <Group gap="xs">
        <ThemeIcon size={36} radius="md" variant="gradient" gradient={{ from: 'violet', to: 'pink', deg: 135 }}>
          <IconShieldCheck size={20} />
        </ThemeIcon>
        <div>
          <Title order={3} style={{ fontFamily: FONT_FAMILY }}>Quality Metrics Config</Title>
          <Text size="xs" c="dimmed">Configure what counts as an escaped bug, invalid status, and which issue types to track</Text>
        </div>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" title="How this works">
        <Text size="sm">
          Bug Escape Rate uses the <b>Phase Defect Found</b> custom field (<code>customfield_13493</code>).
          Bugs tagged with phases like <b>Production</b> or <b>UAT</b> count as escaped.
          Bugs with invalid statuses like <b>NOT A BUG</b> are excluded from all quality metrics.
          Options are loaded from your actual Jira data — trigger a sync if the list looks incomplete.
        </Text>
      </Alert>

      {renderableKeys.map(s => {
        const optionSource = OPTION_SOURCE[s.key];
        const rawOptions   = options?.[optionSource] ?? [];
        const selected     = values[s.key] ?? [];
        const isDirty      = dirty[s.key];
        const badgeColor   = BADGE_COLOR[s.key] ?? 'gray';

        // Merge saved values + available options (in case some saved values aren't in DB yet)
        const allOptions = Array.from(new Set([...rawOptions, ...selected])).sort();
        const data       = allOptions.map(o => ({ value: o, label: o }));

        return (
          <Paper key={s.key} p="md" radius="md" withBorder
            style={{ borderLeft: isDirty ? '3px solid var(--mantine-color-orange-5)' : undefined }}>
            <Group justify="space-between" mb="xs">
              <div>
                <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>{s.label}</Text>
                <Text size="xs" c="dimmed">{s.hint}</Text>
              </div>
              {config?.[s.key]?.updated_at && (
                <Text size="10px" c="dimmed">
                  Updated: {String(config[s.key].updated_at).slice(0, 10)}
                </Text>
              )}
            </Group>

            <MultiSelect
              data={data}
              value={selected}
              onChange={v => handleChange(s.key, v)}
              placeholder={`Select ${s.label.toLowerCase()}…`}
              searchable
              clearable
              size="sm"
              mb="sm"
              renderOption={({ option }) => (
                <Badge size="sm" color={badgeColor} variant="light">{option.label}</Badge>
              )}
            />

            <Group justify="flex-end">
              <Button
                size="xs"
                leftSection={<IconCheck size={13} />}
                disabled={!isDirty}
                loading={saveMutation.isPending && dirty[s.key]}
                onClick={() => handleSave(s.key)}
              >
                Save
              </Button>
            </Group>
          </Paper>
        );
      })}

      <Divider />
      <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-dark-7)">
        <Text size="xs" c="dimmed">
          <b>Tip:</b> Options are pulled from your synced Jira data. If <code>Phase Defect Found</code> values are missing,
          run a full Jira sync — the field (<code>customfield_13493</code>) is now included in every issue sync.
          Statuses and issue types update automatically after each sync.
        </Text>
      </Paper>
    </Stack>
  );
}
