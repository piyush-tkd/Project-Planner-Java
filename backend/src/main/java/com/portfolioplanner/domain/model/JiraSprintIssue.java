package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.Instant;

/**
 * Many-to-many join between sprints and issues.
 * An issue can appear in multiple sprints (e.g. carried over).
 */
@Entity
@Table(name = "jira_sprint_issue",
       uniqueConstraints = @UniqueConstraint(columnNames = {"sprint_jira_id", "issue_key"}))
@Getter @Setter @NoArgsConstructor
public class JiraSprintIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sprint_jira_id", nullable = false)
    private Long sprintJiraId;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    /** When this issue was first observed in this sprint by the sync service. */
    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    @PrePersist
    void prePersist() {
        if (addedAt == null) addedAt = Instant.now();
    }

    public JiraSprintIssue(Long sprintJiraId, String issueKey) {
        this.sprintJiraId = sprintJiraId;
        this.issueKey = issueKey;
    }
}
