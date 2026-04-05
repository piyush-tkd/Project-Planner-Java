-- V84: SMTP configuration stored in DB so admins can configure email delivery via the UI.
-- One row only (singleton pattern via id=1 with ON CONFLICT DO UPDATE).

CREATE TABLE smtp_config (
    id              BIGINT PRIMARY KEY DEFAULT 1,
    host            VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
    port            INTEGER      NOT NULL DEFAULT 587,
    username        VARCHAR(255) NOT NULL DEFAULT '',
    -- password stored as-is; encrypt at the application layer if required
    password        VARCHAR(1000)        DEFAULT '',
    from_address    VARCHAR(255) NOT NULL DEFAULT 'noreply@portfolioplanner',
    use_tls         BOOLEAN      NOT NULL DEFAULT TRUE,
    enabled         BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMP            DEFAULT NOW()
);

-- Insert the default row so there is always exactly one row to read/update
INSERT INTO smtp_config (id, host, port, username, password, from_address, use_tls, enabled)
VALUES (1, 'smtp.gmail.com', 587, '', '', 'noreply@portfolioplanner', true, false)
ON CONFLICT (id) DO NOTHING;
