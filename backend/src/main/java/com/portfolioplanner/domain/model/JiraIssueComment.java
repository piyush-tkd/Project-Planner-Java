package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Locally cached Jira issue comment – synced with each issue sync.
 */
@Entity
@Table(name = "jira_issue_comment")
@Getter @Setter @NoArgsConstructor
public class JiraIssueComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "comment_jira_id", nullable = false, unique = true)
    private String commentJiraId;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(name = "author_account_id")
    private String authorAccountId;

    @Column(name = "author_display_name")
    private String authorDisplayName;

    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    private LocalDateTime created;

    private LocalDateTime updated;

    public JiraIssueComment(String commentJiraId, String issueKey, String authorAccountId,
                            String authorDisplayName, String body,
                            LocalDateTime created, LocalDateTime updated) {
        this.commentJiraId = commentJiraId;
        this.issueKey = issueKey;
        this.authorAccountId = authorAccountId;
        this.authorDisplayName = authorDisplayName;
        this.body = body;
        this.created = created;
        this.updated = updated;
    }
}
