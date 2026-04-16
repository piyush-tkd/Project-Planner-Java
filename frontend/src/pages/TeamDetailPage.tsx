/**
 * TeamDetailPage — shows team info, member allocations, and capacity
 * Sprint 4: PP-404
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Group, Title, Text, Badge, Paper, Table, Button, Progress,
  ActionIcon, Alert, Avatar, Skeleton, Modal, Select, NumberInput,
  Switch, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconUsers, IconPlus, IconPencil, IconCheck } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY, SHADOW, COLOR_TEAL, COLOR_WARNING } from '../brandTokens';
import apiClient from '../api/client';
import { useDarkMode } from '../hooks/useDarkMode';
import TeamTypeBadge from '../components/teams/TeamTypeBadge';
import ResourceAllocationDrawer from '../components/resources/ResourceAllocationDrawer';
import { useCreateAllocation, useAllocationTypes } from '../api/allocations';
import { useResources } from '../api/resources';

interface TeamMember {
  allocation: {
    id: number; resourceId: number; teamId: number; percentage: number;
    startDate: string; endDate?: string; isPrimary: boolean;
    allocationType?: { name: string };
  };
  resource: { id: number; name: string; role: string; active: boolean };
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dark = useDarkMode();

  const [drawerResource, setDrawerResource] = useState<{ id: number; name: string; role: string } | null>(null);
  const [addOpen, setAddOpen]               = useState(false);

  // Add Member form state
  const [selResourceId, setSelResourceId]   = useState<string | null>(null);
  const [selTypeId, setSelTypeId]           = useState<string | null>(null);
  const [percentage, setPercentage]         = useState<number | string>(100);
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');
  const [isPrimary, setIsPrimary]           = useState(false);

  const qc = useQueryClient();
  const createAllocation = useCreateAllocation();
  const { data: allResources = [] }  = useResources();
  const { data: allocationTypes = [] } = useAllocationTypes();

  const { data: team, isLoading: teamLoading, isError: teamError } = useQuery<any>({
    queryKey: ['pod', id],
    queryFn: () => apiClient.get(`/pods/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: allocations = [], isLoading: allocLoading } = useQuery<any[]>({
    queryKey: ['team-allocations', id],
    queryFn: () => apiClient.get(`/allocations/team/${id}/active`).then(r => r.data).catch(() => []),
    enabled: !!id,
  });

  // Fetch all resources referenced by allocations in one batch call
  const resourceIds = [...new Set((Array.isArray(allocations) ? allocations : []).map((a: any) => a.resourceId as number))];
  const { data: resourcesList = [] } = useQuery<any[]>({
    queryKey: ['resources-batch', resourceIds.join(',')],
    queryFn: () =>
      Promise.all(
        resourceIds.map(rid => apiClient.get(`/resources/${rid}`).then(r => r.data).catch(() => null))
      ).then(results => results.filter(Boolean)),
    enabled: resourceIds.length > 0,
  });

  const resourceMap: Record<number, any> = Object.fromEntries(
    resourcesList.map((r: any) => [r.id, r])
  );
  const members: TeamMember[] = (Array.isArray(allocations) ? allocations : []).map((a: any) => ({
    allocation: a,
    resource: resourceMap[a.resourceId] ?? { id: a.resourceId, name: `Resource #${a.resourceId}`, role: '—', active: true },
  }));

  const totalCapacity = members.reduce((s, m) => s + m.allocation.percentage, 0);
  const avgAllocation = members.length ? Math.round(totalCapacity / members.length) : 0;
  const isLoading = teamLoading || allocLoading;

  if (isLoading) {
    return (
      <Stack gap="md" p="md">
        <Skeleton height={60} radius="md" />
        <Group gap="md" grow><Skeleton height={80} radius="md" /><Skeleton height={80} radius="md" /><Skeleton height={80} radius="md" /></Group>
        <Skeleton height={300} radius="md" />
      </Stack>
    );
  }

  if (!team) {
    return (
      <Alert color="red" m="md">
        Team not found
      </Alert>
    );
  }

  const isCore = team.teamType?.name === 'Core Team' || !team.targetEndDate;

  return (
    <Stack gap="md" p="md">
      {/* ── Header ── */}
      <Group gap="sm">
        <ActionIcon variant="subtle" onClick={() => navigate(-1)} aria-label="Go back">
          <IconArrowLeft size={18} />
        </ActionIcon>
        <div style={{ flex: 1 }}>
          <Group gap="sm" align="baseline">
            <Title order={3} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{team.name}</Title>
            <TeamTypeBadge type={isCore ? 'core' : 'project'} />
            {!isCore && team.targetEndDate && (
              <Badge size="sm" color="orange" variant="outline" style={{ fontFamily: FONT_FAMILY }}>
                Ends {new Date(team.targetEndDate).toLocaleDateString()}
              </Badge>
            )}
          </Group>
          {team.description && (
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              {team.description}
            </Text>
          )}
        </div>
      </Group>

      {/* ── KPI Cards ── */}
      <Group gap="md" grow>
        {[
          { label: 'Members', value: members.length, color: AQUA },
          { label: 'Avg Allocation', value: `${avgAllocation}%`, color: COLOR_TEAL },
          {
            label: 'Total Capacity',
            value: `${totalCapacity}%`,
            color: totalCapacity > 700 ? COLOR_WARNING : DEEP_BLUE,
          },
        ].map(kpi => (
          <Paper key={kpi.label} withBorder p="md" radius="md" style={{ boxShadow: SHADOW.card, textAlign: 'center' }}>
            <Text size="xl" fw={800} style={{ color: kpi.color, fontFamily: FONT_FAMILY }}>
              {kpi.value}
            </Text>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ fontFamily: FONT_FAMILY }}>
              {kpi.label}
            </Text>
          </Paper>
        ))}
      </Group>

      {/* ── Member Table ── */}
      <Paper withBorder p="md" radius="md" style={{ boxShadow: SHADOW.card }}>
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <IconUsers size={16} color={AQUA} />
            <Text fw={600} style={{ fontFamily: FONT_FAMILY }}>
              Team Members ({members.length})
            </Text>
          </Group>
          <Button size="xs" variant="filled" leftSection={<IconPlus size={13} />} style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }} onClick={() => setAddOpen(true)}>
            Add Member
          </Button>
        </Group>

        {members.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="lg" style={{ fontFamily: FONT_FAMILY }}>
            No members allocated yet.
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Name</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Role</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Type</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Allocation</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Start</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>End</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.map(({ allocation: a, resource: r }) => (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Avatar size="sm" radius="xl" color="blue">
                        {r.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </Avatar>
                      <div>
                        <Text
                          size="sm"
                          fw={500}
                          style={{ fontFamily: FONT_FAMILY, cursor: 'pointer', color: DEEP_BLUE }}
                          onClick={() => setDrawerResource(r)}
                        >
                          {r.name}
                        </Text>
                        {a.isPrimary && (
                          <Badge size="xs" variant="dot" color="blue">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                      {r.role}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                      {a.allocationType?.name ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Badge
                        color={a.percentage >= 80 ? 'yellow' : 'green'}
                        variant="light"
                        size="sm"
                      >
                        {a.percentage}%
                      </Badge>
                      <Progress
                        value={a.percentage}
                        color={a.percentage >= 80 ? 'yellow' : 'teal'}
                        size="xs"
                        w={60}
                        radius="xl"
                      />
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                      {a.startDate ? new Date(a.startDate).toLocaleDateString() : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="xs"
                      c={a.endDate && new Date(a.endDate) <= new Date() ? 'red' : 'dimmed'}
                      style={{ fontFamily: FONT_FAMILY }}
                    >
                      {a.endDate ? new Date(a.endDate).toLocaleDateString() : 'Ongoing'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon size="xs" variant="subtle" onClick={() => setDrawerResource(r)}>
                      <IconPencil size={12} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* ── Resource Allocation Drawer ── */}
      <ResourceAllocationDrawer
        opened={drawerResource !== null}
        onClose={() => setDrawerResource(null)}
        resource={drawerResource}
      />

      {/* ── Add Member Modal ── */}
      <Modal
        opened={addOpen}
        onClose={() => { setAddOpen(false); setSelResourceId(null); setSelTypeId(null); setPercentage(100); setStartDate(''); setEndDate(''); setIsPrimary(false); }}
        title={<Text fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Add Team Member</Text>}
        size="md"
        centered
      >
        <Stack gap="sm">
          <Select
            label="Resource"
            placeholder="Search for a resource…"
            searchable
            required
            data={allResources.map((r: any) => ({ value: String(r.id), label: `${r.name} — ${r.role ?? ''}` }))}
            value={selResourceId}
            onChange={setSelResourceId}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <Select
            label="Allocation Type"
            placeholder="Select type…"
            required
            data={allocationTypes.map((t: any) => ({ value: String(t.id), label: t.name }))}
            value={selTypeId}
            onChange={setSelTypeId}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <NumberInput
            label="Allocation %"
            required
            min={1}
            max={100}
            value={percentage}
            onChange={setPercentage}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <TextInput
            label="Start Date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.currentTarget.value)}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <TextInput
            label="End Date (optional)"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.currentTarget.value)}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <Switch
            label="Primary allocation"
            checked={isPrimary}
            onChange={e => setIsPrimary(e.currentTarget.checked)}
            styles={{ label: { fontFamily: FONT_FAMILY } }}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              leftSection={<IconCheck size={14} />}
              style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
              disabled={!selResourceId || !selTypeId || !percentage}
              loading={createAllocation.isPending}
              onClick={() => {
                if (!selResourceId || !selTypeId || !id) return;
                createAllocation.mutate(
                  {
                    resourceId:       Number(selResourceId),
                    teamId:           Number(id),
                    allocationTypeId: Number(selTypeId),
                    percentage:       Number(percentage),
                    startDate:        startDate || undefined,
                    endDate:          endDate   || undefined,
                    isPrimary,
                  },
                  {
                    onSuccess: () => {
                      notifications.show({ title: 'Member added', message: 'Team member allocated successfully.', color: 'teal', icon: <IconCheck size={14} /> });
                      qc.invalidateQueries({ queryKey: ['team-allocations', id] });
                      setAddOpen(false);
                      setSelResourceId(null); setSelTypeId(null); setPercentage(100); setStartDate(''); setEndDate(''); setIsPrimary(false);
                    },
                    onError: () => {
                      notifications.show({ title: 'Error', message: 'Failed to add member. Please try again.', color: 'red' });
                    },
                  }
                );
              }}
            >
              Add Member
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
