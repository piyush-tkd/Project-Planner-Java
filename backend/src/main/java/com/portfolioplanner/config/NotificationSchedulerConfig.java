package com.portfolioplanner.config;

import com.portfolioplanner.service.InsightService;
import com.portfolioplanner.service.NotificationScheduleService;
import com.portfolioplanner.service.SupportStalenessService;
import com.portfolioplanner.service.WeeklyDigestService;
import com.portfolioplanner.service.jira.JiraEpicSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronTrigger;

/**
 * Registers dynamic cron triggers for the weekly digest and support staleness alerts.
 *
 * <p>Unlike {@code @Scheduled(cron = "...")}, these triggers re-read the cron expression
 * from the database on each scheduling cycle.  This means admins can change the schedule
 * in Admin Settings and the new schedule takes effect at the next tick — no restart needed.
 *
 * <p>Each trigger also checks the {@code enabled} flag at run-time so toggling a notification
 * off/on via the UI takes effect immediately.
 *
 * <p>Requires {@code @EnableScheduling} on the application class (already present on
 * {@link com.portfolioplanner.PortfolioPlannerApplication}).
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class NotificationSchedulerConfig implements SchedulingConfigurer {

    private final NotificationScheduleService notificationScheduleService;
    private final WeeklyDigestService          weeklyDigestService;
    private final SupportStalenessService      supportStalenessService;
    private final InsightService               insightService;
    private final JiraEpicSyncService          jiraEpicSyncService;

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {

        // ── Weekly digest ─────────────────────────────────────────────────────
        registrar.addTriggerTask(
            () -> {
                if (notificationScheduleService.load().isDigestEnabled()) {
                    log.info("NotificationSchedulerConfig: running scheduled weekly digest");
                    weeklyDigestService.sendWeeklyDigest();
                } else {
                    log.debug("NotificationSchedulerConfig: weekly digest disabled, skipping");
                }
            },
            triggerContext -> {
                String cron = notificationScheduleService.load().getDigestCron();
                try {
                    return new CronTrigger(cron).nextExecution(triggerContext);
                } catch (IllegalArgumentException e) {
                    log.warn("NotificationSchedulerConfig: invalid digest cron '{}', defaulting to weekly Monday 08:00", cron);
                    return new CronTrigger("0 0 8 * * MON").nextExecution(triggerContext);
                }
            }
        );

        // ── AI Insights Engine — runs daily at 07:00 ─────────────────────────
        registrar.addCronTask(
            () -> {
                log.info("NotificationSchedulerConfig: running daily insight detection");
                try {
                    insightService.runDetectors();
                } catch (Exception e) {
                    log.error("NotificationSchedulerConfig: insight detection failed – {}", e.getMessage(), e);
                }
            },
            "0 0 7 * * *"   // every day at 07:00
        );

        // ── Support staleness alert ───────────────────────────────────────────
        registrar.addTriggerTask(
            () -> {
                if (notificationScheduleService.load().isStalenessEnabled()) {
                    log.info("NotificationSchedulerConfig: running scheduled staleness alert");
                    supportStalenessService.sendStalenessAlert();
                } else {
                    log.debug("NotificationSchedulerConfig: staleness alert disabled, skipping");
                }
            },
            triggerContext -> {
                String cron = notificationScheduleService.load().getStalenessCron();
                try {
                    return new CronTrigger(cron).nextExecution(triggerContext);
                } catch (IllegalArgumentException e) {
                    log.warn("NotificationSchedulerConfig: invalid staleness cron '{}', defaulting to weekly Monday 09:00", cron);
                    return new CronTrigger("0 0 9 * * MON").nextExecution(triggerContext);
                }
            }
        );

        // ── Jira epic auto-sync ───────────────────────────────────────────────
        registrar.addTriggerTask(
            () -> {
                if (notificationScheduleService.load().isJiraSyncEnabled()) {
                    log.info("NotificationSchedulerConfig: running scheduled Jira epic sync");
                    try {
                        JiraEpicSyncService.SyncResult result = jiraEpicSyncService.syncAllBoards();
                        log.info("NotificationSchedulerConfig: Jira sync done — created={}, updated={}, failed={}",
                                result.created(), result.updated(), result.failed());
                    } catch (Exception e) {
                        log.error("NotificationSchedulerConfig: Jira epic sync failed — {}", e.getMessage(), e);
                    }
                } else {
                    log.debug("NotificationSchedulerConfig: Jira epic sync disabled, skipping");
                }
            },
            triggerContext -> {
                String cron = notificationScheduleService.load().getJiraSyncCron();
                try {
                    return new CronTrigger(cron).nextExecution(triggerContext);
                } catch (IllegalArgumentException e) {
                    log.warn("NotificationSchedulerConfig: invalid jira sync cron '{}', defaulting to every 2 hours", cron);
                    return new CronTrigger("0 0 */2 * * *").nextExecution(triggerContext);
                }
            }
        );
    }
}
