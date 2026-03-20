-- Add optional release notes text to each tracked release version
ALTER TABLE jira_pod_release ADD COLUMN IF NOT EXISTS notes TEXT;
