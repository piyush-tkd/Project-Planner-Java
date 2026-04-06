-- V103: Notification Preferences — per-user opt-in/out for event types

CREATE TABLE notification_preference (
    id              BIGSERIAL    PRIMARY KEY,
    username        VARCHAR(255) NOT NULL,

    -- In-app event toggles
    on_status_change        BOOLEAN NOT NULL DEFAULT TRUE,
    on_risk_added           BOOLEAN NOT NULL DEFAULT TRUE,
    on_comment_mention      BOOLEAN NOT NULL DEFAULT TRUE,
    on_sprint_start         BOOLEAN NOT NULL DEFAULT FALSE,
    on_automation_fired     BOOLEAN NOT NULL DEFAULT FALSE,
    on_target_date_passed   BOOLEAN NOT NULL DEFAULT TRUE,

    -- Email delivery settings
    email_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    email_digest            VARCHAR(20) NOT NULL DEFAULT 'NONE',
    -- NONE | DAILY | WEEKLY

    -- Quiet hours (24h format, nullable = no quiet hours)
    quiet_start_hour  INTEGER,  -- 0–23
    quiet_end_hour    INTEGER,  -- 0–23

    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT uq_notif_pref_user UNIQUE (username)
);

CREATE INDEX idx_notif_pref_username ON notification_preference (username);

COMMENT ON TABLE notification_preference IS 'Per-user notification delivery preferences';
