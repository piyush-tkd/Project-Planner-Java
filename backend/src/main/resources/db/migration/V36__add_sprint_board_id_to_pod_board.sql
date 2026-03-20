-- Add optional Jira board ID override to jira_pod_board.
-- When set, this board ID is used directly for sprint fetching
-- instead of looking up boards via the project key API,
-- which can fail when the Scrum board is associated with a
-- different project than the ticket project keys.
ALTER TABLE jira_pod_board
    ADD COLUMN IF NOT EXISTS sprint_board_id BIGINT;
