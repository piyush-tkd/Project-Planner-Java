package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "nlp_conversation")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlpConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 255)
    private String title;  // auto-generated from first message

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "is_pinned", nullable = false)
    private boolean pinned;

    @Column(name = "message_count", nullable = false)
    private Integer messageCount;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "context_json", columnDefinition = "TEXT")
    private String contextJson;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (messageCount == null) {
            messageCount = 0;
        }
        if (!pinned) {
            pinned = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
