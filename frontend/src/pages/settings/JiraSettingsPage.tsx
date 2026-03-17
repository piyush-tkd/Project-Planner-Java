import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Stack, Text, Group, Button, TextInput, Badge,
  Table, Checkbox, Alert, Loader, ActionIcon, Tooltip,
  Paper, Divider, ThemeIcon, Box, Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTicket, IconRefresh, IconInfoCircle, IconDeviceFloppy,
  IconAlertTriangle, IconExternalLink,
} from '@tabler/icons-react';
import {
  useJiraStatus, useJiraProjects,
  usePodWatchConfig, useSavePodWatchConfig,
  PodWatchRequest,
} from '../../api/jira';

const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';

function initRows(
  config: Array<{ jiraProjectKey: string; podDisplayName: string; enabled: boolean }>,
  jiraProjects: Array<{ key: string; name: string }>,
): PodWatchRequest[] {
  const configKeys = new Set(config.map(c => c.jiraProjectKey));
  const fromConfig: PodWatchRequest[] = config.map(c => ({
    jiraProjectKey: c.jiraProjectKey,
    podDisplayName: c.podDisplayName,
    enabled: c.enabled,
  }));
  const newProjects: PodWatchRequest[] = jiraProjects
    .filter(p => !configKeys.has(p.key))
    .map(p => ({ jiraProjectKey: p.key, podDisplayName: p.name, enabled: false }));
  return [...fromConfig, ...newProjects];
}

export default function JiraSettingsPage() {
  const navigate = useNavigate();

  const { data: status, isLoading: statusLoading } = useJiraStatus();
  const { data: jiraProjects = [], isLoading: projectsLoading, refetch: refetchProjects } = useJiraProjects();
  const { data: watchConfig = [], isLoading: configLoading } = usePodWatchConfig();
  const save = useSavePodWatchConfig();

  const baseRows = useMemo(
    () => initRows(watchConfig, jiraProjects),
    [watchConfig, jiraProjects],
  );
  const [rows, setRows] = useState<PodWatchRequest[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync rows from server whenever base changes, but only if user hasn't started editing
  useEffect(() => {
    if (!dirty) setRows(baseRows);
  }, [baseRows]); // dirty intentionally excluded — only sync on data load, not on every edit

  const toggle = (key: string) => {
    setRows(r => r.map(row => row.jiraProjectKey === key ? { ...row, enabled: !row.enabled } : row));
    setDirty(true);
  };

  const rename = (key: string, name: string) => {
    setRows(r => r.map(row => row.jiraProjectKey === key ? { ...row, podDisplayName: name } : row));
    setDirty(true);
  };

  const handleReload = async () => {
    setDirty(false);
    await refetchProjects();
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync(rows);
      setDirty(false);
      notifications.show({
        title: 'Saved',
        message: `Watching ${rows.filter(r => r.enabled).length} Jira board(s).`,
        color: 'teal',
      });
    } catch {
      notifications.show({ title: 'Save failed', message: 'Please try again.', color: 'red' });
    }
  };

  const loading = statusLoading || configLoading;
  const enabledCount = rows.filter(r => r.enabled).length;

  return (
    <Box p="md" maw={860}>
      {/* ── Page header ── */}
      <Group mb="lg" gap="sm">
        <ThemeIcon size={38} radius="md" style={{ backgroundColor: DEEP_BLUE }}>
          <IconTicket size={22} color="white" />
        </ThemeIcon>
        <div>
          <Title order={3} style={{ color: DEEP_BLUE, fontFamily: 'Barlow' }}>
            Jira Board Settings
          </Title>
          <Text size="sm" c="dimmed">
            Choose which Jira project spaces appear in the{' '}
            <Anchor size="sm" onClick={() => navigate('/jira-pods')}>POD Dashboard</Anchor>
            {' '}and{' '}
            <Anchor size="sm" onClick={() => navigate('/jira-actuals')}>Jira Actuals</Anchor>
            , and rename them to your internal POD names.
          </Text>
        </div>
      </Group>

      {/* ── Jira not configured ── */}
      {!statusLoading && !status?.configured && (
        <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured" mb="md">
          Add your Jira credentials to{' '}
          <code>backend/src/main/resources/application-local.yml</code> and restart
          the backend with <code>-Dspring.profiles.active=local</code> to enable this page.
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
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <Badge color="teal" size="sm">{enabledCount} enabled</Badge>
              <Badge color="gray" size="sm" variant="outline">
                {rows.length} total Jira spaces
              </Badge>
              {dirty && (
                <Badge color="orange" size="sm" variant="light">Unsaved changes</Badge>
              )}
            </Group>
            <Group gap="xs">
              <Tooltip label="Reload Jira spaces from server">
                <ActionIcon
                  variant="light"
                  loading={projectsLoading}
                  onClick={handleReload}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
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

          <Divider mb="sm" />

          {/* ── How-to hint ── */}
          <Alert icon={<IconInfoCircle size={15} />} color="blue" variant="light" mb="md" p="xs">
            <Text size="xs">
              Check the boards you want to track, then type a short POD display name for each one.
              Unchecked boards are hidden from all Integration views but their config is preserved.
            </Text>
          </Alert>

          {/* ── Board table ── */}
          {projectsLoading ? (
            <Stack align="center" py="lg">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Fetching Jira spaces…</Text>
            </Stack>
          ) : rows.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No Jira project spaces found. Check your Jira credentials.
            </Text>
          ) : (
            <Table verticalSpacing={6} highlightOnHover>
              <Table.Thead style={{ backgroundColor: DEEP_BLUE }}>
                <Table.Tr>
                  <Table.Th style={{ width: 44, color: '#fff', fontFamily: 'Barlow', fontSize: 11 }}>
                    Watch
                  </Table.Th>
                  <Table.Th style={{ color: '#fff', fontFamily: 'Barlow', fontSize: 11 }}>
                    Jira Space
                  </Table.Th>
                  <Table.Th style={{ color: '#fff', fontFamily: 'Barlow', fontSize: 11 }}>
                    POD Display Name
                  </Table.Th>
                  <Table.Th style={{ width: 36 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map(row => {
                  const jiraName = jiraProjects.find(p => p.key === row.jiraProjectKey)?.name ?? row.jiraProjectKey;
                  return (
                    <Table.Tr
                      key={row.jiraProjectKey}
                      style={{ opacity: row.enabled ? 1 : 0.45 }}
                    >
                      <Table.Td>
                        <Checkbox
                          checked={row.enabled}
                          onChange={() => toggle(row.jiraProjectKey)}
                          color="teal"
                          size="sm"
                        />
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Group gap="xs">
                            <Badge size="xs" variant="outline" color="blue">
                              {row.jiraProjectKey}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed" lineClamp={1}>{jiraName}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={row.podDisplayName}
                          onChange={e => rename(row.jiraProjectKey, e.currentTarget.value)}
                          placeholder={row.jiraProjectKey}
                          disabled={!row.enabled}
                          style={{ maxWidth: 260 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Open in Jira" position="left">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            component="a"
                            href={`https://jira.baylorgenetix.com/jira/software/projects/${row.jiraProjectKey}/boards`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconExternalLink size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}

          {/* ── Bottom save bar ── */}
          {dirty && (
            <>
              <Divider mt="md" mb="sm" />
              <Group justify="flex-end">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => { setRows(baseRows); setDirty(false); }}
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
                  Save Watchlist
                </Button>
              </Group>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
