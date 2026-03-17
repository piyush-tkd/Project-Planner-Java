package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_project_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"pp_project_id", "jira_project_key"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JiraProjectMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pp_project_id", nullable = false)
    private Project project;

    @Column(name = "jira_project_key", nullable = false, length = 64)
    private String jiraProjectKey;

    /** EPIC_NAME | LABEL | PROJECT_NAME */
    @Column(name = "match_type", nullable = false, length = 32)
    private String matchType = "EPIC_NAME";

    /** The epic name or label value to match */
    @Column(name = "match_value", nullable = false)
    private String matchValue;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
