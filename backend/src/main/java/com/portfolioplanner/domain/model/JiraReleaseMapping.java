package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_release_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"release_calendar_id", "jira_version_name", "jira_project_key"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JiraReleaseMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "release_calendar_id", nullable = false)
    private ReleaseCalendar releaseCalendar;

    @Column(name = "jira_version_name", nullable = false)
    private String jiraVersionName;

    @Column(name = "jira_project_key", length = 64)
    private String jiraProjectKey;

    /** AUTO or MANUAL */
    @Column(name = "mapping_type", nullable = false, length = 20)
    private String mappingType = "AUTO";

    @Column(precision = 4)
    private Double confidence = 0.0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }
}
