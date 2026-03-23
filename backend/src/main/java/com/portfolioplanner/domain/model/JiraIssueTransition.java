package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_issue_transition")
@Getter @Setter @NoArgsConstructor
public class JiraIssueTransition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(name = "from_status")
    private String fromStatus;

    @Column(name = "from_category")
    private String fromCategory;

    @Column(name = "to_status")
    private String toStatus;

    @Column(name = "to_category")
    private String toCategory;

    @Column(name = "transitioned_at", nullable = false)
    private LocalDateTime transitionedAt;

    @Column(name = "author_name")
    private String authorName;
}
