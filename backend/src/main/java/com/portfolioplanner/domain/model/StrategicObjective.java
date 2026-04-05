package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "strategic_objective")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StrategicObjective {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 120)
    private String owner;

    /** NOT_STARTED | ON_TRACK | AT_RISK | COMPLETED */
    @Column(nullable = false, length = 30)
    private String status = "NOT_STARTED";

    /** 0–100 percent completion */
    @Column(nullable = false)
    private Integer progress = 0;

    @Column(name = "target_date")
    private LocalDate targetDate;

    /** e.g. Q1-2026 */
    @Column(length = 10)
    private String quarter;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
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
