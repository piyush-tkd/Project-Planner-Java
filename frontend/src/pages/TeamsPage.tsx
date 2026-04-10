/**
 * TeamsPage — Team management page
 * Shows Core Teams and/or Project Teams based on query filter
 * Sprint 4: PP-401, PP-405
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Title, Stack, Table, Button, Text, Group, ActionIcon, Badge, Paper, Alert,
  Skeleton, TextInput, Select,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { AQUA_HEX, AQUA, DEEP_BLUE, FONT_FAMILY, COLOR_TEAL, COLOR_WARNING } from '../brandTokens';
import { IconPlus, IconSearch, IconEye, IconArrowRight, IconAlertCircle } from '@tabler/icons-react';
import TeamTypeBadge from '../components/teams/TeamTypeBadge';
import { useDarkMode } from '../hooks/useDarkMode';
import LoadingSpinner from '../components/common/LoadingSpinner';
import apiClient from '../api/client';

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
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || 'all'; // 'core', 'project', or 'all'

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type'>('name');

  const { data: rawTeams, isLoading, isError } = useQuery<Team[]>({
    queryKey: ['pods-teams'],
    queryFn: () => apiClient.get('/pods').then(r => r.data),
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
            <Title order={3} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
              {pageTitle}
            </Title>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              Manage {teamCount} team{teamCount !== 1 ? 's' : ''}
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size={14} />}
            style={{ backgroundColor: AQUA, color: DEEP_BLUE }}
            onClick={() => navigate('/pods')}
          >
            Manage All
          </Button>
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
              {/* Illustrated icon cluster */}
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                {/* Background circle */}
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${AQUA}22, ${DEEP_BLUE}11)`,
                  border: `2px dashed ${AQUA}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={AQUA_HEX} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
                  </svg>
                </div>
                {/* Small + badge */}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: AQUA, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 2px 8px ${AQUA}66`,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
              </div>

              <Stack gap={4} align="center">
                <Text fw={700} size="md" style={{ color: isDark ? '#e9ecef' : DEEP_BLUE }}>
                  {search ? 'No teams match your search' : `No ${typeFilter !== 'all' ? typeFilter + ' ' : ''}teams yet`}
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={340}>
                  {search
                    ? `Try a different search term or clear the filter to see all teams.`
                    : typeFilter === 'project'
                      ? 'Project teams are time-boxed squads built around a specific initiative. Create one to start assigning members and tracking progress.'
                      : typeFilter === 'core'
                        ? 'Core teams are permanent pods that maintain existing products. Set one up to manage ongoing BAU work.'
                        : 'Teams help you organise people, track capacity, and link work to the right group. Create your first team to get started.'
                  }
                </Text>
              </Stack>

              <Group gap="sm">
                <Button
                  leftSection={<IconPlus size={14} />}
                  style={{ backgroundColor: AQUA, color: DEEP_BLUE, fontWeight: 600 }}
                  onClick={() => navigate('/pods')}
                >
                  {typeFilter === 'project' ? 'Create Project Team' : typeFilter === 'core' ? 'Create Core Team' : 'Create Team'}
                </Button>
                {search && (
                  <Button variant="subtle" color="gray" onClick={() => setSearch('')}>
                    Clear Search
                  </Button>
                )}
              </Group>

              {/* Hint chips */}
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
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => navigate(`/teams/${team.id}`)}
                          title="View team details"
                        >
                          <IconArrowRight size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>
    </PPPageLayout>
  );
}
