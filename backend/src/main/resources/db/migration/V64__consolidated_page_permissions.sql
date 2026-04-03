-- V64: Add page permissions for the three new consolidated pages
-- dependency_map   = Cross-POD Deps + Team Dependencies merged
-- portfolio_timeline = Roadmap + Gantt + Team Calendar merged
-- resource_intelligence = Resource Allocation + POD Matrix + ROI + Forecast merged

INSERT INTO page_permission (role, page_key, allowed)
VALUES
  ('READ_WRITE', 'dependency_map',        true),
  ('READ_ONLY',  'dependency_map',        true),
  ('READ_WRITE', 'portfolio_timeline',    true),
  ('READ_ONLY',  'portfolio_timeline',    true),
  ('READ_WRITE', 'resource_intelligence', true),
  ('READ_ONLY',  'resource_intelligence', true)
ON CONFLICT (role, page_key) DO NOTHING;
