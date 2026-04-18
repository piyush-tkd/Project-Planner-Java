import { useState, useCallback, useMemo, Suspense, useEffect } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PageSkeleton from '../common/PageSkeleton';
import ErrorBoundary from '../common/ErrorBoundary';
import { useOrgSettings } from '../../context/OrgSettingsContext';
import { useFavoritesContext } from '../../context/FavoritesContext';
import GlobalSearch, { useGlobalSearch } from '../common/GlobalSearch';
import KeyboardShortcutsPanel, { useShortcutsPanel } from '../common/KeyboardShortcutsPanel';
import { CommandPalette } from '../common/CommandPalette';
import LogoMark from '../common/LogoMark';
import GlobalBreadcrumb from '../common/GlobalBreadcrumb';
import UserPreferencesDrawer from '../common/UserPreferencesDrawer';
import { PPPreferencesPanel } from '../pp';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import GHint from '../common/GHint';
import KeyboardShortcutsModal from '../common/KeyboardShortcutsModal';
import OnboardingWizard from '../onboarding/OnboardingWizard';
import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  Box,
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
  Center,
  Stack,
  Title,
} from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconBriefcase,
  IconHexagons,
  IconChartBar,
  IconFlame,
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
  IconBrandAzure,
  IconSun,
  IconMoon,
  IconLogout,
  IconChevronDown,
  IconTag,
  IconCurrencyDollar,
  IconUserCog,
  IconSearch,
  IconHistory,
  IconChevronRight,
  IconCoin,
  IconHeartRateMonitor,
  IconLink,
  IconBulb,
  IconClock,
  IconRocket,
  IconBrain,
  IconLayoutDashboard,
  IconTrendingUp,
  IconShieldCheck,
  IconTimeline,
  IconPlugConnected,
  IconReportMoney,
  IconChartDots3,
  IconBellRinging,
  IconCalendarOff,
  IconInbox,
  IconPlus,
  IconRadar,
  IconStars,
  IconListCheck,
  IconFlame as _IconFlameAlias,
  IconSparkles,
  IconBellCog,
  IconLayoutBoard,
  IconLayoutGrid,
  IconStar,
  IconStarFilled,
  IconWebhook,
  IconMailCog,
  IconTableOptions,
  IconWand,
  IconHelp,
  IconSitemap,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import NotificationBell from '../common/NotificationBell';
import TourGuide from '../common/TourGuide';
import FeedbackWidget from '../common/FeedbackWidget';
import WhatsNewDrawer, { useUnreadChangelogCount } from '../common/WhatsNewDrawer';
import ActivityFeedDrawer from '../common/ActivityFeedDrawer';
import { useAuth } from '../../auth/AuthContext';
import _apiClient from '../../api/client';
import { useAlertCounts } from '../../hooks/useAlertCounts';
import { useSidebarOrder } from '../../api/widgetPreferences';
import { AQUA, BORDER_DEFAULT, COLOR_AMBER_DARK, COLOR_ERROR, COLOR_WARNING, DARK_ELEMENT, DARK_TEXT_PRIMARY, DEEP_BLUE_TINTS, FONT_FAMILY, SURFACE_SIDEBAR, TEXT_GRAY, TEXT_SECONDARY, TEXT_SUBTLE } from '../../brandTokens';

interface NavItem  { label: string; path: string; icon: React.ReactNode; pageKey?: string; alertKey?: string; featureFlag?: string; children?: NavItem[] }
interface NavGroup { label: string; items: NavItem[] }

// ── v30.1: Final nav — 6 sections, Jira subsection in Delivery, 3 focused Admin groups
const navGroups: NavGroup[] = [
  // ── WORKSPACE ─────────────────────────────────────────────────────────────
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard',         path: '/',                 icon: <IconDashboard size={14} />,  pageKey: 'dashboard' },
      { label: 'Inbox',             path: '/inbox',            icon: <IconInbox size={14} />,      pageKey: 'inbox' },
      { label: 'Ask AI',            path: '/nlp',              icon: <IconBrain size={14} />,      pageKey: 'nlp_landing',       featureFlag: 'ai' },
      { label: 'AI Content Studio', path: '/ai-content-studio',icon: <IconWand size={14} />,       pageKey: 'ai_content_studio', featureFlag: 'ai' },
      { label: 'Smart Insights',    path: '/smart-insights',   icon: <IconSparkles size={14} />,   pageKey: 'smart_insights' },
    ],
  },

  // ── PORTFOLIO ─────────────────────────────────────────────────────────────
  {
    label: 'Portfolio',
    items: [
      { label: 'Projects',          path: '/projects',                  icon: <IconBriefcase size={14} />,       pageKey: 'projects' },
      { label: 'Portfolio Health',  path: '/portfolio/health',          icon: <IconShieldCheck size={14} />,     pageKey: 'portfolio_health_dashboard' },
      { label: 'Executive Summary', path: '/reports/executive-summary', icon: <IconLayoutDashboard size={14} />, pageKey: 'exec_summary' },
      { label: 'Timeline',          path: '/portfolio/timeline',        icon: <IconChartAreaLine size={14} />,   pageKey: 'portfolio_timeline' },
      { label: 'Risk & Issues',     path: '/risk-register',             icon: <IconRadar size={14} />,           pageKey: 'risk_register',   featureFlag: 'risk' },
      { label: 'Risk Heatmap',      path: '/reports/risk-heatmap',      icon: <IconChartDots3 size={14} />,      pageKey: 'risk_heatmap' },
      { label: 'Dependencies',      path: '/reports/dependency-map',    icon: <IconLink size={14} />,            pageKey: 'dependency_map' },
      { label: 'Objectives',        path: '/objectives',                icon: <IconTargetArrow size={14} />,     pageKey: 'objectives',      featureFlag: 'okr' },
    ],
  },

  // ── PEOPLE ────────────────────────────────────────────────────────────────
  {
    label: 'People',
    items: [
      { label: 'People',             path: '/people/resources',  icon: <IconUsers size={14} />,            pageKey: 'resources' },
      { label: 'Capacity',           path: '/people/capacity',   icon: <IconFlame size={14} />,            pageKey: 'capacity_hub' },
      { label: 'Performance',        path: '/people/performance',icon: <IconTrendingUp size={14} />,       pageKey: 'resource_performance', featureFlag: 'advanced_people' },
      { label: 'Skills Matrix',      path: '/skills-matrix',     icon: <IconStars size={14} />,            pageKey: 'skills_matrix_new',    featureFlag: 'advanced_people' },
      { label: 'Team Pulse',         path: '/reports/team-pulse',icon: <IconHeartRateMonitor size={14} />, pageKey: 'team_pulse',           featureFlag: 'advanced_people' },
      { label: 'Workforce Planning', path: '/demand-forecast',   icon: <IconChartBar size={14} />,         pageKey: 'demand_forecast' },
      { label: 'Leave Hub',          path: '/leave',             icon: <IconCalendarOff size={14} />,      pageKey: 'leave_hub' },
    ],
  },

  // ── DELIVERY ──────────────────────────────────────────────────────────────
  {
    label: 'Delivery',
    items: [
      { label: 'PODs',             path: '/pods',            icon: <IconHexagons size={14} />,    pageKey: 'pods' },
      { label: 'Sprint Planner',   path: '/sprint-planner',  icon: <IconBrain size={14} />,       pageKey: 'sprint_planner' },
      { label: 'Engineering Hub',      path: '/engineering/hub',                    icon: <IconReportMoney size={14} />, pageKey: 'engineering_intelligence',  featureFlag: 'engineering' },
      { label: 'Engineering Analytics', path: '/reports/engineering-analytics',      icon: <IconChartBar size={14} />,    pageKey: 'engineering_analytics',     featureFlag: 'engineering' },
      { label: 'Power Dashboard',   path: '/reports/power-dashboard',             icon: <IconLayoutGrid size={14} />,  pageKey: 'power_dashboard' },
      { label: 'Calendar',         path: '/calendar',        icon: <IconCalendar size={14} />,    pageKey: 'calendar_hub' },
      { label: 'Ideas Board',      path: '/ideas',           icon: <IconBulb size={14} />,        pageKey: 'ideas_board' },
      // ── Jira subsection ───────────────────────────────────────────────────
      {
        label: 'Jira', path: '/sprint-backlog', icon: <IconLayoutBoard size={14} />, pageKey: 'sprint_backlog', featureFlag: 'jira',
        children: [
          { label: 'Sprint Backlog',    path: '/sprint-backlog',                 icon: <IconLayoutBoard size={14} />,    pageKey: 'sprint_backlog',        featureFlag: 'jira' },
          { label: 'Sprint Retro',      path: '/reports/sprint-retro',           icon: <IconListCheck size={14} />,      pageKey: 'sprint_retro',          featureFlag: 'jira' },
          { label: 'POD Dashboard',     path: '/delivery/jira',                  icon: <IconUsersGroup size={14} />,     pageKey: 'jira_pods',             featureFlag: 'jira', alertKey: 'supportStale' },
          { label: 'Dashboard Builder', path: '/reports/jira-dashboard-builder', icon: <IconLayoutDashboard size={14} />,pageKey: 'jira_dashboard_builder', featureFlag: 'jira' },
          { label: 'Releases',          path: '/delivery/releases',              icon: <IconTag size={14} />,            pageKey: 'jira_releases',         featureFlag: 'jira' },
          { label: 'Resource Mapping',  path: '/settings/jira-resource-mapping', icon: <IconUsersGroup size={14} />,     pageKey: 'jira_resource_mapping', featureFlag: 'jira' },
          { label: 'Release Mapping',   path: '/settings/jira-release-mapping',  icon: <IconTag size={14} />,            pageKey: 'jira_release_mapping',  featureFlag: 'jira' },
          { label: 'Support Boards',    path: '/settings/support-boards',        icon: <IconListCheck size={14} />,      pageKey: 'support_boards_admin',  featureFlag: 'jira' },
        ],
      },
    ],
  },

  // ── FINANCE ───────────────────────────────────────────────────────────────
  {
    label: 'Finance',
    items: [
      { label: 'Budget & CapEx',        path: '/reports/budget-capex',  icon: <IconCurrencyDollar size={14} />, pageKey: 'budget_capex',         featureFlag: 'financials' },
      { label: 'Engineering Economics', path: '/engineering-economics', icon: <IconCoin size={14} />,           pageKey: 'engineering_economics' },
      { label: 'ROI Calculator',        path: '/roi-calculator',        icon: <IconChartPie size={14} />,       pageKey: 'roi_calculator' },
      { label: 'Scenario Planning',     path: '/scenario-planning',     icon: <IconAdjustments size={14} />,    pageKey: 'scenario_planning', featureFlag: 'simulations' },
    ],
  },

  // ── ADMIN — 4 pinned + 3 focused expandable groups ────────────────────────
  {
    label: 'Admin',
    items: [
      { label: 'Users',             path: '/settings/users',          icon: <IconUsers size={14} />,         pageKey: 'user_management' },
      { label: 'Quality Config',    path: '/settings/quality-config', icon: <IconShieldCheck size={14} />,   pageKey: 'quality_config' },
      { label: 'Automation Engine', path: '/automation-engine',       icon: <IconPlayerPlay size={14} />,    pageKey: 'automation_engine' },
      { label: 'Jira Credentials',  path: '/settings/jira-credentials',icon: <IconPlugConnected size={14} />,pageKey: 'jira_credentials', featureFlag: 'jira' },

      // Organisation settings
      {
        label: 'Organisation', path: '/settings/org', icon: <IconSettings size={14} />, pageKey: 'org_settings',
        children: [
          { label: 'General',            path: '/settings/org',                      icon: <IconSettings size={15} />,      pageKey: 'org_settings' },
          { label: 'Email Templates',    path: '/settings/email-templates',          icon: <IconMailCog size={15} />,       pageKey: 'email_templates' },
          { label: 'Notification Prefs', path: '/settings/notification-preferences', icon: <IconBellCog size={15} />,       pageKey: 'notification_preferences' },
          { label: 'Cost Rates',         path: '/settings/cost-rates',               icon: <IconTableOptions size={15} />,  pageKey: 'cost_rates' },
          { label: 'Custom Fields',      path: '/settings/custom-fields',            icon: <IconAdjustments size={15} />,   pageKey: 'custom_fields_admin' },
          { label: 'Reference Data',     path: '/settings/ref-data',                 icon: <IconDatabase size={15} />,      pageKey: 'ref_data' },
          { label: 'Webhooks',           path: '/settings/webhooks',                 icon: <IconWebhook size={15} />,       pageKey: 'webhook_settings' },
          { label: 'Timeline Settings',  path: '/settings/timeline',                 icon: <IconTimeline size={15} />,      pageKey: 'timeline_settings' },
          { label: 'Release Settings',   path: '/settings/releases',                 icon: <IconTag size={15} />,           pageKey: 'release_settings' },
          { label: 'Azure DevOps',       path: '/settings/azure-devops',             icon: <IconBrandAzure size={15} />,    pageKey: 'azure_devops_settings' },
          { label: 'Feedback Hub',       path: '/settings/feedback-hub',             icon: <IconBulb size={15} />,          pageKey: 'feedback_hub' },
        ],
      },

      // AI & Intelligence settings
      {
        label: 'AI & Intelligence', path: '/settings/my-ai', icon: <IconBrain size={14} />, pageKey: 'my_ai_settings', featureFlag: 'ai',
        children: [
          { label: 'AI Settings',         path: '/settings/my-ai',          icon: <IconBrain size={15} />,       pageKey: 'my_ai_settings' },
          { label: 'NLP Optimizer',       path: '/settings/nlp-optimizer',  icon: <IconRocket size={15} />,      pageKey: 'nlp_optimizer',   featureFlag: 'ai' },
          { label: 'Smart Mapping',       path: '/settings/smart-mapping',  icon: <IconSparkles size={15} />,    pageKey: 'smart_mapping',   featureFlag: 'ai' },
          { label: 'Smart Notifications', path: '/reports/smart-notifications', icon: <IconBellRinging size={15} />, pageKey: 'smart_notifications', featureFlag: 'ai' },
        ],
      },

      // Developer tools
      {
        label: 'Developer Tools', path: '/settings/audit-log', icon: <IconDatabase size={14} />, pageKey: 'audit_log',
        children: [
          { label: 'Audit Log',     path: '/settings/audit-log',    icon: <IconHistory size={15} />,       pageKey: 'audit_log' },
          { label: 'Error Logs',    path: '/settings/error-log',    icon: <IconAlertTriangle size={15} />, pageKey: 'error_log' },
          { label: 'DB Tables',     path: '/settings/tables',       icon: <IconDatabase size={15} />,      pageKey: 'tables_admin' },
          { label: 'Sidebar Order', path: '/settings/sidebar-order',icon: <IconAdjustments size={15} />,  pageKey: 'sidebar_order' },
          { label: 'Sitemap',       path: '/settings/sitemap',      icon: <IconSitemap size={15} />,       pageKey: 'sitemap' },
          { label: 'Changelog',     path: '/settings/changelog',    icon: <IconHistory size={15} />,       pageKey: 'changelog_admin' },
        ],
      },
    ],
  },
];

// PP-13 §4: G+key shortcut hints shown on nav items — teaches keyboard navigation
// Keys match useKeyboardNav.ts SHORTCUTS map
const NAV_SHORTCUTS: Record<string, string> = {
  '/':                      'G+D',
  '/projects':              'G+P',
  '/people/resources':      'G+R',
  '/pods':                  'G+O',
  '/people/capacity':       'G+C',
  '/financial-intelligence':'G+B',
  '/settings/org':          'G+S',
  '/nlp':                   'G+I',
  '/engineering/hub':       'G+E',
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'violet' },
  ADMIN:       { label: 'Admin',       color: 'red' },
  READ_WRITE:  { label: 'Read/Write',  color: 'blue' },
  READ_ONLY:   { label: 'Read Only',   color: 'gray' },
};

export default function AppShellLayout() {
  const [opened, setOpened]                 = useState(true);
  const [navFilter, setNavFilter]           = useState('');
  const [whatsNewOpen,  setWhatsNewOpen]    = useState(false);
  const [activityOpen,  setActivityOpen]    = useState(false);
  const [prefsOpen,     setPrefsOpen]       = useState(false);
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
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  const alerts = useAlertCounts();
  const { opened: searchOpened, setOpened: setSearchOpened } = useGlobalSearch();
  const { opened: shortcutsOpened, setOpened: setShortcutsOpened } = useShortcutsPanel();
  const { sidebarOrder } = useSidebarOrder();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Initialize onboarding state on mount
  useEffect(() => {
    const isComplete = localStorage.getItem('pp_onboarding_complete');
    setShowOnboarding(!isComplete);
  }, []);

  // Apply org theming CSS variables
  useEffect(() => {
    if (orgPrimary) {
      document.documentElement.style.setProperty('--pp-primary', orgPrimary);
    }
    if (orgSecondary) {
      document.documentElement.style.setProperty('--pp-secondary', orgSecondary);
    }
  }, [orgPrimary, orgSecondary]);

  // Keyboard navigation hooks
  const { showHint } = useKeyboardNav(
    () => setPaletteOpen(true),
    () => setShowShortcutsModal(true)
  );

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

  // ── Sidebar Favorites — backend-synced via FavoritesContext ──────────────
  const { favorites: favEntries, toggle: toggleFavorite } = useFavoritesContext();
  // Derive a Set<path> for O(1) membership checks used throughout the nav render
  const favorites = useMemo(() => new Set(favEntries.map(f => f.pagePath)), [favEntries]);

  // ── Recent pages (S7 gap) ────────────────────────────────────────────────
  const RECENT_NAV_KEY = 'pp_recent_pages';
  const MAX_RECENT_NAV = 3;
  interface RecentEntry { id: string; label: string; path: string }
  const [recentPages, setRecentPages] = useState<RecentEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_NAV_KEY) ?? '[]').slice(0, MAX_RECENT_NAV); }
    catch { return []; }
  });

  // Refresh recent list whenever location changes
  useEffect(() => {
    try {
      const list: RecentEntry[] = JSON.parse(localStorage.getItem(RECENT_NAV_KEY) ?? '[]');
      setRecentPages(list.slice(0, MAX_RECENT_NAV));
    } catch { /* ignore */ }
  }, [location.pathname]);

  // Wire ⌘\ → toggle sidebar via custom event
  useEffect(() => {
    function handleToggle() { setOpened(o => !o); }
    window.addEventListener('pp-toggle-sidebar', handleToggle);
    return () => window.removeEventListener('pp-toggle-sidebar', handleToggle);
  }, []);

  // Wire ⌘K → open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Color scheme is persisted by Mantine itself in 'mantine-color-scheme' localStorage key.
  // PPPreferencesPanel calls useMantineColorScheme().setColorScheme() to change AND persist it.
  // No extra restoration effect needed here — Mantine handles it automatically.

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
    if (group.label === 'Overview' || group.label === 'Home') return false;
    // If the user has explicitly toggled this group, respect that preference
    if (group.label in collapsedGroups) return collapsedGroups[group.label];
    // Default: collapse all groups except the one containing the current route
    const containsActive = group.items.some(i => i.path === location.pathname || (i.children && i.children.some(c => c.path === location.pathname)));
    return !containsActive;
  }

  // 5.6 Option A — desktop-only guard: politely block sub-1024px viewports
  if (isNarrow) {
    return (
      <Center style={{ minHeight: '100dvh', padding: '2rem' }}>
        <Stack align="center" gap="lg" maw={400} ta="center">
          <IconDeviceDesktop size={56} stroke={1.2} color="var(--mantine-color-dimmed)" />
          <Title order={3} fw={600}>Desktop required</Title>
          <Text c="dimmed" size="sm">
            Project Planner is optimised for desktop use. Please open this app on a screen
            wider than 1,024 px.
          </Text>
        </Stack>
      </Center>
    );
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
      {/* Skip-to-main-content — visually hidden until focused; §5.5 a11y */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
          zIndex: 9999,
        }}
        onFocus={e => {
          e.currentTarget.style.left = '50%';
          e.currentTarget.style.top = '8px';
          e.currentTarget.style.transform = 'translateX(-50%)';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.overflow = 'visible';
          e.currentTarget.style.padding = '8px 16px';
          e.currentTarget.style.background = isDark ? '#1a1d27' : '#fff';
          e.currentTarget.style.color = isDark ? AQUA : DEEP_BLUE_TINTS[80];
          e.currentTarget.style.borderRadius = '8px';
          e.currentTarget.style.border = `2px solid ${AQUA}`;
          e.currentTarget.style.fontFamily = FONT_FAMILY;
          e.currentTarget.style.fontWeight = '600';
          e.currentTarget.style.fontSize = '14px';
          e.currentTarget.style.textDecoration = 'none';
        }}
        onBlur={e => {
          e.currentTarget.style.left = '-9999px';
          e.currentTarget.style.top = 'auto';
          e.currentTarget.style.transform = '';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
          e.currentTarget.style.overflow = 'hidden';
          e.currentTarget.style.padding = '';
        }}
      >
        Skip to main content
      </a>
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
              <LogoMark size={28} className="logo-mark-animated" />
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

          {/* Center: ⌘K search bar — PP-13 §3: persistent, always-visible affordance */}
          <Box visibleFrom="sm" style={{ flex: 1, maxWidth: 320, padding: '0 12px' }}>
            <UnstyledButton
              onClick={() => setPaletteOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(45,204,211,0.18)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(45,204,211,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
              }}
            >
              <IconSearch size={14} color="rgba(255,255,255,0.6)" style={{ flexShrink: 0 }} />
              <Text style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: FONT_FAMILY }}>
                Search pages, projects, people…
              </Text>
              <Kbd style={{
                fontSize: 10,
                padding: '1px 6px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.5)',
                borderRadius: 4,
                flexShrink: 0,
              }}>⌘K</Kbd>
            </UnstyledButton>
          </Box>

          {/* Right: actions + user menu */}
          <Group gap={6}>
            <NotificationBell />

            {/* Activity Feed button */}
            <Tooltip label="Activity Feed" position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => setActivityOpen(true)}
                style={{ color: 'rgba(255,255,255,0.75)' }}
                aria-label="History"
              >
                <IconHistory size={19} />
              </ActionIcon>
            </Tooltip>

            {/* What's New button */}
            <Tooltip label="What's New" position="bottom">
              <div style={{ position: 'relative' }}>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => setWhatsNewOpen(true)}
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                  aria-label="Notifications"
                >
                  <IconBellRinging size={19} />
                </ActionIcon>
                {unreadChangelog > 0 && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 8, height: 8, borderRadius: '50%',
                    background: COLOR_ERROR, pointerEvents: 'none',
                  }} />
                )}
              </div>
            </Tooltip>

            <Tooltip label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
                style={{ color: 'rgba(255,255,255,0.75)' }}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
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
                <Menu.Item
                  leftSection={<IconSettings size={16} />}
                  onClick={() => setPrefsOpen(true)}
                  style={{ fontFamily: FONT_FAMILY }}
                >
                  Display Preferences
                </Menu.Item>
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
        style={{
          backgroundColor: isDark ? '#0a0a0f' : SURFACE_SIDEBAR,
          borderRight: isDark ? '1px solid rgba(46, 51, 70, 0.5)' : `1px solid ${BORDER_DEFAULT}`,
          boxShadow: isDark ? `1px 0 20px rgba(0, 0, 0, 0.4)` : `1px 0 12px rgba(12, 35, 64, 0.04)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Pinned search bar — stays fixed while nav items scroll ── */}
        <MantineAppShell.Section style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 8px',
            borderRadius: 6,
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
          }}>
            <IconSearch size={11} color={isDark ? '#6b7280' : TEXT_SUBTLE} style={{ flexShrink: 0 }} />
            <input
              value={navFilter}
              onChange={e => setNavFilter(e.target.value)}
              placeholder="Filter pages..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                fontFamily: FONT_FAMILY,
                color: isDark ? '#c9cdd4' : DARK_TEXT_PRIMARY,
                minWidth: 0,
              }}
            />
            {navFilter && (
              <button
                onClick={() => setNavFilter('')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center',
                  color: isDark ? '#6b7280' : TEXT_SUBTLE, fontSize: 14, lineHeight: 1,
                }}
              >×</button>
            )}
          </div>
        </MantineAppShell.Section>

        {/* ── Scrollable nav items — flex: 1 + minHeight: 0 forces proper scroll constraint ── */}
        <MantineAppShell.Section grow component={ScrollArea} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* ── Filtered flat view ── */}
          {navFilter.trim() && (() => {
            const q = navFilter.trim().toLowerCase();
            const matches: Array<{ item: typeof visibleGroups[0]['items'][0]; groupLabel: string }> = [];
            for (const group of visibleGroups) {
              for (const item of group.items) {
                if (item.label.toLowerCase().includes(q)) {
                  matches.push({ item, groupLabel: group.label });
                }
                if (item.children) {
                  for (const child of item.children) {
                    if (child.label.toLowerCase().includes(q)) {
                      matches.push({ item: child, groupLabel: group.label });
                    }
                  }
                }
              }
            }
            if (matches.length === 0) {
              return (
                <Text size="xs" style={{ padding: '12px 14px', color: isDark ? '#5a5e70' : TEXT_SUBTLE, fontFamily: FONT_FAMILY, fontStyle: 'italic' }}>
                  No pages match "{navFilter}"
                </Text>
              );
            }
            return (
              <div style={{ paddingBottom: 4 }}>
                {matches.map(({ item }) => {
                  const isActive = item.path.includes('?')
                    ? location.pathname + location.search === item.path
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  return (
                    <NavLink
                      key={item.path}
                      label={<span style={{ fontFamily: FONT_FAMILY, fontSize: 13 }}>{item.label}</span>}
                      leftSection={item.icon}
                      active={isActive}
                      onClick={() => { navigate(item.path); setNavFilter(''); }}
                      style={{
                        borderRadius: 6,
                        borderLeft: isActive ? `3px solid ${isDark ? AQUA : orgPrimary}` : '3px solid transparent',
                        paddingLeft: isActive ? 12 : 15,
                        color: isDark ? (isActive ? AQUA : '#6a6a80') : undefined,
                        background: isActive ? (isDark ? 'rgba(45,204,211,0.10)' : `linear-gradient(90deg, ${orgPrimary}15, transparent)`) : undefined,
                        transition: 'all 150ms ease',
                      }}
                    />
                  );
                })}
              </div>
            );
          })()}

          {/* ── Normal view (hidden when filter is active) ── */}
          {!navFilter.trim() && <>
          {/* ── Starred Favorites — backend-synced ── */}
          {(() => {
            // Build icon lookup from visible nav groups
            const iconByPath = new Map<string, React.ReactNode>();
            for (const group of visibleGroups) {
              for (const item of group.items) {
                iconByPath.set(item.path, item.icon);
              }
            }
            return (
              <div className="nav-group-container" style={{ marginBottom: 4 }}>
                <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconStarFilled size={10} color={isDark ? COLOR_WARNING : COLOR_AMBER_DARK} />
                  <Text size="xs" fw={700} tt="uppercase"
                    style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, fontSize: 9, color: isDark ? '#5a5e70' : TEXT_SECONDARY }}>
                    Favorites
                  </Text>
                </div>
                {favEntries.length === 0 ? (
                  <Text size="xs" style={{
                    padding: '4px 12px 8px',
                    fontSize: 11,
                    color: isDark ? '#5a5e70' : TEXT_SECONDARY,
                    fontStyle: 'italic',
                  }}>
                    Pin your most-used pages ★
                  </Text>
                ) : (
                  favEntries.map(fav => {
                    const isActive = fav.pagePath === '/'
                      ? location.pathname === '/'
                      : location.pathname === fav.pagePath || location.pathname.startsWith(fav.pagePath + '/');
                    return (
                      <NavLink
                        key={`fav-${fav.pagePath}`}
                        label={
                          <Group gap={6} justify="space-between" wrap="nowrap">
                            <span style={{ fontFamily: FONT_FAMILY, fontSize: 13, color: isDark ? (isActive ? AQUA : '#6a6a80') : undefined }}>
                              {fav.pageLabel}
                            </span>
                            <ActionIcon
                              size="xs"
                              variant="transparent"
                              onClick={e => { e.stopPropagation(); e.preventDefault(); toggleFavorite(fav.pagePath, fav.pageLabel); }}
                              style={{ color: COLOR_WARNING, opacity: 0.8 }}
                              aria-label="Favourite"
                            >
                              <IconStarFilled size={11} />
                            </ActionIcon>
                          </Group>
                        }
                        leftSection={iconByPath.get(fav.pagePath)}
                        active={isActive}
                        onClick={() => navigate(fav.pagePath)}
                        style={{
                          borderRadius: 6,
                          fontWeight: isActive ? 500 : 400,
                          fontSize: 13,
                          color: isDark ? (isActive ? AQUA : '#6a6a80') : undefined,
                          background: isActive ? (isDark ? 'rgba(45,204,211,0.10)' : `linear-gradient(90deg, ${orgPrimary}15, transparent)`) : undefined,
                          borderLeft: isActive ? `3px solid ${isDark ? AQUA : orgPrimary}` : 'none',
                          paddingLeft: isActive ? 12 : 15,
                        }}
                      />
                    );
                  })
                )}
                <Divider my={4} style={{ opacity: 0.3, borderColor: isDark ? DARK_ELEMENT : undefined }} />
              </div>
            );
          })()}

          {/* ── Recent Pages (S7 gap) ── */}
          {recentPages.length > 0 && (
            <div className="nav-group-container" style={{ marginBottom: 4 }}>
              <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconHistory size={10} color={isDark ? AQUA : TEXT_GRAY} />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed"
                  style={{ letterSpacing: '0.08em', fontFamily: FONT_FAMILY, fontSize: 9 }}>
                  Recent
                </Text>
              </div>
              {recentPages.map(entry => {
                const isActive = location.pathname === entry.path;
                return (
                  <NavLink
                    key={`recent-${entry.id}`}
                    label={<span style={{ fontFamily: FONT_FAMILY, fontSize: 13 }}>{entry.label}</span>}
                    leftSection={<IconClock size={14} color={isDark ? AQUA : TEXT_GRAY} />}
                    active={isActive}
                    onClick={() => navigate(entry.path)}
                    style={{
                      borderRadius: 10,
                      fontFamily: FONT_FAMILY,
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 13,
                      borderLeft: isActive ? `3px solid ${orgPrimary}` : 'none',
                      paddingLeft: isActive ? 12 : 15,
                    }}
                  />
                );
              })}
              <Divider my={4} style={{ opacity: 0.4 }} />
            </div>
          )}

          {visibleGroups.map((group) => {
            const collapsed = isGroupCollapsed(group);
            const hasActive = group.items.some(item => {
              if (item.path === '/') return location.pathname === '/';
              const selfMatch = item.path.includes('?')
                ? location.pathname + location.search === item.path
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              if (selfMatch) return true;
              // Also check children
              return !!item.children?.some(c =>
                c.path.includes('?')
                  ? location.pathname + location.search === c.path
                  : location.pathname === c.path
              );
            });
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
                      // DL-6: group labels always muted, not tied to active state
                      color: isDark ? '#5a5e70' : TEXT_SECONDARY,
                      fontFamily: FONT_FAMILY,
                      letterSpacing: '0.8px',
                      fontSize: 10,
                      fontWeight: 600,
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
                    : item.path.includes('?')
                      ? location.pathname + location.search === item.path
                      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

                  // For items with children: parent is active when on its path OR any child path
                  const hasActiveChild = !!item.children?.some(c =>
                    c.path.includes('?')
                      ? location.pathname + location.search === c.path
                      : location.pathname === c.path
                  );
                  const parentActive = isActive || hasActiveChild;

                  const rawAlert = item.alertKey ? (alerts[item.alertKey as keyof typeof alerts] ?? 0) : 0;
                  const alertCount = typeof rawAlert === 'number' ? rawAlert : 0;

                  const navItemStyle = (active: boolean, indent = false) => ({
                    // DL-6: dark mode specific colours
                    borderRadius: isDark ? 6 : 10,
                    fontFamily: FONT_FAMILY,
                    fontWeight: active ? 500 : 400,
                    fontSize: indent ? 12 : 13,
                    color: isDark
                      ? (active ? AQUA : '#6a6a80')
                      : undefined,
                    borderLeft: active
                      ? `3px solid ${isDark ? AQUA : orgPrimary}`
                      : '3px solid transparent',
                    paddingLeft: active ? (indent ? 24 : 12) : (indent ? 27 : 15),
                    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                    background: active
                      ? (isDark ? 'rgba(45,204,211,0.10)' : `linear-gradient(90deg, ${orgPrimary}15, transparent)`)
                      : undefined,
                    boxShadow: active && !isDark ? `0 2px 8px ${orgPrimary}10` : undefined,
                  });

                  const isFav = favorites.has(item.path);
                  // PP-13 §4: G+key shortcut hint shown at low opacity beside nav label
                  const navShortcut = NAV_SHORTCUTS[item.path];
                  return (
                    <NavLink
                      key={item.path}
                      label={
                        <Group gap={6} justify="space-between" wrap="nowrap">
                          <Group gap={5} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            {navShortcut && (
                              <Kbd
                                className="nav-kbd-hint"
                                style={{
                                  fontSize: 8,
                                  padding: '0 3px',
                                  lineHeight: '14px',
                                  opacity: 0.35,
                                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
                                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.15)',
                                  color: isDark ? '#6b7280' : TEXT_SUBTLE,
                                  borderRadius: 3,
                                  flexShrink: 0,
                                  transition: 'opacity 150ms ease',
                                }}
                              >{navShortcut}</Kbd>
                            )}
                          </Group>
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
                                aria-label="Add"
                              >
                                <IconPlus size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          <ActionIcon
                            size={14}
                            variant="transparent"
                            onClick={e => { e.stopPropagation(); e.preventDefault(); toggleFavorite(item.path, item.label); }}
                            className="nav-star-btn"
                            style={{
                              color: isFav ? COLOR_WARNING : 'var(--mantine-color-dimmed)',
                              opacity: isFav ? 1 : 0.25,
                              transition: 'opacity 0.15s',
                              flexShrink: 0,
                            }}
                            aria-label="Favourite"
                          >
                            {isFav ? <IconStarFilled size={11} /> : <IconStar size={11} />}
                          </ActionIcon>
                        </Group>
                      }
                      leftSection={item.icon}
                      active={item.children ? parentActive : isActive}
                      defaultOpened={item.children ? parentActive : undefined}
                      onClick={() => navigate(item.path)}
                      className="nav-item-enter"
                      style={navItemStyle(item.children ? parentActive : isActive)}
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
                    >
                      {item.children?.map(child => {
                        const isChildActive = child.path.includes('?')
                          ? location.pathname + location.search === child.path
                          : location.pathname === child.path;
                        return (
                          <NavLink
                            key={child.path}
                            label={child.label}
                            leftSection={child.icon}
                            active={isChildActive}
                            onClick={e => { e.stopPropagation(); navigate(child.path); }}
                            style={navItemStyle(isChildActive, true)}
                          />
                        );
                      })}
                    </NavLink>
                  );
                })}
                </div>
              </div>
            );
          })}
          </>}
        </MantineAppShell.Section>

        {/* Sidebar footer — branding + ⌘K hint (DL-6) */}
        <MantineAppShell.Section>
          <div style={{
            padding: '10px 10px 8px',
            borderTop: isDark ? '1px solid #1a1d27' : `1px solid ${BORDER_DEFAULT}`,
            background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(12, 35, 64, 0.02)',
          }}>
            {/* Footer row: ⌘K search hint + ? shortcuts button — PP-13 §3 §4 */}
            <Group gap={6} mb={6} wrap="nowrap">
              <Tooltip label="Search or jump to any page (⌘K)" withArrow position="top" style={{ flex: 1 }}>
                <UnstyledButton
                  onClick={() => setPaletteOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 8,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                    transition: 'background 150ms ease, border-color 150ms ease',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(45,204,211,0.1)' : 'rgba(45,204,211,0.08)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = isDark ? 'rgba(45,204,211,0.3)' : 'rgba(45,204,211,0.4)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
                  }}
                >
                  <IconSearch size={13} color={isDark ? '#6b7280' : TEXT_SUBTLE} />
                  <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#8b9ab3' : TEXT_GRAY, fontFamily: FONT_FAMILY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search…</Text>
                  <Kbd style={{ fontSize: 9, padding: '1px 5px', background: isDark ? 'rgba(46,51,70,0.8)' : 'rgba(0,0,0,0.06)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)', color: isDark ? '#6b7280' : TEXT_SUBTLE, flexShrink: 0 }}>⌘K</Kbd>
                </UnstyledButton>
              </Tooltip>

              {/* PP-13 §4: ? shortcut button — teaches keyboard shortcuts panel */}
              <Tooltip label={<><strong>Keyboard shortcuts</strong> — press <Kbd size="xs">?</Kbd> anywhere</>} withArrow position="top">
                <ActionIcon
                  variant="default"
                  size={32}
                  radius={8}
                  onClick={() => setShowShortcutsModal(true)}
                  style={{
                    flexShrink: 0,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                    color: isDark ? '#6b7280' : TEXT_SUBTLE,
                  }}
                  aria-label="Help"
                >
                  <IconHelp size={15} />
                </ActionIcon>
              </Tooltip>
            </Group>
            {/* Version */}
            <Text size="xs" c="dimmed" style={{
              fontFamily: FONT_FAMILY,
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textAlign: 'center',
              background: isDark ? undefined : `linear-gradient(90deg, ${orgSecondary}80, ${orgPrimary})`,
              color: isDark ? '#3a3e52' : undefined,
              WebkitBackgroundClip: isDark ? undefined : 'text',
              WebkitTextFillColor: isDark ? undefined : 'transparent',
              fontWeight: 700,
            }}>
              Portfolio Planner v30.1
            </Text>
          </div>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main id="main-content">
        <GlobalBreadcrumb />
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageSkeleton variant="table" />}>
            <div className="page-transition">
              <Outlet />
            </div>
          </Suspense>
        </ErrorBoundary>
      </MantineAppShell.Main>

      <GlobalSearch opened={searchOpened} onClose={() => setSearchOpened(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsPanel opened={shortcutsOpened} onClose={() => setShortcutsOpened(false)} />
      <UserPreferencesDrawer opened={false} onClose={() => {}} />
      <PPPreferencesPanel opened={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <TourGuide />
      <FeedbackWidget />
      <WhatsNewDrawer opened={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      <ActivityFeedDrawer opened={activityOpen} onClose={() => setActivityOpen(false)} />

      {/* S6 Sprint additions */}
      <GHint show={showHint} />
      <KeyboardShortcutsModal opened={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
    </MantineAppShell>
  );
}
