import { Card, Box, Stack, Text, Loader } from '@mantine/core';
import { WidgetConfig } from '../../state/types';
import { useWidgetData } from '../../state/hooks';
import { renderWidget } from '../WidgetRegistry';

const PREVIEW_H = 230;

function WidgetPreview({ widgetType, config, dark }: {
  widgetType: string; config: WidgetConfig; dark: boolean;
}) {
  const { data: qData, isLoading } = useWidgetData(config, true);
  const rows = qData?.data ?? [];
  const cols = qData?.columns ?? [];
  const isKpi = widgetType === 'kpi_card';

  return (
    <Card withBorder p="xs" style={{ backgroundColor: dark ? 'rgba(255,255,255,0.02)' : '#fafafa' }}>
      <Text size="xs" c="dimmed" mb={6} fw={600}>LIVE PREVIEW</Text>
      <Box style={{ height: isKpi ? 110 : PREVIEW_H }}>
        {isLoading ? (
          <Stack align="center" justify="center" h="100%"><Loader size="sm" /></Stack>
        ) : (
          renderWidget(widgetType, rows, cols, config, dark)
        )}
      </Box>
    </Card>
  );
}

export { WidgetPreview };
