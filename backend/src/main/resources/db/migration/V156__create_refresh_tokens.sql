-- Phase 2.1: Refresh-token table for the rotating refresh-token flow.
--
-- Raw tokens are NEVER stored here — only a SHA-256 hex hash.
-- The browser holds the raw token in an HttpOnly cookie; on /api/auth/refresh the
-- server hashes the incoming value and does a lookup.

CREATE TABLE refresh_tokens (
    id          BIGSERIAL     PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)   NOT NULL UNIQUE,   -- SHA-256 hex (64 chars)
    issued_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP     NOT NULL,
    revoked     BOOLEAN       NOT NULL DEFAULT FALSE,
    user_agent  VARCHAR(500)
);

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
