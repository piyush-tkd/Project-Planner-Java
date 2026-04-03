package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduling_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SchedulingRules {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false, unique = true)
    private Project project;

    @Column(name = "qa_lag_days")
    private Integer qaLagDays = 7;

    @Column(name = "uat_gap_days")
    private Integer uatGapDays = 1;

    @Column(name = "uat_duration_days")
    private Integer uatDurationDays = 5;

    @Column(name = "e2e_gap_days")
    private Integer e2eGapDays = 2;

    @Column(name = "e2e_duration_days")
    private Integer e2eDurationDays = 7;

    // ── Parallelization factors (% of work that can be done in parallel) ──────
    @Column(name = "dev_parallel_pct")
    private Integer devParallelPct = 70;

    @Column(name = "qa_parallel_pct")
    private Integer qaParallelPct = 50;

    @Column(name = "uat_parallel_pct")
    private Integer uatParallelPct = 30;

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
