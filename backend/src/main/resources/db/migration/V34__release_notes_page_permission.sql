-- Release Notes page: shows Jira stories/bugs per fix version
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'release_notes', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'release_notes', true) ON CONFLICT (role, page_key) DO NOTHING;
