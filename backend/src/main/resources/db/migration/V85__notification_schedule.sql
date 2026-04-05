-- V85: Notification schedule configuration stored in DB.
-- Replaces app.digest.* application properties so admins can configure
-- recipients, cron expressions, and enabled flags via the Admin Settings UI.
-- Singleton row (id = 1) — same pattern as smtp_config (V84).

CREATE TABLE notification_schedule (
    id                  BIGINT PRIMARY KEY DEFAULT 1,
    -- Comma-separated list of email addresses for all notifications
    recipients          TEXT         NOT NULL DEFAULT '',
    -- Weekly portfolio digest
    digest_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    digest_cron         VARCHAR(100) NOT NULL DEFAULT '0 0 8 * * MON',
    -- Support-ticket staleness alert
    staleness_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
    staleness_cron      VARCHAR(100) NOT NULL DEFAULT '0 0 9 * * MON',
    updated_at          TIMESTAMP            DEFAULT NOW()
);

-- Seed the default singleton row
INSERT INTO notification_schedule (id, recipients, digest_enabled, digest_cron, staleness_enabled, staleness_cron)
VALUES (1, '', false, '0 0 8 * * MON', false, '0 0 9 * * MON')
ON CONFLICT (id) DO NOTHING;
