import { useState } from 'react';
import {
  Title,
  Text,
  Stack,
  Center,
  Tabs,
  ThemeIcon,
  Button,
  Group,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconFlame,
  IconUserPlus,
  IconChartAreaLine,
  IconUsersGroup,
  IconBuildingFactory,
  IconClock,
  IconChartBar,
  IconArrowRight,
  IconRadar,
} from '@tabler/icons-react';
import { DEEP_BLUE, AQUA, FONT_FAMILY } from '../brandTokens';

interface TabConfig {
  value: string;
  label: string;
  icon: any;
  title: string;
  description: string;
  navLink: string;
}

export default function CapacityHubPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('utilization');

  const tabs: TabConfig[] = [
    {
      value: 'utilization',
      label: 'Utilization',
      icon: IconFlame,
      title: 'Resource Utilization',
      description: 'View detailed resource utilization rates and efficiency metrics across your team.',
      navLink: '/reports/utilization',
    },
    {
      value: 'hiring-forecast',
      label: 'Hiring Forecast',
      icon: IconUserPlus,
      title: 'Hiring Forecast',
      description: 'Track hiring plans and forecasted headcount by department and time period.',
      navLink: '/reports/hiring-forecast',
    },
    {
      value: 'capacity-demand',
      label: 'Capacity vs Demand',
      icon: IconChartAreaLine,
      title: 'Capacity vs Demand',
      description: 'Compare available capacity against project demand and identify gaps.',
      navLink: '/reports/capacity-demand',
    },
    {
      value: 'pod-resources',
      label: 'POD Resources',
      icon: IconUsersGroup,
      title: 'POD Resources',
      description: 'Manage and review resources assigned to each POD.',
      navLink: '/reports/pod-resources',
    },
    {
      value: 'pod-capacity',
      label: 'POD Capacity',
      icon: IconBuildingFactory,
      title: 'POD Capacity',
      description: 'Track total capacity and allocation status for each POD.',
      navLink: '/reports/pod-capacity',
    },
    {
      value: 'work-hours',
      label: 'Work Hours',
      icon: IconClock,
      title: 'POD Work Hours',
      description: 'Monitor work hours and time tracking across PODs.',
      navLink: '/reports/pod-hours',
    },
    {
      value: 'workload',
      label: 'Workload',
      icon: IconChartBar,
      title: 'Workload Analysis',
      description: 'Analyze workload distribution and identify overallocation risks.',
      navLink: '/reports/workload-chart',
    },
    {
      value: 'capacity-forecast',
      label: 'Forecast',
      icon: IconRadar,
      title: 'Capacity Forecast',
      description: '3-month traffic-light forecast of capacity gaps per POD — identify Critical, At-Risk, and Healthy PODs before gaps occur.',
      navLink: '/reports/capacity-forecast',
    },
  ];

  const PlaceholderState = ({ config }: { config: TabConfig }) => {
    const Icon = config.icon;
    return (
      <Center py={120}>
        <Stack align="center" gap="lg" style={{ maxWidth: '400px' }}>
          <ThemeIcon size={80} radius="md" variant="light" color="blue">
            <Icon size={40} stroke={1.5} />
          </ThemeIcon>
          <Stack gap={4} align="center">
            <Text fw={600} size="lg" style={{ fontFamily: FONT_FAMILY, color: DEEP_BLUE }}>
              {config.title}
            </Text>
            <Text c="dimmed" size="sm" ta="center" style={{ fontFamily: FONT_FAMILY }}>
              {config.description}
            </Text>
          </Stack>
          <Group>
            <Button
              color={AQUA}
              rightSection={<IconArrowRight size={18} />}
              onClick={() => navigate(config.navLink)}
              styles={{
                root: { backgroundColor: AQUA, color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 600 },
              }}
            >
              View Full Report
            </Button>
          </Group>
        </Stack>
      </Center>
    );
  };

  return (
    <Stack gap="lg" p="md">
      {/* Header */}
      <div>
        <Title order={1} style={{ color: DEEP_BLUE, fontFamily: FONT_FAMILY, fontWeight: 600 }}>
          Capacity
        </Title>
        <Text c="dimmed" mt={4} style={{ fontFamily: FONT_FAMILY }}>
          Resource capacity planning and workforce analytics
        </Text>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        styles={{
          tab: {
            fontFamily: FONT_FAMILY,
            color: DEEP_BLUE,
            '&[data-active]': {
              color: AQUA,
              borderBottomColor: AQUA,
            },
          },
        }}
      >
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}
              onClick={() => navigate(tab.navLink)}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {tabs.map((tab) => (
          <Tabs.Panel key={tab.value} value={tab.value} pt="xl">
            <PlaceholderState config={tab} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}
