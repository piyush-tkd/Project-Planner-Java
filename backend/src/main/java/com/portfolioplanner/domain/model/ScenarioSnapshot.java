package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "scenario_snapshots")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScenarioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "total_headcount", nullable = false)
    private Integer totalHeadcount = 0;

    @Column(name = "total_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalCost = BigDecimal.ZERO;

    @Column(name = "capex_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal capexAmount = BigDecimal.ZERO;

    @Column(name = "opex_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal opexAmount = BigDecimal.ZERO;

    @Column(name = "demand_coverage_pct", precision = 5, scale = 2)
    private BigDecimal demandCoveragePct;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
