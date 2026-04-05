-- V89: Link strategic objectives to projects for auto-computed progress
CREATE TABLE IF NOT EXISTS objective_project_link (
    id              BIGSERIAL PRIMARY KEY,
    objective_id    BIGINT NOT NULL REFERENCES strategic_objective(id) ON DELETE CASCADE,
    project_id      BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_obj_project UNIQUE (objective_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_opl_objective ON objective_project_link(objective_id);
CREATE INDEX IF NOT EXISTS idx_opl_project   ON objective_project_link(project_id);
