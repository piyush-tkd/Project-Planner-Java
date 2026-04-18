/**
 * ResourceAllocationDrawer
 * Sprint 5: PP-502 — Side drawer showing all team allocations for a resource
 * Allows viewing, adding, editing, and removing allocations.
 */
import { useState } from 'react';
import {
  Drawer, Stack, Group, Text, Title, Badge, Progress, Button, Divider,
  Table, ActionIcon, Select, NumberInput, TextInput, Alert, Tooltip,
  Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconPencil, IconTrash, IconAlertTriangle, IconCheck, IconX,
} from '@tabler/icons-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { DEEP_BLUE, FONT_FAMILY, SHADOW, AQUA, AQUA_HEX, DEEP_BLUE_HEX, COLOR_ERROR, COLOR_TEAL, COLOR_WARNING } from '../../brandTokens';
import apiClient from '../../api/client';

// ── Types ──────────────────────────────────────────────────────────────
interface AllocationType { id: number; name: string; maxPercentage: number; description?: string }
// @ts-expect-error -- unused
interface TeamType { id: number; name: string; isPermanent: boolean }
interface ResourceAllocation {
  id: number; resourceId: number; teamId: number; allocationTypeId: number;
  percentage: number; startDate: string; endDate?: string; isPrimary: boolean; notes?: string;
  allocationType?: AllocationType;
}
interface Pod { id: number; name: string }
interface Resource { id: number; name: string; role: string }

interface ResourceAllocationDrawerProps {
  opened: boolean;
  onClose: () => void;
  resource: Resource | null;
}

// ── Allocation status color ────────────────────────────────────────────
// @ts-expect-error -- unused
function allocationColor(pct: number): string {
  if (pct >= 100) return COLOR_ERROR;
  if (pct >= 80) return COLOR_WARNING;
  return COLOR_TEAL;
}

function allocationBadgeColor(pct: number): string {
  if (pct >= 100) return 'red';
  if (pct >= 80) return 'yellow';
  return 'green';
}

// ── Main Component ─────────────────────────────────────────────────────
export default function ResourceAllocationDrawer({
  opened, onClose, resource,
}: ResourceAllocationDrawerProps) {
  const dark = useDarkMode();
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [allocationTypes, setAllocationTypes] = useState<AllocationType[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPct, setTotalPct] = useState(0);

  // Add form state
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    teamId: '', allocationTypeId: '', percentage: 100, startDate: '', endDate: '', notes: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load data when drawer opens
  const loadData = async () => {
    if (!resource) return;
    setLoading(true);
    try {
      const [allocRes, typesRes, podsRes] = await Promise.all([
        apiClient.get(`/allocations/resource/${resource.id}`).then(r => r.data),
        apiClient.get(`/allocations/types`).then(r => r.data),
        apiClient.get(`/pods`).then(r => r.data),
      ]);
      setAllocations(Array.isArray(allocRes) ? allocRes : []);
      setAllocationTypes(Array.isArray(typesRes) ? typesRes : []);
      setPods(Array.isArray(podsRes) ? podsRes : []);

      const total = (Array.isArray(allocRes) ? allocRes : [])
        .filter((a: ResourceAllocation) => !a.endDate || new Date(a.endDate) > new Date())
        .reduce((sum: number, a: ResourceAllocation) => sum + a.percentage, 0);
      setTotalPct(total);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load allocations', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Track when drawer opens
  const handleOpen = () => {
    if (opened && resource) loadData();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => { handleOpen(); });

  const resetForm = () => {
    setForm({ teamId: '', allocationTypeId: '', percentage: 100, startDate: '', endDate: '', notes: '' });
    setFormError('');
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!resource || !form.teamId || !form.allocationTypeId) {
      setFormError('Team and Allocation Type are required');
      return;
    }
    const remaining = 100 - totalPct + (editingId ? (allocations.find(a => a.id === editingId)?.percentage ?? 0) : 0);
    if (form.percentage > remaining) {
      setFormError(`Adding ${form.percentage}% would exceed 100%. Available: ${remaining}%`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        resourceId: resource.id,
        teamId: Number(form.teamId),
        allocationTypeId: Number(form.allocationTypeId),
        percentage: form.percentage,
        startDate: form.startDate || new Date().toISOString().split('T')[0],
        endDate: form.endDate || undefined,
        notes: form.notes || undefined,
        isPrimary: allocations.length === 0,
      };
      if (editingId) {
        await apiClient.put(`/allocations/${editingId}`, body);
      } else {
        await apiClient.post(`/allocations`, body);
      }
      notifications.show({ title: 'Saved', message: `Allocation ${editingId ? 'updated' : 'created'}`, color: 'green' });
      closeAdd();
      resetForm();
      loadData();
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/allocations/${id}`);
      notifications.show({ title: 'Removed', message: 'Allocation removed', color: 'teal' });
      loadData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to remove allocation', color: 'red' });
    }
  };

  const startEdit = (a: ResourceAllocation) => {
    setEditingId(a.id);
    setForm({
      teamId: String(a.teamId),
      allocationTypeId: String(a.allocationTypeId),
      percentage: a.percentage,
      startDate: a.startDate ?? '',
      endDate: a.endDate ?? '',
      notes: a.notes ?? '',
    });
    openAdd();
  };

  const available = Math.max(0, 100 - totalPct);

  return (
    <Drawer
      opened={opened}
      onClose={() => { onClose(); resetForm(); closeAdd(); }}
      position="right"
      size="lg"
      title={
        <Group gap="sm">
          <div>
            <Title order={4} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, margin: 0 }}>
              {resource?.name ?? '—'}
            </Title>
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{resource?.role}</Text>
          </div>
        </Group>
      }
      styles={{ header: { borderBottom: `1px solid var(--mantine-color-default-border)`, paddingBottom: 12 } }}
    >
      <Stack gap="md" pt="sm">
        {/* ── Total Allocation Bar ── */}
        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>Total Allocation</Text>
            <Badge color={allocationBadgeColor(totalPct)} variant="light" size="sm">
              {totalPct}% allocated · {available}% available
            </Badge>
          </Group>
          <Progress
            value={totalPct}
            color={allocationBadgeColor(totalPct)}
            size="lg"
            radius="xl"
            style={{ boxShadow: SHADOW.card }}
          />
          {available === 0 && (
            <Alert icon={<IconAlertTriangle size={14} />} color="orange" mt="xs" radius="md" py={6}>
              <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
                Resource is fully allocated. Remove or reduce an existing allocation to add new ones.
              </Text>
            </Alert>
          )}
        </div>

        <Divider />

        {/* ── Allocations Table ── */}
        <Group justify="space-between">
          <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>Team Allocations</Text>
          <Button size="xs" variant="filled" leftSection={<IconPlus size={13} />} onClick={() => { resetForm(); openAdd(); }}
            style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }} disabled={available === 0}>
            Add Allocation
          </Button>
        </Group>

        {loading ? (
          <Group justify="center" py="xl"><Loader size="sm" color={AQUA} /></Group>
        ) : allocations.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="lg" style={{ fontFamily: FONT_FAMILY }}>
            No allocations yet. Add this resource to a team.
          </Text>
        ) : (
          <Table striped highlightOnHover withTableBorder style={{ boxShadow: SHADOW.card }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Team</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>Type</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>%</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>End Date</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY, fontSize: 11 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allocations.map(a => {
                const pod = pods.find(p => p.id === a.teamId);
                const isExpired = a.endDate && new Date(a.endDate) <= new Date();
                return (
                  <Table.Tr key={a.id} style={{ opacity: isExpired ? 0.5 : 1 }}>
                    <Table.Td>
                      <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>
                        {pod?.name ?? `Team #${a.teamId}`}
                      </Text>
                      {a.isPrimary && <Badge size="xs" variant="dot" color="blue" ml={4}>Primary</Badge>}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                        {a.allocationType?.name ?? `Type #${a.allocationTypeId}`}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={allocationBadgeColor(a.percentage)} variant="light" size="sm">
                        {a.percentage}%
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c={isExpired ? 'red' : 'dimmed'} style={{ fontFamily: FONT_FAMILY }}>
                        {a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}
                        {isExpired && ' (expired)'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Edit" withArrow fz="xs">
                          <ActionIcon size="xs" variant="subtle" onClick={() => startEdit(a)}
      aria-label="Edit"
    >
                            <IconPencil size={12} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Remove" withArrow fz="xs">
                          <ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleDelete(a.id)}
      aria-label="Delete"
    >
                            <IconTrash size={12} />
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

        {/* ── Add / Edit Form ── */}
        {addOpen && (
          <div style={{
            border: `1px solid ${AQUA}50`,
            borderRadius: 12,
            padding: 16,
            background: dark ? 'rgba(45,204,211,0.05)' : `${AQUA}08`,
          }}>
            <Text size="sm" fw={700} mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
              {editingId ? 'Edit Allocation' : 'New Allocation'}
            </Text>
            <Stack gap="sm">
              <Select
                label="Team / POD"
                data={pods.map(p => ({ value: String(p.id), label: p.name }))}
                value={form.teamId}
                onChange={v => setForm(f => ({ ...f, teamId: v ?? '' }))}
                searchable
                required
              />
              <Select
                label="Allocation Type"
                data={allocationTypes.map(t => ({ value: String(t.id), label: t.name, description: t.description ?? undefined }))}
                value={form.allocationTypeId}
                onChange={v => setForm(f => ({ ...f, allocationTypeId: v ?? '' }))}
                required
              />
              <NumberInput
                label={`Percentage (max ${available + (editingId ? (allocations.find(a => a.id === editingId)?.percentage ?? 0) : 0)}%)`}
                value={form.percentage}
                onChange={v => setForm(f => ({ ...f, percentage: Number(v) || 0 }))}
                min={1}
                max={100}
                step={5}
                required
              />
              <Group grow>
                <TextInput
                  label="Start Date"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
                <TextInput
                  label="End Date (optional)"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </Group>
              <TextInput
                label="Notes (optional)"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
              {formError && (
                <Alert icon={<IconAlertTriangle size={14} />} color="red" py={6} radius="md">
                  <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{formError}</Text>
                </Alert>
              )}
              <Group gap="sm" justify="flex-end">
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconX size={13} />}
                  onClick={() => { closeAdd(); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  variant="filled"
                  leftSection={<IconCheck size={13} />}
                  style={{ backgroundColor: AQUA_HEX, color: DEEP_BLUE_HEX, fontWeight: 600 }}
                  loading={saving}
                  onClick={handleSave}
                >
                  {editingId ? 'Update' : 'Add'}
                </Button>
              </Group>
            </Stack>
          </div>
        )}
      </Stack>
    </Drawer>
  );
}
