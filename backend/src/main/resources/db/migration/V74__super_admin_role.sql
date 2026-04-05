-- ── V74: SUPER_ADMIN role ────────────────────────────────────────────────────
-- SUPER_ADMIN bypasses all page-permission checks and has unrestricted access
-- to every feature, endpoint, and data-entry action in the system.
-- The existing 'admin' account (the primary admin user) is promoted to SUPER_ADMIN.

UPDATE app_user
SET    role = 'SUPER_ADMIN'
WHERE  username = 'admin';

-- SUPER_ADMIN inherits every page permission that ADMIN has.
-- Because the frontend/backend both treat SUPER_ADMIN as always-allowed,
-- no page_permission rows are required. Document this for clarity:
-- (SUPER_ADMIN rows in page_permission are intentionally absent — all pages
--  are always accessible regardless of the page_permission table.)
