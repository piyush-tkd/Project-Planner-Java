import { ActionIcon, Tooltip, Box } from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';
import { useChartExport } from '../../hooks/useChartExport';

interface ExportableChartProps {
  title: string;
  children: React.ReactNode;
}

export default function ExportableChart({ title, children }: ExportableChartProps) {
  const { chartRef, exportChart, exporting } = useChartExport(title);

  return (
    <Box pos="relative" ref={chartRef}>
      <Tooltip label="Download as PNG">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          pos="absolute"
          top={4}
          right={4}
          style={{ zIndex: 10 }}
          loading={exporting}
          onClick={() => exportChart()}
          aria-label="Camera"
        >
          <IconCamera size={16} />
        </ActionIcon>
      </Tooltip>
      {children}
    </Box>
  );
}
