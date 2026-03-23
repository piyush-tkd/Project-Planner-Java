package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_issue_worklog")
@Getter @Setter @NoArgsConstructor
public class JiraIssueWorklog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "worklog_jira_id", nullable = false, unique = true)
    private String worklogJiraId;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(name = "author_account_id")
    private String authorAccountId;

    @Column(name = "author_display_name")
    private String authorDisplayName;

    @Column(name = "time_spent_seconds", nullable = false)
    private Long timeSpentSeconds;

    @Column(nullable = false)
    private LocalDateTime started;

    private LocalDateTime created;
    private LocalDateTime updated;

    @Column(columnDefinition = "TEXT")
    private String comment;
}
