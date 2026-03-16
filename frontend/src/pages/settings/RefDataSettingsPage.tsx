import { useState } from 'react';
import {
  Title, Stack, Tabs, Table, Text, Button, Group, Modal,
  TextInput, NumberInput, ActionIcon, Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import {
  useEffortPatterns, useCreateEffortPattern, useUpdateEffortPattern, useDeleteEffortPattern,
  useRoleEffortMix, useSaveRoleMix, useDeleteRoleMix,
  useTshirtSizes, useCreateTshirtSize, useUpdateTshirtSize, useDeleteTshirtSize,
} from '../../api/refData';
import type { EffortPatternRequest, RoleEffortMixRequest, TshirtSizeRequest } from '../../api/refData';
import { usePods, useUpdatePod } from '../../api/pods';
import { formatRole } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import CsvToolbar from '../../components/common/CsvToolbar';
import { tshirtSizeColumns, effortPatternColumns, roleMixColumns } from '../../utils/csvColumns';

const ROLES = ['DEVELOPER', 'QA', 'BSA', 'TECH_LEAD'];

const emptyPatternForm: EffortPatternRequest = { name: '', description: '', weights: {} };
const emptySizeForm: TshirtSizeRequest = { name: '', baseHours: 0, displayOrder: 0 };

export default function RefDataSettingsPage() {
  const { data: patterns, isLoading: pLoading } = useEffortPatterns();
  const { data: roleMix, isLoading: rLoading } = useRoleEffortMix();
  const { data: sizes, isLoading: sLoading } = useTshirtSizes();
  const { data: pods, isLoading: podLoading } = usePods();
  const updatePod = useUpdatePod();

  const createPattern = useCreateEffortPattern();
  const updatePattern = useUpdateEffortPattern();
  const deletePattern = useDeleteEffortPattern();
  const saveRoleMix = useSaveRoleMix();
  const deleteRoleMixMut = useDeleteRoleMix();
  const createSize = useCreateTshirtSize();
  const updateSize = useUpdateTshirtSize();
  const deleteSizeMut = useDeleteTshirtSize();

  // T-shirt Size modal
  const [sizeModal, setSizeModal] = useState(false);
  const [sizeForm, setSizeForm] = useState<TshirtSizeRequest>(emptySizeForm);
  const [sizeEditId, setSizeEditId] = useState<number | null>(null);

  // Effort Pattern modal
  const [patternModal, setPatternModal] = useState(false);
  const [patternForm, setPatternForm] = useState<EffortPatternRequest>(emptyPatternForm);
  const [patternEditId, setPatternEditId] = useState<number | null>(null);
  const [weightsText, setWeightsText] = useState('');

  // Role Mix modal
  const [roleMixModal, setRoleMixModal] = useState(false);
  const [roleMixForm, setRoleMixForm] = useState<RoleEffortMixRequest>({ role: 'DEVELOPER', mixPct: 0 });
  const [roleMixEditRole, setRoleMixEditRole] = useState<string | null>(null);

  // Delete confirmations
  const [deleteSizeId, setDeleteSizeId] = useState<number | null>(null);
  const [deletePatternId, setDeletePatternId] = useState<number | null>(null);
  const [deleteRoleMixRole, setDeleteRoleMixRole] = useState<string | null>(null);

  const isLoading = pLoading || rLoading || sLoading || podLoading;

  // T-shirt Size handlers
  const openCreateSize = () => {
    const nextOrder = (sizes ?? []).length > 0 ? Math.max(...(sizes ?? []).map(s => s.displayOrder)) + 1 : 1;
    setSizeForm({ name: '', baseHours: 0, displayOrder: nextOrder });
    setSizeEditId(null);
    setSizeModal(true);
  };

  const openEditSize = (s: { id: number; name: string; baseHours: number; displayOrder: number }) => {
    setSizeForm({ name: s.name, baseHours: s.baseHours, displayOrder: s.displayOrder });
    setSizeEditId(s.id);
    setSizeModal(true);
  };

  const getErrorMessage = (err: unknown, fallback: string) => {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr?.response?.data?.message || fallback;
  };

  const handleSizeSubmit = () => {
    if (sizeEditId) {
      updateSize.mutate({ id: sizeEditId, data: sizeForm }, {
        onSuccess: () => {
          setSizeModal(false);
          notifications.show({ title: 'Updated', message: 'T-shirt size updated', color: 'green' });
        },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update size'), color: 'red' }),
      });
    } else {
      createSize.mutate(sizeForm, {
        onSuccess: () => {
          setSizeModal(false);
          notifications.show({ title: 'Created', message: 'T-shirt size created', color: 'green' });
        },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create size'), color: 'red' }),
      });
    }
  };

  const handleDeleteSize = (id: number) => {
    deleteSizeMut.mutate(id, {
      onSuccess: () => {
        setDeleteSizeId(null);
        notifications.show({ title: 'Deleted', message: 'T-shirt size deleted', color: 'green' });
      },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete size'), color: 'red' }),
    });
  };

  // Pattern handlers
  const openCreatePattern = () => {
    setPatternForm(emptyPatternForm);
    setWeightsText('');
    setPatternEditId(null);
    setPatternModal(true);
  };

  const openEditPattern = (p: { id: number; name: string; description: string; weights: Record<string, number> }) => {
    setPatternForm({ name: p.name, description: p.description, weights: p.weights });
    setWeightsText(Object.entries(p.weights).map(([k, v]) => `${k}:${v}`).join(', '));
    setPatternEditId(p.id);
    setPatternModal(true);
  };

  const parseWeights = (text: string): Record<string, number> => {
    const weights: Record<string, number> = {};
    text.split(',').forEach(part => {
      const [k, v] = part.trim().split(':');
      if (k && v) weights[k.trim()] = Number(v.trim());
    });
    return weights;
  };

  const handlePatternSubmit = () => {
    const weights = parseWeights(weightsText);
    const data = { ...patternForm, weights };
    if (patternEditId) {
      updatePattern.mutate({ id: patternEditId, data }, {
        onSuccess: () => {
          setPatternModal(false);
          notifications.show({ title: 'Updated', message: 'Effort pattern updated', color: 'green' });
        },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update pattern'), color: 'red' }),
      });
    } else {
      createPattern.mutate(data, {
        onSuccess: () => {
          setPatternModal(false);
          notifications.show({ title: 'Created', message: 'Effort pattern created', color: 'green' });
        },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create pattern'), color: 'red' }),
      });
    }
  };

  const handleDeletePattern = (id: number) => {
    deletePattern.mutate(id, {
      onSuccess: () => {
        setDeletePatternId(null);
        notifications.show({ title: 'Deleted', message: 'Effort pattern deleted', color: 'green' });
      },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete pattern'), color: 'red' }),
    });
  };

  // Role Mix handlers
  const openCreateRoleMix = () => {
    const existingRoles = (roleMix ?? []).map(r => r.role);
    const available = ROLES.filter(r => !existingRoles.includes(r));
    setRoleMixForm({ role: available[0] ?? 'DEVELOPER', mixPct: 0 });
    setRoleMixEditRole(null);
    setRoleMixModal(true);
  };

  const openEditRoleMix = (r: { role: string; mixPct: number }) => {
    setRoleMixForm({ role: r.role, mixPct: r.mixPct });
    setRoleMixEditRole(r.role);
    setRoleMixModal(true);
  };

  const handleRoleMixSubmit = () => {
    saveRoleMix.mutate(roleMixForm, {
      onSuccess: () => {
        setRoleMixModal(false);
        notifications.show({ title: 'Saved', message: 'Role mix saved', color: 'green' });
      },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to save role mix'), color: 'red' }),
    });
  };

  const handleDeleteRoleMix = (role: string) => {
    deleteRoleMixMut.mutate(role, {
      onSuccess: () => {
        setDeleteRoleMixRole(null);
        notifications.show({ title: 'Deleted', message: 'Role mix deleted', color: 'green' });
      },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete role mix'), color: 'red' }),
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <Stack>
      <Title order={2}>Reference Data</Title>

      <Tabs defaultValue="sizes">
        <Tabs.List>
          <Tabs.Tab value="sizes">T-shirt Sizes</Tabs.Tab>
          <Tabs.Tab value="patterns">Effort Patterns</Tabs.Tab>
          <Tabs.Tab value="roleMix">Role Mix</Tabs.Tab>
          <Tabs.Tab value="complexity">Pod Complexity</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="sizes" pt="md">
          <Group justify="flex-end" mb="sm">
            <CsvToolbar
              data={sizes ?? []}
              columns={tshirtSizeColumns}
              filename="tshirt_sizes"
              onImport={(rows) => {
                rows.forEach(row => {
                  createSize.mutate({
                    name: row.name ?? '',
                    baseHours: Number(row.baseHours) || 0,
                    displayOrder: Number(row.displayOrder) || 0,
                  });
                });
              }}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateSize}>Add Size</Button>
          </Group>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Size</Table.Th>
                <Table.Th>Base Hours</Table.Th>
                <Table.Th>Display Order</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(sizes ?? []).map(s => (
                <Table.Tr key={s.id}>
                  <Table.Td fw={500}>{s.name}</Table.Td>
                  <Table.Td>{s.baseHours}</Table.Td>
                  <Table.Td>{s.displayOrder}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEditSize(s)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => setDeleteSizeId(s.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(sizes ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}><Text ta="center" c="dimmed">No data</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="patterns" pt="md">
          <Group justify="flex-end" mb="sm">
            <CsvToolbar
              data={patterns ?? []}
              columns={effortPatternColumns}
              filename="effort_patterns"
              onImport={(rows) => {
                rows.forEach(row => {
                  const weights: Record<string, number> = {};
                  (row.weights ?? '').split(',').forEach(part => {
                    const [k, v] = part.trim().split(':');
                    if (k && v) weights[k.trim()] = Number(v.trim());
                  });
                  createPattern.mutate({
                    name: row.name ?? '',
                    description: row.description ?? '',
                    weights,
                  });
                });
              }}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openCreatePattern}>Add Pattern</Button>
          </Group>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pattern Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Monthly Weights</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(patterns ?? []).map(p => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={500}>{p.name}</Table.Td>
                  <Table.Td>{p.description}</Table.Td>
                  <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {Object.entries(p.weights).map(([k, v]) => `${k}:${v}`).join(', ')}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEditPattern(p)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => setDeletePatternId(p.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(patterns ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}><Text ta="center" c="dimmed">No data</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="roleMix" pt="md">
          <Group justify="flex-end" mb="sm">
            <CsvToolbar
              data={roleMix ?? []}
              columns={roleMixColumns}
              filename="role_mix"
              onImport={(rows) => {
                rows.forEach(row => {
                  saveRoleMix.mutate({
                    role: row.role ?? 'DEVELOPER',
                    mixPct: Number(row.mixPct) || 0,
                  });
                });
              }}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateRoleMix}>Add Role</Button>
          </Group>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Role</Table.Th>
                <Table.Th>Mix %</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(roleMix ?? []).map(r => (
                <Table.Tr key={r.role}>
                  <Table.Td fw={500}>{formatRole(r.role)}</Table.Td>
                  <Table.Td>{r.mixPct}%</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEditRoleMix(r)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => setDeleteRoleMixRole(r.role)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(roleMix ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}><Text ta="center" c="dimmed">No data</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="complexity" pt="md">
          <Text size="sm" c="dimmed" mb="sm">
            Complexity multiplier applied to base hours when calculating demand for each pod.
            A value of 1.0 means no adjustment.
          </Text>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pod</Table.Th>
                <Table.Th style={{ width: 200 }}>Complexity Multiplier</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(pods ?? []).filter(p => p.active).map(p => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={500}>{p.name}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={p.complexityMultiplier}
                      min={0.1}
                      max={5}
                      step={0.05}
                      decimalScale={2}
                      style={{ width: 120 }}
                      onChange={(val) => {
                        if (val !== '' && val !== undefined) {
                          updatePod.mutate(
                            { id: p.id, data: { complexityMultiplier: Number(val) } },
                            {
                              onSuccess: () => notifications.show({ title: 'Updated', message: `${p.name} complexity updated`, color: 'green' }),
                              onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update'), color: 'red' }),
                            }
                          );
                        }
                      }}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
              {(pods ?? []).filter(p => p.active).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={2}><Text ta="center" c="dimmed">No pods</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>

      {/* T-shirt Size Modal */}
      <Modal opened={sizeModal} onClose={() => setSizeModal(false)}
        title={sizeEditId ? 'Edit T-shirt Size' : 'Add T-shirt Size'}>
        <Stack>
          <TextInput label="Name" required value={sizeForm.name}
            placeholder="e.g. XXL"
            onChange={e => setSizeForm(f => ({ ...f, name: e.target.value }))} />
          <NumberInput label="Base Hours" required value={sizeForm.baseHours}
            min={0}
            onChange={v => setSizeForm(f => ({ ...f, baseHours: Number(v) }))} />
          <NumberInput label="Display Order" required value={sizeForm.displayOrder}
            min={0}
            onChange={v => setSizeForm(f => ({ ...f, displayOrder: Number(v) }))} />
          <Button onClick={handleSizeSubmit}
            loading={createSize.isPending || updateSize.isPending}>
            {sizeEditId ? 'Update' : 'Create'}
          </Button>
        </Stack>
      </Modal>

      {/* Effort Pattern Modal */}
      <Modal opened={patternModal} onClose={() => setPatternModal(false)}
        title={patternEditId ? 'Edit Effort Pattern' : 'Add Effort Pattern'}>
        <Stack>
          <TextInput label="Name" required value={patternForm.name}
            onChange={e => setPatternForm(f => ({ ...f, name: e.target.value }))} />
          <TextInput label="Description" value={patternForm.description}
            onChange={e => setPatternForm(f => ({ ...f, description: e.target.value }))} />
          <TextInput label="Weights" required value={weightsText}
            placeholder="M1:10, M2:20, M3:30, ..."
            description="Comma-separated month:weight pairs"
            onChange={e => setWeightsText(e.target.value)} />
          <Button onClick={handlePatternSubmit}
            loading={createPattern.isPending || updatePattern.isPending}>
            {patternEditId ? 'Update' : 'Create'}
          </Button>
        </Stack>
      </Modal>

      {/* Role Mix Modal */}
      <Modal opened={roleMixModal} onClose={() => setRoleMixModal(false)}
        title={roleMixEditRole ? 'Edit Role Mix' : 'Add Role Mix'}>
        <Stack>
          <Select label="Role" required data={ROLES.map(r => ({ value: r, label: r }))}
            value={roleMixForm.role}
            disabled={!!roleMixEditRole}
            onChange={v => v && setRoleMixForm(f => ({ ...f, role: v }))} />
          <NumberInput label="Mix %" required value={roleMixForm.mixPct}
            min={0} max={100} decimalScale={2}
            onChange={v => setRoleMixForm(f => ({ ...f, mixPct: Number(v) }))} />
          <Button onClick={handleRoleMixSubmit} loading={saveRoleMix.isPending}>
            {roleMixEditRole ? 'Update' : 'Create'}
          </Button>
        </Stack>
      </Modal>

      {/* Delete Size Confirmation */}
      <Modal opened={deleteSizeId !== null} onClose={() => setDeleteSizeId(null)} title="Delete T-shirt Size">
        <Text>Are you sure you want to delete this T-shirt size?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteSizeId(null)}>Cancel</Button>
          <Button color="red" loading={deleteSizeMut.isPending}
            onClick={() => deleteSizeId && handleDeleteSize(deleteSizeId)}>
            Delete
          </Button>
        </Group>
      </Modal>

      {/* Delete Pattern Confirmation */}
      <Modal opened={deletePatternId !== null} onClose={() => setDeletePatternId(null)} title="Delete Effort Pattern">
        <Text>Are you sure you want to delete this effort pattern?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeletePatternId(null)}>Cancel</Button>
          <Button color="red" loading={deletePattern.isPending}
            onClick={() => deletePatternId && handleDeletePattern(deletePatternId)}>
            Delete
          </Button>
        </Group>
      </Modal>

      {/* Delete Role Mix Confirmation */}
      <Modal opened={deleteRoleMixRole !== null} onClose={() => setDeleteRoleMixRole(null)} title="Delete Role Mix">
        <Text>Are you sure you want to delete the mix for {deleteRoleMixRole}?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteRoleMixRole(null)}>Cancel</Button>
          <Button color="red" loading={deleteRoleMixMut.isPending}
            onClick={() => deleteRoleMixRole && handleDeleteRoleMix(deleteRoleMixRole)}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
