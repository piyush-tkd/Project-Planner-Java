/**
 * navRegistry.ts — Pure-data navigation registry (no JSX).
 *
 * Single source of truth for all nav items. Used by:
 *  - AppShell sidebar (renders with icons)
 *  - CommandPalette (fuzzy search + navigate)
 *  - routeBreadcrumbs (cross-reference)
 *
 * v30.0 — Restructured from 82 items / 8 sections → ~40 items / 6 sections.
 * Removed items are NOT deleted — they remain accessible via hub tabs or redirects.
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

  // ── HOME (4 items) ────────────────────────────────────────────────────────
  { label: 'Dashboard',          path: '/',                    group: 'Home',     keywords: ['home', 'overview', 'summary'] },
  { label: 'Inbox',              path: '/inbox',               group: 'Home',     keywords: ['notifications', 'alerts', 'messages'] },
  { label: 'Ask AI',             path: '/nlp',                 group: 'Home',     keywords: ['ai', 'nlp', 'assistant', 'chat', 'gpt'], featureFlag: 'ai' },
  { label: 'AI Content Studio',  path: '/ai-content-studio',   group: 'Home',     keywords: ['ai', 'content', 'generate', 'email', 'studio'], featureFlag: 'ai' },

  // ── PORTFOLIO (8 items) ───────────────────────────────────────────────────
  { label: 'Projects',           path: '/projects',                  group: 'Portfolio', keywords: ['project list', 'all projects', 'kanban', 'board'] },
  { label: 'Portfolio Health',   path: '/portfolio/health',          group: 'Portfolio', keywords: ['rag', 'red amber green', 'health', 'project health', 'status updates'] },
  { label: 'Objectives',         path: '/objectives',                group: 'Portfolio', keywords: ['okr', 'goals', 'key results'], featureFlag: 'okr' },
  { label: 'Risk & Issues',      path: '/risk-register',             group: 'Portfolio', keywords: ['risks', 'issues', 'register', 'blockers'], featureFlag: 'risk' },
  { label: 'Risk Heatmap',       path: '/reports/risk-heatmap',      group: 'Portfolio', keywords: ['risk', 'heatmap', 'red flags', 'likelihood', 'impact'] },
  { label: 'Dependencies',       path: '/reports/dependency-map',    group: 'Portfolio', keywords: ['dependencies', 'cross-pod', 'blockers', 'gantt', 'dependency map'] },
  { label: 'Timeline',           path: '/portfolio/timeline',        group: 'Portfolio', keywords: ['gantt', 'roadmap', 'timeline', 'schedule', 'advanced timeline'] },
  { label: 'Executive Summary',  path: '/reports/executive-summary', group: 'Portfolio', keywords: ['exec', 'board report', 'summary', 'kpi'] },

  // ── TEAMS & RESOURCES (8 items) ───────────────────────────────────────────
  { label: 'People',             path: '/people/resources',          group: 'Teams & Resources', keywords: ['people', 'resources', 'team', 'staff', 'directory', 'bookings', 'availability'] },
  { label: 'Capacity',           path: '/people/capacity',           group: 'Teams & Resources', keywords: ['capacity', 'bandwidth', 'availability', 'workload', 'hub'] },
  { label: 'Performance',        path: '/people/performance',        group: 'Teams & Resources', keywords: ['performance', 'kpi', 'velocity', 'resource intelligence'], featureFlag: 'advanced_people' },
  { label: 'Skills Matrix',      path: '/skills-matrix',             group: 'Teams & Resources', keywords: ['skills', 'competencies', 'matrix', 'expertise'], featureFlag: 'advanced_people' },
  { label: 'Team Pulse',         path: '/reports/team-pulse',        group: 'Teams & Resources', keywords: ['pulse', 'morale', 'sentiment', 'team health'], featureFlag: 'advanced_people' },
  { label: 'Leave Hub',          path: '/leave',                     group: 'Teams & Resources', keywords: ['leave', 'pto', 'holiday', 'vacation', 'absence'] },
  { label: 'Workforce Planning', path: '/demand-forecast',           group: 'Teams & Resources', keywords: ['demand', 'hiring', 'forecast', 'supply', 'resource pools', 'headcount'] },

  // ── DELIVERY & SPRINTS (8 items) ──────────────────────────────────────────
  { label: 'PODs',               path: '/pods',                      group: 'Delivery & Sprints', keywords: ['pods', 'teams', 'squads', 'groups'] },
  { label: 'Sprint Planner',     path: '/sprint-planner',            group: 'Delivery & Sprints', keywords: ['sprint', 'planning', 'sprint plan', 'allocate'] },
  { label: 'Sprint Backlog',     path: '/sprint-backlog',            group: 'Delivery & Sprints', keywords: ['backlog', 'sprint', 'stories', 'tickets'], featureFlag: 'jira' },
  { label: 'Sprint Retro',       path: '/reports/sprint-retro',      group: 'Delivery & Sprints', keywords: ['retro', 'retrospective', 'sprint review'], featureFlag: 'jira' },
  { label: 'Releases',           path: '/delivery/releases',         group: 'Delivery & Sprints', keywords: ['releases', 'versions', 'deployments', 'release calendar'], featureFlag: 'jira' },
  { label: 'Calendar',           path: '/calendar',                  group: 'Delivery & Sprints', keywords: ['calendar', 'schedule', 'plan', 'strategic', 'team calendar', 'sprint calendar'] },
  { label: 'Engineering Hub',    path: '/engineering/hub',           group: 'Delivery & Sprints', keywords: ['engineering', 'dora', 'velocity', 'hub', 'intelligence', 'predictability'], featureFlag: 'engineering' },
  { label: 'Ideas Board',        path: '/ideas',                     group: 'Delivery & Sprints', keywords: ['ideas', 'backlog', 'innovation', 'suggestions'], featureFlag: 'ideas' },

  // ── FINANCE (4 items) ─────────────────────────────────────────────────────
  { label: 'Budget & CapEx',        path: '/reports/budget-capex',   group: 'Finance', keywords: ['budget', 'capex', 'finance', 'money', 'cost'], featureFlag: 'financials' },
  { label: 'Engineering Economics', path: '/engineering-economics',  group: 'Finance', keywords: ['economics', 'engineering', 'spend', 'value', 'roi'], featureFlag: 'financials' },
  { label: 'ROI Calculator',        path: '/roi-calculator',         group: 'Finance', keywords: ['roi', 'return', 'investment', 'calculator'], featureFlag: 'financials' },
  { label: 'Scenario Planning',     path: '/scenario-planning',      group: 'Finance', keywords: ['scenario', 'what-if', 'planning', 'simulator'], featureFlag: 'simulations' },

  // ── ADMIN (6 items) ───────────────────────────────────────────────────────
  { label: 'Settings',           path: '/settings/org',              group: 'Admin', keywords: ['org', 'branding', 'config', 'organisation', 'general settings'] },
  { label: 'Jira Dashboard',     path: '/delivery/jira',             group: 'Admin', keywords: ['jira', 'pod dashboard', 'sprint board', 'actuals', 'support queue'], featureFlag: 'jira' },
  { label: 'Approval Queue',     path: '/approvals',                 group: 'Admin', keywords: ['approvals', 'queue', 'pending', 'review'] },
  { label: 'Automation Engine',  path: '/automation-engine',         group: 'Admin', keywords: ['automation', 'rules', 'triggers', 'bots'] },
  { label: 'Smart Notifications',path: '/reports/smart-notifications',group: 'Admin', keywords: ['notifications', 'alerts', 'smart', 'ai'], featureFlag: 'ai' },
  { label: 'Smart Insights',     path: '/smart-insights',            group: 'Admin', keywords: ['insights', 'ai', 'recommendations', 'smart'] },

];

/** Get unique nav groups in display order */
export const NAV_GROUPS = Array.from(new Set(NAV_ITEMS.map(i => i.group)));
