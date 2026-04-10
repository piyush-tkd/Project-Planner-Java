package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity @Table(name = "project_value_metrics")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProjectValueMetric {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "metric_type", nullable = false, length = 30)
    private String metricType; // REVENUE, COST_SAVINGS, RISK_REDUCTION, STRATEGIC_VALUE

    @Column(name = "projected_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal projectedValue = BigDecimal.ZERO;

    @Column(name = "actual_value", precision = 15, scale = 2)
    private BigDecimal actualValue;

    @Column(name = "capex_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal capexAmount = BigDecimal.ZERO;

    @Column(name = "opex_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal opexAmount = BigDecimal.ZERO;

    @Column(name = "measurement_period", nullable = false)
    private LocalDate measurementPeriod;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = OffsetDateTime.now(); }
    @PreUpdate
    void preUpdate() { updatedAt = OffsetDateTime.now(); }
}
