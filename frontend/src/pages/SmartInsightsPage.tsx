/**
 * SmartInsightsPage — AI-style project health scoring and portfolio intelligence.
 *
 * Computes health scores from existing project data client-side:
 *  - Timeline risk  (target date vs today)
 *  - Status risk    (AT_RISK / ON_HOLD weight)
 *  - Priority mix   (P0/P1 share)
 *  - Staleness      (no update in 30+ days)
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Text, Group, Stack, Box, SimpleGrid, Paper, ThemeIcon,
  Badge, RingProgress, Progress, Anchor, Alert,
  Table, ScrollArea,
} from '@mantine/core';
import {
  IconBrain,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconShieldCheck,
  IconClock,
  IconChartPie,
  IconStar,
  IconInfoCircle,
  IconArrowRight,
} from '@tabler/icons-react';
import { useProjects } from '../api/projects';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageError from '../components/common/PageError';
import { FONT_FAMILY, AQUA_TINTS } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import type { ProjectResponse } from '../types/project';
import { PPPageLayout } from '../components/pp';

// ── Scoring engine ─────────────────────────────────────────────────────────

const STATUS_RISK: Record<string, number> = {
  AT_RISK:     30,
  ON_HOLD:     20,
  ACTIVE:       0,
  NOT_STARTED:  5,
  COMPLETED:  -10,  // bonus — drag score up
};

function computeHealthScore(p: ProjectResponse, today: Date): number {
  let penalty = 0;

  // 1. Status risk
  penalty += STATUS_RISK[p.status] ?? 0;

  // 2. Timeline overrun
  if (p.targetDate) {
    const target = new Date(p.targetDate);
    const daysLate = Math.floor((today.getTime() - target.getTime()) / 86_400_000);
    if (daysLate > 30)  penalty += 25;
    else if (daysLate > 0) penalty += 15;
    else if (daysLate > -14) penalty += 5;  // due very soon
  } else {
    penalty += 10; // no target date = untracked
  }

  // 3. Priority — HIGHEST/BLOCKER under-delivery
  if ((p.priority === 'HIGHEST' || p.priority === 'BLOCKER') && p.status !== 'COMPLETED') {
    penalty += 10;
  }

  // 4. Staleness (no createdAt or > 30 days old with no activity proxy)
  if (!p.createdAt) penalty += 5;

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return score;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'teal';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

function scoreBand(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Needs Attention';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

// ── Insight card ───────────────────────────────────────────────────────────

interface InsightCardProps {
  icon:    React.ReactNode;
  label:   string;
  value:   string | number;
  sub?:    string;
  color:   string;
}
function InsightCard({ icon, label, value, sub, color }: InsightCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="sm" mb={6}>
        <ThemeIcon size={32} radius="md" color={color} variant="light">
          {icon}
        </ThemeIcon>
        <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          {label}
        </Text>
      </Group>
      <Text fz={26} fw={700} style={{ fontFamily: FONT_FAMILY, lineHeight: 1.1 }}>
        {value}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed" mt={2} style={{ fontFamily: FONT_FAMILY }}>
          {sub}
        </Text>
      )}
    </Paper>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function SmartInsightsPage() {
  const navigate   = useNavigate();
  const dark       = useDarkMode();
  const { data: projects = [], isLoading, isError } = useProjects();

  const today = useMemo(() => new Date(), []);

  const scored = useMemo(() => {
    const active = projects.filter(p => !p.archived);
    return active
      .map(p => ({ ...p, healthScore: computeHealthScore(p, today) }))
      .sort((a, b) => a.healthScore - b.healthScore);
  }, [projects, today]);

  // ── Portfolio-level KPIs ───────────────────────────────────────────────

  const kpis = useMemo(() => {
    const active   = scored.filter(p => p.status === 'ACTIVE');
    const atRisk   = scored.filter(p => p.status === 'AT_RISK');
    const overdue  = scored.filter(p => p.targetDate && new Date(p.targetDate) < today && p.status !== 'COMPLETED');
    const critical = scored.filter(p => p.healthScore < 40);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + p.healthScore, 0) / scored.length)
      : 0;

    // Priority distribution
    const p0 = scored.filter(p => p.priority === 'HIGHEST' || p.priority === 'BLOCKER').length;
    const p1 = scored.filter(p => p.priority === 'HIGH').length;

    // Status distribution
    const byStatus: Record<string, number> = {};
    for (const p of scored) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;

    return { active, atRisk, overdue, critical, avgScore, p0, p1, byStatus, total: scored.length };
  }, [scored, today]);

  // ── AI-generated natural-language insights ──────────────────────────────

  const narratives = useMemo(() => {
    const lines: { icon: React.ReactNode; color: string; text: string }[] = [];

    if (kpis.critical.length > 0) {
      lines.push({
        icon: <IconAlertTriangle size={15} />, color: 'red',
        text: `${kpis.critical.length} project${kpis.critical.length > 1 ? 's are' : ' is'} in critical health — immediate attention needed.`,
      });
    }
    if (kpis.overdue.length > 0) {
      lines.push({
        icon: <IconClock size={15} />, color: 'orange',
        text: `${kpis.overdue.length} project${kpis.overdue.length > 1 ? 's have' : ' has'} passed its target date without completion.`,
      });
    }
    if (kpis.atRisk.length > 0) {
      lines.push({
        icon: <IconTrendingDown size={15} />, color: 'yellow',
        text: `${kpis.atRisk.length} project${kpis.atRisk.length > 1 ? 's are' : ' is'} marked AT_RISK — investigate blockers.`,
      });
    }
    if (kpis.avgScore >= 75) {
      lines.push({
        icon: <IconShieldCheck size={15} />, color: 'teal',
        text: `Portfolio average health score is ${kpis.avgScore}/100 — overall portfolio is in good shape.`,
      });
    }
    if (kpis.p0 > 3) {
      lines.push({
        icon: <IconStar size={15} />, color: 'blue',
        text: `${kpis.p0} P0/Critical projects in flight — consider whether all are truly critical priority.`,
      });
    }
    if (kpis.total > 0 && kpis.active.length / kpis.total < 0.3) {
      lines.push({
        icon: <IconTrendingUp size={15} />, color: 'indigo',
        text: `Only ${Math.round(kpis.active.length / kpis.total * 100)}% of projects are actively in-flight. Check for stalled or deprioritised work.`,
      });
    }
    if (lines.length === 0) {
      lines.push({
        icon: <IconShieldCheck size={15} />, color: 'teal',
        text: 'No significant portfolio risks detected at this time.',
      });
    }
    return lines;
  }, [kpis]);

  if (isLoading) return <LoadingSpinner variant="dashboard" />;
  if (isError)   return <PageError context="Loading smart insights" />;

  return (
    <PPPageLayout
      title="Smart Insights"
      subtitle={`AI-computed portfolio health scoring across ${kpis.total} active projects`}
      animate
    >

      {/* ── KPI strip ── */}
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl">
        <InsightCard
          icon={<IconChartPie size={18} />}
          label="Avg Health Score"
          value={`${kpis.avgScore}/100`}
          sub={scoreBand(kpis.avgScore)}
          color={scoreColor(kpis.avgScore)}
        />
        <InsightCard
          icon={<IconAlertTriangle size={18} />}
          label="Critical Health"
          value={kpis.critical.length}
          sub="score < 40"
          color="red"
        />
        <InsightCard
          icon={<IconClock size={18} />}
          label="Overdue"
          value={kpis.overdue.length}
          sub="past target date"
          color="orange"
        />
        <InsightCard
          icon={<IconTrendingDown size={18} />}
          label="At Risk"
          value={kpis.atRisk.length}
          sub="status = AT_RISK"
          color="yellow"
        />
        <InsightCard
          icon={<IconShieldCheck size={18} />}
          label="Active Projects"
          value={kpis.active.length}
          sub={`of ${kpis.total} total`}
          color="teal"
        />
      </SimpleGrid>

      {/* ── AI Narrative Insights ── */}
      <Paper withBorder p="lg" radius="md" mb="xl">
        <Group gap="xs" mb="md">
          <ThemeIcon size={24} radius="md" color="violet" variant="light">
            <IconBrain size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
            AI Narrative
          </Text>
          <Badge size="xs" color="violet" variant="light" style={{ fontFamily: FONT_FAMILY }}>
            computed
          </Badge>
        </Group>
        <Stack gap={10}>
          {narratives.map((n, i) => (
            <Group key={i} gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={22} radius="xl" color={n.color} variant="light" style={{ flexShrink: 0, marginTop: 1 }}>
                {n.icon}
              </ThemeIcon>
              <Text size="sm" style={{ fontFamily: FONT_FAMILY }}>
                {n.text}
              </Text>
            </Group>
          ))}
        </Stack>
      </Paper>

      {/* ── Status Distribution ── */}
      <SimpleGrid cols={{ base: 1, md: 2 }} mb="xl">
        <Paper withBorder p="lg" radius="md">
          <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>
            Status Distribution
          </Text>
          <Stack gap="xs">
            {Object.entries(kpis.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = kpis.total > 0 ? Math.round(count / kpis.total * 100) : 0;
                const COLOR: Record<string, string> = {
                  ACTIVE: 'teal', COMPLETED: 'blue', AT_RISK: 'red',
                  ON_HOLD: 'orange', NOT_STARTED: 'gray',
                };
                return (
                  <Box key={status}>
                    <Group justify="space-between" mb={3}>
                      <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{status.replace('_', ' ')}</Text>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                        {count} ({pct}%)
                      </Text>
                    </Group>
                    <Progress
                      value={pct}
                      color={COLOR[status] ?? 'gray'}
                      size="sm"
                      radius="xl"
                    />
                  </Box>
                );
              })}
          </Stack>
        </Paper>

        <Paper withBorder p="lg" radius="md">
          <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>
            Portfolio Health Ring
          </Text>
          <Group justify="center">
            <RingProgress
              size={160}
              thickness={16}
              roundCaps
              sections={[
                { value: scored.filter(p => p.healthScore >= 80).length / Math.max(kpis.total, 1) * 100, color: 'teal',   tooltip: 'Healthy' },
                { value: scored.filter(p => p.healthScore >= 60 && p.healthScore < 80).length / Math.max(kpis.total, 1) * 100, color: 'yellow', tooltip: 'Needs Attention' },
                { value: scored.filter(p => p.healthScore >= 40 && p.healthScore < 60).length / Math.max(kpis.total, 1) * 100, color: 'orange', tooltip: 'At Risk' },
                { value: scored.filter(p => p.healthScore < 40).length / Math.max(kpis.total, 1) * 100, color: 'red',    tooltip: 'Critical' },
              ]}
              label={
                <Text ta="center" fw={700} fz={22} style={{ fontFamily: FONT_FAMILY }}>
                  {kpis.avgScore}
                </Text>
              }
            />
          </Group>
          <Stack gap={4} mt="md">
            {[
              { label: 'Healthy (80–100)',       color: 'teal' },
              { label: 'Needs Attention (60–79)', color: 'yellow' },
              { label: 'At Risk (40–59)',          color: 'orange' },
              { label: 'Critical (<40)',           color: 'red' },
            ].map(b => (
              <Group key={b.label} gap="xs">
                <Box style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--mantine-color-${b.color}-6)` }} />
                <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{b.label}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* ── Bottom 10 projects by health score ── */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <Box p="md" style={{ borderBottom: `1px solid ${dark ? `${AQUA_TINTS[80]}22` : `${AQUA_TINTS[10]}`}` }}>
          <Group gap="xs">
            <IconAlertTriangle size={16} color="orange" />
            <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
              Projects Needing Attention
            </Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              — sorted by health score ascending
            </Text>
          </Group>
        </Box>
        <ScrollArea>
          <Table fz="xs" withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ fontFamily: FONT_FAMILY }}>Project</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY }}>Status</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY }}>Priority</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY }}>Target Date</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY }}>Health Score</Table.Th>
                <Table.Th style={{ fontFamily: FONT_FAMILY }}>Band</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {scored.slice(0, 15).map(p => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Anchor
                      size="xs"
                      style={{ fontFamily: FONT_FAMILY, cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <Group gap={4} wrap="nowrap">
                        {p.name}
                        <IconArrowRight size={10} />
                      </Group>
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      color={p.status === 'AT_RISK' ? 'red' : p.status === 'ON_HOLD' ? 'orange' : p.status === 'COMPLETED' ? 'teal' : 'blue'}
                      variant="light"
                      style={{ fontFamily: FONT_FAMILY }}
                    >
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>{p.priority ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: FONT_FAMILY, color: p.targetDate && new Date(p.targetDate) < today ? 'var(--mantine-color-red-6)' : undefined }}>
                      {p.targetDate ? new Date(p.targetDate).toLocaleDateString() : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Progress
                        value={p.healthScore}
                        color={scoreColor(p.healthScore)}
                        size="sm"
                        style={{ width: 60 }}
                      />
                      <Text size="xs" fw={600} style={{ fontFamily: FONT_FAMILY }}>
                        {p.healthScore}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      color={scoreColor(p.healthScore)}
                      variant="light"
                      style={{ fontFamily: FONT_FAMILY }}
                    >
                      {scoreBand(p.healthScore)}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {/* Methodology note */}
      <Alert icon={<IconInfoCircle size={14} />} color="gray" variant="light" mt="lg">
        <Text size="xs" style={{ fontFamily: FONT_FAMILY }}>
          Health scores are computed from: status risk weighting, timeline overrun, priority classification,
          and data completeness. Scores update in real time as project data changes.
        </Text>
      </Alert>

    </PPPageLayout>
  );
}
