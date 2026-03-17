-- POD watchlist: which Jira project spaces the POD Dashboard should track,
-- and what display name (POD name) to use for each.
CREATE TABLE jira_pod_watch (
    id              BIGSERIAL PRIMARY KEY,
    jira_project_key VARCHAR(64) NOT NULL UNIQUE,
    pod_display_name VARCHAR(255) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jira_pod_watch_enabled ON jira_pod_watch(enabled);
