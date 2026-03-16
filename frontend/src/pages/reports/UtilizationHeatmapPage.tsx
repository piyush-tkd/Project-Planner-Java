import { useMemo } from 'react';
import { Title, Stack, Text } from '@mantine/core';
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

  const heatmapRows = useMemo(() => {
    if (!data) return [];
    const podMap = new Map<string, { month: number; value: number; display: string }[]>();
    data.forEach(u => {
      const arr = podMap.get(u.podName) ?? [];
      arr.push({
        month: u.monthIndex,
        value: u.utilizationPct,
        display: formatPercent(u.utilizationPct),
      });
      podMap.set(u.podName, arr);
    });
    return Array.from(podMap.entries()).map(([label, values]) => ({ label, values }));
  }, [data]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Text c="red">Error loading utilization data</Text>;

  return (
    <Stack>
      <Title order={2}>Utilization Heatmap</Title>
      <Text size="sm" c="dimmed">
        Green (&lt;80%) | Yellow (80-100%) | Orange (100-120%) | Red (&gt;120%)
      </Text>
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
