-- Sprint 15: Approval & Workflow
-- Stage-gate approval requests on projects.

CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE project_approval (
    id               BIGSERIAL       PRIMARY KEY,
    project_id       BIGINT          NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    requested_by     VARCHAR(255)    NOT NULL,
    reviewed_by      VARCHAR(255),
    status           approval_status NOT NULL DEFAULT 'PENDING',
    request_note     TEXT,
    review_comment   TEXT,
    requested_at     TIMESTAMP       NOT NULL DEFAULT now(),
    reviewed_at      TIMESTAMP
);

CREATE INDEX idx_project_approval_project  ON project_approval (project_id);
CREATE INDEX idx_project_approval_requester ON project_approval (requested_by);
CREATE INDEX idx_project_approval_status   ON project_approval (status);
