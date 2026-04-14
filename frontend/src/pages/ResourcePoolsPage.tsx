/**
 * ResourcePoolsPage — Sprint 8, PP-801
 * Overview grid of all resource pools with utilization cards
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Group, Title, Text, SimpleGrid, Paper, Badge, Progress,
  ActionIcon, Button, Alert, RingProgress, Center, ThemeIcon, Skeleton,
  Modal, TextInput, NumberInput, Select, Textarea,
} from '@mantine/core';
import {
  IconUsers, IconCode, IconBug, IconBriefcase, IconTarget, IconChartBar,
  IconPlus, IconRefresh, IconAlertCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DEEP_BLUE, AQUA, AQUA_HEX, DEEP_BLUE_HEX, FONT_FAMILY, SHADOW, COLOR_TEAL } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/client';

const ROLE_TYPE_OPTIONS = [
  { value: 'Developer',  label: 'Developer' },
  { value: 'QA',         label: 'QA' },
  { value: 'BSA',        label: 'BSA' },
  { value: 'SM',         label: 'Scrum Master' },
  { value: 'Tech Lead',  label: 'Tech Lead' },
  { value: 'DevOps',     label: 'DevOps' },
  { value: 'Designer',   label: 'Designer' },
  { value: 'Other',      label: 'Other' },
];

interface PoolSummary {
  poolId: number;
  poolName: string;
  roleType: string;
  targetHeadcount: number;
  totalMembers: number;
  available: number;
  utilization: number;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  Developer:  <IconCode size={22} />,
  QA:         <IconBug size={22} />,
  BSA:        <IconBriefcase size={22} />,
  SM:         <IconTarget size={22} />,
  'Tech Lead': <IconChartBar size={22} />,
};

function utilizationColor(pct: number): string {
  if (pct >= 95) return 'red';
  if (pct >= 80) return 'yellow';
  return 'teal';
}

export default function ResourcePoolsPage() {
  const dark = useDarkMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Create modal state ──────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]             = useState('');
  const [newRoleType, setNewRoleType]     = useState<string | null>(null);
  const [newSpecialization, setNewSpec]   = useState('');
  const [newTargetHC, setNewTargetHC]     = useState<number | string>('');
  const [newDescription, setNewDesc]      = useState('');

  const openCreate = () => {
    setNewName(''); setNewRoleType(null); setNewSpec('');
    setNewTargetHC(''); setNewDesc('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!newName.trim() || !newRoleType) return;
    setCreating(true);
    try {
      await apiClient.post('/resource-pools', {
        name: newName.trim(),
        roleType: newRoleType,
        specialization: newSpecialization.trim() || null,
        targetHeadcount: newTargetHC !== '' ? Number(newTargetHC) : null,
        description: newDescription.trim() || null,
      });
      notifications.show({ title: 'Pool created', message: `"${newName.trim()}" is ready`, color: 'teal' });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['resource-pools-supply-summary'] });
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.response?.data?.message ?? 'Failed to create pool', color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  const { data, isLoading, isError, refetch } = useQuery<PoolSummary[]>({
    queryKey: ['resource-pools-supply-summary'],
    queryFn: () => apiClient.get('/resource-pools/supply-summary').then(r => r.data),
  });

  const pools = Array.isArray(data) ? data : [];

  return (
    <Stack gap="lg" p="md">
      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Resource Pools</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Supply inventory by role type — availability, utilization, and demand queue
          </Text>
        </div>
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={() => refetch()} aria-label="Refresh pools">
            <IconRefresh size={18} />
          </ActionIcon>
          <Button size="sm" variant="filled" leftSection={<IconPlus size={14} />}
            style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
            onClick={openCreate}>
            New Pool
          </Button>
        </Group>
      </Group>

      {/* ── Pool Cards Grid ── */}
      {isError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" mb="sm">
          Failed to load resource pools. Please try again.
        </Alert>
      )}
      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} height={200} radius="lg" />
          ))}
        </SimpleGrid>
      ) : pools.length === 0 ? (
        <Alert color="blue" radius="md">
          <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
            No resource pools configured. Create your first pool to start tracking supply.
          </Text>
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {pools.map(pool => {
            const color = utilizationColor(pool.utilization);
            const headcountPct = pool.targetHeadcount
              ? Math.min(100, Math.round((pool.totalMembers / pool.targetHeadcount) * 100))
              : 100;

            return (
              <Paper
                key={pool.poolId}
                withBorder
                p="lg"
                radius="lg"
                style={{
                  cursor: 'pointer',
                  boxShadow: SHADOW.card,
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  borderTop: `3px solid ${AQUA}`,
                }}
                onClick={() => navigate(`/resource-pools/${pool.poolId}`)}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = SHADOW.cardHover ?? '0 8px 24px rgba(0,0,0,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = SHADOW.card;
                  e.currentTarget.style.transform = '';
                }}
              >
                {/* Card Header */}
                <Group justify="space-between" mb="md">
                  <Group gap="sm">
                    <ThemeIcon size={44} radius="xl"
                      style={{ background: `${AQUA}20`, color: AQUA }}>
                      {ROLE_ICONS[pool.roleType] ?? <IconUsers size={22} />}
                    </ThemeIcon>
                    <div>
                      <Text fw={700} size="md" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                        {pool.poolName}
                      </Text>
                      <Badge size="xs" variant="light" color="blue" style={{ fontFamily: FONT_FAMILY }}>
                        {pool.roleType}
                      </Badge>
                    </div>
                  </Group>
                  <RingProgress
                    size={64}
                    thickness={6}
                    roundCaps
                    sections={[{ value: pool.utilization, color }]}
                    label={
                      <Center>
                        <Text size="xs" fw={700} style={{ color: DEEP_BLUE }}>{pool.utilization}%</Text>
                      </Center>
                    }
                  />
                </Group>

                {/* Stats Row */}
                <Group gap="lg" mb="md">
                  <div style={{ textAlign: 'center' }}>
                    <Text size="xl" fw={800} style={{ color: COLOR_TEAL, fontFamily: FONT_FAMILY }}>
                      {pool.available}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Available</Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text size="xl" fw={800} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                      {pool.totalMembers}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Total</Text>
                  </div>
                  {pool.targetHeadcount && (
                    <div style={{ textAlign: 'center' }}>
                      <Text size="xl" fw={800} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                        {pool.targetHeadcount}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Target</Text>
                    </div>
                  )}
                </Group>

                {/* Availability bar */}
                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Utilization</Text>
                    <Badge size="xs" color={color} variant="light">{pool.utilization}%</Badge>
                  </Group>
                  <Progress value={pool.utilization} color={color} size="sm" radius="xl" />
                </div>

                {/* Headcount vs target */}
                {pool.targetHeadcount && (
                  <div style={{ marginTop: 8 }}>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                        {pool.totalMembers}/{pool.targetHeadcount} headcount
                      </Text>
                      {pool.totalMembers < pool.targetHeadcount && (
                        <Badge size="xs" color="orange" variant="outline">
                          {pool.targetHeadcount - pool.totalMembers} below target
                        </Badge>
                      )}
                    </Group>
                    <Progress
                      value={headcountPct}
                      color={headcountPct < 80 ? 'orange' : 'teal'}
                      size="xs" radius="xl"
                    />
                  </div>
                )}
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
      {/* ── Create Pool Modal ── */}
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={<Text fw={700} style={{ fontFamily: FONT_FAMILY }}>Create Resource Pool</Text>}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Pool name"
            placeholder="e.g. Backend Dev Pool"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <Select
            label="Role type"
            placeholder="Select role"
            data={ROLE_TYPE_OPTIONS}
            value={newRoleType}
            onChange={setNewRoleType}
            required
          />
          <TextInput
            label="Specialization"
            placeholder="e.g. React, Java, Cloud (optional)"
            value={newSpecialization}
            onChange={e => setNewSpec(e.target.value)}
          />
          <NumberInput
            label="Target headcount"
            placeholder="e.g. 10"
            min={1}
            value={newTargetHC}
            onChange={setNewTargetHC}
          />
          <Textarea
            label="Description"
            placeholder="Optional notes about this pool"
            value={newDescription}
            onChange={e => setNewDesc(e.target.value)}
            rows={3}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
              onClick={submitCreate}
              loading={creating}
              disabled={!newName.trim() || !newRoleType}
            >
              Create Pool
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
