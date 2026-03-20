package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Entity class name, e.g. "Resource", "Project", "Pod". */
    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    /** Primary-key of the changed entity (null for bulk imports). */
    @Column(name = "entity_id")
    private Long entityId;

    /** Human-readable label, e.g. the resource or project name. */
    @Column(name = "entity_name", length = 255)
    private String entityName;

    /** CREATE | UPDATE | DELETE | IMPORT */
    @Column(nullable = false, length = 20)
    private String action;

    /** Username extracted from the JWT. */
    @Column(name = "changed_by", nullable = false, length = 100)
    private String changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    /** Optional JSON / free-text description of changes. */
    @Column(columnDefinition = "text")
    private String details;

    @PrePersist
    protected void prePersist() {
        if (changedAt == null) changedAt = Instant.now();
    }
}
