import { useState, useMemo } from 'react';
import {
  Title, Stack, Table, NumberInput, Button, Text, Group,
  Checkbox, Menu, ActionIcon, Tooltip, Badge, Paper, Select,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconChecks, IconTemplate, IconAlertTriangle, IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react';
import { useAllAvailability } from '../api/resources';
import apiClient from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useMonthLabels } from '../hooks/useMonthLabels';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageError from '../components/common/PageError';
import CsvToolbar from '../components/common/CsvToolbar';
import { availabilityColumns } from '../utils/csvColumns';
import { formatResourceName } from '../utils/formatting';
import { useDarkMode } from '../hooks/useDarkMode';

/* ── Standard full-time hours per month (baseline) ── */
const FULL_TIME_HOURS = [176, 176, 168, 176, 176, 184, 168, 176, 176, 168, 184, 168];

/* ── Standard hour templates ─────────────────── */
const TEMPLATES: Record<string, number[]> = {
  'Full-time (176h)':   FULL_TIME_HOURS,
  'Part-time 50%':      FULL_TIME_HOURS.map(h => Math.round(h * 0.5)),
  'Zero (Leave/Off)':   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export default function AvailabilityPage() {
  const { data: availability, isLoading, error } = useAllAvailability();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const dark = useDarkMode();
  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
  const overBg = dark ? 'rgba(255, 152, 0, 0.12)' : '#fff3e0';
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  /* ── Selection state ───────────────────────── */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sourceResourceId, setSourceResourceId] = useState<number | null>(null);

  /* ── Sorting state ─────────────────────────── */
  type SortField = 'name' | 'fte' | number; // number = month index
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const resourceList = useMemo(() => availability ?? [], [availability]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <IconArrowsSort size={14} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  const sortedList = useMemo(() => {
    const list = [...resourceList];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'name') {
        return dir * a.resourceName.localeCompare(b.resourceName);
      }
      if (sortField === 'fte') {
        return dir * (a.capacityFte - b.capacityFte);
      }
      // sort by month hours
      const aH = a.months[sortField as number] ?? 0;
      const bH = b.months[sortField as number] ?? 0;
      return dir * (aH - bH);
    });
    return list;
  }, [resourceList, sortField, sortDir]);

  const allSelected = resourceList.length > 0 && selected.size === resourceList.length;
  const someSelected = selected.size > 0 && !allSelected;

  /* ── Helpers ───────────────────────────────── */
  const getHours = (resourceId: number, month: number): number => {
    const key = `${resourceId}-${month}`;
    if (edits[key] !== undefined) return edits[key];
    const row = resourceList.find(a => a.resourceId === resourceId);
    return row?.months[month] ?? 0;
  };

  /** Max allowed hours = full-time baseline × capacityFte */
  const getMaxHours = (capacityFte: number, monthIdx: number): number => {
    return Math.round(FULL_TIME_HOURS[monthIdx - 1] * capacityFte);
  };

  const handleChange = (resourceId: number, month: number, value: number) => {
    setEdits(prev => ({ ...prev, [`${resourceId}-${month}`]: value }));
  };

  /* ── Toggle selection ──────────────────────── */
  const toggleSelect = (resourceId: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(resourceList.map(r => r.resourceId)));
    }
  };

  /* ── Copy from source to selected ──────────── */
  const copyToSelected = () => {
    if (sourceResourceId === null || selected.size === 0) return;
    const newEdits = { ...edits };
    for (const targetId of selected) {
      if (targetId === sourceResourceId) continue;
      for (const m of months) {
        newEdits[`${targetId}-${m}`] = getHours(sourceResourceId, m);
      }
    }
    setEdits(newEdits);
    notifications.show({
      title: 'Copied',
      message: `Hours copied to ${selected.size} resource(s)`,
      color: 'blue',
    });
  };

  /* ── Apply template to selected (FTE-adjusted) ── */
  const applyTemplate = (templateName: string) => {
    const targets = selected.size > 0 ? selected : new Set(resourceList.map(r => r.resourceId));
    const baseHours = TEMPLATES[templateName];
    if (!baseHours) return;
    const newEdits = { ...edits };
    for (const targetId of targets) {
      const row = resourceList.find(r => r.resourceId === targetId);
      const fte = row?.capacityFte ?? 1;
      for (const m of months) {
        // Scale template hours by FTE for non-zero templates
        const h = templateName === 'Zero (Leave/Off)' ? 0 : Math.round(baseHours[m - 1] * fte);
        newEdits[`${targetId}-${m}`] = h;
      }
    }
    setEdits(newEdits);
    notifications.show({
      title: 'Template Applied',
      message: `"${templateName}" applied to ${targets.size} resource(s) (FTE-adjusted)`,
      color: 'blue',
    });
  };

  /* ── Apply uniform value to selected ───────── */
  const [uniformValue, setUniformValue] = useState<number>(176);
  const applyUniform = () => {
    const targets = selected.size > 0 ? selected : new Set(resourceList.map(r => r.resourceId));
    const newEdits = { ...edits };
    for (const targetId of targets) {
      for (const m of months) {
        newEdits[`${targetId}-${m}`] = uniformValue;
      }
    }
    setEdits(newEdits);
    notifications.show({
      title: 'Applied',
      message: `${uniformValue}h set for ${targets.size} resource(s)`,
      color: 'blue',
    });
  };

  /* ── Count warnings ────────────────────────── */
  const warningCount = useMemo(() => {
    let count = 0;
    for (const row of resourceList) {
      if (row.capacityFte >= 1) continue;
      for (const m of months) {
        const hours = getHours(row.resourceId, m);
        const max = getMaxHours(row.capacityFte, m);
        if (hours > max) count++;
      }
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceList, edits]);

  /* ── Save ───────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const byResource = new Map<number, { monthIndex: number; hours: number }[]>();
      for (const [key, val] of Object.entries(edits)) {
        const [resId, month] = key.split('-').map(Number);
        if (!byResource.has(resId)) byResource.set(resId, []);
        byResource.get(resId)!.push({ monthIndex: month, hours: val });
      }
      await Promise.all(
        Array.from(byResource.entries()).map(([resId, entries]) =>
          apiClient.put(`/resources/${resId}/availability`, entries)
        )
      );
      setEdits({});
      setSelected(new Set());
      setSourceResourceId(null);
      qc.invalidateQueries({ queryKey: ['availability'] });
      notifications.show({ title: 'Saved', message: 'Availability updated', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save availability', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner variant="table" message="Loading availability..." />;
  if (error) return <PageError context="loading availability" error={error} />;

  const sourceOptions = resourceList.map(r => ({
    value: String(r.resourceId),
    label: formatResourceName(r.resourceName),
  }));

  return (
    <Stack className="page-enter stagger-children">
      <Group justify="space-between" className="slide-in-left">
        <Group gap="sm">
          <Title order={2}>Availability (Hours per Month)</Title>
          {warningCount > 0 && (
            <Tooltip label={`${warningCount} cell(s) exceed the resource's FTE capacity`}>
              <Badge color="orange" variant="light" size="lg" leftSection={<IconAlertTriangle size={14} />}>
                {warningCount} over-allocated
              </Badge>
            </Tooltip>
          )}
        </Group>
        <Group gap="sm">
          <CsvToolbar
            data={resourceList}
            columns={availabilityColumns(monthLabels)}
            filename="availability"
            onImport={(rows) => {
              const newEdits = { ...edits };
              rows.forEach(row => {
                const match = resourceList.find(r => r.resourceName.toLowerCase() === (row.resourceName ?? '').toLowerCase());
                if (!match) return;
                for (let m = 1; m <= 12; m++) {
                  const val = Number(row[`months.${m}`]);
                  if (!isNaN(val)) newEdits[`${match.resourceId}-${m}`] = val;
                }
              });
              setEdits(newEdits);
              notifications.show({ title: 'Imported', message: 'Availability loaded from CSV — click Save to persist', color: 'blue' });
            }}
          />
          <Button onClick={handleSave} disabled={Object.keys(edits).length === 0} loading={saving}>
            Save Changes
          </Button>
        </Group>
      </Group>

      {/* ── Toolbar ─────────────────────────────── */}
      <Paper withBorder p="sm" radius="md">
        <Group gap="md" wrap="wrap">
          {/* Copy from resource */}
          <Group gap="xs">
            <Select
              placeholder="Copy from..."
              data={sourceOptions}
              value={sourceResourceId ? String(sourceResourceId) : null}
              onChange={v => setSourceResourceId(v ? Number(v) : null)}
              size="xs"
              w={180}
              clearable
              searchable
            />
            <Tooltip label={selected.size === 0 ? 'Select target resources first' : `Paste to ${selected.size} selected`}>
              <ActionIcon
                variant="light"
                color="blue"
                onClick={copyToSelected}
                disabled={sourceResourceId === null || selected.size === 0}
                size="lg"
              >
                <IconCopy size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Divider */}
          <Text c="dimmed">|</Text>

          {/* Set uniform hours */}
          <Group gap="xs">
            <NumberInput
              value={uniformValue}
              onChange={v => setUniformValue(Number(v))}
              min={0}
              max={300}
              size="xs"
              w={80}
            />
            <Tooltip label={selected.size > 0 ? `Set for ${selected.size} selected` : 'Set for all resources'}>
              <ActionIcon variant="light" color="teal" onClick={applyUniform} size="lg">
                <IconChecks size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Divider */}
          <Text c="dimmed">|</Text>

          {/* Templates */}
          <Menu shadow="md" width={220}>
            <Menu.Target>
              <Tooltip label={selected.size > 0 ? `Apply to ${selected.size} selected` : 'Apply to all resources'}>
                <ActionIcon variant="light" color="grape" size="lg">
                  <IconTemplate size={18} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Apply Template (auto-scales to FTE)</Menu.Label>
              {Object.keys(TEMPLATES).map(name => (
                <Menu.Item key={name} onClick={() => applyTemplate(name)}>
                  {name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          {selected.size > 0 && (
            <Badge variant="light" color="blue" size="lg">
              {selected.size} selected
            </Badge>
          )}
        </Group>
      </Paper>

      {/* ── Table ───────────────────────────────── */}
      <Table.ScrollContainer minWidth={1100}>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40, textAlign: 'center' }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  size="xs"
                />
              </Table.Th>
              <Table.Th style={{ minWidth: 180 }}>
                <UnstyledButton onClick={() => toggleSort('name')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Text fw={600} size="sm">Resource</Text>
                  <SortIcon field="name" />
                </UnstyledButton>
              </Table.Th>
              {months.map(m => (
                <Table.Th
                  key={m}
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    minWidth: 70,
                    cursor: 'pointer',
                    ...(currentMonthIndex && m < currentMonthIndex
                      ? { color: '#adb5bd', backgroundColor: pastBg }
                      : {}),
                  }}
                  onClick={() => toggleSort(m)}
                >
                  <Group gap={2} justify="center" wrap="nowrap">
                    {monthLabels[m] ?? `M${m}`}
                    <SortIcon field={m} />
                  </Group>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedList.map(row => {
              const isSelected = selected.has(row.resourceId);
              const isSource = row.resourceId === sourceResourceId;
              const isPartTime = row.capacityFte < 1;
              return (
                <Table.Tr
                  key={row.resourceId}
                  bg={isSource ? 'blue.0' : isSelected ? 'gray.0' : undefined}
                >
                  <Table.Td style={{ textAlign: 'center', padding: 4 }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelect(row.resourceId)}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td fw={500}>
                    <Group gap={4} wrap="nowrap">
                      <Text size="sm" fw={500} truncate>{formatResourceName(row.resourceName)}</Text>
                      {isSource && <Badge size="xs" variant="light" color="blue">source</Badge>}
                      {isPartTime && (
                        <Badge size="xs" variant="light" color="gray">
                          {Math.round(row.capacityFte * 100)}%
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  {months.map(m => {
                    const hours = getHours(row.resourceId, m);
                    const maxHours = getMaxHours(row.capacityFte, m);
                    const isOver = hours > maxHours;
                    const isPast = m < currentMonthIndex;
                    return (
                      <Table.Td
                        key={m}
                        style={{
                          padding: 4,
                          ...(isPast ? { opacity: 0.5, backgroundColor: pastBg } : {}),
                          ...(isOver && !isPast ? { backgroundColor: overBg } : {}),
                        }}
                      >
                        <Tooltip
                          label={`Exceeds ${Math.round(row.capacityFte * 100)}% FTE cap (max ${maxHours}h)`}
                          disabled={!isOver}
                          color="orange"
                        >
                          <NumberInput
                            value={hours}
                            onChange={v => handleChange(row.resourceId, m, Number(v))}
                            min={0}
                            max={300}
                            size="xs"
                            style={{ minWidth: 65 }}
                            error={isOver}
                            rightSection={isOver ? <IconAlertTriangle size={14} color="orange" /> : undefined}
                          />
                        </Tooltip>
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
