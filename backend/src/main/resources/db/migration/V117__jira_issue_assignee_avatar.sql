-- Add assignee avatar URL to jira_issue for display in Sprint Backlog
ALTER TABLE jira_issue ADD COLUMN IF NOT EXISTS assignee_avatar_url VARCHAR(512);
