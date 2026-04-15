-- V88: Add page permissions for EngineeringAnalyticsPage
--      Route: /reports/engineering-analytics
--      New page providing 5-tab engineering analytics dashboard with quality,
--      productivity, efficiency, tracking, and forecasting metrics.

INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('ADMIN',      'engineering_analytics', true),
  ('READ_WRITE', 'engineering_analytics', true),
  ('READ_ONLY',  'engineering_analytics', true)
ON CONFLICT (role, page_key) DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
