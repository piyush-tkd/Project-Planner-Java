CREATE TABLE project_actual (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES project(id),
    month_key       INTEGER NOT NULL,
    actual_hours    NUMERIC(10,2) NOT NULL,
    UNIQUE (project_id, month_key)
);
