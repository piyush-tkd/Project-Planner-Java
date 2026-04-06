import { useState, useMemo } from 'react';
import {
  Title, Stack, Table, NumberInput, Button, Text, Group,
  Checkbox, Menu, ActionIcon, Tooltip, Badge, Paper, Select,
  UnstyledButton, ScrollArea, SimpleGrid, RingProgress, Center,
  Divider, SegmentedControl, ThemeIcon, TextInput, Avatar,
} from '@mantine/core';
import { DEEP_BLUE, FONT_FAMILY } from '../brandTokens';
import { notifications } from '@mantine/notifications';
import {
  IconCopy, IconChecks, IconTemplate, IconAlertTriangle,
  IconArrowUp, IconArrowDown, IconArrowsSort, IconCalendarOff,
  IconUsers, IconClock, IconBeach, IconSunHigh, IconSearch,
} from '@tabler/icons-react';
import { useAllAvailability, useResources } from '../api/resources';
import apiClient from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useMonthLabels } from '../hooks/useMonthLabels';
import { useTimeline } from '../api/timeline';
import { useLeaveEntries } from '../api/leave';
import { useHolidayDeductions } from '../api/holidays';
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
  const { data: allResources = [] } = useResources();
  const avatarMap = useMemo(() => {
    const m = new Map<number, { avatarUrl?: string | null; jiraAccountId?: string | null }>();
    for (const r of allResources) m.set(r.id, { avatarUrl: r.avatarUrl, jiraAccountId: r.jiraAccountId });
    return m;
  }, [allResources]);
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const dark = useDarkMode();
  const { data: timeline } = useTimeline();
  const planningYear = timeline?.startYear  ?? new Date().getFullYear();
  const startMonth   = timeline?.startMonth ?? 1;
  const { data: leaveEntries = [] } = useLeaveEntries(planningYear);
  const { data: holidayDeductions = {} } = useHolidayDeductions(planningYear);

  /** Convert timeline position (1–12) to real calendar month (1–12). */
  const toCalendarMonth = (timelinePos: number): number =>
    ((startMonth - 1 + timelinePos - 1) % 12) + 1;

  /** leaveMap: resourceId → CALENDAR month → total leave hours */
  const leaveMap = useMemo(() => {
    const map: Record<number, Record<number, number>> = {};
    for (const e of leaveEntries) {
      if (!map[e.resourceId]) map[e.resourceId] = {};
      map[e.resourceId][e.monthIndex] = (map[e.resourceId][e.monthIndex] ?? 0) + e.leaveHours;
    }
    return map;
  }, [leaveEntries]);

  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [sourceResourceId, setSourceResourceId] = useState<number | null>(null);
  const [locationFilter, setLocationFilter]     = useState<string>('ALL');
  const [search, setSearch]                     = useState<string>('');

  type SortField = 'name' | 'fte' | 'total' | number;
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('asc');

  const months      = Array.from({ length: 12 }, (_, i) => i + 1);
  const resourceList = useMemo(() => availability ?? [], [availability]);

  const pastBg = dark ? 'rgba(255,255,255,0.04)' : '#f8f9fa';
  const overBg = dark ? 'rgba(255, 152, 0, 0.12)' : '#fff3e0';

  /* ── Helpers ───────────────────────────────── */
  const getHours = (resourceId: number, month: number): number => {
    const key = `${resourceId}-${month}`;
    if (edits[key] !== undefined) return edits[key];
    const row = resourceList.find(a => a.resourceId === resourceId);
    return row?.months[month] ?? 0;
  };

  const getMaxHours = (capacityFte: number, monthIdx: number): number =>
    Math.round(FULL_TIME_HOURS[monthIdx - 1] * capacityFte);

  const handleChange = (resourceId: number, month: number, value: number) =>
    setEdits(prev => ({ ...prev, [`${resourceId}-${month}`]: value }));

  /* ── Net hours for a resource/month ────────── */
  const getNetHours = (resourceId: number, location: string | null | undefined, timelinePos: number): {
    gross: number; holidayH: number; leaveH: number; net: number;
  } => {
    const gross    = getHours(resourceId, timelinePos);
    const calMonth = toCalendarMonth(timelinePos);
    const holidayH = location ? (holidayDeductions[location]?.[calMonth] ?? 0) : 0;
    const leaveH   = leaveMap[resourceId]?.[calMonth] ?? 0;
    const net      = Math.max(0, gross - holidayH - leaveH);
    return { gross, holidayH, leaveH, net };
  };

  /* ── Year totals per resource ───────────────── */
  const getYearNet = (resourceId: number, location: string | null | undefined): number =>
    months.reduce((sum, m) => sum + getNetHours(resourceId, location, m).net, 0);

  /* ── Summary stats ──────────────────────────── */
  const summaryStats = useMemo(() => {
    let totalGross = 0, totalHolidayDeduct = 0, totalLeaveDeduct = 0;
    let resourcesWithLeave = new Set<number>();
    let overAllocated = 0;

    for (const row of resourceList) {
      const loc = row.location ?? undefined;
      for (const m of months) {
        const { gross, holidayH, leaveH } = getNetHours(row.resourceId, loc, m);
        totalGross         += gross;
        totalHolidayDeduct += holidayH;
        totalLeaveDeduct   += leaveH;
        if (leaveH > 0) resourcesWithLeave.add(row.resourceId);
        const max = getMaxHours(row.capacityFte, m);
        if (gross > max && row.capacityFte < 1) overAllocated++;
      }
    }

    const netHours   = Math.max(0, totalGross - totalHolidayDeduct - totalLeaveDeduct);
    const deductPct  = totalGross > 0 ? Math.round(((totalHolidayDeduct + totalLeaveDeduct) / totalGross) * 100) : 0;
    return { totalGross, totalHolidayDeduct, totalLeaveDeduct, netHours, deductPct, resourcesOnLeave: resourcesWithLeave.size, overAllocated };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceList, edits, leaveMap, holidayDeductions]);

  /* ── Column totals ─────────────────────────── */
  const columnTotals = useMemo(() => {
    const totals: Record<number, { gross: number; net: number }> = {};
    for (const m of months) {
      let gross = 0, net = 0;
      for (const row of resourceList) {
        const { gross: g, net: n } = getNetHours(row.resourceId, row.location, m);
        gross += g; net += n;
      }
      totals[m] = { gross, net };
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceList, edits, leaveMap, holidayDeductions]);

  /* ── Sorting ────────────────────────────────── */
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <IconArrowsSort size={13} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />;
  };

  const filteredList = useMemo(() => {
    let list = locationFilter === 'ALL' ? resourceList : resourceList.filter(r => (r.location ?? 'UNSET') === locationFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => r.resourceName.toLowerCase().includes(q));
    }
    return list;
  }, [resourceList, locationFilter, search]);

  const sortedList = useMemo(() => {
    const list = [...filteredList];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'name')  return dir * a.resourceName.localeCompare(b.resourceName);
      if (sortField === 'fte')   return dir * (a.capacityFte - b.capacityFte);
      if (sortField === 'total') return dir * (getYearNet(a.resourceId, a.location) - getYearNet(b.resourceId, b.location));
      const aH = a.months[sortField as number] ?? 0;
      const bH = b.months[sortField as number] ?? 0;
      return dir * (aH - bH);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredList, sortField, sortDir, edits]);

  const allSelected  = sortedList.length > 0 && sortedList.every(r => selected.has(r.resourceId));
  const someSelected = sortedList.some(r => selected.has(r.resourceId)) && !allSelected;

  const toggleSelect  = (resourceId: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(resourceId) ? s.delete(resourceId) : s.add(resourceId); return s; });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sortedList.map(r => r.resourceId)));

  /* ── Copy / Template ───────────────────────── */
  const copyToSelected = () => {
    if (sourceResourceId === null || selected.size === 0) return;
    const newEdits = { ...edits };
    for (const targetId of selected) {
      if (targetId === sourceResourceId) continue;
      for (const m of months) newEdits[`${targetId}-${m}`] = getHours(sourceResourceId, m);
    }
    setEdits(newEdits);
    notifications.show({ title: 'Copied', message: `Hours copied to ${selected.size} resource(s)`, color: 'blue' });
  };

  const applyTemplate = (templateName: string) => {
    const targets = selected.size > 0 ? selected : new Set(resourceList.map(r => r.resourceId));
    const baseHours = TEMPLATES[templateName];
    if (!baseHours) return;
    const newEdits = { ...edits };
    for (const targetId of targets) {
      const row = resourceList.find(r => r.resourceId === targetId);
      const fte = row?.capacityFte ?? 1;
      for (const m of months) {
        newEdits[`${targetId}-${m}`] = templateName === 'Zero (Leave/Off)' ? 0 : Math.round(baseHours[m - 1] * fte);
      }
    }
    setEdits(newEdits);
    notifications.show({ title: 'Template Applied', message: `"${templateName}" applied (FTE-adjusted)`, color: 'blue' });
  };

  const [uniformValue, setUniformValue] = useState<number>(176);
  const applyUniform = () => {
    const targets = selected.size > 0 ? selected : new Set(resourceList.map(r => r.resourceId));
    const newEdits = { ...edits };
    for (const targetId of targets) {
      for (const m of months) newEdits[`${targetId}-${m}`] = uniformValue;
    }
    setEdits(newEdits);
    notifications.show({ title: 'Applied', message: `${uniformValue}h set for ${targets.size} resource(s)`, color: 'blue' });
  };

  const warningCount = useMemo(() => {
    let count = 0;
    for (const row of resourceList) {
      if (row.capacityFte >= 1) continue;
      for (const m of months) {
        if (getHours(row.resourceId, m) > getMaxHours(row.capacityFte, m)) count++;
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
      qc.invalidateQueries({ queryKey: ['reports'] });  // refresh Team Calendar, capacity gap, etc.
      notifications.show({ title: 'Saved', message: 'Availability updated', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save availability', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner variant="table" message="Loading availability..." />;
  if (error)     return <PageError context="loading availability" error={error} />;

  const sourceOptions = resourceList.map(r => ({
    value: String(r.resourceId),
    label: formatResourceName(r.resourceName),
  }));

  const locationCounts: Record<string, number> = {};
  for (const r of resourceList) locationCounts[r.location ?? 'UNSET'] = (locationCounts[r.location ?? 'UNSET'] ?? 0) + 1;
  const locationOptions = [
    { label: `All (${resourceList.length})`, value: 'ALL' },
    ...(locationCounts['US']    ? [{ label: `🇺🇸 US (${locationCounts['US']})`,       value: 'US' }]    : []),
    ...(locationCounts['INDIA'] ? [{ label: `🇮🇳 India (${locationCounts['INDIA']})`, value: 'INDIA' }] : []),
    ...(locationCounts['UNSET'] ? [{ label: `− No location (${locationCounts['UNSET']})`, value: 'UNSET' }] : []),
  ];

  const netPct = summaryStats.totalGross > 0
    ? Math.round((summaryStats.netHours / summaryStats.totalGross) * 100)
    : 100;

  return (
    <Stack className="page-enter stagger-children" gap="md">

      {/* ── Header ────────────────────────────────── */}
      <Group justify="space-between" className="slide-in-left">
        <Group gap="sm">
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
            Availability
          </Title>
          <Text c="dimmed" size="sm">Hours per month · {planningYear}</Text>
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
              notifications.show({ title: 'Imported', message: 'Click Save to persist', color: 'blue' });
            }}
          />
          <Button onClick={handleSave} disabled={Object.keys(edits).length === 0} loading={saving}>
            Save Changes
          </Button>
        </Group>
      </Group>

      {/* ── Summary Stats ─────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="sm">
        <Paper withBorder p="md" radius="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={36} radius="md" color="blue" variant="light">
              <IconUsers size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" fw={500}>Resources</Text>
              <Text size="xl" fw={700}>{resourceList.length}</Text>
            </div>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={36} radius="md" color="teal" variant="light">
              <IconClock size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" fw={500}>Gross Hours</Text>
              <Text size="xl" fw={700}>{summaryStats.totalGross.toLocaleString()}h</Text>
            </div>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={36} radius="md" color="blue" variant="light">
              <IconSunHigh size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" fw={500}>Holiday Deductions</Text>
              <Text size="xl" fw={700} c="blue">−{summaryStats.totalHolidayDeduct.toLocaleString()}h</Text>
            </div>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={36} radius="md" color="orange" variant="light">
              <IconBeach size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" fw={500}>Leave Deductions</Text>
              <Text size="xl" fw={700} c="orange">−{summaryStats.totalLeaveDeduct.toLocaleString()}h</Text>
              {summaryStats.resourcesOnLeave > 0 && (
                <Text size="xs" c="dimmed">{summaryStats.resourcesOnLeave} resources</Text>
              )}
            </div>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap="sm" wrap="nowrap" align="center">
            <RingProgress
              size={52}
              thickness={5}
              roundCaps
              sections={[{ value: netPct, color: netPct > 80 ? 'teal' : netPct > 60 ? 'yellow' : 'red' }]}
              label={<Center><Text size="9px" fw={700}>{netPct}%</Text></Center>}
            />
            <div>
              <Text size="xs" c="dimmed" fw={500}>Net Available</Text>
              <Text size="xl" fw={700} c="teal">{summaryStats.netHours.toLocaleString()}h</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ── Toolbar ─────────────────────────────── */}
      <Paper withBorder p="sm" radius="md">
        <Group gap="md" wrap="wrap" justify="space-between">
          <Group gap="sm">
            {/* Search */}
            <TextInput
              placeholder="Search resources…"
              value={search}
              onChange={e => setSearch(e.currentTarget.value)}
              leftSection={<IconSearch size={14} />}
              size="xs"
              w={200}
            />
            {/* Location filter */}
            <SegmentedControl
              size="xs"
              value={locationFilter}
              onChange={setLocationFilter}
              data={locationOptions}
            />
          </Group>

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
                <ActionIcon variant="light" color="blue" onClick={copyToSelected}
                  disabled={sourceResourceId === null || selected.size === 0} size="lg">
                  <IconCopy size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" />

            {/* Uniform hours */}
            <Group gap="xs">
              <NumberInput value={uniformValue} onChange={v => setUniformValue(Number(v))}
                min={0} max={300} size="xs" w={80} />
              <Tooltip label={selected.size > 0 ? `Set for ${selected.size} selected` : 'Set for all resources'}>
                <ActionIcon variant="light" color="teal" onClick={applyUniform} size="lg">
                  <IconChecks size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" />

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
                  <Menu.Item key={name} onClick={() => applyTemplate(name)}>{name}</Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            {selected.size > 0 && (
              <Badge variant="light" color="blue" size="lg">{selected.size} selected</Badge>
            )}
          </Group>
        </Group>
      </Paper>

      {/* ── Legend ──────────────────────────────── */}
      <Group gap="lg" px={4}>
        <Group gap={6}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: dark ? 'rgba(99,179,237,0.2)' : '#dbeafe', border: '1px solid #93c5fd' }} />
          <Text size="xs" c="dimmed">🎌 Holiday deducted (blue)</Text>
        </Group>
        <Group gap={6}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: dark ? 'rgba(251,146,60,0.2)' : '#ffedd5', border: '1px solid #f97316' }} />
          <Text size="xs" c="dimmed">🌴 Leave deducted (amber)</Text>
        </Group>
        <Group gap={6}>
          <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: dark ? 'rgba(255,152,0,0.12)' : '#fff3e0', border: '1px solid #fb923c' }} />
          <Text size="xs" c="dimmed">Over-allocated (orange)</Text>
        </Group>
        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          Values shown are net available hours · hover deduction badges for breakdown
        </Text>
      </Group>

      {/* ── Table ───────────────────────────────── */}
      <ScrollArea>
        <Table fz="xs" withTableBorder withColumnBorders style={{ minWidth: 1100 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 36, textAlign: 'center' }}>
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} size="xs" />
              </Table.Th>
              <Table.Th style={{ minWidth: 190 }}>
                <UnstyledButton onClick={() => toggleSort('name')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Text fw={600} size="xs">Resource</Text>
                  <SortIcon field="name" />
                </UnstyledButton>
              </Table.Th>
              <Table.Th style={{ width: 52, textAlign: 'center' }}>
                <UnstyledButton onClick={() => toggleSort('fte')} style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                  <Text fw={600} size="xs">FTE</Text>
                  <SortIcon field="fte" />
                </UnstyledButton>
              </Table.Th>
              {months.map(m => (
                <Table.Th
                  key={m}
                  style={{
                    textAlign: 'center', fontSize: 11, minWidth: 72, cursor: 'pointer',
                    ...(currentMonthIndex && m < currentMonthIndex ? { color: '#adb5bd', backgroundColor: pastBg } : {}),
                  }}
                  onClick={() => toggleSort(m)}
                >
                  <Stack gap={0} align="center">
                    <Group gap={2} justify="center" wrap="nowrap">
                      <span style={{ fontWeight: 600 }}>{monthLabels[m] ?? `M${m}`}</span>
                      <SortIcon field={m} />
                    </Group>
                    <Text size="9px" c="dimmed" fw={400}>
                      {columnTotals[m]?.net.toLocaleString() ?? 0}h
                    </Text>
                  </Stack>
                </Table.Th>
              ))}
              <Table.Th style={{ textAlign: 'center', minWidth: 70, cursor: 'pointer' }} onClick={() => toggleSort('total')}>
                <UnstyledButton style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                  <Text fw={600} size="xs">Total</Text>
                  <SortIcon field="total" />
                </UnstyledButton>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {sortedList.map(row => {
              const isSelected = selected.has(row.resourceId);
              const isSource   = row.resourceId === sourceResourceId;
              const isPartTime = row.capacityFte < 1;
              const location   = row.location ?? undefined;
              const yearNet    = getYearNet(row.resourceId, location);
              const yearGross  = months.reduce((s, m) => s + getHours(row.resourceId, m), 0);
              const hasAnyLeave = Object.keys(leaveMap[row.resourceId] ?? {}).length > 0;

              return (
                <Table.Tr key={row.resourceId} bg={isSource ? (dark ? 'blue.9' : 'blue.0') : isSelected ? (dark ? 'dark.6' : 'gray.0') : undefined}>

                  {/* Checkbox */}
                  <Table.Td style={{ textAlign: 'center', padding: 4 }}>
                    <Checkbox checked={isSelected} onChange={() => toggleSelect(row.resourceId)} size="xs" />
                  </Table.Td>

                  {/* Resource Name */}
                  <Table.Td style={{ padding: '4px 8px' }}>
                    <Stack gap={2}>
                      <Group gap={4} wrap="nowrap">
                        {(() => {
                          const info = avatarMap.get(row.resourceId);
                          return (
                            <Tooltip label={info?.jiraAccountId ? 'Jira connected' : row.resourceName} withArrow position="top">
                              <Avatar
                                src={info?.avatarUrl ?? null}
                                size={20}
                                radius="xl"
                                color={info?.jiraAccountId ? 'teal' : 'gray'}
                              >
                                {row.resourceName.charAt(0).toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          );
                        })()}
                        <Text size="xs" fw={600} truncate style={{ maxWidth: 120 }}>
                          {formatResourceName(row.resourceName)}
                        </Text>
                        {isSource && <Badge size="xs" variant="light" color="blue">source</Badge>}
                      </Group>
                      <Group gap={4} wrap="nowrap">
                        {location === 'US' && (
                          <Badge size="xs" variant="outline" color="blue" style={{ fontSize: 9 }}>🇺🇸 US</Badge>
                        )}
                        {location === 'INDIA' && (
                          <Badge size="xs" variant="outline" color="indigo" style={{ fontSize: 9 }}>🇮🇳 India</Badge>
                        )}
                        {!location && (
                          <Badge size="xs" variant="outline" color="gray" style={{ fontSize: 9 }}>No loc</Badge>
                        )}
                        {isPartTime && (
                          <Badge size="xs" variant="light" color="gray">{Math.round(row.capacityFte * 100)}%</Badge>
                        )}
                        {hasAnyLeave && (
                          <Tooltip label="Has planned leave this year — auto-deducted from capacity" color="orange" withArrow>
                            <Badge size="xs" variant="light" color="orange" leftSection={<IconCalendarOff size={9} />}>
                              leave
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Stack>
                  </Table.Td>

                  {/* FTE */}
                  <Table.Td style={{ textAlign: 'center', padding: 4 }}>
                    <Text size="xs" c={isPartTime ? 'orange' : 'dimmed'} fw={isPartTime ? 600 : 400}>
                      {row.capacityFte.toFixed(1)}
                    </Text>
                  </Table.Td>

                  {/* Month cells */}
                  {months.map(m => {
                    const { gross, holidayH, leaveH, net } = getNetHours(row.resourceId, location, m);
                    const maxGross    = getMaxHours(row.capacityFte, m);
                    const maxNet      = Math.max(0, maxGross - holidayH - leaveH);
                    const isOver      = gross > maxGross;
                    const isPast      = !!currentMonthIndex && m < currentMonthIndex;
                    const hasDeduct   = holidayH > 0 || leaveH > 0;
                    const leaveBg     = dark ? 'rgba(251,146,60,0.12)' : '#fff7ed';
                    const holidayBg   = dark ? 'rgba(99,179,237,0.12)' : '#eff6ff';

                    const cellBg = (() => {
                      if (isPast) return pastBg;
                      if (isOver) return overBg;
                      if (leaveH > 0) return leaveBg;
                      if (holidayH > 0) return holidayBg;
                      return undefined;
                    })();

                    const tooltipParts: string[] = [];
                    if (isOver) tooltipParts.push(`⚠ Exceeds FTE cap (net max ${maxNet}h)`);
                    if (holidayH > 0) tooltipParts.push(`🎌 ${holidayH}h holiday deducted`);
                    if (leaveH > 0)   tooltipParts.push(`🌴 ${leaveH}h leave deducted`);
                    if (hasDeduct)    tooltipParts.push(`Gross stored: ${gross}h`);

                    return (
                      <Table.Td key={m} style={{ padding: '3px 4px', backgroundColor: cellBg, opacity: isPast ? 0.55 : 1 }}>
                        <Tooltip
                          label={tooltipParts.join(' · ')}
                          disabled={tooltipParts.length === 0}
                          color={isOver ? 'orange' : 'dark'}
                          withArrow multiline maw={260}
                        >
                          <Stack gap={1} align="center">
                            {/* Input shows NET — on change we store gross = net + deductions */}
                            <NumberInput
                              value={net}
                              onChange={v => handleChange(row.resourceId, m, Number(v) + holidayH + leaveH)}
                              min={0} max={maxNet > 0 ? maxNet : 300} size="xs"
                              style={{ width: 64 }}
                              error={isOver}
                              rightSection={
                                isOver
                                  ? <IconAlertTriangle size={13} color="orange" />
                                  : undefined
                              }
                            />
                            {/* Deduction indicators — orange for leave, blue for holiday */}
                            {hasDeduct && !isPast && (
                              <Group gap={3} justify="center" wrap="nowrap" style={{ lineHeight: 1 }}>
                                {holidayH > 0 && (
                                  <Tooltip label={`${holidayH}h public holiday`} color="blue" withArrow>
                                    <Text size="9px" c="blue" fw={700} style={{ cursor: 'default' }}>
                                      −{holidayH}🎌
                                    </Text>
                                  </Tooltip>
                                )}
                                {leaveH > 0 && (
                                  <Tooltip label={`${leaveH}h planned leave`} color="orange" withArrow>
                                    <Text size="9px" c="orange" fw={700} style={{ cursor: 'default' }}>
                                      −{leaveH}🌴
                                    </Text>
                                  </Tooltip>
                                )}
                              </Group>
                            )}
                          </Stack>
                        </Tooltip>
                      </Table.Td>
                    );
                  })}

                  {/* Year Total — shows net (same as cells) */}
                  <Table.Td style={{ textAlign: 'center', padding: '4px 6px', backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
                    <Text size="xs" fw={700}>{yearNet.toLocaleString()}h</Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>

          {/* ── Totals footer ───────────────────── */}
          <Table.Tfoot>
            <Table.Tr style={{ backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
              <Table.Td colSpan={3} style={{ padding: '6px 8px' }}>
                <Text size="xs" fw={700} c="dimmed">
                  TOTALS ({sortedList.length} resources)
                </Text>
              </Table.Td>
              {months.map(m => (
                <Table.Td key={m} style={{ textAlign: 'center', padding: '4px 6px' }}>
                  <Text size="xs" fw={700}>{(columnTotals[m]?.net ?? 0).toLocaleString()}h</Text>
                </Table.Td>
              ))}
              <Table.Td style={{ textAlign: 'center', padding: '4px 6px' }}>
                <Text size="xs" fw={700}>
                  {months.reduce((s, m) => s + (columnTotals[m]?.net ?? 0), 0).toLocaleString()}h
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
