-- V79: Add page_permission rows for the new Azure DevOps settings page
--      and the unified Engineering Intelligence page.

INSERT INTO page_permission (role, page_key, allowed) VALUES
  -- Azure DevOps Settings (admin-only)
  ('ADMIN',      'azure_devops_settings',   true),
  ('READ_WRITE', 'azure_devops_settings',   false),
  ('READ_ONLY',  'azure_devops_settings',   false),
  -- Engineering Intelligence (merged Financial + Productivity + Git tabs)
  ('READ_WRITE', 'engineering_intelligence', true),
  ('READ_ONLY',  'engineering_intelligence', true)
ON CONFLICT (role, page_key) DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
