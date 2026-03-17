import { useState, useMemo } from 'react';
import { Title, Stack, Text, Group, MultiSelect, SegmentedControl } from '@mantine/core';
import { useUtilizationHeatmap } from '../../api/reports';
import { useMonthLabels } from '../../hooks/useMonthLabels';
import { getUtilizationBgColor } from '../../utils/colors';
import { formatPercent } from '../../utils/formatting';
import HeatmapChart from '../../components/charts/HeatmapChart';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ExportableChart from '../../components/common/ExportableChart';

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

    // Sort rows
    return rows.sort((a, b) => {
      if (sortBy === 'name') return a.label.localeCompare(b.label);
      const avgA = a.values.reduce((s, v) => s + v.value, 0) / (a.values.length || 1);
      const avgB = b.values.reduce((s, v) => s + v.value, 0) / (b.values.length || 1);
      const peakA = Math.max(...a.values.map(v => v.value));
      const peakB = Math.max(...b.values.map(v => v.value));
      return sortBy === 'peak' ? peakB - peakA : avgB - avgA;
    });
  }, [data, selectedPods, sortBy]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading utilization data</Text>;

  return (
    <Stack>
      <Title order={2}>Utilization Heatmap</Title>
      <Text size="sm" c="dimmed">
        Green (&lt;80%) | Yellow (80–100%) | Orange (100–120%) | Red (&gt;120%)
      </Text>

      <Group gap="md" align="flex-end" wrap="wrap">
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
        <Text size="sm" c="dimmed" mt="lg">
          Showing {heatmapRows.length} of {allPods.length} PODs
        </Text>
      </Group>

      <ExportableChart title="Utilization Heatmap">
        <HeatmapChart
          rows={heatmapRows}
          monthLabels={monthLabels}
          colorFn={getUtilizationBgColor}
          currentMonthIndex={currentMonthIndex}
        />
      </ExportableChart>
    </Stack>
  );
}
