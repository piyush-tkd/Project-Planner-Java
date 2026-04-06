package com.portfolioplanner.dto;

import com.portfolioplanner.domain.model.ProjectApproval;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ProjectApprovalDto {
    private Long id;
    private Long projectId;
    private String requestedBy;
    private String reviewedBy;
    private String status;
    private String requestNote;
    private String reviewComment;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;

    public static ProjectApprovalDto from(ProjectApproval a) {
        ProjectApprovalDto d = new ProjectApprovalDto();
        d.id            = a.getId();
        d.projectId     = a.getProjectId();
        d.requestedBy   = a.getRequestedBy();
        d.reviewedBy    = a.getReviewedBy();
        d.status        = a.getStatus().name();
        d.requestNote   = a.getRequestNote();
        d.reviewComment = a.getReviewComment();
        d.requestedAt   = a.getRequestedAt();
        d.reviewedAt    = a.getReviewedAt();
        return d;
    }

    @Data
    public static class SubmitRequest {
        private String requestNote;
    }

    @Data
    public static class ReviewRequest {
        private String action;       // "APPROVE" | "REJECT"
        private String reviewComment;
    }
}
