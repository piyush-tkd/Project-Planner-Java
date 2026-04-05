-- V99: Smart mapping suggestions for PP ↔ Jira duplicate / near-match detection
CREATE TABLE IF NOT EXISTS smart_mapping_suggestion (
    id               BIGSERIAL PRIMARY KEY,
    pp_project_id    BIGINT       NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    jira_epic_key    VARCHAR(50)  NOT NULL,

    -- Composite score (0–100)
    score            NUMERIC(5,2) NOT NULL,

    -- Individual signal scores (each 0–100)
    name_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    owner_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
    date_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    status_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
    epic_key_bonus   NUMERIC(5,2) NOT NULL DEFAULT 0,

    -- Resolution state
    resolution       VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                         CONSTRAINT sms_resolution_check
                         CHECK (resolution IN ('PENDING', 'LINKED', 'IGNORED')),
    resolved_at      TIMESTAMPTZ  NULL,

    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Each PP project can only have one suggestion per Jira epic key
    CONSTRAINT uq_sms_project_epic UNIQUE (pp_project_id, jira_epic_key)
);

CREATE INDEX IF NOT EXISTS idx_sms_pp_project  ON smart_mapping_suggestion (pp_project_id);
CREATE INDEX IF NOT EXISTS idx_sms_resolution  ON smart_mapping_suggestion (resolution);
CREATE INDEX IF NOT EXISTS idx_sms_score_desc  ON smart_mapping_suggestion (score DESC);
