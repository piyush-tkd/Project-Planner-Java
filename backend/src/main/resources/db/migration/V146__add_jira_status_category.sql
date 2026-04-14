-- V146: Add jira_status_category column so we can store the raw Jira statusCategory key
-- ("new" / "indeterminate" / "done") separately from the raw status name.
-- The status column already stores the raw Jira status name as of V146 behaviour.
-- jira_status_category is used for business logic (summary cards, kanban grouping)
-- without forcing a mapping of raw names to PP enum values.

ALTER TABLE project ADD COLUMN IF NOT EXISTS jira_status_category VARCHAR(20);
