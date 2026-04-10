/**
 * routeBreadcrumbs.ts — central breadcrumb map for all PP routes.
 *
 * Structure: pathname → [{ label, href? }, ...] where the LAST item is the
 * current page (no href) and preceding items are clickable ancestors.
 *
 * PPPageLayout auto-derives breadcrumbs from this map when no `breadcrumbs`
 * prop is passed explicitly.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

type BreadcrumbMap = Record<string, BreadcrumbItem[]>;

// ── Reusable parent crumbs (all now have hrefs) ───────────────────────────────
const HOME      = { label: 'Home',      href: '/' };
const PORTFOLIO = { label: 'Portfolio', href: '/projects' };
const PEOPLE    = { label: 'People',    href: '/people/resources' };
const CALENDAR  = { label: 'Calendar',  href: '/calendar' };
const DELIVERY  = { label: 'Delivery',  href: '/delivery/jira' };
const JIRA      = { label: 'Jira',      href: '/delivery/jira' };
const ADMIN     = { label: 'Admin',     href: '/approvals' };
const SETTINGS  = { label: 'Settings',  href: '/settings/org' };

/** Static route → breadcrumb mapping */
const STATIC_MAP: BreadcrumbMap = {
  // ── Home ─────────────────────────────────────────────────────────────────
  '/':             [HOME, { label: 'Dashboard' }],
  '/inbox':        [HOME, { label: 'Inbox' }],
  '/nlp':          [HOME, { label: 'Ask AI' }],
  '/nlp/history':  [HOME, { label: 'AI History' }],
  '/ai-content-studio': [HOME, { label: 'AI Content Studio' }],

  // ── Portfolio ─────────────────────────────────────────────────────────────
  '/projects':               [PORTFOLIO, { label: 'Projects' }],
  '/portfolio/health':       [PORTFOLIO, { label: 'Portfolio Health' }],
  '/portfolio/timeline':     [PORTFOLIO, { label: 'Portfolio Timeline' }],
  '/reports/dependency-map': [PORTFOLIO, { label: 'Dependency Map' }],
  '/reports/risk-heatmap':   [PORTFOLIO, { label: 'Risk Heatmap' }],
  '/reports/executive-summary': [PORTFOLIO, { label: 'Executive Summary' }],
  '/risk-register':          [PORTFOLIO, { label: 'Risk Register' }],
  '/objectives':             [PORTFOLIO, { label: 'Objectives' }],
  '/ideas':                  [PORTFOLIO, { label: 'Ideas Board' }],
  '/advanced-timeline':      [PORTFOLIO, { label: 'Advanced Timeline' }],
  '/reports/project-health': [PORTFOLIO, { label: 'Project Health' }],
  '/reports/project-signals':[PORTFOLIO, { label: 'Project Signals' }],
  '/reports/project-pod-matrix': [PORTFOLIO, { label: 'Project POD Matrix' }],
  '/reports/portfolio-health-dashboard': [PORTFOLIO, { label: 'Portfolio Health Dashboard' }],
  '/reports/gantt-dependencies': [PORTFOLIO, { label: 'Gantt Dependencies' }],

  // ── People ────────────────────────────────────────────────────────────────
  '/people/resources':   [PEOPLE, { label: 'Resources' }],
  '/people/capacity':    [PEOPLE, { label: 'Capacity' }],
  '/people/performance': [PEOPLE, { label: 'Performance' }],
  '/reports/skills-matrix': [PEOPLE, { label: 'Skills Matrix' }],
  '/reports/team-pulse': [PEOPLE, { label: 'Team Pulse' }],
  '/availability':       [PEOPLE, { label: 'Availability' }],
  '/overrides':          [PEOPLE, { label: 'Overrides' }],
  '/resource-bookings':  [PEOPLE, { label: 'Resource Bookings' }],
  '/reports/utilization': [PEOPLE, { label: 'Utilization Center' }],
  '/reports/hiring-forecast': [PEOPLE, { label: 'Hiring Forecast' }],
  '/reports/capacity-demand': [PEOPLE, { label: 'Capacity Demand' }],
  '/reports/capacity-forecast': [PEOPLE, { label: 'Capacity Forecast' }],
  '/reports/resource-intelligence': [PEOPLE, { label: 'Resource Intelligence' }],
  '/reports/workload-chart': [PEOPLE, { label: 'Workload Chart' }],
  '/reports/pod-resources': [PEOPLE, { label: 'POD Resources' }],
  '/reports/pod-capacity':  [PEOPLE, { label: 'POD Capacity' }],
  '/reports/pod-hours':     [PEOPLE, { label: 'POD Hours' }],
  '/reports/resource-performance': [PEOPLE, { label: 'Resource Performance' }],
  '/reports/resource-roi':  [PEOPLE, { label: 'Resource ROI' }],

  // ── Calendar ──────────────────────────────────────────────────────────────
  '/calendar':          [CALENDAR, { label: 'Strategic Calendar' }],
  '/team-calendar':     [CALENDAR, { label: 'Team Calendar' }],
  '/sprint-planner':    [CALENDAR, { label: 'Sprint Planner' }],
  '/sprint-calendar':   [CALENDAR, { label: 'Sprint Calendar' }],
  '/release-calendar':  [CALENDAR, { label: 'Release Calendar' }],
  '/project-templates': [CALENDAR, { label: 'Project Templates' }],
  '/leave':             [CALENDAR, { label: 'Leave Hub' }],

  // ── Delivery ──────────────────────────────────────────────────────────────
  '/pods':               [DELIVERY, { label: 'PODs' }],
  '/reports/budget-capex': [DELIVERY, { label: 'Budget & CapEx' }],
  '/smart-insights':     [DELIVERY, { label: 'Smart Insights' }],
  '/engineering/hub':    [DELIVERY, { label: 'Engineering Hub' }],
  '/reports/dora':       [DELIVERY, { label: 'DORA Metrics' }],
  '/reports/engineering-intelligence': [DELIVERY, { label: 'Engineering Intelligence' }],
  '/reports/delivery-predictability':  [DELIVERY, { label: 'Delivery Predictability' }],

  // ── Jira ──────────────────────────────────────────────────────────────────
  '/delivery/jira':     [JIRA, { label: 'POD Dashboard' }],
  '/sprint-backlog':    [JIRA, { label: 'Sprint Backlog' }],
  '/reports/sprint-retro': [JIRA, { label: 'Sprint Retro' }],
  '/delivery/releases': [JIRA, { label: 'Releases' }],
  '/reports/jira-analytics': [JIRA, { label: 'Jira Analytics' }],
  '/reports/jira-dashboard-builder': [JIRA, { label: 'Dashboard Builder' }],
  '/reports/jira-portfolio-sync':    [JIRA, { label: 'Portfolio Sync' }],
  '/reports/status-updates':         [JIRA, { label: 'Status Updates' }],

  // ── Admin / Tools ─────────────────────────────────────────────────────────
  '/approvals':          [ADMIN, { label: 'Approval Queue' }],
  '/tools/scenarios':    [ADMIN, { label: 'Scenario Tools' }],
  '/automation-engine':  [ADMIN, { label: 'Automation Engine' }],
  '/reports/smart-notifications': [ADMIN, { label: 'Smart Notifications' }],
  '/custom-dashboard':   [ADMIN, { label: 'Custom Dashboard' }],
  '/bulk-import':        [ADMIN, { label: 'Bulk Import' }],

  // ── Settings ──────────────────────────────────────────────────────────────
  '/settings':               [SETTINGS, { label: 'Overview' }],
  '/settings/org':           [SETTINGS, { label: 'Organisation' }],
  '/settings/email-templates':          [SETTINGS, { label: 'Email Templates' }],
  '/settings/notification-preferences': [SETTINGS, { label: 'Notification Preferences' }],
  '/settings/custom-fields': [SETTINGS, { label: 'Custom Fields' }],
  '/settings/webhooks':      [SETTINGS, { label: 'Webhooks' }],
  '/settings/changelog':     [SETTINGS, { label: 'Changelog' }],
  '/settings/scheduled-reports': [SETTINGS, { label: 'Scheduled Reports' }],
  '/settings/cost-rates':    [SETTINGS, { label: 'Cost Rates' }],
  '/settings/users':         [SETTINGS, { label: 'User Management' }],
  '/settings/audit-log':     [SETTINGS, { label: 'Audit Log' }],
  '/settings/tables':        [SETTINGS, { label: 'DB Tables' }],
  '/settings/jira':          [SETTINGS, { label: 'Jira Settings' }],
  '/settings/jira-credentials':     [SETTINGS, { label: 'Jira Credentials' }],
  '/settings/jira-resource-mapping':[SETTINGS, { label: 'Resource Mapping' }],
  '/settings/jira-release-mapping': [SETTINGS, { label: 'Release Mapping' }],
  '/settings/releases':      [SETTINGS, { label: 'Release Settings' }],
  '/settings/support-boards':[SETTINGS, { label: 'Support Boards' }],
  '/settings/ref-data':      [SETTINGS, { label: 'Reference Data' }],
  '/settings/sidebar-order': [SETTINGS, { label: 'Sidebar Order' }],
  '/settings/azure-devops':  [SETTINGS, { label: 'Azure DevOps' }],
  '/settings/smart-mapping': [SETTINGS, { label: 'Smart Mapping' }],
  '/settings/nlp-optimizer': [SETTINGS, { label: 'NLP Optimizer' }],
  '/settings/nlp':           [SETTINGS, { label: 'NLP Settings' }],
  '/settings/feedback':      [SETTINGS, { label: 'Feedback Hub' }],
  '/settings/leave-management': [SETTINGS, { label: 'Leave Management' }],
  '/settings/holiday-calendar': [SETTINGS, { label: 'Holiday Calendar' }],
  '/settings/timeline':      [SETTINGS, { label: 'Timeline Settings' }],
  '/settings/error-logs':    [SETTINGS, { label: 'Error Logs' }],
};

/**
 * Prefix patterns for dynamic routes (e.g. /projects/:id).
 * Checked IN ORDER — first match wins.
 */
const PREFIX_MAP: Array<{ prefix: string; crumbs: BreadcrumbItem[] }> = [
  { prefix: '/projects/',      crumbs: [{ ...PORTFOLIO }, { label: 'Project Detail' }] },
  { prefix: '/pods/',          crumbs: [{ ...DELIVERY, href: '/pods' }, { label: 'POD Detail' }] },
  { prefix: '/delivery/jira/', crumbs: [{ ...JIRA }, { label: 'POD Dashboard' }] },
  { prefix: '/settings/',      crumbs: [{ ...SETTINGS }, { label: 'Settings' }] },
  { prefix: '/reports/',       crumbs: [{ ...PORTFOLIO }, { label: 'Report' }] },
  { prefix: '/people/',        crumbs: [{ ...PEOPLE }, { label: 'People' }] },
  { prefix: '/portfolio/',     crumbs: [{ ...PORTFOLIO }, { label: 'Portfolio' }] },
  { prefix: '/delivery/',      crumbs: [{ ...DELIVERY }, { label: 'Delivery' }] },
  { prefix: '/engineering/',   crumbs: [{ ...DELIVERY }, { label: 'Engineering Hub' }] },
  { prefix: '/tools/',         crumbs: [{ ...ADMIN }, { label: 'Tools' }] },
];

/**
 * Look up the breadcrumb trail for a given route pathname.
 * Returns `undefined` if no match is found (PPPageLayout will hide breadcrumbs).
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] | undefined {
  // Strip trailing slash (except root)
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;

  // Exact match first
  if (STATIC_MAP[path]) return STATIC_MAP[path];

  // Prefix match for dynamic routes
  for (const { prefix, crumbs } of PREFIX_MAP) {
    if (path.startsWith(prefix)) return crumbs;
  }

  return undefined;
}
