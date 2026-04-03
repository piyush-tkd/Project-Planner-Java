package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_pod_planning",
        uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "pod_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectPodPlanning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pod_id", nullable = false)
    private Pod pod;

    /** @deprecated retained for backward-compat; use devHours/qaHours/bsaHours/techLeadHours */
    @Column(name = "tshirt_size")
    private String tshirtSize;

    /** @deprecated retained for backward-compat; use contingencyPct */
    @Column(name = "complexity_override", precision = 5, scale = 2)
    private BigDecimal complexityOverride;

    @Column(name = "effort_pattern")
    private String effortPattern;

    @Column(name = "pod_start_month")
    private Integer podStartMonth;

    @Column(name = "duration_override")
    private Integer durationOverride;

    // ── Role-hours model ──────────────────────────────────────────────────────
    @Column(name = "dev_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal devHours = BigDecimal.ZERO;

    @Column(name = "qa_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal qaHours = BigDecimal.ZERO;

    @Column(name = "bsa_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal bsaHours = BigDecimal.ZERO;

    @Column(name = "tech_lead_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal techLeadHours = BigDecimal.ZERO;

    /** Contingency applied to the total pod-project hours (e.g. 10 = 10%). */
    @Column(name = "contingency_pct", precision = 5, scale = 2, nullable = false)
    private BigDecimal contingencyPct = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_release_id")
    private ReleaseCalendar targetRelease;

    // ── Phase scheduling dates (nullable = not yet scheduled) ────────────────
    @Column(name = "dev_start_date")
    private LocalDate devStartDate;

    @Column(name = "dev_end_date")
    private LocalDate devEndDate;

    @Column(name = "qa_start_date")
    private LocalDate qaStartDate;

    @Column(name = "qa_end_date")
    private LocalDate qaEndDate;

    @Column(name = "uat_start_date")
    private LocalDate uatStartDate;

    @Column(name = "uat_end_date")
    private LocalDate uatEndDate;

    @Column(name = "schedule_locked")
    private Boolean scheduleLocked = false;

    // ── Resource counts (how many people assigned to each phase) ──────────────
    @Column(name = "dev_count")
    private Integer devCount = 1;

    @Column(name = "qa_count")
    private Integer qaCount = 1;

    // ─────────────────────────────────────────────────────────────────────────

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
