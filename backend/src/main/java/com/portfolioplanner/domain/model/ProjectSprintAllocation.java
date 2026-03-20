package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_sprint_allocation",
        uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "pod_id", "sprint_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectSprintAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pod_id", nullable = false)
    private Pod pod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprint_id", nullable = false)
    private Sprint sprint;

    @Column(name = "dev_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal devHours = BigDecimal.ZERO;

    @Column(name = "qa_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal qaHours = BigDecimal.ZERO;

    @Column(name = "bsa_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal bsaHours = BigDecimal.ZERO;

    @Column(name = "tech_lead_hours", precision = 8, scale = 2, nullable = false)
    private BigDecimal techLeadHours = BigDecimal.ZERO;

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
