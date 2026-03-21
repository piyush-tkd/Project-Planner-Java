-- V37: NLP configuration table for the NLP Landing Page feature.
-- Stores strategy chain, LLM provider settings, and tuning parameters.
-- Also adds page permission entries for the new NLP pages.

CREATE TABLE nlp_config (
    id           BIGSERIAL PRIMARY KEY,
    config_key   VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default configuration (rule-based only, no LLM required)
INSERT INTO nlp_config (config_key, config_value) VALUES
  ('strategy_chain',          '["RULE_BASED"]'),
  ('confidence_threshold',    '0.75'),
  ('cloud_provider',          'ANTHROPIC'),
  ('cloud_model',             'claude-haiku-4-5-20251001'),
  ('cloud_api_key',           ''),
  ('local_model_url',         'http://localhost:11434'),
  ('local_model',             'llama3:8b'),
  ('local_timeout_ms',        '10000'),
  ('cache_enabled',           'true'),
  ('cache_ttl_minutes',       '5'),
  ('log_queries',             'true'),
  ('max_timeout_ms',          '5000');

-- NLP query log for analytics and prompt tuning
CREATE TABLE nlp_query_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES app_user(id),
    query_text      TEXT NOT NULL,
    intent          VARCHAR(50),
    confidence      DOUBLE PRECISION,
    resolved_by     VARCHAR(50),
    response_ms     INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nlp_query_log_user     ON nlp_query_log(user_id);
CREATE INDEX idx_nlp_query_log_intent   ON nlp_query_log(intent);
CREATE INDEX idx_nlp_query_log_created  ON nlp_query_log(created_at);

-- Page permissions for NLP landing page and NLP settings
INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('ADMIN', 'nlp_landing', true),
  ('USER',  'nlp_landing', true),
  ('ADMIN', 'nlp_settings', true)
ON CONFLICT (role, page_key) DO NOTHING;
