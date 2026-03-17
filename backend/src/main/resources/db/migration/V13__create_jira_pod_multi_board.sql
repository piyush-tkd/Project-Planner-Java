-- V13: Replace single-board jira_pod_watch with a proper POD → boards model.
-- A POD (logical team) can now own multiple Jira project boards.

CREATE TABLE jira_pod (
    id               BIGSERIAL PRIMARY KEY,
    pod_display_name VARCHAR(255) NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMP,
    updated_at       TIMESTAMP
);

CREATE TABLE jira_pod_board (
    id               BIGSERIAL PRIMARY KEY,
    pod_id           BIGINT NOT NULL REFERENCES jira_pod(id) ON DELETE CASCADE,
    jira_project_key VARCHAR(64) NOT NULL,
    CONSTRAINT uq_jira_pod_board_key UNIQUE (jira_project_key)
);

-- Migrate existing jira_pod_watch data.
-- Each distinct pod_display_name becomes one jira_pod row; its project key(s) become jira_pod_board rows.
INSERT INTO jira_pod (pod_display_name, enabled, sort_order, created_at, updated_at)
SELECT DISTINCT
    pod_display_name,
    bool_or(enabled),
    MIN(sort_order),
    NOW(),
    NOW()
FROM jira_pod_watch
GROUP BY pod_display_name
ORDER BY MIN(sort_order), pod_display_name;

INSERT INTO jira_pod_board (pod_id, jira_project_key)
SELECT jp.id, jw.jira_project_key
FROM jira_pod_watch jw
JOIN jira_pod jp ON jp.pod_display_name = jw.pod_display_name;
