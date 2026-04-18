/**
 * EngineeringEconomicsPage — Sprint 13, PP-1301
 * Cost overview, ROI tracker, and burn rate analytics — live from CostEngineController.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Group, Title, Text, SimpleGrid, Paper, Badge, Table,
  ThemeIcon, Tabs, Loader, Center, Alert,
} from '@mantine/core';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  IconCurrencyDollar, IconTrendingUp, IconChartPie, IconArrowUpRight,
  IconArrowDownRight, IconBuildingFactory,
} from '@tabler/icons-react';
import {
  AQUA_HEX, DEEP_BLUE_HEX, DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW,
  COLOR_TEAL, COLOR_ERROR, COLOR_WARNING,
} from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────

interface ValueMetric {
  id: number;
  project: { id: number; name: string };
  metricType: string;
  projectedValue: number;
  actualValue: number | null;
  capexAmount: number;
  opexAmount: number;
  measurementPeriod: string; // "YYYY-MM-DD"
}

interface RoiSummary {
  projectId: number;
  projectName: string;
  totalCost: number;
  totalValue: number;
  roiPercent: number;
}

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CAPEX_COLOR = AQUA;
const OPEX_COLOR  = DEEP_BLUE;

export default function EngineeringEconomicsPage() {
  const dark = useDarkMode();
  const textColor = dark ? '#e2e4eb' : DEEP_BLUE;

  // ── Live data ──
  const { data: metrics = [], isLoading: loadingMetrics } = useQuery<ValueMetric[]>({
    queryKey: ['cost-engine-metrics'],
    queryFn: () => apiClient.get('/cost-engine/metrics').then(r => r.data),
  });

  const { data: roiSummary = [], isLoading: loadingRoi } = useQuery<RoiSummary[]>({
    queryKey: ['cost-engine-roi'],
    queryFn: () => apiClient.get('/cost-engine/roi-summary').then(r => r.data),
  });

  // ── Derived: monthly CapEx/OpEx chart ──
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; capex: number; opex: number }> = {};
    metrics.forEach(m => {
      const d = new Date(m.measurementPeriod);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : ''}`.trim();
      if (!map[key]) map[key] = { month: label, capex: 0, opex: 0 };
      map[key].capex += Number(m.capexAmount) || 0;
      map[key].opex  += Number(m.opexAmount)  || 0;
    });
    return Object.keys(map).sort().map(k => map[k]);
  }, [metrics]);

  // ── KPIs ──
  const totalCapex  = metrics.reduce((s, m) => s + (Number(m.capexAmount) || 0), 0);
  const totalOpex   = metrics.reduce((s, m) => s + (Number(m.opexAmount)  || 0), 0);
  const totalCost   = totalCapex + totalOpex;
  const monthlyBurn = monthlyData.length > 0
    ? Math.round(monthlyData.reduce((s, m) => s + m.capex + m.opex, 0) / monthlyData.length)
    : 0;
  const avgRoi = roiSummary.length > 0
    ? Math.round(roiSummary.reduce((s, r) => s + r.roiPercent, 0) / roiSummary.length)
    : 0;
  const capexPct = totalCost > 0 ? Math.round((totalCapex / totalCost) * 100) : 0;
  const opexPct  = 100 - capexPct;

  const pieData = [
    { name: 'CapEx (Project Build)',    value: capexPct,  color: CAPEX_COLOR },
    { name: 'OpEx (BAU Maintenance)',   value: opexPct,   color: OPEX_COLOR  },
  ];

  const isLoading = loadingMetrics || loadingRoi;

  if (isLoading) {
    return <Center py="xl"><Loader color="teal" /></Center>;
  }

  const noData = metrics.length === 0 && roiSummary.length === 0;

  return (
    <Stack gap="lg" p="md">
      {/* ── Header ── */}
      <div>
        <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Engineering Economics</Title>
        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          Project costs, team burn rates, ROI analysis, and CapEx/OpEx split
        </Text>
      </div>

      {noData && (
        <Alert color="blue" variant="light">
          No cost data found. Add project value metrics via Settings → Cost Rates to populate this dashboard.
        </Alert>
      )}

      {/* ── KPI Row ── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[
          { label: 'Total Spend (YTD)',  value: fmtUSD(totalCost),   icon: <IconCurrencyDollar size={20} />, color: DEEP_BLUE },
          { label: 'Monthly Burn Rate',  value: fmtUSD(monthlyBurn), icon: <IconTrendingUp size={20} />,    color: COLOR_WARNING },
          { label: 'Avg Project ROI',    value: roiSummary.length > 0 ? `${avgRoi >= 0 ? '+' : ''}${avgRoi}%` : '—',
            icon: <IconChartPie size={20} />, color: avgRoi >= 0 ? COLOR_TEAL : COLOR_ERROR },
          { label: 'CapEx / OpEx Split', value: totalCost > 0 ? `${capexPct}/${opexPct}` : '—',
            icon: <IconBuildingFactory size={20} />, color: AQUA },
        ].map(kpi => (
          <Paper key={kpi.label} withBorder p="md" radius="md" style={{ boxShadow: SHADOW.card }}>
            <Group gap="sm" mb={6}>
              <ThemeIcon size={36} radius="md" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                {kpi.icon}
              </ThemeIcon>
              <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{kpi.label}</Text>
            </Group>
            <Text size="xl" fw={800} style={{ fontFamily: FONT_FAMILY, color: kpi.color }}>
              {kpi.value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      {/* ── Tabs ── */}
      <Tabs defaultValue="trend" variant="outline" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="trend"  leftSection={<IconTrendingUp size={14} />}>Cost Trend</Tabs.Tab>
          <Tabs.Tab value="roi"    leftSection={<IconChartPie size={14} />}>Project ROI</Tabs.Tab>
          <Tabs.Tab value="split"  leftSection={<IconBuildingFactory size={14} />}>CapEx / OpEx</Tabs.Tab>
        </Tabs.List>

        {/* ── Cost Trend Chart ── */}
        <Tabs.Panel value="trend">
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>
              Monthly Spend — CapEx + OpEx
              <Text component="span" size="xs" c="dimmed" ml="xs">({monthlyData.length} months)</Text>
            </Text>
            {monthlyData.length > 0 ? (
              <div role="img" aria-label="Bar chart">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: FONT_FAMILY, fill: textColor }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: FONT_FAMILY, fill: textColor }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(v: number) => fmtUSD(v)}
                    contentStyle={{ fontFamily: FONT_FAMILY, borderRadius: 8, background: dark ? '#1e293b' : '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
                  <Bar dataKey="capex" name="CapEx" fill={AQUA_HEX}      stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="opex"  name="OpEx"  fill={DEEP_BLUE_HEX} stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">No cost data available yet.</Text>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ── Project ROI Table ── */}
        <Tabs.Panel value="roi">
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>
              Project ROI Tracker
              <Text component="span" size="xs" c="dimmed" ml="xs">({roiSummary.length} projects)</Text>
            </Text>
            {roiSummary.length > 0 ? (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    {['Project', 'Total Cost', 'Projected Value', 'ROI', 'Trend'].map(h => (
                      <Table.Th key={h} style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...roiSummary].sort((a, b) => b.roiPercent - a.roiPercent).map(p => (
                    <Table.Tr key={p.projectId}>
                      <Table.Td>
                        <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{p.projectName}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{fmtUSD(p.totalCost)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{fmtUSD(p.totalValue)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={p.roiPercent >= 50 ? 'green' : p.roiPercent >= 0 ? 'yellow' : 'red'}
                          variant="light"
                        >
                          {p.roiPercent >= 0 ? `+${p.roiPercent.toFixed(1)}%` : `${p.roiPercent.toFixed(1)}%`}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {p.roiPercent > 0  && <IconArrowUpRight   size={16} color={COLOR_TEAL}  />}
                        {p.roiPercent < 0  && <IconArrowDownRight size={16} color={COLOR_ERROR} />}
                        {p.roiPercent === 0 && <Text size="xs" c="dimmed">—</Text>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No project ROI data yet. Add cost metrics for projects to track ROI.
              </Text>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ── CapEx / OpEx Split ── */}
        <Tabs.Panel value="split">
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>CapEx vs OpEx Split</Text>
            {totalCost > 0 ? (
              <>
                <div role="img" aria-label="Pie chart">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={130}
                      paddingAngle={4} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                      labelLine={{ stroke: textColor }}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => `${v}%`}
                      contentStyle={{ fontFamily: FONT_FAMILY, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                </div>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                  {pieData.map(item => (
                    <Paper key={item.name} withBorder p="md" radius="md" style={{ borderLeft: `4px solid ${item.color}` }}>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{item.name}</Text>
                      <Text size="lg" fw={700} style={{ fontFamily: FONT_FAMILY, color: item.color }}>
                        {item.value}%
                      </Text>
                      <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
                        {fmtUSD(totalCost * item.value / 100)} YTD
                      </Text>
                    </Paper>
                  ))}
                </SimpleGrid>
              </>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No cost data available. CapEx/OpEx split will appear once metrics are added.
              </Text>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
