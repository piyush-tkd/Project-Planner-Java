-- V102: Project Comments — threaded discussion per project
-- Supports top-level comments and one level of replies (parent_id)

CREATE TABLE project_comment (
    id          BIGSERIAL    PRIMARY KEY,
    project_id  BIGINT       NOT NULL,
    parent_id   BIGINT       REFERENCES project_comment(id) ON DELETE CASCADE,
    author      VARCHAR(255) NOT NULL,
    body        TEXT         NOT NULL,
    edited      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_comment_project   ON project_comment (project_id);
CREATE INDEX idx_project_comment_parent    ON project_comment (parent_id);
CREATE INDEX idx_project_comment_created   ON project_comment (created_at DESC);

COMMENT ON TABLE project_comment IS 'Threaded comments and replies on projects';
