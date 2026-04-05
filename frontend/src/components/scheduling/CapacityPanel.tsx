import { useMemo } from 'react';
import { Card, Text, Group, Stack, Badge, ThemeIcon, Tooltip, Box, SimpleGrid } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconUsers, IconClock, IconTrendingUp } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, AQUA_TINTS } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import type { ProjectPodPlanningResponse, SchedulingRulesResponse } from '../../types';

const HOURS_PER_DAY = 6; // 6 productive hours per 8-hour day

interface CapacityPanelProps {
  plannings: ProjectPodPlanningResponse[];
  rules: SchedulingRulesResponse | null;
  projectStartDate?: string | null;
  projectTargetDate?: string | null;
}

interface PhaseAnalysis {
  podName: string;
  podId: number;
  phase: 'DEV' | 'QA' | 'UAT';
  totalHours: number;
  resourceCount: number;
  parallelPct: number;
  // Calculated
  sequentialDays: number;
  parallelDays: number;
  effectiveDays: number;
  // Deadline analysis
  availableDays: number | null;
  requiredResources: number | null;
  feasible: boolean;
  impossible: boolean; // Can't be done even with infinite resources
}

/**
 * Calculate effective working days given hours, resource count, and parallelization %.
 *
 * Model:
 *   sequential portion = hours * (1 - parallelPct/100)  → can't be sped up
 *   parallel portion   = hours * parallelPct/100         → split across N resources
 *   effectiveDays = sequentialHours/hpd + parallelHours/(N * hpd)
 */
function calcEffectiveDays(hours: number, resourceCount: number, parallelPct: number): {
  sequentialDays: number;
  parallelDays: number;
  effectiveDays: number;
} {
  if (hours <= 0) return { sequentialDays: 0, parallelDays: 0, effectiveDays: 0 };
  const n = Math.max(1, resourceCount);
  const pct = Math.max(0, Math.min(100, parallelPct)) / 100;
  const seqHours = hours * (1 - pct);
  const parHours = hours * pct;
  const sequentialDays = seqHours / HOURS_PER_DAY;
  const parallelDays = parHours / (n * HOURS_PER_DAY);
  return { sequentialDays, parallelDays, effectiveDays: sequentialDays + parallelDays };
}

/**
 * Calculate required resources to fit within available days.
 * Returns null if impossible (sequential portion alone exceeds deadline).
 */
function calcRequiredResources(hours: number, parallelPct: number, availableDays: number): number | null {
  if (hours <= 0 || availableDays <= 0) return null;
  const pct = Math.max(0, Math.min(100, parallelPct)) / 100;
  const seqHours = hours * (1 - pct);
  const seqDays = seqHours / HOURS_PER_DAY;

  // If sequential work alone exceeds the deadline, it's impossible
  if (seqDays >= availableDays) return null;

  const remainingDays = availableDays - seqDays;
  const parHours = hours * pct;
  const needed = parHours / (remainingDays * HOURS_PER_DAY);
  return Math.ceil(needed);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

export default function CapacityPanel({ plannings, rules, projectStartDate, projectTargetDate }: CapacityPanelProps) {
  const dark = useDarkMode();

  const analyses = useMemo(() => {
    if (!rules || plannings.length === 0) return [];

    const availDays = (projectStartDate && projectTargetDate)
      ? daysBetween(projectStartDate, projectTargetDate)
      : null;

    const results: PhaseAnalysis[] = [];

    for (const p of plannings) {
      // DEV phase
      if (p.devHours > 0) {
        const devCount = (p as any).devCount || 1;
        const { sequentialDays, parallelDays, effectiveDays } = calcEffectiveDays(
          p.devHours, devCount, rules.devParallelPct
        );
        const reqRes = availDays ? calcRequiredResources(p.devHours, rules.devParallelPct, availDays) : null;
        const impossible = reqRes === null && availDays !== null;
        results.push({
          podName: p.podName, podId: p.podId, phase: 'DEV',
          totalHours: p.devHours, resourceCount: devCount,
          parallelPct: rules.devParallelPct,
          sequentialDays, parallelDays, effectiveDays,
          availableDays: availDays,
          requiredResources: reqRes,
          feasible: !impossible && (availDays ? effectiveDays <= availDays : true),
          impossible,
        });
      }

      // QA phase
      if (p.qaHours > 0) {
        const qaCount = (p as any).qaCount || 1;
        const { sequentialDays, parallelDays, effectiveDays } = calcEffectiveDays(
          p.qaHours, qaCount, rules.qaParallelPct
        );
        // QA typically has less time — factor in lag
        const qaAvailDays = availDays ? Math.max(0, availDays - rules.qaLagDays) : null;
        const reqRes = qaAvailDays ? calcRequiredResources(p.qaHours, rules.qaParallelPct, qaAvailDays) : null;
        const impossible = reqRes === null && qaAvailDays !== null;
        results.push({
          podName: p.podName, podId: p.podId, phase: 'QA',
          totalHours: p.qaHours, resourceCount: qaCount,
          parallelPct: rules.qaParallelPct,
          sequentialDays, parallelDays, effectiveDays,
          availableDays: qaAvailDays,
          requiredResources: reqRes,
          feasible: !impossible && (qaAvailDays ? effectiveDays <= qaAvailDays : true),
          impossible,
        });
      }
    }

    return results;
  }, [plannings, rules, projectStartDate, projectTargetDate]);

  // Summary stats
  const warnings = analyses.filter(a => !a.feasible);
  const impossibles = analyses.filter(a => a.impossible);

  if (analyses.length === 0) return null;

  const PHASE_COLORS: Record<string, string> = {
    DEV: '#228be6',
    QA: '#40c057',
    UAT: '#e64980',
  };

  return (
    <Card withBorder padding="xl" style={{ boxShadow: SHADOW.card }}>
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <IconUsers size={18} style={{ color: AQUA }} />
          <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
            Resource Capacity Analysis
          </Text>
        </Group>
        <Group gap="xs">
          {warnings.length === 0 ? (
            <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
              All phases feasible
            </Badge>
          ) : (
            <Badge color="red" variant="light" size="sm" leftSection={<IconAlertTriangle size={12} />}>
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="light" color="gray" size="xs">
            {HOURS_PER_DAY}h/day
          </Badge>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {analyses.map((a, i) => (
          <PhaseCard key={`${a.podId}-${a.phase}`} analysis={a} dark={dark} />
        ))}
      </SimpleGrid>

      {/* Impossible warnings */}
      {impossibles.length > 0 && (
        <Box
          mt="lg" p="md"
          style={{
            background: dark ? 'rgba(250,82,82,0.08)' : '#fff5f5',
            borderRadius: 8,
            border: `1px solid ${dark ? '#c92a2a' : '#ffc9c9'}`,
          }}
        >
          <Group gap="xs" mb="xs">
            <IconAlertTriangle size={16} color="#fa5252" />
            <Text size="sm" fw={700} c="red">Cannot meet deadline</Text>
          </Group>
          {impossibles.map((a, i) => (
            <Text key={i} size="xs" c={dark ? '#ffa8a8' : '#c92a2a'} mb={2}>
              {a.podName} · {a.phase}: {a.totalHours}h of work with only {a.parallelPct}% parallelizable
              — sequential portion alone takes {Math.ceil(a.sequentialDays)}d but only {a.availableDays}d available.
              Adding more people won't help.
            </Text>
          ))}
        </Box>
      )}
    </Card>
  );
}

function PhaseCard({ analysis: a, dark }: { analysis: PhaseAnalysis; dark: boolean }) {
  const PHASE_COLORS: Record<string, string> = {
    DEV: '#228be6', QA: '#40c057', UAT: '#e64980',
  };
  const color = PHASE_COLORS[a.phase] || '#868e96';

  const statusColor = a.impossible ? 'red' : !a.feasible ? 'orange' : 'green';
  const statusIcon = a.impossible ? <IconAlertTriangle size={14} /> : !a.feasible ? <IconAlertTriangle size={14} /> : <IconCheck size={14} />;
  const statusLabel = a.impossible ? 'Impossible' : !a.feasible ? 'Needs more resources' : 'On track';

  return (
    <Box
      p="md"
      style={{
        background: dark ? 'rgba(255,255,255,0.03)' : '#f8f9fa',
        borderRadius: 8,
        border: `1px solid ${a.impossible ? (dark ? '#c92a2a' : '#ffc9c9') : !a.feasible ? (dark ? '#e8590c' : '#ffe8cc') : (dark ? '#373A40' : '#e9ecef')}`,
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb={10}>
        <Group gap={6}>
          <Badge size="xs" color={color} variant="filled">{a.phase}</Badge>
          <Text size="xs" fw={700} style={{ fontFamily: FONT_FAMILY }}>
            {a.podName}
          </Text>
        </Group>
        <Tooltip label={statusLabel}>
          <ThemeIcon size={20} radius="xl" variant="light" color={statusColor}>
            {statusIcon}
          </ThemeIcon>
        </Tooltip>
      </Group>

      {/* Metrics */}
      <Stack gap={6}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Effort</Text>
          <Text size="xs" fw={600}>{a.totalHours}h</Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Resources</Text>
          <Group gap={4}>
            <IconUsers size={12} />
            <Text size="xs" fw={600}>{a.resourceCount}</Text>
          </Group>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Parallelizable</Text>
          <Text size="xs" fw={600}>{a.parallelPct}%</Text>
        </Group>

        {/* Duration breakdown */}
        <Box
          mt={4} p="xs"
          style={{
            background: dark ? 'rgba(255,255,255,0.02)' : '#fff',
            borderRadius: 6,
            border: `1px solid ${dark ? '#2C2E33' : '#f1f3f5'}`,
          }}
        >
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              <IconClock size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              Duration
            </Text>
            <Text size="sm" fw={700} c={statusColor}>
              {Math.ceil(a.effectiveDays)}d
            </Text>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            {Math.ceil(a.sequentialDays)}d sequential + {Math.ceil(a.parallelDays)}d parallel ({a.resourceCount} people)
          </Text>
        </Box>

        {/* Deadline comparison */}
        {a.availableDays !== null && (
          <Box
            p="xs"
            style={{
              background: a.impossible
                ? (dark ? 'rgba(250,82,82,0.06)' : '#fff5f5')
                : !a.feasible
                ? (dark ? 'rgba(232,89,12,0.06)' : '#fff4e6')
                : (dark ? 'rgba(64,192,87,0.06)' : '#ebfbee'),
              borderRadius: 6,
            }}
          >
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Available</Text>
              <Text size="xs" fw={600}>{a.availableDays}d</Text>
            </Group>
            {a.impossible ? (
              <Text size="xs" c="red" fw={600} mt={2}>
                Sequential work ({Math.ceil(a.sequentialDays)}d) exceeds deadline — adding people won't help
              </Text>
            ) : !a.feasible && a.requiredResources ? (
              <Group gap={4} mt={2}>
                <IconTrendingUp size={11} color="#e8590c" />
                <Text size="xs" c="orange" fw={600}>
                  Need {a.requiredResources} {a.phase === 'DEV' ? 'dev' : a.phase === 'QA' ? 'QA' : 'resource'}{a.requiredResources > 1 ? 's' : ''} to meet deadline
                  {a.requiredResources > a.resourceCount && ` (+${a.requiredResources - a.resourceCount})`}
                </Text>
              </Group>
            ) : (
              <Text size="xs" c="green" mt={2}>
                {Math.ceil(a.availableDays - a.effectiveDays)}d buffer remaining
              </Text>
            )}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
