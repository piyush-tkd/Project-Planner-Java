/**
 * CostRatesPage — UI-only mockup for defining per-role cost rates used in
 * project budget calculations.
 *
 * Feature scope (mockup):
 *   • Rate Cards: named sets of hourly / daily / monthly rates per role
 *   • Role Rates table within each card with inline editing
 *   • Currency selector (USD, EUR, GBP, AUD, CAD)
 *   • Effective Date per rate card
 *   • "Default" card toggle (only one active at a time)
 *   • Cost modelling panel: estimate total project cost from hours + rate card
 *
 * All data is local state — no backend calls in this mockup.
 */

import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Button, Badge, Paper, Stack, Divider,
  TextInput, NumberInput, Select, ActionIcon, Tooltip, Modal,
  Table, ScrollArea, SimpleGrid, SegmentedControl,
  ThemeIcon, Tabs, Skeleton, Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCurrencyDollar, IconPlus, IconTrash, IconPencil,
  IconCopy, IconStar, IconStarFilled, IconCalculator, IconDownload,
  IconBuildingBank, IconAlertCircle, IconRefresh,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AQUA, DEEP_BLUE } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import {
  InlineTextCell, InlineNumberCell, InlineSelectCell,
} from '../../components/common/InlineCell';
import apiClient from '../../api/client';

// ─── Backend types ─────────────────────────────────────────────────────────────
interface CostRateEntry { id: number; role: string; location: string; hourlyRate: number; }
type NewCostRate = Omit<CostRateEntry, 'id'>;

// ─── LiveRatesPanel — connected to /api/cost-rates ────────────────────────────
function LiveRatesPanel() {
  const qc = useQueryClient();
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [form, setForm] = useState<NewCostRate>({ role: '', location: 'NORTH_AMERICA', hourlyRate: 80 });
  const [editId, setEditId] = useState<number | null>(null);

  const { data: rates = [], isLoading, isError, refetch } = useQuery<CostRateEntry[]>({
    queryKey: ['cost-rates'],
    queryFn: () => apiClient.get('/cost-rates').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: number; body: NewCostRate }) =>
      payload.id
        ? apiClient.put(`/cost-rates/${payload.id}`, payload.body).then(r => r.data)
        : apiClient.post('/cost-rates', payload.body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cost-rates'] }); closeAdd(); setEditId(null); setForm({ role: '', location: 'NORTH_AMERICA', hourlyRate: 80 }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/cost-rates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cost-rates'] }); notifications.show({ message: 'Rate deleted', color: 'teal' }); },
  });

  const startEdit = (r: CostRateEntry) => {
    setEditId(r.id);
    setForm({ role: r.role, location: r.location, hourlyRate: r.hourlyRate });
    openAdd();
  };

  return (
    <Paper withBorder p="lg" radius="md" mb="xl">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon size={28} radius="sm" color="blue" variant="light">
            <IconBuildingBank size={15} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="sm">Live Cost Rates</Text>
            <Text size="xs" c="dimmed">Connected to backend — source of truth for budget calculations</Text>
          </Box>
        </Group>
        <Group gap="xs">
          <Badge size="sm" color="teal" variant="light">● Live</Badge>
          <ActionIcon size="sm" variant="subtle" onClick={() => refetch()}
      aria-label="Refresh"
    ><IconRefresh size={14} /></ActionIcon>
          <Button size="xs" leftSection={<IconPlus size={13} />} onClick={() => { setEditId(null); setForm({ role: '', location: 'NORTH_AMERICA', hourlyRate: 80 }); openAdd(); }}>
            Add Rate
          </Button>
        </Group>
      </Group>

      {isError && <Alert icon={<IconAlertCircle size={14} />} color="red" mb="sm">Failed to load rates from backend</Alert>}

      {isLoading ? (
        <Stack gap="xs">{[1,2,3,4].map(i => <Skeleton key={i} height={36} radius="sm" />)}</Stack>
      ) : rates.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">No rates defined yet. Click "Add Rate" to create the first one.</Text>
      ) : (
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Hourly Rate</Table.Th>
              <Table.Th w={80} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rates.map(r => (
              <Table.Tr key={r.id}>
                <Table.Td><Text size="sm">{r.role}</Text></Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{r.location?.replace(/_/g, ' ')}</Text></Table.Td>
                <Table.Td><Text size="sm" fw={600}>${Number(r.hourlyRate).toFixed(2)}/hr</Text></Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon size="xs" variant="subtle" onClick={() => startEdit(r)}
      aria-label="Edit"
    ><IconPencil size={12} /></ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="red" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(r.id)}
      aria-label="Delete"
    ><IconTrash size={12} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={addOpen} onClose={() => { closeAdd(); setEditId(null); }} title={editId ? 'Edit Cost Rate' : 'Add Cost Rate'} size="sm">
        <Stack gap="sm">
          <TextInput label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. SOFTWARE_ENGINEER" required />
          <TextInput label="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. NORTH_AMERICA" required />
          <NumberInput label="Hourly Rate (USD)" value={form.hourlyRate} onChange={v => setForm(f => ({ ...f, hourlyRate: Number(v) || 0 }))} min={0} step={5} prefix="$" required />
          <Group justify="flex-end" gap="xs" mt="xs">
            <Button variant="subtle" size="sm" onClick={() => { closeAdd(); setEditId(null); }}>Cancel</Button>
            <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate({ id: editId ?? undefined, body: form })}>
              {editId ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Currency = 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';
type RateUnit  = 'hourly' | 'daily' | 'monthly';

interface RoleRate {
  id: string;
  role: string;
  level: string;
  tshirtSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
  hourly: number;
  daily: number;
  monthly: number;
  currency: Currency;
  effectiveDate: string;
  location: string;
  notes: string;
}

interface RateCard {
  id: string;
  name: string;
  description: string;
  currency: Currency;
  effectiveFrom: string;
  effectiveTo: string;
  isDefault: boolean;
  region: string;
  rates: RoleRate[];
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$',
};

const DEFAULT_ROLES = [
  { role: 'Software Engineer', level: 'Mid',    tshirtSize: 'M' as const, hourly: 95,  daily: 760,  monthly: 16700 },
  { role: 'Software Engineer', level: 'Senior', tshirtSize: 'L' as const, hourly: 130, daily: 1040, monthly: 22800 },
  { role: 'Software Engineer', level: 'Staff',  tshirtSize: 'XL' as const, hourly: 165, daily: 1320, monthly: 29000 },
  { role: 'QA Engineer',       level: 'Mid',    tshirtSize: 'M' as const, hourly: 80,  daily: 640,  monthly: 14100 },
  { role: 'QA Engineer',       level: 'Senior', tshirtSize: 'L' as const, hourly: 105, daily: 840,  monthly: 18500 },
  { role: 'UX Designer',       level: 'Mid',    tshirtSize: 'M' as const, hourly: 90,  daily: 720,  monthly: 15800 },
  { role: 'UX Designer',       level: 'Senior', tshirtSize: 'L' as const, hourly: 120, daily: 960,  monthly: 21100 },
  { role: 'Product Manager',   level: 'Mid',    tshirtSize: 'M' as const, hourly: 110, daily: 880,  monthly: 19300 },
  { role: 'Product Manager',   level: 'Senior', tshirtSize: 'L' as const, hourly: 145, daily: 1160, monthly: 25500 },
  { role: 'Engineering Manager', level: 'Senior', tshirtSize: 'L' as const, hourly: 160, daily: 1280, monthly: 28100 },
  { role: 'Data Engineer',     level: 'Mid',    tshirtSize: 'M' as const, hourly: 100, daily: 800,  monthly: 17600 },
  { role: 'DevOps / Platform', level: 'Senior', tshirtSize: 'L' as const, hourly: 135, daily: 1080, monthly: 23700 },
];

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function seedRateCard(overrides: Partial<RateCard>): RateCard {
  return {
    id: makeId(),
    name: 'Standard Rates',
    description: 'Default internal cost rates for project budgeting',
    currency: 'USD',
    effectiveFrom: '2025-01-01',
    effectiveTo:   '2025-12-31',
    isDefault: false,
    region: 'North America',
    rates: DEFAULT_ROLES.map(r => ({
      id: makeId(),
      currency: 'USD',
      effectiveDate: '2025-01-01',
      location: 'North America',
      notes: '',
      ...r,
    })),
    ...overrides,
  };
}

const INITIAL_CARDS: RateCard[] = [
  seedRateCard({ id: 'card-1', name: 'FY 2025 — Internal (US)', isDefault: true, region: 'North America', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31' }),
  seedRateCard({
    id: 'card-2', name: 'FY 2025 — Contractor (US)', isDefault: false, region: 'North America',
    effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31',
    description: 'Blended contractor rates for external resource planning',
    rates: DEFAULT_ROLES.map(r => ({
      id: makeId(),
      ...r,
      hourly:  Math.round(r.hourly  * 1.45),
      daily:   Math.round(r.daily   * 1.45),
      monthly: Math.round(r.monthly * 1.40),
      currency: 'USD' as Currency,
      effectiveDate: '2025-01-01',
      location: 'North America',
      notes: 'Includes agency overhead',
    })),
  }),
  seedRateCard({
    id: 'card-3', name: 'FY 2025 — EMEA', isDefault: false, region: 'Europe',
    currency: 'EUR',
    effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31',
    description: 'European team cost rates in EUR',
    rates: DEFAULT_ROLES.map(r => ({
      id: makeId(),
      ...r,
      hourly:  Math.round(r.hourly  * 0.88),
      daily:   Math.round(r.daily   * 0.88),
      monthly: Math.round(r.monthly * 0.88),
      currency: 'EUR' as Currency,
      effectiveDate: '2025-01-01',
      location: 'Europe',
      notes: '',
    })),
  }),
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const TSHIRT_OPTIONS = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
  { value: 'XXL', label: 'XXL' },
];

function RateRow({
  rate, sym, onSaveCell, onDelete, isEditing, onStartEdit, onStopEdit,
}: {
  rate: RoleRate;
  sym: string;
  cardId: string;
  onSaveCell: (field: keyof RoleRate, value: any) => Promise<void>;
  onDelete: () => void;
  isEditing: (field: keyof RoleRate) => boolean;
  onStartEdit: (field: keyof RoleRate) => void;
  onStopEdit: () => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <InlineTextCell
          value={rate.role}
          onSave={v => onSaveCell('role', v)}
          placeholder="Enter role"
          isEditing={isEditing('role')}
          onStartEdit={() => onStartEdit('role')}
          onCancel={onStopEdit}
          maxWidth={180}
        />
      </Table.Td>
      <Table.Td>
        <InlineSelectCell
          value={rate.level}
          options={[
            { value: 'Junior', label: 'Junior' },
            { value: 'Mid', label: 'Mid' },
            { value: 'Senior', label: 'Senior' },
            { value: 'Staff', label: 'Staff' },
            { value: 'Principal', label: 'Principal' },
          ]}
          onSave={v => onSaveCell('level', v)}
          placeholder="Select level"
          isEditing={isEditing('level')}
          onStartEdit={() => onStartEdit('level')}
          onCancel={onStopEdit}
        />
      </Table.Td>
      <Table.Td>
        <InlineSelectCell
          value={rate.tshirtSize}
          options={TSHIRT_OPTIONS}
          onSave={v => onSaveCell('tshirtSize', v as any)}
          placeholder="Select size"
          isEditing={isEditing('tshirtSize')}
          onStartEdit={() => onStartEdit('tshirtSize')}
          onCancel={onStopEdit}
        />
      </Table.Td>
      <Table.Td>
        <InlineNumberCell
          value={rate.hourly}
          onSave={v => onSaveCell('hourly', v)}
          min={0}
          step={5}
          prefix={sym}
          suffix="/hr"
          isEditing={isEditing('hourly')}
          onStartEdit={() => onStartEdit('hourly')}
          onCancel={onStopEdit}
        />
      </Table.Td>
      <Table.Td>
        <InlineNumberCell
          value={rate.daily}
          onSave={v => onSaveCell('daily', v)}
          min={0}
          step={50}
          prefix={sym}
          isEditing={isEditing('daily')}
          onStartEdit={() => onStartEdit('daily')}
          onCancel={onStopEdit}
        />
      </Table.Td>
      <Table.Td>
        <InlineNumberCell
          value={rate.monthly}
          onSave={v => onSaveCell('monthly', v)}
          min={0}
          step={500}
          prefix={sym}
          isEditing={isEditing('monthly')}
          onStartEdit={() => onStartEdit('monthly')}
          onCancel={onStopEdit}
        />
      </Table.Td>
      <Table.Td>
        <InlineTextCell
          value={rate.effectiveDate}
          onSave={v => onSaveCell('effectiveDate', v)}
          placeholder="YYYY-MM-DD"
          isEditing={isEditing('effectiveDate')}
          onStartEdit={() => onStartEdit('effectiveDate')}
          onCancel={onStopEdit}
          maxWidth={120}
        />
      </Table.Td>
      <Table.Td>
        <InlineTextCell
          value={rate.location}
          onSave={v => onSaveCell('location', v)}
          placeholder="Enter location"
          isEditing={isEditing('location')}
          onStartEdit={() => onStartEdit('location')}
          onCancel={onStopEdit}
          maxWidth={140}
        />
      </Table.Td>
      <Table.Td>
        <InlineTextCell
          value={rate.notes}
          onSave={v => onSaveCell('notes', v)}
          placeholder="Add notes"
          isEditing={isEditing('notes')}
          onStartEdit={() => onStartEdit('notes')}
          onCancel={onStopEdit}
          maxWidth={160}
        />
      </Table.Td>
      <Table.Td>
        <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete}
      aria-label="Delete"
    >
          <IconTrash size={13} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
}

// ─── Cost Modeller ────────────────────────────────────────────────────────────

function CostModeller({ cards }: { cards: RateCard[] }) {
  const dark = useDarkMode();
  const [cardId,  setCardId]  = useState<string>(cards.find(c => c.isDefault)?.id ?? cards[0]?.id ?? '');
  const [unit,    setUnit]    = useState<RateUnit>('monthly');
  const [roleRows, setRoleRows] = useState<Array<{ role: string; level: string; units: number }>>([
    { role: 'Software Engineer', level: 'Senior', units: 2 },
    { role: 'QA Engineer',       level: 'Mid',    units: 1 },
    { role: 'UX Designer',       level: 'Senior', units: 1 },
  ]);

  const card = cards.find(c => c.id === cardId);
  const sym  = card ? CURRENCY_SYMBOLS[card.currency] : '$';

  const totalCost = useMemo(() => {
    if (!card) return 0;
    return roleRows.reduce((sum, row) => {
      const rate = card.rates.find(r => r.role === row.role && r.level === row.level);
      if (!rate) return sum;
      const rateVal = unit === 'hourly' ? rate.hourly : unit === 'daily' ? rate.daily : rate.monthly;
      return sum + rateVal * row.units;
    }, 0);
  }, [card, unit, roleRows]);

  const roleOptions = useMemo(() => {
    if (!card) return [];
    return [...new Set(card.rates.map(r => r.role))].map(r => ({ value: r, label: r }));
  }, [card]);

  function levelOptionsFor(role: string) {
    if (!card) return [];
    return card.rates.filter(r => r.role === role).map(r => ({ value: r.level, label: r.level }));
  }

  const surf = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
  const bord = dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';

  return (
    <Stack gap="md">
      <Group>
        <Select
          label="Rate Card"
          size="xs"
          data={cards.map(c => ({ value: c.id, label: c.name }))}
          value={cardId}
          onChange={v => v && setCardId(v)}
          w={260}
        />
        <Box>
          <Text size="xs" fw={500} mb={4}>Unit</Text>
          <SegmentedControl
            size="xs"
            data={[
              { value: 'hourly',  label: 'Hourly'  },
              { value: 'daily',   label: 'Daily'   },
              { value: 'monthly', label: 'Monthly' },
            ]}
            value={unit}
            onChange={v => setUnit(v as RateUnit)}
          />
        </Box>
      </Group>

      <Paper p="sm" style={{ background: surf, border: `1px solid ${bord}`, borderRadius: 10 }}>
        <Table striped highlightOnHover withTableBorder={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Units ({unit})</Table.Th>
              <Table.Th>Rate</Table.Th>
              <Table.Th>Subtotal</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {roleRows.map((row, i) => {
              const rate = card?.rates.find(r => r.role === row.role && r.level === row.level);
              const rateVal = rate ? (unit === 'hourly' ? rate.hourly : unit === 'daily' ? rate.daily : rate.monthly) : 0;
              const subtotal = rateVal * row.units;
              return (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={roleOptions}
                      value={row.role}
                      onChange={v => {
                        if (!v) return;
                        const levels = levelOptionsFor(v);
                        setRoleRows(rows => rows.map((r, j) =>
                          j === i ? { ...r, role: v, level: levels[0]?.value ?? r.level } : r,
                        ));
                      }}
                      style={{ width: 200 }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={levelOptionsFor(row.role)}
                      value={row.level}
                      onChange={v => v && setRoleRows(rows => rows.map((r, j) => j === i ? { ...r, level: v } : r))}
                      w={100}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.units}
                      min={0.5} step={0.5}
                      onChange={v => setRoleRows(rows => rows.map((r, j) => j === i ? { ...r, units: Number(v) ?? r.units } : r))}
                      w={80}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{sym}{rateVal.toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>{sym}{subtotal.toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon size="sm" color="red" variant="subtle"
                      onClick={() => setRoleRows(rows => rows.filter((_, j) => j !== i))}
      aria-label="Delete"
    >
                      <IconTrash size={13} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        <Group mt="sm" justify="space-between">
          <Button
            size="xs" variant="light" leftSection={<IconPlus size={13} />}
            onClick={() => setRoleRows(rows => [...rows, { role: 'Software Engineer', level: 'Mid', units: 1 }])}
          >
            Add Role
          </Button>
          <Paper px="md" py="xs" style={{ background: AQUA + '18', border: `1px solid ${AQUA}44`, borderRadius: 8 }}>
            <Group gap={8}>
              <Text size="sm" c="dimmed">Total {unit} cost:</Text>
              <Text size="lg" fw={800} c={DEEP_BLUE}>
                {sym}{totalCost.toLocaleString()}
              </Text>
            </Group>
          </Paper>
        </Group>
      </Paper>
    </Stack>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CostRatesPage() {
  const dark = useDarkMode();
  const [cards, setCards]             = useState<RateCard[]>(INITIAL_CARDS);
  const [activeCard, setActiveCard]   = useState<string>(INITIAL_CARDS[0].id);
  const [activeTab, setActiveTab]     = useState<string | null>('rates');
  const [newModalOpen, { open: openNew, close: closeNew }] = useDisclosure(false);
  const [newCardName, setNewCardName]   = useState('');
  const [newCardRegion, setNewCardRegion] = useState('North America');
  const [newCardCurrency, setNewCardCurrency] = useState<Currency>('USD');

  // Inline editing state for the table
  const { startEdit, stopEdit, isEditing } = useInlineEdit();

  const card = useMemo(() => cards.find(c => c.id === activeCard), [cards, activeCard]);
  const sym  = card ? CURRENCY_SYMBOLS[card.currency] : '$';

  const surf = dark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const bg   = dark ? '#0f172a' : '#f8fafc';
  const bord = dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';

  // ── Handlers ─────────────────────────────────────────────────────────────

  function setDefault(id: string) {
    setCards(cs => cs.map(c => ({ ...c, isDefault: c.id === id })));
  }

  function duplicateCard(id: string) {
    const src = cards.find(c => c.id === id);
    if (!src) return;
    const newCard: RateCard = {
      ...src,
      id: makeId(),
      name: `${src.name} (copy)`,
      isDefault: false,
      rates: src.rates.map(r => ({ ...r, id: makeId() })),
    };
    setCards(cs => [...cs, newCard]);
    setActiveCard(newCard.id);
    notifications.show({ message: `Rate card duplicated`, color: 'teal' });
  }

  function deleteCard(id: string) {
    if (cards.length <= 1) return;
    setCards(cs => cs.filter(c => c.id !== id));
    if (activeCard === id) setActiveCard(cards.find(c => c.id !== id)!.id);
  }

  function addRole() {
    setCards(cs => cs.map(c => c.id !== activeCard ? c : {
      ...c,
      rates: [...c.rates, {
        id: makeId(), role: 'New Role', level: 'Mid', tshirtSize: 'M' as const,
        hourly: 80, daily: 640, monthly: 14000,
        currency: c.currency, effectiveDate: new Date().toISOString().split('T')[0],
        location: 'North America', notes: '',
      }],
    }));
  }

  async function saveCellValue(rateId: string, field: keyof RoleRate, value: any) {
    // Simulate async API call (optimistic update)
    setCards(cs => cs.map(c => c.id !== activeCard ? c : {
      ...c,
      rates: c.rates.map(r => r.id === rateId ? { ...r, [field]: value } : r),
    }));
    stopEdit();
  }

  function deleteRow(rateId: string) {
    setCards(cs => cs.map(c => c.id !== activeCard ? c : {
      ...c,
      rates: c.rates.filter(r => r.id !== rateId),
    }));
  }

  function createCard() {
    const nc = seedRateCard({
      id: makeId(),
      name: newCardName || 'New Rate Card',
      currency: newCardCurrency,
      region: newCardRegion,
      isDefault: false,
    });
    setCards(cs => [...cs, nc]);
    setActiveCard(nc.id);
    closeNew();
    setNewCardName('');
    notifications.show({ message: 'New rate card created', color: 'teal' });
  }

  // ── Totals / summary ──────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (!card) return { avgHourly: 0, avgDaily: 0, maxHourly: 0, roleCount: 0 };
    const avgHourly  = Math.round(card.rates.reduce((s, r) => s + r.hourly,  0) / card.rates.length);
    const avgDaily   = Math.round(card.rates.reduce((s, r) => s + r.daily,   0) / card.rates.length);
    const maxHourly  = Math.max(...card.rates.map(r => r.hourly));
    return { avgHourly, avgDaily, maxHourly, roleCount: card.rates.length };
  }, [card]);

  if (!card) return null;

  return (
    <Box p="lg">
      <Group mb="lg" justify="space-between">
        <Box>
          <Title order={2} c={dark ? '#fff' : DEEP_BLUE}>
            Cost Rate Tables
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            Define per-role cost rates for project budget estimation and financial modelling
          </Text>
        </Box>
        <Group gap="xs">
          <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}>
            Export CSV
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openNew}
            bg={DEEP_BLUE}>
            New Rate Card
          </Button>
        </Group>
      </Group>

      {/* ── Backend-connected live rates ───────────────────────────────────── */}
      <LiveRatesPanel />

      <Box style={{ display: 'flex', gap: 16 }}>

        {/* ── Left: Rate Card List ───────────────────────────────────── */}
        <Box style={{ width: 260, flexShrink: 0 }}>
          <Stack gap="xs">
            {cards.map(c => (
              <Paper
                key={c.id}
                p="sm"
                style={{
                  background: c.id === activeCard
                    ? (dark ? 'rgba(45,204,211,0.12)' : '#f0fdfa')
                    : surf,
                  border: `1.5px solid ${c.id === activeCard ? AQUA + '66' : bord}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onClick={() => setActiveCard(c.id)}
              >
                <Group justify="space-between" mb={4}>
                  <Group gap={6}>
                    {c.isDefault ? (
                      <IconStarFilled size={14} color="#f59e0b" />
                    ) : (
                      <IconStar size={14} color="#94a3b8" />
                    )}
                    <Text size="sm" fw={600} truncate maw={150}>
                      {c.name}
                    </Text>
                  </Group>
                </Group>
                <Group gap={6}>
                  <Badge size="xs" variant="light" color="blue">{c.currency}</Badge>
                  <Badge size="xs" variant="light" color="gray">{c.region}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {c.effectiveFrom} → {c.effectiveTo}
                </Text>
              </Paper>
            ))}
          </Stack>
        </Box>

        {/* ── Right: Rate Card Detail ────────────────────────────────── */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Paper p="lg" style={{ background: surf, border: `1px solid ${bord}`, borderRadius: 12 }}>

            {/* Card header */}
            <Group justify="space-between" mb="md">
              <Box>
                <Group gap="xs" mb={4}>
                  <Text size="xl" fw={700}>{card.name}</Text>
                  {card.isDefault && (
                    <Badge size="sm" color="yellow" leftSection={<IconStarFilled size={10} />}>
                      Default
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">{card.description}</Text>
              </Box>
              <Group gap="xs">
                {!card.isDefault && (
                  <Tooltip label="Set as default">
                    <ActionIcon variant="light" color="yellow" onClick={() => setDefault(card.id)}
      aria-label="Favourite"
    >
                      <IconStar size={15} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label="Duplicate card">
                  <ActionIcon variant="light" color="blue" onClick={() => duplicateCard(card.id)}
      aria-label="Copy"
    >
                    <IconCopy size={15} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={card.isDefault ? "Cannot delete default card" : "Delete card"}>
                  <ActionIcon
                    variant="light" color="red"
                    disabled={card.isDefault || cards.length <= 1}
                    onClick={() => deleteCard(card.id)}
                    aria-label="Delete"
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* Summary stats */}
            <SimpleGrid cols={4} mb="md">
              {[
                { label: 'Roles defined',    value: summary.roleCount.toString(),         icon: <IconBuildingBank size={16} /> },
                { label: 'Avg hourly rate',  value: `${sym}${summary.avgHourly}`,          icon: <IconCurrencyDollar size={16} /> },
                { label: 'Avg daily rate',   value: `${sym}${summary.avgDaily.toLocaleString()}`,   icon: <IconCurrencyDollar size={16} /> },
                { label: 'Peak hourly rate', value: `${sym}${summary.maxHourly}`,          icon: <IconCurrencyDollar size={16} /> },
              ].map(stat => (
                <Paper key={stat.label} p="sm" style={{
                  background: bg, border: `1px solid ${bord}`, borderRadius: 8,
                }}>
                  <Group gap={8} mb={2}>
                    <ThemeIcon size="sm" variant="light" color="teal">{stat.icon}</ThemeIcon>
                    <Text size="xs" c="dimmed">{stat.label}</Text>
                  </Group>
                  <Text size="lg" fw={700}>{stat.value}</Text>
                </Paper>
              ))}
            </SimpleGrid>

            <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
              <Tabs.List mb="md">
                <Tabs.Tab value="rates" leftSection={<IconCurrencyDollar size={14} />}>
                  Rate Table
                </Tabs.Tab>
                <Tabs.Tab value="model" leftSection={<IconCalculator size={14} />}>
                  Cost Modeller
                </Tabs.Tab>
              </Tabs.List>

              {/* ── Rates Tab ─────────────────────────────────────────── */}
              <Tabs.Panel value="rates">
                <Group justify="flex-end" mb="sm">
                  <Button size="xs" variant="light" leftSection={<IconPlus size={13} />} onClick={addRole}>
                    Add Role
                  </Button>
                </Group>

                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ minWidth: 140 }}>Role</Table.Th>
                        <Table.Th style={{ minWidth: 90 }}>Level</Table.Th>
                        <Table.Th style={{ minWidth: 80 }}>T-Shirt</Table.Th>
                        <Table.Th style={{ minWidth: 100 }}>Hourly ({card.currency})</Table.Th>
                        <Table.Th style={{ minWidth: 100 }}>Daily ({card.currency})</Table.Th>
                        <Table.Th style={{ minWidth: 110 }}>Monthly ({card.currency})</Table.Th>
                        <Table.Th style={{ minWidth: 120 }}>Effective Date</Table.Th>
                        <Table.Th style={{ minWidth: 120 }}>Location</Table.Th>
                        <Table.Th style={{ minWidth: 140 }}>Notes</Table.Th>
                        <Table.Th style={{ width: 60 }}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {card.rates.map(rate => (
                        <RateRow
                          key={rate.id}
                          rate={rate}
                          sym={sym}
                          cardId={card.id}
                          onSaveCell={(field, value) => saveCellValue(rate.id, field, value)}
                          onDelete={() => deleteRow(rate.id)}
                          isEditing={(field) => isEditing(rate.id, field)}
                          onStartEdit={(field) => startEdit(rate.id, field)}
                          onStopEdit={stopEdit}
                        />
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Text size="xs" c="dimmed" mt="sm">
                  {card.rates.length} roles · Effective {card.effectiveFrom} to {card.effectiveTo} ·
                  All values in {card.currency}
                </Text>
              </Tabs.Panel>

              {/* ── Cost Modeller Tab ──────────────────────────────────── */}
              <Tabs.Panel value="model">
                <CostModeller cards={cards} />
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Box>
      </Box>

      {/* ── New Card Modal ─────────────────────────────────────────────────── */}
      <Modal
        opened={newModalOpen}
        onClose={closeNew}
        title={<Text fw={700}>Create Rate Card</Text>}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Card Name"
            placeholder="e.g. FY 2026 — Internal (US)"
            value={newCardName}
            onChange={e => setNewCardName(e.target.value)}
            required
          />
          <Select
            label="Currency"
            data={Object.keys(CURRENCY_SYMBOLS).map(c => ({ value: c, label: c }))}
            value={newCardCurrency}
            onChange={v => v && setNewCardCurrency(v as Currency)}
          />
          <TextInput
            label="Region"
            placeholder="e.g. North America, EMEA, APAC"
            value={newCardRegion}
            onChange={e => setNewCardRegion(e.target.value)}
          />
          <Text size="xs" c="dimmed">
            The new card will be pre-populated with default role rates. You can edit individual rates after creation.
          </Text>
          <Divider />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={closeNew}>Cancel</Button>
            <Button size="sm" onClick={createCard} bg={DEEP_BLUE}>
              Create Card
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
