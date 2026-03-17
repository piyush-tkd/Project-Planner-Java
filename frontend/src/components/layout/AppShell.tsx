import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  ActionIcon,
  Tooltip,
  Avatar,
  Menu,
  Divider,
  useMantineColorScheme,
  useComputedColorScheme,
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
  IconTableExport,
  IconTicket,
  IconUsers,
  IconLogout,
  IconChevronDown,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import ExcelUploadModal from '../common/ExcelUploadModal';
import { useAuth } from '../../auth/AuthContext';
import apiClient from '../../api/client';

// Baylor Genetics brand tokens
const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';

interface NavItem  { label: string; path: string; icon: React.ReactNode }
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Dashboard', path: '/', icon: <IconDashboard size={17} /> },
    ],
  },
  {
    label: 'Data Entry',
    items: [
      { label: 'Resources',    path: '/resources',    icon: <IconUsers size={17} /> },
      { label: 'Projects',     path: '/projects',     icon: <IconBriefcase size={17} /> },
      { label: 'PODs',         path: '/pods',         icon: <IconHexagons size={17} /> },
      { label: 'Availability', path: '/availability', icon: <IconCalendarStats size={17} /> },
      { label: 'Overrides',    path: '/overrides',    icon: <IconArrowsShuffle size={17} /> },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'Capacity Gap',       path: '/reports/capacity-gap',       icon: <IconChartBar size={17} /> },
      { label: 'Utilization',        path: '/reports/utilization',        icon: <IconFlame size={17} /> },
      { label: 'Hiring Forecast',    path: '/reports/hiring-forecast',    icon: <IconUserPlus size={17} /> },
      { label: 'Concurrency Risk',   path: '/reports/concurrency',        icon: <IconAlertTriangle size={17} /> },
      { label: 'Deadline Gap',       path: '/reports/deadline-gap',       icon: <IconTargetArrow size={17} /> },
      { label: 'Resource Allocation',path: '/reports/resource-allocation',icon: <IconChartPie size={17} /> },
      { label: 'Capacity vs Demand', path: '/reports/capacity-demand',    icon: <IconChartAreaLine size={17} /> },
      { label: 'POD Resources',      path: '/reports/pod-resources',      icon: <IconUsersGroup size={17} /> },
      { label: 'POD Splits',         path: '/reports/pod-splits',         icon: <IconArrowsShuffle size={17} /> },
      { label: 'Project-POD Matrix', path: '/reports/project-pod-matrix', icon: <IconHexagons size={17} /> },
      { label: 'Project Gantt',      path: '/reports/gantt',              icon: <IconCalendar size={17} /> },
      { label: 'POD Capacity',       path: '/reports/pod-capacity',       icon: <IconBuildingFactory size={17} /> },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { label: 'POD Dashboard', path: '/jira-pods', icon: <IconUsers size={17} /> },
      { label: 'Jira Actuals', path: '/jira-actuals', icon: <IconTicket size={17} /> },
    ],
  },
  {
    label: 'Simulators',
    items: [
      { label: 'Timeline Simulator', path: '/simulator/timeline', icon: <IconPlayerPlay size={17} /> },
      { label: 'Scenario Simulator', path: '/simulator/scenario', icon: <IconAdjustments size={17} /> },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Timeline',       path: '/settings/timeline', icon: <IconSettings size={17} /> },
      { label: 'Reference Data', path: '/settings/ref-data', icon: <IconDatabase size={17} /> },
    ],
  },
];

export default function AppShellLayout() {
  const [opened, setOpened]         = useState(true);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { setColorScheme }      = useMantineColorScheme();
  const computedColorScheme     = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const { username, logout }    = useAuth();
  const isDark = computedColorScheme === 'dark';

  async function handleExportReconciliation() {
    setDownloading(true);
    try {
      const response = await apiClient.get('/reports/export/reconciliation', {
        responseType: 'blob',
        timeout: 60000,
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'capacity-reconciliation.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      notifications.show({
        title: 'Export failed',
        message: 'Could not generate the reconciliation workbook. Please try again.',
        color: 'red',
      });
    } finally {
      setDownloading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  // Initials avatar from username
  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{
        width: 256,
        breakpoint: 'sm',
        collapsed: { mobile: !opened, desktop: !opened },
      }}
      padding="md"
    >
      {/* ── Header ── */}
      <MantineAppShell.Header
        style={{
          backgroundColor: DEEP_BLUE,
          borderBottom: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}
      >
        <Group h="100%" px="md" justify="space-between">

          {/* Left: burger + logo */}
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={() => setOpened(o => !o)}
              size="sm"
              color="white"
            />
            {/* Teal triangle logo mark */}
            <svg width="28" height="26" viewBox="0 0 28 26" fill="none">
              <polygon points="14,1 27,25 1,25" fill="none" stroke={AGUA} strokeWidth="2.5" />
              <polygon points="14,7 23,23 5,23"  fill={AGUA} opacity="0.3" />
            </svg>
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: 'Barlow, system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.03em',
                lineHeight: 1.2,
              }}
            >
              Engineering Portfolio Planner
            </Text>
          </Group>

          {/* Right: actions + user menu */}
          <Group gap={6}>
            <Tooltip label="Upload Excel" position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => setExcelModalOpen(true)}
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                <IconFileSpreadsheet size={19} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Export Reconciliation Workbook" position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                loading={downloading}
                onClick={handleExportReconciliation}
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                <IconTableExport size={19} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={isDark ? 'Light mode' : 'Dark mode'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                {isDark ? <IconSun size={19} /> : <IconMoon size={19} />}
              </ActionIcon>
            </Tooltip>

            {/* User avatar + dropdown */}
            <Menu position="bottom-end" offset={8} withArrow>
              <Menu.Target>
                <Group
                  gap={6}
                  style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}
                >
                  <Avatar
                    size={32}
                    radius="xl"
                    style={{ backgroundColor: AGUA, color: '#fff', fontFamily: 'Barlow', fontWeight: 700 }}
                  >
                    {initials}
                  </Avatar>
                  <Text size="sm" style={{ color: '#fff', fontFamily: 'Barlow', fontWeight: 500 }} visibleFrom="sm">
                    {username}
                  </Text>
                  <IconChevronDown size={14} color="rgba(255,255,255,0.6)" />
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label style={{ fontFamily: 'Barlow' }}>Signed in as <strong>{username}</strong></Menu.Label>
                <Divider />
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  color="red"
                  onClick={handleLogout}
                  style={{ fontFamily: 'Barlow' }}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MantineAppShell.Header>

      {/* ── Sidebar nav ── */}
      <MantineAppShell.Navbar
        p="xs"
        style={{
          backgroundColor: isDark ? undefined : '#F8FAFB',
          borderRight: `1px solid ${isDark ? '#2C2C2C' : '#E8ECF2'}`,
        }}
      >
        <MantineAppShell.Section grow component={ScrollArea}>
          {navGroups.map(group => (
            <div key={group.label}>
              <Text
                size="xs"
                fw={700}
                tt="uppercase"
                px="sm"
                pt="md"
                pb={4}
                style={{
                  color: AGUA,
                  fontFamily: 'Barlow, system-ui, sans-serif',
                  letterSpacing: '0.06em',
                  fontSize: 10,
                }}
              >
                {group.label}
              </Text>
              {group.items.map(item => {
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    label={item.label}
                    leftSection={item.icon}
                    active={isActive}
                    onClick={() => navigate(item.path)}
                    style={{
                      borderRadius: 6,
                      fontFamily: 'Barlow, system-ui, sans-serif',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 14,
                    }}
                    styles={{
                      root: {
                        '--nav-active-bg': `${DEEP_BLUE}14`,
                        '--nav-active-color': DEEP_BLUE,
                      },
                    }}
                    color="deepBlue"
                  />
                );
              })}
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
