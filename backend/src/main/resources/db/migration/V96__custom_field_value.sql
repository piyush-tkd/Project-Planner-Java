-- V96: Custom field values — per-project values for each custom field
CREATE TABLE IF NOT EXISTS custom_field_value (
    id           BIGSERIAL PRIMARY KEY,
    field_def_id BIGINT    NOT NULL REFERENCES custom_field_definition(id) ON DELETE CASCADE,
    project_id   BIGINT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    value_text   TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_field_project UNIQUE (field_def_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_cfv_project ON custom_field_value(project_id);
