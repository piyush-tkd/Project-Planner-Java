-- V152: Page permissions for Sitemap and Quality Config pages
INSERT INTO page_permission (role, page_key, allowed)
VALUES
  ('ADMIN',      'sitemap',        true),
  ('READ_WRITE', 'sitemap',        true),
  ('READ_ONLY',  'sitemap',        true),
  ('ADMIN',      'quality_config', true),
  ('READ_WRITE', 'quality_config', true),
  ('READ_ONLY',  'quality_config', false)
ON CONFLICT (role, page_key) DO UPDATE SET allowed = EXCLUDED.allowed;
