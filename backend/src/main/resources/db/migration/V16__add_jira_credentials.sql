-- Stores user-entered Jira credentials so they can be configured from the UI
-- instead of requiring manual application-local.yml edits.
-- A single row (id=1) is upserted via the service.
CREATE TABLE IF NOT EXISTS jira_credentials (
    id          BIGINT PRIMARY KEY DEFAULT 1,
    base_url    VARCHAR(500),
    email       VARCHAR(255),
    api_token   TEXT,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
