import { useState } from 'react';
import { Tabs, Box, Title, Text, Group } from '@mantine/core';
import { IconChartInfographic, IconTargetArrow, IconArrowsShuffle } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useProjects } from '../../api/projects';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/ui';
import OwnerDemandPage from './OwnerDemandPage';
import DeadlineGapPage from './DeadlineGapPage';
import PodSplitsPage from './PodSplitsPage';

export default function ProjectSignalsPage() {
  const dark = useDarkMode();
  const [activeTab, setActiveTab] = useState<string | null>('owner-demand');
  const { data: projects, isLoading } = useProjects();

  if (isLoading) return <LoadingSpinner />;
  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={<IconChartInfographic size={40} stroke={1.5} />}
        title="No signal data yet"
        description="Add projects to start tracking owner demand pressure, deadline risk, and POD split analysis."
      />
    );
  }

  return (
    <Box style={{ fontFamily: FONT_FAMILY }}>
      <Box px="lg" pt="lg">
        <Title order={2} style={{ color: dark ? '#fff' : DEEP_BLUE, fontFamily: FONT_FAMILY }}>
          Project Signals
        </Title>
        <Text size="sm" c="dimmed" mt={2} mb="md">
          Owner demand pressure, deadline risk, and POD split analysis
        </Text>
      </Box>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          root: { '--tabs-color': AQUA },
          list: {
            borderBottom: `2px solid ${dark ? 'rgba(45,204,211,0.15)' : 'rgba(12,35,64,0.08)'}`,
            marginBottom: 20,
          },
          tab: {
            fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 13,
            paddingBottom: 10,
            '&[data-active]': {
              color: dark ? AQUA : DEEP_BLUE,
              borderBottom: `2.5px solid ${AQUA}`,
            },
          },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="owner-demand"
            leftSection={<IconChartInfographic size={15} color={activeTab === 'owner-demand' ? AQUA : undefined} />}
          >
            Owner Demand
          </Tabs.Tab>
          <Tabs.Tab
            value="deadline-gap"
            leftSection={<IconTargetArrow size={15} color={activeTab === 'deadline-gap' ? AQUA : undefined} />}
          >
            Deadline Gap
          </Tabs.Tab>
          <Tabs.Tab
            value="pod-splits"
            leftSection={<IconArrowsShuffle size={15} color={activeTab === 'pod-splits' ? AQUA : undefined} />}
          >
            POD Splits
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="owner-demand">
          <OwnerDemandPage />
        </Tabs.Panel>
        <Tabs.Panel value="deadline-gap">
          <DeadlineGapPage />
        </Tabs.Panel>
        <Tabs.Panel value="pod-splits">
          <PodSplitsPage />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
