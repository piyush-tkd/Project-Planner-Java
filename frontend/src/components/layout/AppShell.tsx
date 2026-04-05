import { useState, useCallback, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useOrgSettings } from '../../context/OrgSettingsContext';
import GlobalSearch, { useGlobalSearch } from '../common/GlobalSearch';
import KeyboardShortcutsPanel, { useShortcutsPanel } from '../common/KeyboardShortcutsPanel';
import GlobalBreadcrumb from '../common/GlobalBreadcrumb';
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
  IconBrandAzure,
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
  IconMessageReport,
  IconLayoutDashboard,
  IconTrendingUp,
  IconShieldCheck,
  IconTimeline,
  IconUserSearch,
  IconPlugConnected,
  IconReportMoney,
  IconGitBranch,
  IconChartDots3,
  IconBellRinging,
  IconCalendarOff,
  IconCalendarPlus,
  IconTemplate,
  IconInbox,
  IconTruck,
  IconPlus,
  IconRadar,
  IconStars,
  IconListCheck,
  IconFlame as IconFlameAlias,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import ExcelUploadModal from '../common/ExcelUploadModal';
import NotificationBell from '../common/NotificationBell';
import TourGuide from '../common/TourGuide';
import FeedbackWidget from '../common/FeedbackWidget';
import WhatsNewDrawer, { useUnreadChangelogCount } from '../common/WhatsNewDrawer';
import { useAuth } from '../../auth/AuthContext';
import apiClient from '../../api/client';
import { useAlertCounts } from '../../hooks/useAlertCounts';
import { useSidebarOrder } from '../../api/widgetPreferences';
import {
  DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS,
  FONT_FAMILY, SHADOW, SURFACE_SIDEBAR, BORDER_DEFAULT,
  TEXT_SECONDARY,
} from '../../brandTokens';

interface NavItem  { label: string; path: string; icon: React.ReactNode; pageKey?: string; alertKey?: string; featureFlag?: string }
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  // ── HOME ───────────────────────────────────────────────────────────────────
  {
    label: 'Home',
    items: [
      { label: 'Dashboard', path: '/',      icon: <IconDashboard size={17} />, pageKey: 'dashboard' },
      { label: 'Inbox',     path: '/inbox', icon: <IconInbox size={17} />,     pageKey: 'inbox' },
      { label: 'Ask AI',    path: '/nlp',   icon: <IconBrain size={17} />,     pageKey: 'nlp_landing',  featureFlag: 'ai' },
    ],
  },
  // ── PROJECTS ───────────────────────────────────────────────────────────────
  {
    label: 'Projects',
    items: [
      { label: 'Projects',      path: '/projects',      icon: <IconBriefcase size={17} />,     pageKey: 'projects' },
      { label: 'PODs',          path: '/pods',          icon: <IconHexagons size={17} />,      pageKey: 'pods' },
      { label: 'Objectives',    path: '/objectives',    icon: <IconTargetArrow size={17} />,   pageKey: 'objectives',    featureFlag: 'okr' },
      { label: 'Risk & Issues', path: '/risk-register', icon: <IconAlertTriangle size={17} />, pageKey: 'risk_register', featureFlag: 'risk' },
      { label: 'Ideas Board',   path: '/ideas',         icon: <IconBulb size={17} />,          pageKey: 'ideas_board',   featureFlag: 'ideas' },
    ],
  },
  // ── PEOPLE ─────────────────────────────────────────────────────────────────
  {
    label: 'People',
    items: [
      { label: 'Resources',             path: '/resources',                      icon: <IconUsers size={17} />,           pageKey: 'resources' },
      { label: 'Availability',          path: '/availability',                   icon: <IconCalendarStats size={17} />,   pageKey: 'availability' },
      { label: 'Overrides',             path: '/overrides',                      icon: <IconArrowsShuffle size={17} />,   pageKey: 'overrides' },
      { label: 'Bookings',              path: '/resource-bookings',              icon: <IconCalendarPlus size={17} />,    pageKey: 'resource_bookings' },
      { label: 'Capacity',              path: '/capacity',                       icon: <IconFlame size={17} />,           pageKey: 'capacity_hub' },
      { label: 'Leave & Holidays',      path: '/leave',                          icon: <IconCalendarOff size={17} />,     pageKey: 'leave_hub' },
      { label: 'Capacity Forecast',     path: '/reports/capacity-forecast',      icon: <IconRadar size={17} />,           pageKey: 'capacity_forecast' },
      { label: 'Skills Matrix',         path: '/reports/skills-matrix',          icon: <IconStars size={17} />,           pageKey: 'skills_matrix' },
      { label: 'Team Pulse',            path: '/reports/team-pulse',             icon: <IconHeartRateMonitor size={17} />, pageKey: 'team_pulse' },
      { label: 'Resource Performance',  path: '/reports/resource-performance',   icon: <IconTrendingUp size={17} />,      pageKey: 'resource_performance' },
      { label: 'Resource Intelligence', path: '/reports/resource-intelligence',  icon: <IconUserSearch size={17} />,      pageKey: 'resource_intelligence' },
    ],
  },
  // ── CALENDAR ───────────────────────────────────────────────────────────────
  {
    label: 'Calendar',
    items: [
      { label: 'Strategic Calendar', path: '/calendar',           icon: <IconCalendar size={17} />,       pageKey: 'calendar_hub' },
      { label: 'Sprint Calendar',    path: '/sprint-calendar',    icon: <IconCalendarEvent size={17} />,  pageKey: 'sprint_calendar' },
      { label: 'Release Calendar',   path: '/release-calendar',   icon: <IconCalendarPlus size={17} />,   pageKey: 'release_calendar' },
      { label: 'Sprint Planner',     path: '/sprint-planner',     icon: <IconBrain size={17} />,          pageKey: 'sprint_planner' },
      { label: 'Project Templates',  path: '/project-templates',  icon: <IconTemplate size={17} />,       pageKey: 'project_templates' },
    ],
  },
  // ── DELIVERY ───────────────────────────────────────────────────────────────
  {
    label: 'Delivery',
    items: [
      { label: 'POD Dashboard',  path: '/jira-pods',      icon: <IconUsersGroup size={17} />,  pageKey: 'jira_pods' },
      { label: 'Releases',       path: '/jira-releases',  icon: <IconTag size={17} />,          pageKey: 'jira_releases' },
      { label: 'Release Notes',  path: '/release-notes',  icon: <IconPackage size={17} />,      pageKey: 'release_notes' },
      { label: 'Jira Actuals',   path: '/jira-actuals',   icon: <IconTicket size={17} />,       pageKey: 'jira_actuals' },
      { label: 'Support Queue',  path: '/jira-support',   icon: <IconHeadset size={17} />,      pageKey: 'jira_support', alertKey: 'supportStale' },
      { label: 'Worklog',        path: '/jira-worklog',   icon: <IconClock size={17} />,        pageKey: 'jira_worklog' },
      { label: 'Budget & CapEx', path: '/reports/budget-capex', icon: <IconCurrencyDollar size={17} />, pageKey: 'budget_capex', featureFlag: 'financials' },
    ],
  },
  // ── PORTFOLIO ─────────────────────────────────────────────────────────────
  {
    label: 'Portfolio',
    items: [
      { label: 'Executive Summary',   path: '/reports/executive-summary',          icon: <IconLayoutDashboard size={17} />,   pageKey: 'exec_summary' },
      { label: 'Portfolio Health',    path: '/reports/portfolio-health-dashboard', icon: <IconShieldCheck size={17} />,      pageKey: 'portfolio_health_dashboard' },
      { label: 'Project Health',      path: '/reports/project-health',             icon: <IconHeartRateMonitor size={17} />, pageKey: 'project_health' },
      { label: 'Portfolio Timeline',  path: '/reports/portfolio-timeline',         icon: <IconTimeline size={17} />,          pageKey: 'portfolio_timeline' },
      { label: 'Project Signals',     path: '/reports/project-signals',            icon: <IconChartInfographic size={17} />,  pageKey: 'project_signals' },
      { label: 'Dependency Map',      path: '/reports/dependency-map',             icon: <IconLink size={17} />,              pageKey: 'dependency_map' },
      { label: 'Gantt & Dependencies',path: '/reports/gantt-dependencies',         icon: <IconGitBranch size={17} />,         pageKey: 'gantt_dependencies' },
      { label: 'Risk Heatmap',        path: '/reports/risk-heatmap',               icon: <IconChartDots3 size={17} />,        pageKey: 'risk_heatmap' },
      { label: 'Status Updates',      path: '/reports/status-updates',             icon: <IconMessageReport size={17} />,     pageKey: 'status_updates' },
    ],
  },
  // ── ENGINEERING ───────────────────────────────────────────────────────────
  {
    label: 'Engineering',
    items: [
      { label: 'Eng. Intelligence',   path: '/reports/engineering-intelligence',   icon: <IconReportMoney size={17} />,       pageKey: 'engineering_intelligence' },
      { label: 'DORA Metrics',        path: '/reports/dora',                       icon: <IconRocket size={17} />,            pageKey: 'dora_metrics' },
      { label: 'Delivery Predict.',   path: '/reports/delivery-predictability',    icon: <IconChartDots3 size={17} />,        pageKey: 'delivery_predictability' },
      { label: 'Sprint Retro',        path: '/reports/sprint-retro',               icon: <IconListCheck size={17} />,         pageKey: 'sprint_retro' },
      { label: 'Jira Analytics',      path: '/reports/jira-analytics',             icon: <IconChartInfographic size={17} />,  pageKey: 'jira_analytics' },
      { label: 'Dashboard Builder',   path: '/reports/jira-dashboard-builder',     icon: <IconLayoutDashboard size={17} />,   pageKey: 'jira_dashboard_builder' },
    ],
  },
  // ── SIMULATIONS & TOOLS ────────────────────────────────────────────────────
  {
    label: 'Simulations',
    items: [
      { label: 'Timeline Simulator',  path: '/simulator/timeline',              icon: <IconPlayerPlay size={17} />,    pageKey: 'timeline_simulator' },
      { label: 'Scenario Simulator',  path: '/simulator/scenario',              icon: <IconAdjustments size={17} />,   pageKey: 'scenario_simulator' },
      { label: 'Smart Notifications', path: '/reports/smart-notifications',     icon: <IconBellRinging size={17} />,   pageKey: 'smart_notifications' },
      { label: 'Jira Portfolio Sync', path: '/reports/jira-portfolio-sync',     icon: <IconPlugConnected size={17} />, pageKey: 'jira_portfolio_sync' },
    ],
  },
  // ── ADMIN ──────────────────────────────────────────────────────────────────
  {
    label: 'Admin',
    items: [
      { label: 'Admin Settings',   path: '/settings/org',                     icon: <IconBuildingFactory size={17} />, pageKey: 'org_settings' },
      { label: 'Changelog',        path: '/settings/changelog',               icon: <IconBellRinging size={17} />,    pageKey: 'changelog_admin' },
      { label: 'Custom Fields',    path: '/settings/custom-fields',           icon: <IconAdjustments size={17} />,    pageKey: 'custom_fields_admin' },
    ],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'violet' },
  ADMIN:       { label: 'Admin',       color: 'red' },
  READ_WRITE:  { label: 'Read/Write',  color: 'blue' },
  READ_ONLY:   { label: 'Read Only',   color: 'gray' },
};

export default function AppShellLayout() {
  const [opened, setOpened]                 = useState(true);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [downloading, setDownloading]       = useState(false);
  const [whatsNewOpen,  setWhatsNewOpen]    = useState(false);
  const unreadChangelog = useUnreadChangelogCount();
  const location  = useLocation();
  const navigate  = useNavigate();
  const { setColorScheme }  = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const { username, displayLabel, role, logout, canAccess, isAdmin } = useAuth();
  const { orgSettings } = useOrgSettings();
  const orgPrimary   = orgSettings.primaryColor;
  const orgSecondary = orgSettings.secondaryColor;
  const orgName      = orgSettings.orgName;
  const orgLogoUrl   = orgSettings.logoUrl;
  const isDark = computedColorScheme === 'dark';
  const alerts = useAlertCounts();
  const { opened: searchOpened, setOpened: setSearchOpened } = useGlobalSearch();
  const { opened: shortcutsOpened, setOpened: setShortcutsOpened } = useShortcutsPanel();
  const { sidebarOrder } = useSidebarOrder();

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

  // Apply saved sidebar order, then filter by permissions
  const visibleGroups = useMemo(() => {
    // 1. Start with default groups, apply saved group order
    let orderedGroups = [...navGroups];
    if (sidebarOrder.groupOrder.length > 0) {
      const groupMap = new Map(orderedGroups.map(g => [g.label, g]));
      const sorted: NavGroup[] = [];
      for (const label of sidebarOrder.groupOrder) {
        const g = groupMap.get(label);
        if (g) { sorted.push(g); groupMap.delete(label); }
      }
      for (const g of groupMap.values()) sorted.push(g);
      orderedGroups = sorted;
    }

    // 2. Apply saved item order within each group
    const reordered = orderedGroups.map(group => {
      const savedItems = sidebarOrder.itemOrder[group.label];
      if (!savedItems || savedItems.length === 0) return group;
      const itemMap = new Map(group.items.map(i => [i.label, i]));
      const sorted: NavItem[] = [];
      for (const label of savedItems) {
        const item = itemMap.get(label);
        if (item) { sorted.push(item); itemMap.delete(label); }
      }
      for (const item of itemMap.values()) sorted.push(item);
      return { ...group, items: sorted };
    });

    // 3. Filter by permissions AND feature flags
    return reordered
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          if (item.pageKey === '__admin_only__') return isAdmin;
          // Feature flag check — if flag is explicitly false, hide regardless of role
          if (item.featureFlag && orgSettings.features[item.featureFlag] === false) return false;
          if (!item.pageKey) return true;
          return canAccess(item.pageKey);
        }),
      }))
      .filter(group => group.items.length > 0);
  }, [sidebarOrder, isAdmin, canAccess, orgSettings.features]);

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
        next = Object.fromEntries(allGroupLabels.map(g => [g, g !== label]));
      } else {
        next = { ...prev, [label]: true };
      }
      localStorage.setItem('pp_nav_collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  function isGroupCollapsed(group: typeof visibleGroups[0]): boolean {
    if (group.label === 'Home') return false;
    // If the user has explicitly toggled this group, respect that preference
    if (group.label in collapsedGroups) return collapsedGroups[group.label];
    // Default: all groups open on first load — don't hide sections the user hasn't seen yet
    return false;
  }

  return (
    <MantineAppShell
      header={{ height: 56 }}
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
          background: `linear-gradient(135deg, ${orgSecondary} 0%, #0a1c33 40%, ${orgSecondary} 100%)`,
          borderBottom: `2px solid ${orgPrimary}`,
          boxShadow: `0 4px 24px rgba(12, 35, 64, 0.3), 0 0 0 1px ${orgPrimary}15`,
          backdropFilter: 'blur(20px)',
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
            {/* Logo mark — shows uploaded org logo or default SVG */}
            {orgLogoUrl ? (
              <img
                src={orgLogoUrl}
                alt={orgName}
                style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }}
              />
            ) : (
              <svg
                width="28"
                height="26"
                viewBox="0 0 28 26"
                fill="none"
                className="logo-mark-animated"
              >
                <polygon points="14,1 27,25 1,25" fill="none" stroke={orgPrimary} strokeWidth="2.5" />
                <polygon points="14,7 23,23 5,23"  fill={orgPrimary} opacity="0.3" />
              </svg>
            )}
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: FONT_FAMILY,
                fontWeight: 500,
                fontSize: 15,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}
            >
              {orgName}
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
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: FONT_FAMILY,
                  minWidth: 180,
                }}
                visibleFrom="sm"
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <IconSearch size={14} />
                  <div className="search-ready-indicator" style={{ position: 'absolute', bottom: -2, right: -3, width: 5, height: 5, backgroundColor: orgPrimary, borderRadius: '50%', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                </div>
                <Text size="sm" style={{ flex: 1, color: 'rgba(255,255,255,0.55)', fontFamily: FONT_FAMILY }}>Search…</Text>
                <Kbd size="xs" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', border: 'none', fontFamily: FONT_FAMILY }}>⌘K</Kbd>
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

            {/* What's New button */}
            <Tooltip label="What's New" position="bottom">
              <div style={{ position: 'relative' }}>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => setWhatsNewOpen(true)}
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  <IconBellRinging size={19} />
                </ActionIcon>
                {unreadChangelog > 0 && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#fa5252', pointerEvents: 'none',
                  }} />
                )}
              </div>
            </Tooltip>

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
                    style={{ backgroundColor: orgPrimary, color: '#fff', fontFamily: FONT_FAMILY, fontWeight: 600 }}
                  >
                    {initials}
                  </Avatar>
                  <Text size="sm" style={{ color: '#fff', fontFamily: FONT_FAMILY, fontWeight: 500 }} visibleFrom="sm">
                    {displayLabel}
                  </Text>
                  <IconChevronDown size={14} color="rgba(255,255,255,0.6)" />
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label style={{ fontFamily: FONT_FAMILY }}>
                  Signed in as <strong>{displayLabel}</strong>
                  {displayLabel !== username && (
                    <Text size="xs" c="dimmed" style={{ fontFamily: FONT_FAMILY }}>@{username}</Text>
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
                    onClick={() => navigate('/settings/org?tab=users')}
                    style={{ fontFamily: FONT_FAMILY }}
                  >
                    Manage Users
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  color="red"
                  onClick={handleLogout}
                  style={{ fontFamily: FONT_FAMILY }}
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
          backgroundColor: isDark ? undefined : SURFACE_SIDEBAR,
          borderRight: `1px solid ${isDark ? 'rgba(45, 204, 211, 0.08)' : BORDER_DEFAULT}`,
          boxShadow: isDark ? `1px 0 20px rgba(0, 0, 0, 0.3)` : `1px 0 12px rgba(12, 35, 64, 0.04)`,
        }}
      >
        <MantineAppShell.Section grow component={ScrollArea}>
          {visibleGroups.map((group) => {
            const collapsed = isGroupCollapsed(group);
            const hasActive = group.items.some(item =>
              item.path === '/' ? location.pathname === '/' :
              location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            );
            const allLabels = visibleGroups.map(g => g.label);
            return (
              <div key={group.label} className="nav-group-container">
                {/* Group header — clickable to collapse/expand */}
                <UnstyledButton
                  onClick={() => group.label !== 'Home' && toggleGroup(group.label, allLabels)}
                  style={{
                    width: '100%',
                    padding: '10px 8px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: hasActive ? `1px solid ${orgPrimary}30` : 'none',
                    transition: 'border-color 200ms ease',
                  }}
                >
                  <Text
                    size="xs" fw={700} tt="uppercase"
                    style={{
                      color: hasActive ? DEEP_BLUE : TEXT_SECONDARY,
                      fontFamily: FONT_FAMILY,
                      letterSpacing: '0.8px',
                      fontSize: 10,
                      opacity: 0.65,
                      fontWeight: 700,
                    }}
                  >
                    {group.label}
                  </Text>
                  {group.label !== 'Home' && (
                    <IconChevronRight
                      size={12}
                      style={{
                        color: DEEP_BLUE_TINTS[50],
                        transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                      }}
                    />
                  )}
                </UnstyledButton>

                {/* Nav items — hidden when collapsed */}
                <div
                  style={{
                    overflow: 'hidden',
                    maxHeight: !collapsed ? '1000px' : '0',
                    transition: 'max-height 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  {group.items.map(item => {
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  const rawAlert = item.alertKey ? (alerts[item.alertKey as keyof typeof alerts] ?? 0) : 0;
                  const alertCount = typeof rawAlert === 'number' ? rawAlert : 0;
                  return (
                    <NavLink
                      key={item.path}
                      label={
                        <Group gap={6} justify="space-between" wrap="nowrap">
                          <span>{item.label}</span>
                          {alertCount > 0 && (
                            <Badge size="xs" variant="gradient"
                              gradient={{ from: item.alertKey === 'supportStale' ? 'orange' : 'red', to: item.alertKey === 'supportStale' ? 'yellow' : 'pink' }}
                              style={{ fontSize: 10, minWidth: 18, padding: '0 4px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                              {alertCount}
                            </Badge>
                          )}
                          {item.path === '/projects' && (
                            <Tooltip label="Add project" withArrow position="right">
                              <ActionIcon
                                size={16}
                                variant="subtle"
                                color="teal"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/projects?new=true');
                                }}
                                style={{ opacity: 0.7 }}
                              >
                                <IconPlus size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      }
                      leftSection={item.icon}
                      active={isActive}
                      onClick={() => navigate(item.path)}
                      className="nav-item-enter"
                      style={{
                        borderRadius: 10,
                        fontFamily: FONT_FAMILY,
                        fontWeight: isActive ? 600 : 400,
                        fontSize: 13,
                        borderLeft: isActive ? `3px solid ${orgPrimary}` : 'none',
                        paddingLeft: isActive ? 12 : 15,
                        transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isActive ? 'translateX(2px)' : 'translateX(0)',
                        background: isActive
                          ? `linear-gradient(90deg, ${orgPrimary}15, transparent)`
                          : undefined,
                        boxShadow: isActive
                          ? `inset 3px 0 0 ${orgPrimary}, 0 2px 8px ${orgPrimary}10`
                          : undefined,
                      }}
                      styles={{
                        root: {
                          '--nav-active-bg': `linear-gradient(90deg, ${orgPrimary}10, transparent)`,
                          '--nav-active-color': orgSecondary,
                          '&:hover': {
                            backgroundColor: `${orgPrimary}10`,
                            transform: 'translateX(2px)',
                          },
                        },
                      }}
                      color="deepBlue"
                    />
                  );
                })}
                </div>
              </div>
            );
          })}
        </MantineAppShell.Section>

        {/* Sidebar footer — branding */}
        <MantineAppShell.Section>
          <div style={{
            padding: '12px 8px',
            borderTop: `1px solid ${isDark ? 'rgba(45, 204, 211, 0.08)' : BORDER_DEFAULT}`,
            textAlign: 'center',
            background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(12, 35, 64, 0.02)',
          }}>
            <Text size="xs" c="dimmed" style={{
              fontFamily: FONT_FAMILY,
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: `linear-gradient(90deg, ${orgSecondary}80, ${orgPrimary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
            }}>
              Portfolio Planner v14.4
            </Text>
          </div>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <GlobalBreadcrumb />
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </MantineAppShell.Main>

      <ExcelUploadModal opened={excelModalOpen} onClose={() => setExcelModalOpen(false)} />
      <GlobalSearch opened={searchOpened} onClose={() => setSearchOpened(false)} />
      <KeyboardShortcutsPanel opened={shortcutsOpened} onClose={() => setShortcutsOpened(false)} />
      <TourGuide />
      <FeedbackWidget />
      <WhatsNewDrawer opened={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </MantineAppShell>
  );
}
