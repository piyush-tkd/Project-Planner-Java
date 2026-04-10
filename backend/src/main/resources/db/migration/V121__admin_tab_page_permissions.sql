-- V121: Add page_permission entries for the 5 granular Admin tabs introduced
-- in the OrgSettingsPage 5-tab restructure (Sprint 5 unplanned work).
-- The generic 'org_settings' key is kept for backward compat (maps to General tab).
-- Admin tabs are restricted to ADMIN role only.

INSERT INTO page_permission (role, page_key, allowed) VALUES
  -- General tab (same scope as legacy org_settings)
  ('ADMIN',      'org_settings_general',       true),
  ('READ_WRITE', 'org_settings_general',        false),
  ('READ_ONLY',  'org_settings_general',        false),

  -- Users & Access tab (manage users — admin only)
  ('ADMIN',      'org_settings_users',          true),
  ('READ_WRITE', 'org_settings_users',          false),
  ('READ_ONLY',  'org_settings_users',          false),

  -- Integrations tab (SSO, webhooks — admin only)
  ('ADMIN',      'org_settings_integrations',   true),
  ('READ_WRITE', 'org_settings_integrations',   false),
  ('READ_ONLY',  'org_settings_integrations',   false),

  -- Notifications & Email tab (email templates — admin only)
  ('ADMIN',      'org_settings_notifications',  true),
  ('READ_WRITE', 'org_settings_notifications',  false),
  ('READ_ONLY',  'org_settings_notifications',  false),

  -- System tab (migrations, feature flags — admin only)
  ('ADMIN',      'org_settings_system',         true),
  ('READ_WRITE', 'org_settings_system',         false),
  ('READ_ONLY',  'org_settings_system',         false)

ON CONFLICT (role, page_key) DO NOTHING;
