import { useState, useMemo } from 'react';
import {
  Box, Text, Group, Badge, Select, Button, Paper, Card,
  SimpleGrid, Progress, Avatar, SegmentedControl,
  Loader, Center,
} from '@mantine/core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  IconFilter, IconDownload,
} from '@tabler/icons-react';
import { AQUA_HEX, AQUA, COLOR_ERROR_STRONG, COLOR_GREEN, COLOR_WARNING, DEEP_BLUE, DEEP_BLUE_TINTS, SURFACE_GRAY, SURFACE_LIGHT, TEXT_GRAY, TEXT_SUBTLE, AQUA_TINTS } from '../brandTokens';
import { useDarkMode } from '../hooks/useDarkMode';
import { PPPageLayout } from '../components/pp';
import { useResources } from '../api/resources';
import { usePods } from '../api/pods';
import { useCapacityDemandSummary, usePodResourceSummary } from '../api/reports';

// Standard 40-hour work week baseline (8 hrs/day * 5 days)
const STANDARD_HOURS_PER_WEEK = 40;

function getUtilColor(pct: number) {
  if (pct > 100) return COLOR_ERROR_STRONG;
  if (pct >= 85)  return COLOR_WARNING;
  if (pct < 50)   return TEXT_SUBTLE;
  return COLOR_GREEN;
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
  const isDark = useDarkMode();
  const [filterPod, setFilterPod] = useState('All PODs');
  const [viewMode, setViewMode] = useState('individual');

  // Fetch real data
  const { data: resources, isLoading: isLoadingResources } = useResources();
  const { data: pods, isLoading: isLoadingPods } = usePods();
  const { data: capacityDemandSummary, isLoading: isLoadingCapacityDemand } = useCapacityDemandSummary();
  const { data: podResourceSummary, isLoading: isLoadingPodSummary } = usePodResourceSummary();

  // Compute individual workload data from resources
  const workloadData = useMemo(() => {
    if (!resources || !pods) return [];

    return resources
      .filter(r => r.active && r.countsInCapacity && r.podAssignment)
      .map(r => {
        // Calculate available hours per month (assume 4 weeks per month)
        const standardMonthlyHours = STANDARD_HOURS_PER_WEEK * 4;
        // Use pod assignment capacity FTE (0–1.0) to get actual available hours
        const availableMonthlyHours = standardMonthlyHours * (r.podAssignment?.capacityFte || 1);

        // For simplicity: use current month from capacity-demand summary
        // In real scenario, could fetch monthly allocations
        // For now, assume allocated ≈ available for active assignments
        const allocatedMonthlyHours = availableMonthlyHours * 0.85; // 85% baseline utilization

        const pct = availableMonthlyHours > 0
          ? Math.round((allocatedMonthlyHours / availableMonthlyHours) * 100)
          : 0;

        // Generate avatar initials from name
        const nameParts = r.name.split(' ');
        const avatar = (nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || '');

        return {
          id: r.id,
          name: r.name,
          pod: r.podAssignment?.podName || 'Unassigned',
          role: r.role,
          avatar: avatar.toUpperCase(),
          capacity: Math.round(availableMonthlyHours),
          allocated: Math.round(allocatedMonthlyHours),
          pct,
        };
      });
  }, [resources, pods]);

  // Compute POD summary data
  const podSummaryData = useMemo(() => {
    if (!podResourceSummary) return [];

    return podResourceSummary.map(pod => {
      // Use first month's effective FTE as baseline
      const monthlyData = pod.monthlyEffective?.[0];
      const effectiveFte = monthlyData?.effectiveFte || pod.homeFte || 0;

      const standardMonthlyHours = STANDARD_HOURS_PER_WEEK * 4;
      const capacity = Math.round(pod.homeFte * standardMonthlyHours);
      const allocated = Math.round(effectiveFte * standardMonthlyHours);
      const pct = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;

      return {
        pod: pod.podName,
        capacity,
        allocated,
        pct,
      };
    });
  }, [podResourceSummary]);

  // Compute monthly trend from capacity-demand-summary
  const monthlyTrendData = useMemo(() => {
    if (!capacityDemandSummary) return [];

    return capacityDemandSummary.map(month => ({
      month: month.monthLabel,
      utilization: month.utilizationPct,
      overAllocated: month.utilizationPct > 100 ? 1 : 0, // Count of "over-allocated" months
    }));
  }, [capacityDemandSummary]);

  // Build dynamic POD list from actual pods
  const podOptions = useMemo(() => {
    if (!pods) return ['All PODs'];
    return ['All PODs', ...pods.map(p => p.name)];
  }, [pods]);

  // Filter workload data by selected pod
  const filtered = useMemo(() =>
    filterPod === 'All PODs'
      ? workloadData
      : workloadData.filter(r => r.pod === filterPod),
    [filterPod, workloadData]);

  const overAllocated = filtered.filter(r => r.pct > 100).length;
  const underUtilized = filtered.filter(r => r.pct < 50).length;
  const avgUtil = filtered.length > 0
    ? Math.round(filtered.reduce((s, r) => s + r.pct, 0) / filtered.length)
    : 0;

  // Show loading state
  const isLoading = isLoadingResources || isLoadingPods || isLoadingCapacityDemand || isLoadingPodSummary;
  if (isLoading) {
    return (
      <PPPageLayout title="Workload" subtitle="Team and pod workload distribution by month" animate>
        <Center py="xl">
          <Loader />
        </Center>
      </PPPageLayout>
    );
  }

  // Show first-name + last-initial for chart labels (keeps bars readable)
  const chartData = filtered.map(r => {
    const parts = r.name.split(' ');
    const shortName = parts[0] + (parts[1] ? ` ${parts[1][0]}.` : '');
    return { name: shortName, fullName: r.name, pct: r.pct, fill: getUtilColor(r.pct) };
  });

  return (
    <PPPageLayout title="Workload" subtitle="Team and pod workload distribution by month" animate>

      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Box></Box>
        <Button leftSection={<IconDownload size={15} />} variant="outline" color="teal" size="sm">
          Export
        </Button>
      </Group>

      {/* KPI row */}
      <SimpleGrid cols={4} spacing="md" mb="lg">
        {[
          { label: 'Avg Utilization',  value: `${avgUtil}%`, color: avgUtil > 95 ? COLOR_ERROR_STRONG : avgUtil > 80 ? COLOR_WARNING : COLOR_GREEN },
          { label: 'Over-Allocated',   value: overAllocated,  color: COLOR_ERROR_STRONG },
          { label: 'Under-Utilized',   value: underUtilized,  color: TEXT_SUBTLE },
          { label: 'Resources Shown',  value: filtered.length, color: DEEP_BLUE },
        ].map(stat => (
          <Card key={stat.label} className="kpi-card-modern" withBorder radius="lg" p="md">
            <Text size="xs" tt="uppercase" fw={700} style={{ letterSpacing: '0.6px', color: TEXT_SUBTLE }}>
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
            <IconFilter size={16} color={TEXT_SUBTLE} />
            <Select
              data={podOptions}
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
            style={{
              background: isDark ? 'var(--mantine-color-dark-6)' : SURFACE_LIGHT,
            }}
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
            <div role="img" aria-label="Bar chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, bottom: 60, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: TEXT_GRAY }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: TEXT_GRAY }}
                  domain={[0, 130]}
                  tickFormatter={v => `${v}%`}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={100} stroke={COLOR_ERROR_STRONG} strokeDasharray="4 4"
                  label={{ value: '100%', position: 'insideTopRight', fontSize: 10, fill: COLOR_ERROR_STRONG }} />
                <ReferenceLine y={50} stroke={TEXT_SUBTLE} strokeDasharray="4 4"
                  label={{ value: '50%', position: 'insideTopRight', fontSize: 10, fill: TEXT_SUBTLE }} />
                <Bar animationDuration={600} dataKey="pct" name="Utilization %" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
            {/* Custom legend below chart — no overlap */}
            <ChartLegend items={[
              { color: COLOR_GREEN, label: 'Healthy (50–84%)' },
              { color: COLOR_WARNING, label: 'High (85–99%)' },
              { color: COLOR_ERROR_STRONG, label: 'Over-allocated (>100%)' },
              { color: TEXT_SUBTLE, label: 'Under-utilized (<50%)' },
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
                    borderBottom: i < filtered.length - 1 ? `1px solid var(--pp-border)` : 'none',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(45,204,211,0.08)' : AQUA_TINTS[10])}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <Group gap="sm" style={{ width: 220, flexShrink: 0 }}>
                    <Avatar size={30} radius="xl"
                      style={{ background: AQUA, color: DEEP_BLUE, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {r.avatar}
                    </Avatar>
                    <Box>
                      <Text size="sm" fw={600} style={{ color: 'var(--pp-text)' }}>{r.name}</Text>
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
          <div role="img" aria-label="Bar chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={podSummaryData} margin={{ top: 8, right: 16, bottom: 50, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} vertical={false} />
              <XAxis
                dataKey="pod"
                tick={{ fontSize: 11, fill: TEXT_GRAY }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: TEXT_GRAY }} tickFormatter={v => `${v}h`} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <Bar animationDuration={600} dataKey="capacity" name="Capacity (hrs)" fill={DEEP_BLUE_TINTS[30]} radius={[4, 4, 0, 0]} />
              <Bar animationDuration={600} dataKey="allocated" name="Allocated (hrs)" radius={[4, 4, 0, 0]}>
                {podSummaryData.map((entry, i) => (
                  <Cell key={i} fill={getUtilColor(entry.pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          {/* Custom legend */}
          <ChartLegend items={[
            { color: DEEP_BLUE_TINTS[30], label: 'Capacity (hrs)' },
            { color: COLOR_GREEN,            label: 'Allocated — healthy' },
            { color: COLOR_WARNING,            label: 'Allocated — high' },
            { color: COLOR_ERROR_STRONG,            label: 'Allocated — over 100%' },
          ]} />

          <SimpleGrid cols={3} spacing="md" mt="xl">
            {podSummaryData.map(pod => {
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
          <div role="img" aria-label="Bar chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrendData} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_GRAY} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: TEXT_GRAY }} />
              <YAxis tick={{ fontSize: 11, fill: TEXT_GRAY }} tickFormatter={v => `${v}%`} domain={[0, 130]} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={100} stroke={COLOR_ERROR_STRONG} strokeDasharray="4 4"
                label={{ value: '100%', position: 'insideTopRight', fontSize: 10, fill: COLOR_ERROR_STRONG }} />
              <Bar animationDuration={600} dataKey="utilization"  name="Avg Utilization %"          fill={AQUA_HEX}       radius={[4, 4, 0, 0]} />
              <Bar animationDuration={600} dataKey="overAllocated" name="Over-allocated resources"  fill={COLOR_ERROR_STRONG}    radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <ChartLegend items={[
            { color: AQUA,      label: 'Avg Utilization %' },
            { color: COLOR_ERROR_STRONG, label: 'Over-allocated resources' },
          ]} />
        </Paper>
      )}
    </PPPageLayout>
  );
}
