package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Reusable project blueprint / starter template.
 * Table: project_template (V143).
 */
@Entity
@Table(name = "project_template")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProjectTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String category;

    @Column(length = 100)
    private String duration;

    @Column(name = "team_desc", length = 200)
    private String teamDesc;

    @Column(length = 100)
    private String effort;

    /** Comma-separated tags */
    @Column(columnDefinition = "TEXT")
    private String tags;

    @Column(nullable = false)
    private Boolean starred = false;

    @Column(name = "usage_count", nullable = false)
    private Integer usageCount = 0;

    @Column(name = "last_used")
    private LocalDate lastUsed;

    /**
     * JSON array of phase objects: [{name, duration, description}]
     * Stored as JSONB in Postgres.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "phases", columnDefinition = "jsonb", nullable = false)
    private String phases = "[]";

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = OffsetDateTime.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = OffsetDateTime.now(); }
}
