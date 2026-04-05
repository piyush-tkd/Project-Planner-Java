-- V94: App changelog — admin-managed versioned release notes
CREATE TABLE IF NOT EXISTS app_changelog (
    id           BIGSERIAL    PRIMARY KEY,
    version      VARCHAR(20)  NOT NULL,
    title        VARCHAR(200) NOT NULL,
    description  TEXT         NOT NULL,
    change_type  VARCHAR(30)  NOT NULL DEFAULT 'feature'
                     CHECK (change_type IN ('feature','improvement','fix','breaking')),
    published    BOOLEAN      NOT NULL DEFAULT false,
    created_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_changelog_published ON app_changelog(published, created_at DESC);
