-- Sprint 15: Advanced Timeline – Baseline Snapshots
-- Captures a point-in-time snapshot of a project's planned dates / hours so
-- "planned vs actual" comparisons can be shown on the Gantt.

CREATE TABLE project_baseline (
    id               BIGSERIAL    PRIMARY KEY,
    project_id       BIGINT       NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    label            VARCHAR(255) NOT NULL,
    snapped_by       VARCHAR(255) NOT NULL,
    planned_start    DATE,
    planned_target   DATE,
    planned_hours    NUMERIC(10,2),
    snapped_at       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_baseline_project ON project_baseline (project_id);
CREATE INDEX idx_project_baseline_snapped ON project_baseline (snapped_at DESC);
