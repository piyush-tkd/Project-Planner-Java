package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_status_update")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectStatusUpdate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "rag_status", nullable = false, length = 10)
    private String ragStatus;   // RED | AMBER | GREEN

    @Column(nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "what_done", columnDefinition = "TEXT")
    private String whatDone;

    @Column(name = "whats_next", columnDefinition = "TEXT")
    private String whatsNext;

    @Column(columnDefinition = "TEXT")
    private String blockers;

    @Column(length = 120)
    private String author;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
