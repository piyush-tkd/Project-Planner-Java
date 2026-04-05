-- V87: Register page-permission entries for the new admin sub-sections
--      introduced in Phase 2 of the playbook.
--
--      Confirmed NOT in any prior migration:
--        smtp_settings            — SMTP Email Settings tab in OrgSettingsPage (V84)
--        notification_schedule    — Notification Schedule panel in OrgSettingsPage (V85)
--
--      Confirmed already present (no action needed):
--        smart_notifications  → V77  (SmartNotificationsPage + AI Insights engine)
--        gantt_dependencies   → V69  (Gantt & Dependencies page, now live-wired)
--
--      Both new sections are admin-only: non-admin roles are blocked at the
--      backend controller level (@PreAuthorize("hasRole('ADMIN')")), so
--      READ_WRITE / READ_ONLY are intentionally false.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO page_permission (role, page_key, allowed) VALUES
  -- SMTP Email Settings (OrgSettingsPage → Email tab → SMTP card)
  ('ADMIN',      'smtp_settings',          true),
  ('READ_WRITE', 'smtp_settings',          false),
  ('READ_ONLY',  'smtp_settings',          false),
  -- Notification Schedule (OrgSettingsPage → Email tab → Schedule card)
  ('ADMIN',      'notification_schedule',  true),
  ('READ_WRITE', 'notification_schedule',  false),
  ('READ_ONLY',  'notification_schedule',  false)
ON CONFLICT (role, page_key) DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
