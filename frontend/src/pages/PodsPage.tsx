import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Title, Stack, Table, NumberInput, Button, Text, Group, Modal, TextInput,
ScrollArea, ThemeIcon,
} from '@mantine/core';
import { AQUA, AQUA_TINTS, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { usePods, useCreatePod, useUpdatePod, useBauAssumptions, useUpdateBauAssumptions } from '../api/pods';
import { Role, formatRole } from '../types';
import type { BauAssumptionRequest } from '../types';
import { useDarkMode } from '../hooks/useDarkMode';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CsvToolbar from '../components/common/CsvToolbar';
import TablePagination from '../components/common/TablePagination';
import { podColumns, bauColumns } from '../utils/csvColumns';
import { usePagination } from '../hooks/usePagination';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0]?.substring(0, 2)?.toUpperCase() ?? '?';
}

export default function PodsPage() {
  const isDark = useDarkMode();
  const navigate = useNavigate();
  const { data: pods, isLoading: podsLoading } = usePods();
  const { data: bauData, isLoading: bauLoading } = useBauAssumptions();
  const createPod = useCreatePod();
  const updatePod = useUpdatePod();
  const updateBau = useUpdateBauAssumptions();

  const [editingComplexity, setEditingComplexity] = useState<Record<number, number>>({});
  const [bauEdits, setBauEdits] = useState<Record<string, number>>({});
  const [addModal, setAddModal] = useState(false);
  const [newPodName, setNewPodName] = useState('');
  const [newPodComplexity, setNewPodComplexity] = useState<number>(1.0);
  const [search, setSearch] = useState('');

  // Highlight support from NLP drill-down (?highlight=id)
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null;
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  useEffect(() => {
    if (highlightId && pods && pods.some(p => p.id === highlightId)) {
      setFlashId(highlightId);
      setTimeout(() => {
        highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      const timer = setTimeout(() => setFlashId(null), 3000);
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(timer);
    }
  }, [highlightId, pods]);

  const filteredPods = useMemo(() => {
    const all = pods ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(p => p.name.toLowerCase().includes(q));
  }, [pods, search]);

  const { paginatedData: pagedPods, ...podPagination } = usePagination(filteredPods, 25);

  const roles = Object.values(Role);

  const handleComplexitySave = (podId: number) => {
    const val = editingComplexity[podId];
    if (val === undefined) return;
    updatePod.mutate({ id: podId, data: { complexityMultiplier: val } }, {
      onSuccess: () => {
        notifications.show({ title: 'Saved', message: 'Complexity updated', color: 'green' });
        setEditingComplexity(prev => {
          const next = { ...prev };
          delete next[podId];
          return next;
        });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to update complexity', color: 'red' }),
    });
  };

  const handleBauSave = () => {
    const requests: BauAssumptionRequest[] = Object.entries(bauEdits).map(([key, val]) => {
      const [podId, role] = key.split('-');
      return { podId: Number(podId), role: role as Role, bauPct: val };
    });

    if (requests.length === 0) return;

    updateBau.mutate(requests, {
      onSuccess: () => {
        setBauEdits({});
        notifications.show({ title: 'Saved', message: 'BAU assumptions updated', color: 'green' });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to save BAU assumptions', color: 'red' }),
    });
  };

  const getBauValue = (podId: number, role: Role): number => {
    const key = `${podId}-${role}`;
    if (bauEdits[key] !== undefined) return bauEdits[key];
    const existing = (bauData ?? []).find(b => b.podId === podId && b.role === role);
    return existing?.bauPct ?? 0;
  };

  const handleCreatePod = () => {
    if (!newPodName.trim()) return;
    createPod.mutate({ name: newPodName.trim(), complexityMultiplier: newPodComplexity }, {
      onSuccess: () => {
        setAddModal(false);
        setNewPodName('');
        setNewPodComplexity(1.0);
        notifications.show({ title: 'Created', message: 'POD created', color: 'green' });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to create POD', color: 'red' }),
    });
  };

  if (podsLoading || bauLoading) return <LoadingSpinner variant="table" message="Loading PODs..." />;

  return (
    <Stack className="page-enter stagger-children">
      <Group justify="space-between" className="slide-in-left">
        <Title order={2} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>PODs</Title>
        <Group gap="sm">
          <CsvToolbar
            data={pods ?? []}
            columns={podColumns}
            filename="pods"
            onImport={(rows) => {
              rows.forEach(row => {
                createPod.mutate({
                  name: row.name ?? '',
                  complexityMultiplier: Number(row.complexityMultiplier) || 1.0,
                });
              });
            }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddModal(true)}>Add POD</Button>
        </Group>
      </Group>

      <Group gap="sm" align="flex-end">
        <TextInput
          placeholder="Search PODs…"
          leftSection={<IconSearch size={15} />}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          style={{ maxWidth: 280 }}
          size="sm"
        />
        <Text size="sm" c="dimmed">{filteredPods.length} of {(pods ?? []).length} PODs</Text>
      </Group>

      <Table fz="xs" withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>#</Table.Th>
            <Table.Th>POD Name</Table.Th>
            <Table.Th>Complexity Multiplier</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {pagedPods.map((pod, idx) => (
            <Table.Tr
              key={pod.id}
              ref={pod.id === highlightId || pod.id === flashId ? highlightRowRef : undefined}
              style={{
                cursor: 'pointer',
                ...(pod.id === flashId ? {
                  backgroundColor: AQUA_TINTS[10],
                  transition: 'background-color 1s ease-out',
                  boxShadow: `0 0 0 2px ${AQUA}`,
                } : {}),
              }}
              onClick={() => navigate(`/pods/${pod.id}`)}
            >
              <Table.Td c="dimmed" style={{ fontSize: 12 }}>{podPagination.startIndex + idx + 1}</Table.Td>
              <Table.Td fw={500}>{pod.name}</Table.Td>
              <Table.Td onClick={e => e.stopPropagation()}>
                <NumberInput
                  value={editingComplexity[pod.id] ?? pod.complexityMultiplier}
                  onChange={v => setEditingComplexity(prev => ({ ...prev, [pod.id]: Number(v) }))}
                  min={0.1}
                  max={5}
                  step={0.1}
                  decimalScale={2}
                  style={{ maxWidth: 120 }}
                />
              </Table.Td>
              <Table.Td onClick={e => e.stopPropagation()}>
                <Button size="xs" variant="light"
                  onClick={() => handleComplexitySave(pod.id)}
                  disabled={editingComplexity[pod.id] === undefined}>
                  Save
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <TablePagination {...podPagination} />

      <Group justify="space-between" mt="xl">
        <Title order={3} style={{ fontFamily: FONT_FAMILY, color: isDark ? '#fff' : DEEP_BLUE }}>BAU Assumptions (% by Role)</Title>
        <Group gap="sm">
          <CsvToolbar
            data={bauData ?? []}
            columns={bauColumns}
            filename="bau_assumptions"
            onImport={(rows) => {
              const requests: BauAssumptionRequest[] = rows.map(row => {
                const podMatch = (pods ?? []).find(p => p.name.toLowerCase() === (row.podName ?? '').toLowerCase());
                return {
                  podId: podMatch?.id ?? 0,
                  role: row.role ?? 'DEVELOPER',
                  bauPct: Number(row.bauPct) || 0,
                };
              }).filter(r => r.podId > 0);
              if (requests.length > 0) updateBau.mutate(requests);
            }}
          />
          <Button onClick={handleBauSave} disabled={Object.keys(bauEdits).length === 0} loading={updateBau.isPending}>
            Save BAU Changes
          </Button>
        </Group>
      </Group>

      <ScrollArea>
        <Table fz="xs" withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>POD</Table.Th>
              {roles.map(r => (
                <Table.Th key={r} style={{ textAlign: 'center', fontSize: 12 }}>{formatRole(r)}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredPods.map(pod => (
              <Table.Tr key={pod.id}>
                <Table.Td fw={500}>{pod.name}</Table.Td>
                {roles.map(role => {
                  const key = `${pod.id}-${role}`;
                  return (
                    <Table.Td key={role} style={{ padding: 4 }}>
                      <NumberInput
                        value={getBauValue(pod.id, role)}
                        onChange={v => setBauEdits(prev => ({ ...prev, [key]: Number(v) }))}
                        min={0}
                        max={100}
                        suffix="%"
                        size="xs"
                        style={{ minWidth: 70 }}
                      />
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Modal opened={addModal} onClose={() => setAddModal(false)} title="Add POD">
        <Stack>
          <TextInput label="POD Name" value={newPodName} onChange={e => setNewPodName(e.target.value)} required />
          <NumberInput label="Complexity Multiplier" value={newPodComplexity} onChange={v => setNewPodComplexity(Number(v))} min={0.1} max={5} step={0.1} decimalScale={2} />
          <Button onClick={handleCreatePod} loading={createPod.isPending}>Create</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
