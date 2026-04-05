-- V77: Add missing page_permission rows for Analytics pages that were
--      introduced without corresponding permission seeds.
--      Without these, READ_WRITE and READ_ONLY users cannot access these
--      pages even though they should be visible by default.
--
--  Missing pages (confirmed absent from all prior migrations):
--    portfolio_health_dashboard, dora_metrics, jira_analytics,
--    jira_dashboard_builder, engineering_productivity,
--    financial_intelligence, delivery_predictability,
--    smart_notifications, jira_portfolio_sync
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO page_permission (role, page_key, allowed) VALUES
  -- Portfolio Health Dashboard
  ('READ_WRITE', 'portfolio_health_dashboard', true),
  ('READ_ONLY',  'portfolio_health_dashboard', true),
  -- DORA Metrics
  ('READ_WRITE', 'dora_metrics',               true),
  ('READ_ONLY',  'dora_metrics',               true),
  -- Jira Analytics
  ('READ_WRITE', 'jira_analytics',             true),
  ('READ_ONLY',  'jira_analytics',             true),
  -- Jira Dashboard Builder
  ('READ_WRITE', 'jira_dashboard_builder',     true),
  ('READ_ONLY',  'jira_dashboard_builder',     true),
  -- Engineering Productivity
  ('READ_WRITE', 'engineering_productivity',   true),
  ('READ_ONLY',  'engineering_productivity',   true),
  -- Financial Intelligence
  ('READ_WRITE', 'financial_intelligence',     true),
  ('READ_ONLY',  'financial_intelligence',     true),
  -- Delivery Predictability
  ('READ_WRITE', 'delivery_predictability',    true),
  ('READ_ONLY',  'delivery_predictability',    true),
  -- Smart Notifications
  ('READ_WRITE', 'smart_notifications',        true),
  ('READ_ONLY',  'smart_notifications',        true),
  -- Jira Portfolio Sync
  ('READ_WRITE', 'jira_portfolio_sync',        true),
  ('READ_ONLY',  'jira_portfolio_sync',        true)
ON CONFLICT (role, page_key) DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
