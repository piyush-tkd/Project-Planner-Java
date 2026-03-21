package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "nlp_query_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlpQueryLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "query_text", nullable = false, columnDefinition = "TEXT")
    private String queryText;

    @Column(length = 50)
    private String intent;

    private Double confidence;

    @Column(name = "resolved_by", length = 50)
    private String resolvedBy;

    @Column(name = "response_ms")
    private Integer responseMs;

    @Column(name = "entity_name")
    private String entityName;

    @Column(name = "user_rating")
    private Short userRating;   // NULL = no rating, 1 = thumbs up, -1 = thumbs down

    @Column(name = "feedback_comment", columnDefinition = "TEXT")
    private String feedbackComment;  // User explanation when giving negative feedback

    @Column(name = "expected_intent", length = 50)
    private String expectedIntent;   // What the user actually wanted (derived from feedback)

    @Column(name = "feedback_screenshot", columnDefinition = "TEXT")
    private String feedbackScreenshot;  // Base64-encoded screenshot from negative feedback

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
