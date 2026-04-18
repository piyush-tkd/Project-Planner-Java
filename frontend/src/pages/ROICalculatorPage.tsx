/**
 * ROICalculatorPage — Sprint 13, PP-1303
 * Interactive ROI calculator with break-even chart
 */
import { useState } from 'react';
import {
  Stack, Group, Title, Text, Paper, NumberInput, Button,
  Divider, Badge, SimpleGrid,
} from '@mantine/core';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, COLOR_TEAL, COLOR_ERROR } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

interface ProjectInput {
  id: string;
  name: string;
  monthlyCost: number;
  monthlyValue: number;
  durationMonths: number;
}

const COLORS = [AQUA, COLOR_TEAL, '#6366F1', '#EC4899', '#F59E0B'];
const fmtUSD = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// @ts-expect-error -- unused
function calcBreakEven(proj: ProjectInput): Array<{ month: number; cost: number; value: number; net: number }> {
  return Array.from({ length: proj.durationMonths + 3 }, (_, i) => ({
    month: i,
    cost:  -(i * proj.monthlyCost),
    value: i * proj.monthlyValue,
    net:   i * (proj.monthlyValue - proj.monthlyCost),
  }));
}

export default function ROICalculatorPage() {
  const dark = useDarkMode();
  const textColor = dark ? '#e2e4eb' : DEEP_BLUE;

  const [projects, setProjects] = useState<ProjectInput[]>([
    { id: '1', name: 'Project A', monthlyCost: 80000, monthlyValue: 120000, durationMonths: 12 },
  ]);

  const addProject = () => setProjects(ps => [...ps, {
    id: String(Date.now()), name: `Project ${ps.length + 1}`,
    monthlyCost: 60000, monthlyValue: 80000, durationMonths: 12,
  }]);

  const removeProject = (id: string) => setProjects(ps => ps.filter(p => p.id !== id));
  const updateProject = (id: string, field: keyof ProjectInput, value: any) =>
    setProjects(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p));

  // Build comparison chart data (max 24 months)
  const maxMonths = Math.max(...projects.map(p => p.durationMonths)) + 3;
  const chartData = Array.from({ length: maxMonths }, (_, month) => {
    const row: Record<string, any> = { month };
    projects.forEach(p => {
      row[`${p.name} Net`] = month * (p.monthlyValue - p.monthlyCost);
    });
    return row;
  });

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <div>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>ROI Calculator</Title>
          <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
            Model project ROI, compare scenarios, and find break-even points
          </Text>
        </div>
        <Button size="sm" leftSection={<IconPlus size={14} />} variant="light"
          onClick={addProject}>
          Add Project
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* ── Project Inputs ── */}
        <Stack gap="md">
          {projects.map((proj, idx) => {
            const totalCost  = proj.monthlyCost  * proj.durationMonths;
            const totalValue = proj.monthlyValue * proj.durationMonths;
            const roi        = totalCost > 0 ? Math.round(((totalValue - totalCost) / totalCost) * 100) : 0;
            const breakEvenMonth = proj.monthlyValue > proj.monthlyCost
              ? Math.ceil(proj.monthlyCost / (proj.monthlyValue - proj.monthlyCost))
              : null;

            return (
              <Paper key={proj.id} withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card,
                borderTop: `3px solid ${COLORS[idx % COLORS.length]}` }}>
                <Group justify="space-between" mb="sm">
                  <Text fw={700} size="sm" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
                    {proj.name}
                  </Text>
                  <Group gap="xs">
                    <Badge color={roi >= 0 ? 'green' : 'red'} variant="light" size="sm">
                      ROI: {roi >= 0 ? '+' : ''}{roi}%
                    </Badge>
                    {projects.length > 1 && (
                      <Button size="xs" variant="subtle" color="red" p={4}
                        onClick={() => removeProject(proj.id)}>
                        <IconTrash size={12} />
                      </Button>
                    )}
                  </Group>
                </Group>

                <Stack gap="xs">
                  <NumberInput label="Monthly Cost ($)" value={proj.monthlyCost}
                    onChange={v => updateProject(proj.id, 'monthlyCost', Number(v))}
                    min={0} step={5000} prefix="$" thousandSeparator="," />
                  <NumberInput label="Monthly Value Generated ($)" value={proj.monthlyValue}
                    onChange={v => updateProject(proj.id, 'monthlyValue', Number(v))}
                    min={0} step={5000} prefix="$" thousandSeparator="," />
                  <NumberInput label="Project Duration (months)" value={proj.durationMonths}
                    onChange={v => updateProject(proj.id, 'durationMonths', Number(v))}
                    min={1} max={60} />
                </Stack>

                <Divider my="sm" />

                <SimpleGrid cols={3}>
                  {[
                    { label: 'Total Cost',    value: fmtUSD(totalCost),  color: COLOR_ERROR },
                    { label: 'Total Value',   value: fmtUSD(totalValue), color: COLOR_TEAL },
                    { label: 'Break-even',    value: breakEvenMonth ? `Month ${breakEvenMonth}` : 'Never', color: AQUA },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ textAlign: "center" }}>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{kpi.label}</Text>
                      <Text size="sm" fw={700} style={{ fontFamily: FONT_FAMILY, color: kpi.color }}>
                        {kpi.value}
                      </Text>
                    </div>
                  ))}
                </SimpleGrid>
              </Paper>
            );
          })}
        </Stack>

        {/* ── Break-even Chart ── */}
        <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
          <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>
            Net Cumulative Value Over Time
          </Text>
          <div role="img" aria-label="Line chart">
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: FONT_FAMILY, fill: textColor }}
                label={{ value: 'Month', position: 'insideBottom', offset: -4, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11, fontFamily: FONT_FAMILY, fill: textColor }}
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmtUSD(v)}
                contentStyle={{ fontFamily: FONT_FAMILY, borderRadius: 8, background: dark ? '#1e293b' : '#fff' }} />
              <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
              <ReferenceLine y={0} stroke={textColor} strokeDasharray="4 4" />
              {projects.map((p, i) => (
                <Line key={p.id} type="monotone" dataKey={`${p.name} Net`}
                  stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                  dot={false} animationDuration={400} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          </div>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
