-- ── V75: Granular RBAC Privileges ────────────────────────────────────────────
--
-- Replaces the coarse page_permission (role + page_key + allowed boolean) model
-- with a richer privilege model that supports:
--   • section_key  — top-level nav section (e.g. 'data_entry', 'capacity', 'portfolio')
--   • page_key     — individual page within a section (existing keys preserved)
--   • tab_key      — optional sub-tab within a page (NULL = whole page)
--   • access_type  — 'NONE' | 'READ' | 'WRITE'  (WRITE implies READ)
--
-- The existing page_permission table is kept for backward compatibility
-- (the app still reads it during the transition).  The new role_privilege table
-- is the authoritative source going forward.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. New role_privilege table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_privilege (
    id           BIGSERIAL    PRIMARY KEY,
    role         VARCHAR(50)  NOT NULL,
    section_key  VARCHAR(100) NOT NULL,          -- e.g. 'data_entry'
    page_key     VARCHAR(100) NOT NULL,          -- e.g. 'projects'
    tab_key      VARCHAR(100) DEFAULT NULL,      -- e.g. 'detail' or NULL = whole page
    access_type  VARCHAR(20)  NOT NULL           -- 'NONE' | 'READ' | 'WRITE'
                              DEFAULT 'READ'
                              CHECK (access_type IN ('NONE','READ','WRITE')),
    CONSTRAINT uq_role_privilege UNIQUE (role, section_key, page_key, tab_key)
);

-- ── 2. Section definitions (reference — not enforced by FK, kept as comments)
--  Sections:  dashboard | data_entry | strategy | planning | capacity |
--             portfolio | integrations | simulators | admin
--
-- ── 3. SUPER_ADMIN / ADMIN: no rows needed — always granted full WRITE access.

-- ── 4. READ_WRITE defaults ────────────────────────────────────────────────────
-- Full WRITE on everything except admin section (READ there).
INSERT INTO role_privilege (role, section_key, page_key, access_type) VALUES
  -- Dashboard
  ('READ_WRITE', 'dashboard',     'dashboard',         'WRITE'),
  ('READ_WRITE', 'dashboard',     'nlp',               'WRITE'),
  ('READ_WRITE', 'dashboard',     'inbox',             'WRITE'),
  -- Data Entry
  ('READ_WRITE', 'data_entry',    'resources',         'WRITE'),
  ('READ_WRITE', 'data_entry',    'projects',          'WRITE'),
  ('READ_WRITE', 'data_entry',    'pods',              'WRITE'),
  ('READ_WRITE', 'data_entry',    'availability',      'WRITE'),
  ('READ_WRITE', 'data_entry',    'overrides',         'WRITE'),
  ('READ_WRITE', 'data_entry',    'resource_bookings', 'WRITE'),
  ('READ_WRITE', 'data_entry',    'project_templates', 'WRITE'),
  ('READ_WRITE', 'data_entry',    'leave',             'WRITE'),
  -- Strategy
  ('READ_WRITE', 'strategy',      'objectives',        'WRITE'),
  ('READ_WRITE', 'strategy',      'risk_register',     'WRITE'),
  ('READ_WRITE', 'strategy',      'ideas',             'WRITE'),
  -- Planning
  ('READ_WRITE', 'planning',      'calendar',          'WRITE'),
  ('READ_WRITE', 'planning',      'sprint_planner',    'WRITE'),
  -- Capacity
  ('READ_WRITE', 'capacity',      'capacity',          'WRITE'),
  ('READ_WRITE', 'capacity',      'utilization',       'WRITE'),
  ('READ_WRITE', 'capacity',      'hiring_forecast',   'WRITE'),
  ('READ_WRITE', 'capacity',      'capacity_demand',   'WRITE'),
  ('READ_WRITE', 'capacity',      'pod_resources',     'WRITE'),
  ('READ_WRITE', 'capacity',      'pod_capacity',      'WRITE'),
  ('READ_WRITE', 'capacity',      'resource_intel',    'WRITE'),
  ('READ_WRITE', 'capacity',      'workload_chart',    'WRITE'),
  -- Portfolio
  ('READ_WRITE', 'portfolio',     'project_health',    'WRITE'),
  ('READ_WRITE', 'portfolio',     'dependency_map',    'WRITE'),
  ('READ_WRITE', 'portfolio',     'portfolio_timeline','WRITE'),
  ('READ_WRITE', 'portfolio',     'project_signals',   'WRITE'),
  ('READ_WRITE', 'portfolio',     'project_pod_matrix','WRITE'),
  ('READ_WRITE', 'portfolio',     'budget_capex',      'WRITE'),
  ('READ_WRITE', 'portfolio',     'resource_perf',     'WRITE'),
  ('READ_WRITE', 'portfolio',     'pod_hours',         'WRITE'),
  ('READ_WRITE', 'portfolio',     'dora',              'WRITE'),
  ('READ_WRITE', 'portfolio',     'jira_analytics',    'WRITE'),
  ('READ_WRITE', 'portfolio',     'eng_productivity',  'WRITE'),
  ('READ_WRITE', 'portfolio',     'portfolio_health',  'WRITE'),
  ('READ_WRITE', 'portfolio',     'financial_intel',   'WRITE'),
  ('READ_WRITE', 'portfolio',     'delivery_predict',  'WRITE'),
  -- Integrations
  ('READ_WRITE', 'integrations',  'jira_pods',         'WRITE'),
  ('READ_WRITE', 'integrations',  'jira_releases',     'WRITE'),
  ('READ_WRITE', 'integrations',  'release_notes',     'WRITE'),
  ('READ_WRITE', 'integrations',  'jira_actuals',      'WRITE'),
  ('READ_WRITE', 'integrations',  'jira_support',      'WRITE'),
  ('READ_WRITE', 'integrations',  'jira_worklog',      'WRITE'),
  -- Simulators
  ('READ_WRITE', 'simulators',    'timeline_sim',      'WRITE'),
  ('READ_WRITE', 'simulators',    'scenario_sim',      'WRITE'),
  -- Admin: READ only (cannot manage users / settings)
  ('READ_WRITE', 'admin',         'org_settings',      'NONE'),
  ('READ_WRITE', 'admin',         'users',             'NONE'),
  ('READ_WRITE', 'admin',         'audit_log',         'READ')
ON CONFLICT (role, section_key, page_key, tab_key) DO NOTHING;

-- ── 5. READ_ONLY defaults ─────────────────────────────────────────────────────
-- READ on reports/integrations/simulators; NONE on all data-entry and admin.
INSERT INTO role_privilege (role, section_key, page_key, access_type) VALUES
  -- Dashboard
  ('READ_ONLY', 'dashboard',     'dashboard',         'READ'),
  ('READ_ONLY', 'dashboard',     'nlp',               'READ'),
  ('READ_ONLY', 'dashboard',     'inbox',             'READ'),
  -- Data Entry: NONE (cannot create/edit data)
  ('READ_ONLY', 'data_entry',    'resources',         'NONE'),
  ('READ_ONLY', 'data_entry',    'projects',          'NONE'),
  ('READ_ONLY', 'data_entry',    'pods',              'NONE'),
  ('READ_ONLY', 'data_entry',    'availability',      'NONE'),
  ('READ_ONLY', 'data_entry',    'overrides',         'NONE'),
  ('READ_ONLY', 'data_entry',    'resource_bookings', 'NONE'),
  ('READ_ONLY', 'data_entry',    'project_templates', 'NONE'),
  ('READ_ONLY', 'data_entry',    'leave',             'NONE'),
  -- Strategy: READ only
  ('READ_ONLY', 'strategy',      'objectives',        'READ'),
  ('READ_ONLY', 'strategy',      'risk_register',     'READ'),
  ('READ_ONLY', 'strategy',      'ideas',             'READ'),
  -- Planning: READ only
  ('READ_ONLY', 'planning',      'calendar',          'READ'),
  ('READ_ONLY', 'planning',      'sprint_planner',    'READ'),
  -- Capacity: READ
  ('READ_ONLY', 'capacity',      'capacity',          'READ'),
  ('READ_ONLY', 'capacity',      'utilization',       'READ'),
  ('READ_ONLY', 'capacity',      'hiring_forecast',   'READ'),
  ('READ_ONLY', 'capacity',      'capacity_demand',   'READ'),
  ('READ_ONLY', 'capacity',      'pod_resources',     'READ'),
  ('READ_ONLY', 'capacity',      'pod_capacity',      'READ'),
  ('READ_ONLY', 'capacity',      'resource_intel',    'READ'),
  ('READ_ONLY', 'capacity',      'workload_chart',    'READ'),
  -- Portfolio: READ
  ('READ_ONLY', 'portfolio',     'project_health',    'READ'),
  ('READ_ONLY', 'portfolio',     'dependency_map',    'READ'),
  ('READ_ONLY', 'portfolio',     'portfolio_timeline','READ'),
  ('READ_ONLY', 'portfolio',     'project_signals',   'READ'),
  ('READ_ONLY', 'portfolio',     'project_pod_matrix','READ'),
  ('READ_ONLY', 'portfolio',     'budget_capex',      'READ'),
  ('READ_ONLY', 'portfolio',     'resource_perf',     'READ'),
  ('READ_ONLY', 'portfolio',     'pod_hours',         'READ'),
  ('READ_ONLY', 'portfolio',     'dora',              'READ'),
  ('READ_ONLY', 'portfolio',     'jira_analytics',    'READ'),
  ('READ_ONLY', 'portfolio',     'eng_productivity',  'READ'),
  ('READ_ONLY', 'portfolio',     'portfolio_health',  'READ'),
  ('READ_ONLY', 'portfolio',     'financial_intel',   'READ'),
  ('READ_ONLY', 'portfolio',     'delivery_predict',  'READ'),
  -- Integrations: READ
  ('READ_ONLY', 'integrations',  'jira_pods',         'READ'),
  ('READ_ONLY', 'integrations',  'jira_releases',     'READ'),
  ('READ_ONLY', 'integrations',  'release_notes',     'READ'),
  ('READ_ONLY', 'integrations',  'jira_actuals',      'READ'),
  ('READ_ONLY', 'integrations',  'jira_support',      'READ'),
  ('READ_ONLY', 'integrations',  'jira_worklog',      'READ'),
  -- Simulators: READ
  ('READ_ONLY', 'simulators',    'timeline_sim',      'READ'),
  ('READ_ONLY', 'simulators',    'scenario_sim',      'READ'),
  -- Admin: NONE
  ('READ_ONLY', 'admin',         'org_settings',      'NONE'),
  ('READ_ONLY', 'admin',         'users',             'NONE'),
  ('READ_ONLY', 'admin',         'audit_log',         'NONE')
ON CONFLICT (role, section_key, page_key, tab_key) DO NOTHING;

-- ── 6. API endpoint for reading privileges ────────────────────────────────────
-- /api/auth/privileges  → returns role_privilege rows for the logged-in user's role
-- (Controller to be wired separately; this migration only creates the schema.)

-- ── 7. Add page_permissions entries for newly introduced pages (V73 pages)
--     so the existing canAccess() frontend check keeps working in the interim.
INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('READ_WRITE', 'objectives',        true),
  ('READ_WRITE', 'risk_register',     true),
  ('READ_WRITE', 'ideas_board',       true),
  ('READ_WRITE', 'resource_bookings', true),
  ('READ_ONLY',  'objectives',        true),
  ('READ_ONLY',  'risk_register',     true),
  ('READ_ONLY',  'ideas_board',       true),
  ('READ_ONLY',  'resource_bookings', true)
ON CONFLICT (role, page_key) DO NOTHING;
