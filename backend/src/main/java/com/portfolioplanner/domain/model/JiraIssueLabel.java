package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "jira_issue_label")
@Getter @Setter @NoArgsConstructor
public class JiraIssueLabel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(nullable = false)
    private String label;

    public JiraIssueLabel(String issueKey, String label) {
        this.issueKey = issueKey;
        this.label = label;
    }
}
