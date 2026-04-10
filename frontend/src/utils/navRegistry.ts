/**
 * navRegistry.ts — Pure-data navigation registry (no JSX).
 *
 * Single source of truth for all nav items. Used by:
 *  - AppShell sidebar (renders with icons)
 *  - CommandPalette (fuzzy search + navigate)
 *  - routeBreadcrumbs (cross-reference)
 */

export interface NavItem {
  label: string;
  path: string;
  group: string;
  /** Extra search keywords / aliases */
  keywords?: string[];
  featureFlag?: string;
}

export const NAV_ITEMS: NavItem[] = [
  // ── Home ──────────────────────────────────────────────────────────────────
  { label: 'Dashboard',          path: '/',        group: 'Home',        keywords: ['home', 'overview', 'summary'] },
  { label: 'Inbox',              path: '/inbox',   group: 'Home',        keywords: ['notifications', 'alerts', 'messages'] },
  { label: 'Ask AI',             path: '/nlp',     group: 'Home',        keywords: ['ai', 'nlp', 'assistant', 'chat', 'gpt'], featureFlag: 'ai' },
  { label: 'AI History',         path: '/nlp/history', group: 'Home',    keywords: ['ai', 'history', 'conversations', 'nlp'], featureFlag: 'ai' },

  // ── Portfolio ─────────────────────────────────────────────────────────────
  { label: 'Projects',           path: '/projects',               group: 'Portfolio', keywords: ['project list', 'all projects'] },
  { label: 'Portfolio Health',   path: '/portfolio/health',       group: 'Portfolio', keywords: ['rag', 'red amber green', 'health dashboard'] },
  { label: 'Portfolio Timeline', path: '/portfolio/timeline',     group: 'Portfolio', keywords: ['gantt', 'roadmap', 'timeline'] },
  { label: 'Dependency Map',     path: '/reports/dependency-map', group: 'Portfolio', keywords: ['dependencies', 'cross-pod', 'blockers'] },
  { label: 'Risk Heatmap',       path: '/reports/risk-heatmap',   group: 'Portfolio', keywords: ['risks', 'heatmap', 'red flags'] },
  { label: 'Executive Summary',  path: '/reports/executive-summary', group: 'Portfolio', keywords: ['exec', 'board report', 'summary'] },
  { label: 'Risk Register',      path: '/risk-register',          group: 'Portfolio', keywords: ['risks', 'issues', 'register'], featureFlag: 'risk' },
  { label: 'Objectives (OKR)',   path: '/objectives',             group: 'Portfolio', keywords: ['okr', 'goals', 'key results'], featureFlag: 'okr' },
  { label: 'Ideas Board',        path: '/ideas',                  group: 'Portfolio', keywords: ['ideas', 'backlog', 'innovation'], featureFlag: 'ideas' },
  { label: 'Project Health',     path: '/reports/project-health', group: 'Portfolio', keywords: ['health', 'status', 'rag'] },
  { label: 'Project Signals',    path: '/reports/project-signals',group: 'Portfolio', keywords: ['signals', 'risks', 'deadline gap'] },
  { label: 'Advanced Timeline',  path: '/advanced-timeline',      group: 'Portfolio', keywords: ['gantt', 'timeline', 'schedule'] },
  { label: 'Project POD Matrix', path: '/reports/project-pod-matrix', group: 'Portfolio', keywords: ['matrix', 'pod', 'projects'] },

  // ── People ────────────────────────────────────────────────────────────────
  { label: 'Resources',          path: '/people/resources',       group: 'People',    keywords: ['people', 'team', 'staff', 'directory'] },
  { label: 'Capacity Hub',       path: '/people/capacity',        group: 'People',    keywords: ['capacity', 'bandwidth', 'availability', 'hub'] },
  { label: 'Performance',        path: '/people/performance',     group: 'People',    keywords: ['performance', 'kpi', 'velocity'], featureFlag: 'advanced_people' },
  { label: 'Skills Matrix',      path: '/reports/skills-matrix',  group: 'People',    keywords: ['skills', 'competencies', 'matrix'], featureFlag: 'advanced_people' },
  { label: 'Team Pulse',         path: '/reports/team-pulse',     group: 'People',    keywords: ['pulse', 'morale', 'sentiment', 'team health'], featureFlag: 'advanced_people' },
  { label: 'Utilization',        path: '/reports/utilization',    group: 'People',    keywords: ['utilization', 'allocation', 'headcount'] },
  { label: 'Hiring Forecast',    path: '/reports/hiring-forecast',group: 'People',    keywords: ['hiring', 'headcount', 'recruitment', 'forecast'] },
  { label: 'Capacity Demand',    path: '/reports/capacity-demand',group: 'People',    keywords: ['demand', 'capacity', 'forecast'] },
  { label: 'Resource Intelligence', path: '/reports/resource-intelligence', group: 'People', keywords: ['resource', 'ai', 'intelligence', 'smart'] },
  { label: 'Workload Chart',     path: '/reports/workload-chart', group: 'People',    keywords: ['workload', 'chart', 'allocation'] },
  { label: 'Overrides',          path: '/overrides',              group: 'People',    keywords: ['overrides', 'manual', 'adjustments'] },
  { label: 'Resource Bookings',  path: '/resource-bookings',      group: 'People',    keywords: ['bookings', 'schedule', 'reserve'] },
  { label: 'Leave Hub',          path: '/leave',                  group: 'People',    keywords: ['leave', 'pto', 'holiday', 'vacation', 'absence'] },
  { label: 'POD Hours',          path: '/reports/pod-hours',      group: 'People',    keywords: ['pod', 'hours', 'timesheets'] },

  // ── Calendar ──────────────────────────────────────────────────────────────
  { label: 'Strategic Calendar', path: '/calendar',               group: 'Calendar',  keywords: ['calendar', 'schedule', 'plan'] },
  { label: 'Team Calendar',      path: '/team-calendar',          group: 'Calendar',  keywords: ['team calendar', 'shared calendar'] },
  { label: 'Sprint Planner',     path: '/sprint-planner',         group: 'Calendar',  keywords: ['sprint', 'planning', 'sprint plan'] },
  { label: 'Sprint Calendar',    path: '/sprint-calendar',        group: 'Calendar',  keywords: ['sprint', 'calendar', 'pod board'] },
  { label: 'Project Templates',  path: '/project-templates',      group: 'Calendar',  keywords: ['templates', 'new project', 'scaffold'] },

  // ── Delivery ──────────────────────────────────────────────────────────────
  { label: 'PODs',               path: '/pods',                   group: 'Delivery',  keywords: ['pods', 'teams', 'squads', 'groups'] },
  { label: 'Budget & CapEx',     path: '/reports/budget-capex',   group: 'Delivery',  keywords: ['budget', 'capex', 'finance', 'money', 'cost'], featureFlag: 'financials' },
  { label: 'Smart Insights',     path: '/smart-insights',         group: 'Delivery',  keywords: ['insights', 'ai', 'recommendations', 'smart'] },
  { label: 'Engineering Hub',    path: '/engineering/hub',        group: 'Delivery',  keywords: ['engineering', 'dora', 'velocity', 'hub'], featureFlag: 'engineering' },
  { label: 'DORA Metrics',       path: '/reports/dora',           group: 'Delivery',  keywords: ['dora', 'deploy', 'lead time', 'mttr', 'change fail'], featureFlag: 'engineering' },
  { label: 'Engineering Intelligence', path: '/reports/engineering-intelligence', group: 'Delivery', keywords: ['engineering', 'ai', 'intelligence'], featureFlag: 'engineering' },
  { label: 'Delivery Predictability', path: '/reports/delivery-predictability', group: 'Delivery', keywords: ['predictability', 'forecast', 'delivery'] },

  // ── Jira ──────────────────────────────────────────────────────────────────
  { label: 'POD Dashboard',      path: '/delivery/jira',                      group: 'Jira', keywords: ['jira', 'pod', 'dashboard', 'sprint board'], featureFlag: 'jira' },
  { label: 'Sprint Backlog',     path: '/sprint-backlog',                     group: 'Jira', keywords: ['backlog', 'sprint', 'stories', 'tickets'], featureFlag: 'jira' },
  { label: 'Sprint Retro',       path: '/reports/sprint-retro',               group: 'Jira', keywords: ['retro', 'retrospective', 'sprint review'], featureFlag: 'jira' },
  { label: 'Releases',           path: '/delivery/releases',                  group: 'Jira', keywords: ['releases', 'versions', 'deployments'], featureFlag: 'jira' },
  { label: 'Jira Analytics',     path: '/reports/jira-analytics',             group: 'Jira', keywords: ['jira', 'analytics', 'tickets', 'velocity'], featureFlag: 'jira' },
  { label: 'Dashboard Builder',  path: '/reports/jira-dashboard-builder',     group: 'Jira', keywords: ['dashboard', 'builder', 'custom', 'widgets'], featureFlag: 'jira' },
  { label: 'Portfolio Sync',     path: '/reports/jira-portfolio-sync',        group: 'Jira', keywords: ['sync', 'jira', 'portfolio', 'integration'], featureFlag: 'jira' },
  { label: 'Status Updates',     path: '/reports/status-updates',             group: 'Jira', keywords: ['status', 'updates', 'feed'], featureFlag: 'jira' },

  // ── Admin / Tools ─────────────────────────────────────────────────────────
  { label: 'Approval Queue',     path: '/approvals',             group: 'Admin', keywords: ['approvals', 'queue', 'pending', 'review'] },
  { label: 'Scenario Tools',     path: '/tools/scenarios',       group: 'Admin', keywords: ['simulator', 'scenario', 'what-if', 'timeline sim'], featureFlag: 'simulations' },
  { label: 'Automation Engine',  path: '/automation-engine',     group: 'Admin', keywords: ['automation', 'rules', 'triggers', 'bots'] },
  { label: 'Smart Notifications',path: '/reports/smart-notifications', group: 'Admin', keywords: ['notifications', 'alerts', 'smart', 'ai'], featureFlag: 'ai' },
  { label: 'Custom Dashboard',   path: '/custom-dashboard',      group: 'Admin', keywords: ['dashboard', 'custom', 'widgets', 'builder'] },
  { label: 'Bulk Import',        path: '/bulk-import',           group: 'Admin', keywords: ['import', 'csv', 'bulk', 'upload'] },

  // ── Settings ──────────────────────────────────────────────────────────────
  { label: 'Organisation Settings', path: '/settings/org',       group: 'Settings', keywords: ['org', 'branding', 'config', 'organisation'] },
  { label: 'User Management',    path: '/settings/users',        group: 'Settings', keywords: ['users', 'roles', 'permissions', 'team'] },
  { label: 'Jira Settings',      path: '/settings/jira',         group: 'Settings', keywords: ['jira', 'integration', 'api', 'connect'] },
  { label: 'Jira Credentials',   path: '/settings/jira-credentials', group: 'Settings', keywords: ['jira', 'token', 'credentials', 'api key'] },
  { label: 'Resource Mapping',   path: '/settings/jira-resource-mapping', group: 'Settings', keywords: ['mapping', 'jira', 'resource', 'user match'] },
  { label: 'Release Mapping',    path: '/settings/jira-release-mapping',  group: 'Settings', keywords: ['release', 'mapping', 'jira', 'version'] },
  { label: 'Support Boards',     path: '/settings/support-boards',group: 'Settings', keywords: ['support', 'boards', 'jira', 'service desk'] },
  { label: 'Email Templates',    path: '/settings/email-templates',group: 'Settings', keywords: ['email', 'templates', 'notifications'] },
  { label: 'Notification Prefs', path: '/settings/notification-preferences', group: 'Settings', keywords: ['notifications', 'email', 'alerts'] },
  { label: 'Custom Fields',      path: '/settings/custom-fields',group: 'Settings', keywords: ['fields', 'custom', 'metadata', 'attributes'] },
  { label: 'Webhooks',           path: '/settings/webhooks',     group: 'Settings', keywords: ['webhooks', 'integrations', 'events', 'callbacks'] },
  { label: 'Audit Log',          path: '/settings/audit-log',    group: 'Settings', keywords: ['audit', 'log', 'history', 'trail'] },
  { label: 'Changelog',          path: '/settings/changelog',    group: 'Settings', keywords: ['changelog', 'releases', 'updates', 'what\'s new'] },
  { label: 'Sidebar Order',      path: '/settings/sidebar-order',group: 'Settings', keywords: ['sidebar', 'order', 'navigation', 'customise'] },
  { label: 'Smart Mapping',      path: '/settings/smart-mapping',group: 'Settings', keywords: ['smart', 'nlp', 'mapping', 'ai'], featureFlag: 'ai' },
  { label: 'Reference Data',     path: '/settings/ref-data',     group: 'Settings', keywords: ['ref data', 'lookup', 'dropdown values'] },
  { label: 'NLP Optimizer',      path: '/settings/nlp-optimizer',group: 'Settings', keywords: ['nlp', 'ai', 'training', 'optimize'], featureFlag: 'ai' },
  { label: 'NLP Settings',       path: '/settings/nlp',          group: 'Settings', keywords: ['nlp', 'ai', 'language', 'settings'], featureFlag: 'ai' },
  { label: 'Feedback Hub',       path: '/settings/feedback',     group: 'Settings', keywords: ['feedback', 'suggestions', 'bug reports'] },
  { label: 'Release Settings',   path: '/settings/releases',     group: 'Settings', keywords: ['releases', 'jira', 'version', 'settings'] },
  { label: 'Azure DevOps',       path: '/settings/azure-devops', group: 'Settings', keywords: ['azure', 'devops', 'ado', 'integration'] },
  { label: 'Timeline Settings',  path: '/settings/timeline',     group: 'Settings', keywords: ['timeline', 'gantt', 'settings'] },
  { label: 'DB Tables',          path: '/settings/tables',       group: 'Settings', keywords: ['database', 'tables', 'admin', 'debug'] },
  { label: 'Error Logs',         path: '/settings/error-logs',   group: 'Settings', keywords: ['errors', 'logs', 'debug', 'monitoring'] },
];

/** Get unique nav groups in display order */
export const NAV_GROUPS = Array.from(new Set(NAV_ITEMS.map(i => i.group)));
