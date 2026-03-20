package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "user_widget_preferences",
       uniqueConstraints = @UniqueConstraint(
               name = "uq_user_widget_preferences",
               columnNames = {"username", "page_key"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserWidgetPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** JWT username of the owning user. */
    @Column(nullable = false, length = 100)
    private String username;

    /** Logical page identifier, e.g. "support", "dashboard", "pod-dashboard". */
    @Column(name = "page_key", nullable = false, length = 100)
    private String pageKey;

    /**
     * JSON text storing widget order and visibility, e.g.
     * {@code {"order":["kpi","trend","throughput"],"hidden":["throughput"]}}.
     */
    @Column(columnDefinition = "text", nullable = false)
    private String preferences;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = Instant.now();
    }
}
