-- Stores how each Portfolio Planner project maps to a Jira epic/label
CREATE TABLE jira_project_mapping (
    id                  BIGSERIAL PRIMARY KEY,
    pp_project_id       BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    jira_project_key    VARCHAR(64) NOT NULL,          -- e.g. "BGENG"
    match_type          VARCHAR(32) NOT NULL DEFAULT 'EPIC_NAME',  -- EPIC_NAME | LABEL | PROJECT_NAME
    match_value         VARCHAR(255) NOT NULL,          -- epic name or label value
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (pp_project_id, jira_project_key)
);

-- Caches the last sync result per mapping so the UI can show freshness
CREATE TABLE jira_sync_log (
    id                  BIGSERIAL PRIMARY KEY,
    mapping_id          BIGINT NOT NULL REFERENCES jira_project_mapping(id) ON DELETE CASCADE,
    synced_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    status              VARCHAR(32) NOT NULL DEFAULT 'OK',   -- OK | ERROR
    issues_found        INT NOT NULL DEFAULT 0,
    error_message       TEXT
);
