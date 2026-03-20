-- ── User management additions ─────────────────────────────────────────────────

-- Add optional display name to app_user
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS display_name VARCHAR(150);

-- ── Page permissions table ────────────────────────────────────────────────────
-- Stores which pages each non-admin role is allowed to access.
-- ADMIN role is always granted all pages and never has rows here.
-- page_key values: dashboard, resources, projects, pods, availability,
--   overrides, reports, jira_pods, jira_releases, jira_capex,
--   jira_actuals, simulators, settings

CREATE TABLE page_permission (
    id         BIGSERIAL    PRIMARY KEY,
    role       VARCHAR(50)  NOT NULL,
    page_key   VARCHAR(100) NOT NULL,
    allowed    BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_page_permission UNIQUE (role, page_key)
);

-- ── READ_WRITE defaults: everything except settings ───────────────────────────
INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('READ_WRITE', 'dashboard',     true),
  ('READ_WRITE', 'resources',     true),
  ('READ_WRITE', 'projects',      true),
  ('READ_WRITE', 'pods',          true),
  ('READ_WRITE', 'availability',  true),
  ('READ_WRITE', 'overrides',     true),
  ('READ_WRITE', 'reports',       true),
  ('READ_WRITE', 'jira_pods',     true),
  ('READ_WRITE', 'jira_releases', true),
  ('READ_WRITE', 'jira_capex',    true),
  ('READ_WRITE', 'jira_actuals',  true),
  ('READ_WRITE', 'simulators',    true),
  ('READ_WRITE', 'settings',      false);

-- ── READ_ONLY defaults: read/reports only, no data entry or settings ──────────
INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('READ_ONLY', 'dashboard',     true),
  ('READ_ONLY', 'resources',     false),
  ('READ_ONLY', 'projects',      false),
  ('READ_ONLY', 'pods',          false),
  ('READ_ONLY', 'availability',  false),
  ('READ_ONLY', 'overrides',     false),
  ('READ_ONLY', 'reports',       true),
  ('READ_ONLY', 'jira_pods',     true),
  ('READ_ONLY', 'jira_releases', true),
  ('READ_ONLY', 'jira_capex',    true),
  ('READ_ONLY', 'jira_actuals',  true),
  ('READ_ONLY', 'simulators',    true),
  ('READ_ONLY', 'settings',      false);
