package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "project")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    private String owner;

    @Column(name = "start_month")
    private Integer startMonth;

    @Column(name = "target_end_month")
    private Integer targetEndMonth;

    @Column(name = "duration_months")
    private Integer durationMonths;

    @Column(name = "default_pattern")
    private String defaultPattern;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectStatus status = ProjectStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_by_id")
    private Project blockedBy;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "capacity_note")
    private String capacityNote;

    /** Optional client name associated with this project (e.g. an external customer). */
    @Column(name = "client", length = 150)
    private String client;

    // ── Project-level milestone dates ────────────────────────────────────────
    @Column(name = "e2e_start_date")
    private LocalDate e2eStartDate;

    @Column(name = "e2e_end_date")
    private LocalDate e2eEndDate;

    @Column(name = "code_freeze_date")
    private LocalDate codeFreezeDateMilestone;

    @Column(name = "release_date")
    private LocalDate releaseDateMilestone;

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
