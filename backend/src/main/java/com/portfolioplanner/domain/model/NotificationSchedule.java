package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Singleton row (id = 1) that stores notification scheduling configuration.
 *
 * <p>Admins configure recipients and cron schedules via Admin Settings → Email / SMTP tab.
 * Changes are picked up by {@link com.portfolioplanner.config.NotificationSchedulerConfig}
 * on the next cron evaluation without requiring a restart.
 */
@Entity
@Table(name = "notification_schedule")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationSchedule {

    /** Always 1 — singleton table pattern. */
    @Id
    private Long id = 1L;

    /**
     * Comma-separated list of recipient email addresses.
     * Used by both the weekly digest and the staleness alert.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String recipients = "";

    // ── Weekly digest ────────────────────────────────────────────────────────

    @Column(name = "digest_enabled", nullable = false)
    private boolean digestEnabled = false;

    /** Spring cron expression, e.g. {@code 0 0 8 * * MON} (Monday 08:00). */
    @Column(name = "digest_cron", nullable = false, length = 100)
    private String digestCron = "0 0 8 * * MON";

    // ── Support staleness alert ───────────────────────────────────────────────

    @Column(name = "staleness_enabled", nullable = false)
    private boolean stalenessEnabled = false;

    /** Spring cron expression, e.g. {@code 0 0 9 * * MON} (Monday 09:00). */
    @Column(name = "staleness_cron", nullable = false, length = 100)
    private String stalenessCron = "0 0 9 * * MON";

    // ── Jira epic auto-sync ──────────────────────────────────────────────────

    /** Whether the Jira epic auto-sync cron should fire. */
    @Column(name = "jira_sync_enabled", nullable = false)
    private boolean jiraSyncEnabled = false;

    /** Spring cron expression for Jira epic sync. Default = every 2 hours. */
    @Column(name = "jira_sync_cron", nullable = false, length = 100)
    private String jiraSyncCron = "0 0 */2 * * *";

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }
}
