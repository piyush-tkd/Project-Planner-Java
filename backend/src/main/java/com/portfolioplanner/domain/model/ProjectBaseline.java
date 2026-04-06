package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_baseline")
@Getter @Setter
public class ProjectBaseline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private String label;

    @Column(name = "snapped_by", nullable = false)
    private String snappedBy;

    @Column(name = "planned_start")
    private LocalDate plannedStart;

    @Column(name = "planned_target")
    private LocalDate plannedTarget;

    @Column(name = "planned_hours", precision = 10, scale = 2)
    private BigDecimal plannedHours;

    @Column(name = "snapped_at", nullable = false)
    private LocalDateTime snappedAt = LocalDateTime.now();
}
