-- V22: Per-user widget layout preferences.
-- Stores the ordered widget IDs and hidden widget IDs for each page per user.
-- preferences column is a TEXT column holding a JSON object like:
--   { "order": ["kpi", "trend", "throughput"], "hidden": ["throughput"] }

CREATE TABLE IF NOT EXISTS user_widget_preferences (
    id          BIGSERIAL    PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    page_key    VARCHAR(100) NOT NULL,
    preferences TEXT         NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_widget_preferences UNIQUE (username, page_key)
);

CREATE INDEX IF NOT EXISTS idx_widget_prefs_user ON user_widget_preferences (username);
