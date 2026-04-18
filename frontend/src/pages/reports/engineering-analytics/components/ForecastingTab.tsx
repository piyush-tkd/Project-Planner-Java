import { useState } from 'react';
import {
  Stack, Paper, Text, Badge, Loader, NumberInput, SimpleGrid, Accordion,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../../api/client';
import { MetricCard } from './MetricCard';
import { fmt1, fmt0 } from '../utils';

export function ForecastingTab({ projectKey }: { projectKey: string | null; avatars: Record<string, string> }) {
  const [backlogSizeInput, setBacklogSizeInput] = useState<number | string>(30);

  const { data: velForecast, isLoading: velLoading } = useQuery({
    queryKey: ['eng-analytics', 'forecasting', 'velocity-forecast', projectKey, backlogSizeInput],
    queryFn: async () => {
      const res = await apiClient.get('/engineering-analytics/forecasting/velocity-forecast', {
        params: { backlogSize: parseInt(String(backlogSizeInput)) || 30, projectKey: projectKey || undefined },
      });
      return res.data;
    },
    enabled: !!projectKey || projectKey === null,
  });

  if (velLoading) return <Loader />;

  return (
    <Stack gap="lg">
      {/* Settings */}
      <Paper withBorder radius="md" p="lg">
        <Stack gap="xs">
          <Text fw={600} size="sm">Monte Carlo Simulation</Text>
          <Text size="xs" c="dimmed">
            Simulates thousands of sprint outcomes using historical velocity variance to forecast how long your backlog will take.
          </Text>
          <NumberInput
            label="Backlog Size (items)"
            description="Adjust to see how completion estimates change"
            value={backlogSizeInput}
            onChange={setBacklogSizeInput}
            min={1}
            max={500}
            step={5}
            w={250}
            mt={4}
          />
        </Stack>
      </Paper>

      {/* Percentile KPIs */}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <MetricCard title="50th Percentile" description="Median — most likely outcome">
          <Text fw={700} size="xl">
            {velForecast?.forecast_50th_pct_sprints ? `${velForecast.forecast_50th_pct_sprints} sprints` : '—'}
          </Text>
        </MetricCard>
        <MetricCard title="80th Percentile" description="Optimistic">
          <Text fw={700} size="xl">
            {velForecast?.forecast_80th_pct_sprints ? `${velForecast.forecast_80th_pct_sprints} sprints` : '—'}
          </Text>
        </MetricCard>
        <MetricCard title="90th Percentile" description="Conservative">
          <Text fw={700} size="xl">
            {velForecast?.forecast_90th_pct_sprints ? `${velForecast.forecast_90th_pct_sprints} sprints` : '—'}
          </Text>
        </MetricCard>
        <MetricCard title="Avg Velocity" description="Average sprint throughput">
          <Text fw={700} size="xl">
            {velForecast?.avg_velocity ? `${fmt1(velForecast.avg_velocity)} SP/sprint` : '—'}
          </Text>
        </MetricCard>
      </SimpleGrid>

      {/* Backlog summary */}
      {velForecast?.backlog_size !== undefined && (
        <MetricCard title="Backlog Overview" description="Current backlog against forecast">
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed">Total Backlog</Text>
              <Text fw={700} size="xl" mt={4}>{fmt0(velForecast.backlog_size)} items</Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed">Likely Completion (50th %ile)</Text>
              <Text fw={700} size="xl" mt={4}>
                {velForecast?.forecast_50th_pct_sprints ? `${velForecast.forecast_50th_pct_sprints} sprints` : '—'}
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed">Worst-case (90th %ile)</Text>
              <Text fw={700} size="xl" mt={4}>
                {velForecast?.forecast_90th_pct_sprints ? `${velForecast.forecast_90th_pct_sprints} sprints` : '—'}
              </Text>
              {velForecast?.forecast_90th_pct_sprints && velForecast?.forecast_50th_pct_sprints &&
               velForecast.forecast_90th_pct_sprints > velForecast.forecast_50th_pct_sprints && (
                <Badge size="xs" color="orange" mt={4}>
                  +{velForecast.forecast_90th_pct_sprints - velForecast.forecast_50th_pct_sprints} sprint buffer
                </Badge>
              )}
            </Paper>
          </SimpleGrid>
        </MetricCard>
      )}

      <Accordion>
        <Accordion.Item value="glossary">
          <Accordion.Control>📖 Glossary & Methodology</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <div>
                <Text fw={600} size="sm">Monte Carlo Simulation</Text>
                <Text size="xs" c="dimmed">Runs thousands of simulated sprint sequences using historical velocity variance. Each percentile represents what % of simulations finish by that sprint count.</Text>
              </div>
              <div>
                <Text fw={600} size="sm">50th Percentile</Text>
                <Text size="xs" c="dimmed">The median outcome — half of simulations finish faster, half slower. Use this as your baseline estimate.</Text>
              </div>
              <div>
                <Text fw={600} size="sm">90th Percentile</Text>
                <Text size="xs" c="dimmed">Conservative estimate — 90% of simulations finish by this sprint. Use for stakeholder commitments.</Text>
              </div>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
