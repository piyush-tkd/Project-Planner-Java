-- V161: Add approval notification toggles to notification_preference

ALTER TABLE notification_preference
    ADD COLUMN IF NOT EXISTS on_approval_pending  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS on_approval_decision BOOLEAN NOT NULL DEFAULT FALSE;
