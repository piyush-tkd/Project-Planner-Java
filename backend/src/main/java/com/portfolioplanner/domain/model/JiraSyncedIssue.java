package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Locally cached Jira issue – synced periodically from Jira REST API.
 * Analytics queries run against this table instead of live API calls.
 */
@Entity
@Table(name = "jira_issue")
@Getter @Setter @NoArgsConstructor
public class JiraSyncedIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "jira_id", nullable = false)
    private String jiraId;

    @Column(name = "issue_key", nullable = false, unique = true)
    private String issueKey;

    @Column(name = "project_key", nullable = false)
    private String projectKey;

    private String summary;

    @Column(name = "issue_type")
    private String issueType;

    @Column(name = "issue_type_icon_url")
    private String issueTypeIconUrl;

    @Column(name = "is_subtask")
    private Boolean subtask = false;

    @Column(name = "status_name")
    private String statusName;

    @Column(name = "status_category")
    private String statusCategory;

    @Column(name = "priority_name")
    private String priorityName;

    @Column(name = "priority_icon_url")
    private String priorityIconUrl;

    @Column(name = "assignee_account_id")
    private String assigneeAccountId;

    @Column(name = "assignee_display_name")
    private String assigneeDisplayName;

    @Column(name = "assignee_avatar_url", length = 512)
    private String assigneeAvatarUrl;

    @Column(name = "reporter_account_id")
    private String reporterAccountId;

    @Column(name = "reporter_display_name")
    private String reporterDisplayName;

    @Column(name = "creator_display_name")
    private String creatorDisplayName;

    private String resolution;

    // Time tracking (in seconds)
    @Column(name = "time_original_estimate")
    private Long timeOriginalEstimate;

    @Column(name = "time_estimate")
    private Long timeEstimate;

    @Column(name = "time_spent")
    private Long timeSpent;

    @Column(name = "story_points")
    private Double storyPoints;

    // Dates
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "resolution_date")
    private LocalDateTime resolutionDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    // Epic / Parent
    @Column(name = "parent_key")
    private String parentKey;

    @Column(name = "epic_key")
    private String epicKey;

    @Column(name = "epic_name")
    private String epicName;

    // Sprint
    @Column(name = "sprint_id")
    private Long sprintId;

    @Column(name = "sprint_name")
    private String sprintName;

    @Column(name = "sprint_state")
    private String sprintState;

    @Column(name = "sprint_start_date")
    private LocalDateTime sprintStartDate;

    @Column(name = "sprint_end_date")
    private LocalDateTime sprintEndDate;

    // Description & aggregation helpers
    @Column(name = "description_text", columnDefinition = "TEXT")
    private String descriptionText;

    @Column(name = "description_length")
    private Integer descriptionLength = 0;

    @Column(name = "comment_count")
    private Integer commentCount = 0;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    @PrePersist
    protected void onCreate() {
        if (syncedAt == null) syncedAt = LocalDateTime.now();
    }
}
