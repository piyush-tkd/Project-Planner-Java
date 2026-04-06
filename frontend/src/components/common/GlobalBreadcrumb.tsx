/**
 * GlobalBreadcrumb — Route-aware breadcrumb navigation.
 *
 * Improvements in v11.2:
 *  • Home crumb at the start of every trail
 *  • All section labels are now clickable links
 *  • Full route coverage (all pages, new and old)
 *  • Dynamic entity names for /projects/:id, /pods/:id, /jira-pods/:id
 *  • Admin section links to the consolidated /settings/org hub
 */
import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useComputedColorScheme } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconHome, IconChevronRight, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../../api/client';
import {
  DEEP_BLUE, AQUA, FONT_FAMILY, AQUA_TINTS,
  DEEP_BLUE_TINTS, BORDER_DEFAULT, SURFACE_SIDEBAR,
} from '../../brandTokens';

/* ── Types ─────────────────────────────────────────────────────────── */
interface Crumb {
  label: string;
  path?: string;
  isHome?: boolean;
}

/* ── Section anchors (all clickable) ───────────────────────────────── */
const H: Crumb = { label: 'Home', path: '/', isHome: true };

// Section anchor paths MUST point to hub pages that are distinct from sub-pages.
// This ensures "Section > Page" breadcrumbs are never self-referential.
// When visiting the hub page itself, the deduplication in resolveTrail() removes the redundant middle crumb.
const SEC = {
  DATA:      { label: 'People',    path: '/resources' } as Crumb,
  CAPACITY:  { label: 'Analytics', path: '/reports/status-updates' } as Crumb,
  PORTFOLIO: { label: 'Portfolio', path: '/reports/executive-summary' } as Crumb,
  STRATEGY:  { label: 'Projects',  path: '/projects' } as Crumb,
  PLANNING:  { label: 'Planning',  path: '/calendar' } as Crumb,
  INTEG:     { label: 'Delivery',  path: '/jira-pods' } as Crumb,
  SIM:       { label: 'Tools',     path: '/custom-dashboard' } as Crumb,
  ADMIN:     { label: 'Admin',     path: '/settings/org' } as Crumb,
};

/* ── Full route trail map ───────────────────────────────────────────── */
const ROUTE_TRAILS: Record<string, Crumb[]> = {
  /* ── Ask AI ── */
  '/nlp': [H, { label: 'Ask AI', path: '/nlp' }],

  /* ── Inbox ── */
  '/inbox': [H, { label: 'Inbox', path: '/inbox' }],

  /* ── Data Entry ── */
  '/resources':         [H, SEC.DATA, { label: 'Resources',         path: '/resources' }],
  '/projects':          [H, SEC.DATA, { label: 'Projects',           path: '/projects' }],
  '/projects/:id':      [H, SEC.DATA, { label: 'Projects',           path: '/projects' }, { label: '…' }],
  '/pods':              [H, SEC.DATA, { label: 'PODs',               path: '/pods' }],
  '/pods/:id':          [H, SEC.DATA, { label: 'PODs',               path: '/pods' },     { label: '…' }],
  '/overrides':         [H, SEC.DATA, { label: 'Overrides',          path: '/overrides' }],
  '/availability':      [H, SEC.DATA, { label: 'Availability',       path: '/availability' }],
  '/resource-bookings': [H, SEC.DATA, { label: 'Resource Bookings',  path: '/resource-bookings' }],
  '/project-templates': [H, SEC.DATA, { label: 'Project Templates',  path: '/project-templates' }],
  '/leave':             [H, SEC.DATA, { label: 'Leave Hub',          path: '/leave' }],

  /* ── Strategy ── */
  '/objectives':    [H, SEC.STRATEGY, { label: 'Objectives',    path: '/objectives' }],
  '/risk-register': [H, SEC.STRATEGY, { label: 'Risk Register', path: '/risk-register' }],
  '/ideas':         [H, SEC.STRATEGY, { label: 'Ideas Board',   path: '/ideas' }],

  /* ── Planning / Calendar ── */
  '/calendar':          [H, SEC.PLANNING, { label: 'Strategic Calendar', path: '/calendar' }],
  '/team-calendar':     [H, SEC.PLANNING, { label: 'Team Calendar',   path: '/team-calendar' }],
  '/sprint-calendar':   [H, SEC.PLANNING, { label: 'Sprint Calendar', path: '/sprint-calendar' }],
  '/release-calendar':  [H, SEC.PLANNING, { label: 'Release Calendar',path: '/release-calendar' }],
  '/sprint-planner':    [H, SEC.PLANNING, { label: 'Sprint Planner',  path: '/sprint-planner' }],

  /* ── Capacity ── */
  '/capacity':                       [H, SEC.CAPACITY, { label: 'Capacity Hub',             path: '/capacity' }],
  '/reports/utilization':            [H, SEC.CAPACITY, { label: 'Utilization Center',        path: '/reports/utilization' }],
  '/reports/hiring-forecast':        [H, SEC.CAPACITY, { label: 'Hiring Forecast',           path: '/reports/hiring-forecast' }],
  '/reports/capacity-demand':        [H, SEC.CAPACITY, { label: 'Capacity vs Demand',        path: '/reports/capacity-demand' }],
  '/reports/pod-resources':          [H, SEC.CAPACITY, { label: 'POD Resources',             path: '/reports/pod-resources' }],
  '/reports/pod-capacity':           [H, SEC.CAPACITY, { label: 'POD Capacity',              path: '/reports/pod-capacity' }],
  '/reports/resource-intelligence':  [H, SEC.CAPACITY, { label: 'Resource Intelligence',     path: '/reports/resource-intelligence' }],
  '/reports/workload-chart':         [H, SEC.CAPACITY, { label: 'Workload Chart',            path: '/reports/workload-chart' }],

  /* ── Portfolio Analysis ── */
  '/reports/project-health':             [H, SEC.PORTFOLIO, { label: 'Project Health',             path: '/reports/project-health' }],
  '/reports/dependency-map':             [H, SEC.PORTFOLIO, { label: 'Dependency Map',             path: '/reports/dependency-map' }],
  '/reports/portfolio-timeline':         [H, SEC.PORTFOLIO, { label: 'Portfolio Timeline',         path: '/reports/portfolio-timeline' }],
  '/reports/project-signals':            [H, SEC.PORTFOLIO, { label: 'Project Signals',            path: '/reports/project-signals' }],
  '/reports/project-pod-matrix':         [H, SEC.PORTFOLIO, { label: 'Project-POD Matrix',         path: '/reports/project-pod-matrix' }],
  '/reports/budget-capex':               [H, SEC.PORTFOLIO, { label: 'Budget & CapEx',             path: '/reports/budget-capex' }],
  '/reports/resource-performance':       [H, SEC.PORTFOLIO, { label: 'Resource Performance',       path: '/reports/resource-performance' }],
  '/reports/pod-hours':                  [H, SEC.PORTFOLIO, { label: 'POD Hours',                  path: '/reports/pod-hours' }],
  '/reports/dora':                       [H, SEC.PORTFOLIO, { label: 'DORA Metrics',               path: '/reports/dora' }],
  '/reports/jira-analytics':             [H, SEC.PORTFOLIO, { label: 'Jira Analytics',             path: '/reports/jira-analytics' }],
  '/reports/jira-dashboard-builder':     [H, SEC.PORTFOLIO, { label: 'Dashboard Builder',          path: '/reports/jira-dashboard-builder' }],
  '/reports/engineering-productivity':   [H, SEC.PORTFOLIO, { label: 'Engineering Productivity',   path: '/reports/engineering-productivity' }],
  '/reports/portfolio-health-dashboard': [H, SEC.PORTFOLIO, { label: 'Portfolio Health',           path: '/reports/portfolio-health-dashboard' }],
  '/reports/jira-portfolio-sync':        [H, SEC.PORTFOLIO, { label: 'Portfolio Sync',             path: '/reports/jira-portfolio-sync' }],
  '/reports/financial-intelligence':     [H, SEC.PORTFOLIO, { label: 'Financial Intelligence',     path: '/reports/financial-intelligence' }],
  '/reports/delivery-predictability':    [H, SEC.PORTFOLIO, { label: 'Delivery Predictability',    path: '/reports/delivery-predictability' }],
  '/reports/smart-notifications':        [H, SEC.PORTFOLIO, { label: 'Smart Notifications',        path: '/reports/smart-notifications' }],
  '/reports/gantt-dependencies':         [H, SEC.PORTFOLIO, { label: 'Gantt Dependencies',         path: '/reports/gantt-dependencies' }],
  '/reports/executive-summary':          [H, SEC.PORTFOLIO, { label: 'Executive Summary',           path: '/reports/executive-summary' }],
  '/reports/risk-heatmap':               [H, SEC.PORTFOLIO, { label: 'Risk Heatmap',                path: '/reports/risk-heatmap' }],
  '/reports/status-updates':             [H, SEC.PORTFOLIO, { label: 'Status Updates',              path: '/reports/status-updates' }],
  '/reports/sprint-retro':               [H, SEC.PORTFOLIO, { label: 'Sprint Retro',                path: '/reports/sprint-retro' }],
  '/reports/skills-matrix':              [H, SEC.CAPACITY,  { label: 'Skills Matrix',               path: '/reports/skills-matrix' }],
  '/reports/team-pulse':                 [H, SEC.CAPACITY,  { label: 'Team Pulse',                  path: '/reports/team-pulse' }],
  '/reports/capacity-forecast':          [H, SEC.CAPACITY,  { label: 'Capacity Forecast',           path: '/reports/capacity-forecast' }],

  /* ── Integrations ── */
  '/jira-pods':       [H, SEC.INTEG, { label: 'POD Dashboard', path: '/jira-pods' }],
  '/jira-pods/:id':   [H, SEC.INTEG, { label: 'POD Dashboard', path: '/jira-pods' }, { label: '…' }],
  '/jira-releases':   [H, SEC.INTEG, { label: 'Releases',       path: '/jira-releases' }],
  '/release-notes':   [H, SEC.INTEG, { label: 'Release Notes',  path: '/release-notes' }],
  '/jira-actuals':    [H, SEC.INTEG, { label: 'Jira Actuals',   path: '/jira-actuals' }],
  '/jira-support':    [H, SEC.INTEG, { label: 'Support Queue',  path: '/jira-support' }],
  '/jira-worklog':    [H, SEC.INTEG, { label: 'Worklog',        path: '/jira-worklog' }],

  /* ── Simulators ── */
  '/simulator/timeline': [H, SEC.SIM, { label: 'Timeline Simulator', path: '/simulator/timeline' }],
  '/simulator/scenario': [H, SEC.SIM, { label: 'Scenario Simulator', path: '/simulator/scenario' }],

  /* ── Admin — Org Settings hub ── */
  '/settings/org':                   [H, SEC.ADMIN, { label: 'Org Settings',          path: '/settings/org' }],
  '/settings/org?tab=general':       [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'General' }],
  '/settings/org?tab=users':         [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'Users & Access' }],
  '/settings/org?tab=jira':          [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'Integrations' }],
  '/settings/org?tab=notifications': [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'Notifications & Email' }],
  '/settings/org?tab=system':        [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'System' }],
  // Legacy tab keys — resolved by OrgSettingsPage LEGACY_MAP on mount
  '/settings/org?tab=branding':      [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'General' }],
  '/settings/org?tab=workspace':     [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'General' }],
  '/settings/org?tab=data':          [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'System' }],
  '/settings/org?tab=email':         [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'Notifications & Email' }],
  '/settings/org?tab=ai':            [H, SEC.ADMIN, { label: 'Org Settings', path: '/settings/org' }, { label: 'Notifications & Email' }],

  /* ── Admin — Integrations sub-pages ── */
  '/settings/jira-credentials':      [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Jira Credentials' }],
  '/settings/jira':                  [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Jira Boards' }],
  '/settings/support-boards':        [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Support Boards' }],
  '/settings/jira-release-mapping':  [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Release Mapping' }],
  '/settings/jira-resource-mapping': [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Resource Mapping' }],
  '/settings/azure-devops':          [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Azure DevOps' }],
  '/settings/smart-mapping':         [H, SEC.ADMIN, { label: 'Integrations', path: '/settings/org?tab=jira' }, { label: 'Smart Mapping' }],

  /* ── Admin — Notifications & Email sub-pages ── */
  '/settings/nlp':                   [H, SEC.ADMIN, { label: 'Notifications & Email', path: '/settings/org?tab=notifications' }, { label: 'NLP Configuration' }],
  '/settings/nlp-optimizer':         [H, SEC.ADMIN, { label: 'Notifications & Email', path: '/settings/org?tab=notifications' }, { label: 'NLP Optimizer' }],

  /* ── Admin — System sub-pages ── */
  '/settings/audit-log':             [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'Audit Log' }],
  '/settings/tables':                [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'DB Browser' }],
  '/settings/feedback-hub':          [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'Feedback Hub' }],
  '/settings/error-log':             [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'Error Log' }],
  '/settings/sidebar-order':         [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'Sidebar Order' }],
  '/settings/timeline':              [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'Timeline Settings' }],
  '/settings/ref-data':              [H, SEC.ADMIN, { label: 'System', path: '/settings/org?tab=system' }, { label: 'Reference Data' }],

  /* ── Admin — other ── */
  '/settings/users':                 [H, SEC.ADMIN, { label: 'User Management',  path: '/settings/users' }],
  '/settings/releases':              [H, SEC.ADMIN, { label: 'Release Versions', path: '/settings/releases' }],
  '/settings/changelog':             [H, SEC.ADMIN, { label: 'Changelog Admin',  path: '/settings/changelog' }],
  '/settings/custom-fields':         [H, SEC.ADMIN, { label: 'Custom Fields',    path: '/settings/custom-fields' }],
  '/automation-engine':                    [H, SEC.SIM,       { label: 'Automation Engine',          path: '/automation-engine' }],
  '/smart-insights':                       [H, SEC.CAPACITY,  { label: 'Smart Insights',             path: '/smart-insights' }],
  '/settings/notification-preferences':   [H, SEC.ADMIN,     { label: 'Notification Preferences',   path: '/settings/notification-preferences' }],
  '/custom-dashboard':                     [H, SEC.SIM,       { label: 'Custom Dashboard',           path: '/custom-dashboard' }],
  '/approvals':                            [H, SEC.STRATEGY,  { label: 'Approval Queue',             path: '/approvals' }],
  '/bulk-import':                          [H, SEC.SIM,       { label: 'Bulk Import',                path: '/bulk-import' }],
  '/advanced-timeline':                    [H, SEC.PLANNING,  { label: 'Advanced Timeline',          path: '/advanced-timeline' }],
};

/* ── Resolve a live pathname against the trail map ─────────────────── */
function resolveTrail(pathname: string, search?: string): Crumb[] {
  let trail: Crumb[];

  // Try full key (pathname + search) first for query-param-based sub-pages
  const fullKey = search && search.length > 1 ? pathname + search : pathname;

  if (ROUTE_TRAILS[fullKey]) {
    trail = ROUTE_TRAILS[fullKey];
  } else if (ROUTE_TRAILS[pathname]) {
    trail = ROUTE_TRAILS[pathname];
  } else {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 2 && parts[0] === 'projects')  return ROUTE_TRAILS['/projects/:id']  ?? [];
    if (parts.length === 2 && parts[0] === 'pods')       return ROUTE_TRAILS['/pods/:id']      ?? [];
    if (parts.length === 2 && parts[0] === 'jira-pods')  return ROUTE_TRAILS['/jira-pods/:id'] ?? [];

    // Generic fallback
    trail = [
      H,
      ...parts.map((seg, i) => ({
        label: seg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        path: '/' + parts.slice(0, i + 1).join('/'),
      })),
    ];
  }

  // Deduplication: if the section crumb (index 1) has the same path as the leaf crumb (last),
  // it means we're ON the section hub page — remove the redundant middle crumb.
  // e.g.  🏠 > Admin(/settings/org) > Admin Settings(/settings/org) → 🏠 > Admin Settings
  if (trail.length >= 3) {
    const sectionCrumb = trail[1];
    const leafCrumb    = trail[trail.length - 1];
    if (sectionCrumb.path && leafCrumb.path && sectionCrumb.path === leafCrumb.path) {
      trail = [trail[0], ...trail.slice(2)];
    }
  }

  return trail;
}

/* ── Dynamic label hook — resolves real entity names ───────────────── */
function useDynamicLabel(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const isProjectDetail  = parts.length === 2 && parts[0] === 'projects';
  const isPodDetail      = parts.length === 2 && parts[0] === 'pods';
  const isJiraPodDetail  = parts.length === 2 && parts[0] === 'jira-pods';
  const entityId = parts[1];

  const { data: project } = useQuery<{ name: string }>({
    queryKey: ['breadcrumb-project', entityId],
    queryFn: () => apiClient.get(`/projects/${entityId}`).then(r => r.data),
    enabled: isProjectDetail && !!entityId,
    staleTime: 5 * 60_000,
  });

  const { data: pod } = useQuery<{ name: string }>({
    queryKey: ['breadcrumb-pod', entityId],
    queryFn: () => apiClient.get(`/pods/${entityId}`).then(r => r.data),
    enabled: (isPodDetail || isJiraPodDetail) && !!entityId,
    staleTime: 5 * 60_000,
  });

  if (isProjectDetail && project?.name) return project.name;
  if ((isPodDetail || isJiraPodDetail) && pod?.name) return pod.name;
  return null;
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function GlobalBreadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  const rawTrail = useMemo(() => resolveTrail(location.pathname, location.search), [location.pathname, location.search]);
  const dynamicLabel = useDynamicLabel(location.pathname);

  // Replace the last placeholder '…' with the real entity name when available
  const trail: Crumb[] = useMemo(() => {
    if (!dynamicLabel) return rawTrail;
    return rawTrail.map((c, i) =>
      i === rawTrail.length - 1 && c.label === '…'
        ? { ...c, label: dynamicLabel }
        : c
    );
  }, [rawTrail, dynamicLabel]);

  // Hide on Dashboard and root
  if (location.pathname === '/' || trail.length <= 1) return null;

  /* ── Styles ── */
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginBottom: 12,
    padding: '6px 12px',
    background: isDark ? 'rgba(255,255,255,0.04)' : SURFACE_SIDEBAR,
    borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : BORDER_DEFAULT}`,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: '20px',
    flexWrap: 'wrap',
    backdropFilter: isDark ? 'blur(8px)' : undefined,
  };

  const sepStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    margin: '0 3px',
    color: isDark ? 'rgba(255,255,255,0.2)' : DEEP_BLUE_TINTS[20],
    flexShrink: 0,
  };

  const linkStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    color: isDark ? 'rgba(255,255,255,0.6)' : DEEP_BLUE_TINTS[60],
    textDecoration: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px 5px',
    fontSize: 12,
    fontWeight: 500,
    transition: 'background-color 150ms ease, color 150ms ease',
  };

  const sectionStyle: React.CSSProperties = {
    ...linkStyle,
    color: isDark ? 'rgba(255,255,255,0.45)' : DEEP_BLUE_TINTS[40],
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  const activeStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    color: isDark ? '#fff' : DEEP_BLUE,
    fontWeight: 600,
    padding: '2px 5px',
    fontSize: 13,
  };

  const backBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26,
    borderRadius: 6,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : BORDER_DEFAULT}`,
    background: 'transparent',
    color: isDark ? 'rgba(255,255,255,0.7)' : DEEP_BLUE,
    cursor: 'pointer',
    marginRight: 8,
    transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
    flexShrink: 0,
  };

  const linkHoverBg = isDark ? 'rgba(45,204,211,0.12)' : 'rgba(45,204,211,0.08)';

  return (
    <nav aria-label="Breadcrumb" style={containerStyle}>
      {/* Back button */}
      <button
        type="button"
        aria-label="Go back"
        title="Go back"
        style={backBtnStyle}
        onClick={() => navigate(-1)}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? 'rgba(45,204,211,0.15)' : AQUA_TINTS[10];
          (e.currentTarget as HTMLElement).style.borderColor = AQUA;
          (e.currentTarget as HTMLElement).style.color = AQUA;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : BORDER_DEFAULT;
          (e.currentTarget as HTMLElement).style.color = isDark ? 'rgba(255,255,255,0.7)' : DEEP_BLUE;
        }}
      >
        <IconArrowLeft size={14} stroke={2} />
      </button>

      {trail.map((crumb, idx) => {
        const isLast    = idx === trail.length - 1;
        const isHome    = !!crumb.isHome;
        const isSection = !isLast && idx > 0 && !!crumb.path;  // mid-level with path = section
        const isLink    = !!crumb.path && !isLast;

        // Determine style
        const style = isLast
          ? activeStyle
          : isSection
            ? sectionStyle
            : linkStyle;

        return (
          <span key={`${crumb.label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {/* Separator */}
            {idx > 0 && (
              <span style={sepStyle}>
                <IconChevronRight size={11} stroke={1.5} />
              </span>
            )}

            {/* Crumb */}
            {isLink ? (
              <a
                href={crumb.path}
                onClick={e => { e.preventDefault(); navigate(crumb.path!); }}
                style={style}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = linkHoverBg; (e.currentTarget as HTMLElement).style.color = AQUA; }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = isSection
                    ? (isDark ? 'rgba(255,255,255,0.45)' : DEEP_BLUE_TINTS[40])
                    : (isDark ? 'rgba(255,255,255,0.6)' : DEEP_BLUE_TINTS[60]);
                }}
              >
                {isHome ? <IconHome size={13} stroke={1.5} /> : crumb.label}
              </a>
            ) : (
              <span style={isLast ? activeStyle : { ...sectionStyle, cursor: 'default' }}>
                {isHome ? <IconHome size={13} stroke={1.5} /> : crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
