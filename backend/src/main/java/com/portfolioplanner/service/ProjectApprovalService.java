package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ProjectApproval;
import com.portfolioplanner.domain.repository.ProjectApprovalRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.dto.ProjectApprovalDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectApprovalService {

    private final ProjectApprovalRepository projectApprovalRepository;
    private final ProjectRepository projectRepository;
    private final WebhookService webhookService;
    private final ProjectService projectService;
    private final ApprovalNotificationService notificationService;

    public List<ProjectApprovalDto> listForProject(Long projectId) {
        return projectApprovalRepository.findByProjectIdOrderByRequestedAtDesc(projectId)
                .stream()
                .map(ProjectApprovalDto::from)
                .collect(Collectors.toList());
    }

    public List<ProjectApprovalDto> listPending() {
        return projectApprovalRepository.findByStatusOrderByRequestedAtDesc(ProjectApproval.ApprovalStatus.PENDING)
                .stream()
                .map(ProjectApprovalDto::from)
                .collect(Collectors.toList());
    }

    public List<ProjectApprovalDto> listHistory() {
        return projectApprovalRepository.findAllByOrderByRequestedAtDesc()
                .stream()
                .map(ProjectApprovalDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectApprovalDto submit(Long projectId, ProjectApprovalDto.SubmitRequest request, String requestedBy) {
        // Only one PENDING approval per project at a time
        projectApprovalRepository.findFirstByProjectIdAndStatusOrderByRequestedAtDesc(
                projectId, ProjectApproval.ApprovalStatus.PENDING)
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "A pending approval already exists for this project");
                });

        ProjectApproval approval = new ProjectApproval();
        approval.setProjectId(projectId);
        approval.setRequestedBy(requestedBy != null ? requestedBy : "anonymous");
        approval.setRequestNote(request.getRequestNote());
        approval.setStatus(ProjectApproval.ApprovalStatus.PENDING);
        return ProjectApprovalDto.from(projectApprovalRepository.save(approval));
    }

    @Transactional
    public ProjectApprovalDto review(Long id, ProjectApprovalDto.ReviewRequest request, String reviewedBy) {
        ProjectApproval approval = projectApprovalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (approval.getStatus() != ProjectApproval.ApprovalStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Approval is not PENDING");
        }

        ProjectApproval.ApprovalStatus newStatus =
                "APPROVE".equalsIgnoreCase(request.getAction())
                        ? ProjectApproval.ApprovalStatus.APPROVED
                        : ProjectApproval.ApprovalStatus.REJECTED;

        approval.setStatus(newStatus);
        approval.setReviewedBy(reviewedBy != null ? reviewedBy : "anonymous");
        approval.setReviewComment(request.getReviewComment());
        approval.setReviewedAt(LocalDateTime.now());
        ProjectApproval saved = projectApprovalRepository.save(approval);

        // Auto-apply the proposed change when approved
        if (newStatus == ProjectApproval.ApprovalStatus.APPROVED) {
            projectService.applyProposedChange(approval.getProjectId(), approval.getProposedChange());
        }

        // Fire webhook notification (async — does not block the response)
        String projectName = projectRepository.findById(approval.getProjectId())
                .map(p -> p.getName()).orElse("Project #" + approval.getProjectId());
        webhookService.fireApprovalReviewed(
                approval.getProjectId(), projectName,
                newStatus.name(),
                saved.getReviewedBy());

        // Send email notification to the requester
        notificationService.notifyDecision(saved,
                ProjectApprovalDto.describeProposedChange(saved.getProposedChange()));

        return ProjectApprovalDto.from(saved);
    }

    @Transactional
    public void withdraw(Long id, Long projectId, String requester) {
        ProjectApproval approval = projectApprovalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String requesterName = requester != null ? requester : "anonymous";
        if (!approval.getRequestedBy().equals(requesterName)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot withdraw another user's request");
        }
        approval.setStatus(ProjectApproval.ApprovalStatus.WITHDRAWN);
        projectApprovalRepository.save(approval);

        // Notify reviewers so they're not left looking for a request that no longer exists
        String projectName = projectRepository.findById(projectId)
                .map(p -> p.getName()).orElse("Project #" + projectId);
        notificationService.notifyWithdrawn(approval,
                projectName,
                ProjectApprovalDto.describeProposedChange(approval.getProposedChange()));
    }

    @Transactional
    public ProjectApprovalDto updateApproval(Long id, Map<String, Object> updates) {
        ProjectApproval approval = projectApprovalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approval not found"));

        // Update only allowed fields for inline editing
        if (updates.containsKey("reviewComment")) {
            Object val = updates.get("reviewComment");
            approval.setReviewComment(val instanceof String ? (String) val : null);
        }
        if (updates.containsKey("requestNote")) {
            Object val = updates.get("requestNote");
            approval.setRequestNote(val instanceof String ? (String) val : null);
        }

        return ProjectApprovalDto.from(projectApprovalRepository.save(approval));
    }
}
