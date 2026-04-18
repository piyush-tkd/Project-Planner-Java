import { useState } from 'react';
import { Tabs, Box, Title, Text, Group } from '@mantine/core';
import { IconTimeline, IconCalendar, IconCalendarStats } from '@tabler/icons-react';
import { DEEP_BLUE, AQUA } from '../../brandTokens';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useProjects } from '../../api/projects';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/ui';
import RoadmapTimelinePage from './RoadmapTimelinePage';
import ProjectGanttPage from './ProjectGanttPage';
import TeamCalendarPage from '../TeamCalendarPage';

export default function PortfolioTimelinePage() {
 const dark = useDarkMode();
 const [activeTab, setActiveTab] = useState<string | null>('roadmap');
 const { data: projects, isLoading } = useProjects();

 if (isLoading) return <LoadingSpinner />;
 if (!projects || projects.length === 0) {
 return (
 <EmptyState
 icon={<IconTimeline size={40} stroke={1.5} />}
 title="No projects on the timeline"
 description="Add projects with start dates and durations to see them on the roadmap, Gantt chart, and team calendar."
 />
 );
 }

 return (
 <Box p="lg">
 <Group mb="md">
 <Box>
 <Title order={2} style={{color: dark ? '#fff' : DEEP_BLUE }}>
 Portfolio Timeline
 </Title>
 <Text size="sm" c="dimmed" mt={2}>
 Roadmap · Gantt · Team calendar — three views, one portfolio
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
 '&::before': { display: 'none' }
 },
 tab: {fontWeight: 600, fontSize: 13,
 borderRadius: 8, padding: '8px 16px', border: 'none',
 color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(12,35,64,0.55)',
 '&[data-active]': {
 background: dark ? 'rgba(45,204,211,0.14)' : 'var(--pp-surface-light)',
 color: dark ? AQUA : DEEP_BLUE,
 borderBottom: `2.5px solid ${AQUA}`,
 boxShadow: dark ? 'none' : '0 1px 6px rgba(12,35,64,0.12)'
 },
 '&:hover:not([data-active])': {
 background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,35,64,0.05)'
 }
 },
 panel: { paddingTop: 4 }}}
 >
 <Tabs.List>
 <Tabs.Tab
 value="roadmap"
 leftSection={<IconTimeline size={15} color={activeTab === 'roadmap' ? AQUA : undefined} />}
 >
 Roadmap
 </Tabs.Tab>
 <Tabs.Tab
 value="gantt"
 leftSection={<IconCalendar size={15} color={activeTab === 'gantt' ? AQUA : undefined} />}
 >
 Gantt
 </Tabs.Tab>
 <Tabs.Tab
 value="team-calendar"
 leftSection={<IconCalendarStats size={15} color={activeTab === 'team-calendar' ? AQUA : undefined} />}
 >
 Team Calendar
 </Tabs.Tab>
 </Tabs.List>

 <Tabs.Panel value="roadmap">
 <RoadmapTimelinePage />
 </Tabs.Panel>

 <Tabs.Panel value="gantt">
 <ProjectGanttPage />
 </Tabs.Panel>

 <Tabs.Panel value="team-calendar">
 <TeamCalendarPage />
 </Tabs.Panel>
 </Tabs>
 </Box>
 );
}
