import { useState } from 'react';
import {
 Title,
 Text,
 Stack,
 Card,
 Group,
 Badge,
 Button,
 ActionIcon,
 Tooltip,
 Modal,
 SimpleGrid,
 Progress,
 Loader,
 Center,
 ThemeIcon,
 Accordion,
 List,
 Alert,
 Select,
 Divider
} from '@mantine/core';
import {
 IconListCheck,
 IconChartBar,
 IconAlertTriangle,
 IconCircleCheck,
 IconTrendingUp,
 IconTrendingDown,
 IconPlayerPlay,
 IconClockHour4,
 IconBolt,
 IconTrash
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { DEEP_BLUE } from '../../brandTokens';

interface RetroSummary {
 id: number;
 sprintJiraId: number;
 sprintName: string;
 projectKey: string;
 completedIssues: number;
 totalIssues: number;
 completionPct: number;
 storyPointsDone: number | null;
 velocityDeltaPct: number | null;
 avgCycleTimeDays: number | null;
 summaryText: string;
 highlights: string[];
 concerns: string[];
 generatedAt: string;
}

interface SprintItem {
 sprintJiraId: number;
 sprintName: string;
 projectKey: string;
 state: string;
 startDate: string | null;
 endDate: string | null;
 hasRetro: boolean;
}

function VelocityBadge({ delta }: { delta: number | null }) {
 if (delta === null) return null;
 const color = delta >= 5 ? 'teal' : delta <= -10 ? 'red' : 'yellow';
 const Icon = delta >= 5 ? IconTrendingUp : delta <= -10 ? IconTrendingDown : IconChartBar;
 return (
 <Badge color={color} variant="light" leftSection={<Icon size={12} />} size="sm">
 {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% velocity
 </Badge>
 );
}

export default function SprintRetroPage() {
 const qc = useQueryClient();
 const [filterProject, setFilterProject] = useState<string | null>(null);
 const [showAllPending, setShowAllPending] = useState(false);
 const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
 const [generatingId, setGeneratingId] = useState<number | null>(null);

 const { data: summaries = [], isLoading: loadingSummaries } = useQuery<RetroSummary[]>({
 queryKey: ['retro-summaries', filterProject],
 queryFn: () => apiClient.get('/retro/summaries', {
 params: filterProject ? { projectKey: filterProject } : {}
 }).then(r => r.data)
 });

 const { data: sprintList = [], isLoading: loadingSprints } = useQuery<SprintItem[]>({
 queryKey: ['retro-sprints', filterProject],
 queryFn: () => apiClient.get('/retro/sprints', {
 params: {
 limit: 300,
 ...(filterProject ? { projectKey: filterProject } : {})
 }
 }).then(r => r.data)
 });

 const generateMutation = useMutation({
 mutationFn: (sprintJiraId: number) =>
 apiClient.post(`/retro/generate/${sprintJiraId}`).then(r => r.data),
 onMutate: (sprintJiraId: number) => { setGeneratingId(sprintJiraId); },
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['retro-summaries'] });
 qc.invalidateQueries({ queryKey: ['retro-sprints'] });
 notifications.show({ color: 'green', message: 'Retro summary generated!' });
 },
 onError: () => notifications.show({ color: 'red', message: 'Failed to generate retro' }),
 onSettled: () => { setGeneratingId(null); }
 });

 const deleteMutation = useMutation({
 mutationFn: (id: number) => apiClient.delete(`/retro/summaries/${id}`),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['retro-summaries'] });
 qc.invalidateQueries({ queryKey: ['retro-sprints'] });
 setDeleteConfirm(null);
 notifications.show({ color: 'gray', message: 'Retro deleted.' });
 },
 onError: () => notifications.show({ color: 'red', message: 'Failed to delete retro' })
 });

 const projectKeys = [...new Set(sprintList.map(s => s.projectKey).filter(Boolean))].sort();
 const pendingSprints = sprintList.filter(s =>
 !s.hasRetro && (!filterProject || s.projectKey === filterProject)
 );

 if (loadingSummaries || loadingSprints) {
 return <Center py={120}><Loader size="lg" /></Center>;
 }

 return (
 <Stack gap="lg" p="md">
 {/* Header */}
 <Group justify="space-between" align="flex-start">
 <div>
 <Title order={2} style={{ color: DEEP_BLUE, fontWeight: 600 }}>
 Sprint Retrospective Summaries
 </Title>
 <Text c="dimmed" mt={4} style={{ }}>
 Auto-generated retro digests from Jira sprint data — completion rate, velocity trend, cycle time.
 </Text>
 </div>
 <Select
 placeholder="All projects"
 data={projectKeys.map(k => ({ value: k, label: k }))}
 value={filterProject}
 onChange={(v) => { setFilterProject(v); setShowAllPending(false); }}
 clearable
 w={180}
 searchable
 />
 </Group>

 {/* Pending sprints banner */}
 {pendingSprints.length > 0 && (
 <Alert color="blue" icon={<IconListCheck />} title={`${pendingSprints.length} sprint(s) without a retro`}>
 <Stack gap="xs" mt="xs">
 {(showAllPending ? pendingSprints : pendingSprints.slice(0, 5)).map(s => (
 <Group key={s.sprintJiraId} justify="space-between">
 <Text size="sm">{s.sprintName} {s.projectKey ? `(${s.projectKey})` : ''}</Text>
 <Button
 size="xs"
 variant="light"
 color="blue"
 leftSection={<IconPlayerPlay size={12} />}
 loading={generatingId === s.sprintJiraId}
 disabled={generateMutation.isPending && generatingId !== s.sprintJiraId}
 onClick={() => generateMutation.mutate(s.sprintJiraId)}
 >
 Generate
 </Button>
 </Group>
 ))}
 {pendingSprints.length > 5 && (
 <Button
 variant="subtle"
 size="xs"
 color="blue"
 onClick={() => setShowAllPending(v => !v)}
 style={{ alignSelf: 'flex-start', padding: '0 4px' }}
 >
 {showAllPending
 ? '▲ Show fewer'
 : `▼ Show all ${pendingSprints.length} sprints`}
 </Button>
 )}
 </Stack>
 </Alert>
 )}

 {/* KPI summary bar */}
 {summaries.length > 0 && (
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
 <Card withBorder radius="md" p="sm">
 <Text size="xs" c="dimmed">Summaries</Text>
 <Text size="xl" fw={700}>{summaries.length}</Text>
 </Card>
 <Card withBorder radius="md" p="sm">
 <Text size="xs" c="dimmed">Avg Completion</Text>
 <Text size="xl" fw={700}>
 {Math.round(summaries.reduce((a, s) => a + s.completionPct, 0) / summaries.length)}%
 </Text>
 </Card>
 <Card withBorder radius="md" p="sm">
 <Text size="xs" c="dimmed">Total Points Delivered</Text>
 <Text size="xl" fw={700}>
 {summaries.reduce((a, s) => a + (s.storyPointsDone ?? 0), 0).toFixed(0)}
 </Text>
 </Card>
 <Card withBorder radius="md" p="sm">
 <Text size="xs" c="dimmed">Avg Cycle Time</Text>
 <Text size="xl" fw={700}>
 {summaries.filter(s => s.avgCycleTimeDays != null).length > 0
 ? (summaries.reduce((a, s) => a + (s.avgCycleTimeDays ?? 0), 0) /
 summaries.filter(s => s.avgCycleTimeDays != null).length).toFixed(1) + 'd'
 : '—'}
 </Text>
 </Card>
 </SimpleGrid>
 )}

 {/* Retro cards */}
 {summaries.length === 0 ? (
 <Center py={80}>
 <Stack align="center" gap="sm">
 <ThemeIcon size={64} radius="md" variant="light" color="blue">
 <IconListCheck size={32} stroke={1.5} />
 </ThemeIcon>
 <Text fw={600} c="dimmed">No retro summaries yet</Text>
 <Text size="sm" c="dimmed">Click "Generate" next to a closed sprint above to create the first summary.</Text>
 </Stack>
 </Center>
 ) : (
 <Accordion variant="separated" radius="md">
 {summaries.map(r => (
 <Accordion.Item key={r.id} value={String(r.id)}>
 <Accordion.Control>
 <Group justify="space-between" wrap="nowrap">
 <div>
 <Text fw={600} size="sm">{r.sprintName}</Text>
 <Text size="xs" c="dimmed">{r.projectKey} · {r.generatedAt?.split('T')[0]}</Text>
 </div>
 <Group gap="xs" mr="md">
 <Badge
 color={r.completionPct >= 80 ? 'teal' : r.completionPct >= 60 ? 'yellow' : 'red'}
 variant="light"
 size="sm"
 leftSection={r.completionPct >= 80
 ? <IconCircleCheck size={12} />
 : <IconAlertTriangle size={12} />}
 >
 {r.completionPct.toFixed(0)}% done
 </Badge>
 <VelocityBadge delta={r.velocityDeltaPct} />
 {r.storyPointsDone != null && (
 <Badge color="blue" variant="dot" size="sm">
 {r.storyPointsDone.toFixed(0)} pts
 </Badge>
 )}
 </Group>
 </Group>
 </Accordion.Control>
 <Accordion.Panel>
 <Stack gap="md">
 {/* Progress bar */}
 <div>
 <Group justify="space-between" mb={4}>
 <Text size="xs" c="dimmed">Issues completed</Text>
 <Text size="xs" fw={600}>{r.completedIssues}/{r.totalIssues}</Text>
 </Group>
 <Progress
 value={r.completionPct}
 color={r.completionPct >= 80 ? 'teal' : r.completionPct >= 60 ? 'yellow' : 'red'}
 size="sm"
 radius="xl"
 />
 </div>

 {/* Metrics row */}
 <SimpleGrid cols={3} spacing="sm">
 {r.storyPointsDone != null && (
 <Group gap="xs">
 <IconBolt size={14} color="var(--mantine-color-blue-6)" />
 <Text size="xs">{r.storyPointsDone.toFixed(0)} story points</Text>
 </Group>
 )}
 {r.avgCycleTimeDays != null && (
 <Group gap="xs">
 <IconClockHour4 size={14} color="var(--mantine-color-gray-6)" />
 <Text size="xs">{r.avgCycleTimeDays.toFixed(1)}d avg cycle time</Text>
 </Group>
 )}
 {r.velocityDeltaPct != null && (
 <Group gap="xs">
 {r.velocityDeltaPct >= 0
 ? <IconTrendingUp size={14} color="var(--mantine-color-teal-6)" />
 : <IconTrendingDown size={14} color="var(--mantine-color-red-6)" />}
 <Text size="xs">{r.velocityDeltaPct >= 0 ? '+' : ''}{r.velocityDeltaPct.toFixed(1)}% vs prior</Text>
 </Group>
 )}
 </SimpleGrid>

 <Divider />

 {/* Summary text */}
 <Text size="sm" c="dimmed" style={{ }}>
 {r.summaryText}
 </Text>

 {/* Highlights & Concerns */}
 {r.highlights.filter(Boolean).length > 0 && (
 <div>
 <Text size="xs" fw={600} c="teal" mb={4}>✅ Highlights</Text>
 <List size="xs" spacing="xs">
 {r.highlights.filter(Boolean).map((h, i) => (
 <List.Item key={i}>{h}</List.Item>
 ))}
 </List>
 </div>
 )}
 {r.concerns.filter(Boolean).length > 0 && (
 <div>
 <Text size="xs" fw={600} c="red" mb={4}>⚠️ Concerns</Text>
 <List size="xs" spacing="xs">
 {r.concerns.filter(Boolean).map((c, i) => (
 <List.Item key={i}>{c}</List.Item>
 ))}
 </List>
 </div>
 )}

 <Group justify="space-between">
 <Tooltip label="Delete this retro" withArrow>
 <ActionIcon
 size="sm"
 variant="subtle"
 color="red"
 onClick={() => setDeleteConfirm({ id: r.id, name: r.sprintName })}
 aria-label="Delete"
>
 <IconTrash size={14} />
 </ActionIcon>
 </Tooltip>
 <Button
 size="xs"
 variant="light"
 leftSection={<IconPlayerPlay size={12} />}
 loading={generatingId === r.sprintJiraId}
 disabled={generateMutation.isPending && generatingId !== r.sprintJiraId}
 onClick={() => generateMutation.mutate(r.sprintJiraId)}
 >
 Re-generate
 </Button>
 </Group>
 </Stack>
 </Accordion.Panel>
 </Accordion.Item>
 ))}
 </Accordion>
 )}

 {/* ── Delete Confirmation Modal ── */}
 <Modal
 opened={deleteConfirm !== null}
 onClose={() => setDeleteConfirm(null)}
 title="Delete Retro Summary"
 size="sm"
 centered
 >
 <Text size="sm" mb="md">
 Are you sure you want to delete the retro for{' '}
 <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
 </Text>
 <Group justify="flex-end" gap="xs">
 <Button variant="subtle" size="xs" onClick={() => setDeleteConfirm(null)}>
 Cancel
 </Button>
 <Button
 color="red"
 size="xs"
 loading={deleteMutation.isPending}
 leftSection={<IconTrash size={14} />}
 onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
 >
 Delete
 </Button>
 </Group>
 </Modal>
 </Stack>
 );
}
