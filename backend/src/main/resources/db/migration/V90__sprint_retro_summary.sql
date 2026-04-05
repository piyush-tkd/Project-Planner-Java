-- V90: Sprint retrospective summary table
CREATE TABLE IF NOT EXISTS sprint_retro_summary (
    id               BIGSERIAL PRIMARY KEY,
    sprint_jira_id   BIGINT NOT NULL,
    sprint_name      VARCHAR(255) NOT NULL,
    project_key      VARCHAR(50),
    board_id         BIGINT,
    -- Metrics computed at generation time
    completed_issues INT     NOT NULL DEFAULT 0,
    total_issues     INT     NOT NULL DEFAULT 0,
    story_points_done DECIMAL(10,2),
    velocity_delta_pct DECIMAL(8,2),  -- % change vs prior sprint
    avg_cycle_time_days DECIMAL(8,2),
    -- AI-generated narrative summary
    summary_text     TEXT,
    highlights       TEXT,  -- comma-separated highlight bullets
    concerns         TEXT,  -- comma-separated concern bullets
    generated_at     TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_retro_sprint UNIQUE (sprint_jira_id)
);

CREATE INDEX IF NOT EXISTS idx_retro_project ON sprint_retro_summary(project_key);
CREATE INDEX IF NOT EXISTS idx_retro_generated ON sprint_retro_summary(generated_at DESC);
