-- V124: Add page_permission entry for the Settings Hub page (/settings).
-- The Settings Hub is a landing page that displays all available settings categories.
-- All roles get access: ADMIN and READ_WRITE can navigate to all settings,
-- READ_ONLY can view the hub but may have restricted access to specific settings pages.

INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('ADMIN',      'settings', true),
  ('READ_WRITE', 'settings', true),
  ('READ_ONLY',  'settings', true)
ON CONFLICT (role, page_key) DO NOTHING;
