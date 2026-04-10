import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Title, Stack, Table, NumberInput, Button, Text, Group, Modal, TextInput,
  ScrollArea, ActionIcon, Tooltip, Alert, Badge, Progress, Switch,
} from '@mantine/core';
import { PPPageLayout } from '../components/pp';
import { AQUA, AQUA_TINTS, DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconPencil, IconTrash, IconCheck, IconX, IconAlertTriangle, IconUsers, IconBriefcase, IconClock, IconEye, IconChartBar, IconHexagons, IconChartAreaLine, IconFlame, IconArrowsShuffle } from '@tabler/icons-react';
import ConnectedPages from '../components/common/ConnectedPages';
import { PageInsightCard } from '../components/common/PageInsightCard';
import { usePods, useCreatePod, useUpdatePod, useDeletePod, useBauAssumptions, useUpdateBauAssumptions } from '../api/pods';
import { useResources } from '../api/resources';
import { useProjectPodMatrix } from '../api/projects';
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
  const { data: resources } = useResources();
  const { data: matrix } = useProjectPodMatrix();
  const createPod = useCreatePod();
  const updatePod = useUpdatePod();
  const deletePod = useDeletePod();
  const updateBau = useUpdateBauAssumptions();

  const [editingComplexity, setEditingComplexity] = useState<Record<number, number>>({});
  const [bauEdits, setBauEdits] = useState<Record<string, number>>({});
  const [addModal, setAddModal] = useState(false);
  const [newPodName, setNewPodName] = useState('');
  const [newPodComplexity, setNewPodComplexity] = useState<number>(1.0);
  const [search, setSearch] = useState('');

  // ── Inline editing state ──────────────────────────────────────────────
  type EditableField = 'name' | 'active' | 'description';
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [editBoolDraft, setEditBoolDraft] = useState<boolean>(false);

  // ── Inline rename state ───────────────────────────────────────────────
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const startEdit = (podId: number, field: EditableField, currentValue: string | boolean) => {
    setEditingCell({ id: podId, field });
    if (field === 'active') {
      setEditBoolDraft(Boolean(currentValue));
    } else {
      setEditDraft(String(currentValue ?? ''));
    }
  };

  const commitEdit = (pod: any) => {
    if (!editingCell || editingCell.id !== pod.id) return;
    const isActiveField = editingCell.field === 'active';
    let updateData: any = { name: pod.name, complexityMultiplier: pod.complexityMultiplier };
    if (isActiveField) {
      updateData.active = editBoolDraft;
    } else if (editingCell.field === 'description') {
      updateData.description = editDraft;
    }
    updatePod.mutate({ id: pod.id, data: updateData }, {
      onSuccess: () => {
        setEditingCell(null);
        notifications.show({ title: 'Updated', message: 'POD updated successfully', color: 'green' });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to update POD', color: 'red' }),
    });
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCell(null);
  };

  const startRename = (podId: number, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(podId);
    setRenameDraft(currentName);
  };

  const commitRename = (podId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!renameDraft.trim()) { setRenamingId(null); return; }
    updatePod.mutate({ id: podId, data: { name: renameDraft.trim() } }, {
      onSuccess: () => {
        setRenamingId(null);
        notifications.show({ title: 'Renamed', message: 'POD name updated', color: 'green' });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to rename POD', color: 'red' }),
    });
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(null);
  };

  // ── Delete state ──────────────────────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const deleteTarget = (pods ?? []).find(p => p.id === deleteTargetId);

  const handleDelete = () => {
    if (!deleteTargetId) return;
    deletePod.mutate(deleteTargetId, {
      onSuccess: () => {
        setDeleteTargetId(null);
        notifications.show({ title: 'Deleted', message: 'POD removed', color: 'red' });
      },
      onError: () => notifications.show({ title: 'Error', message: 'Failed to delete POD', color: 'red' }),
    });
  };

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

  // ── Per-pod summary stats ─────────────────────────────────────────────
  const podStats = useMemo(() => {
    const allPods = pods ?? [];
    const allResources = resources ?? [];
    const allMatrix = matrix ?? [];

    return allPods.map(pod => {
      const memberCount = allResources.filter(r => r.podAssignment?.podId === pod.id).length;
      const podEntries = allMatrix.filter(e => e.podId === pod.id);
      const uniqueProjectIds = new Set(podEntries.map(e => e.projectId));
      const projectCount = uniqueProjectIds.size;
      const activeProjectCount = new Set(
        podEntries.filter(e => e.status === 'ACTIVE').map(e => e.projectId)
      ).size;
      const totalHours = podEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0);
      return { podId: pod.id, memberCount, projectCount, activeProjectCount, totalHours };
    });
  }, [pods, resources, matrix]);

  const podStatsMap = useMemo(
    () => new Map(podStats.map(s => [s.podId, s])),
    [podStats]
  );

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
    <PPPageLayout
      title="PODs"
      animate
      actions={
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
          <Button
            variant="light"
            color="teal"
            leftSection={<IconChartBar size={16} />}
            onClick={() => navigate('/delivery/jira')}
          >
            Jira Dashboard
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddModal(true)}>Add POD</Button>
        </Group>
      }
    >
      <PageInsightCard pageKey="pods" data={pods} />
      <Stack className="stagger-children">

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

      {/* ── Unified POD Table (summary + management merged) ────────────────── */}
      <ScrollArea>
        <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              <Table.Th style={{ minWidth: 160 }}>POD Name</Table.Th>
              <Table.Th style={{ minWidth: 140 }}>Description</Table.Th>
              <Table.Th style={{ textAlign: 'center', width: 90 }}>
                <Group gap={4} justify="center"><IconUsers size={12} /><span>Resources</span></Group>
              </Table.Th>
              <Table.Th style={{ textAlign: 'center', width: 80 }}>
                <Group gap={4} justify="center"><IconBriefcase size={12} /><span>Projects</span></Group>
              </Table.Th>
              <Table.Th style={{ textAlign: 'center', width: 80 }}>Active Proj</Table.Th>
              <Table.Th style={{ textAlign: 'center', width: 80 }}>Pod Status</Table.Th>
              <Table.Th style={{ textAlign: 'center', width: 110 }}>
                <Group gap={4} justify="center"><IconClock size={12} /><span>Hours</span></Group>
              </Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Activity</Table.Th>
              <Table.Th style={{ width: 160 }}>Complexity ×</Table.Th>
              <Table.Th style={{ width: 70 }}>Save</Table.Th>
              <Table.Th style={{ width: 100 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pagedPods.map((pod, idx) => {
              const s = podStatsMap.get(pod.id);
              const activePct = s && s.projectCount > 0
                ? Math.round((s.activeProjectCount / s.projectCount) * 100)
                : 0;
              return (
                <Table.Tr
                  key={pod.id}
                  ref={pod.id === highlightId || pod.id === flashId ? highlightRowRef : undefined}
                  style={{
                    cursor: 'default',
                    ...(pod.id === flashId ? {
                      backgroundColor: AQUA_TINTS[10],
                      transition: 'background-color 1s ease-out',
                      boxShadow: `0 0 0 2px ${AQUA}`,
                    } : {}),
                  }}
                >
                  {/* # */}
                  <Table.Td c="dimmed" style={{ fontSize: 12 }}>{podPagination.startIndex + idx + 1}</Table.Td>

                  {/* POD Name — inline rename */}
                  <Table.Td fw={600} style={{ color: 'var(--pp-text)' }} onClick={e => e.stopPropagation()}>
                    {renamingId === pod.id ? (
                      <Group gap={4} wrap="nowrap">
                        <TextInput
                          size="xs"
                          value={renameDraft}
                          autoFocus
                          style={{ flex: 1, minWidth: 120 }}
                          onChange={e => setRenameDraft(e.currentTarget.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename(pod.id);
                            if (e.key === 'Escape') cancelRename(e as unknown as React.MouseEvent);
                          }}
                        />
                        <Tooltip label="Save name">
                          <ActionIcon size="xs" color="green" variant="filled"
                            loading={updatePod.isPending}
                            onClick={e => commitRename(pod.id, e)}>
                            <IconCheck size={11} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancel">
                          <ActionIcon size="xs" color="gray" variant="subtle" onClick={cancelRename}>
                            <IconX size={11} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    ) : pod.name}
                  </Table.Td>

                  {/* Description — inline editable */}
                  <Table.Td onClick={e => { e.stopPropagation(); startEdit(pod.id, 'description', pod.description ?? ''); }}>
                    {editingCell?.id === pod.id && editingCell.field === 'description' ? (
                      <TextInput
                        size="xs"
                        value={editDraft}
                        autoFocus
                        onChange={e => setEditDraft(e.currentTarget.value)}
                        onBlur={() => commitEdit(pod)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(pod); if (e.key === 'Escape') cancelEdit(e as unknown as React.MouseEvent); }}
                        onClick={e => e.stopPropagation()}
                        placeholder="Add description…"
                      />
                    ) : (
                      <Text size="xs" c={pod.description ? 'inherit' : 'dimmed'}>
                        {pod.description || '—'}
                      </Text>
                    )}
                  </Table.Td>

                  {/* Resources */}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="sm" variant="light" color={s?.memberCount ? 'blue' : 'gray'}>
                      {s?.memberCount ?? 0}
                    </Badge>
                  </Table.Td>

                  {/* Total Projects */}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="sm" variant="light" color={s?.projectCount ? 'violet' : 'gray'}>
                      {s?.projectCount ?? 0}
                    </Badge>
                  </Table.Td>

                  {/* Active Projects */}
                  <Table.Td style={{ textAlign: 'center' }}>
                    {s?.activeProjectCount ? (
                      <Badge size="sm" variant="light" color="green">{s.activeProjectCount}</Badge>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>

                  {/* Pod Status (Active) — inline toggle */}
                  <Table.Td style={{ textAlign: 'center' }} onClick={e => { e.stopPropagation(); startEdit(pod.id, 'active', pod.active); }}>
                    {editingCell?.id === pod.id && editingCell.field === 'active' ? (
                      <Switch
                        size="xs"
                        checked={editBoolDraft}
                        onChange={e => setEditBoolDraft(e.currentTarget.checked)}
                        onBlur={() => commitEdit(pod)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <Badge size="xs" color={pod.active ? 'green' : 'gray'} variant="light">
                        {pod.active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </Table.Td>

                  {/* Allocated Hours */}
                  <Table.Td style={{ textAlign: 'center' }}>
                    {s?.totalHours ? (
                      <Text size="xs" fw={500} style={{ color: 'var(--pp-text)' }}>
                        {s.totalHours.toLocaleString(undefined, { maximumFractionDigits: 0 })}h
                      </Text>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>

                  {/* Activity bar */}
                  <Table.Td>
                    {s && s.projectCount > 0 ? (
                      <Group gap={6} wrap="nowrap">
                        <Progress value={activePct} size="sm" color="teal" style={{ flex: 1, minWidth: 60 }} />
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{activePct}%</Text>
                      </Group>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>

                  {/* Complexity multiplier */}
                  <Table.Td onClick={e => e.stopPropagation()}>
                    <NumberInput
                      value={editingComplexity[pod.id] ?? pod.complexityMultiplier}
                      onChange={v => setEditingComplexity(prev => ({ ...prev, [pod.id]: Number(v) }))}
                      min={0.1} max={5} step={0.1} decimalScale={2}
                      size="xs"
                      style={{ maxWidth: 110 }}
                    />
                  </Table.Td>

                  {/* Save complexity */}
                  <Table.Td onClick={e => e.stopPropagation()}>
                    <Button size="xs" variant="light"
                      onClick={() => handleComplexitySave(pod.id)}
                      disabled={editingComplexity[pod.id] === undefined}>
                      Save
                    </Button>
                  </Table.Td>

                  {/* View Details / Rename / Delete */}
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="View details">
                        <ActionIcon size="sm" color="teal" variant="subtle"
                          onClick={() => navigate(`/pods/${pod.id}`)}>
                          <IconEye size={13} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Rename POD">
                        <ActionIcon size="sm" color="blue" variant="subtle"
                          onClick={e => startRename(pod.id, pod.name, e)}>
                          <IconPencil size={13} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete POD">
                        <ActionIcon size="sm" color="red" variant="subtle"
                          onClick={() => setDeleteTargetId(pod.id)}>
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {filteredPods.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={10} style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <Text size="sm" c="dimmed">No PODs found.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

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

      {/* ── Delete POD confirmation modal ── */}
      <Modal
        opened={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title={
          <Group gap="xs">
            <IconTrash size={18} color="var(--mantine-color-red-6)" />
            <Text fw={600} c="red">Delete POD</Text>
          </Group>
        }
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete{' '}
            <Text span fw={700}>{deleteTarget?.name}</Text>?
            {' '}Resources assigned to this POD will remain but lose their home POD assignment.
          </Text>
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
            <Text size="xs">This action cannot be undone.</Text>
          </Alert>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button color="red" leftSection={<IconTrash size={14} />}
              onClick={handleDelete} loading={deletePod.isPending}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConnectedPages pages={[
        { label: 'Jira POD Dashboard', path: '/delivery/jira', icon: <IconChartBar size={16} />, color: 'teal', description: 'Sprint velocity, ticket throughput, and support queue metrics per POD' },
        { label: 'POD Capacity Report', path: '/reports/pod-capacity', icon: <IconFlame size={16} />, color: 'orange', description: 'Available vs allocated hours across all PODs' },
        { label: 'POD Hours Report', path: '/reports/pod-hours', icon: <IconClock size={16} />, color: 'violet', description: 'Jira logged hours breakdown by POD and month' },
        { label: 'Project–POD Matrix', path: '/reports/project-pod-matrix', icon: <IconChartAreaLine size={16} />, color: 'blue', description: 'Which projects are assigned to which PODs' },
        { label: 'Capacity Hub', path: '/people/capacity', icon: <IconHexagons size={16} />, color: 'indigo', description: 'Demand, overrides, and leave across all PODs' },
        { label: 'Resources', path: '/people/resources', icon: <IconUsers size={16} />, color: 'green', description: 'Manage the people assigned to each POD' },
        { label: 'Overrides', path: '/people/resources?tab=overrides', icon: <IconArrowsShuffle size={16} />, color: 'pink', description: 'Temporary cross-POD allocation overrides' },
      ]} />

      </Stack>
    </PPPageLayout>
  );
}
