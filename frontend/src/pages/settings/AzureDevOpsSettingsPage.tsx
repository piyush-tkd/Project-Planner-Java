import { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Group, Paper, TextInput, PasswordInput,
  Button, Badge, ThemeIcon, Alert, Divider, Anchor, Box,
  TagsInput, Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrandAzure, IconDeviceFloppy, IconCircleCheck,
  IconAlertTriangle, IconRefresh, IconLink, IconInfoCircle,
} from '@tabler/icons-react';
import {
  useAdoSettings, useSaveAdoSettings, useAdoStatus, useAdoTestConnection,
} from '../../api/azureDevOps';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';

export default function AzureDevOpsSettingsPage() {
  const { data: settings, isLoading } = useAdoSettings();
  const { data: status }              = useAdoStatus();
  const save                          = useSaveAdoSettings();
  const testConn                      = useAdoTestConnection();

  const [orgUrl,  setOrgUrl]  = useState('');
  const [project, setProject] = useState('');
  const [pat,     setPat]     = useState('');
  const [repos,   setRepos]   = useState<string[]>([]);
  const [dirty,   setDirty]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!settings) return;
    setOrgUrl(settings.orgUrl      ?? '');
    setProject(settings.projectName ?? '');
    setPat('');   // never pre-fill the PAT field — show placeholder only
    setRepos(
      settings.repositories
        ? settings.repositories.split(',').map(r => r.trim()).filter(Boolean)
        : []
    );
    setDirty(false);
  }, [settings]);

  function mark() { setDirty(true); setTestResult(null); }

  async function handleSave() {
    await save.mutateAsync({
      orgUrl,
      projectName:         project,
      personalAccessToken: pat,
      repositories:        repos.join(','),
    });
    notifications.show({ title: 'Saved', message: 'Azure DevOps settings updated.', color: 'teal' });
    setPat('');
    setDirty(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testConn.mutateAsync();
      if (r.ok) {
        setTestResult({ ok: true, msg: `Connected — project: ${r.project}` });
      } else {
        setTestResult({ ok: false, msg: r.error ?? 'Connection failed' });
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setTesting(false);
    }
  }

  if (isLoading) return <Loader size="sm" />;

  const configured = status?.configured ?? settings?.configured ?? false;

  return (
    <Stack gap="lg" className="page-enter">

      {/* ── Header ── */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            Azure DevOps
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            Connect your ADO organisation to enable Git Intelligence — PR metrics, commit frequency, branch health.
          </Text>
        </Box>
        {configured
          ? <Badge color="teal" size="lg" leftSection={<IconCircleCheck size={13} />}>Connected</Badge>
          : <Badge color="orange" size="lg" leftSection={<IconAlertTriangle size={13} />}>Not configured</Badge>
        }
      </Group>

      {/* ── Instructions ── */}
      <Alert icon={<IconInfoCircle size={15} />} color="blue" variant="light" radius="md">
        <Text size="sm">
          Create a{' '}
          <Anchor
            href="https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate"
            target="_blank" rel="noopener noreferrer"
          >
            Personal Access Token
          </Anchor>{' '}
          in Azure DevOps with the following scopes:{' '}
          <strong>Code (read)</strong> and <strong>Pull Request Threads (read)</strong>.
          The token is stored server-side and never sent back to the browser.
        </Text>
      </Alert>

      {/* ── Credentials form ── */}
      <Paper withBorder p="xl" radius="md">
        <Group gap="sm" mb="md">
          <ThemeIcon size={34} radius="md" style={{ background: DEEP_BLUE }}>
            <IconBrandAzure size={18} color="white" />
          </ThemeIcon>
          <Box>
            <Text fw={700} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              Organisation Credentials
            </Text>
            <Text size="xs" c="dimmed">
              Stored securely — token is write-only after first save
            </Text>
          </Box>
        </Group>

        <Divider mb="lg" />

        <Stack gap="md">
          <TextInput
            label="Organisation URL"
            description='The root URL of your ADO organisation, e.g. https://dev.azure.com/myorg'
            placeholder="https://dev.azure.com/your-org"
            value={orgUrl}
            onChange={e => { setOrgUrl(e.currentTarget.value); mark(); }}
            leftSection={<IconLink size={14} />}
          />

          <TextInput
            label="Project name"
            description="The ADO project that contains your repositories"
            placeholder="MyProject"
            value={project}
            onChange={e => { setProject(e.currentTarget.value); mark(); }}
          />

          <PasswordInput
            label="Personal Access Token"
            description={
              configured
                ? 'A token is already saved. Enter a new one only if you want to replace it.'
                : 'Requires Code (read) and Pull Request Threads (read) scopes.'
            }
            placeholder={configured ? '•••••••• (leave blank to keep existing)' : 'Paste your PAT here'}
            value={pat}
            onChange={e => { setPat(e.currentTarget.value); mark(); }}
          />

          <TagsInput
            label="Repositories"
            description="Type a repo name and press Enter to add it. These are the repos the Git Intelligence tab will query."
            placeholder="Add a repository name…"
            value={repos}
            onChange={v => { setRepos(v); mark(); }}
            clearable
          />
        </Stack>

        <Group mt="xl" justify="space-between">
          <Button
            variant="default"
            leftSection={testing ? <Loader size={13} /> : <IconRefresh size={14} />}
            onClick={handleTest}
            disabled={!configured || testing}
            size="sm"
          >
            Test connection
          </Button>

          <Button
            leftSection={<IconDeviceFloppy size={14} />}
            onClick={handleSave}
            disabled={!dirty || save.isPending}
            loading={save.isPending}
            style={{ background: AQUA }}
            size="sm"
          >
            Save settings
          </Button>
        </Group>

        {testResult && (
          <Alert
            mt="md"
            color={testResult.ok ? 'teal' : 'red'}
            icon={testResult.ok ? <IconCircleCheck size={15} /> : <IconAlertTriangle size={15} />}
            radius="md"
          >
            {testResult.msg}
          </Alert>
        )}
      </Paper>

      {/* ── Configured repos summary ── */}
      {configured && (status?.repos ?? []).length > 0 && (
        <Paper withBorder p="lg" radius="md">
          <Text fw={600} size="sm" mb="sm" style={{ color: DEEP_BLUE }}>
            Configured repositories
          </Text>
          <Group gap="xs">
            {(status?.repos ?? []).map(r => (
              <Badge key={r} variant="light" color="blue" size="sm">{r}</Badge>
            ))}
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
