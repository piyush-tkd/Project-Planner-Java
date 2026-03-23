/**
 * GlobalBreadcrumb — Route-aware breadcrumb navigation.
 *
 * Uses an explicit mapping from each route to its full breadcrumb trail,
 * so every page gets a correct, sensible hierarchy.  Hidden on Dashboard.
 */
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useComputedColorScheme } from '@mantine/core';
import { IconHome, IconChevronRight, IconArrowLeft } from '@tabler/icons-react';
import {
  DEEP_BLUE, AQUA, FONT_FAMILY, AQUA_TINTS,
  DEEP_BLUE_TINTS, BORDER_DEFAULT, SURFACE_SIDEBAR,
} from '../../brandTokens';

/* ── Breadcrumb trail definitions ──────────────────────────────────── */
interface Crumb {
  label: string;
  path?: string;        // if omitted, crumb is not a link (group label)
}

const ROUTE_TRAILS: Record<string, Crumb[]> = {
  /* ── Dashboard ── */
  '/nlp':                [{ label: 'Dashboard' }, { label: 'Ask AI', path: '/nlp' }],

  /* ── Data Entry ── */
  '/resources':           [{ label: 'Data Entry' }, { label: 'Resources', path: '/resources' }],
  '/projects':            [{ label: 'Data Entry' }, { label: 'Projects', path: '/projects' }],
  '/projects/:id':        [{ label: 'Data Entry' }, { label: 'Projects', path: '/projects' }, { label: 'Project Detail' }],
  '/pods':                [{ label: 'Data Entry' }, { label: 'PODs', path: '/pods' }],
  '/pods/:id':            [{ label: 'Data Entry' }, { label: 'PODs', path: '/pods' }, { label: 'POD Detail' }],
  '/availability':        [{ label: 'Data Entry' }, { label: 'Availability', path: '/availability' }],
  '/overrides':           [{ label: 'Data Entry' }, { label: 'Overrides', path: '/overrides' }],
  '/team-calendar':       [{ label: 'Data Entry' }, { label: 'Team Calendar', path: '/team-calendar' }],
  '/sprint-calendar':     [{ label: 'Data Entry' }, { label: 'Sprint Calendar', path: '/sprint-calendar' }],
  '/release-calendar':    [{ label: 'Data Entry' }, { label: 'Release Calendar', path: '/release-calendar' }],
  '/sprint-planner':      [{ label: 'Data Entry' }, { label: 'Sprint Planner', path: '/sprint-planner' }],

  /* ── Capacity Reports ── */
  '/reports/capacity-gap':       [{ label: 'Capacity Reports' }, { label: 'Capacity Gap', path: '/reports/capacity-gap' }],
  '/reports/utilization':        [{ label: 'Capacity Reports' }, { label: 'Utilization', path: '/reports/utilization' }],
  '/reports/slack-buffer':       [{ label: 'Capacity Reports' }, { label: 'Slack & Buffer', path: '/reports/slack-buffer' }],
  '/reports/hiring-forecast':    [{ label: 'Capacity Reports' }, { label: 'Hiring Forecast', path: '/reports/hiring-forecast' }],
  '/reports/concurrency':        [{ label: 'Capacity Reports' }, { label: 'Concurrency Risk', path: '/reports/concurrency' }],
  '/reports/capacity-demand':    [{ label: 'Capacity Reports' }, { label: 'Capacity vs Demand', path: '/reports/capacity-demand' }],
  '/reports/pod-resources':      [{ label: 'Capacity Reports' }, { label: 'POD Resources', path: '/reports/pod-resources' }],
  '/reports/pod-capacity':       [{ label: 'Capacity Reports' }, { label: 'POD Capacity', path: '/reports/pod-capacity' }],
  '/reports/resource-pod-matrix':[{ label: 'Capacity Reports' }, { label: 'Resource · POD Matrix', path: '/reports/resource-pod-matrix' }],

  /* ── Portfolio Analysis ── */
  '/reports/project-health':      [{ label: 'Portfolio Analysis' }, { label: 'Project Health', path: '/reports/project-health' }],
  '/reports/cross-pod':           [{ label: 'Portfolio Analysis' }, { label: 'Cross-POD Deps', path: '/reports/cross-pod' }],
  '/reports/owner-demand':        [{ label: 'Portfolio Analysis' }, { label: 'Owner Demand', path: '/reports/owner-demand' }],
  '/reports/deadline-gap':        [{ label: 'Portfolio Analysis' }, { label: 'Deadline Gap', path: '/reports/deadline-gap' }],
  '/reports/resource-allocation': [{ label: 'Portfolio Analysis' }, { label: 'Resource Allocation', path: '/reports/resource-allocation' }],
  '/reports/pod-splits':          [{ label: 'Portfolio Analysis' }, { label: 'POD Splits', path: '/reports/pod-splits' }],
  '/reports/pod-project-matrix':  [{ label: 'Portfolio Analysis' }, { label: 'POD-Project Matrix', path: '/reports/pod-project-matrix' }],
  '/reports/project-pod-matrix':  [{ label: 'Portfolio Analysis' }, { label: 'Project-POD Matrix', path: '/reports/project-pod-matrix' }],
  '/reports/gantt':               [{ label: 'Portfolio Analysis' }, { label: 'Project Gantt', path: '/reports/gantt' }],
  '/reports/budget':              [{ label: 'Portfolio Analysis' }, { label: 'Budget & Cost', path: '/reports/budget' }],
  '/reports/resource-roi':        [{ label: 'Portfolio Analysis' }, { label: 'Resource ROI', path: '/reports/resource-roi' }],

  /* ── Integrations ── */
  '/jira-pods':          [{ label: 'Integrations' }, { label: 'POD Dashboard', path: '/jira-pods' }],
  '/jira-pods/:id':      [{ label: 'Integrations' }, { label: 'POD Dashboard', path: '/jira-pods' }, { label: 'POD Detail' }],
  '/jira-releases':      [{ label: 'Integrations' }, { label: 'Releases', path: '/jira-releases' }],
  '/release-notes':      [{ label: 'Integrations' }, { label: 'Release Notes', path: '/release-notes' }],
  '/jira-capex':         [{ label: 'Integrations' }, { label: 'CapEx / OpEx', path: '/jira-capex' }],
  '/jira-actuals':       [{ label: 'Integrations' }, { label: 'Jira Actuals', path: '/jira-actuals' }],
  '/jira-support':       [{ label: 'Integrations' }, { label: 'Support Queue', path: '/jira-support' }],
  '/jira-worklog':       [{ label: 'Integrations' }, { label: 'Worklog', path: '/jira-worklog' }],

  /* ── Simulators ── */
  '/simulator/timeline': [{ label: 'Simulators' }, { label: 'Timeline Simulator', path: '/simulator/timeline' }],
  '/simulator/scenario': [{ label: 'Simulators' }, { label: 'Scenario Simulator', path: '/simulator/scenario' }],

  /* ── Settings ── */
  '/settings/timeline':         [{ label: 'Settings' }, { label: 'Timeline', path: '/settings/timeline' }],
  '/settings/ref-data':         [{ label: 'Settings' }, { label: 'Reference Data', path: '/settings/ref-data' }],
  '/settings/jira':             [{ label: 'Settings' }, { label: 'Jira Boards', path: '/settings/jira' }],
  '/settings/releases':         [{ label: 'Settings' }, { label: 'Release Versions', path: '/settings/releases' }],
  '/settings/jira-credentials': [{ label: 'Settings' }, { label: 'Jira Credentials', path: '/settings/jira-credentials' }],
  '/settings/support-boards':   [{ label: 'Settings' }, { label: 'Support Boards', path: '/settings/support-boards' }],
  '/settings/nlp':              [{ label: 'Settings' }, { label: 'NLP Configuration', path: '/settings/nlp' }],
  '/settings/nlp-optimizer':    [{ label: 'Settings' }, { label: 'NLP Optimizer', path: '/settings/nlp-optimizer' }],
  '/settings/users':            [{ label: 'Settings' }, { label: 'User Management', path: '/settings/users' }],
  '/settings/audit-log':        [{ label: 'Settings' }, { label: 'Audit Log', path: '/settings/audit-log' }],
  '/settings/tables':           [{ label: 'Settings' }, { label: 'Tables', path: '/settings/tables' }],
};

/* ── Resolve a live pathname against the trail map ─────────────────── */
function resolveTrail(pathname: string): Crumb[] {
  if (ROUTE_TRAILS[pathname]) return ROUTE_TRAILS[pathname];

  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 2 && parts[0] === 'projects') return ROUTE_TRAILS['/projects/:id'] ?? [];
  if (parts.length === 2 && parts[0] === 'pods')     return ROUTE_TRAILS['/pods/:id'] ?? [];
  if (parts.length === 2 && parts[0] === 'jira-pods') return ROUTE_TRAILS['/jira-pods/:id'] ?? [];

  // Fallback: capitalize each segment
  return parts.map((seg, i) => ({
    label: seg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    path: '/' + parts.slice(0, i + 1).join('/'),
  }));
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function GlobalBreadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  const trail = useMemo(() => resolveTrail(location.pathname), [location.pathname]);

  // Don't render on Dashboard or top-level pages with only one crumb (no parent to navigate to)
  if (location.pathname === '/' || trail.length <= 1) return null;

  const crumbs: Crumb[] = trail;

  /* ── Dark-mode aware styles ── */
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginBottom: 12,
    padding: '8px 12px',
    background: isDark
      ? 'rgba(255, 255, 255, 0.04)'
      : SURFACE_SIDEBAR,
    borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : BORDER_DEFAULT}`,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: '20px',
    flexWrap: 'wrap',
    backdropFilter: isDark ? 'blur(8px)' : undefined,
  };

  const separatorStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    margin: '0 4px',
    color: isDark ? 'rgba(255, 255, 255, 0.25)' : DEEP_BLUE_TINTS[20],
    flexShrink: 0,
  };

  const linkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: isDark ? 'rgba(255, 255, 255, 0.7)' : DEEP_BLUE,
    textDecoration: 'none',
    cursor: 'pointer',
    borderRadius: 3,
    padding: '2px 4px',
    transition: 'background-color 150ms ease, color 150ms ease',
  };

  const linkHoverBg = isDark ? 'rgba(45, 204, 211, 0.12)' : 'rgba(45, 204, 211, 0.08)';

  const groupLabelStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    color: isDark ? 'rgba(255, 255, 255, 0.45)' : DEEP_BLUE_TINTS[50],
    padding: '2px 4px',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  const activeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    color: AQUA,
    fontWeight: 600,
    padding: '2px 4px',
  };

  const backBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : BORDER_DEFAULT}`,
    background: 'transparent',
    color: isDark ? 'rgba(255, 255, 255, 0.7)' : DEEP_BLUE,
    cursor: 'pointer',
    marginRight: 8,
    transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
    flexShrink: 0,
  };

  return (
    <nav aria-label="Breadcrumb" style={containerStyle}>
      {/* Back button */}
      <button
        type="button"
        aria-label="Go back"
        title="Go back"
        style={backBtnStyle}
        onClick={() => navigate(-1)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = isDark ? 'rgba(45, 204, 211, 0.15)' : AQUA_TINTS[10];
          (e.currentTarget as HTMLButtonElement).style.borderColor = AQUA;
          (e.currentTarget as HTMLButtonElement).style.color = AQUA;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : BORDER_DEFAULT;
          (e.currentTarget as HTMLButtonElement).style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : DEEP_BLUE;
        }}
      >
        <IconArrowLeft size={16} stroke={2} />
      </button>

      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        const isLink = !!crumb.path && !isLast;
        const isGroupLabel = !crumb.path && !isLast;

        return (
          <span key={`${crumb.label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {/* Separator */}
            {idx > 0 && (
              <span style={separatorStyle}>
                <IconChevronRight size={12} stroke={1.5} />
              </span>
            )}

            {/* Crumb */}
            {isLink ? (
              <a
                href={crumb.path}
                onClick={(e) => { e.preventDefault(); navigate(crumb.path!); }}
                style={linkStyle}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = linkHoverBg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {idx === 0 && <IconHome size={14} stroke={1.5} />}
                {crumb.label}
              </a>
            ) : isGroupLabel ? (
              <span style={groupLabelStyle}>
                {crumb.label}
              </span>
            ) : (
              <span style={activeStyle}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
