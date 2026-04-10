/**
 * EngineeringEconomicsPage — Sprint 13, PP-1301
 * Cost overview, ROI tracker, and burn rate analytics
 */
import { useState, useEffect } from 'react';
import {
  Stack, Group, Title, Text, SimpleGrid, Paper, Badge, Progress, Table,
  ThemeIcon, Tabs, Loader, Alert,
} from '@mantine/core';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  IconCurrencyDollar, IconTrendingUp, IconChartPie, IconArrowUpRight,
  IconArrowDownRight, IconBuildingFactory, IconCode,
} from '@tabler/icons-react';
import { AQUA_HEX, DEEP_BLUE_HEX, DEEP_BLUE, AQUA, FONT_FAMILY, SHADOW, COLOR_TEAL, COLOR_ERROR, COLOR_WARNING, COLOR_VIOLET } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';

// ── Mock data while cost engine API is being built ────────────────────
const MOCK_MONTHLY_COST = [
  { month: 'Jan', capex: 420000, opex: 180000 },
  { month: 'Feb', capex: 440000, opex: 185000 },
  { month: 'Mar', capex: 460000, opex: 190000 },
  { month: 'Apr', capex: 390000, opex: 195000 },
  { month: 'May', capex: 480000, opex: 200000 },
  { month: 'Jun', capex: 510000, opex: 205000 },
];

const MOCK_PROJECT_ROI = [
  { name: 'EPIC Migration',     cost: 1200000, value: 2400000, roi: 100, trend: 'up' },
  { name: 'Portal Rebuild',     cost:  850000, value: 1100000, roi:  29, trend: 'up' },
  { name: 'RCM Automation',     cost:  620000, value: 1800000, roi: 190, trend: 'up' },
  { name: 'Reporting Engine',   cost:  340000, value:  450000, roi:  32, trend: 'flat' },
  { name: 'Mobile App',         cost:  780000, value:  560000, roi: -28, trend: 'down' },
];

const CAPEX_OPEX_PIE = [
  { name: 'CapEx (Project Build)', value: 65, color: AQUA },
  { name: 'OpEx (BAU Maintenance)', value: 35, color: DEEP_BLUE },
];

const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function EngineeringEconomicsPage() {
  const dark = useDarkMode();
  const textColor = dark ? '#e2e4eb' : DEEP_BLUE;

  const totalCapex  = MOCK_MONTHLY_COST.reduce((s, m) => s + m.capex,  0);
  const totalOpex   = MOCK_MONTHLY_COST.reduce((s, m) => s + m.opex,   0);
  const totalCost   = totalCapex + totalOpex;
  const monthlyBurn = Math.round(totalCost / MOCK_MONTHLY_COST.length);
  const avgRoi      = Math.round(MOCK_PROJECT_ROI.reduce((s, p) => s + p.roi, 0) / MOCK_PROJECT_ROI.length);

  return (
    <Stack gap="lg" p="md">
      {/* ── Header ── */}
      <div>
        <Title order={2} style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>Engineering Economics</Title>
        <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>
          Project costs, team burn rates, ROI analysis, and CapEx/OpEx split
        </Text>
      </div>

      {/* ── KPI Row ── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[
          { label: 'Total Spend (YTD)',   value: fmtUSD(totalCost),   icon: <IconCurrencyDollar size={20} />, color: DEEP_BLUE },
          { label: 'Monthly Burn Rate',   value: fmtUSD(monthlyBurn), icon: <IconTrendingUp size={20} />,    color: COLOR_WARNING },
          { label: 'Avg Project ROI',     value: `${avgRoi}%`,        icon: <IconChartPie size={20} />,      color: avgRoi >= 0 ? COLOR_TEAL : COLOR_ERROR },
          { label: 'CapEx / OpEx Split',  value: '65/35',             icon: <IconBuildingFactory size={20} />,color: AQUA },
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

      {/* ── Tabs: Cost Trend / Project ROI / CapEx-OpEx ── */}
      <Tabs defaultValue="trend" variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab value="trend" leftSection={<IconTrendingUp size={14} />}>Cost Trend</Tabs.Tab>
          <Tabs.Tab value="roi" leftSection={<IconChartPie size={14} />}>Project ROI</Tabs.Tab>
          <Tabs.Tab value="split" leftSection={<IconBuildingFactory size={14} />}>CapEx / OpEx</Tabs.Tab>
        </Tabs.List>

        {/* ── Cost Trend Chart ── */}
        <Tabs.Panel value="trend">
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>Monthly Spend — CapEx + OpEx</Text>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={MOCK_MONTHLY_COST} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: FONT_FAMILY, fill: textColor }} />
                <YAxis tick={{ fontSize: 11, fontFamily: FONT_FAMILY, fill: textColor }}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(v: number) => fmtUSD(v)}
                  contentStyle={{ fontFamily: FONT_FAMILY, borderRadius: 8, background: dark ? '#1e293b' : '#fff' }}
                />
                <Legend wrapperStyle={{ fontFamily: FONT_FAMILY, fontSize: 12 }} />
                <Bar dataKey="capex" name="CapEx" fill={AQUA_HEX}      stackId="a" radius={[0,0,0,0]} />
                <Bar dataKey="opex"  name="OpEx"  fill={DEEP_BLUE_HEX} stackId="a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Tabs.Panel>

        {/* ── Project ROI Table ── */}
        <Tabs.Panel value="roi">
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>Project ROI Tracker</Text>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {['Project','Cost','Value','ROI','Trend'].map(h => (
                    <Table.Th key={h} style={{ fontFamily: FONT_FAMILY, fontSize: 11 }}>{h}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {MOCK_PROJECT_ROI.sort((a, b) => b.roi - a.roi).map(p => (
                  <Table.Tr key={p.name}>
                    <Table.Td>
                      <Text size="sm" fw={500} style={{ fontFamily: FONT_FAMILY }}>{p.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{fmtUSD(p.cost)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>{fmtUSD(p.value)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={p.roi >= 50 ? 'green' : p.roi >= 0 ? 'yellow' : 'red'} variant="light">
                        {p.roi >= 0 ? `+${p.roi}%` : `${p.roi}%`}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {p.trend === 'up'   && <IconArrowUpRight   size={16} color={COLOR_TEAL} />}
                      {p.trend === 'down' && <IconArrowDownRight size={16} color={COLOR_ERROR} />}
                      {p.trend === 'flat' && <Text size="xs" c="dimmed">—</Text>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* ── CapEx/OpEx Split ── */}
        <Tabs.Panel value="split">
          <Paper withBorder p="md" radius="lg" style={{ boxShadow: SHADOW.card }}>
            <Text fw={600} size="sm" mb="md" style={{ fontFamily: FONT_FAMILY }}>CapEx vs OpEx Split</Text>
            <Group justify="center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={CAPEX_OPEX_PIE} cx="50%" cy="50%" innerRadius={80} outerRadius={130}
                    paddingAngle={4} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={{ stroke: textColor }}
                  >
                    {CAPEX_OPEX_PIE.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`}
                    contentStyle={{ fontFamily: FONT_FAMILY, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Group>
            <SimpleGrid cols={2} spacing="md" mt="md">
              {CAPEX_OPEX_PIE.map(item => (
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
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
