-- V100: Seed page_permission records for AI settings pages.
-- Previously these required manual DB inserts; now code-controlled.

INSERT INTO page_permission (role, page_key, allowed)
VALUES
  ('ADMIN',      'my_ai_settings', true),
  ('READ_WRITE', 'my_ai_settings', true),
  ('READ_ONLY',  'my_ai_settings', true),
  ('ADMIN',      'nlp_settings',   true),
  ('READ_WRITE', 'nlp_settings',   true),
  ('READ_ONLY',  'nlp_settings',   false)
ON CONFLICT (role, page_key) DO UPDATE SET allowed = EXCLUDED.allowed;
