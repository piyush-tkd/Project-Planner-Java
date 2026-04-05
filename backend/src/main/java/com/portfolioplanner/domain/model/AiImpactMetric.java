package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_impact_metric")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiImpactMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ai_pr_ratio | velocity_delta | cost_per_point | review_cycle_days */
    @Column(name = "metric_type", nullable = false, length = 50)
    private String metricType;

    @Column(name = "pod_name", nullable = false, length = 100)
    private String podName;

    /** ISO year-month: "2026-03" */
    @Column(name = "period", nullable = false, length = 20)
    private String period;

    @Column(name = "value", nullable = false, precision = 12, scale = 4)
    private BigDecimal value;

    @Column(name = "baseline_value", precision = 12, scale = 4)
    private BigDecimal baselineValue;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
