/**
 * TeamsPage — Team management page
 * Shows Core Teams and/or Project Teams based on query filter
 * Sprint 4: PP-401, PP-405
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Title, Stack, Table, Button, Text, Group, ActionIcon, Badge, Paper, Alert,
  Skeleton, TextInput, Select, Modal, Tooltip, Textarea, Switch,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { PPPageLayout } from '../components/pp';
import { AQUA_HEX, DEEP_BLUE, DEEP_BLUE_HEX, FONT_FAMILY, COLOR_TEAL, COLOR_WARNING } from '../brandTokens';
import { IconPlus, IconSearch, IconArrowRight, IconAlertCircle, IconPencil, IconTrash, IconExternalLink } from '@tabler/icons-react';
import TeamTypeBadge from '../components/teams/TeamTypeBadge';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/client';
import { useDeletePod, useUpdatePod } from '../api/pods';
import { notifications } from '@mantine/notifications';

interface Team {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  teamType?: { id: number; name: string };
  targetEndDate?: string;
}

export default function TeamsPage() {
  const isDark = useDarkMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || 'all'; // 'core', 'project', or 'all'

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type'>('name');

  // Edit/Delete state
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  // Create team modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createIsProject, setCreateIsProject] = useState(typeFilter === 'project');
  const [createEndDate, setCreateEndDate] = useState<Date | null>(null);

  const openCreate = () => {
    setCreateName(''); setCreateDesc('');
    setCreateIsProject(typeFilter === 'project');
    setCreateEndDate(null);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await apiClient.post('/pods', {
        name: createName.trim(),
        description: createDesc.trim() || null,
        active: true,
        targetEndDate: createIsProject && createEndDate
          ? createEndDate.toISOString().split('T')[0]
          : null,
      });
      notifications.show({
        title: 'Team created',
        message: `"${createName.trim()}" has been added`,
        color: 'teal',
      });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pods-teams'] });
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message ?? 'Failed to create team',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const updatePod = useUpdatePod();
  const deletePod = useDeletePod();

  const { data: rawTeams, isLoading, isError, refetch } = useQuery<Team[]>({
    queryKey: ['pods-teams'],
    queryFn: () => apiClient.get('/pods/all').then(r => r.data),
  });

  const teams = Array.isArray(rawTeams) ? rawTeams : [];

  // Filter teams based on type
  const filteredTeams = teams.filter(team => {
    const isCore = team.teamType?.name === 'Core Team' || !team.targetEndDate;
    if (typeFilter === 'core') return isCore;
    if (typeFilter === 'project') return !isCore;
    return true;
  })
    .filter(team => team.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const aCore = a.teamType?.name === 'Core Team' || !a.targetEndDate;
      const bCore = b.teamType?.name === 'Core Team' || !b.targetEndDate;
      return aCore === bCore ? 0 : aCore ? -1 : 1;
    });

  const pageTitle = typeFilter === 'core' ? 'Core Teams' : typeFilter === 'project' ? 'Project Teams' : 'Teams';
  const teamCount = filteredTeams.length;

  const openEdit = (team: Team) => {
    setEditTarget(team);
    setEditName(team.name);
    setEditDesc(team.description ?? '');
  };

  const commitEdit = () => {
    if (!editTarget || !editName.trim()) return;
    updatePod.mutate(
      { id: editTarget.id, data: { name: editName.trim(), description: editDesc } },
      {
        onSuccess: () => {
          notifications.show({ title: 'Updated', message: 'Team updated successfully', color: 'green' });
          setEditTarget(null);
          refetch();
        },
        onError: () => notifications.show({ title: 'Error', message: 'Failed to update team', color: 'red' }),
      }
    );
  };

  const commitDelete = () => {
    if (!deleteTarget) return;
    deletePod.mutate(deleteTarget.id, {
      onSuccess: () => {
        notifications.show({ title: 'Deleted', message: `"${deleteTarget.name}" has been removed`, color: 'teal' });
        setDeleteTarget(null);
        refetch();
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to delete team', color: 'red' }),
    });
  };

  if (isLoading) {
    return (
      <PPPageLayout title={pageTitle}>
        <Stack gap="md" p="md">
          {[1,2,3,4,5].map(i => <Skeleton key={i} height={48} radius="sm" />)}
        </Stack>
      </PPPageLayout>
    );
  }

  return (
    <PPPageLayout title={pageTitle}>
      <Stack gap="md">
        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" mx="md" mt="md">
            Failed to load teams. Please refresh and try again.
          </Alert>
        )}

        {/* ── Header ── */}
        <Group justify="space-between">
          <div>
            <Title order={3} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#7dd3fc' : DEEP_BLUE_HEX }}>
              {pageTitle}
            </Title>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              Manage {teamCount} team{teamCount !== 1 ? 's' : ''}
            </Text>
          </div>
          <Group gap="xs">
            <Button
              leftSection={<IconExternalLink size={14} />}
              variant="subtle"
              color="gray"
              onClick={() => navigate('/pods')}
            >
              Open PODs
            </Button>
            <Button
              leftSection={<IconPlus size={14} />}
              variant="filled"
              style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
              onClick={openCreate}
            >
              {typeFilter === 'project' ? 'New Project Team' : typeFilter === 'core' ? 'New Core Team' : 'New Team'}
            </Button>
          </Group>
        </Group>

        {/* ── Filters & Search ── */}
        <Paper withBorder p="md" radius="md" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Group grow>
            <TextInput
              placeholder="Search teams..."
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Select
              label="Sort by"
              value={sortBy}
              onChange={v => setSortBy((v as any) || 'name')}
              data={[
                { value: 'name', label: 'Name' },
                { value: 'type', label: 'Type' },
              ]}
            />
          </Group>
        </Paper>

        {/* ── Teams Table ── */}
        <Paper withBorder p="md" radius="md" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {filteredTeams.length === 0 ? (
            <Stack align="center" gap="md" py={56} px="xl">
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${AQUA_HEX}22, ${DEEP_BLUE_HEX}11)`,
                  border: `2px dashed ${AQUA_HEX}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={AQUA_HEX} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
                  </svg>
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: AQUA_HEX, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 2px 8px ${AQUA_HEX}66`,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
              </div>

              <Stack gap={4} align="center">
                <Text fw={700} size="md" style={{ color: isDark ? '#e9ecef' : DEEP_BLUE_HEX }}>
                  {search ? 'No teams match your search' : `No ${typeFilter !== 'all' ? typeFilter + ' ' : ''}teams yet`}
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={340}>
                  {search
                    ? `Try a different search term or clear the filter to see all teams.`
                    : typeFilter === 'project'
                      ? 'Project teams are time-boxed squads built around a specific initiative.'
                      : typeFilter === 'core'
                        ? 'Core teams are permanent pods that maintain existing products.'
                        : 'Teams help you organise people, track capacity, and link work to the right group.'
                  }
                </Text>
              </Stack>

              <Group gap="sm">
                <Button
                  leftSection={<IconPlus size={14} />}
                  style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
                  onClick={openCreate}
                >
                  {typeFilter === 'project' ? 'Create Project Team' : typeFilter === 'core' ? 'Create Core Team' : 'Create Team'}
                </Button>
                {search && (
                  <Button variant="subtle" color="gray" onClick={() => setSearch('')}>
                    Clear Search
                  </Button>
                )}
              </Group>

              {!search && (
                <Group gap="xs" mt={4}>
                  {['Assign members', 'Track capacity', 'Link to projects'].map(hint => (
                    <Badge key={hint} variant="light" color="gray" size="sm" radius="xl">
                      {hint}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Name</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Type</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Description</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>End Date</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Status</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredTeams.map(team => {
                  const isCore = team.teamType?.name === 'Core Team' || !team.targetEndDate;
                  const isExpired = team.targetEndDate && new Date(team.targetEndDate) <= new Date();
                  return (
                    <Table.Tr key={team.id}>
                      <Table.Td>
                        <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                          {team.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <TeamTypeBadge type={isCore ? 'core' : 'project'} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                          {team.description ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c={isExpired ? 'red' : 'dimmed'} style={{ fontFamily: FONT_FAMILY }}>
                          {team.targetEndDate ? new Date(team.targetEndDate).toLocaleDateString() : 'Ongoing'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={isExpired ? 'red' : team.active ? 'green' : 'gray'}
                          variant="light"
                          size="sm"
                        >
                          {isExpired ? 'Expired' : team.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="View details">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={() => navigate(`/teams/${team.id}`)}
                            >
                              <IconArrowRight size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit team">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="blue"
                              onClick={() => openEdit(team)}
                            >
                              <IconPencil size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete team">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => setDeleteTarget(team)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      {/* ── Create Team Modal ── */}
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={<Text fw={700} style={{ fontFamily: FONT_FAMILY }}>
          {typeFilter === 'project' ? 'Create Project Team' : typeFilter === 'core' ? 'Create Core Team' : 'Create Team'}
        </Text>}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Team name"
            placeholder="e.g. Phoenix Squad"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Optional — what does this team work on?"
            value={createDesc}
            onChange={e => setCreateDesc(e.target.value)}
            rows={2}
          />
          <Switch
            label="Project team (time-boxed)"
            checked={createIsProject}
            onChange={e => setCreateIsProject(e.currentTarget.checked)}
          />
          {createIsProject && (
            <DateInput
              label="Target end date"
              placeholder="Pick a date"
              value={createEndDate}
              onChange={setCreateEndDate}
              clearable
            />
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
              onClick={submitCreate}
              loading={creating}
              disabled={!createName.trim()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        opened={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={<Text fw={700}>Edit Team</Text>}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Team name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
          />
          <TextInput
            label="Description"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="Optional description"
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
              onClick={commitEdit}
              loading={updatePod.isPending}
              disabled={!editName.trim()}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={<Text fw={700} c="red">Delete Team</Text>}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone and will remove all associated data.
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              color="red"
              onClick={commitDelete}
              loading={deletePod.isPending}
            >
              Delete Team
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PPPageLayout>
  );
}
