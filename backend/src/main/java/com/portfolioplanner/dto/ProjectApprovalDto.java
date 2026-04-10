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
    private String proposedChange;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;

    public static ProjectApprovalDto from(ProjectApproval a) {
        ProjectApprovalDto d = new ProjectApprovalDto();
        d.id             = a.getId();
        d.projectId      = a.getProjectId();
        d.requestedBy    = a.getRequestedBy();
        d.reviewedBy     = a.getReviewedBy();
        d.status         = a.getStatus().name();
        d.requestNote    = a.getRequestNote();
        d.reviewComment  = a.getReviewComment();
        d.proposedChange = a.getProposedChange();
        d.requestedAt    = a.getRequestedAt();
        d.reviewedAt     = a.getReviewedAt();
        return d;
    }

    /**
     * Returns a human-readable description of a proposedChange string,
     * e.g. "STATUS:NOT_STARTED→ACTIVE" → "Status: NOT_STARTED → ACTIVE".
     * Returns null when proposedChange is blank or unrecognised.
     */
    public static String describeProposedChange(String proposedChange) {
        if (proposedChange == null || proposedChange.isBlank()) return null;
        if (proposedChange.startsWith("STATUS:")) {
            String body = proposedChange.substring("STATUS:".length());
            String[] parts = body.split("→", 2);
            return parts.length == 2 ? "Status: " + parts[0] + " → " + parts[1] : body;
        }
        if (proposedChange.startsWith("TIMELINE:")) {
            String body = proposedChange.substring("TIMELINE:".length());
            String[] parts = body.split("→", 2);
            return parts.length == 2 ? "Timeline extended: month " + parts[0] + " → month " + parts[1] : body;
        }
        if (proposedChange.startsWith("BUDGET:")) {
            String body = proposedChange.substring("BUDGET:".length());
            String[] parts = body.split("→", 2);
            return parts.length == 2 ? "Budget increase: " + parts[0] + " → " + parts[1] : body;
        }
        return proposedChange;
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
