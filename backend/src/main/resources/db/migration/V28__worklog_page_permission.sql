-- V28: Seed jira_worklog page permission for existing roles
INSERT INTO page_permission (role, page_key, allowed)
VALUES
    ('READ_WRITE', 'jira_worklog', true),
    ('READ_ONLY',  'jira_worklog', true)
ON CONFLICT (role, page_key) DO NOTHING;
