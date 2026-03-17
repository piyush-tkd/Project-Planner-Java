import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Stack, Table, NumberInput, Button, Text, Group, Modal, TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { usePods, useCreatePod, useUpdatePod, useBauAssumptions, useUpdateBauAssumptions } from '../api/pods';
import { Role, formatRole } from '../types';
import type { BauAssumptionRequest } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CsvToolbar from '../components/common/CsvToolbar';
import { podColumns, bauColumns } from '../utils/csvColumns';

export default function PodsPage() {
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

  const filteredPods = useMemo(() => {
    const all = pods ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(p => p.name.toLowerCase().includes(q));
  }, [pods, search]);

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
    });
  };

  if (podsLoading || bauLoading) return <LoadingSpinner />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>PODs</Title>
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

      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 40 }}>#</Table.Th>
            <Table.Th>POD Name</Table.Th>
            <Table.Th>Complexity Multiplier</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filteredPods.map((pod, idx) => (
            <Table.Tr key={pod.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pods/${pod.id}`)}>
              <Table.Td c="dimmed" style={{ fontSize: 12 }}>{idx + 1}</Table.Td>
              <Table.Td fw={500}>{pod.name}</Table.Td>
              <Table.Td>
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
              <Table.Td>
                <Button size="xs" variant="light" onClick={() => handleComplexitySave(pod.id)}
                  disabled={editingComplexity[pod.id] === undefined}>
                  Save
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" mt="xl">
        <Title order={3}>BAU Assumptions (% by Role)</Title>
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

      <Table.ScrollContainer minWidth={800}>
        <Table withTableBorder withColumnBorders>
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
      </Table.ScrollContainer>

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
