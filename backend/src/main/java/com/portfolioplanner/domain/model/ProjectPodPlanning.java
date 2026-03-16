package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
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

    @Column(name = "tshirt_size")
    private String tshirtSize;

    @Column(name = "complexity_override", precision = 5, scale = 2)
    private BigDecimal complexityOverride;

    @Column(name = "effort_pattern")
    private String effortPattern;

    @Column(name = "pod_start_month")
    private Integer podStartMonth;

    @Column(name = "duration_override")
    private Integer durationOverride;

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
