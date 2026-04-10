-- V118: Add per-board alert priority configuration to jira_support_board
-- Allows each Support Board to define which Jira priorities trigger alerts in the Inbox

ALTER TABLE jira_support_board
    ADD COLUMN IF NOT EXISTS alert_priorities VARCHAR(500) DEFAULT 'Blocker,Critical,Highest';

COMMENT ON COLUMN jira_support_board.alert_priorities IS
    'Comma-separated list of Jira priority names that trigger inbox alerts for this board. Defaults to Blocker,Critical,Highest.';
