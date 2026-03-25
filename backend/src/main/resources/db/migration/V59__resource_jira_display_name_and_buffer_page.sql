-- Add jira_display_name directly on the resource table (replaces the separate mapping table approach)
ALTER TABLE resource ADD COLUMN IF NOT EXISTS jira_display_name VARCHAR(255);
ALTER TABLE resource ADD COLUMN IF NOT EXISTS jira_account_id   VARCHAR(255);

-- Index for quick lookup (e.g. "is this Jira user already mapped?")
CREATE INDEX IF NOT EXISTS idx_resource_jira_display_name ON resource(jira_display_name);

-- Page permission for the new Buffer page
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'jira_buffer', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'jira_buffer', true) ON CONFLICT (role, page_key) DO NOTHING;
