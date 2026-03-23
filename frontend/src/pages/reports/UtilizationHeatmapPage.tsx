import { useState, useMemo } from 'react';
import { Text, MultiSelect, SegmentedControl, Badge, Group } from '@mantine/core';
import { IconFlame, IconUsers, IconChartBar, IconAlertTriangle } from '@tabler/icons-react';
import { useUtilizationHeatmap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../../utils/colors';
import { formatPercent } from '../../utils/formatting';
import HeatmapChart from '../../components/charts/HeatmapChart';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PageError from '../../components/common/PageError';
import ExportableChart from '../../components/common/ExportableChart';
import ReportPageShell, { SummaryCardItem } from '../../components/common/ReportPageShell';

export default function UtilizationHeatmapPage() {
  const { data, isLoading, error } = useUtilizationHeatmap();
  const { monthLabels, currentMonthIndex } = useMonthLabels();
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'peak' | 'avg'>('name');

  const allPods = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map(u => u.podName))].sort();
  }, [data]);

  const heatmapRows = useMemo(() => {
    if (!data) return [];
    const podMap = new Map<string, { month: number; value: number; display: string }[]>();
    data.forEach(u => {
      if (selectedPods.length > 0 && !selectedPods.includes(u.podName)) return;
      const arr = podMap.get(u.podName) ?? [];
      arr.push({
        month: u.monthIndex,
        value: u.utilizationPct,
        display: formatPercent(u.utilizationPct),
      });
      podMap.set(u.podName, arr);
    });
    const rows = Array.from(podMap.entries()).map(([label, values]) => ({ label, values }));

    return rows.sort((a, b) => {
      if (sortBy === 'name') return a.label.localeCompare(b.label);
      const avgA = a.values.reduce((s, v) => s + v.value, 0) / (a.values.length || 1);
      const avgB = b.values.reduce((s, v) => s + v.value, 0) / (b.values.length || 1);
      const peakA = Math.max(...a.values.map(v => v.value));
      const peakB = Math.max(...b.values.map(v => v.value));
      return sortBy === 'peak' ? peakB - peakA : avgB - avgA;
    });
  }, [data, selectedPods, sortBy]);

  // Summary stats
  const summaryCards = useMemo<SummaryCardItem[]>(() => {
    if (!data) return [];
    const allVals = data.map(u => u.utilizationPct);
    const avg = allVals.reduce((s, v) => s + v, 0) / (allVals.length || 1);
    const peak = Math.max(...allVals);
    const overloaded = new Set(data.filter(u => u.utilizationPct > 100).map(u => u.podName)).size;
    return [
      { label: 'PODs', value: allPods.length, icon: <IconUsers size={18} />, color: 'blue' },
      { label: 'Avg Utilization', value: formatPercent(avg), icon: <IconChartBar size={18} />, color: avg > 100 ? 'orange' : 'teal' },
      { label: 'Peak', value: formatPercent(peak), icon: <IconFlame size={18} />, color: peak > 120 ? 'red' : 'orange' },
      { label: 'Overloaded PODs', value: overloaded, icon: <IconAlertTriangle size={18} />, color: overloaded > 0 ? 'red' : 'teal' },
    ];
  }, [data, allPods]);

  if (isLoading) return <LoadingSpinner variant="chart" message="Loading utilization data..." />;
  if (error) return <PageError context="loading utilization data" error={error} />;

  return (
    <ReportPageShell
      title="Utilization"
      subtitle="Green (<80%) · Yellow (80–100%) · Orange (100–120%) · Red (>120%)"
      summaryCards={summaryCards}
      filters={
        <>
          <MultiSelect
            label="Filter PODs"
            placeholder={selectedPods.length === 0 ? 'All PODs' : undefined}
            data={allPods}
            value={selectedPods}
            onChange={setSelectedPods}
            clearable
            searchable
            style={{ minWidth: 260, maxWidth: 480 }}
            size="sm"
          />
          <div>
            <Text size="xs" c="dimmed" mb={4}>Sort rows by</Text>
            <SegmentedControl
              value={sortBy}
              onChange={v => setSortBy(v as 'name' | 'peak' | 'avg')}
              data={[
                { value: 'name', label: 'Name' },
                { value: 'peak', label: 'Peak %' },
                { value: 'avg', label: 'Avg %' },
              ]}
              size="sm"
            />
          </div>
          <Text size="sm" c="dimmed">
            Showing {heatmapRows.length} of {allPods.length} PODs
          </Text>
        </>
      }
    >
      <ExportableChart title="Utilization">
        <HeatmapChart
          rows={heatmapRows}
          monthLabels={monthLabels}
          colorFn={getUtilizationBgColor}
          currentMonthIndex={currentMonthIndex}
        />
      </ExportableChart>
    </ReportPageShell>
  );
}
