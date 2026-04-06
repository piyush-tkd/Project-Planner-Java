-- V110: Password reset token table
-- One-time tokens issued by POST /api/auth/forgot-password.
-- Tokens expire after 1 hour and are single-use.
CREATE TABLE password_reset_token (
    id         BIGSERIAL    PRIMARY KEY,
    token      VARCHAR(64)  NOT NULL UNIQUE,
    username   VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_token ON password_reset_token(token);
