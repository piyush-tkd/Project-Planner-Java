-- V97: Add Jira source-of-truth columns to the project table
-- source_type tracks whether a project was created manually, synced from Jira, or pushed to Jira.
-- jira_epic_key stores the canonical Jira epic key (e.g. PMO-123) when linked.
-- archived allows soft-deletion of unwanted auto-synced projects without destroying data.

ALTER TABLE project
    ADD COLUMN IF NOT EXISTS source_type       VARCHAR(30)  NOT NULL DEFAULT 'MANUAL'
        CONSTRAINT project_source_type_check CHECK (source_type IN ('MANUAL','JIRA_SYNCED','PUSHED_TO_JIRA')),
    ADD COLUMN IF NOT EXISTS jira_epic_key     VARCHAR(50)  NULL,
    ADD COLUMN IF NOT EXISTS jira_board_id     BIGINT       NULL,
    ADD COLUMN IF NOT EXISTS jira_last_synced_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS jira_sync_error   BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS archived          BOOLEAN      NOT NULL DEFAULT FALSE;

-- Unique index: no two PP projects may claim the same Jira epic key
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_jira_epic_key
    ON project (jira_epic_key)
    WHERE jira_epic_key IS NOT NULL;

-- Index for fast archived-project filtering
CREATE INDEX IF NOT EXISTS idx_project_archived ON project (archived);
