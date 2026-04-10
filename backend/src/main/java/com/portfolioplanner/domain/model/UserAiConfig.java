package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Stores a user's personal cloud AI provider settings.
 * Used as a fallback when no org-level key is configured in nlp_config.
 */
@Entity
@Table(name = "user_ai_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserAiConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(nullable = false, length = 50)
    private String provider;   // ANTHROPIC | OPENAI

    @Column(nullable = false, length = 200)
    private String model;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String apiKey;

    @Column(name = "created_at")
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
