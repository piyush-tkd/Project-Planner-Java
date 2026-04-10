-- V115: Configurable email templates
-- Stores per-org HTML body and subject overrides for email templates.
-- When a row exists for (org_id, template_name) the application uses the
-- stored subject/html_body in place of the Thymeleaf file on disk.
-- Variables in body/subject use {{variableName}} mustache-style syntax.

CREATE TABLE IF NOT EXISTS email_template_override (
    id            BIGSERIAL PRIMARY KEY,
    org_id        BIGINT        NOT NULL DEFAULT 1,
    template_name VARCHAR(100)  NOT NULL,               -- e.g. "approval-pending"
    subject       VARCHAR(500),                          -- null = use default subject
    html_body     TEXT,                                  -- null = use Thymeleaf file
    description   VARCHAR(500),                          -- human-readable description
    updated_at    TIMESTAMP     NOT NULL DEFAULT now(),
    CONSTRAINT uq_email_template_org UNIQUE (org_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_email_tmpl_org_name ON email_template_override(org_id, template_name);
