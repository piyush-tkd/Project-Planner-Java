import { useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import GlobalSearch, { useGlobalSearch } from '../common/GlobalSearch';
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
  Badge,
  useMantineColorScheme,
  useComputedColorScheme,
  Kbd,
  UnstyledButton,
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
  IconLogout,
  IconChevronDown,
  IconTag,
  IconKey,
  IconCurrencyDollar,
  IconUserCog,
  IconHeadset,
  IconSearch,
  IconHistory,
  IconChevronRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconCoin,
  IconHeartRateMonitor,
  IconLink,
  IconChartInfographic,
  IconBulb,
  IconClock,
  IconCalendarEvent,
  IconRocket,
  IconPackage,
  IconBrain,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import ExcelUploadModal from '../common/ExcelUploadModal';
import NotificationBell from '../common/NotificationBell';
import TourGuide from '../common/TourGuide';
import { useAuth } from '../../auth/AuthContext';
import apiClient from '../../api/client';
import { useAlertCounts } from '../../hooks/useAlertCounts';

// Baylor Genetics brand tokens
const DEEP_BLUE = '#0C2340';
const AGUA      = '#1F9196';

interface NavItem  { label: string; path: string; icon: React.ReactNode; pageKey?: string; alertKey?: string }
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Dashboard', path: '/', icon: <IconDashboard size={17} />, pageKey: 'dashboard' },
    ],
  },
  {
    label: 'Data Entry',
    items: [
      { label: 'Resources',     path: '/resources',     icon: <IconUsers size={17} />,         pageKey: 'resources' },
      { label: 'Projects',      path: '/projects',      icon: <IconBriefcase size={17} />,     pageKey: 'projects' },
      { label: 'PODs',          path: '/pods',          icon: <IconHexagons size={17} />,      pageKey: 'pods' },
      { label: 'Availability',  path: '/availability',  icon: <IconCalendarStats size={17} />, pageKey: 'availability' },
      { label: 'Overrides',     path: '/overrides',     icon: <IconArrowsShuffle size={17} />, pageKey: 'overrides' },
      { label: 'Team Calendar',     path: '/team-calendar',    icon: <IconCalendar size={17} />,        pageKey: 'team_calendar' },
      { label: 'Sprint Calendar',   path: '/sprint-calendar',  icon: <IconCalendarEvent size={17} />,   pageKey: 'sprint_calendar' },
      { label: 'Release Calendar',  path: '/release-calendar', icon: <IconRocket size={17} />,          pageKey: 'release_calendar' },
      { label: 'Sprint Planner',    path: '/sprint-planner',   icon: <IconBrain size={17} />,           pageKey: 'sprint_planner' },
    ],
  },
  {
    label: 'Capacity Reports',
    items: [
      { label: 'Capacity Gap',       path: '/reports/capacity-gap',        icon: <IconChartBar size={17} />,        pageKey: 'capacity_gap', alertKey: 'reportsDeficit' },
      { label: 'Utilization',        path: '/reports/utilization',         icon: <IconFlame size={17} />,           pageKey: 'utilization' },
      { label: 'Slack & Buffer',     path: '/reports/slack-buffer',        icon: <IconBulb size={17} />,            pageKey: 'slack_buffer' },
      { label: 'Hiring Forecast',    path: '/reports/hiring-forecast',     icon: <IconUserPlus size={17} />,        pageKey: 'hiring_forecast' },
      { label: 'Concurrency Risk',   path: '/reports/concurrency',         icon: <IconAlertTriangle size={17} />,   pageKey: 'concurrency_risk' },
      { label: 'Capacity vs Demand', path: '/reports/capacity-demand',     icon: <IconChartAreaLine size={17} />,   pageKey: 'capacity_demand' },
      { label: 'POD Resources',      path: '/reports/pod-resources',       icon: <IconUsersGroup size={17} />,      pageKey: 'pod_resources' },
      { label: 'POD Capacity',       path: '/reports/pod-capacity',        icon: <IconBuildingFactory size={17} />, pageKey: 'pod_capacity' },
      { label: 'Resource · POD',     path: '/reports/resource-pod-matrix', icon: <IconChartPie size={17} />,        pageKey: 'resource_pod_matrix' },
    ],
  },
  {
    label: 'Portfolio Analysis',
    items: [
      { label: 'Project Health',      path: '/reports/project-health',     icon: <IconHeartRateMonitor size={17} />, pageKey: 'project_health' },
      { label: 'Cross-POD Deps',      path: '/reports/cross-pod',          icon: <IconLink size={17} />,             pageKey: 'cross_pod_deps' },
      { label: 'Owner Demand',        path: '/reports/owner-demand',       icon: <IconChartInfographic size={17} />, pageKey: 'owner_demand' },
      { label: 'Deadline Gap',        path: '/reports/deadline-gap',       icon: <IconTargetArrow size={17} />,      pageKey: 'deadline_gap' },
      { label: 'Resource Allocation', path: '/reports/resource-allocation',icon: <IconChartPie size={17} />,         pageKey: 'resource_allocation' },
      { label: 'POD Splits',          path: '/reports/pod-splits',         icon: <IconArrowsShuffle size={17} />,    pageKey: 'pod_splits' },
      { label: 'POD-Project Matrix',  path: '/reports/pod-project-matrix', icon: <IconHexagons size={17} />,         pageKey: 'pod_project_matrix' },
      { label: 'Project-POD Matrix',  path: '/reports/project-pod-matrix', icon: <IconHexagons size={17} />,         pageKey: 'project_pod_matrix' },
      { label: 'Project Gantt',       path: '/reports/gantt',              icon: <IconCalendar size={17} />,         pageKey: 'project_gantt' },
      { label: 'Budget & Cost',       path: '/reports/budget',             icon: <IconCurrencyDollar size={17} />,   pageKey: 'budget' },
      { label: 'Resource ROI',        path: '/reports/resource-roi',       icon: <IconCoin size={17} />,             pageKey: 'resource_roi' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { label: 'POD Dashboard',   path: '/jira-pods',      icon: <IconUsers size={17} />,     pageKey: 'jira_pods' },
      { label: 'Releases',        path: '/jira-releases',  icon: <IconTag size={17} />,         pageKey: 'jira_releases' },
      { label: 'Release Notes',   path: '/release-notes',  icon: <IconPackage size={17} />,     pageKey: 'release_notes' },
      { label: 'CapEx / OpEx',  path: '/jira-capex',   icon: <IconCurrencyDollar size={17} />,  pageKey: 'jira_capex' },
      { label: 'Jira Actuals',  path: '/jira-actuals', icon: <IconTicket size={17} />,          pageKey: 'jira_actuals' },
      { label: 'Support Queue', path: '/jira-support', icon: <IconHeadset size={17} />,         pageKey: 'jira_support', alertKey: 'supportStale' },
      { label: 'Worklog',       path: '/jira-worklog', icon: <IconClock size={17} />,            pageKey: 'jira_worklog' },
    ],
  },
  {
    label: 'Simulators',
    items: [
      { label: 'Timeline Simulator', path: '/simulator/timeline', icon: <IconPlayerPlay size={17} />,  pageKey: 'timeline_simulator' },
      { label: 'Scenario Simulator', path: '/simulator/scenario', icon: <IconAdjustments size={17} />, pageKey: 'scenario_simulator' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Timeline',         path: '/settings/timeline',         icon: <IconSettings size={17} />, pageKey: 'settings' },
      { label: 'Reference Data',   path: '/settings/ref-data',         icon: <IconDatabase size={17} />, pageKey: 'settings' },
      { label: 'Jira Credentials', path: '/settings/jira-credentials', icon: <IconKey size={17} />,      pageKey: 'settings' },
      { label: 'Jira Boards',      path: '/settings/jira',             icon: <IconTicket size={17} />,   pageKey: 'settings' },
      { label: 'Release Versions', path: '/settings/releases',         icon: <IconTag size={17} />,      pageKey: 'settings' },
      { label: 'Support Boards',   path: '/settings/support-boards',   icon: <IconHeadset size={17} />,  pageKey: 'settings' },
      { label: 'Users',            path: '/settings/users',            icon: <IconUserCog size={17} />,  pageKey: '__admin_only__' },
      { label: 'Audit Log',        path: '/settings/audit-log',        icon: <IconHistory size={17} />,  pageKey: '__admin_only__' },
      { label: 'Tables',           path: '/settings/tables',           icon: <IconDatabase size={17} />, pageKey: '__admin_only__' },
    ],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:      { label: 'Admin',      color: 'red' },
  READ_WRITE: { label: 'Read/Write', color: 'blue' },
  READ_ONLY:  { label: 'Read Only',  color: 'gray' },
};

export default function AppShellLayout() {
  const [opened, setOpened]                 = useState(true);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [downloading, setDownloading]       = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { setColorScheme }  = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const { username, displayLabel, role, logout, canAccess, isAdmin } = useAuth();
  const isDark = computedColorScheme === 'dark';
  const alerts = useAlertCounts();
  const { opened: searchOpened, setOpened: setSearchOpened } = useGlobalSearch();

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

  // Build initials: "First Last" → "FL", "First" → "F", fallback → "U"
  const initials = (() => {
    const name = (displayLabel ?? username ?? '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  })();
  const roleInfo = role ? (ROLE_LABELS[role] ?? { label: role, color: 'gray' }) : null;

  // Filter nav groups based on user's page permissions
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Admin-only items (e.g. Users page)
        if (item.pageKey === '__admin_only__') return isAdmin;
        if (!item.pageKey) return true;
        return canAccess(item.pageKey);
      }),
    }))
    .filter(group => group.items.length > 0);

  // ── Collapsible nav groups ────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('pp_nav_collapsed');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggleGroup = useCallback((label: string, allGroupLabels: string[]) => {
    setCollapsedGroups(prev => {
      const isCurrentlyCollapsed = label in prev ? prev[label] : true;
      let next: Record<string, boolean>;
      if (isCurrentlyCollapsed) {
        // Expanding this group — collapse all others
        next = Object.fromEntries(allGroupLabels.map(g => [g, g !== label]));
      } else {
        // Collapsing this group
        next = { ...prev, [label]: true };
      }
      localStorage.setItem('pp_nav_collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  function isGroupCollapsed(group: typeof visibleGroups[0]): boolean {
    // Dashboard is never collapsible
    if (group.label === 'Dashboard') return false;
    // Use stored state if available
    if (group.label in collapsedGroups) return collapsedGroups[group.label];
    // Default: only the group containing the current route is expanded
    return !group.items.some(item =>
      item.path === '/' ? location.pathname === '/' :
      location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    );
  }

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
            {/* Search bar button */}
            <Tooltip label="Search (⌘K)" position="bottom">
              <UnstyledButton
                onClick={() => setSearchOpened(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: 13,
                  minWidth: 180,
                }}
                visibleFrom="sm"
              >
                <IconSearch size={14} />
                <Text size="sm" style={{ flex: 1, color: 'rgba(255,255,255,0.6)' }}>Search…</Text>
                <Kbd size="xs" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', border: 'none' }}>⌘K</Kbd>
              </UnstyledButton>
            </Tooltip>
            <Tooltip label="Search (⌘K)" position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => setSearchOpened(true)}
                style={{ color: 'rgba(255,255,255,0.75)' }}
                hiddenFrom="sm"
              >
                <IconSearch size={19} />
              </ActionIcon>
            </Tooltip>

            <NotificationBell />

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
                    {displayLabel}
                  </Text>
                  <IconChevronDown size={14} color="rgba(255,255,255,0.6)" />
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label style={{ fontFamily: 'Barlow' }}>
                  Signed in as <strong>{displayLabel}</strong>
                  {displayLabel !== username && (
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'Barlow' }}>@{username}</Text>
                  )}
                  {roleInfo && (
                    <Badge size="xs" color={roleInfo.color} ml={6} variant="light">
                      {roleInfo.label}
                    </Badge>
                  )}
                </Menu.Label>
                <Divider />
                {isAdmin && (
                  <Menu.Item
                    leftSection={<IconUserCog size={16} />}
                    onClick={() => navigate('/settings/users')}
                    style={{ fontFamily: 'Barlow' }}
                  >
                    Manage Users
                  </Menu.Item>
                )}
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
          {visibleGroups.map(group => {
            const collapsed = isGroupCollapsed(group);
            const hasActive = group.items.some(item =>
              item.path === '/' ? location.pathname === '/' :
              location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            );
            const allLabels = visibleGroups.map(g => g.label);
            return (
              <div key={group.label}>
                {/* Group header — clickable to collapse/expand */}
                <UnstyledButton
                  onClick={() => group.label !== 'Dashboard' && toggleGroup(group.label, allLabels)}
                  style={{ width: '100%', padding: '10px 8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text
                    size="xs" fw={700} tt="uppercase"
                    style={{ color: hasActive ? DEEP_BLUE : AGUA, fontFamily: 'Barlow, system-ui, sans-serif', letterSpacing: '0.06em', fontSize: 10 }}
                  >
                    {group.label}
                  </Text>
                  {group.label !== 'Dashboard' && (
                    <IconChevronRight
                      size={12}
                      style={{ color: AGUA, transition: 'transform 150ms ease', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                    />
                  )}
                </UnstyledButton>

                {/* Nav items — hidden when collapsed */}
                {!collapsed && group.items.map(item => {
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  const alertCount = item.alertKey ? (alerts[item.alertKey as keyof typeof alerts] ?? 0) : 0;
                  return (
                    <NavLink
                      key={item.path}
                      label={
                        <Group gap={6} justify="space-between" wrap="nowrap">
                          <span>{item.label}</span>
                          {alertCount > 0 && (
                            <Badge size="xs" variant="filled"
                              color={item.alertKey === 'supportStale' ? 'orange' : 'red'}
                              style={{ fontSize: 10, minWidth: 18, padding: '0 4px' }}>
                              {alertCount}
                            </Badge>
                          )}
                        </Group>
                      }
                      leftSection={item.icon}
                      active={isActive}
                      onClick={() => navigate(item.path)}
                      style={{ borderRadius: 6, fontFamily: 'Barlow, system-ui, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 14 }}
                      styles={{ root: { '--nav-active-bg': `${DEEP_BLUE}14`, '--nav-active-color': DEEP_BLUE } }}
                      color="deepBlue"
                    />
                  );
                })}
              </div>
            );
          })}
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>

      <ExcelUploadModal opened={excelModalOpen} onClose={() => setExcelModalOpen(false)} />
      <GlobalSearch opened={searchOpened} onClose={() => setSearchOpened(false)} />
      <TourGuide />
    </MantineAppShell>
  );
}
