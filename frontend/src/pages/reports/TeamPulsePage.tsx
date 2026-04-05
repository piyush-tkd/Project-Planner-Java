import { useState } from 'react';
import {
  Title, Text, Stack, SimpleGrid, Card, Group, Badge, Button,
  Modal, Select, Textarea, Loader, Center, ThemeIcon, Tooltip,
  NumberInput, ActionIcon,
} from '@mantine/core';
import {
  IconHeartRateMonitor, IconUsers, IconTrendingUp, IconPlus,
  IconMoodSmile, IconRefresh,
} from '@tabler/icons-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TrendPoint { week: string; label: string; avg: number | null; count: number }
interface PodWeek    { week: string; label: string; avg: number | null; count: number }
interface PodRow     { pod: string; weeks: PodWeek[]; overallAvg: number | null; resourceCount: number }
interface Resource   { id: number; name: string; }

// ── Score → colour mapping ────────────────────────────────────────────────────
function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#e9ecef';
  if (score >= 4.5) return '#2DC3D2';
  if (score >= 3.5) return '#40c057';
  if (score >= 2.5) return '#fab005';
  if (score >= 1.5) return '#fd7e14';
  return '#fa5252';
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
        fontSize: 11, fontWeight: 600, fontFamily: FONT_FAMILY,
      }}>
        {score != null ? score.toFixed(1) : '—'}
      </div>
    </Tooltip>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeamPulsePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState<{ resourceId: string; score: number; comment: string }>({
    resourceId: '', score: 3, comment: '',
  });

  const { data: trend = [], isLoading: trendLoading } = useQuery<TrendPoint[]>({
    queryKey: ['pulse-trend'],
    queryFn: async () => { const r = await apiClient.get('/pulse/trend'); return r.data; },
  });

  const { data: summary = [], isLoading: summaryLoading } = useQuery<PodRow[]>({
    queryKey: ['pulse-summary'],
    queryFn: async () => { const r = await apiClient.get('/pulse/summary'); return r.data; },
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ['resources-list'],
    queryFn: async () => { const r = await apiClient.get('/resources'); return r.data; },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/pulse', {
        resourceId: Number(form.resourceId),
        score:      form.score,
        comment:    form.comment || null,
        weekStart:  null,
      });
    },
    onSuccess: () => {
      notifications.show({ message: 'Pulse check-in submitted!', color: 'teal' });
      qc.invalidateQueries({ queryKey: ['pulse-trend'] });
      qc.invalidateQueries({ queryKey: ['pulse-summary'] });
      setModal(false);
      setForm({ resourceId: '', score: 3, comment: '' });
    },
    onError: () => notifications.show({ message: 'Failed to submit pulse', color: 'red' }),
  });

  // KPI derivations from trend
  const recentTrend = trend.filter(t => t.avg != null);
  const currentAvg  = recentTrend.length > 0 ? recentTrend[recentTrend.length - 1].avg : null;
  const prevAvg     = recentTrend.length > 1 ? recentTrend[recentTrend.length - 2].avg : null;
  const trendDir    = currentAvg != null && prevAvg != null
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
    <Stack gap="lg" style={{ fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            Team Pulse
          </Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Weekly mood check-in — track team morale by POD
          </Text>
        </div>
        <Group gap="xs">
          <ActionIcon variant="light" color="blue" size="lg"
            onClick={() => { qc.invalidateQueries({ queryKey: ['pulse-trend'] }); qc.invalidateQueries({ queryKey: ['pulse-summary'] }); }}>
            <IconRefresh size={16} />
          </ActionIcon>
          <Button leftSection={<IconPlus size={15} />} onClick={() => setModal(true)}>
            Submit Check-in
          </Button>
        </Group>
      </Group>

      {/* KPI tiles */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
          <ThemeIcon size={36} color="teal" variant="light" mx="auto" mb={4}>
            <IconHeartRateMonitor size={20} />
          </ThemeIcon>
          <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: scoreColor(currentAvg) }}>
            {currentAvg != null ? currentAvg.toFixed(1) : '—'}
          </Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>This Week Avg</Text>
        </Card>
        <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
          <ThemeIcon size={36} color="blue" variant="light" mx="auto" mb={4}>
            <IconTrendingUp size={20} />
          </ThemeIcon>
          <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            {trendDir}
          </Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Team Trend</Text>
        </Card>
        <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
          <ThemeIcon size={36} color="cyan" variant="light" mx="auto" mb={4}>
            <IconUsers size={20} />
          </ThemeIcon>
          <Text size="xl" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            {thisWeekCount}
          </Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Responded This Week</Text>
        </Card>
        <Card withBorder radius="md" p="md" style={{ textAlign: 'center' }}>
          <ThemeIcon size={36} color="green" variant="light" mx="auto" mb={4}>
            <IconMoodSmile size={20} />
          </ThemeIcon>
          <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            {happiest?.pod ?? '—'}
          </Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Happiest POD</Text>
        </Card>
      </SimpleGrid>

      {/* Trend line chart */}
      <Card withBorder radius="md" p="md">
        <Title order={5} mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
          Team Mood Trend (last 12 weeks)
        </Title>
        {trendLoading ? (
          <Center h={140}><Loader /></Center>
        ) : trend.length === 0 ? (
          <Center h={140}>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              No data yet. Submit a check-in to get started.
            </Text>
          </Center>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: FONT_FAMILY }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fontFamily: FONT_FAMILY }} />
              <ReTooltip
                contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }}
                formatter={(v: number) => [v != null ? v.toFixed(1) : '—', 'Avg Score']}
              />
              <Line
                type="monotone" dataKey="avg" stroke="#2DC3D2"
                strokeWidth={2} dot={{ r: 4, fill: '#2DC3D2' }}
                connectNulls activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* POD heatmap grid */}
      <Card withBorder radius="md" p="md">
        <Title order={5} mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
          POD Heatmap (last 8 weeks)
        </Title>
        {summaryLoading ? (
          <Center h={100}><Loader /></Center>
        ) : summary.length === 0 ? (
          <Center h={100}>
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              No POD data yet.
            </Text>
          </Center>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: FONT_FAMILY }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: '#868e96', fontWeight: 600 }}>POD</th>
                  {weekLabels.map((l, i) => (
                    <th key={i} style={{ padding: '4px 6px', fontSize: 10, color: '#868e96', textAlign: 'center', minWidth: 48 }}>
                      {l}
                    </th>
                  ))}
                  <th style={{ padding: '4px 6px', fontSize: 11, color: '#868e96', textAlign: 'center' }}>Overall</th>
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
            { label: '3.5–4.5', color: '#40c057' },
            { label: '2.5–3.5', color: '#fab005' },
            { label: '1.5–2.5', color: '#fd7e14' },
            { label: '<1.5', color: '#fa5252' },
            { label: 'No data', color: '#e9ecef' },
          ].map(l => (
            <Group key={l.label} gap={4}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{l.label}</Text>
            </Group>
          ))}
        </Group>
      </Card>

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
            styles={{ input: { fontFamily: FONT_FAMILY } }}
          />
          <div>
            <Text size="sm" fw={500} mb={6} style={{ fontFamily: FONT_FAMILY }}>
              How are you feeling this week? (1 = terrible, 5 = great)
            </Text>
            <Group gap="xs" justify="center">
              {[1, 2, 3, 4, 5].map(n => (
                <Button
                  key={n}
                  variant={form.score === n ? 'filled' : 'outline'}
                  color={scoreColor(n) === '#fa5252' ? 'red' : scoreColor(n) === '#fd7e14' ? 'orange' : scoreColor(n) === '#fab005' ? 'yellow' : scoreColor(n) === '#40c057' ? 'green' : 'cyan'}
                  size="md"
                  style={{ minWidth: 44, fontFamily: FONT_FAMILY }}
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
            styles={{ input: { fontFamily: FONT_FAMILY } }}
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
