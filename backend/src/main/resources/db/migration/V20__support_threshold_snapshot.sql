-- Per-board configurable staleness threshold (business days, default 3)
ALTER TABLE jira_support_board
    ADD COLUMN stale_threshold_days INT NOT NULL DEFAULT 3;

-- Daily health snapshots per board — powers the trend chart
CREATE TABLE jira_support_snapshot (
    id            BIGSERIAL    PRIMARY KEY,
    board_id      BIGINT       NOT NULL REFERENCES jira_support_board(id) ON DELETE CASCADE,
    snapshot_date DATE         NOT NULL,
    open_count    INT          NOT NULL DEFAULT 0,
    stale_count   INT          NOT NULL DEFAULT 0,
    avg_age_days  NUMERIC(6,1) NOT NULL DEFAULT 0,
    UNIQUE (board_id, snapshot_date)
);

CREATE INDEX idx_support_snapshot_board_date ON jira_support_snapshot (board_id, snapshot_date);
