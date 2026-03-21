import { useState } from 'react';
import {
  Container, Title, Stack, Tabs, Table, Text, Button, Group, Modal,
  TextInput, NumberInput, ActionIcon, Select, Badge, SimpleGrid, Progress,
  Tooltip, Paper, ScrollArea, Box, ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconEdit, IconTrash, IconCurrencyDollar, IconRuler,
  IconChartBar, IconCheck,
} from '@tabler/icons-react';
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
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';

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
        onSuccess: () => { setSizeModal(false); notifications.show({ title: 'Updated', message: 'T-shirt size updated', color: 'teal', icon: <IconCheck size={16} /> }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update size'), color: 'red' }),
      });
    } else {
      createSize.mutate(sizeForm, {
        onSuccess: () => { setSizeModal(false); notifications.show({ title: 'Created', message: 'T-shirt size created', color: 'teal', icon: <IconCheck size={16} /> }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create size'), color: 'red' }),
      });
    }
  };

  const handleDeleteSize = (id: number) => {
    deleteSizeMut.mutate(id, {
      onSuccess: () => { setDeleteSizeId(null); notifications.show({ title: 'Deleted', message: 'T-shirt size deleted', color: 'gray' }); },
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
    const keys = Object.keys(p.weights).filter(k => /^M\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
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
        onSuccess: () => { setPatternModal(false); notifications.show({ title: 'Updated', message: 'Effort pattern updated', color: 'teal', icon: <IconCheck size={16} /> }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update pattern'), color: 'red' }),
      });
    } else {
      createPattern.mutate(data, {
        onSuccess: () => { setPatternModal(false); notifications.show({ title: 'Created', message: 'Effort pattern created', color: 'teal', icon: <IconCheck size={16} /> }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create pattern'), color: 'red' }),
      });
    }
  };

  const handleDeletePattern = (id: number) => {
    deletePattern.mutate(id, {
      onSuccess: () => { setDeletePatternId(null); notifications.show({ title: 'Deleted', message: 'Effort pattern deleted', color: 'gray' }); },
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
        onSuccess: () => { setCostRateModal(false); notifications.show({ title: 'Updated', message: 'Cost rate updated', color: 'teal', icon: <IconCheck size={16} /> }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to update cost rate'), color: 'red' }),
      });
    } else {
      createCostRate.mutate(costRateForm, {
        onSuccess: () => { setCostRateModal(false); notifications.show({ title: 'Created', message: 'Cost rate added', color: 'teal', icon: <IconCheck size={16} /> }); },
        onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to create cost rate'), color: 'red' }),
      });
    }
  };

  const handleDeleteCostRate = (id: number) => {
    deleteCostRate.mutate(id, {
      onSuccess: () => { setDeleteCostRateId(null); notifications.show({ title: 'Deleted', message: 'Cost rate deleted', color: 'gray' }); },
      onError: (err) => notifications.show({ title: 'Error', message: getErrorMessage(err, 'Failed to delete cost rate'), color: 'red' }),
    });
  };

  if (isLoading) return <LoadingSpinner variant="form" message="Loading reference data..." />;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE, fontWeight: 700 }}>
            Reference Data
          </Title>
          <Text size="sm" c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
            Manage T-shirt sizes, effort distribution patterns, and cost rates
          </Text>
        </div>
      </Group>

      {/* ── Summary Cards ── */}
      <SimpleGrid cols={{ base: 2, sm: 3 }} mb="lg">
        <Paper shadow="xs" radius="md" p="md" withBorder>
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" variant="light" style={{ color: DEEP_BLUE, backgroundColor: `${DEEP_BLUE}15` }}>
              <IconRuler size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>T-shirt Sizes</Text>
              <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{sizes?.length ?? 0}</Text>
            </div>
          </Group>
        </Paper>
        <Paper shadow="xs" radius="md" p="md" withBorder>
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" variant="light" style={{ color: AQUA, backgroundColor: `${AQUA}15` }}>
              <IconChartBar size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Effort Patterns</Text>
              <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: AQUA }}>{patterns?.length ?? 0}</Text>
            </div>
          </Group>
        </Paper>
        <Paper shadow="xs" radius="md" p="md" withBorder>
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={36} radius="md" variant="light" style={{ color: '#2b8a3e', backgroundColor: '#2b8a3e15' }}>
              <IconCurrencyDollar size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Cost Rates</Text>
              <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: '#2b8a3e' }}>{costRates?.length ?? 0}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Tabs defaultValue="sizes" variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="sizes" leftSection={<IconRuler size={14} />} style={{ fontFamily: FONT_FAMILY }}>
            T-shirt Sizes ({sizes?.length ?? 0})
          </Tabs.Tab>
          <Tabs.Tab value="patterns" leftSection={<IconChartBar size={14} />} style={{ fontFamily: FONT_FAMILY }}>
            Effort Patterns ({patterns?.length ?? 0})
          </Tabs.Tab>
          <Tabs.Tab value="costRates" leftSection={<IconCurrencyDollar size={14} />} style={{ fontFamily: FONT_FAMILY }}>
            Cost Rates ({costRates?.length ?? 0})
          </Tabs.Tab>
        </Tabs.List>

        {/* ── T-shirt Sizes ── */}
        <Tabs.Panel value="sizes">
          <Paper shadow="xs" radius="md" withBorder>
            <Group justify="flex-end" p="sm" style={{ borderBottom: '1px solid #e9ecef' }}>
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
              <Button leftSection={<IconPlus size={14} />} size="xs" onClick={openCreateSize}
                style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                Add Size
              </Button>
            </Group>
            <ScrollArea h={420}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Size</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Base Hours</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Display Order</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, width: 80 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(sizes ?? []).map(s => (
                    <Table.Tr key={s.id}>
                      <Table.Td>
                        <Badge size="sm" variant="light" color={DEEP_BLUE} style={{ fontFamily: FONT_FAMILY }}>{s.name}</Badge>
                      </Table.Td>
                      <Table.Td><Text size="sm" style={{ fontFamily: FONT_FAMILY }}>{s.baseHours}</Text></Table.Td>
                      <Table.Td><Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{s.displayOrder}</Text></Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Edit">
                            <ActionIcon variant="subtle" color="blue" size="xs" onClick={() => openEditSize(s)}>
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon variant="subtle" color="red" size="xs" onClick={() => setDeleteSizeId(s.id)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {(sizes ?? []).length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Box p="xl" ta="center">
                          <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>No T-shirt sizes configured yet.</Text>
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Tabs.Panel>

        {/* ── Effort Patterns ── */}
        <Tabs.Panel value="patterns">
          <Paper shadow="xs" radius="md" withBorder>
            <Group justify="flex-end" p="sm" style={{ borderBottom: '1px solid #e9ecef' }}>
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
              <Button leftSection={<IconPlus size={14} />} size="xs" onClick={openCreatePattern}
                style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                Add Pattern
              </Button>
            </Group>
            <ScrollArea h={420}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Pattern Name</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Description</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Monthly Weights</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, width: 80 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(patterns ?? []).map(p => (
                    <Table.Tr key={p.id}>
                      <Table.Td>
                        <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY }}>{p.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={2} style={{ fontFamily: FONT_FAMILY }}>{p.description}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="wrap">
                          {Object.entries(p.weights).map(([k, v]) => (
                            <Badge key={k} size="xs" variant="outline" color="gray" style={{ fontFamily: FONT_FAMILY }}>
                              {k}: {v}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="Edit">
                            <ActionIcon variant="subtle" color="blue" size="xs" onClick={() => openEditPattern(p)}>
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon variant="subtle" color="red" size="xs" onClick={() => setDeletePatternId(p.id)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {(patterns ?? []).length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Box p="xl" ta="center">
                          <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>No effort patterns configured yet.</Text>
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Tabs.Panel>

        {/* ── Cost Rates ── */}
        <Tabs.Panel value="costRates">
          <Paper shadow="xs" radius="md" withBorder>
            <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e9ecef' }}>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                Hourly rate per role and location — used by Budget &amp; Cost Tracker for planned spend.
              </Text>
              <Button leftSection={<IconPlus size={14} />} size="xs" onClick={openCreateCostRate}
                style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
                Add Rate
              </Button>
            </Group>
            <ScrollArea h={420}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Role</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY }}>Location</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, textAlign: 'right' }}>Hourly Rate (USD)</Table.Th>
                    <Table.Th style={{ fontFamily: FONT_FAMILY, width: 80 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(costRates ?? [])
                    .slice()
                    .sort((a, b) => a.role.localeCompare(b.role) || a.location.localeCompare(b.location))
                    .map(r => (
                      <Table.Tr key={r.id}>
                        <Table.Td>
                          <Badge variant="light" color="blue" size="sm" style={{ fontFamily: FONT_FAMILY }}>
                            {r.role.replace(/_/g, ' ')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={r.location === 'US' ? 'green' : 'orange'} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                            {LOCATION_LABELS[r.location] ?? r.location}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} style={{ fontFamily: FONT_FAMILY, fontVariantNumeric: 'tabular-nums' }}>
                            ${Number(r.hourlyRate).toFixed(2)}/hr
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Tooltip label="Edit">
                              <ActionIcon variant="subtle" color="blue" size="xs" onClick={() => openEditCostRate(r)}>
                                <IconEdit size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon variant="subtle" color="red" size="xs" onClick={() => setDeleteCostRateId(r.id)}>
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  {(costRates ?? []).length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Box p="xl" ta="center">
                          <Text c="dimmed" size="sm" style={{ fontFamily: FONT_FAMILY }}>
                            No cost rates yet — add a rate for each role + location combination.
                          </Text>
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* ── Modals ───────────────────────────────────────────────────────────────── */}

      <Modal opened={sizeModal} onClose={() => setSizeModal(false)} centered
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{sizeEditId ? 'Edit T-shirt Size' : 'Add T-shirt Size'}</Text>}>
        <Stack gap="sm">
          <TextInput label="Name" required value={sizeForm.name} placeholder="e.g. XXL"
            onChange={e => setSizeForm(f => ({ ...f, name: e.target.value }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }} />
          <NumberInput label="Base Hours" required value={sizeForm.baseHours} min={0}
            onChange={v => setSizeForm(f => ({ ...f, baseHours: Number(v) }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }} />
          <NumberInput label="Display Order" required value={sizeForm.displayOrder} min={0}
            onChange={v => setSizeForm(f => ({ ...f, displayOrder: Number(v) }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => setSizeModal(false)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
            <Button onClick={handleSizeSubmit} loading={createSize.isPending || updateSize.isPending}
              style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              {sizeEditId ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={patternModal} onClose={() => setPatternModal(false)} size="lg" centered
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{patternEditId ? 'Edit Effort Pattern' : 'Add Effort Pattern'}</Text>}>
        <Stack gap="sm">
          <TextInput label="Name" required value={patternForm.name}
            onChange={e => setPatternForm(f => ({ ...f, name: e.target.value }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }} />
          <TextInput label="Description" value={patternForm.description}
            onChange={e => setPatternForm(f => ({ ...f, description: e.target.value }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }} />
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
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
          />
          <div>
            <Text size="sm" fw={500} mb={6} style={{ fontFamily: FONT_FAMILY }}>Monthly Weights</Text>
            <Text size="xs" c="dimmed" mb={8} style={{ fontFamily: FONT_FAMILY }}>Enter the relative effort weight per month.</Text>
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
                  styles={{ label: { fontFamily: FONT_FAMILY, fontSize: 11 }, input: { fontFamily: FONT_FAMILY } }}
                />
              ))}
            </SimpleGrid>
          </div>
          {/* Visual weight distribution */}
          {(() => {
            const entries = Array.from({ length: monthCount }, (_, i) => [`M${i + 1}`, monthWeights[`M${i + 1}`] ?? 0] as [string, number]);
            const total = entries.reduce((s, [, v]) => s + v, 0);
            const BAR_COLORS = ['#339af0', '#51cf66', '#ff6b6b', '#ffd43b', '#845ef7', '#ff922b', '#20c997', '#74c0fc', '#a9e34b', '#f783ac', '#4dabf7', '#69db7c'];
            if (total === 0) return null;
            return (
              <div>
                <Text size="xs" c="dimmed" mb={4} style={{ fontFamily: FONT_FAMILY }}>Weight distribution</Text>
                <Progress.Root size={20} radius="sm">
                  {entries.map(([key, val], i) => (
                    <Tooltip key={key} label={`${key}: ${val} (${((val / total) * 100).toFixed(0)}%)`}>
                      <Progress.Section value={(val / total) * 100} color={BAR_COLORS[i % BAR_COLORS.length]}>
                        <Progress.Label style={{ fontSize: 10, fontFamily: FONT_FAMILY }}>{key}</Progress.Label>
                      </Progress.Section>
                    </Tooltip>
                  ))}
                </Progress.Root>
              </div>
            );
          })()}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => setPatternModal(false)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
            <Button onClick={handlePatternSubmit} loading={createPattern.isPending || updatePattern.isPending}
              style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              {patternEditId ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={costRateModal} onClose={() => setCostRateModal(false)} centered
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>{costRateEditId ? 'Edit Cost Rate' : 'Add Cost Rate'}</Text>}>
        <Stack gap="sm">
          <Select
            label="Role" required
            data={ROLES.map(r => ({ value: r, label: r.replace(/_/g, ' ') }))}
            value={costRateForm.role}
            disabled={!!costRateEditId}
            onChange={v => v && setCostRateForm(f => ({ ...f, role: v }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
          />
          <Select
            label="Location" required
            data={LOCATIONS.map(l => ({ value: l, label: LOCATION_LABELS[l] ?? l }))}
            value={costRateForm.location}
            disabled={!!costRateEditId}
            onChange={v => v && setCostRateForm(f => ({ ...f, location: v }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
          />
          <NumberInput
            label="Hourly Rate (USD)" required
            value={costRateForm.hourlyRate}
            min={0} step={5} decimalScale={2} prefix="$"
            placeholder="e.g. 150.00"
            onChange={v => setCostRateForm(f => ({ ...f, hourlyRate: Number(v) }))}
            styles={{ label: { fontFamily: FONT_FAMILY }, input: { fontFamily: FONT_FAMILY } }}
          />
          {!costRateEditId && (
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>One rate per role + location. Each combination can only appear once.</Text>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => setCostRateModal(false)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
            <Button onClick={handleCostRateSubmit} loading={createCostRate.isPending || updateCostRate.isPending}
              style={{ backgroundColor: DEEP_BLUE, fontFamily: FONT_FAMILY }}>
              {costRateEditId ? 'Update Rate' : 'Add Rate'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirmations */}
      <Modal opened={deleteSizeId !== null} onClose={() => setDeleteSizeId(null)} centered
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: '#c92a2a' }}>Delete T-shirt Size</Text>} size="sm">
        <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Are you sure you want to delete this T-shirt size?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteSizeId(null)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
          <Button color="red" loading={deleteSizeMut.isPending} onClick={() => deleteSizeId && handleDeleteSize(deleteSizeId)}
            style={{ fontFamily: FONT_FAMILY }}>Delete</Button>
        </Group>
      </Modal>

      <Modal opened={deletePatternId !== null} onClose={() => setDeletePatternId(null)} centered
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: '#c92a2a' }}>Delete Effort Pattern</Text>} size="sm">
        <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Are you sure you want to delete this effort pattern?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeletePatternId(null)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
          <Button color="red" loading={deletePattern.isPending} onClick={() => deletePatternId && handleDeletePattern(deletePatternId)}
            style={{ fontFamily: FONT_FAMILY }}>Delete</Button>
        </Group>
      </Modal>

      <Modal opened={deleteCostRateId !== null} onClose={() => setDeleteCostRateId(null)} centered
        title={<Text fw={600} style={{ fontFamily: FONT_FAMILY, color: '#c92a2a' }}>Delete Cost Rate</Text>} size="sm">
        <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Are you sure you want to delete this cost rate?</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setDeleteCostRateId(null)} style={{ fontFamily: FONT_FAMILY }}>Cancel</Button>
          <Button color="red" loading={deleteCostRate.isPending} onClick={() => deleteCostRateId && handleDeleteCostRate(deleteCostRateId)}
            style={{ fontFamily: FONT_FAMILY }}>Delete</Button>
        </Group>
      </Modal>
    </Container>
  );
}
