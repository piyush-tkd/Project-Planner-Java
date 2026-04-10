package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Outbound webhook endpoint (Slack, Teams, or custom HTTP receiver).
 * Each row represents a configured destination that receives JSON POSTs
 * when matching events fire.
 */
@Entity
@Table(name = "webhook_config")
@Getter @Setter @NoArgsConstructor
public class WebhookConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable label, e.g. "Eng Team Slack" */
    @Column(nullable = false)
    private String name;

    /** Full webhook URL (Slack Incoming Webhook URL, Teams connector URL, etc.) */
    @Column(nullable = false)
    private String url;

    /** SLACK | TEAMS | CUSTOM */
    @Column(nullable = false)
    private String provider = "SLACK";

    /** Optional HMAC-SHA256 signing secret for payload verification */
    @Column
    private String secret;

    @Column(nullable = false)
    private boolean enabled = true;

    /**
     * Comma-separated list of event types subscribed by this webhook.
     * Possible values:
     *   project.status_changed | approval.approved | approval.rejected | automation.rule_fired
     */
    @Column(nullable = false)
    private String events = "project.status_changed,approval.approved,approval.rejected,automation.rule_fired";

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
