import React, { useState, useMemo } from 'react';
import {
  Container, Title, Grid, Card, Slider, NumberInput, Table, Badge,
  Stack, Text, Group, Select, Paper, Skeleton, Alert,
} from '@mantine/core';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle } from '@tabler/icons-react';
import { DEEP_BLUE_HEX, AQUA_HEX, FONT_FAMILY } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/client';

// Use hex values for recharts (CSS vars not supported in SVG attributes)
const CHART_DEEP_BLUE = DEEP_BLUE_HEX;
const CHART_AQUA = AQUA_HEX;

interface GapRow {
  role: string;
  demand: number;
  supply: number;
  gap: number;
  gapPercent?: number;
}

interface ForecastPoint {
  month: string;
  currentDemand: number;
  projectedDemand: number;
  supply: number;
}

interface HiringTrigger {
  role: string;
  currentDemand: number;
  supply: number;
  gap: number;
  gapPercent: number;
}

// Build a 6-month forecast projection from a real demand total
function buildForecast(totalDemand: number, totalSupply: number): ForecastPoint[] {
  const months = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026'];
  return months.map((month, idx) => ({
    month,
    currentDemand: totalDemand,
    projectedDemand: Math.round(totalDemand * (1 + idx * 0.04)),
    supply: Math.round(totalSupply * (1 + idx * 0.015)),
  }));
}

export default function DemandForecastPage() {
  const isDarkMode = useDarkMode();
  const [headcountGrowth, setHeadcountGrowth] = useState(5);
  const [attritionRate, setAttritionRate] = useState(8);
  const [newProjectStarts, setNewProjectStarts] = useState(1);

  // ── Live data from backend ────────────────────────────────────────────
  const { data: gapRows = [], isLoading, isError } = useQuery<GapRow[]>({
    queryKey: ['demand-forecast-gap'],
    queryFn: () => apiClient.get('/demands/gap-analysis').then(r => r.data),
  });

  const totalDemand = useMemo(() => gapRows.reduce((s, r) => s + (r.demand ?? 0), 0), [gapRows]);
  const totalSupply  = useMemo(() => gapRows.reduce((s, r) => s + (r.supply ?? 0), 0), [gapRows]);

  // Build baseline forecast from real totals, then apply scenario multipliers
  const baseForecast = useMemo(() => buildForecast(totalDemand || 20, totalSupply || 15), [totalDemand, totalSupply]);

  const adjustedForecast = useMemo(() => baseForecast.map((point, idx) => {
    const n = baseForecast.length;
    const growthFactor    = 1 + (headcountGrowth  / 100) * (idx / n);
    const attritionFactor = 1 - (attritionRate    / 100) * (idx / (n * 2));
    const projectFactor   = 1 + (newProjectStarts * 0.5) * (idx / n);
    return { ...point, projectedDemand: Math.round(point.currentDemand * growthFactor * attritionFactor * projectFactor) };
  }), [baseForecast, headcountGrowth, attritionRate, newProjectStarts]);

  // Hiring triggers from real gap data
  const hiringTriggers: HiringTrigger[] = useMemo(() =>
    (Array.isArray(gapRows) ? gapRows : [])
      .map(r => {
        const gap = (r.demand ?? 0) - (r.supply ?? 0);
        const gapPercent = r.supply > 0 ? (gap / r.supply) * 100 : 0;
        return { role: r.role ?? 'Unknown', currentDemand: r.demand ?? 0, supply: r.supply ?? 0, gap, gapPercent };
      })
      .filter(t => t.gapPercent > 20)
      .sort((a, b) => b.gapPercent - a.gapPercent),
  [gapRows]);

  const textColor = isDarkMode ? '#E0E0E0' : '#222';
  const gridColor = isDarkMode ? '#444' : '#CCC';

  return (
    <Container size="xl" py="lg">
      <Title order={2} mb="lg" style={{ fontFamily: FONT_FAMILY }}>
        Demand Forecast
      </Title>

      {isError && (
        <Alert icon={<IconAlertCircle size={14} />} color="red" mb="md">
          Failed to load gap analysis data — showing estimated baseline
        </Alert>
      )}

      <Grid gutter="lg" mb="lg">
        {/* Main Chart */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            style={{
              backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF',
              borderColor: isDarkMode ? '#333' : '#DDD',
            }}
          >
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                  6-Month Forecast
                </Text>
                {!isLoading && !isError && (
                  <Badge size="xs" color="teal" variant="light">● Live data</Badge>
                )}
              </Group>
              {isLoading ? (
                <Skeleton height={350} radius="md" />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={adjustedForecast} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 12, fontFamily: FONT_FAMILY }} />
                    <YAxis tick={{ fill: textColor, fontSize: 12, fontFamily: FONT_FAMILY }} />
                    <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#2A2A2A' : '#FFF', border: `1px solid ${CHART_AQUA}`, fontFamily: FONT_FAMILY, color: textColor }} />
                    <Legend wrapperStyle={{ fontFamily: FONT_FAMILY }} />
                    <Bar dataKey="currentDemand" fill={CHART_DEEP_BLUE} name="Current Demand" />
                    <Bar dataKey="supply" fill="#A0A0A0" name="Supply" />
                    <Line type="monotone" dataKey="projectedDemand" stroke={CHART_AQUA} strokeWidth={3} name="Projected Demand" dot={{ fill: CHART_AQUA, r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* What-If Scenario Panel */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            style={{
              backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF',
              borderColor: isDarkMode ? '#333' : '#DDD',
            }}
          >
            <Stack gap="md">
              <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
                What-If Scenario
              </Text>

              <div>
                <Text size="sm" fw={500} mb="xs" style={{ fontFamily: FONT_FAMILY }}>
                  Headcount Growth
                </Text>
                <Group justify="space-between" mb="xs">
                  <Slider
                    min={0}
                    max={20}
                    value={headcountGrowth}
                    onChange={setHeadcountGrowth}
                    flex={1}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 10, label: '10%' },
                      { value: 20, label: '20%' },
                    ]}
                  />
                  <Badge color="aqua" variant="light">
                    {headcountGrowth}%
                  </Badge>
                </Group>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs" style={{ fontFamily: FONT_FAMILY }}>
                  Attrition Rate
                </Text>
                <Group justify="space-between" mb="xs">
                  <Slider
                    min={0}
                    max={25}
                    value={attritionRate}
                    onChange={setAttritionRate}
                    flex={1}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 10, label: '10%' },
                      { value: 25, label: '25%' },
                    ]}
                  />
                  <Badge color="orange" variant="light">
                    {attritionRate}%
                  </Badge>
                </Group>
              </div>

              <NumberInput
                label="New Project Starts"
                value={newProjectStarts}
                onChange={(val) => setNewProjectStarts(Number(val) || 0)}
                min={0}
                max={5}
                step={1}
                styles={{ label: { fontFamily: FONT_FAMILY } }}
              />

              <Paper bg={isDarkMode ? '#2A2A2A' : '#F5F5F5'} p="sm" radius="md">
                <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                  Adjusted forecast recalculates based on growth, attrition, and project factors.
                </Text>
              </Paper>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Hiring Triggers Table */}
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        style={{
          backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF',
          borderColor: isDarkMode ? '#333' : '#DDD',
        }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600} size="sm" style={{ fontFamily: FONT_FAMILY }}>
              Hiring Triggers (Demand exceeds supply by &gt;20%)
            </Text>
            {!isLoading && <Badge size="xs" color="teal" variant="light">● Live: {gapRows.length} roles</Badge>}
          </Group>

          {isLoading ? (
            <Stack gap="xs">{[1,2,3].map(i => <Skeleton key={i} height={36} radius="sm" />)}</Stack>
          ) : hiringTriggers.length === 0 ? (
            <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
              No critical hiring needs at this time.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5' }}>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Role</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Current Demand</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Supply</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Gap</Table.Th>
                  <Table.Th style={{ fontFamily: FONT_FAMILY }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hiringTriggers.map((trigger, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td style={{ fontFamily: FONT_FAMILY }}>{trigger.role}</Table.Td>
                    <Table.Td>{trigger.currentDemand}</Table.Td>
                    <Table.Td>{trigger.supply}</Table.Td>
                    <Table.Td fw={600}>{trigger.gap}</Table.Td>
                    <Table.Td>
                      <Badge color="red" variant="filled">
                        Recommend Hire
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Container>
  );
}
