package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "jira_issue_component")
@Getter @Setter @NoArgsConstructor
public class JiraIssueComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(name = "component_name", nullable = false)
    private String componentName;

    public JiraIssueComponent(String issueKey, String componentName) {
        this.issueKey = issueKey;
        this.componentName = componentName;
    }
}
