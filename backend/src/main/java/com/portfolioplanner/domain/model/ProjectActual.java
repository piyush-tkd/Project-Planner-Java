package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Actual hours logged against a project for a specific month.
 * Imported from the "Actuals" sheet (one row per project, one column per month).
 * monthKey follows the same M1–M12 convention used in Timeline.
 */
@Entity
@Table(name = "project_actual",
       uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "month_key"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectActual {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** M1–M12 matching the Timeline sheet month keys */
    @Column(name = "month_key", nullable = false)
    private Integer monthKey;

    @Column(name = "actual_hours", nullable = false, precision = 10, scale = 2)
    private BigDecimal actualHours;
}
