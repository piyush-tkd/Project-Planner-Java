import { useState, useEffect } from 'react';
import {
  Title, Text, Button, Table, Badge, ActionIcon, Modal, TextInput,
  Select, Switch, Group, Stack, Tabs, Paper, SimpleGrid, Checkbox,
  Tooltip, Loader, Center, Alert, NumberInput, SegmentedControl, Divider,
} from '@mantine/core';
import {
  IconUserPlus, IconPencil, IconTrash, IconShield, IconAlertCircle, IconRoute,
} from '@tabler/icons-react';
import { useTourConfig, useUpdateTourConfig } from '../../api/tour';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserRecord {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  enabled: boolean;
}

interface CreateUserPayload {
  username: string;
  password: string;
  role: string;
  displayName?: string;
}

interface UpdateUserPayload {
  displayName?: string;
  role?: string;
  enabled?: boolean;
  password?: string;
}

type PermMap = Record<string, boolean>;

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_KEYS = [
  // ── Core
  { key: 'dashboard',           label: 'Dashboard',            group: 'Core' },
  { key: 'resources',           label: 'Resources',            group: 'Core' },
  { key: 'projects',            label: 'Projects',             group: 'Core' },
  { key: 'pods',                label: 'PODs',                 group: 'Core' },
  { key: 'availability',        label: 'Availability',         group: 'Core' },
  { key: 'overrides',           label: 'Overrides',            group: 'Core' },
  { key: 'team_calendar',       label: 'Team Calendar',        group: 'Core' },
  { key: 'sprint_calendar',     label: 'Sprint Calendar',      group: 'Core' },
  { key: 'release_calendar',    label: 'Release Calendar',     group: 'Core' },
  { key: 'sprint_planner',      label: 'Sprint Planner',       group: 'Core' },
  // ── Capacity Reports
  { key: 'capacity_gap',        label: 'Capacity Gap',         group: 'Capacity Reports' },
  { key: 'utilization',         label: 'Utilization',          group: 'Capacity Reports' },
  { key: 'slack_buffer',        label: 'Slack & Buffer',       group: 'Capacity Reports' },
  { key: 'hiring_forecast',     label: 'Hiring Forecast',      group: 'Capacity Reports' },
  { key: 'concurrency_risk',    label: 'Concurrency Risk',     group: 'Capacity Reports' },
  { key: 'capacity_demand',     label: 'Capacity vs Demand',   group: 'Capacity Reports' },
  { key: 'pod_resources',       label: 'POD Resources',        group: 'Capacity Reports' },
  { key: 'pod_capacity',        label: 'POD Capacity',         group: 'Capacity Reports' },
  { key: 'resource_pod_matrix', label: 'Resource · POD Matrix',group: 'Capacity Reports' },
  // ── Portfolio Analysis
  { key: 'project_health',      label: 'Project Health',       group: 'Portfolio Analysis' },
  { key: 'cross_pod_deps',      label: 'Cross-POD Deps',       group: 'Portfolio Analysis' },
  { key: 'owner_demand',        label: 'Owner Demand',         group: 'Portfolio Analysis' },
  { key: 'deadline_gap',        label: 'Deadline Gap',         group: 'Portfolio Analysis' },
  { key: 'resource_allocation', label: 'Resource Allocation',  group: 'Portfolio Analysis' },
  { key: 'pod_splits',          label: 'POD Splits',           group: 'Portfolio Analysis' },
  { key: 'pod_project_matrix',  label: 'POD-Project Matrix',   group: 'Portfolio Analysis' },
  { key: 'project_pod_matrix',  label: 'Project-POD Matrix',   group: 'Portfolio Analysis' },
  { key: 'project_gantt',       label: 'Project Gantt',        group: 'Portfolio Analysis' },
  { key: 'budget',              label: 'Budget & Cost',        group: 'Portfolio Analysis' },
  { key: 'resource_roi',        label: 'Resource ROI',         group: 'Portfolio Analysis' },
  // ── Integrations
  { key: 'jira_pods',           label: 'Jira POD Dashboard',   group: 'Integrations' },
  { key: 'jira_releases',       label: 'Jira Releases',        group: 'Integrations' },
  { key: 'jira_capex',          label: 'Jira CapEx / OpEx',    group: 'Integrations' },
  { key: 'jira_actuals',        label: 'Jira Actuals',         group: 'Integrations' },
  { key: 'jira_support',        label: 'Jira Support Queue',   group: 'Integrations' },
  { key: 'jira_worklog',        label: 'Jira Worklog',         group: 'Integrations' },
  // ── Other
  { key: 'timeline_simulator',   label: 'Timeline Simulator',   group: 'Simulators' },
  { key: 'scenario_simulator',   label: 'Scenario Simulator',   group: 'Simulators' },
  { key: 'settings',            label: 'Settings',             group: 'Other' },
];

const ROLES = ['ADMIN', 'READ_WRITE', 'READ_ONLY'];

const ROLE_COLOR: Record<string, string> = {
  ADMIN:      'red',
  READ_WRITE: 'blue',
  READ_ONLY:  'gray',
};

// ── API helpers ────────────────────────────────────────────────────────────────

const fetchUsers    = () => apiClient.get<UserRecord[]>('/users').then(r => r.data);
const fetchPerms    = (role: string) =>
  apiClient.get<PermMap>(`/users/permissions/${role}`).then(r => r.data);

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const qc = useQueryClient();
  const { username: currentUsername, refreshMe } = useAuth();

  // ── Users tab state
  const [userModal, setUserModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  // ── Permissions tab state
  const [permRole, setPermRole] = useState<string>('READ_WRITE');

  // ── Users data
  const { data: users = [], isLoading: loadingUsers, error: usersError } =
    useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  // ── Permissions data
  const { data: perms, isLoading: loadingPerms, refetch: refetchPerms } =
    useQuery({
      queryKey: ['permissions', permRole],
      queryFn:  () => fetchPerms(permRole),
      enabled:  permRole !== 'ADMIN',
    });

  // ── Mutations
  const createUser = useMutation({
    mutationFn: (payload: CreateUserPayload) =>
      apiClient.post('/users', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setUserModal(null); },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      apiClient.put(`/users/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setUserModal(null);
      // If the updated user is the currently logged-in user, refresh the header immediately
      if (editTarget?.username === currentUsername) {
        refreshMe();
      }
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null); },
  });

  const savePerms = useMutation({
    mutationFn: ({ role, permsData }: { role: string; permsData: PermMap }) =>
      apiClient.put(`/users/permissions/${role}`, permsData),
    onSuccess: () => refetchPerms(),
  });

  // ── Handlers
  function openCreate() { setEditTarget(null); setUserModal('create'); }
  function openEdit(u: UserRecord) { setEditTarget(u); setUserModal('edit'); }

  function handlePermToggle(pageKey: string, newVal: boolean) {
    savePerms.mutate({ role: permRole, permsData: { [pageKey]: newVal } });
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}>
            User Management
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            Manage user accounts and configure page access for each role.
          </Text>
        </div>
      </Group>

      <Tabs defaultValue="users">
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<IconShield size={15} />}>Users</Tabs.Tab>
          <Tabs.Tab value="permissions" leftSection={<IconShield size={15} />}>Page Permissions</Tabs.Tab>
          <Tabs.Tab value="tour" leftSection={<IconRoute size={15} />}>Tour Guide</Tabs.Tab>
        </Tabs.List>

        {/* ── Users Tab ── */}
        <Tabs.Panel value="users" pt="md">
          <Stack gap="sm">
            <Group justify="flex-end">
              <Button leftSection={<IconUserPlus size={16} />} onClick={openCreate} size="sm">
                New User
              </Button>
            </Group>

            {loadingUsers && <Center py="xl"><Loader /></Center>}
            {usersError && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                Failed to load users.
              </Alert>
            )}

            {!loadingUsers && !usersError && (
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Username</Table.Th>
                      <Table.Th>Display Name</Table.Th>
                      <Table.Th>Role</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th style={{ width: 90 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.map(u => (
                      <Table.Tr key={u.id}>
                        <Table.Td>
                          <Text fw={600} size="sm" style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}>
                            {u.username}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={u.displayName ? undefined : 'dimmed'}>
                            {u.displayName ?? '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={ROLE_COLOR[u.role] ?? 'gray'} variant="light" size="sm">
                            {u.role}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={u.enabled ? 'green' : 'red'} variant="dot" size="sm">
                            {u.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Tooltip label="Edit">
                              <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(u)}>
                                <IconPencil size={15} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => setDeleteTarget(u)}
                              >
                                <IconTrash size={15} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {users.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '24px' }}>
                          No users found.
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Permissions Tab ── */}
        <Tabs.Panel value="permissions" pt="md">
          <Stack gap="md">
            <Group>
              <Select
                label="Configure permissions for role"
                data={[
                  { value: 'READ_WRITE', label: 'Read / Write' },
                  { value: 'READ_ONLY',  label: 'Read Only' },
                ]}
                value={permRole}
                onChange={v => setPermRole(v ?? 'READ_WRITE')}
                style={{ width: 240 }}
              />
            </Group>

            {permRole === 'ADMIN' ? (
              <Alert color="blue" icon={<IconShield size={16} />}>
                ADMIN always has access to all pages. Permissions cannot be restricted for this role.
              </Alert>
            ) : loadingPerms ? (
              <Center py="xl"><Loader /></Center>
            ) : (
              <Stack gap="xl">
                {Array.from(new Set(PAGE_KEYS.map(p => p.group))).map(grp => (
                  <div key={grp}>
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="sm"
                      style={{ letterSpacing: '0.06em', borderBottom: '1px solid #eee', paddingBottom: 4 }}>
                      {grp}
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                      {PAGE_KEYS.filter(p => p.group === grp).map(({ key, label }) => {
                        const allowed = perms?.[key] ?? false;
                        return (
                          <Paper key={key} withBorder radius="sm" p="sm">
                            <Group justify="space-between">
                              <Text size="sm" fw={500} style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}>
                                {label}
                              </Text>
                              <Switch
                                checked={allowed}
                                onChange={e => handlePermToggle(key, e.currentTarget.checked)}
                                size="sm"
                                color="blue"
                              />
                            </Group>
                            <Text size="xs" c="dimmed" mt={2}>{key}</Text>
                          </Paper>
                        );
                      })}
                    </SimpleGrid>
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Tour Guide Tab ── */}
        <Tabs.Panel value="tour" pt="md">
          <TourSettingsPanel />
        </Tabs.Panel>

      </Tabs>

      {/* ── Create / Edit User Modal ── */}
      <UserFormModal
        opened={userModal !== null}
        mode={userModal ?? 'create'}
        initial={editTarget}
        onClose={() => setUserModal(null)}
        onSubmit={(payload) => {
          if (userModal === 'create') {
            createUser.mutate(payload as CreateUserPayload);
          } else if (editTarget) {
            updateUser.mutate({ id: editTarget.id, payload });
          }
        }}
        loading={createUser.isPending || updateUser.isPending}
        error={
          (createUser.error as Error | null)?.message ??
          (updateUser.error as Error | null)?.message ?? null
        }
      />

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        size="sm"
      >
        <Text size="sm">
          Are you sure you want to delete <strong>{deleteTarget?.username}</strong>? This cannot be undone.
        </Text>
        {deleteUser.error && (
          <Alert color="red" mt="sm" icon={<IconAlertCircle size={16} />}>
            {(deleteUser.error as Error).message}
          </Alert>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="red"
            loading={deleteUser.isPending}
            onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// ── User Form Modal ────────────────────────────────────────────────────────────

interface UserFormModalProps {
  opened: boolean;
  mode: 'create' | 'edit';
  initial: UserRecord | null;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => void;
  loading: boolean;
  error: string | null;
}

function UserFormModal({ opened, mode, initial, onClose, onSubmit, loading, error }: UserFormModalProps) {
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role,        setRole]        = useState('READ_WRITE');
  const [enabled,     setEnabled]     = useState(true);

  // Reset form when modal opens
  useEffect(() => {
    if (!opened) return;
    if (mode === 'edit' && initial) {
      setUsername(initial.username);
      setDisplayName(initial.displayName ?? '');
      setRole(initial.role);
      setEnabled(initial.enabled);
      setPassword('');
    } else {
      setUsername('');
      setPassword('');
      setDisplayName('');
      setRole('READ_WRITE');
      setEnabled(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  function handleSubmit() {
    if (mode === 'create') {
      onSubmit({ username, password, role, displayName: displayName || undefined });
    } else {
      const payload: UpdateUserPayload = { displayName, role, enabled };
      if (password) payload.password = password;
      onSubmit(payload);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'New User' : `Edit — ${initial?.username}`}
      size="sm"
    >
      <Stack gap="sm">
        {mode === 'create' && (
          <TextInput
            label="Username"
            placeholder="john.doe"
            value={username}
            onChange={e => setUsername(e.currentTarget.value)}
            required
          />
        )}
        <TextInput
          label="Display Name"
          placeholder="John Doe"
          value={displayName}
          onChange={e => setDisplayName(e.currentTarget.value)}
        />
        <TextInput
          label={mode === 'create' ? 'Password' : 'New Password (leave blank to keep)'}
          type="password"
          placeholder={mode === 'create' ? 'Required' : 'Leave blank to keep current'}
          value={password}
          onChange={e => setPassword(e.currentTarget.value)}
          required={mode === 'create'}
        />
        <Select
          label="Role"
          data={ROLES.map(r => ({ value: r, label: r }))}
          value={role}
          onChange={v => setRole(v ?? 'READ_WRITE')}
        />
        {mode === 'edit' && (
          <Checkbox
            label="Account enabled"
            checked={enabled}
            onChange={e => setEnabled(e.currentTarget.checked)}
          />
        )}

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Tour Settings Panel ────────────────────────────────────────────────────────

function TourSettingsPanel() {
  const { data: config, isLoading } = useTourConfig();
  const update = useUpdateTourConfig();

  if (isLoading) return <Center py="xl"><Loader /></Center>;

  const freq = config?.frequency ?? 'first_login';
  const everyN = config?.everyN ?? 30;
  const enabled = config?.enabled ?? true;

  return (
    <Stack gap="lg" maw={560}>
      <div>
        <Text fw={600} size="sm" mb={2}>Guided Tour</Text>
        <Text size="xs" c="dimmed">
          Control when the onboarding tour is shown to users after they log in.
          The tour walks through all major sections of the app.
        </Text>
      </div>

      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500}>Enable tour</Text>
              <Text size="xs" c="dimmed">When disabled, the tour is never shown to any user.</Text>
            </div>
            <Switch
              checked={enabled}
              onChange={e => update.mutate({ enabled: e.currentTarget.checked })}
              size="md"
              color="teal"
            />
          </Group>

          {enabled && (
            <>
              <Divider />
              <div>
                <Text size="sm" fw={500} mb={8}>Show frequency</Text>
                <SegmentedControl
                  fullWidth
                  value={freq}
                  onChange={v => update.mutate({ frequency: v as typeof freq })}
                  data={[
                    { value: 'first_login',  label: 'First login only' },
                    { value: 'every_login',  label: 'Every login' },
                    { value: 'every_n',      label: 'Every N days' },
                    { value: 'disabled',     label: 'Disabled' },
                  ]}
                />
              </div>

              {freq === 'every_n' && (
                <Group align="flex-end" gap="sm">
                  <NumberInput
                    label="Days between tours"
                    description="Re-show the tour after this many days"
                    value={everyN}
                    min={1}
                    max={365}
                    style={{ width: 200 }}
                    onChange={v => update.mutate({ everyN: Number(v) })}
                  />
                  <Text size="xs" c="dimmed" pb={6}>days</Text>
                </Group>
              )}
            </>
          )}
        </Stack>
      </Paper>

      <Alert color="blue" variant="light" icon={<IconAlertCircle size={15} />}>
        <Text size="xs">
          Changes take effect immediately. Users who have already seen the tour
          won't see it again until the configured interval passes, except with
          <strong> Every login</strong> mode.
        </Text>
      </Alert>
    </Stack>
  );
}
