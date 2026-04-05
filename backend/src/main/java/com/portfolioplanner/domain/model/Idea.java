package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "idea")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Idea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "submitter_name", length = 120)
    private String submitterName;

    /** SUBMITTED | IN_REVIEW | APPROVED | REJECTED | IN_PROGRESS | CONVERTED */
    @Column(nullable = false, length = 30)
    private String status = "SUBMITTED";

    @Column(nullable = false)
    private Integer votes = 0;

    /** Comma-separated tag strings */
    @Column(length = 500)
    private String tags;

    /** XS | S | M | L | XL */
    @Column(name = "estimated_effort", length = 20)
    private String estimatedEffort;

    /** If the idea was converted to a project */
    @Column(name = "linked_project_id")
    private Long linkedProjectId;

    /** Attachment stored as a base64 data URL (image or PDF) */
    @Column(name = "attachment_url", columnDefinition = "TEXT")
    private String attachmentUrl;

    @Column(name = "attachment_name", length = 255)
    private String attachmentName;

    /** MIME type, e.g. image/png, application/pdf */
    @Column(name = "attachment_type", length = 50)
    private String attachmentType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
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
