package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Time-bounded cost rate for a specific resource (Sprint 12).
 * Table: cost_rates (V120) — distinct from the role-based cost_rate table (V5).
 */
@Entity
@Table(name = "cost_rates")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ResourceCostRate {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resource_id", nullable = false)
    private Resource resource;

    @Column(name = "rate_type", nullable = false, length = 20)
    private String rateType; // HOURLY, DAILY, MONTHLY, ANNUAL

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency = "USD";

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = OffsetDateTime.now(); }
    @PreUpdate
    void preUpdate() { updatedAt = OffsetDateTime.now(); }
}
