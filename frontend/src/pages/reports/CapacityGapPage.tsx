import { useState, useMemo } from 'react';
import { SegmentedControl, Group, Badge } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown, IconUsers, IconChartBar } from '@tabler/icons-react';
import { useCapacityGap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getGapCellColor } from '../../utils/colors';
import { formatGapHours, formatGapFte } from '../../utils/formatting';
import HeatmapChart from '../../components/charts/HeatmapChart';
import CapacityBarChart from '../../components/charts/CapacityBarChart';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ChartCard from '../../components/common/ChartCard';
import ReportPageShell, { SummaryCardItem } from '../../components/common/ReportPageShell';

export default function CapacityGapPage() {
  const [unit, setUnit] = useState<'hours' | 'fte'>('hours');
  const { data, isLoading, error } = useCapacityGap(unit);
  const { monthLabels, currentMonthIndex } = useMonthLabels();

  const heatmapRows = useMemo(() => {
    if (!data) return [];
    const podMap = new Map<string, { month: number; value: number; display: string }[]>();
    data.gaps.forEach(g => {
      const arr = podMap.get(g.podName) ?? [];
      const gap = unit === 'hours' ? g.gapHours : g.gapFte;
      arr.push({
        month: g.monthIndex,
        value: gap,
        display: unit === 'hours' ? formatGapHours(gap) : formatGapFte(gap),
      });
      podMap.set(g.podName, arr);
    });
    return Array.from(podMap.entries()).map(([label, values]) => ({ label, values }));
  }, [data, unit]);

  // Derive working hours per month from gapHours / gapFte ratio
  const workingHoursMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (!data) return map;
    data.gaps.forEach(g => {
      if (g.gapFte !== 0 && g.gapHours !== 0 && !map[g.monthIndex]) {
        map[g.monthIndex] = Math.abs(g.gapHours / g.gapFte);
      }
    });
    return map;
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const monthMap = new Map<number, { demand: number; capacity: number }>();
    data.gaps.forEach(g => {
      const existing = monthMap.get(g.monthIndex) ?? { demand: 0, capacity: 0 };
      existing.demand += g.demandHours;
      existing.capacity += g.capacityHours;
      monthMap.set(g.monthIndex, existing);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([m, v]) => {
        const wh = workingHoursMap[m] ?? 160;
        if (unit === 'fte') {
          return {
            month: monthLabels[m] ?? `M${m}`,
            demand: Math.round((v.demand / wh) * 10) / 10,
            capacity: Math.round((v.capacity / wh) * 10) / 10,
          };
        }
        return {
          month: monthLabels[m] ?? `M${m}`,
          demand: Math.round(v.demand),
          capacity: Math.round(v.capacity),
        };
      });
  }, [data, unit, monthLabels, workingHoursMap]);

  // Summary stats
  const summaryCards = useMemo<SummaryCardItem[]>(() => {
    if (!data) return [];
    const pods = new Set(data.gaps.map(g => g.podName));
    const totalGap = data.gaps.reduce((s, g) => s + (unit === 'hours' ? g.gapHours : g.gapFte), 0);
    const surplusPods = new Set<string>();
    const deficitPods = new Set<string>();
    data.gaps.forEach(g => {
      const gap = unit === 'hours' ? g.gapHours : g.gapFte;
      if (gap > 0) surplusPods.add(g.podName);
      if (gap < 0) deficitPods.add(g.podName);
    });
    return [
      { label: 'PODs', value: pods.size, icon: <IconUsers size={18} />, color: 'blue' },
      { label: 'Net Gap', value: unit === 'hours' ? formatGapHours(totalGap) : formatGapFte(totalGap), icon: <IconChartBar size={18} />, color: totalGap >= 0 ? 'teal' : 'red' },
      { label: 'Surplus PODs', value: surplusPods.size, icon: <IconTrendingUp size={18} />, color: 'teal' },
      { label: 'Deficit PODs', value: deficitPods.size, icon: <IconTrendingDown size={18} />, color: 'red' },
    ];
  }, [data, unit]);

  if (isLoading) return <LoadingSpinner variant="chart" message="Loading capacity gap..." />;
  if (error) return <PageError context="loading capacity gap data" error={error} />;

  return (
    <ReportPageShell
      title="Capacity Gap Analysis"
      subtitle="Compare demand vs capacity across PODs and months"
      summaryCards={summaryCards}
      filters={
        <>
          <SegmentedControl
            value={unit}
            onChange={v => setUnit(v as 'hours' | 'fte')}
            data={[
              { value: 'hours', label: 'Hours' },
              { value: 'fte', label: 'FTE' },
            ]}
            style={{ maxWidth: 200 }}
          />
          <Group gap="md">
            <Badge color="green" variant="light" size="sm">+ Surplus (capacity &gt; demand)</Badge>
            <Badge color="red" variant="light" size="sm">− Deficit (hiring needed)</Badge>
          </Group>
        </>
      }
    >
      <ChartCard title="Capacity Gap Heatmap" minHeight={0}>
        <HeatmapChart
          rows={heatmapRows}
          monthLabels={monthLabels}
          colorFn={getGapCellColor}
          currentMonthIndex={currentMonthIndex}
        />
      </ChartCard>

      <ChartCard title="Demand vs Capacity" minHeight={350}>
        <CapacityBarChart data={chartData} unit={unit} />
      </ChartCard>
    </ReportPageShell>
  );
}
