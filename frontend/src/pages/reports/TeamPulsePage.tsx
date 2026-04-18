import { useState } from 'react';
import {
 Title, Text, Stack, SimpleGrid, Card, Group, Badge, Button,
 Modal, Select, Textarea, Loader, Center, ThemeIcon, Tooltip,
 ActionIcon, Table, ScrollArea
} from '@mantine/core';
import {
 IconHeartRateMonitor, IconUsers, IconTrendingUp, IconPlus,
 IconMoodSmile, IconRefresh, IconPencil, IconTrash
} from '@tabler/icons-react';
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid,
 Tooltip as ReTooltip, ResponsiveContainer
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { COLOR_AMBER, COLOR_ERROR, COLOR_ORANGE, COLOR_SUCCESS, DEEP_BLUE, GRAY_100, TEXT_DIM } from '../../brandTokens';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TrendPoint { week: string; label: string; avg: number | null; count: number }
interface PodWeek { week: string; label: string; avg: number | null; count: number }
interface PodRow { pod: string; weeks: PodWeek[]; overallAvg: number | null; resourceCount: number }
interface Resource { id: number; name: string; }
interface PulseEntry { id: number; resourceId: number; resourceName: string; weekStart: string; score: number; comment: string | null; createdAt: string | null; }

// ── Score → colour mapping ────────────────────────────────────────────────────
function scoreColor(score: number | null | undefined): string {
 if (score == null) return GRAY_100;
 if (score >= 4.5) return '#2DC3D2';
 if (score >= 3.5) return COLOR_SUCCESS;
 if (score >= 2.5) return COLOR_AMBER;
 if (score >= 1.5) return COLOR_ORANGE;
 return COLOR_ERROR;
}

function ScoreCell({ score }: { score: number | null }) {
 const bg = scoreColor(score);
 return (
 <Tooltip label={score != null ? `${score}` : 'No data'} withArrow>
 <div style={{
 width: 40, height: 32, borderRadius: 4,
 background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
 cursor: 'default', margin: '0 auto',
 color: score != null && score < 2 ? '#fff' : '#333',
 fontSize: 11, fontWeight: 600}}>
 {score != null ? score.toFixed(1) : '—'}
 </div>
 </Tooltip>
 );
}

// ── Page ──────────────────────────────────────────────────────────────────────
// Current week Monday ISO string
function currentWeekISO(): string {
 const today = new Date();
 const monday = new Date(today);
 monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
 return monday.toISOString().slice(0, 10);
}

export default function TeamPulsePage() {
 const qc = useQueryClient();
 const [modal, setModal] = useState(false);
 const [form, setForm] = useState<{ resourceId: string; score: number; comment: string }>({
 resourceId: '', score: 3, comment: ''
 });

 // Edit/delete state
 const [editModal, setEditModal] = useState<PulseEntry | null>(null);
 const [editScore, setEditScore] = useState(3);
 const [editComment, setEditComment] = useState('');
 const [deleteConfirm, setDeleteConfirm] = useState<PulseEntry | null>(null);

 const { data: trend = [], isLoading: trendLoading } = useQuery<TrendPoint[]>({
 queryKey: ['pulse-trend'],
 queryFn: async () => { const r = await apiClient.get('/pulse/trend'); return r.data; }
 });

 const { data: summary = [], isLoading: summaryLoading } = useQuery<PodRow[]>({
 queryKey: ['pulse-summary'],
 queryFn: async () => { const r = await apiClient.get('/pulse/summary'); return r.data; }
 });

 const { data: resources = [] } = useQuery<Resource[]>({
 queryKey: ['resources-list'],
 queryFn: async () => { const r = await apiClient.get('/resources/all'); return r.data; }
 });

 // Current week entries (for edit/delete list)
 const currentWeek = currentWeekISO();
 const { data: weekEntries = [], isLoading: weekLoading } = useQuery<PulseEntry[]>({
 queryKey: ['pulse-week', currentWeek],
 queryFn: async () => { const r = await apiClient.get(`/pulse/week/${currentWeek}`); return r.data; }
 });

 const editMutation = useMutation({
 mutationFn: ({ id, score, comment }: { id: number; score: number; comment: string }) =>
 apiClient.put(`/pulse/${id}`, { score, comment: comment || null }),
 onSuccess: () => {
 notifications.show({ message: 'Entry updated', color: 'teal' });
 qc.invalidateQueries({ queryKey: ['pulse-trend'] });
 qc.invalidateQueries({ queryKey: ['pulse-summary'] });
 qc.invalidateQueries({ queryKey: ['pulse-week', currentWeek] });
 setEditModal(null);
 },
 onError: () => notifications.show({ message: 'Failed to update entry', color: 'red' })
 });

 const deleteMutation = useMutation({
 mutationFn: (id: number) => apiClient.delete(`/pulse/${id}`),
 onSuccess: () => {
 notifications.show({ message: 'Entry deleted', color: 'orange' });
 qc.invalidateQueries({ queryKey: ['pulse-trend'] });
 qc.invalidateQueries({ queryKey: ['pulse-summary'] });
 qc.invalidateQueries({ queryKey: ['pulse-week', currentWeek] });
 setDeleteConfirm(null);
 },
 onError: () => notifications.show({ message: 'Failed to delete entry', color: 'red' })
 });

 const submitMutation = useMutation({
 mutationFn: async () => {
 await apiClient.post('/pulse', {
 resourceId: Number(form.resourceId),
 score: form.score,
 comment: form.comment || null,
 weekStart: null
 });
 },
 onSuccess: () => {
 notifications.show({ message: 'Pulse check-in submitted!', color: 'teal' });
 qc.invalidateQueries({ queryKey: ['pulse-trend'] });
 qc.invalidateQueries({ queryKey: ['pulse-summary'] });
 qc.invalidateQueries({ queryKey: ['pulse-week', currentWeek] });
 setModal(false);
 setForm({ resourceId: '', score: 3, comment: '' });
 },
 onError: () => notifications.show({ message: 'Failed to submit pulse', color: 'red' })
 });

 // KPI derivations from trend
 const recentTrend = trend.filter(t => t.avg != null);
 const currentAvg = recentTrend.length > 0 ? recentTrend[recentTrend.length - 1].avg : null;
 const prevAvg = recentTrend.length > 1 ? recentTrend[recentTrend.length - 2].avg : null;
 const trendDir = currentAvg != null && prevAvg != null
 ? currentAvg > prevAvg ? '↑' : currentAvg < prevAvg ? '↓' : '→'
 : '—';

 const thisWeekCount = trend.find(t => {
 const today = new Date();
 const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
 return t.week === monday.toISOString().slice(0, 10);
 })?.count ?? 0;

 const happiest = summary.length > 0
 ? [...summary].filter(p => p.overallAvg != null).sort((a, b) => (b.overallAvg ?? 0) - (a.overallAvg ?? 0))[0]
 : null;

 // Get week labels from summary (last 8)
 const weekLabels = summary.length > 0 ? summary[0].weeks.map(w => w.label) : [];

 return (
 <Stack gap="lg" style={{ }}>
 {/* Header */}
 <Group justify="space-between" align="center">
 <div>
 <Title order={2} style={{color: DEEP_BLUE }}>
 Team Pulse
 </Title>
 <Text size="sm" c="dimmed" style={{ }}>
 Weekly mood check-in — track team morale by POD
 </Text>
 </div>
 <Group gap="xs">
 <Tooltip label="Refresh data" withArrow>
 <ActionIcon variant="light" color="blue" size="lg"
 onClick={() => { qc.invalidateQueries({ queryKey: ['pulse-trend'] }); qc.invalidateQueries({ queryKey: ['pulse-summary'] }); qc.invalidateQueries({ queryKey: ['pulse-week', currentWeekISO()] }); }}
      aria-label="Refresh"
    >
 <IconRefresh size={16} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="To edit or delete an entry, scroll down to 'This Week\'s Entries'" withArrow position="bottom">
 <Button leftSection={<IconPlus size={15} />} onClick={() => setModal(true)}>
 Submit Check-in
 </Button>
 </Tooltip>
 </Group>
 </Group>

 {/* KPI tiles */}
 <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
 <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
 <ThemeIcon size={36} color="teal" variant="light" mx="auto" mb={4}>
 <IconHeartRateMonitor size={20} />
 </ThemeIcon>
 <Text size="xl" fw={700} style={{color: scoreColor(currentAvg) }}>
 {currentAvg != null ? currentAvg.toFixed(1) : '—'}
 </Text>
 <Text size="xs" c="dimmed" style={{ }}>This Week Avg</Text>
 </Card>
 <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
 <ThemeIcon size={36} color="blue" variant="light" mx="auto" mb={4}>
 <IconTrendingUp size={20} />
 </ThemeIcon>
 <Text size="xl" fw={700} style={{color: DEEP_BLUE }}>
 {trendDir}
 </Text>
 <Text size="xs" c="dimmed" style={{ }}>Team Trend</Text>
 </Card>
 <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
 <ThemeIcon size={36} color="cyan" variant="light" mx="auto" mb={4}>
 <IconUsers size={20} />
 </ThemeIcon>
 <Text size="xl" fw={700} style={{color: DEEP_BLUE }}>
 {thisWeekCount}
 </Text>
 <Text size="xs" c="dimmed" style={{ }}>Responded This Week</Text>
 </Card>
 <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
 <ThemeIcon size={36} color="green" variant="light" mx="auto" mb={4}>
 <IconMoodSmile size={20} />
 </ThemeIcon>
 <Text size="sm" fw={700} style={{color: DEEP_BLUE }}>
 {happiest?.pod ?? '—'}
 </Text>
 <Text size="xs" c="dimmed" style={{ }}>Happiest POD</Text>
 </Card>
 </SimpleGrid>

 {/* Trend line chart */}
 <Card withBorder radius="md" p="md">
 <Title order={5} mb="sm" style={{color: DEEP_BLUE }}>
 Team Mood Trend (last 12 weeks)
 </Title>
 {trendLoading ? (
 <Center h={140}><Loader /></Center>
 ) : trend.length === 0 ? (
 <Center h={140}>
 <Text size="sm" c="dimmed" style={{ }}>
 No data yet. Submit a check-in to get started.
 </Text>
 </Center>
 ) : (
 <div role="img" aria-label="Line chart">
 <ResponsiveContainer width="100%" height={140}>
 <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
 <XAxis dataKey="label" tick={{ fontSize: 10}} />
 <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10}} />
 <ReTooltip
 contentStyle={{fontSize: 12 }}
 formatter={(v: number) => [v != null ? v.toFixed(1) : '—', 'Avg Score']}
 />
 <Line
 type="monotone" dataKey="avg" stroke="#2DC3D2"
 strokeWidth={2} dot={{ r: 4, fill: '#2DC3D2' }}
 connectNulls activeDot={{ r: 6 }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )}
 </Card>

 {/* POD heatmap grid */}
 <Card withBorder radius="md" p="md">
 <Title order={5} mb="sm" style={{color: DEEP_BLUE }}>
 POD Heatmap (last 8 weeks)
 </Title>
 {summaryLoading ? (
 <Center h={100}><Loader /></Center>
 ) : summary.length === 0 ? (
 <Center h={100}>
 <Text size="sm" c="dimmed" style={{ }}>
 No POD data yet.
 </Text>
 </Center>
 ) : (
 <div style={{ overflowX: 'auto' }}>
 <table style={{ borderCollapse: 'collapse', width: '100%'}}>
 <thead>
 <tr>
 <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: TEXT_DIM, fontWeight: 600 }}>POD</th>
 {weekLabels.map((l, i) => (
 <th key={i} style={{ padding: '4px 6px', fontSize: 10, color: TEXT_DIM, textAlign: 'center', minWidth: 48 }}>
 {l}
 </th>
 ))}
 <th style={{ padding: '4px 6px', fontSize: 11, color: TEXT_DIM, textAlign: 'center' }}>Overall</th>
 </tr>
 </thead>
 <tbody>
 {summary.map(pod => (
 <tr key={pod.pod}>
 <td style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, color: DEEP_BLUE, whiteSpace: 'nowrap' }}>
 {pod.pod}
 </td>
 {pod.weeks.map((w, i) => (
 <td key={i} style={{ padding: '4px 6px', textAlign: 'center' }}>
 <ScoreCell score={w.avg} />
 </td>
 ))}
 <td style={{ padding: '4px 6px', textAlign: 'center' }}>
 <ScoreCell score={pod.overallAvg} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 <Group gap="xs" mt="sm">
 {[
 { label: '≥4.5', color: '#2DC3D2' },
 { label: '3.5–4.5', color: COLOR_SUCCESS },
 { label: '2.5–3.5', color: COLOR_AMBER },
 { label: '1.5–2.5', color: COLOR_ORANGE },
 { label: '<1.5', color: COLOR_ERROR },
 { label: 'No data', color: GRAY_100 },
 ].map(l => (
 <Group key={l.label} gap={4}>
 <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
 <Text size="xs" c="dimmed" style={{ }}>{l.label}</Text>
 </Group>
 ))}
 </Group>
 </Card>

 {/* This week's entries — edit/delete */}
 <Card withBorder radius="md" p="md" style={{ borderLeft: '3px solid var(--mantine-color-teal-5)' }}>
 <Group justify="space-between" mb="sm">
 <Group gap="sm">
 <ThemeIcon size={28} color="teal" variant="light" radius="sm">
 <IconPencil size={14} />
 </ThemeIcon>
 <div>
 <Title order={5} style={{color: DEEP_BLUE }}>
 This Week's Entries
 </Title>
 <Text size="xs" c="dimmed">Edit or delete your submitted check-ins below</Text>
 </div>
 </Group>
 <Badge size="sm" variant="filled" color="teal">{weekEntries.length} entries</Badge>
 </Group>
 {weekLoading ? (
 <Center h={60}><Loader size="sm" /></Center>
 ) : weekEntries.length === 0 ? (
 <Text size="sm" c="dimmed" ta="center" py="md" style={{ }}>
 No check-ins this week yet.
 </Text>
 ) : (
 <ScrollArea>
 <Table fz="xs" withTableBorder withColumnBorders>
 <Table.Thead>
 <Table.Tr>
 <Table.Th style={{ width: 160 }}>Team Member</Table.Th>
 <Table.Th style={{ width: 80, textAlign: 'center' }}>Score</Table.Th>
 <Table.Th>Comment</Table.Th>
 <Table.Th style={{ width: 80, textAlign: 'center' }}>Actions</Table.Th>
 </Table.Tr>
 </Table.Thead>
 <Table.Tbody>
 {weekEntries.map(entry => (
 <Table.Tr key={entry.id}>
 <Table.Td>
 <Text size="xs" fw={600}>{entry.resourceName}</Text>
 </Table.Td>
 <Table.Td style={{ textAlign: 'center' }}>
 <ScoreCell score={entry.score} />
 </Table.Td>
 <Table.Td>
 <Text size="xs" c={entry.comment ? undefined : 'dimmed'} fs={entry.comment ? undefined : 'italic'}>
 {entry.comment ?? 'No comment'}
 </Text>
 </Table.Td>
 <Table.Td>
 <Group gap={4} justify="center">
 <Tooltip label="Edit entry">
 <ActionIcon size="sm" variant="light" color="blue"
 onClick={() => { setEditModal(entry); setEditScore(entry.score); setEditComment(entry.comment ?? ''); }}
      aria-label="Edit"
    >
 <IconPencil size={12} />
 </ActionIcon>
 </Tooltip>
 <Tooltip label="Delete entry">
 <ActionIcon size="sm" variant="light" color="red"
 onClick={() => setDeleteConfirm(entry)}
      aria-label="Delete"
    >
 <IconTrash size={12} />
 </ActionIcon>
 </Tooltip>
 </Group>
 </Table.Td>
 </Table.Tr>
 ))}
 </Table.Tbody>
 </Table>
 </ScrollArea>
 )}
 </Card>

 {/* Edit entry modal */}
 <Modal
 opened={!!editModal}
 onClose={() => setEditModal(null)}
 title={<Text fw={600}>Edit Check-in — {editModal?.resourceName}</Text>}
 size="sm"
 >
 <Stack gap="sm">
 <div>
 <Text size="sm" fw={500} mb={6} style={{ }}>
 Score (1 = terrible, 5 = great)
 </Text>
 <Group gap="xs" justify="center">
 {[1, 2, 3, 4, 5].map(n => (
 <Button
 key={n}
 variant={editScore === n ? 'filled' : 'outline'}
 color={scoreColor(n) === COLOR_ERROR ? 'red' : scoreColor(n) === COLOR_ORANGE ? 'orange' : scoreColor(n) === COLOR_AMBER ? 'yellow' : scoreColor(n) === COLOR_SUCCESS ? 'green' : 'cyan'}
 size="md"
 style={{ minWidth: 44}}
 onClick={() => setEditScore(n)}
 >
 {n}
 </Button>
 ))}
 </Group>
 </div>
 <Textarea
 label="Comment (optional)"
 value={editComment}
 onChange={e => setEditComment(e.currentTarget.value)}
 autosize minRows={2}
 />
 <Group justify="flex-end" mt="sm">
 <Button variant="subtle" onClick={() => setEditModal(null)}>Cancel</Button>
 <Button
 loading={editMutation.isPending}
 onClick={() => editModal && editMutation.mutate({ id: editModal.id, score: editScore, comment: editComment })}
 >
 Save Changes
 </Button>
 </Group>
 </Stack>
 </Modal>

 {/* Delete confirmation modal */}
 <Modal
 opened={!!deleteConfirm}
 onClose={() => setDeleteConfirm(null)}
 title={<Text fw={600} c="red">Delete Entry?</Text>}
 size="sm"
 >
 <Text size="sm" mb="md">
 Delete the check-in for <strong>{deleteConfirm?.resourceName}</strong> (score: {deleteConfirm?.score})?
 This cannot be undone.
 </Text>
 <Group justify="flex-end">
 <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
 <Button color="red" loading={deleteMutation.isPending}
 onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}>
 Delete
 </Button>
 </Group>
 </Modal>

 {/* Submit check-in modal */}
 <Modal opened={modal} onClose={() => setModal(false)} title="Submit Weekly Check-in" size="sm">
 <Stack gap="sm">
 <Select
 label="Team Member"
 placeholder="Select resource…"
 data={resources.map(r => ({ value: String(r.id), label: r.name }))}
 value={form.resourceId || null}
 onChange={v => setForm(f => ({ ...f, resourceId: v ?? '' }))}
 required searchable
 styles={{ input: { } }}
 />
 <div>
 <Text size="sm" fw={500} mb={6} style={{ }}>
 How are you feeling this week? (1 = terrible, 5 = great)
 </Text>
 <Group gap="xs" justify="center">
 {[1, 2, 3, 4, 5].map(n => (
 <Button
 key={n}
 variant={form.score === n ? 'filled' : 'outline'}
 color={scoreColor(n) === COLOR_ERROR ? 'red' : scoreColor(n) === COLOR_ORANGE ? 'orange' : scoreColor(n) === COLOR_AMBER ? 'yellow' : scoreColor(n) === COLOR_SUCCESS ? 'green' : 'cyan'}
 size="md"
 style={{ minWidth: 44}}
 onClick={() => setForm(f => ({ ...f, score: n }))}
 >
 {n}
 </Button>
 ))}
 </Group>
 </div>
 <Textarea
 label="Comment (optional)"
 placeholder="Anything on your mind this week?"
 value={form.comment}
 onChange={e => setForm(f => ({ ...f, comment: e.currentTarget.value }))}
 autosize minRows={2}
 styles={{ input: { } }}
 />
 <Group justify="flex-end" mt="sm">
 <Button variant="subtle" onClick={() => setModal(false)}>Cancel</Button>
 <Button
 onClick={() => submitMutation.mutate()}
 loading={submitMutation.isPending}
 disabled={!form.resourceId}
 >
 Submit
 </Button>
 </Group>
 </Stack>
 </Modal>
 </Stack>
 );
}
