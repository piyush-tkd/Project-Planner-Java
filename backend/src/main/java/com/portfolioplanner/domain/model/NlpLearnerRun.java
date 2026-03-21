package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "nlp_learner_run")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlpLearnerRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "run_at", nullable = false, updatable = false)
    private LocalDateTime runAt;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "total_queries")
    private Long totalQueries;

    @Column(name = "unknown_queries")
    private Long unknownQueries;

    @Column(name = "low_confidence")
    private Long lowConfidence;

    @Column(name = "positive_ratings")
    private Long positiveRatings;

    @Column(name = "negative_ratings")
    private Long negativeRatings;

    @Column(name = "active_patterns")
    private Long activePatterns;

    @Column(name = "new_patterns")
    private Long newPatterns;

    @Column(name = "strategy_count")
    private Integer strategyCount;

    @Column(name = "intent_distribution", columnDefinition = "TEXT")
    private String intentDistribution;   // JSON string

    @Column(name = "strategy_confidence", columnDefinition = "TEXT")
    private String strategyConfidence;   // JSON string

    @Column(name = "triggered_by", length = 20, nullable = false)
    private String triggeredBy = "MANUAL";  // MANUAL, SCHEDULED, FEEDBACK

    @PrePersist
    protected void onCreate() {
        if (runAt == null) runAt = LocalDateTime.now();
    }
}
