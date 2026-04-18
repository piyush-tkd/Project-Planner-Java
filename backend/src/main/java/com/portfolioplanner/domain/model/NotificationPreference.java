package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Per-user notification preferences — which events to receive and via which channel.
 */
@Entity
@Table(name = "notification_preference")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, unique = true, length = 255)
    private String username;

    // ── In-app event toggles ──────────────────────────────────────────────────

    @Column(name = "on_status_change", nullable = false)
    private boolean onStatusChange = true;

    @Column(name = "on_risk_added", nullable = false)
    private boolean onRiskAdded = true;

    @Column(name = "on_comment_mention", nullable = false)
    private boolean onCommentMention = true;

    @Column(name = "on_sprint_start", nullable = false)
    private boolean onSprintStart = false;

    @Column(name = "on_automation_fired", nullable = false)
    private boolean onAutomationFired = false;

    @Column(name = "on_target_date_passed", nullable = false)
    private boolean onTargetDatePassed = true;

    @Column(name = "on_approval_pending", nullable = false)
    private boolean onApprovalPending = false;

    @Column(name = "on_approval_decision", nullable = false)
    private boolean onApprovalDecision = false;

    // ── Email delivery ────────────────────────────────────────────────────────

    @Column(name = "email_enabled", nullable = false)
    private boolean emailEnabled = false;

    /** NONE | DAILY | WEEKLY */
    @Column(name = "email_digest", nullable = false, length = 20)
    private String emailDigest = "NONE";

    // ── Quiet hours ───────────────────────────────────────────────────────────

    @Column(name = "quiet_start_hour")
    private Integer quietStartHour;

    @Column(name = "quiet_end_hour")
    private Integer quietEndHour;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
