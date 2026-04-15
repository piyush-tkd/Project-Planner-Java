-- V150: Add page_permission for Sprint Quality page
INSERT INTO page_permission (role, page_key, allowed)
VALUES
  ('ADMIN',      'sprint_quality', true),
  ('READ_WRITE', 'sprint_quality', true),
  ('READ_ONLY',  'sprint_quality', true)
ON CONFLICT (role, page_key) DO UPDATE SET allowed = EXCLUDED.allowed;
