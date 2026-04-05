-- V92: Project status updates (weekly RAG posts per project)
CREATE TABLE IF NOT EXISTS project_status_update (
    id          BIGSERIAL    PRIMARY KEY,
    project_id  BIGINT       NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    rag_status  VARCHAR(10)  NOT NULL CHECK (rag_status IN ('RED','AMBER','GREEN')),
    summary     TEXT         NOT NULL,
    what_done   TEXT,
    whats_next  TEXT,
    blockers    TEXT,
    author      VARCHAR(120),
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psu_project_created
    ON project_status_update(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_psu_created
    ON project_status_update(created_at DESC);
