package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "nlp_embedding")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlpEmbedding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 50)
    private String entityType;  // RESOURCE, PROJECT, POD, SPRINT, RELEASE, QUERY_PATTERN, COST_RATE, EFFORT_PATTERN

    @Column(name = "entity_id")
    private Long entityId;

    @Column(name = "entity_name", length = 500)
    private String entityName;

    @Column(name = "content_text", nullable = false, columnDefinition = "TEXT")
    private String contentText;

    // The vector embedding column is managed entirely via native SQL (pgvector operators).
    // It is NOT mapped here so that Hibernate validation passes even when pgvector is
    // not installed (the column may not exist in that case).

    @Column(length = 50)
    private String intent;

    @Column(length = 200)
    private String route;

    @Column(columnDefinition = "JSONB")
    private String metadata;

    @Column(nullable = false, length = 30)
    private String source = "CATALOG";

    @Column
    private Double confidence = 1.0;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
