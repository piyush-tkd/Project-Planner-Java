-- V14: Release version tracking per POD.
-- A POD can watch multiple Jira fix versions; this table stores those mappings.

CREATE TABLE jira_pod_release (
    id           BIGSERIAL PRIMARY KEY,
    pod_id       BIGINT NOT NULL REFERENCES jira_pod(id) ON DELETE CASCADE,
    version_name VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_jira_pod_release UNIQUE (pod_id, version_name)
);
