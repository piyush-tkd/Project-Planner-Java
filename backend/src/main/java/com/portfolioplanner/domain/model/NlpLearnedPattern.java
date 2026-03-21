package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "nlp_learned_pattern")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlpLearnedPattern {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "query_pattern", nullable = false, length = 500)
    private String queryPattern;

    @Column(name = "pattern_type", nullable = false, length = 20)
    private String patternType = "EXACT";  // EXACT, REGEX, FUZZY

    @Column(name = "resolved_intent", nullable = false, length = 50)
    private String resolvedIntent;

    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "route")
    private String route;

    @Column(nullable = false)
    private Double confidence = 0.90;

    @Column(nullable = false, length = 30)
    private String source = "LOG_MINING";  // LOG_MINING, USER_FEEDBACK, MANUAL

    @Column(name = "times_seen", nullable = false)
    private Integer timesSeen = 1;

    @Column(name = "positive_votes", nullable = false)
    private Integer positiveVotes = 0;

    @Column(name = "negative_votes", nullable = false)
    private Integer negativeVotes = 0;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "last_matched_at")
    private LocalDateTime lastMatchedAt;

    @Column(nullable = false)
    private Boolean corrective = false;  // true = generated from negative feedback correction

    @Column(columnDefinition = "TEXT")
    private String keywords;  // comma-separated keywords for CONTAINS matching

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
