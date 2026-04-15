-- V149: Fix the V148 backfill.
-- V148 added the added_at column with DEFAULT NOW(), so ALL existing rows
-- got today's timestamp. Since sprints started before today, this caused
-- every issue to appear as scope creep (100%).
--
-- Fix: set added_at = sprint.start_date for rows that were backfilled today.
-- This means pre-existing sprint assignments look like they were present
-- from sprint start — not scope creep. Only genuinely new additions recorded
-- by the sync service AFTER this migration will have added_at > start_date.

UPDATE jira_sprint_issue jsi
SET    added_at = COALESCE(
           (SELECT start_date
            FROM   jira_sprint js
            WHERE  js.sprint_jira_id = jsi.sprint_jira_id),
           jsi.added_at
       )
WHERE  jsi.added_at::date >= (CURRENT_DATE - INTERVAL '1 day');

-- Verify: after this runs, scope creep count should be 0 for all active sprints
-- until the next Jira sync adds genuinely new issues mid-sprint.
