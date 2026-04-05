-- V98: Add Jira epic-sync schedule columns to the singleton notification_schedule row.
-- jira_sync_enabled controls whether the auto-sync cron fires.
-- jira_sync_cron    is a Spring cron expression; default = every 2 hours.

ALTER TABLE notification_schedule
    ADD COLUMN IF NOT EXISTS jira_sync_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS jira_sync_cron    VARCHAR(100) NOT NULL DEFAULT '0 0 */2 * * *';

-- Ensure the singleton row exists so the scheduler can always read it
INSERT INTO notification_schedule (id, recipients, digest_enabled, digest_cron,
                                   staleness_enabled, staleness_cron,
                                   jira_sync_enabled, jira_sync_cron)
VALUES (1, '', FALSE, '0 0 8 * * MON',
           FALSE, '0 0 9 * * MON',
           FALSE, '0 0 */2 * * *')
ON CONFLICT (id) DO UPDATE
    SET jira_sync_enabled = EXCLUDED.jira_sync_enabled,   -- keep FALSE on first run
        jira_sync_cron    = COALESCE(
            NULLIF(notification_schedule.jira_sync_cron, ''), '0 0 */2 * * *'
        );
