-- V101: Track when an issue was added to a sprint.
-- 'added_at' is set on INSERT only — it records the first time the sync
-- service observed an issue inside a given sprint. If added_at > sprint.start_date,
-- the issue was added after the sprint started (true scope creep).

ALTER TABLE jira_sprint_issue
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing rows: we don't know the real add date, so use NOW().
-- These will not trigger scope creep alerts (added_at ~ sprint sync time).
COMMENT ON COLUMN jira_sprint_issue.added_at IS
  'Timestamp of first sync observation of this issue in this sprint. Used for scope creep detection.';
