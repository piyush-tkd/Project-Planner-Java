import { useState, useMemo } from 'react';
import {
 Stack, Table, Button, Group, Modal, Select, NumberInput, TextInput, Text, ActionIcon,
 Badge, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { PPPageLayout } from '../components/pp';
import { useOverrides, useCreateOverride, useUpdateOverride, useDeleteOverride } from '../api/overrides';
import type { OverrideRequest, OverrideResponse } from '../api/overrides';
import { useResources } from '../api/resources';
import { usePods } from '../api/pods';
import CsvToolbar from '../components/common/CsvToolbar';
import { overrideColumns } from '../utils/csvColumns';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTableSort } from '../hooks/useTableSort';
import SortableHeader from '../components/common/SortableHeader';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatResourceName } from '../utils/formatting';
import { useDarkMode } from '../hooks/useDarkMode';
import { useInlineEdit } from '../hooks/useInlineEdit';
import {
  InlineSelectCell,
  InlineNumberCell,
  InlineTextCell,
} from '../components/common/InlineCell';

const emptyForm: OverrideRequest = {
 resourceId: 0,
 toPodId: 0,
 startMonth: 1,
 endMonth: 3,
 allocationPct: 100,
 notes: null,
};

export default function OverridesPage() {
 const isDark = useDarkMode();
 const { data: overrides, isLoading } = useOverrides();
 const { data: resources } = useResources();
 const { data: pods } = usePods();
 const { monthLabels } = useMonthLabels();
 const createMutation = useCreateOverride();
 const updateMutation = useUpdateOverride();
 const deleteMutation = useDeleteOverride();
 const { startEdit, stopEdit, isEditing } = useInlineEdit();

 const [modalOpen, setModalOpen] = useState(false);
 const [editId, setEditId] = useState<number | null>(null);
 const [form, setForm] = useState<OverrideRequest>(emptyForm);

 const resourceOptions = (resources ?? []).map(r => ({ value: String(r.id), label: r.name }));
 const podOptions = (pods ?? []).map(p => ({ value: String(p.id), label: p.name }));
 const monthOptions = Array.from({ length: 12 }, (_, i) => ({
   value: String(i + 1),
   label: monthLabels[i + 1] ?? `Month ${i + 1}`,
 }));

 /* ── FTE lookup and total allocation per resource ── */
 const fteMap = useMemo(() => {
 const map = new Map<number, number>();
 for (const r of resources ?? []) {
 map.set(r.id, r.podAssignment?.capacityFte ?? 1);
 }
 return map;
 }, [resources]);

 // Total allocation % per resource across all overrides
 const totalAllocMap = useMemo(() => {
 const map = new Map<number, number>();
 for (const o of overrides ?? []) {
 map.set(o.resourceId, (map.get(o.resourceId) ?? 0) + o.allocationPct);
 }
 return map;
 }, [overrides]);

 const openCreate = () => {
 setForm(emptyForm);
 setEditId(null);
 setModalOpen(true);
 };

 const openEdit = (o: NonNullable<typeof overrides>[number]) => {
 setForm({
 resourceId: o.resourceId,
 toPodId: o.toPodId,
 startMonth: o.startMonth,
 endMonth: o.endMonth,
 allocationPct: o.allocationPct,
 notes: o.notes,
 });
 setEditId(o.id);
 setModalOpen(true);
 };

 const handleSubmit = () => {
 if (editId) {
 updateMutation.mutate({ id: editId, data: form }, {
 onSuccess: () => {
 setModalOpen(false);
 notifications.show({ title: 'Updated', message: 'Override updated', color: 'green' });
 },
 onError: () => notifications.show({ title: 'Error', message: 'Failed to update override', color: 'red' }),
 });
 } else {
 createMutation.mutate(form, {
 onSuccess: () => {
 setModalOpen(false);
 notifications.show({ title: 'Created', message: 'Override created', color: 'green' });
 },
 onError: () => notifications.show({ title: 'Error', message: 'Failed to create override', color: 'red' }),
 });
 }
 };

 const handleDelete = (id: number) => {
 deleteMutation.mutate(id, {
 onSuccess: () => notifications.show({ title: 'Deleted', message: 'Override deleted', color: 'red' }),
 });
 };

 const handleInlineUpdate = async (id: number, field: string, value: any) => {
   const override = overrides?.find(o => o.id === id);
   if (!override) return;

   const updated: OverrideRequest = {
     resourceId: field === 'resourceId' ? value : override.resourceId,
     toPodId: field === 'toPodId' ? value : override.toPodId,
     startMonth: field === 'startMonth' ? value : override.startMonth,
     endMonth: field === 'endMonth' ? value : override.endMonth,
     allocationPct: field === 'allocationPct' ? value : override.allocationPct,
     notes: field === 'notes' ? value : override.notes,
   };

   return new Promise<void>((resolve, reject) => {
     updateMutation.mutate({ id, data: updated }, {
       onSuccess: () => {
         stopEdit();
         notifications.show({ title: 'Updated', message: `${field} updated`, color: 'green' });
         resolve();
       },
       onError: () => {
         notifications.show({ title: 'Error', message: `Failed to update ${field}`, color: 'red' });
         reject(new Error('Update failed'));
       },
     });
   });
 };

 const { sorted: sortedOverrides, sortKey, sortDir, onSort } = useTableSort(overrides ?? []);

 if (isLoading) return <LoadingSpinner variant="table" message="Loading overrides..." />;

 return (
 <PPPageLayout
   title="Overrides"
   subtitle="Temporary resource allocation overrides across PODs"
   animate
 >
 <Group justify="space-between">
 <Group gap="sm">
 <CsvToolbar
 data={overrides ?? []}
 columns={overrideColumns}
 filename="overrides"
 onImport={(rows) => {
 rows.forEach(row => {
 const resMatch = (resources ?? []).find(r => r.name.toLowerCase() === (row.resourceName ?? '').toLowerCase());
 const podMatch = (pods ?? []).find(p => p.name.toLowerCase() === (row.toPodName ?? '').toLowerCase());
 if (!resMatch || !podMatch) return;
 createMutation.mutate({
 resourceId: resMatch.id,
 toPodId: podMatch.id,
 startMonth: Number(row.startMonth) || 1,
 endMonth: Number(row.endMonth) || 3,
 allocationPct: Number(row.allocationPct) || 100,
 notes: row.notes || null,
 });
 });
 }}
 />
 <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Add Override</Button>
 </Group>
 </Group>

 <Table fz="xs" withTableBorder withColumnBorders highlightOnHover>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ width: 40 }}>#</Table.Th>
 <SortableHeader sortKey="resourceName" currentKey={sortKey} dir={sortDir} onSort={onSort}>Resource</SortableHeader>
 <SortableHeader sortKey="toPodName" currentKey={sortKey} dir={sortDir} onSort={onSort}>To POD</SortableHeader>
 <SortableHeader sortKey="startMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>Start Month</SortableHeader>
 <SortableHeader sortKey="endMonth" currentKey={sortKey} dir={sortDir} onSort={onSort}>End Month</SortableHeader>
 <SortableHeader sortKey="allocationPct" currentKey={sortKey} dir={sortDir} onSort={onSort}>Allocation %</SortableHeader>
 <Table.Th>Resource FTE</Table.Th>
 <Table.Th>Reason</Table.Th>
 <Table.Th>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {sortedOverrides.map((o, idx) => {
 const fte = fteMap.get(o.resourceId) ?? 1;
 const isPartTime = fte < 1;
 const totalAlloc = totalAllocMap.get(o.resourceId) ?? 0;
 const fteAsPct = Math.round(fte * 100);
 const isOverAlloc = totalAlloc > fteAsPct;
 return (
 <Table.Tr key={o.id}>
 <Table.Td c="dimmed" style={{ fontSize: 12 }}>{idx + 1}</Table.Td>
 <Table.Td>
   <InlineSelectCell
     value={String(o.resourceId)}
     options={resourceOptions}
     onSave={async (v) => handleInlineUpdate(o.id, 'resourceId', Number(v))}
     isEditing={isEditing(o.id, 'resourceId')}
     onStartEdit={() => startEdit(o.id, 'resourceId')}
     onCancel={() => stopEdit()}
     placeholder="Select resource"
   />
 </Table.Td>
 <Table.Td>
   <InlineSelectCell
     value={String(o.toPodId)}
     options={podOptions}
     onSave={async (v) => handleInlineUpdate(o.id, 'toPodId', Number(v))}
     isEditing={isEditing(o.id, 'toPodId')}
     onStartEdit={() => startEdit(o.id, 'toPodId')}
     onCancel={() => stopEdit()}
     placeholder="Select pod"
   />
 </Table.Td>
 <Table.Td>
   <InlineSelectCell
     value={String(o.startMonth)}
     options={monthOptions}
     onSave={async (v) => handleInlineUpdate(o.id, 'startMonth', Number(v))}
     isEditing={isEditing(o.id, 'startMonth')}
     onStartEdit={() => startEdit(o.id, 'startMonth')}
     onCancel={() => stopEdit()}
     placeholder="Start month"
   />
 </Table.Td>
 <Table.Td>
   <InlineSelectCell
     value={String(o.endMonth)}
     options={monthOptions.filter(m => Number(m.value) >= o.startMonth)}
     onSave={async (v) => handleInlineUpdate(o.id, 'endMonth', Number(v))}
     isEditing={isEditing(o.id, 'endMonth')}
     onStartEdit={() => startEdit(o.id, 'endMonth')}
     onCancel={() => stopEdit()}
     placeholder="End month"
   />
 </Table.Td>
 <Table.Td>
   <InlineNumberCell
     value={o.allocationPct}
     min={0}
     max={100}
     suffix="%"
     onSave={async (v) => handleInlineUpdate(o.id, 'allocationPct', v)}
     isEditing={isEditing(o.id, 'allocationPct')}
     onStartEdit={() => startEdit(o.id, 'allocationPct')}
     onCancel={() => stopEdit()}
   />
 </Table.Td>
 <Table.Td>
 <Badge variant="light" color={isPartTime ? 'orange' : 'green'} size="sm">
 {isPartTime ? `${fteAsPct}%` : '100%'}
 </Badge>
 </Table.Td>
 <Table.Td>
   <InlineTextCell
     value={o.notes ?? ''}
     onSave={async (v) => handleInlineUpdate(o.id, 'notes', v || null)}
     isEditing={isEditing(o.id, 'notes')}
     onStartEdit={() => startEdit(o.id, 'notes')}
     onCancel={() => stopEdit()}
     placeholder="Add reason…"
     maxWidth={200}
   />
 </Table.Td>
 <Table.Td>
 <Group gap={4}>
 <ActionIcon variant="subtle" onClick={() => openEdit(o)}><IconEdit size={16} /></ActionIcon>
 <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(o.id)}><IconTrash size={16} /></ActionIcon>
 </Group>
 </Table.Td>
 </Table.Tr>
 );
 })}
 {(overrides ?? []).length === 0 && (
 <Table.Tr>
 <Table.Td colSpan={9}><Text ta="center" c="dimmed" py="md">No overrides</Text></Table.Td>
 </Table.Tr>
 )}
 </Table.Tbody>
 </Table>

 <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Override' : 'Add Override'}>
 <Stack>
 <Select label="Resource" data={resourceOptions} value={form.resourceId ? String(form.resourceId) : null} onChange={v => setForm({ ...form, resourceId: Number(v) })} required searchable />
 <Select label="To POD" data={podOptions} value={form.toPodId ? String(form.toPodId) : null} onChange={v => setForm({ ...form, toPodId: Number(v) })} required searchable />
 <Group grow>
 <Select
   label="Start Month"
   data={Array.from({ length: 12 }, (_, i) => ({
     value: String(i + 1),
     label: monthLabels[i + 1] ?? `Month ${i + 1}`,
   }))}
   value={String(form.startMonth)}
   onChange={v => setForm({ ...form, startMonth: Number(v) })}
   required
 />
 <Select
   label="End Month"
   data={Array.from({ length: 12 }, (_, i) => ({
     value: String(i + 1),
     label: monthLabels[i + 1] ?? `Month ${i + 1}`,
   })).filter(o => Number(o.value) >= form.startMonth)}
   value={String(form.endMonth)}
   onChange={v => setForm({ ...form, endMonth: Number(v) })}
   required
 />
 </Group>
 <NumberInput
 label="Allocation %"
 value={form.allocationPct}
 onChange={v => setForm({ ...form, allocationPct: Number(v) })}
 min={0}
 max={100}
 error={
 form.resourceId && form.allocationPct > Math.round((fteMap.get(form.resourceId) ?? 1) * 100)
 ? `Exceeds resource's ${Math.round((fteMap.get(form.resourceId) ?? 1) * 100)}% FTE capacity`
 : undefined
 }
 />
 <TextInput label="Reason" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value || null })} />
 <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending}>
 {editId ? 'Update' : 'Create'}
 </Button>
 </Stack>
 </Modal>
 </PPPageLayout>
 );
}
