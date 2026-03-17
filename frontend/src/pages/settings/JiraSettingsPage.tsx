import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Text, Group, Button, TextInput, Badge,
  Alert, Loader, ActionIcon, Tooltip, Paper, Divider,
  ThemeIcon, Box, Stack, Select, MultiSelect, Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTicket, IconRefresh, IconInfoCircle, IconDeviceFloppy,
  IconAlertTriangle, IconPlus, IconTrash, IconGripVertical,
} from '@tabler/icons-react';
import {
  useJiraStatus, useJiraProjects,
  usePodWatchConfig, useSavePodWatchConfig,
  PodConfigRequest,
} from '../../api/jira';

const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';

interface PodRow {
  key: string;          // local temp key
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
  const { data: jiraProjects = [], isLoading: projectsLoading, refetch: refetchProjects } = useJiraProjects();
  const { data: savedConfig = [], isLoading: configLoading } = usePodWatchConfig();
  const save = useSavePodWatchConfig();

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
      notifications.show({ message: 'Add at least one POD with a name and board.', color: 'orange' });
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

  // Build Select options for board picker — exclude boards already assigned to OTHER pods
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

  const loading = statusLoading || configLoading;
  const enabledCount = rows.filter(r => r.enabled && r.boardKeys.length > 0).length;
  const totalBoards  = rows.reduce((n, r) => n + r.boardKeys.length, 0);

  return (
    <Box p="md" maw={900}>
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
            Group Jira boards into logical PODs. Multiple boards per POD are aggregated
            in the{' '}
            <Anchor size="sm" onClick={() => navigate('/jira-pods')}>POD Dashboard</Anchor>
            {' '}and{' '}
            <Anchor size="sm" onClick={() => navigate('/jira-actuals')}>Jira Actuals</Anchor>.
          </Text>
        </div>
      </Group>

      {/* ── Jira not configured ── */}
      {!statusLoading && !status?.configured && (
        <Alert icon={<IconAlertTriangle />} color="orange" title="Jira Not Configured" mb="md">
          Add your Jira credentials to{' '}
          <code>backend/src/main/resources/application-local.yml</code> and restart the backend.
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
              <Badge color="teal"  size="sm">{enabledCount} active PODs</Badge>
              <Badge color="blue"  size="sm" variant="outline">{totalBoards} boards assigned</Badge>
              {dirty && <Badge color="orange" size="sm" variant="light">Unsaved changes</Badge>}
            </Group>
            <Group gap="xs">
              <Tooltip label="Reload Jira board list">
                <ActionIcon variant="light" loading={projectsLoading} onClick={() => refetchProjects()}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Button
                size="sm"
                leftSection={<IconPlus size={14} />}
                variant="light"
                onClick={addPod}
              >
                Add POD
              </Button>
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
              Give each POD a display name and assign one or more Jira boards to it.
              A board can only belong to one POD. Disabled PODs are hidden from dashboards
              but their config is kept.
            </Text>
          </Alert>

          <Divider mb="md" />

          {/* ── POD rows ── */}
          {projectsLoading ? (
            <Stack align="center" py="lg">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Fetching Jira boards…</Text>
            </Stack>
          ) : rows.length === 0 ? (
            <Stack align="center" py="xl" gap="sm">
              <Text size="sm" c="dimmed">No PODs configured yet.</Text>
              <Button
                size="sm"
                leftSection={<IconPlus size={14} />}
                variant="light"
                onClick={addPod}
              >
                Add your first POD
              </Button>
            </Stack>
          ) : (
            <Stack gap="sm">
              {rows.map((row, idx) => (
                <PodRow
                  key={row.key}
                  row={row}
                  index={idx}
                  boardOptions={availableBoardOptions(row.key)}
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

// ── POD row component ─────────────────────────────────────────────────

function PodRow({
  row, index, boardOptions, onChange, onRemove,
}: {
  row: PodRow;
  index: number;
  boardOptions: { value: string; label: string; disabled?: boolean }[];
  onChange: (patch: Partial<PodRow>) => void;
  onRemove: () => void;
}) {
  const DEEP_BLUE = '#0C2340';
  const AGUA      = '#1F9196';
  const invalid = row.podDisplayName.trim() === '' || row.boardKeys.length === 0;

  return (
    <Paper
      withBorder
      p="sm"
      radius="sm"
      style={{
        borderLeft: `4px solid ${row.enabled ? AGUA : '#CBD5E1'}`,
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

        {/* POD name + board picker */}
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="POD display name (e.g. Enterprise Systems)"
              value={row.podDisplayName}
              onChange={e => onChange({ podDisplayName: e.currentTarget.value })}
              size="sm"
              style={{ flex: 1 }}
              error={row.podDisplayName.trim() === '' ? 'Required' : undefined}
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

          <MultiSelect
            placeholder={boardOptions.length === 0 ? 'No boards available' : 'Assign Jira boards…'}
            data={boardOptions}
            value={row.boardKeys}
            onChange={keys => onChange({ boardKeys: keys })}
            searchable
            size="xs"
            nothingFoundMessage="No matching boards"
            error={row.boardKeys.length === 0 ? 'Add at least one board' : undefined}
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

          {invalid && row.podDisplayName !== '' && row.boardKeys.length === 0 && (
            <Text size="xs" c="red">Assign at least one Jira board to this POD</Text>
          )}
        </Stack>

        {/* Remove button */}
        <Tooltip label="Remove POD">
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
