package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A single proactive insight detected by the AI Insights Engine.
 *
 * <p>Each time the engine runs it clears old (unacknowledged) insights for
 * the same type and entity, then inserts fresh ones.  Acknowledged insights
 * are preserved so admins can refer to the history.
 */
@Entity
@Table(name = "insight")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Insight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Signal category.  Well-known values defined in {@code InsightType}.
     */
    @Column(name = "insight_type", nullable = false, length = 60)
    private String insightType;

    /** HIGH | MEDIUM | LOW */
    @Column(nullable = false, length = 20)
    private String severity = "MEDIUM";

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Discriminator for the entity that triggered the insight: PROJECT | RESOURCE | POD */
    @Column(name = "entity_type", length = 40)
    private String entityType;

    /** Primary-key of the related entity (may be null for aggregate signals). */
    @Column(name = "entity_id")
    private Long entityId;

    /** Display name of the related entity — denormalised for fast rendering. */
    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "detected_at", nullable = false)
    private LocalDateTime detectedAt = LocalDateTime.now();

    @Column(nullable = false)
    private boolean acknowledged = false;

    @Column(name = "acknowledged_by")
    private String acknowledgedBy;

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;
}
