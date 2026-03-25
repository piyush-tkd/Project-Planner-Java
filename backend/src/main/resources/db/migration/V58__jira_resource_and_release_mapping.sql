-- Add optional email to resource table for better Jira matching
ALTER TABLE resource ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Jira Resource Mapping: links Jira display names to billable resources
CREATE TABLE IF NOT EXISTS jira_resource_mapping (
    id                BIGSERIAL    PRIMARY KEY,
    jira_display_name VARCHAR(255) NOT NULL,
    jira_account_id   VARCHAR(255),
    resource_id       BIGINT       REFERENCES resource(id) ON DELETE SET NULL,
    mapping_type      VARCHAR(20)  NOT NULL DEFAULT 'AUTO',   -- AUTO | MANUAL | EXCLUDED
    confidence        DOUBLE PRECISION DEFAULT 0.0,
    confirmed         BOOLEAN      NOT NULL DEFAULT false,
    created_at        TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_jira_resource_mapping_name UNIQUE (jira_display_name)
);

CREATE INDEX idx_jira_resource_mapping_resource ON jira_resource_mapping(resource_id);

-- Jira Release Mapping: links release calendar entries to Jira fix versions
CREATE TABLE IF NOT EXISTS jira_release_mapping (
    id                  BIGSERIAL    PRIMARY KEY,
    release_calendar_id BIGINT       NOT NULL REFERENCES release_calendar(id) ON DELETE CASCADE,
    jira_version_name   VARCHAR(255) NOT NULL,
    jira_project_key    VARCHAR(64),
    mapping_type        VARCHAR(20)  NOT NULL DEFAULT 'AUTO',   -- AUTO | MANUAL
    confidence          DOUBLE PRECISION DEFAULT 0.0,
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_jira_release_mapping UNIQUE (release_calendar_id, jira_version_name, jira_project_key)
);

CREATE INDEX idx_jira_release_mapping_calendar ON jira_release_mapping(release_calendar_id);

-- Page permissions for the new mapper pages
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'jira_resource_mapping', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'jira_resource_mapping', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'jira_release_mapping',  true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'jira_release_mapping',  true) ON CONFLICT (role, page_key) DO NOTHING;
