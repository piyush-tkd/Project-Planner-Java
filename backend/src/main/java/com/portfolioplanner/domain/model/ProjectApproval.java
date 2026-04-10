package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "project_approval")
@Getter @Setter
public class ProjectApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "requested_by", nullable = false)
    private String requestedBy;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @Column(name = "request_note", columnDefinition = "TEXT")
    private String requestNote;

    @Column(name = "review_comment", columnDefinition = "TEXT")
    private String reviewComment;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt = LocalDateTime.now();

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    /**
     * Encodes the change that triggered this approval, e.g. "STATUS:PLANNING→ACTIVE".
     * When the reviewer approves, the system auto-applies this change.
     */
    @Column(name = "proposed_change", columnDefinition = "TEXT")
    private String proposedChange;

    public enum ApprovalStatus { PENDING, APPROVED, REJECTED, WITHDRAWN }
}
