-- ============================================================================
-- V54: Jira Issue Sync Tables
-- Store all Jira issues locally for fast DB-backed analytics
-- ============================================================================

-- ── Sync status tracker ─────────────────────────────────────────────────────
CREATE TABLE jira_sync_status (
    id              BIGSERIAL PRIMARY KEY,
    project_key     VARCHAR(64)  NOT NULL,
    board_type      VARCHAR(20)  NOT NULL DEFAULT 'STANDARD',  -- STANDARD | SUPPORT
    last_sync_at    TIMESTAMP,
    last_full_sync  TIMESTAMP,                                  -- last time we did a full re-sync
    issues_synced   INTEGER      DEFAULT 0,
    status          VARCHAR(20)  NOT NULL DEFAULT 'IDLE',       -- IDLE | RUNNING | FAILED
    error_message   TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_sync_status_project UNIQUE (project_key, board_type)
);

-- ── Main issue table ────────────────────────────────────────────────────────
CREATE TABLE jira_issue (
    id                      BIGSERIAL PRIMARY KEY,
    jira_id                 VARCHAR(20)   NOT NULL,     -- Jira internal ID
    issue_key               VARCHAR(30)   NOT NULL,     -- e.g. BGENG-1234
    project_key             VARCHAR(64)   NOT NULL,
    summary                 TEXT,
    issue_type              VARCHAR(100),
    issue_type_icon_url     VARCHAR(500),
    is_subtask              BOOLEAN       DEFAULT false,
    status_name             VARCHAR(100),
    status_category         VARCHAR(30),                -- 'new','indeterminate','done','undefined'
    priority_name           VARCHAR(50),
    priority_icon_url       VARCHAR(500),
    assignee_account_id     VARCHAR(128),
    assignee_display_name   VARCHAR(255),
    reporter_account_id     VARCHAR(128),
    reporter_display_name   VARCHAR(255),
    creator_display_name    VARCHAR(255),
    resolution              VARCHAR(100),
    -- Time tracking (stored in seconds from Jira)
    time_original_estimate  BIGINT,
    time_estimate           BIGINT,                     -- remaining estimate
    time_spent              BIGINT,
    -- Story points (we resolve from multiple custom fields)
    story_points            DOUBLE PRECISION,
    -- Dates
    created_at              TIMESTAMP,
    updated_at              TIMESTAMP,
    resolution_date         TIMESTAMP,
    due_date                DATE,
    -- Parent / Epic
    parent_key              VARCHAR(30),                -- next-gen epic parent
    epic_key                VARCHAR(30),                -- classic epic link (customfield_10014)
    epic_name               VARCHAR(500),
    -- Sprint info (current sprint)
    sprint_id               BIGINT,
    sprint_name             VARCHAR(255),
    sprint_state            VARCHAR(30),                -- active, closed, future
    sprint_start_date       TIMESTAMP,
    sprint_end_date         TIMESTAMP,
    -- Aggregations stored for convenience
    description_length      INTEGER       DEFAULT 0,    -- length of description text
    comment_count           INTEGER       DEFAULT 0,
    -- Metadata
    synced_at               TIMESTAMP     NOT NULL DEFAULT now(),

    CONSTRAINT uq_jira_issue_key UNIQUE (issue_key)
);

CREATE INDEX idx_jira_issue_project     ON jira_issue(project_key);
CREATE INDEX idx_jira_issue_type        ON jira_issue(issue_type);
CREATE INDEX idx_jira_issue_status_cat  ON jira_issue(status_category);
CREATE INDEX idx_jira_issue_priority    ON jira_issue(priority_name);
CREATE INDEX idx_jira_issue_assignee    ON jira_issue(assignee_display_name);
CREATE INDEX idx_jira_issue_created     ON jira_issue(created_at);
CREATE INDEX idx_jira_issue_resolved    ON jira_issue(resolution_date);
CREATE INDEX idx_jira_issue_sprint      ON jira_issue(sprint_id);
CREATE INDEX idx_jira_issue_parent      ON jira_issue(parent_key);
CREATE INDEX idx_jira_issue_epic        ON jira_issue(epic_key);
CREATE INDEX idx_jira_issue_synced      ON jira_issue(synced_at);

-- ── Labels (many-to-many) ───────────────────────────────────────────────────
CREATE TABLE jira_issue_label (
    id          BIGSERIAL PRIMARY KEY,
    issue_key   VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    label       VARCHAR(255) NOT NULL,
    CONSTRAINT uq_issue_label UNIQUE (issue_key, label)
);
CREATE INDEX idx_jira_issue_label_key ON jira_issue_label(issue_key);
CREATE INDEX idx_jira_issue_label_val ON jira_issue_label(label);

-- ── Components (many-to-many) ───────────────────────────────────────────────
CREATE TABLE jira_issue_component (
    id             BIGSERIAL PRIMARY KEY,
    issue_key      VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    component_name VARCHAR(255) NOT NULL,
    CONSTRAINT uq_issue_component UNIQUE (issue_key, component_name)
);
CREATE INDEX idx_jira_issue_comp_key ON jira_issue_component(issue_key);

-- ── Fix Versions (many-to-many) ─────────────────────────────────────────────
CREATE TABLE jira_issue_fix_version (
    id            BIGSERIAL PRIMARY KEY,
    issue_key     VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    version_name  VARCHAR(255) NOT NULL,
    version_id    VARCHAR(30),
    released      BOOLEAN      DEFAULT false,
    release_date  DATE,
    CONSTRAINT uq_issue_fix_version UNIQUE (issue_key, version_name)
);
CREATE INDEX idx_jira_issue_fv_key ON jira_issue_fix_version(issue_key);
CREATE INDEX idx_jira_issue_fv_name ON jira_issue_fix_version(version_name);

-- ── Custom fields (EAV pattern for arbitrary fields) ────────────────────────
CREATE TABLE jira_issue_custom_field (
    id           BIGSERIAL PRIMARY KEY,
    issue_key    VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    field_id     VARCHAR(100) NOT NULL,     -- e.g. customfield_10060
    field_name   VARCHAR(255),              -- human-readable name
    field_value  TEXT,                       -- serialized value (string, number, or JSON)
    field_type   VARCHAR(50),               -- string, number, array, option, user, date
    CONSTRAINT uq_issue_custom_field UNIQUE (issue_key, field_id)
);
CREATE INDEX idx_jira_icf_key    ON jira_issue_custom_field(issue_key);
CREATE INDEX idx_jira_icf_field  ON jira_issue_custom_field(field_id);
CREATE INDEX idx_jira_icf_value  ON jira_issue_custom_field(field_value) WHERE field_value IS NOT NULL;

-- ── Worklogs ────────────────────────────────────────────────────────────────
CREATE TABLE jira_issue_worklog (
    id                  BIGSERIAL PRIMARY KEY,
    worklog_jira_id     VARCHAR(30)  NOT NULL,       -- Jira worklog ID
    issue_key           VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    author_account_id   VARCHAR(128),
    author_display_name VARCHAR(255),
    time_spent_seconds  BIGINT       NOT NULL,
    started             TIMESTAMP    NOT NULL,
    created             TIMESTAMP,
    updated             TIMESTAMP,
    comment             TEXT,
    CONSTRAINT uq_worklog_jira_id UNIQUE (worklog_jira_id)
);
CREATE INDEX idx_jira_wl_issue   ON jira_issue_worklog(issue_key);
CREATE INDEX idx_jira_wl_author  ON jira_issue_worklog(author_display_name);
CREATE INDEX idx_jira_wl_started ON jira_issue_worklog(started);

-- ── Status change history (for cycle time, flow metrics) ────────────────────
CREATE TABLE jira_issue_transition (
    id                BIGSERIAL PRIMARY KEY,
    issue_key         VARCHAR(30)  NOT NULL REFERENCES jira_issue(issue_key) ON DELETE CASCADE,
    from_status       VARCHAR(100),
    from_category     VARCHAR(30),
    to_status         VARCHAR(100),
    to_category       VARCHAR(30),
    transitioned_at   TIMESTAMP    NOT NULL,
    author_name       VARCHAR(255),
    CONSTRAINT uq_issue_transition UNIQUE (issue_key, transitioned_at, to_status)
);
CREATE INDEX idx_jira_trans_issue ON jira_issue_transition(issue_key);
CREATE INDEX idx_jira_trans_at    ON jira_issue_transition(transitioned_at);
CREATE INDEX idx_jira_trans_to    ON jira_issue_transition(to_category);

-- ── Sprints (denormalized for cross-board queries) ──────────────────────────
CREATE TABLE jira_sprint (
    id             BIGSERIAL PRIMARY KEY,
    sprint_jira_id BIGINT       NOT NULL,
    board_id       BIGINT,
    name           VARCHAR(255) NOT NULL,
    state          VARCHAR(30),             -- active, closed, future
    start_date     TIMESTAMP,
    end_date       TIMESTAMP,
    complete_date  TIMESTAMP,
    goal           TEXT,
    project_key    VARCHAR(64),
    synced_at      TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_sprint_jira_id UNIQUE (sprint_jira_id)
);
CREATE INDEX idx_jira_sprint_project ON jira_sprint(project_key);
CREATE INDEX idx_jira_sprint_state   ON jira_sprint(state);

-- ── Sprint-Issue mapping (many-to-many, issue can be in multiple sprints) ───
CREATE TABLE jira_sprint_issue (
    id            BIGSERIAL PRIMARY KEY,
    sprint_jira_id BIGINT      NOT NULL,
    issue_key     VARCHAR(30)  NOT NULL,
    CONSTRAINT uq_sprint_issue UNIQUE (sprint_jira_id, issue_key)
);
CREATE INDEX idx_jira_si_sprint ON jira_sprint_issue(sprint_jira_id);
CREATE INDEX idx_jira_si_issue  ON jira_sprint_issue(issue_key);

-- ── Page permissions for new sync status page ───────────────────────────────
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'jira_sync', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'jira_sync', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('ADMIN',      'jira_sync', true) ON CONFLICT (role, page_key) DO NOTHING;
