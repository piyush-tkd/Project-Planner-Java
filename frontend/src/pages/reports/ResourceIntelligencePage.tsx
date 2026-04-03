import { useState } from 'react';
import { Tabs, Box, Title, Text, Group } from '@mantine/core';
import { IconChartPie, IconChartBar, IconCoin, IconUserSearch } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import ResourceAllocationPage from './ResourceAllocationPage';
import ResourcePodMatrixPage from './ResourcePodMatrixPage';
import ResourceROIPage from './ResourceROIPage';
import ResourceForecastPage from './ResourceForecastPage';

export default function ResourceIntelligencePage() {
  const dark = useDarkMode();
  const [activeTab, setActiveTab] = useState<string | null>('allocation');

  return (
    <Box p="lg">
      <Group mb="md">
        <Box>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
            Resource Intelligence
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            Allocation · POD matrix · ROI &amp; rates · Workforce forecast
          </Text>
        </Box>
      </Group>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          root: { '--tabs-color': AQUA },
          list: {
            padding: '4px 6px', gap: 2,
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(12,35,64,0.04)',
            borderRadius: 12,
            border: `1px solid ${dark ? 'rgba(45,204,211,0.12)' : 'rgba(12,35,64,0.08)'}`,
            marginBottom: 20,
            '&::before': { display: 'none' },
          },
          tab: {
            fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 13,
            borderRadius: 8, padding: '8px 16px', border: 'none',
            color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(12,35,64,0.55)',
            '&[data-active]': {
              background: dark ? 'rgba(45,204,211,0.14)' : '#ffffff',
              color: dark ? AQUA : DEEP_BLUE,
              borderBottom: `2.5px solid ${AQUA}`,
              boxShadow: dark ? 'none' : '0 1px 6px rgba(12,35,64,0.12)',
            },
            '&:hover:not([data-active])': {
              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,35,64,0.05)',
            },
          },
          panel: { paddingTop: 4 },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="allocation"
            leftSection={<IconChartPie size={15} color={activeTab === 'allocation' ? AQUA : undefined} />}
          >
            Allocation
          </Tabs.Tab>
          <Tabs.Tab
            value="pod-matrix"
            leftSection={<IconChartBar size={15} color={activeTab === 'pod-matrix' ? '#34d399' : undefined} />}
          >
            POD Matrix
          </Tabs.Tab>
          <Tabs.Tab
            value="forecast"
            leftSection={<IconUserSearch size={15} color={activeTab === 'forecast' ? '#818cf8' : undefined} />}
          >
            Workforce Forecast
          </Tabs.Tab>
          <Tabs.Tab
            value="roi"
            leftSection={<IconCoin size={15} color={activeTab === 'roi' ? '#f59e0b' : undefined} />}
          >
            ROI &amp; Rates
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="allocation">
          <ResourceAllocationPage />
        </Tabs.Panel>

        <Tabs.Panel value="pod-matrix">
          <ResourcePodMatrixPage />
        </Tabs.Panel>

        <Tabs.Panel value="forecast">
          <ResourceForecastPage />
        </Tabs.Panel>

        <Tabs.Panel value="roi">
          <ResourceROIPage />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
