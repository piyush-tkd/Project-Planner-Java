package com.portfolioplanner.domain.model;

import com.portfolioplanner.domain.model.enums.Priority;
import com.portfolioplanner.domain.model.enums.SourceType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;

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

    /** Free-form status string. Well-known values: NOT_STARTED, IN_DISCOVERY, ACTIVE,
     *  ON_HOLD, COMPLETED, CANCELLED. Custom swimlane names are also stored here. */
    @Column(nullable = false, length = 100)
    private String status = "ACTIVE";

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

    // ── Jira source-of-truth fields ──────────────────────────────────────────

    /**
     * Origin of this project record.
     * MANUAL = created in PP; JIRA_SYNCED = auto-discovered from Jira epic;
     * PUSHED_TO_JIRA = started as MANUAL then pushed to Jira via "Create in Jira".
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 30)
    private SourceType sourceType = SourceType.MANUAL;

    /** Jira epic key linked to this project (e.g. PMO-123). Unique when set. */
    @Column(name = "jira_epic_key", length = 50, unique = true)
    private String jiraEpicKey;

    /** Jira Agile board ID from which this epic was synced. */
    @Column(name = "jira_board_id")
    private Long jiraBoardId;

    /** Timestamp of the last successful Jira sync for this project. */
    @Column(name = "jira_last_synced_at")
    private OffsetDateTime jiraLastSyncedAt;

    /** TRUE if the most recent sync attempt for this project failed. */
    @Column(name = "jira_sync_error", nullable = false)
    private boolean jiraSyncError = false;

    /** Soft-delete flag. Archived projects are hidden from normal views. */
    @Column(name = "archived", nullable = false)
    private boolean archived = false;

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
