-- V144: Per-user AI configuration table
-- Allows individual users to store their own cloud AI provider/model/key.
-- Priority: org-level key (nlp_config.cloud_api_key) takes precedence;
-- this table is only used when no org key is configured.

CREATE TABLE IF NOT EXISTS user_ai_config (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(100) NOT NULL UNIQUE,
    provider    VARCHAR(50)  NOT NULL DEFAULT 'ANTHROPIC',
    model       VARCHAR(200) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    api_key     TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_config_username ON user_ai_config(username);

-- Page permission for the personal AI settings page
INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('ADMIN',      'my_ai_settings', true),
  ('READ_WRITE', 'my_ai_settings', true),
  ('READ_ONLY',  'my_ai_settings', true)
ON CONFLICT (role, page_key) DO NOTHING;
