import { useState } from 'react';
import {
  Title, Text, Stack, SimpleGrid, Card, Group, Badge, Button,
  Progress, RingProgress, Center, Loader, ThemeIcon, Divider,
  Paper, ActionIcon, Tooltip,
} from '@mantine/core';
import { useDarkMode } from '../../hooks/useDarkMode';
import { PPPageLayout } from '../../components/pp';
import {
  IconBriefcase, IconUsers, IconTargetArrow, IconAlertTriangle,
  IconRocket, IconRefresh, IconTrendingUp, IconTrendingDown,
  IconCircleCheck, IconShieldCheck, IconFlame, IconDownload,
} from '@tabler/icons-react';
import { downloadCsv } from '../../utils/csv';
import { exportToPdf } from '../../utils/pdf';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import { AQUA_HEX, AQUA, DEEP_BLUE, FONT_FAMILY } from '../../brandTokens';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExecData {
  portfolio: {
    total: number; active: number; completed: number; atRisk: number;
    onTrackPct: number; atRiskPct: number; completedPct: number;
  };
  capacity: { avgUtilizationPct: number; podsInDeficit: number; totalPods: number };
  okrs: {
    total: number; completed: number; active: number; notStarted: number;
    avgProgress: number;
  };
  risks: { totalOpen: number; critical: number; high: number; mitigated: number };
  velocity: { avgPoints: number; trend: { sprint: string; points: number }[]; retroCount: number };
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, color, trend,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card withBorder radius="md" p="md" style={{ fontFamily: FONT_FAMILY }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <ThemeIcon size={40} radius="md" color={color} variant="light">
          {icon}
        </ThemeIcon>
        {trend && (
          trend === 'up'
            ? <IconTrendingUp size={16} color="green" />
            : trend === 'down'
              ? <IconTrendingDown size={16} color="red" />
              : null
        )}
      </Group>
      <Text size="xl" fw={700} mt={8} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
        {value}
      </Text>
      <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{label}</Text>
      {sub && <Text size="xs" c="dimmed" mt={2} style={{ fontFamily: FONT_FAMILY }}>{sub}</Text>}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ExecSummaryPage() {
  const isDark = useDarkMode();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isFetching, error } = useQuery<ExecData>({
    queryKey: ['exec-dashboard', refreshKey],
    queryFn:  async () => {
      const res = await apiClient.get('/reports/exec-dashboard');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  function handleRefresh() {
    setRefreshKey(k => k + 1);
    notifications.show({ message: 'Refreshing executive summary…', color: 'blue', autoClose: 2000 });
  }

  if (isLoading) {
    return <Center h={300}><Loader /></Center>;
  }

  if (error || !data) {
    return (
      <Center h={200}>
        <Text c="red" style={{ fontFamily: FONT_FAMILY }}>
          Failed to load executive summary. Please try refreshing.
        </Text>
      </Center>
    );
  }

  const { portfolio, capacity, okrs, risks, velocity } = data;

  const utilColor =
    capacity.avgUtilizationPct > 90 ? 'red' :
    capacity.avgUtilizationPct > 75 ? 'orange' : 'teal';

  const okrRingData = [
    { value: okrs.total > 0 ? Math.round(okrs.completed / okrs.total * 100) : 0, color: 'teal',   tooltip: `${okrs.completed} Completed` },
    { value: okrs.total > 0 ? Math.round(okrs.active    / okrs.total * 100) : 0, color: 'blue',   tooltip: `${okrs.active} Active` },
    { value: okrs.total > 0 ? Math.round(okrs.notStarted/ okrs.total * 100) : 0, color: 'gray',   tooltip: `${okrs.notStarted} Not Started` },
  ];

  const generatedLabel = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : '';

  return (
    <PPPageLayout
      title="Executive Summary"
      subtitle="Portfolio-wide health snapshot across all modules"
      animate
      actions={
        <Group gap="xs">
          {generatedLabel && (
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              Last refreshed: {generatedLabel}
            </Text>
          )}
          <Button
            variant="light"
            color="red"
            leftSection={<IconDownload size={14} />}
            size="sm"
            className="pp-no-print"
            onClick={() => exportToPdf('Executive Summary')}
          >
            Export PDF
          </Button>
          <Button
            variant="default"
            leftSection={<IconDownload size={14} />}
            size="sm"
            className="pp-no-print"
            onClick={() =>
              downloadCsv('executive-summary', [
                { metric: 'Total Projects',       value: portfolio.total },
                { metric: 'Active Projects',      value: portfolio.active },
                { metric: 'Completed Projects',   value: portfolio.completed },
                { metric: 'At-Risk Projects',     value: portfolio.atRisk },
                { metric: 'On-Track %',           value: portfolio.onTrackPct },
                { metric: 'Avg Utilization %',    value: capacity.avgUtilizationPct },
                { metric: 'PODs in Deficit',      value: capacity.podsInDeficit },
                { metric: 'Total PODs',           value: capacity.totalPods },
                { metric: 'OKRs Total',           value: okrs.total },
                { metric: 'OKRs Completed',       value: okrs.completed },
                { metric: 'OKR Avg Progress %',   value: okrs.avgProgress },
                { metric: 'Open Risks',           value: risks.totalOpen },
                { metric: 'Critical Risks',       value: risks.critical },
                { metric: 'Avg Sprint Velocity',  value: velocity.avgPoints },
                { metric: 'Sprint Retros Count',  value: velocity.retroCount },
              ], [
                { key: 'metric', header: 'KPI' },
                { key: 'value',  header: 'Value' },
              ])
            }
          >
            Export CSV
          </Button>
          <Tooltip label="Refresh data">
            <ActionIcon
              variant="light" color="blue" size="lg"
              loading={isFetching} onClick={handleRefresh}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
    >
      <Stack gap="lg" style={{ fontFamily: FONT_FAMILY }}>

      {/* ── Top KPI bar ── */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
        <KpiCard
          icon={<IconBriefcase size={20} />}
          label="Total Projects"
          value={portfolio.total}
          sub={`${portfolio.active} active`}
          color="blue"
        />
        <KpiCard
          icon={<IconShieldCheck size={20} />}
          label="Portfolio Health"
          value={`${portfolio.onTrackPct}%`}
          sub="on track"
          color={portfolio.atRiskPct > 20 ? 'orange' : 'teal'}
          trend={portfolio.atRiskPct > 20 ? 'down' : 'up'}
        />
        <KpiCard
          icon={<IconFlame size={20} />}
          label="Avg Utilisation"
          value={`${capacity.avgUtilizationPct}%`}
          sub={`${capacity.podsInDeficit} PODs in deficit`}
          color={utilColor}
          trend={capacity.avgUtilizationPct > 90 ? 'down' : 'neutral'}
        />
        <KpiCard
          icon={<IconTargetArrow size={20} />}
          label="OKR Progress"
          value={`${okrs.avgProgress}%`}
          sub={`${okrs.completed}/${okrs.total} complete`}
          color="violet"
          trend={okrs.avgProgress >= 60 ? 'up' : 'neutral'}
        />
        <KpiCard
          icon={<IconAlertTriangle size={20} />}
          label="Critical Risks"
          value={risks.critical}
          sub={`${risks.totalOpen} open total`}
          color={risks.critical > 0 ? 'red' : 'teal'}
          trend={risks.critical > 0 ? 'down' : 'up'}
        />
        <KpiCard
          icon={<IconRocket size={20} />}
          label="Sprint Velocity"
          value={velocity.avgPoints > 0 ? `${velocity.avgPoints} pts` : '—'}
          sub="avg last 5 sprints"
          color="cyan"
        />
      </SimpleGrid>

      {/* ── Portfolio breakdown ── */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Title order={5} mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            Portfolio Status Breakdown
          </Title>
          <Stack gap="xs">
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>On Track</Text>
                <Badge color="teal" variant="light">{portfolio.active - portfolio.atRisk} projects</Badge>
              </Group>
              <Progress value={portfolio.onTrackPct} color="teal" radius="sm" size="md" />
            </div>
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>At Risk / Blocked</Text>
                <Badge color="red" variant="light">{portfolio.atRisk} projects</Badge>
              </Group>
              <Progress value={portfolio.atRiskPct} color="red" radius="sm" size="md" />
            </div>
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Completed</Text>
                <Badge color="gray" variant="light">{portfolio.completed} projects</Badge>
              </Group>
              <Progress value={portfolio.completedPct} color="gray" radius="sm" size="md" />
            </div>
          </Stack>
        </Card>

        {/* ── OKR Ring ── */}
        <Card withBorder radius="md" p="md">
          <Title order={5} mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            OKR Completion
          </Title>
          <Group gap="xl" justify="center" align="center">
            <RingProgress
              size={140}
              thickness={16}
              sections={okrRingData.filter(s => s.value > 0)}
              label={
                <Center>
                  <div style={{ textAlign: 'center' }}>
                    <Text size="lg" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                      {okrs.total}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>OKRs</Text>
                  </div>
                </Center>
              }
            />
            <Stack gap="xs">
              <Group gap="xs">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--mantine-color-teal-5)' }} />
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Completed: {okrs.completed}</Text>
              </Group>
              <Group gap="xs">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--mantine-color-blue-5)' }} />
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Active: {okrs.active}</Text>
              </Group>
              <Group gap="xs">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--mantine-color-gray-4)' }} />
                <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>Not Started: {okrs.notStarted}</Text>
              </Group>
              <Divider my={4} />
              <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
                Avg progress: <strong>{okrs.avgProgress}%</strong>
              </Text>
            </Stack>
          </Group>
        </Card>
      </SimpleGrid>

      {/* ── Risk summary + Velocity trend ── */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Risk traffic lights */}
        <Card withBorder radius="md" p="md">
          <Title order={5} mb="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
            Risk Overview
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center', background: risks.critical > 0 ? (isDark ? 'rgba(250,82,82,0.12)' : 'rgba(250,82,82,0.07)') : undefined }}>
              <Text size="xl" fw={700} c={risks.critical > 0 ? 'red' : 'teal'} style={{ fontFamily: FONT_FAMILY }}>
                {risks.critical}
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Critical</Text>
            </Paper>
            <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center', background: risks.high > 2 ? (isDark ? 'rgba(255,146,43,0.12)' : 'rgba(255,146,43,0.07)') : undefined }}>
              <Text size="xl" fw={700} c={risks.high > 2 ? 'orange' : 'teal'} style={{ fontFamily: FONT_FAMILY }}>
                {risks.high}
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>High</Text>
            </Paper>
            <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="blue" style={{ fontFamily: FONT_FAMILY }}>
                {risks.totalOpen}
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Open Total</Text>
            </Paper>
            <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="teal" style={{ fontFamily: FONT_FAMILY }}>
                {risks.mitigated}
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Mitigated</Text>
            </Paper>
          </SimpleGrid>
        </Card>

        {/* Sprint velocity trend */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Title order={5} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
              Sprint Velocity Trend
            </Title>
            <Badge variant="light" color="cyan">
              avg {velocity.avgPoints > 0 ? `${velocity.avgPoints} pts` : '—'}
            </Badge>
          </Group>
          {velocity.trend.length === 0 ? (
            <Center h={120}>
              <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                No sprint retro data yet. Generate retros in Sprint Retro page.
              </Text>
            </Center>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={velocity.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="sprint" tick={{ fontSize: 10, fontFamily: FONT_FAMILY }}
                  tickFormatter={s => s.length > 10 ? s.slice(0, 10) + '…' : s} />
                <YAxis tick={{ fontSize: 10, fontFamily: FONT_FAMILY }} />
                <ReTooltip
                  contentStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }}
                  formatter={(v: number) => [`${v} pts`, 'Velocity']}
                />
                <Line
                  type="monotone" dataKey="points" stroke={AQUA_HEX}
                  strokeWidth={2} dot={{ r: 4, fill: AQUA }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </SimpleGrid>

      {/* ── Capacity summary ── */}
      <Card withBorder radius="md" p="md">
        <Title order={5} mb="xs" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
          Capacity Health
        </Title>
        <Group gap="xl">
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color={utilColor} variant="light">
              <IconUsers size={18} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                {capacity.avgUtilizationPct}%
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>Avg utilisation across PODs</Text>
            </div>
          </Group>
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color={capacity.podsInDeficit > 0 ? 'red' : 'teal'} variant="light">
              <IconAlertTriangle size={18} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                {capacity.podsInDeficit} / {capacity.totalPods}
              </Text>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>PODs in capacity deficit</Text>
            </div>
          </Group>
          <div style={{ flex: 1 }}>
            <Text size="xs" c="dimmed" mb={4} style={{ fontFamily: FONT_FAMILY }}>
              Overall utilisation
            </Text>
            <Progress
              value={Math.min(capacity.avgUtilizationPct, 100)}
              color={utilColor}
              size="lg"
              radius="sm"
              striped={capacity.avgUtilizationPct > 90}
              animated={capacity.avgUtilizationPct > 90}
            />
          </div>
        </Group>
      </Card>

      {/* Footer note */}
      <Group justify="flex-end">
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          <IconCircleCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Data aggregated live from all modules — refresh to update
        </Text>
      </Group>
      </Stack>
    </PPPageLayout>
  );
}
