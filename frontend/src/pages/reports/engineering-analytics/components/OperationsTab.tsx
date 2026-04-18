import {
  Stack, Paper, Text, Badge, Group, Accordion,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import apiClient from '../../../../api/client';
import { AQUA_HEX, COLOR_ERROR } from '../../../../brandTokens';
import { MetricCard } from './MetricCard';
import { SprintCommandCenterContent } from '../../../SprintCommandCenterPage';

interface OperationsTabProps {
  projectKey: string | null;
  days: number;
  avatars: Record<string, string>;
}

export function OperationsTab({ projectKey, days, avatars }: OperationsTabProps) {
  const { data: riskDet } = useQuery({
    queryKey: ['eng-analytics', 'operations', 'risk-detection', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/risk-detection', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  const { data: seasonalPat } = useQuery({
    queryKey: ['eng-analytics', 'operations', 'seasonal-patterns', projectKey],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/seasonal-patterns', {
        params: { projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  return (
    <Stack gap="lg">
      {/* Sprint Command Center */}
      <SprintCommandCenterContent projectKey={projectKey} days={days} avatars={avatars} />

      {/* Risk Detection */}
      {Array.isArray(riskDet) && riskDet.length > 0 && (
        <MetricCard
          title="Risk Detection"
          description="Automated flags based on velocity, WIP, and bug trends"
        >
          <Stack gap="md">
            {(riskDet as any[]).slice(0, 5).map((risk: any, i: number) => (
              <Paper key={i} p="md" radius="md" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={600} size="sm">{risk.project_key}</Text>
                  <Badge color={risk.risk_level === 'high' ? 'red' : risk.risk_level === 'medium' ? 'yellow' : 'gray'}>
                    Risk: {risk.risk_score.toFixed(0)}
                  </Badge>
                </Group>
                <Group gap="xs" mb="sm">
                  <Text size="xs" c="dimmed">
                    WIP: {risk.current_wip} · Bugs (14d): {risk.recent_bugs} · Velocity: {risk.velocity_trend?.last ?? '—'} (prev: {risk.velocity_trend?.previous ?? '—'})
                    {risk.velocity_trend?.last < risk.velocity_trend?.previous && (
                      <Badge size="xs" color="red" ml={4}>↓ Dropping</Badge>
                    )}
                  </Text>
                </Group>
                {risk.flags && risk.flags.length > 0 && (
                  <Group gap="xs">
                    {risk.flags.map((flag: string, idx: number) => (
                      <Badge key={idx} size="xs" variant="light" color="orange">{flag}</Badge>
                    ))}
                  </Group>
                )}
              </Paper>
            ))}
          </Stack>
        </MetricCard>
      )}

      {/* Seasonal Patterns */}
      {seasonalPat?.by_month && seasonalPat.by_month.length > 0 && (
        <MetricCard
          title="Seasonal Patterns"
          description="Throughput trend — spot predictable dips (holidays, release crunch)"
        >
          <div role="img" aria-label="Seasonal throughput line chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={seasonalPat.by_month}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartTooltip contentStyle={{ fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="issues_completed" stroke={AQUA_HEX} strokeWidth={2} dot={false} />
                {seasonalPat.by_month.some((d: any) => d.bugs_resolved !== undefined) && (
                  <Line type="monotone" dataKey="bugs_resolved" stroke={COLOR_ERROR} strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </MetricCard>
      )}

      <Accordion>
        <Accordion.Item value="glossary">
          <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm" style={{ fontSize: '14px' }}>
              <div>
                <Text fw={600} size="sm">Risk Detection</Text>
                <Text size="xs" c="dimmed">Automated flags based on: velocity drop &gt;30%, WIP &gt;20, bug spike in 14 days</Text>
              </div>
              <div>
                <Text fw={600} size="sm">Seasonal Patterns</Text>
                <Text size="xs" c="dimmed">Completed issues and bugs resolved by month — identifies recurring productivity dips</Text>
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
