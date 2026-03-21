-- V38: Add missing sprint_planner page permission and fix NLP page permissions
-- to use the correct READ_WRITE / READ_ONLY roles (consistent with all other pages).

-- Sprint Planner was missing from page_permission entirely
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'sprint_planner', true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'sprint_planner', true)  ON CONFLICT (role, page_key) DO NOTHING;

-- NLP pages: V37 seeded with ADMIN/USER roles instead of READ_WRITE/READ_ONLY.
-- Add proper role entries so non-admin users can access these pages.
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'nlp_landing',  true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'nlp_landing',  true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'nlp_settings', true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'nlp_settings', false) ON CONFLICT (role, page_key) DO NOTHING;
