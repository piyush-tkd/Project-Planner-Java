package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "jira_dashboard")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JiraDashboard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    /** JSON array of widget configurations. */
    @Column(name = "widgets_json", columnDefinition = "text", nullable = false)
    private String widgetsJson;

    /** JSON object of dashboard-level filter state. */
    @Column(name = "filters_json", columnDefinition = "text", nullable = false)
    private String filtersJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
