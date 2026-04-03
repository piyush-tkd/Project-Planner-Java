import { useState } from 'react';
import { Tabs, Box, Title, Text, Group } from '@mantine/core';
import { IconLink, IconGitBranch } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import CrossPodDependencyPage from './CrossPodDependencyPage';
import CrossTeamDependencyPage from './CrossTeamDependencyPage';

export default function DependencyMapPage() {
  const dark = useDarkMode();
  const [activeTab, setActiveTab] = useState<string | null>('cross-pod');

  return (
    <Box p="lg">
      <Group mb="md">
        <Box>
          <Title order={2} style={{ fontFamily: FONT_FAMILY, color: dark ? '#fff' : DEEP_BLUE }}>
            Dependency Map
          </Title>
          <Text size="sm" c="dimmed" mt={2}>
            Multi-POD project coordination · Cross-team bottlenecks &amp; critical path
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
            value="cross-pod"
            leftSection={<IconLink size={15} color={activeTab === 'cross-pod' ? AQUA : undefined} />}
          >
            Cross-POD Projects
          </Tabs.Tab>
          <Tabs.Tab
            value="team-deps"
            leftSection={<IconGitBranch size={15} color={activeTab === 'team-deps' ? '#818cf8' : undefined} />}
          >
            Team Dependencies
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="cross-pod">
          <CrossPodDependencyPage />
        </Tabs.Panel>

        <Tabs.Panel value="team-deps">
          <CrossTeamDependencyPage />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
