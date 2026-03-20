import { useState } from 'react';
import {
  Title, Stack, Tabs, Table, Text, Button, Group, Modal,
  TextInput, NumberInput, ActionIcon, Select, Badge, SimpleGrid, Progress, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrash, IconCurrencyDollar } from '@tabler/icons-react';
import {
  useEffortPatterns, useCreateEffortPattern, useUpdateEffortPattern, useDeleteEffortPattern,
  useTshirtSizes, useCreateTshirtSize, useUpdateTshirtSize, useDeleteTshirtSize,
} from '../../api/refData';
import type { EffortPatternRequest, TshirtSizeRequest } from '../../api/refData';
import {
  useCostRates, useCreateCostRate, useUpdateCostRate, useDeleteCostRate,
} from '../../api/resources';
import type { CostRateRequest } from '../../api/resources';
import { usePods, useUpdatePod } from '../../api/pods';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import CsvToolbar from '../../components/common/CsvToolbar';
import { tshirtSizeColumns, effortPatternColumns } from '../../utils/csvColumns';

const ROLES = ['DEVELOPER', 'QA', 'BSA', 'TECH_LEAD'];
const LOCATIONS = ['US', 'INDIA'];

const emptyPatternForm: EffortPatternRequest = { name: '', description: '', weights: {} };
const emptySizeForm: TshirtSizeRequest = { name: '', baseHours: 0, displayOrder: 0 };
const emptyCostRateForm: CostRateRequest = { role: 'DEVELOPER', location: 'US', hourlyRate: 0 };

const LOCATION_LABELS: Record<string, string> = { US: 'US', INDIA: 'India' };

export default function RefDataSettingsPage() {
  const { data: patterns, isLoading: pLoading } = useEffortPatterns();
  const { data: sizes, isLoading: sLoading } = useTshirtSizes();
  const { data: pods, isLoading: podLoading } = usePods();
  const { data: costRates, isLoading: crLoading } = useCostRates();
  const updatePod = useUpdatePod();

  const createPattern = useCreateEffortPattern();
  const updatePattern = useUpdateEffortPattern();
  const deletePattern = useDeleteEffortPattern();
  const createSize = useCreateTshirtSize();
  const updateSize = useUpdateTshirtSize();
  const deleteSizeMut = useDeleteTshirtSize();
  const createCostRate = useCreateCostRate();
  const updateCostRate = useUpdateCostRate();
  const deleteCostRate = useDeleteCostRate();

  // T-shirt Size modal
  const [sizeModal, setSizeModal] = useState(false);
  const [sizeForm, setSizeForm] = useState<TshirtSizeRequest>(emptySizeForm);
  const [sizeEditId, setSizeEditId] = useState<number | null>(null);

  // Effort Pattern modal
  const [patternModal, setPatternModal] = useState(false);
  const [patternForm, setPatternForm] = useState<EffortPatternRequest>(emptyPatternForm);
  const [patternEditId, setPatternEditId] = useState<number | null>(null);
  const [monthCount, setMonthCount] = useState(3);
  const [monthWeights, setMonthWeights] = useState<Record<string, number>>({});

  // Cost Rate modal
  const [costRateModal, setCostRateModal] = useState(false);
  const [costRateForm, setCostRateForm] = useState<CostRateRequest>(emptyCostRateForm);
  const [costRateEditId, setCostRateEditId] = useState<number | null>(null);

  // Delete confirmations
  const [deleteSizeId, setDeleteSizeId] = useState<number | null>(null);
  const [deletePatternId, setDeletePatternId] = useState<number | null>(null);
  const [deleteCostRateId, setDeleteCostRateId] = useState<number | null>(null);

  const isLoading = pLoading || sLoading || podLoading || crLoading;

  const getErrorMessage = (err: unknown, fallback: string) => {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr?.response?.data?.message || fallback;
  };

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

  const handleSizeSubmit = () => {
    if (sizeEditId) {
      updateSize.mutate({ id: sizeEditId, data: sizeForm }, {
        onSuccess: () => { setSizeModal(false); notifications.show({ title: 'Updated', message: 'T-shirt size updated', color: 'green' }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update size'), color: 'red' }),
      });
    } else {
      createSize.mutate(sizeForm, {
        onSuccess: () => { setSizeModal(false); notifications.show({ title: 'Created', message: 'T-shirt size created', color: 'green' }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create size'), color: 'red' }),
      });
    }
  };

  const handleDeleteSize = (id: number) => {
    deleteSizeMut.mutate(id, {
      onSuccess: () => { setDeleteSizeId(null); notifications.show({ title: 'Deleted', message: 'T-shirt size deleted', color: 'green' }); },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete size'), color: 'red' }),
    });
  };

  // Pattern handlers
  const openCreatePattern = () => {
    setPatternForm(emptyPatternForm);
    setMonthCount(3);
    setMonthWeights({ M1: 0, M2: 0, M3: 0 });
    setPatternEditId(null);
    setPatternModal(true);
  };

  const openEditPattern = (p: { id: number; name: string; description: string; weights: Record<string, number> }) => {
    const keys = Object.keys(p.weights).filter(k => /^M\d+$/.test(k)).sort((a,b) => Number(a.slice(1)) - Number(b.slice(1)));
    const count = keys.length || 3;
    setPatternForm({ name: p.name, description: p.description, weights: p.weights });
    setMonthCount(count);
    setMonthWeights(p.weights);
    setPatternEditId(p.id);
    setPatternModal(true);
  };

  const buildWeights = (): Record<string, number> => {
    const weights: Record<string, number> = {};
    for (let i = 1; i <= monthCount; i++) {
      weights[`M${i}`] = monthWeights[`M${i}`] ?? 0;
    }
    return weights;
  };

  const handlePatternSubmit = () => {
    const data = { ...patternForm, weights: buildWeights() };
    if (patternEditId) {
      updatePattern.mutate({ id: patternEditId, data }, {
        onSuccess: () => { setPatternModal(false); notifications.show({ title: 'Updated', message: 'Effort pattern updated', color: 'green' }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update pattern'), color: 'red' }),
      });
    } else {
      createPattern.mutate(data, {
        onSuccess: () => { setPatternModal(false); notifications.show({ title: 'Created', message: 'Effort pattern created', color: 'green' }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create pattern'), color: 'red' }),
      });
    }
  };

  const handleDeletePattern = (id: number) => {
    deletePattern.mutate(id, {
      onSuccess: () => { setDeletePatternId(null); notifications.show({ title: 'Deleted', message: 'Effort pattern deleted', color: 'green' }); },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete pattern'), color: 'red' }),
    });
  };

  // Cost Rate handlers
  const openCreateCostRate = () => { setCostRateForm(emptyCostRateForm); setCostRateEditId(null); setCostRateModal(true); };

  const openEditCostRate = (r: { id: number; role: string; location: string; hourlyRate: number }) => {
    setCostRateForm({ role: r.role, location: r.location, hourlyRate: r.hourlyRate });
    setCostRateEditId(r.id);
    setCostRateModal(true);
  };

  const handleCostRateSubmit = () => {
    if (costRateEditId) {
      updateCostRate.mutate({ id: costRateEditId, data: costRateForm }, {
        onSuccess: () => { setCostRateModal(false); notifications.show({ title: 'Updated', message: 'Cost rate updated', color: 'green' }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update cost rate'), color: 'red' }),
      });
    } else {
      createCostRate.mutate(costRateForm, {
        onSuccess: () => { setCostRateModal(false); notifications.show({ title: 'Created', message: 'Cost rate added', color: 'green' }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create cost rate'), color: 'red' }),
      });
    }
  };

  const handleDeleteCostRate = (id: number) => {
    deleteCostRate.mutate(id, {
      onSuccess: () => { setDeleteCostRateId(null); notifications.show({ title: 'Deleted', message: 'Cost rate deleted', color: 'green' }); },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete cost rate'), color: 'red' }),
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
          <Tabs.Tab value="costRates" leftSection={<IconCurrencyDollar size={14} />}>Cost Rates</Tabs.Tab>
        </Tabs.List>

        {/* T-shirt Sizes */}
        <Tabs.Panel value="sizes" pt="md">
          <Group justify="flex-end" mb="sm">
            <CsvToolbar
              data={sizes ?? []}
              columns={tshirtSizeColumns}
              filename="tshirt_sizes"
              onImport={(rows) => {
                rows.forEach(row => {
                  createSize.mutate({ name: row.name ?? '', baseHours: Number(row.baseHours) || 0, displayOrder: Number(row.displayOrder) || 0 });
                });
              }}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateSize}>Add Size</Button>
          </Group>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Size</Table.Th><Table.Th>Base Hours</Table.Th>
                <Table.Th>Display Order</Table.Th><Table.Th style={{ width: 80 }}>Actions</Table.Th>
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
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEditSize(s)}><IconEdit size={16} /></ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => setDeleteSizeId(s.id)}><IconTrash size={16} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(sizes ?? []).length === 0 && (
                <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed">No data</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        {/* Effort Patterns */}
        <Tabs.Panel value="patterns" pt="md">
          <Group justify="flex-end" mb="sm">
            <CsvToolbar
              data={patterns ?? []}
              columns={effortPatternColumns}
              filename="effort_patterns"
              onImport={(rows) => {
                rows.forEach(row => {
                  const weights: Record<string, number> = {};
                  (row.weights ?? '').split(',').forEach(part => { const [k, v] = part.trim().split(':'); if (k && v) weights[k.trim()] = Number(v.trim()); });
                  createPattern.mutate({ name: row.name ?? '', description: row.description ?? '', weights });
                });
              }}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openCreatePattern}>Add Pattern</Button>
          </Group>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pattern Name</Table.Th><Table.Th>Description</Table.Th>
                <Table.Th>Monthly Weights</Table.Th><Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(patterns ?? []).map(p => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={500}>{p.name}</Table.Td>
                  <Table.Td>{p.description}</Table.Td>
                  <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{Object.entries(p.weights).map(([k, v]) => `${k}:${v}`).join(', ')}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEditPattern(p)}><IconEdit size={16} /></ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => setDeletePatternId(p.id)}><IconTrash size={16} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(patterns ?? []).length === 0 && (
                <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed">No data</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        {/* Cost Rates */}
        <Tabs.Panel value="costRates" pt="md">
          <Text size="sm" c="dimmed" mb="sm">
            Hourly rate per role and location. Used by the Budget &amp; Cost Tracker to calculate planned spend
            from resource allocations. One rate per role + location combination.
          </Text>
          <Group justify="flex-end" mb="sm">
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateCostRate}>Add Rate</Button>
          </Group>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Role</Table.Th>
                <Table.Th>Location</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Hourly Rate (USD)</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(costRates ?? [])
                .slice()
                .sort((a, b) => a.role.localeCompare(b.role) || a.location.localeCompare(b.location))
                .map(r => (
                  <Table.Tr key={r.id}>
                    <Table.Td fw={500}>
                      <Badge variant="light" color="blue" size="sm">{r.role.replace(/_/g, ' ')}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={r.location === 'US' ? 'green' : 'orange'} size="sm">
                        {LOCATION_LABELS[r.location] ?? r.location}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      ${Number(r.hourlyRate).toFixed(2)}/hr
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon variant="subtle" color="blue" onClick={() => openEditCostRate(r)}><IconEdit size={16} /></ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => setDeleteCostRateId(r.id)}><IconTrash size={16} /></ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              {(costRates ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text ta="center" c="dimmed" size="sm">
                      No cost rates yet — add a rate for each role + location combination.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

      </Tabs>

      {/* ── Modals ───────────────────────────────────────────────────────────────── */}

      <Modal opened={sizeModal} onClose={() => setSizeModal(false)} title={sizeEditId ? 'Edit T-shirt Size' : 'Add T-shirt Size'}>
        <Stack>
          <TextInput label="Name" required value={sizeForm.name} placeholder="e.g. XXL"
            onChange={e => setSizeForm(f => ({ ...f, name: e.target.value }))} />
          <NumberInput label="Base Hours" required value={sizeForm.baseHours} min={0}
            onChange={v => setSizeForm(f => ({ ...f, baseHours: Number(v) }))} />
          <NumberInput label="Display Order" required value={sizeForm.displayOrder} min={0}
            onChange={v => setSizeForm(f => ({ ...f, displayOrder: Number(v) }))} />
          <Button onClick={handleSizeSubmit} loading={createSize.isPending || updateSize.isPending}>
            {sizeEditId ? 'Update' : 'Create'}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={patternModal} onClose={() => setPatternModal(false)} title={patternEditId ? 'Edit Effort Pattern' : 'Add Effort Pattern'} size="lg">
        <Stack>
          <TextInput label="Name" required value={patternForm.name} onChange={e => setPatternForm(f => ({ ...f, name: e.target.value }))} />
          <TextInput label="Description" value={patternForm.description} onChange={e => setPatternForm(f => ({ ...f, description: e.target.value }))} />
          <NumberInput
            label="Number of months"
            description="How many months this effort pattern spans"
            value={monthCount} min={1} max={18}
            onChange={v => {
              const n = Number(v) || 1;
              setMonthCount(n);
              setMonthWeights(prev => {
                const next: Record<string, number> = {};
                for (let i = 1; i <= n; i++) next[`M${i}`] = prev[`M${i}`] ?? 0;
                return next;
              });
            }}
          />
          <div>
            <Text size="sm" fw={500} mb={6}>Monthly Weights</Text>
            <Text size="xs" c="dimmed" mb={8}>Enter the relative effort weight per month (any scale — they'll be shown as proportions).</Text>
            <SimpleGrid cols={6} spacing="xs">
              {Array.from({ length: monthCount }, (_, i) => `M${i + 1}`).map(key => (
                <NumberInput
                  key={key}
                  label={key}
                  size="xs"
                  value={monthWeights[key] ?? 0}
                  min={0}
                  decimalScale={1}
                  onChange={v => setMonthWeights(prev => ({ ...prev, [key]: Number(v) || 0 }))}
                />
              ))}
            </SimpleGrid>
          </div>
          {/* Visual weight distribution */}
          {(() => {
            const entries = Array.from({ length: monthCount }, (_, i) => [`M${i + 1}`, monthWeights[`M${i + 1}`] ?? 0] as [string, number]);
            const total = entries.reduce((s, [, v]) => s + v, 0);
            const BAR_COLORS = ['#339af0','#51cf66','#ff6b6b','#ffd43b','#845ef7','#ff922b','#20c997','#74c0fc','#a9e34b','#f783ac','#4dabf7','#69db7c'];
            if (total === 0) return null;
            return (
              <div>
                <Text size="xs" c="dimmed" mb={4}>Weight distribution</Text>
                <Progress.Root size={20} radius="sm">
                  {entries.map(([key, val], i) => (
                    <Tooltip key={key} label={`${key}: ${val} (${((val/total)*100).toFixed(0)}%)`}>
                      <Progress.Section value={(val / total) * 100} color={BAR_COLORS[i % BAR_COLORS.length]}>
                        <Progress.Label style={{ fontSize: 10 }}>{key}</Progress.Label>
                      </Progress.Section>
                    </Tooltip>
                  ))}
                </Progress.Root>
              </div>
            );
          })()}
          <Button onClick={handlePatternSubmit} loading={createPattern.isPending || updatePattern.isPending}>
            {patternEditId ? 'Update' : 'Create'}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={costRateModal} onClose={() => setCostRateModal(false)} title={costRateEditId ? 'Edit Cost Rate' : 'Add Cost Rate'}>
        <Stack>
          <Select
            label="Role" required
            data={ROLES.map(r => ({ value: r, label: r.replace(/_/g, ' ') }))}
            value={costRateForm.role}
            disabled={!!costRateEditId}
            onChange={v => v && setCostRateForm(f => ({ ...f, role: v }))}
          />
          <Select
            label="Location" required
            data={LOCATIONS.map(l => ({ value: l, label: LOCATION_LABELS[l] ?? l }))}
            value={costRateForm.location}
            disabled={!!costRateEditId}
            onChange={v => v && setCostRateForm(f => ({ ...f, location: v }))}
          />
          <NumberInput
            label="Hourly Rate (USD)" required
            value={costRateForm.hourlyRate}
            min={0} step={5} decimalScale={2} prefix="$"
            placeholder="e.g. 150.00"
            onChange={v => setCostRateForm(f => ({ ...f, hourlyRate: Number(v) }))}
          />
          {!costRateEditId && (
            <Text size="xs" c="dimmed">One rate per role + location. Each combination can only appear once.</Text>
          )}
          <Button onClick={handleCostRateSubmit} loading={createCostRate.isPending || updateCostRate.isPending}>
            {costRateEditId ? 'Update Rate' : 'Add Rate'}
          </Button>
        </Stack>
      </Modal>

      {/* Delete confirmations */}
      <Modal opened={deleteSizeId !== null} onClose={() => setDeleteSizeId(null)} title="Delete T-shirt Size">
        <Text>Are you sure you want to delete this T-shirt size?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteSizeId(null)}>Cancel</Button>
          <Button color="red" loading={deleteSizeMut.isPending} onClick={() => deleteSizeId && handleDeleteSize(deleteSizeId)}>Delete</Button>
        </Group>
      </Modal>

      <Modal opened={deletePatternId !== null} onClose={() => setDeletePatternId(null)} title="Delete Effort Pattern">
        <Text>Are you sure you want to delete this effort pattern?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeletePatternId(null)}>Cancel</Button>
          <Button color="red" loading={deletePattern.isPending} onClick={() => deletePatternId && handleDeletePattern(deletePatternId)}>Delete</Button>
        </Group>
      </Modal>

      <Modal opened={deleteCostRateId !== null} onClose={() => setDeleteCostRateId(null)} title="Delete Cost Rate">
        <Text>Are you sure you want to delete this cost rate?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleteCostRateId(null)}>Cancel</Button>
          <Button color="red" loading={deleteCostRate.isPending} onClick={() => deleteCostRateId && handleDeleteCostRate(deleteCostRateId)}>Delete</Button>
        </Group>
      </Modal>
    </Stack>
  );
}
