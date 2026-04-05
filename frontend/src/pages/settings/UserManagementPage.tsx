import { useState, useEffect } from 'react';
import {
 Title, Text, Button, Table, Badge, ActionIcon, Modal, TextInput,
 Select, Switch, Group, Stack, Tabs, Paper, SimpleGrid, Checkbox,
 Tooltip, Alert, Divider,
} from '@mantine/core';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
 IconUserPlus, IconPencil, IconTrash, IconShield, IconAlertCircle, IconKey,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { FONT_FAMILY } from '../../brandTokens';

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
 // ── Home
 { key: 'dashboard',   label: 'Dashboard',   group: 'Home' },
 { key: 'inbox',       label: 'Inbox',       group: 'Home' },
 { key: 'nlp_landing', label: 'Ask AI',      group: 'Home' },
 // ── Portfolio
 { key: 'projects',      label: 'Projects',      group: 'Portfolio' },
 { key: 'pods',          label: 'PODs',           group: 'Portfolio' },
 { key: 'objectives',    label: 'Objectives',     group: 'Portfolio' },
 { key: 'risk_register', label: 'Risk & Issues',  group: 'Portfolio' },
 { key: 'ideas_board',   label: 'Ideas Board',    group: 'Portfolio' },
 // ── People
 { key: 'resources',        label: 'Resources',          group: 'People' },
 { key: 'availability',     label: 'Availability',        group: 'People' },
 { key: 'overrides',        label: 'Overrides',           group: 'People' },
 { key: 'resource_bookings',label: 'Resource Bookings',   group: 'People' },
 { key: 'capacity_hub',     label: 'Capacity Hub',        group: 'People' },
 { key: 'leave_hub',        label: 'Leave & Holidays',    group: 'People' },
 // ── Calendar
 { key: 'calendar_hub',     label: 'Strategic Calendar',  group: 'Calendar' },
 { key: 'sprint_planner',   label: 'Sprint Planner',      group: 'Calendar' },
 { key: 'project_templates',label: 'Project Templates',   group: 'Calendar' },
 // ── Delivery
 { key: 'jira_pods',     label: 'POD Dashboard',    group: 'Delivery' },
 { key: 'jira_releases', label: 'Releases',          group: 'Delivery' },
 { key: 'release_notes', label: 'Release Notes',     group: 'Delivery' },
 { key: 'jira_actuals',  label: 'Jira Actuals',      group: 'Delivery' },
 { key: 'jira_support',  label: 'Support Queue',     group: 'Delivery' },
 { key: 'jira_worklog',  label: 'Worklog',           group: 'Delivery' },
 { key: 'budget_capex',  label: 'Budget & CapEx',    group: 'Delivery' },
 // ── Analytics
 { key: 'portfolio_health_dashboard', label: 'Portfolio Health',       group: 'Analytics' },
 { key: 'project_health',             label: 'Project Health',         group: 'Analytics' },
 { key: 'dependency_map',             label: 'Dependency Map',         group: 'Analytics' },
 { key: 'portfolio_timeline',         label: 'Portfolio Timeline',     group: 'Analytics' },
 { key: 'project_signals',            label: 'Project Signals',        group: 'Analytics' },
 { key: 'resource_performance',       label: 'Resource Performance',   group: 'Analytics' },
 { key: 'dora_metrics',               label: 'DORA Metrics',           group: 'Analytics' },
 { key: 'jira_analytics',             label: 'Jira Analytics',         group: 'Analytics' },
 { key: 'jira_dashboard_builder',     label: 'Dashboard Builder',      group: 'Analytics' },
 { key: 'engineering_intelligence',    label: 'Eng. Intelligence',      group: 'Analytics' },
 { key: 'gantt_dependencies',         label: 'Gantt & Dependencies',   group: 'Analytics' },
 { key: 'delivery_predictability',    label: 'Delivery Predictability',group: 'Analytics' },
 { key: 'smart_notifications',        label: 'Smart Notifications',    group: 'Analytics' },
 { key: 'jira_portfolio_sync',        label: 'Jira Portfolio Sync',    group: 'Analytics' },
 { key: 'resource_intelligence',      label: 'Resource Intelligence',  group: 'Analytics' },
 { key: 'timeline_simulator',         label: 'Timeline Simulator',     group: 'Analytics' },
 { key: 'scenario_simulator',         label: 'Scenario Simulator',     group: 'Analytics' },
 { key: 'pod_resources',              label: 'POD Resources',          group: 'Analytics' },
 { key: 'pod_capacity',               label: 'POD Capacity',           group: 'Analytics' },
 { key: 'pod_hours',                  label: 'POD Work Hours',         group: 'Analytics' },
 { key: 'hiring_forecast',            label: 'Hiring Forecast',        group: 'Analytics' },
 { key: 'capacity_demand',            label: 'Capacity vs Demand',     group: 'Analytics' },
 { key: 'utilization',                label: 'Utilization Center',     group: 'Analytics' },
 { key: 'project_pod_matrix',         label: 'Project-POD Matrix',     group: 'Analytics' },
 { key: 'workload_chart',             label: 'Workload Chart',         group: 'Analytics' },
 // ── Admin
 { key: 'org_settings',          label: 'Admin Settings',   group: 'Admin' },
 { key: 'azure_devops_settings', label: 'Azure DevOps',     group: 'Admin' },
 { key: 'settings',              label: 'Settings (sub)',   group: 'Admin' },
 { key: 'jira_resource_mapping', label: 'Resource Mapping', group: 'Admin' },
 { key: 'jira_release_mapping',  label: 'Release Mapping',  group: 'Admin' },
 { key: 'sidebar_order',         label: 'Sidebar Order',    group: 'Admin' },
 { key: 'nlp_settings',          label: 'NLP Settings',     group: 'Admin' },
 { key: 'nlp_optimizer',         label: 'NLP Optimizer',    group: 'Admin' },
 { key: 'feedback_hub',          label: 'Feedback Hub',     group: 'Admin' },
 { key: 'error_log',             label: 'Error Log',        group: 'Admin' },
 // ── Legacy (backward-compat only — these pages redirect to their replacements)
 { key: 'team_calendar',       label: 'Team Calendar → /calendar',          group: 'Legacy' },
 { key: 'sprint_calendar',     label: 'Sprint Calendar → /calendar',        group: 'Legacy' },
 { key: 'release_calendar',    label: 'Release Calendar → /calendar',       group: 'Legacy' },
 { key: 'holiday_calendar',    label: 'Holiday Calendar → /leave',          group: 'Legacy' },
 { key: 'leave_management',    label: 'Leave Management → /leave',          group: 'Legacy' },
 { key: 'capacity_gap',        label: 'Capacity Gap → Utilization',         group: 'Legacy' },
 { key: 'slack_buffer',        label: 'Slack & Buffer → Utilization',       group: 'Legacy' },
 { key: 'concurrency_risk',    label: 'Concurrency Risk → Utilization',     group: 'Legacy' },
 { key: 'owner_demand',        label: 'Owner Demand → Project Signals',     group: 'Legacy' },
 { key: 'deadline_gap',        label: 'Deadline Gap → Project Signals',     group: 'Legacy' },
 { key: 'pod_splits',          label: 'POD Splits → Project Signals',       group: 'Legacy' },
 { key: 'pod_project_matrix',  label: 'POD-Project Matrix → Project-POD',  group: 'Legacy' },
 { key: 'budget',              label: 'Budget & Cost → Budget & CapEx',     group: 'Legacy' },
 { key: 'jira_capex',          label: 'Jira CapEx → Budget & CapEx',        group: 'Legacy' },
 { key: 'resource_pod_matrix', label: 'Resource-POD Matrix (merged)',       group: 'Legacy' },
 { key: 'cross_pod_deps',      label: 'Cross-POD Deps → Dependency Map',   group: 'Legacy' },
 { key: 'resource_allocation', label: 'Resource Allocation (merged)',       group: 'Legacy' },
 { key: 'resource_roi',        label: 'Resource ROI (merged)',              group: 'Legacy' },
 { key: 'project_gantt',       label: 'Project Gantt (merged)',             group: 'Legacy' },
 { key: 'roadmap_timeline',    label: 'Roadmap Timeline (merged)',          group: 'Legacy' },
 { key: 'resource_forecast',   label: 'Resource Forecast (merged)',         group: 'Legacy' },
 { key: 'cross_team_dependency',label: 'Team Dependencies (merged)',        group: 'Legacy' },
];

const ROLES = ['ADMIN', 'READ_WRITE', 'READ_ONLY'];

const ROLE_OPTIONS = [
 { value: 'ADMIN',      label: 'Admin' },
 { value: 'READ_WRITE', label: 'Read / Write' },
 { value: 'READ_ONLY',  label: 'Read Only' },
];

const ROLE_LABELS: Record<string, string> = {
 ADMIN:      'Admin',
 READ_WRITE: 'Read / Write',
 READ_ONLY:  'Read Only',
};

const ROLE_COLOR: Record<string, string> = {
 ADMIN:      'red',
 READ_WRITE: 'blue',
 READ_ONLY:  'gray',
};

// ── API helpers ────────────────────────────────────────────────────────────────

const fetchUsers = () => apiClient.get<UserRecord[]>('/users').then(r => r.data);
const fetchPerms = (role: string) =>
 apiClient.get<PermMap>(`/users/permissions/${role}`).then(r => r.data);

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UserManagementPage({ embedded = false }: { embedded?: boolean } = {}) {
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
 queryFn: () => fetchPerms(permRole),
 enabled: permRole !== 'ADMIN',
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

 function handleGroupToggle(group: string, newVal: boolean) {
 const groupKeys = PAGE_KEYS.filter(p => p.group === group);
 const permsData: PermMap = {};
 groupKeys.forEach(({ key }) => { permsData[key] = newVal; });
 savePerms.mutate({ role: permRole, permsData });
 }

 function getGroupState(group: string): 'all' | 'none' | 'some' {
 const groupKeys = PAGE_KEYS.filter(p => p.group === group);
 const allowedCount = groupKeys.filter(({ key }) => perms?.[key] ?? false).length;
 if (allowedCount === groupKeys.length) return 'all';
 if (allowedCount === 0) return 'none';
 return 'some';
 }

 return (
 <Stack gap="lg" className="page-enter stagger-children">
 {!embedded && (
 <Group justify="space-between" className="slide-in-left">
 <div>
 <Title order={2} style={{ fontFamily: FONT_FAMILY }}>
 User Management
 </Title>
 <Text size="sm" c="dimmed" mt={2}>
 Manage user accounts and configure page access for each role.
 </Text>
 </div>
 </Group>
 )}

 <Tabs defaultValue="users">
 <Tabs.List>
 <Tabs.Tab value="users" leftSection={<IconShield size={15} />}>Users</Tabs.Tab>
 <Tabs.Tab value="permissions" leftSection={<IconKey size={15} />}>Page Permissions</Tabs.Tab>
 </Tabs.List>

 {/* ── Users Tab ── */}
 <Tabs.Panel value="users" pt="md">
 <Stack gap="sm">
 <Group justify="flex-end">
 <Button leftSection={<IconUserPlus size={16} />} onClick={openCreate} size="sm">
 New User
 </Button>
 </Group>

 {loadingUsers && <LoadingSpinner variant="table" message="Loading users..." />}
 {usersError && (
 <Alert color="red" icon={<IconAlertCircle size={16} />}>
 Failed to load users.
 </Alert>
 )}

 {!loadingUsers && !usersError && (
 <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
 <Table fz="xs" highlightOnHover>
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
 <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
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
 { value: 'READ_ONLY', label: 'Read Only' },
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
 <LoadingSpinner variant="form" message="Loading permissions..." />
 ) : (
 <Stack gap="xl">
 {Array.from(new Set(PAGE_KEYS.map(p => p.group))).map(grp => {
 const groupState = getGroupState(grp);
 const groupCount = PAGE_KEYS.filter(p => p.group === grp).length;
 const allowedInGroup = PAGE_KEYS.filter(p => p.group === grp && (perms?.[p.key] ?? false)).length;
 return (
 <div key={grp}>
 <Group justify="space-between" mb="sm"
 style={{ borderBottom: '1px solid #eee', paddingBottom: 6 }}>
 <Group gap="xs">
 <Text size="xs" fw={700} tt="uppercase" c="dimmed"
 style={{ letterSpacing: '0.06em' }}>
 {grp}
 </Text>
 <Badge size="xs" variant="light" color={groupState === 'all' ? 'green' : groupState === 'none' ? 'gray' : 'orange'}>
 {allowedInGroup}/{groupCount}
 </Badge>
 </Group>
 <Group gap={6}>
 <Text size="xs" c="dimmed">All</Text>
 <Checkbox
 checked={groupState === 'all'}
 indeterminate={groupState === 'some'}
 onChange={() => handleGroupToggle(grp, groupState !== 'all')}
 size="sm"
 color="teal"
 />
 </Group>
 </Group>
 <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
 {PAGE_KEYS.filter(p => p.group === grp).map(({ key, label }) => {
 const allowed = perms?.[key] ?? false;
 return (
 <Paper key={key} withBorder radius="sm" p="sm"
   style={grp === "Legacy" ? { opacity: 0.55, background: "rgba(0,0,0,0.02)" } : undefined}>
 <Group justify="space-between">
 <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>
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
 );
 })}
 </Stack>
 )}
 </Stack>
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
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [displayName, setDisplayName] = useState('');
 const [role, setRole] = useState('READ_WRITE');
 const [enabled, setEnabled] = useState(true);

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
 data={ROLE_OPTIONS}
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
