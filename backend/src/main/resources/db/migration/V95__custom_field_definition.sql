-- V95: Custom field definitions — admin-configurable metadata fields for projects
CREATE TABLE IF NOT EXISTS custom_field_definition (
    id           BIGSERIAL    PRIMARY KEY,
    field_name   VARCHAR(100) NOT NULL UNIQUE,
    field_label  VARCHAR(100) NOT NULL,
    field_type   VARCHAR(20)  NOT NULL
                     CHECK (field_type IN ('text','number','date','select')),
    options_json TEXT,   -- JSON array of string options for 'select' type
    required     BOOLEAN NOT NULL DEFAULT false,
    sort_order   INT     NOT NULL DEFAULT 0,
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);
