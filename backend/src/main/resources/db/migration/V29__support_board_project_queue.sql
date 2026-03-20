-- Add project_key and queue_id to jira_support_board so boards can be
-- configured by Jira project key (e.g. "AC") and optional JSM queue ID
-- instead of relying solely on the numeric service-desk ID.

ALTER TABLE jira_support_board
    ADD COLUMN IF NOT EXISTS project_key VARCHAR(50),
    ADD COLUMN IF NOT EXISTS queue_id    BIGINT;
