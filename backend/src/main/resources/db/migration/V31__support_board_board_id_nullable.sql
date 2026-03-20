-- Allow boards to be configured via project_key + queue_id without a board_id.
-- The original DDL in V19 created board_id as NOT NULL UNIQUE, but since V29
-- added project_key / queue_id as the preferred lookup mechanism, board_id
-- should be optional.

ALTER TABLE jira_support_board
    ALTER COLUMN board_id DROP NOT NULL;
