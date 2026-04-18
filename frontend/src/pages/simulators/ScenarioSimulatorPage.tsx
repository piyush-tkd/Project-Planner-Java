import { useState, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import {
 Stack, Grid, Card, Text, Button, Group, Table, Badge,
 Checkbox, NumberInput, Collapse, ActionIcon, Tooltip, Alert,
 SimpleGrid, SegmentedControl, ThemeIcon, Divider, ScrollArea,
} from '@mantine/core';
import {
 IconPlayerPlay, IconChevronDown, IconChevronUp, IconAdjustments,
 IconRefresh, IconAlertTriangle, IconCircleCheck, IconInfoCircle,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useProjects } from '../../api/projects';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getGapCellColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import { formatHours } from '../../utils/formatting';
import { ProjectStatus } from '../../types';
import { SURFACE_RED_FAINT, SURFACE_SUBTLE, SURFACE_SUCCESS_LIGHT} from '../../brandTokens';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/ui';
import { PPPageLayout } from '../../components/pp';
import apiClient from '../../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectOverride {
 projectId: number;
 newStartMonth?: number;
 newDuration?: number;
}

interface PodMonthGap {
 podName: string;
 monthIndex: number;
 monthLabel: string;
 gapHours: number;
}

interface SimResult {
 baseline: { gaps: PodMonthGap[] };
 simulated: { gaps: PodMonthGap[] };
 deltas: { gaps: PodMonthGap[] };
}

function useRunScenario() {
 return useMutation<SimResult, Error, { projectOverrides: ProjectOverride[] }>({
 mutationFn: body => apiClient.post('/simulator/timeline', body).then(r => r.data),
 });
}

// ── Per-project state ─────────────────────────────────────────────────────────

interface ProjectState {
 included: boolean;
 startOverride: number | null;
 durationOverride: number | null;
 expanded: boolean;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScenarioSimulatorPage() {
 const { data: projects, isLoading } = useProjects();
 const { monthLabels, currentMonthIndex } = useMonthLabels();
 const dark = useDarkMode();
 const pastBg = dark ? 'rgba(255,255,255,0.04)' : SURFACE_SUBTLE;
 const runScenario = useRunScenario();

 const activeProjects = useMemo(
 () => (projects ?? []).filter(p => p.status === ProjectStatus.ACTIVE),
 [projects],
 );

 const [states, setStates] = useState<Record<number, ProjectState>>({});
 const [viewMode, setViewMode] = useState<'delta' | 'simulated' | 'baseline'>('delta');

 function getState(id: number): ProjectState {
 return states[id] ?? { included: true, startOverride: null, durationOverride: null, expanded: false };
 }

 function patchState(id: number, patch: Partial<ProjectState>) {
 setStates(prev => ({ ...prev, [id]: { ...getState(id), ...patch } }));
 }

 function toggleAll(included: boolean) {
 const next: Record<number, ProjectState> = {};
 activeProjects.forEach(p => { next[p.id] = { ...getState(p.id), included }; });
 setStates(prev => ({ ...prev, ...next }));
 }

 function resetAll() {
 setStates({});
 runScenario.reset();
 }

 const anyChanges = useMemo(() => {
 return activeProjects.some(p => {
 const s = getState(p.id);
 return !s.included || s.startOverride != null || s.durationOverride != null;
 });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [states, activeProjects]);

 const excludedCount = activeProjects.filter(p => !getState(p.id).included).length;
 const overriddenCount = activeProjects.filter(p => {
 const s = getState(p.id);
 return s.included && (s.startOverride != null || s.durationOverride != null);
 }).length;

 function handleRun() {
 const overrides: ProjectOverride[] = [];
 activeProjects.forEach(p => {
 const s = getState(p.id);
 if (!s.included) {
 overrides.push({ projectId: p.id, newDuration: 0 });
 } else if (s.startOverride != null || s.durationOverride != null) {
 overrides.push({
 projectId: p.id,
 ...(s.startOverride != null ? { newStartMonth: s.startOverride } : {}),
 ...(s.durationOverride != null ? { newDuration: s.durationOverride } : {}),
 });
 }
 });
 runScenario.mutate({ projectOverrides: overrides }, { onError: (e: unknown) => notifications.show({ title: 'Simulation failed', message: (e as Error).message || 'Could not run scenario.', color: 'red' }) });
 }

 const months = Array.from({ length: 12 }, (_, i) => i + 1);

 const resultData = useMemo(() => {
 if (!runScenario.data) return null;
 const key = viewMode === 'delta' ? 'deltas' : viewMode === 'simulated' ? 'simulated' : 'baseline';
 const gaps = runScenario.data[key].gaps;
 const podMap = new Map<string, Map<number, number>>();
 gaps.forEach((g: PodMonthGap) => {
 if (!podMap.has(g.podName)) podMap.set(g.podName, new Map());
 podMap.get(g.podName)!.set(g.monthIndex, Number(g.gapHours));
 });
 return Array.from(podMap.entries());
 }, [runScenario.data, viewMode]);

 const deltaSummary = useMemo(() => {
 if (!runScenario.data) return null;
 const deltas = runScenario.data.deltas.gaps;
 const improved = deltas.filter((g: PodMonthGap) => Number(g.gapHours) > 0).length;
 const worsened = deltas.filter((g: PodMonthGap) => Number(g.gapHours) < 0).length;
 const totalDelta = deltas.reduce((s: number, g: PodMonthGap) => s + Number(g.gapHours), 0);
 return { improved, worsened, totalDelta };
 }, [runScenario.data]);

 if (isLoading) return <LoadingSpinner variant="chart" message="Loading scenario simulator..." />;

 return (
 <PPPageLayout title="Scenario Simulator" subtitle="Model capacity scenarios and compare outcomes" animate>
 <Stack className="page-enter stagger-children">
 <Group justify="space-between" align="flex-start" className="slide-in-left">
 <div>
 </div>
 <Group gap="sm">
 {anyChanges && (
 <Tooltip label="Reset all changes">
 <ActionIcon variant="light" color="gray" onClick={resetAll}
      aria-label="Refresh"
    >
 <IconRefresh size={16} />
 </ActionIcon>
 </Tooltip>
 )}
 <Button
 leftSection={<IconPlayerPlay size={16} />}
 onClick={handleRun}
 loading={runScenario.isPending}
 disabled={!anyChanges}
 >
 Run Scenario
 </Button>
 </Group>
 </Group>

 {anyChanges && (
 <Group gap="sm">
 {excludedCount > 0 && (
 <Badge color="red" variant="light" size="sm">
 {excludedCount} project{excludedCount !== 1 ? 's' : ''} removed
 </Badge>
 )}
 {overriddenCount > 0 && (
 <Badge color="blue" variant="light" size="sm">
 {overriddenCount} project{overriddenCount !== 1 ? 's' : ''} timeline adjusted
 </Badge>
 )}
 </Group>
 )}

 <Grid gutter="md">
 {/* ── Project list ── */}
 <Grid.Col span={{ base: 12, md: 5 }}>
 <Card withBorder padding="md">
 <Group justify="space-between" mb="sm">
 <Text fw={600} size="sm">Active Projects ({activeProjects.length})</Text>
 <Group gap="xs">
 <Button size="xs" variant="subtle" onClick={() => toggleAll(true)}>All in</Button>
 <Button size="xs" variant="subtle" color="red" onClick={() => toggleAll(false)}>All out</Button>
 </Group>
 </Group>

 <ScrollArea h={500} scrollbarSize={6}>
 <Stack gap="xs">
 {activeProjects.length === 0 && (
 <EmptyState
 icon={<IconAdjustments size={36} stroke={1.5} />}
 title="No active projects"
 description="Mark projects as Active to include them in scenario simulations."
 />
 )}
 {activeProjects.map(p => {
 const s = getState(p.id);
 const isModified = s.startOverride != null || s.durationOverride != null;
 return (
 <Card key={p.id} withBorder padding="xs" radius="sm"
 style={{
 opacity: s.included ? 1 : 0.45,
 borderColor: !s.included
 ? 'var(--mantine-color-red-4)'
 : isModified
 ? 'var(--mantine-color-blue-4)'
 : undefined,
 transition: 'opacity 0.15s',
 }}
 >
 <Group justify="space-between" wrap="nowrap">
 <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
 <Checkbox
 checked={s.included}
 onChange={e => patchState(p.id, { included: e.currentTarget.checked })}
 size="sm"
 />
 <div style={{ flex: 1, minWidth: 0 }}>
 <Text size="sm" fw={500} lineClamp={1}>{p.name}</Text>
 <Text size="xs" c="dimmed">
 M{s.startOverride ?? p.startMonth}
 {' · '}
 {s.durationOverride ?? p.durationMonths}mo
 {isModified && <Text span c="blue" fw={600}> ✎</Text>}
 </Text>
 </div>
 </Group>
 {s.included && (
 <Tooltip label={s.expanded ? 'Hide overrides' : 'Adjust timeline'}>
 <ActionIcon variant="subtle" size="sm"
 onClick={() => patchState(p.id, { expanded: !s.expanded })}
      aria-label="Expand"
    >
 {s.expanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
 </ActionIcon>
 </Tooltip>
 )}
 </Group>

 <Collapse in={s.included && s.expanded}>
 <Divider my="xs" />
 <Group grow gap="sm">
 <NumberInput
 label="Start Month"
 placeholder={String(p.startMonth)}
 value={s.startOverride ?? ''}
 onChange={v => patchState(p.id, { startOverride: v !== '' ? Number(v) : null })}
 min={1} max={12} size="xs"
 allowDecimal={false}
 />
 <NumberInput
 label="Duration (mo)"
 placeholder={String(p.durationMonths)}
 value={s.durationOverride ?? ''}
 onChange={v => patchState(p.id, { durationOverride: v !== '' ? Number(v) : null })}
 min={1} max={24} size="xs"
 allowDecimal={false}
 />
 </Group>
 {(s.startOverride != null || s.durationOverride != null) && (
 <Button
 size="xs" variant="subtle" color="gray" mt="xs"
 onClick={() => patchState(p.id, { startOverride: null, durationOverride: null })}
 >
 Reset to original
 </Button>
 )}
 </Collapse>
 </Card>
 );
 })}
 </Stack>
 </ScrollArea>
 </Card>
 </Grid.Col>

 {/* ── Results ── */}
 <Grid.Col span={{ base: 12, md: 7 }}>
 <Card withBorder padding="md">
 <Group justify="space-between" mb="md">
 <Text fw={600} size="sm">Results</Text>
 {runScenario.data && (
 <SegmentedControl
 size="xs"
 value={viewMode}
 onChange={v => setViewMode(v as typeof viewMode)}
 data={[
 { value: 'delta', label: '± Delta' },
 { value: 'simulated', label: 'Scenario' },
 { value: 'baseline', label: 'Baseline' },
 ]}
 />
 )}
 </Group>

 {runScenario.error && (
 <Alert color="red" icon={<IconAlertTriangle size={16} />} mb="sm">
 {(runScenario.error as Error).message}
 </Alert>
 )}

 {!runScenario.data && !runScenario.isPending && (
 <Stack align="center" py="xl" gap="sm">
 <ThemeIcon size={52} radius="xl" variant="light" color="indigo">
 <IconAdjustments size={26} />
 </ThemeIcon>
 <Text c="dimmed" ta="center" size="sm" maw={320}>
 Uncheck projects to remove them from the scenario, or expand to adjust start/duration.
 Then click <strong>Run Scenario</strong> to see the capacity impact.
 </Text>
 {!anyChanges && (
 <Alert color="blue" icon={<IconInfoCircle size={14} />} py="xs" px="sm" radius="md">
 <Text size="xs">Make at least one change to enable simulation.</Text>
 </Alert>
 )}
 </Stack>
 )}

 {runScenario.isPending && (
 <Stack align="center" py="xl">
 <Text c="dimmed" size="sm">Calculating scenario…</Text>
 </Stack>
 )}

 {/* Delta summary cards */}
 {runScenario.data && deltaSummary && viewMode === 'delta' && (
 <SimpleGrid cols={3} mb="sm" spacing="sm">
 <Card withBorder padding="xs" radius="sm">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
 Improved
 </Text>
 <Group gap={4} mt={4} align="center">
 <ThemeIcon color="green" size="sm" variant="light">
 <IconCircleCheck size={12} />
 </ThemeIcon>
 <Text fw={800} size="xl" c="green">{deltaSummary.improved}</Text>
 </Group>
 <Text size="xs" c="dimmed">POD-months</Text>
 </Card>
 <Card withBorder padding="xs" radius="sm">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
 Worsened
 </Text>
 <Group gap={4} mt={4} align="center">
 <ThemeIcon color="red" size="sm" variant="light">
 <IconAlertTriangle size={12} />
 </ThemeIcon>
 <Text fw={800} size="xl" c="red">{deltaSummary.worsened}</Text>
 </Group>
 <Text size="xs" c="dimmed">POD-months</Text>
 </Card>
 <Card withBorder padding="xs" radius="sm">
 <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
 Capacity Freed
 </Text>
 <Text fw={800} size="xl"
 c={deltaSummary.totalDelta > 0 ? 'green' : deltaSummary.totalDelta < 0 ? 'red' : 'dimmed'}
 mt={4}
 >
 {deltaSummary.totalDelta >= 0 ? '+' : ''}{formatHours(deltaSummary.totalDelta)}
 </Text>
 <Text size="xs" c="dimmed">net change</Text>
 </Card>
 </SimpleGrid>
 )}

 {/* Gap table */}
 {resultData && resultData.length > 0 && (
 <>
 {viewMode === 'delta' && (
 <Text size="xs" c="dimmed" mb="xs">
 Green (+) = capacity freed. Red (−) = demand pressure increased.
 </Text>
 )}
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ minWidth: 110 }}>POD</Table.Th>
 {months.map(m => (
 <Table.Th key={m} style={{
 textAlign: 'center', fontSize: 10,
 ...(m < currentMonthIndex ? { opacity: 0.5, backgroundColor: pastBg } : {}),
 }}>
 {monthLabels[m] ?? `M${m}`}
 </Table.Th>
 ))}
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {resultData.map(([pod, monthData]) => (
 <Table.Tr key={pod}>
 <Table.Td fw={500} style={{ fontSize: 11 }}>{pod}</Table.Td>
 {months.map(m => {
 const gap = monthData.get(m) ?? 0;
 const cellBg = viewMode === 'delta'
 ? gap > 50 ? SURFACE_SUCCESS_LIGHT : gap < -50 ? SURFACE_RED_FAINT : undefined
 : (m >= currentMonthIndex ? getGapCellColor(gap, dark) : undefined);
 return (
 <Table.Td key={m} style={{
 textAlign: 'center', fontSize: 10,
 ...(m < currentMonthIndex
 ? { opacity: 0.5, backgroundColor: pastBg }
 : { backgroundColor: cellBg }),
 }}>
 {viewMode === 'delta'
 ? (Math.abs(gap) > 10
 ? <Text size="xs" c={gap > 0 ? 'teal' : 'red'} fw={600}>
 {gap > 0 ? '+' : ''}{formatHours(gap)}
 </Text>
 : <Text size="xs" c="dimmed">—</Text>)
 : formatHours(gap)}
 </Table.Td>
 );
 })}
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 </>
 )}
 </Card>
 </Grid.Col>
 </Grid>
 </Stack>
 </PPPageLayout>
 );
}
