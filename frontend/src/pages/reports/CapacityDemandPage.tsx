import { useState, useMemo } from 'react';
import {
  Title, Stack, Table, Text, Card, SimpleGrid, Group, Badge,
  MultiSelect, SegmentedControl, Tabs,
} from '@mantine/core';
import {
  Line, LineChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { formatHours, formatPercent, formatGapHours, formatFte, formatGapFte } from '../../utils/formatting';
import { getUtilizationBgColor, getGapCellColor } from '../../utils/colors';
import { useDarkMode } from '../../hooks/useDarkMode';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ExportableChart from '../../components/common/ExportableChart';

const POD_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

export default function CapacityDemandPage() {
  const [unit, setUnit] = useState<'hours' | 'fte'>('hours');
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const { data: gapData, isLoading, error } = useCapacityGap('hours');
  const { monthLabels } = useMonthLabels();
  const dark = useDarkMode();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const allPods = useMemo(() => {
    if (!gapData?.gaps) return [];
    return Array.from(new Set(gapData.gaps.map(g => g.podName))).sort();
  }, [gapData]);

  const pods = useMemo(() => {
    if (selectedPods.length === 0) return allPods;
    return allPods.filter(p => selectedPods.includes(p));
  }, [allPods, selectedPods]);

  const podColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    allPods.forEach((pod, i) => { map[pod] = POD_COLORS[i % POD_COLORS.length]; });
    return map;
  }, [allPods]);

  // Org-level totals derived from gap data so they respect POD filter
  // Derive working hours per month from gapData (gapHours / gapFte)
  const workingHoursPerMonth = useMemo(() => {
    const map: Record<number, number> = {};
    if (!gapData?.gaps) return map;
    for (const g of gapData.gaps) {
      if (map[g.monthIndex]) continue;
      if (g.gapFte !== 0 && g.gapHours !== 0) {
        map[g.monthIndex] = Math.abs(g.gapHours / g.gapFte);
      }
    }
    for (let m = 1; m <= 12; m++) {
      if (!map[m]) map[m] = 160;
    }
    return map;
  }, [gapData]);

  const filteredSummary = useMemo(() => {
    if (!gapData?.gaps) return [];
    const filtered = gapData.gaps.filter(g => pods.includes(g.podName));
    return months.map(m => {
      const monthGaps = filtered.filter(g => g.monthIndex === m);
      const totalCap = monthGaps.reduce((s, g) => s + g.capacityHours, 0);
      const totalDem = monthGaps.reduce((s, g) => s + g.demandHours, 0);
      const gap = totalCap - totalDem;
      const wh = workingHoursPerMonth[m] ?? 160;
      const util = totalCap > 0 ? (totalDem / totalCap) * 100 : 0;
      return {
        monthIndex: m,
        monthLabel: monthLabels[m] ?? `M${m}`,
        totalCapacityHours: totalCap,
        totalDemandHours: totalDem,
        netGapHours: gap,
        netGapFte: wh > 0 ? gap / wh : 0,
        capacityFte: wh > 0 ? totalCap / wh : 0,
        demandFte: wh > 0 ? totalDem / wh : 0,
        utilizationPct: util,
        workingHours: wh,
      };
    });
  }, [gapData, pods, months, monthLabels, workingHoursPerMonth]);

  const orgChartData = useMemo(() => {
    return filteredSummary.map(d => ({
      month: d.monthLabel,
      demand: Math.round(d.totalDemandHours),
      capacity: Math.round(d.totalCapacityHours),
    }));
  }, [filteredSummary]);

  const podCapChartData = useMemo(() => {
    if (!gapData?.gaps) return [];
    return months.map(m => {
      const row: Record<string, number | string> = { month: monthLabels[m] ?? `M${m}` };
      pods.forEach(pod => {
        const g = gapData.gaps.find(g => g.podName === pod && g.monthIndex === m);
        row[pod] = Math.round(g?.capacityHours ?? 0);
      });
      return row;
    });
  }, [gapData, pods, monthLabels, months]);

  const podDemChartData = useMemo(() => {
    if (!gapData?.gaps) return [];
    return months.map(m => {
      const row: Record<string, number | string> = { month: monthLabels[m] ?? `M${m}` };
      pods.forEach(pod => {
        const g = gapData.gaps.find(g => g.podName === pod && g.monthIndex === m);
        row[pod] = Math.round(g?.demandHours ?? 0);
      });
      return row;
    });
  }, [gapData, pods, monthLabels, months]);

  // Per-POD individual capacity vs demand data
  const podDetailData = useMemo(() => {
    if (!gapData?.gaps) return [];
    return pods.map(pod => {
      const podGaps = gapData.gaps.filter(g => g.podName === pod);
      const chartData = months.map(m => {
        const g = podGaps.find(g => g.monthIndex === m);
        const wh = workingHoursPerMonth[m] ?? 160;
        return {
          month: monthLabels[m] ?? `M${m}`,
          capacity: Math.round(g?.capacityHours ?? 0),
          demand: Math.round(g?.demandHours ?? 0),
          gap: (g?.gapHours ?? 0),
          gapFte: (g?.gapFte ?? 0),
          workingHours: wh,
        };
      });
      const totalCap = chartData.reduce((s, d) => s + d.capacity, 0);
      const totalDem = chartData.reduce((s, d) => s + d.demand, 0);
      const totalGapFte = chartData.reduce((s, d) => s + d.gapFte, 0);
      const avgUtil = totalCap > 0 ? (totalDem / totalCap) * 100 : 0;
      // Avg working hours for annual FTE conversion
      const avgWh = chartData.reduce((s, d) => s + d.workingHours, 0) / 12;
      return { pod, chartData, totalCap, totalDem, totalGapFte, avgUtil, avgWh };
    });
  }, [gapData, pods, monthLabels, months]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading capacity demand data</Text>;

  const fmtValWithWh = (v: number, wh: number) => unit === 'hours' ? formatHours(v) : formatFte(wh > 0 ? v / wh : 0);
  const fmtGapWithWh = (v: number, wh: number) => unit === 'hours' ? formatGapHours(v) : formatGapFte(wh > 0 ? v / wh : 0);

  return (
    <Stack>
      <Title order={2}>Capacity vs Demand</Title>
      <Text size="sm" c="dimmed">Full-year capacity and demand analysis — total org + POD-level breakdown</Text>

      <Group gap="md" align="flex-end">
        <SegmentedControl
          value={unit}
          onChange={v => setUnit(v as 'hours' | 'fte')}
          data={[
            { value: 'hours', label: 'Hours' },
            { value: 'fte', label: 'FTE' },
          ]}
          style={{ maxWidth: 200 }}
        />
        <MultiSelect
          label="Filter PODs"
          placeholder={selectedPods.length === 0 ? 'All PODs' : undefined}
          data={allPods}
          value={selectedPods}
          onChange={setSelectedPods}
          clearable
          searchable
          style={{ minWidth: 280, maxWidth: 500 }}
          size="sm"
        />
      </Group>

      <Card withBorder padding="md">
        <ExportableChart title="Total Org - Capacity vs Demand">
          <Title order={4} mb={4}>Total Org — Capacity vs Demand</Title>
          <Text size="xs" c="dimmed" mb="sm">{selectedPods.length === 0 ? 'All PODs combined' : `${pods.length} POD${pods.length > 1 ? 's' : ''} selected`} — hours per month</Text>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={orgChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(value: number) => formatHours(value)} />
              <Legend />
              <Line type="monotone" dataKey="capacity" stroke="#1e40af" strokeWidth={2.5} dot={{ r: 3.5 }} name="Capacity" />
              <Line type="monotone" dataKey="demand" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3.5 }} name="Demand" />
            </LineChart>
          </ResponsiveContainer>
        </ExportableChart>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="md">
          <ExportableChart title="Capacity by POD">
            <Title order={4} mb={4}>Capacity by POD</Title>
            <Text size="xs" c="dimmed" mb="sm">Stacked by POD — project-available hours</Text>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={podCapChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={9} />
                <YAxis fontSize={9} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(value: number) => formatHours(value as number)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {pods.map(pod => (
                  <Bar key={pod} dataKey={pod} stackId="s" fill={podColorMap[pod] + 'cc'} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ExportableChart>
        </Card>

        <Card withBorder padding="md">
          <ExportableChart title="Demand by POD">
            <Title order={4} mb={4}>Demand by POD</Title>
            <Text size="xs" c="dimmed" mb="sm">Stacked by POD — project demand hours</Text>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={podDemChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={9} />
                <YAxis fontSize={9} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(value: number) => formatHours(value as number)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {pods.map(pod => (
                  <Bar key={pod} dataKey={pod} stackId="s" fill={podColorMap[pod] + 'cc'} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ExportableChart>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Title order={4} mb={4}>Monthly Summary Table</Title>
        <Text size="xs" c="dimmed" mb="sm">Capacity — demand — gap — utilization per month</Text>
        <Group gap="md" mb="xs">
          <Badge color="green" variant="light" size="sm">+ Surplus</Badge>
          <Badge color="red" variant="light" size="sm">− Deficit</Badge>
        </Group>
        <Table.ScrollContainer minWidth={800}>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Capacity</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Demand</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Gap</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Utilization</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredSummary.map(d => (
                <Table.Tr key={d.monthIndex}>
                  <Table.Td fw={500}>{d.monthLabel}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{fmtValWithWh(d.totalCapacityHours, d.workingHours)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{fmtValWithWh(d.totalDemandHours, d.workingHours)}</Table.Td>
                  <Table.Td style={{
                    textAlign: 'right',
                    backgroundColor: getGapCellColor(d.netGapHours, dark),
                    fontWeight: 600,
                  }}>
                    {unit === 'hours' ? formatGapHours(d.netGapHours) : formatGapFte(d.netGapFte)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', backgroundColor: getUtilizationBgColor(d.utilizationPct, dark) }}>
                    {formatPercent(d.utilizationPct)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {/* Per-POD Detail Section */}
      <Title order={3} mt="md">POD-Level Detail</Title>
      <Text size="sm" c="dimmed">Individual capacity vs demand for each POD</Text>

      <Tabs defaultValue={pods[0] ?? ''} variant="outline">
        <Tabs.List style={{ flexWrap: 'wrap' }}>
          {pods.map(pod => (
            <Tabs.Tab key={pod} value={pod}>
              {pod}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {podDetailData.map(({ pod, chartData, totalCap, totalDem, totalGapFte, avgUtil, avgWh }) => (
          <Tabs.Panel key={pod} value={pod} pt="md">
            <Stack>
              <Group gap="lg">
                <Badge size="lg" variant="light" color="blue">
                  Total Capacity: {fmtValWithWh(totalCap, avgWh)}
                </Badge>
                <Badge size="lg" variant="light" color="violet">
                  Total Demand: {fmtValWithWh(totalDem, avgWh)}
                </Badge>
                <Badge size="lg" variant="light" color={totalCap >= totalDem ? 'green' : 'red'}>
                  Net Gap: {unit === 'hours' ? formatGapHours(totalCap - totalDem) : formatGapFte(totalGapFte)}
                </Badge>
                <Badge size="lg" variant="light" color={avgUtil <= 100 ? 'teal' : 'red'}>
                  Avg Utilization: {formatPercent(avgUtil)}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Card withBorder padding="md">
                  <ExportableChart title={`${pod} — Capacity vs Demand`}>
                    <Title order={5} mb="xs">{pod} — Capacity vs Demand</Title>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={10} />
                        <YAxis fontSize={10} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <Tooltip formatter={(value: number) => formatHours(value)} />
                        <Legend />
                        <Bar dataKey="capacity" fill="#1e40af" name="Capacity" />
                        <Bar dataKey="demand" fill="#7c3aed" name="Demand" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ExportableChart>
                </Card>

                <Card withBorder padding="md">
                  <Title order={5} mb="xs">{pod} — Monthly Breakdown</Title>
                  <Table.ScrollContainer minWidth={400}>
                    <Table withTableBorder withColumnBorders fz="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Month</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Capacity</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Demand</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Gap</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {chartData.map(d => (
                          <Table.Tr key={d.month}>
                            <Table.Td fw={500}>{d.month}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{fmtValWithWh(d.capacity, d.workingHours)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{fmtValWithWh(d.demand, d.workingHours)}</Table.Td>
                            <Table.Td style={{
                              textAlign: 'right',
                              backgroundColor: getGapCellColor(d.gap, dark),
                              fontWeight: 600,
                            }}>
                              {unit === 'hours' ? formatGapHours(d.gap) : formatGapFte(d.gapFte)}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Card>
              </SimpleGrid>
            </Stack>
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}
