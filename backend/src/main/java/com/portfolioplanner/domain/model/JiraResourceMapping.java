package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_resource_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"jira_display_name"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JiraResourceMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "jira_display_name", nullable = false)
    private String jiraDisplayName;

    @Column(name = "jira_account_id")
    private String jiraAccountId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resource_id")
    private Resource resource;

    /** AUTO, MANUAL, or EXCLUDED */
    @Column(name = "mapping_type", nullable = false, length = 20)
    private String mappingType = "AUTO";

    @Column(precision = 4)
    private Double confidence = 0.0;

    @Column(nullable = false)
    private Boolean confirmed = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
