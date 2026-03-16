import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  Title,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
  Tooltip,
} from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconBriefcase,
  IconHexagons,
  IconCalendarStats,
  IconArrowsShuffle,
  IconChartBar,
  IconFlame,
  IconUserPlus,
  IconAlertTriangle,
  IconTargetArrow,
  IconChartPie,
  IconChartAreaLine,
  IconPlayerPlay,
  IconAdjustments,
  IconSettings,
  IconDatabase,
  IconUsersGroup,
  IconCalendar,
  IconBuildingFactory,
  IconSun,
  IconMoon,
  IconFileSpreadsheet,
} from '@tabler/icons-react';
import ExcelUploadModal from '../common/ExcelUploadModal';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Dashboard', path: '/', icon: <IconDashboard size={18} /> },
    ],
  },
  {
    label: 'Data Entry',
    items: [
      { label: 'Resources', path: '/resources', icon: <IconUsers size={18} /> },
      { label: 'Projects', path: '/projects', icon: <IconBriefcase size={18} /> },
      { label: 'PODs', path: '/pods', icon: <IconHexagons size={18} /> },
      { label: 'Availability', path: '/availability', icon: <IconCalendarStats size={18} /> },
      { label: 'Overrides', path: '/overrides', icon: <IconArrowsShuffle size={18} /> },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'Capacity Gap', path: '/reports/capacity-gap', icon: <IconChartBar size={18} /> },
      { label: 'Utilization', path: '/reports/utilization', icon: <IconFlame size={18} /> },
      { label: 'Hiring Forecast', path: '/reports/hiring-forecast', icon: <IconUserPlus size={18} /> },
      { label: 'Concurrency Risk', path: '/reports/concurrency', icon: <IconAlertTriangle size={18} /> },
      { label: 'Deadline Gap', path: '/reports/deadline-gap', icon: <IconTargetArrow size={18} /> },
      { label: 'Resource Allocation', path: '/reports/resource-allocation', icon: <IconChartPie size={18} /> },
      { label: 'Capacity vs Demand', path: '/reports/capacity-demand', icon: <IconChartAreaLine size={18} /> },
      { label: 'POD Resources', path: '/reports/pod-resources', icon: <IconUsersGroup size={18} /> },
      { label: 'POD Splits', path: '/reports/pod-splits', icon: <IconArrowsShuffle size={18} /> },
      { label: 'Project-POD Matrix', path: '/reports/project-pod-matrix', icon: <IconHexagons size={18} /> },
      { label: 'Project Gantt', path: '/reports/gantt', icon: <IconCalendar size={18} /> },
      { label: 'POD Capacity', path: '/reports/pod-capacity', icon: <IconBuildingFactory size={18} /> },
    ],
  },
  {
    label: 'Simulators',
    items: [
      { label: 'Timeline Simulator', path: '/simulator/timeline', icon: <IconPlayerPlay size={18} /> },
      { label: 'Scenario Simulator', path: '/simulator/scenario', icon: <IconAdjustments size={18} /> },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Timeline', path: '/settings/timeline', icon: <IconSettings size={18} /> },
      { label: 'Reference Data', path: '/settings/ref-data', icon: <IconDatabase size={18} /> },
    ],
  },
];

export default function AppShellLayout() {
  const [opened, setOpened] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return (
    <MantineAppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened, desktop: !opened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={() => setOpened(o => !o)} size="sm" />
            <Title order={4}>Engineering Portfolio Planner</Title>
          </Group>
          <Group gap="xs">
            <Tooltip label="Upload Excel">
              <ActionIcon variant="default" size="lg" onClick={() => setExcelModalOpen(true)}>
                <IconFileSpreadsheet size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={computedColorScheme === 'dark' ? 'Light mode' : 'Dark mode'}>
              <ActionIcon
                variant="default"
                size="lg"
                onClick={() => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')}
              >
                {computedColorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs">
        <MantineAppShell.Section grow component={ScrollArea}>
          {navGroups.map(group => (
            <div key={group.label}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pt="md" pb={4}>
                {group.label}
              </Text>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={item.icon}
                  active={
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path)
                  }
                  onClick={() => navigate(item.path)}
                  variant="light"
                  style={{ borderRadius: 6 }}
                />
              ))}
            </div>
          ))}
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>

      <ExcelUploadModal opened={excelModalOpen} onClose={() => setExcelModalOpen(false)} />
    </MantineAppShell>
  );
}
