package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "jira_pod_watch")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JiraPodWatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "jira_project_key", nullable = false, unique = true, length = 64)
    private String jiraProjectKey;

    /** The name shown in the POD Dashboard (e.g. "EPIC", "Enterprise Systems") */
    @Column(name = "pod_display_name", nullable = false)
    private String podDisplayName;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
