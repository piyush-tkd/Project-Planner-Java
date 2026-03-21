package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_feedback")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String category;           // BUG, SUGGESTION, IMPROVEMENT, OTHER

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "page_url")
    private String pageUrl;            // Which page the feedback was submitted from

    @Column(name = "screenshot", columnDefinition = "TEXT")
    private String screenshot;         // Base64-encoded screenshot

    @Column(name = "submitted_by")
    private String submittedBy;        // Username

    @Column(nullable = false)
    private String status;             // NEW, IN_PROGRESS, DONE, DISMISSED

    @Column(name = "admin_notes", columnDefinition = "TEXT")
    private String adminNotes;

    @Column(nullable = false)
    private String priority;           // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "NEW";
        if (priority == null) priority = "MEDIUM";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
