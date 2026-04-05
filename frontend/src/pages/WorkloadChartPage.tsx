import { useState, useMemo } from 'react';
import {
  Box, Title, Text, Group, Badge, Select, Button, Paper, Card,
  SimpleGrid, Progress, Avatar, SegmentedControl,
  Stack,
} from '@mantine/core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  IconFilter, IconDownload,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, DEEP_BLUE_TINTS } from '../brandTokens';

const PODS = ['All PODs', 'Portal V1', 'Portal V2', 'Integrations', 'Accessioning', 'LIS/Reporting', 'Enterprise Systems'];

const WORKLOAD_DATA = [
  { name: 'Gowthami Naidu',    pod: 'LIS/Reporting',      role: 'QA',        avatar: 'GN', capacity: 160, allocated: 128, pct: 80  },
  { name: 'Katy Zarty',        pod: 'Enterprise Systems',  role: 'Developer', avatar: 'KZ', capacity: 160, allocated: 160, pct: 100 },
  { name: 'Kaitlyn Walton',    pod: 'Enterprise Systems',  role: 'Developer', avatar: 'KW', capacity: 160, allocated: 144, pct: 90  },
  { name: 'Justin Branch',     pod: 'Enterprise Systems',  role: 'Developer', avatar: 'JB', capacity: 160, allocated: 104, pct: 65  },
  { name: 'Priti Kothavale',   pod: 'Portal V1',           role: 'Developer', avatar: 'PK', capacity: 160, allocated: 176, pct: 110 },
  { name: 'Angela Chen',       pod: 'Portal V2',           role: 'Tech Lead', avatar: 'AC', capacity: 160, allocated: 192, pct: 120 },
  { name: 'Marcus Webb',       pod: 'Integrations',        role: 'Developer', avatar: 'MW', capacity: 160, allocated: 136, pct: 85  },
  { name: 'Sara Patel',        pod: 'Accessioning',        role: 'QA',        avatar: 'SP', capacity: 160, allocated: 80,  pct: 50  },
  { name: 'David Kim',         pod: 'Portal V2',           role: 'Developer', avatar: 'DK', capacity: 160, allocated: 160, pct: 100 },
  { name: 'Lisa Nguyen',       pod: 'LIS/Reporting',       role: 'Developer', avatar: 'LN', capacity: 160, allocated: 56,  pct: 35  },
  { name: 'Raj Patel',         pod: 'Integrations',        role: 'Developer', avatar: 'RP', capacity: 160, allocated: 168, pct: 105 },
  { name: 'Tom Bradley',       pod: 'Accessioning',        role: 'BSA',       avatar: 'TB', capacity: 160, allocated: 120, pct: 75  },
];

const POD_SUMMARY_DATA = [
  { pod: 'Portal V1',          capacity: 480, allocated: 400, pct: 83  },
  { pod: 'Portal V2',          capacity: 640, allocated: 704, pct: 110 },
  { pod: 'Integrations',       capacity: 480, allocated: 456, pct: 95  },
  { pod: 'Accessioning',       capacity: 320, allocated: 288, pct: 90  },
  { pod: 'LIS/Reporting',      capacity: 480, allocated: 368, pct: 77  },
  { pod: 'Enterprise Systems', capacity: 640, allocated: 616, pct: 96  },
];

const MONTHLY_TREND = [
  { month: 'Jan', utilization: 78, overAllocated: 2 },
  { month: 'Feb', utilization: 82, overAllocated: 3 },
  { month: 'Mar', utilization: 85, overAllocated: 4 },
  { month: 'Apr', utilization: 91, overAllocated: 5 },
  { month: 'May', utilization: 88, overAllocated: 3 },
  { month: 'Jun', utilization: 79, overAllocated: 1 },
];

function getUtilColor(pct: number) {
  if (pct > 100) return '#ef4444';
  if (pct >= 85)  return '#f59e0b';
  if (pct < 50)   return '#94a3b8';
  return '#22c55e';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper withBorder p="sm" shadow="md" radius="md" style={{ fontSize: 12, minWidth: 160 }}>
      <Text fw={700} size="sm" mb={4} style={{ color: DEEP_BLUE }}>{label}</Text>
      {payload.map((entry: any) => (
        <Group key={entry.name} gap="xs" mb={2}>
          <Box style={{ width: 10, height: 10, borderRadius: 2, background: entry.fill || entry.color }} />
          <Text size="xs">{entry.name}: <strong>{entry.value}{typeof entry.value === 'number' && entry.name.includes('%') ? '' : entry.name.toLowerCase().includes('hrs') ? 'h' : '%'}</strong></Text>
        </Group>
      ))}
    </Paper>
  );
};

// Custom legend chip row — rendered as JSX below charts to avoid Recharts overlap
function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <Group gap="lg" mt="md" justify="center" wrap="wrap">
      {items.map(l => (
        <Group key={l.label} gap={6}>
          <Box style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
          <Text size="xs" c="dimmed">{l.label}</Text>
        </Group>
      ))}
    </Group>
  );
}

export default function WorkloadChartPage() {
  const [filterPod, setFilterPod] = useState('All PODs');
  const [viewMode, setViewMode] = useState('individual');

  const filtered = useMemo(() =>
    filterPod === 'All PODs'
      ? WORKLOAD_DATA
      : WORKLOAD_DATA.filter(r => r.pod === filterPod),
    [filterPod]);

  const overAllocated = filtered.filter(r => r.pct > 100).length;
  const underUtilized = filtered.filter(r => r.pct < 50).length;
  const avgUtil = Math.round(filtered.reduce((s, r) => s + r.pct, 0) / (filtered.length || 1));

  // Show first-name + last-initial for chart labels (keeps bars readable)
  const chartData = filtered.map(r => {
    const parts = r.name.split(' ');
    const shortName = parts[0] + (parts[1] ? ` ${parts[1][0]}.` : '');
    return { name: shortName, fullName: r.name, pct: r.pct, fill: getUtilColor(r.pct) };
  });

  return (
    <Box className="page-enter" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1} style={{ color: DEEP_BLUE, fontWeight: 800 }}>
            Workload Chart
          </Title>
          <Text c="dimmed" size="sm" mt={2}>
            Visual overview of resource utilization — who is over-allocated, healthy, or available
          </Text>
        </Box>
        <Button leftSection={<IconDownload size={15} />} variant="outline" color="teal" size="sm">
          Export
        </Button>
      </Group>

      {/* KPI row */}
      <SimpleGrid cols={4} spacing="md" mb="lg">
        {[
          { label: 'Avg Utilization',  value: `${avgUtil}%`, color: avgUtil > 95 ? '#ef4444' : avgUtil > 80 ? '#f59e0b' : '#22c55e' },
          { label: 'Over-Allocated',   value: overAllocated,  color: '#ef4444' },
          { label: 'Under-Utilized',   value: underUtilized,  color: '#94a3b8' },
          { label: 'Resources Shown',  value: filtered.length, color: DEEP_BLUE },
        ].map(stat => (
          <Card key={stat.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: '#94a3b8' }}>
              {stat.label}
            </Text>
            <Text fw={800} mt={4} style={{ color: stat.color, fontSize: 28 }}>
              {stat.value}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      {/* Filters + view toggle */}
      <Paper withBorder radius="md" p="md" mb="lg">
        <Group justify="space-between">
          <Group gap="sm">
            <IconFilter size={16} color="#94a3b8" />
            <Select
              data={PODS}
              value={filterPod}
              onChange={v => setFilterPod(v || 'All PODs')}
              size="sm"
              style={{ width: 220 }}
            />
          </Group>
          <SegmentedControl
            size="sm" value={viewMode} onChange={setViewMode}
            data={[
              { label: 'Individual',     value: 'individual' },
              { label: 'By POD',         value: 'pod'        },
              { label: 'Monthly Trend',  value: 'trend'      },
            ]}
            style={{ background: '#f1f5f9' }}
          />
        </Group>
      </Paper>

      {/* ── INDIVIDUAL VIEW ── */}
      {viewMode === 'individual' && (
        <Box>
          {/* Bar chart */}
          <Paper withBorder radius="md" p="lg" mb="lg">
            <Text fw={700} size="sm" mb="md" style={{ color: DEEP_BLUE }}>
              Utilization by Resource (% of capacity)
            </Text>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, bottom: 60, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  domain={[0, 130]}
                  tickFormatter={v => `${v}%`}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4"
                  label={{ value: '100%', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
                <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="4 4"
                  label={{ value: '50%', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }} />
                <Bar dataKey="pct" name="Utilization %" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Custom legend below chart — no overlap */}
            <ChartLegend items={[
              { color: '#22c55e', label: 'Healthy (50–84%)' },
              { color: '#f59e0b', label: 'High (85–99%)' },
              { color: '#ef4444', label: 'Over-allocated (>100%)' },
              { color: '#94a3b8', label: 'Under-utilized (<50%)' },
            ]} />
          </Paper>

          {/* Resource list */}
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            {/* Custom table header */}
            <Box style={{ display: 'flex', background: DEEP_BLUE, padding: '11px 20px' }}>
              <Text size="xs" fw={700} tt="uppercase" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.7px', width: 220, flexShrink: 0 }}>
                Resource
              </Text>
              <Text size="xs" fw={700} tt="uppercase" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.7px', width: 160, flexShrink: 0 }}>
                POD
              </Text>
              <Text size="xs" fw={700} tt="uppercase" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.7px', flex: 1 }}>
                Utilization
              </Text>
              <Text size="xs" fw={700} tt="uppercase" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.7px', width: 70, textAlign: 'right' }}>
                Hrs
              </Text>
            </Box>

            {filtered.map((r, i) => {
              const color = getUtilColor(r.pct);
              return (
                <Box
                  key={r.name}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '12px 20px',
                    borderBottom: i < filtered.length - 1 ? '1px solid #f0f4f8' : 'none',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eafafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <Group gap="sm" style={{ width: 220, flexShrink: 0 }}>
                    <Avatar size={30} radius="xl"
                      style={{ background: AQUA, color: DEEP_BLUE, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {r.avatar}
                    </Avatar>
                    <Box>
                      <Text size="sm" fw={600} style={{ color: DEEP_BLUE }}>{r.name}</Text>
                      <Text size="xs" c="dimmed">{r.role}</Text>
                    </Box>
                  </Group>
                  <Text size="sm" c="dimmed" style={{ width: 160, flexShrink: 0 }}>{r.pod}</Text>
                  <Box style={{ flex: 1 }}>
                    <Group gap="sm" align="center">
                      <Progress
                        value={Math.min(r.pct, 100)}
                        size="sm" radius="xl"
                        style={{ flex: 1 }}
                        color={r.pct > 100 ? 'red' : r.pct >= 85 ? 'yellow' : r.pct < 50 ? 'gray' : 'teal'}
                      />
                      <Badge
                        size="sm"
                        style={{ background: `${color}18`, color, border: `1px solid ${color}44`, fontSize: 11, fontWeight: 700, minWidth: 50, textAlign: 'center' }}
                      >
                        {r.pct}%
                      </Badge>
                    </Group>
                  </Box>
                  <Text size="sm" fw={600} style={{ width: 70, textAlign: 'right', color: DEEP_BLUE }}>
                    {r.allocated}h
                  </Text>
                </Box>
              );
            })}
          </Paper>
        </Box>
      )}

      {/* ── BY POD VIEW ── */}
      {viewMode === 'pod' && (
        <Paper withBorder radius="md" p="lg">
          <Text fw={700} size="sm" mb="lg" style={{ color: DEEP_BLUE }}>
            Utilization by POD — Capacity vs Allocated Hours
          </Text>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={POD_SUMMARY_DATA} margin={{ top: 8, right: 16, bottom: 50, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="pod"
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}h`} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="capacity" name="Capacity (hrs)" fill={DEEP_BLUE_TINTS[30]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="allocated" name="Allocated (hrs)" radius={[4, 4, 0, 0]}>
                {POD_SUMMARY_DATA.map((entry, i) => (
                  <Cell key={i} fill={getUtilColor(entry.pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Custom legend */}
          <ChartLegend items={[
            { color: DEEP_BLUE_TINTS[30], label: 'Capacity (hrs)' },
            { color: '#22c55e',            label: 'Allocated — healthy' },
            { color: '#f59e0b',            label: 'Allocated — high' },
            { color: '#ef4444',            label: 'Allocated — over 100%' },
          ]} />

          <SimpleGrid cols={3} spacing="md" mt="xl">
            {POD_SUMMARY_DATA.map(pod => {
              const color = getUtilColor(pod.pct);
              return (
                <Card key={pod.pod} withBorder radius="md" p="md" style={{ borderLeft: `3px solid ${color}` }}>
                  <Text size="sm" fw={700} style={{ color: DEEP_BLUE }}>{pod.pod}</Text>
                  <Progress value={Math.min(pod.pct, 100)} size="sm" mt="xs" mb="xs"
                    color={pod.pct > 100 ? 'red' : pod.pct >= 85 ? 'yellow' : 'teal'} />
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">{pod.allocated}h / {pod.capacity}h</Text>
                    <Badge size="xs" style={{ background: `${color}18`, color, border: `1px solid ${color}44` }}>
                      {pod.pct}%
                    </Badge>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </Paper>
      )}

      {/* ── MONTHLY TREND VIEW ── */}
      {viewMode === 'trend' && (
        <Paper withBorder radius="md" p="lg">
          <Text fw={700} size="sm" mb="lg" style={{ color: DEEP_BLUE }}>
            Monthly Utilization Trend — % of total capacity used
          </Text>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={MONTHLY_TREND} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}%`} domain={[0, 130]} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: '100%', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              <Bar dataKey="utilization"  name="Avg Utilization %"          fill={AQUA}       radius={[4, 4, 0, 0]} />
              <Bar dataKey="overAllocated" name="Over-allocated resources"  fill="#ef4444"    radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend items={[
            { color: AQUA,      label: 'Avg Utilization %' },
            { color: '#ef4444', label: 'Over-allocated resources' },
          ]} />
        </Paper>
      )}
    </Box>
  );
}
