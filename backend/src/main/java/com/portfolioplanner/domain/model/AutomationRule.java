package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * User-defined automation rule: trigger → optional condition → action.
 *
 * Trigger events: PROJECT_STATUS_CHANGED | TARGET_DATE_PASSED | PROJECT_CREATED
 *                 UTILIZATION_EXCEEDED   | SPRINT_STARTED     | RESOURCE_OVERALLOCATED
 *
 * Action types:  SEND_NOTIFICATION | FLAG_PROJECT | CHANGE_STATUS | LOG_ACTIVITY | ADD_RISK
 */
@Entity
@Table(name = "automation_rule")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutomationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    // ── Trigger ──────────────────────────────────────────────────────────────

    @Column(name = "trigger_event", nullable = false, length = 100)
    private String triggerEvent;

    /** Optional: specific value that must match for the trigger to fire.
     *  E.g. for PROJECT_STATUS_CHANGED → "ON_HOLD" means only fire when new status = ON_HOLD */
    @Column(name = "trigger_value", length = 255)
    private String triggerValue;

    // ── Optional extra condition ──────────────────────────────────────────────

    @Column(name = "condition_field", length = 100)
    private String conditionField;

    @Column(name = "condition_operator", length = 50)
    private String conditionOperator;

    @Column(name = "condition_value", length = 255)
    private String conditionValue;

    // ── Action ───────────────────────────────────────────────────────────────

    @Column(name = "action_type", nullable = false, length = 100)
    private String actionType;

    /** Flexible JSON payload, keyed by action type:
     *  SEND_NOTIFICATION → {recipients, message}
     *  CHANGE_STATUS     → {newStatus}
     *  FLAG_PROJECT      → {flagColor, reason}
     *  LOG_ACTIVITY      → {logMessage}
     *  ADD_RISK          → {title, severity}
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "action_payload", columnDefinition = "jsonb")
    private Map<String, Object> actionPayload;

    // ── Stats ─────────────────────────────────────────────────────────────────

    @Column(name = "last_fired_at")
    private LocalDateTime lastFiredAt;

    @Column(name = "fire_count", nullable = false)
    private int fireCount = 0;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
