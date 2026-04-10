package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sprint_retro_summary")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SprintRetroSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sprint_jira_id", nullable = false, unique = true)
    private Long sprintJiraId;

    @Column(name = "sprint_name", nullable = false)
    private String sprintName;

    @Column(name = "project_key", length = 50)
    private String projectKey;

    @Column(name = "board_id")
    private Long boardId;

    @Column(name = "completed_issues", nullable = false)
    private Integer completedIssues = 0;

    @Column(name = "total_issues", nullable = false)
    private Integer totalIssues = 0;

    @Column(name = "story_points_done")
    private BigDecimal storyPointsDone;

    @Column(name = "velocity_delta_pct")
    private BigDecimal velocityDeltaPct;

    @Column(name = "avg_cycle_time_days")
    private BigDecimal avgCycleTimeDays;

    @Column(name = "summary_text", columnDefinition = "TEXT")
    private String summaryText;

    @Column(name = "highlights", columnDefinition = "TEXT")
    private String highlights;

    @Column(name = "concerns", columnDefinition = "TEXT")
    private String concerns;

    /** Actual end date of the sprint — used to order velocity comparisons chronologically. */
    @Column(name = "sprint_end_date")
    private LocalDateTime sprintEndDate;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @PrePersist
    protected void onCreate() {
        if (generatedAt == null) generatedAt = LocalDateTime.now();
    }
}
