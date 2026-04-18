import {
  Stack, Group, Text, Badge, SimpleGrid, Paper, Loader, ThemeIcon,
  Progress, Divider,
} from '@mantine/core';
import {
  IconRocket, IconClock, IconBug, IconHeartbeat,
  IconTrendingUp, IconShieldCheck, IconAlertTriangle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import { useDoraMetrics } from '../../../../api/reports';
import { fmt1 } from '../utils';
import {
  COLOR_SUCCESS, COLOR_AMBER, COLOR_ERROR, COLOR_BLUE_LIGHT,
  AQUA_HEX,
} from '../../../../brandTokens';

interface OverviewTabProps {
  projectKey: string | null;
  days: number;
}

// DORA level → color mappings
const LEVEL_COLOR: Record<string, string> = {
  elite: COLOR_SUCCESS,
  high: COLOR_BLUE_LIGHT,
  medium: COLOR_AMBER,
  low: COLOR_ERROR,
};

const LEVEL_MANTINE: Record<string, string> = {
  elite: 'green',
  high: 'blue',
  medium: 'yellow',
  low: 'red',
};

const LEVEL_LABEL: Record<string, string> = {
  elite: 'Elite',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function DoraKpiCard({
  title,
  icon,
  value,
  unit,
  level,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  value: number | string;
  unit: string;
  level: string;
  description?: string;
}) {
  const color = LEVEL_COLOR[level] ?? '#868e96';
  const mantineColor = LEVEL_MANTINE[level] ?? 'gray';
  return (
    <Paper withBorder radius="md" p="lg" style={{ borderTop: `3px solid ${color}` }}>
      <Group gap="xs" mb="sm">
        <ThemeIcon size={28} radius="md" color={mantineColor} variant="light">
          {icon}
        </ThemeIcon>
        <Text size="xs" c="dimmed" fw={600}>{title}</Text>
      </Group>
      <Group gap="xs" align="baseline">
        <Text fw={800} size="xl" c={color}>{value}</Text>
        <Text size="xs" c="dimmed">{unit}</Text>
      </Group>
      <Group gap="xs" mt={6}>
        <Badge size="xs" color={mantineColor} variant="light">
          {LEVEL_LABEL[level] ?? level}
        </Badge>
        {description && (
          <Text size="xs" c="dimmed">{description}</Text>
        )}
      </Group>
    </Paper>
  );
}

function SprintHealthCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="xs" mb={4}>
        <ThemeIcon size={24} radius="md" color="gray" variant="light">{icon}</ThemeIcon>
        <Text size="xs" c="dimmed" fw={600}>{label}</Text>
      </Group>
      <Text fw={800} size="xl" c={color} style={{ lineHeight: 1.1 }}>{value}</Text>
      {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Paper>
  );
}

export function OverviewTab({ projectKey: _projectKey, days: _days }: OverviewTabProps) {
  const { data: dora, isLoading: doraLoading } = useDoraMetrics();

  // Sprint health — dept summary across all boards
  const { data: rawDept, isLoading: deptLoading } = useQuery({
    queryKey: ['overview', 'dept-summary'],
    queryFn: () => apiClient.get('/jira/quality/department-summary?scope=all').then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const dept = Array.isArray(rawDept) ? rawDept : [];

  // Velocity from forecasting endpoint (no backlog filter)
  const { data: velForecast, isLoading: velLoading } = useQuery({
    queryKey: ['overview', 'velocity-forecast'],
    queryFn: () => apiClient.get('/engineering-analytics/forecasting/velocity-forecast', {
      params: { backlogSize: 30 },
    }).then(r => r.data),
    staleTime: 10 * 60_000,
  });

  const isLoading = doraLoading || deptLoading || velLoading;
  if (isLoading) return <Loader />;

  // Sprint health aggregates from dept
  const avgPredictability = dept.length
    ? Math.round(dept.reduce((s: number, r: any) => s + (r.predictability ?? 0), 0) / dept.length)
    : null;
  const avgDefectDensity = dept.length
    ? Math.round(dept.reduce((s: number, r: any) => s + (r.defect_density ?? 0), 0) / dept.length * 100) / 100
    : null;
  const boardsAtRisk = dept.filter((r: any) => r.grade === 'C' || r.grade === 'D').length;

  return (
    <Stack gap="xl">
      {/* ── DORA Metrics ────────────────────────────────────────────────── */}
      <div>
        <Group gap="xs" mb="md">
          <IconRocket size={16} color={AQUA_HEX} />
          <Text fw={700} size="sm">DORA Metrics</Text>
          {dora?.source && (
            <Badge size="xs" variant="outline" color="gray">{dora.source}</Badge>
          )}
          {dora?.lookbackMonths && (
            <Text size="xs" c="dimmed">Last {dora.lookbackMonths} months · {dora.totalReleases} releases</Text>
          )}
        </Group>

        {!dora ? (
          <Text size="sm" c="dimmed">No DORA data available. Ensure releases are tracked in Jira.</Text>
        ) : (
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <DoraKpiCard
              title="Deployment Frequency"
              icon={<IconRocket size={14} />}
              value={dora.deploymentFrequency.value}
              unit={dora.deploymentFrequency.unit}
              level={dora.deploymentFrequency.level}
              description={`${dora.totalReleases} total releases`}
            />
            <DoraKpiCard
              title="Lead Time for Changes"
              icon={<IconClock size={14} />}
              value={dora.leadTimeForChanges.value}
              unit={dora.leadTimeForChanges.unit}
              level={dora.leadTimeForChanges.level}
            />
            <DoraKpiCard
              title="Change Failure Rate"
              icon={<IconBug size={14} />}
              value={dora.changeFailureRate.value}
              unit={dora.changeFailureRate.unit}
              level={dora.changeFailureRate.level}
              description={dora.changeFailureRate.bugCount !== undefined ? `${dora.changeFailureRate.bugCount} failures` : undefined}
            />
            <DoraKpiCard
              title="Mean Time to Recovery"
              icon={<IconHeartbeat size={14} />}
              value={dora.meanTimeToRecovery.value}
              unit={dora.meanTimeToRecovery.unit}
              level={dora.meanTimeToRecovery.level}
            />
          </SimpleGrid>
        )}
      </div>

      <Divider />

      {/* ── Sprint Health KPIs ───────────────────────────────────────────── */}
      <div>
        <Group gap="xs" mb="md">
          <IconShieldCheck size={16} color={AQUA_HEX} />
          <Text fw={700} size="sm">Sprint Health</Text>
          <Text size="xs" c="dimmed">{dept.length} boards · most recent closed sprint</Text>
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <SprintHealthCard
            label="Avg Velocity"
            value={velForecast?.avg_velocity ? `${fmt1(velForecast.avg_velocity)} SP` : '—'}
            sub="avg story points / sprint"
            color={AQUA_HEX}
            icon={<IconTrendingUp size={14} />}
          />
          <SprintHealthCard
            label="Avg Predictability"
            value={avgPredictability !== null ? `${avgPredictability}%` : '—'}
            sub={`${dept.length} boards`}
            color={avgPredictability !== null
              ? avgPredictability >= 80 ? COLOR_SUCCESS : avgPredictability >= 60 ? COLOR_AMBER : COLOR_ERROR
              : '#868e96'}
            icon={<IconShieldCheck size={14} />}
          />
          <SprintHealthCard
            label="Avg Defect Density"
            value={avgDefectDensity !== null ? String(avgDefectDensity) : '—'}
            sub="bugs per story"
            color={avgDefectDensity !== null
              ? avgDefectDensity > 1 ? COLOR_ERROR : avgDefectDensity > 0.5 ? COLOR_AMBER : COLOR_SUCCESS
              : '#868e96'}
            icon={<IconBug size={14} />}
          />
          <SprintHealthCard
            label="Boards at Risk"
            value={String(boardsAtRisk)}
            sub={`Grade C/D out of ${dept.length}`}
            color={boardsAtRisk > 0 ? COLOR_AMBER : COLOR_SUCCESS}
            icon={<IconAlertTriangle size={14} />}
          />
        </SimpleGrid>
      </div>

      {/* ── Boards Summary ────────────────────────────────────────────────── */}
      {dept.length > 0 && (
        <>
          <Divider />
          <div>
            <Group gap="xs" mb="md">
              <Text fw={700} size="sm">Board Health Snapshot</Text>
              <Text size="xs" c="dimmed">Click a row to open Quality → Sprint Quality for drill-down</Text>
            </Group>
            <Stack gap="xs">
              {dept
                .sort((a: any, b: any) => (a.quality_score ?? 0) - (b.quality_score ?? 0))
                .slice(0, 8)
                .map((row: any) => {
                  const gradeColor = row.grade === 'A' ? 'green' : row.grade === 'B' ? 'teal' : row.grade === 'C' ? 'yellow' : 'red';
                  const predColor = (row.predictability ?? 0) >= 80 ? COLOR_SUCCESS : (row.predictability ?? 0) >= 60 ? COLOR_AMBER : COLOR_ERROR;
                  return (
                    <Paper key={row.board_id} p="sm" radius="md" withBorder>
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <Badge size="md" color={gradeColor} variant="filled" w={28} style={{ flexShrink: 0 }}>
                            {row.grade}
                          </Badge>
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600} lineClamp={1}>{row.project_key}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{row.sprint_name}</Text>
                          </div>
                        </Group>
                        <Group gap="md" wrap="nowrap" style={{ flexShrink: 0 }}>
                          <div style={{ textAlign: 'center', minWidth: 64 }}>
                            <Text size="xs" c="dimmed">Predictability</Text>
                            <Text size="xs" fw={700} c={predColor}>{row.predictability ?? 0}%</Text>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 48 }}>
                            <Text size="xs" c="dimmed">Bugs</Text>
                            <Badge size="xs" color={(row.bugs ?? 0) > 10 ? 'red' : (row.bugs ?? 0) > 3 ? 'yellow' : 'green'} variant="light">
                              {row.bugs ?? 0}
                            </Badge>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 64 }}>
                            <Text size="xs" c="dimmed">Completed</Text>
                            <Text size="xs">{row.completed ?? 0}/{row.committed ?? 0}</Text>
                          </div>
                          <div style={{ minWidth: 80 }}>
                            <Progress
                              value={row.quality_score ?? 0}
                              size="sm"
                              color={gradeColor}
                              style={{ marginTop: 4 }}
                            />
                            <Text size="10px" c="dimmed" ta="right">Score: {row.quality_score ?? 0}</Text>
                          </div>
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
            </Stack>
          </div>
        </>
      )}

      {/* ── Upcoming Releases ─────────────────────────────────────────────── */}
      {dora?.upcoming && dora.upcoming.length > 0 && (
        <>
          <Divider />
          <div>
            <Group gap="xs" mb="md">
              <IconRocket size={16} color={AQUA_HEX} />
              <Text fw={700} size="sm">Upcoming Releases</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {dora.upcoming.slice(0, 4).map((rel: any) => (
                <Paper key={rel.name} withBorder radius="md" p="md">
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={600}>{rel.name}</Text>
                    <Badge size="xs" color={rel.daysUntilRelease <= 7 ? 'red' : rel.daysUntilRelease <= 30 ? 'orange' : 'blue'} variant="light">
                      {rel.daysUntilRelease}d
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">Release: {rel.releaseDate}</Text>
                  {rel.codeFreezeDate && (
                    <Text size="xs" c="dimmed">Code freeze: {rel.codeFreezeDate}</Text>
                  )}
                </Paper>
              ))}
            </SimpleGrid>
          </div>
        </>
      )}
    </Stack>
  );
}
