package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ProjectApproval;
import com.portfolioplanner.domain.repository.ProjectApprovalRepository;
import com.portfolioplanner.dto.ProjectApprovalDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * REST API for project approval workflows.
 *
 * GET    /api/projects/{projectId}/approvals          → history for a project
 * GET    /api/approvals/pending                       → all PENDING (reviewer queue)
 * POST   /api/projects/{projectId}/approvals          → submit approval request
 * PUT    /api/approvals/{id}/review                   → approve / reject
 * DELETE /api/projects/{projectId}/approvals/{id}     → withdraw own request
 */
@RestController
@RequiredArgsConstructor
public class ProjectApprovalController {

    private final ProjectApprovalRepository repo;

    // ── List history for a project ────────────────────────────────────────────

    @GetMapping("/api/projects/{projectId}/approvals")
    public List<ProjectApprovalDto> listForProject(@PathVariable Long projectId) {
        return repo.findByProjectIdOrderByRequestedAtDesc(projectId)
                .stream().map(ProjectApprovalDto::from).collect(Collectors.toList());
    }

    // ── Pending queue (for reviewers) ─────────────────────────────────────────

    @GetMapping("/api/approvals/pending")
    public List<ProjectApprovalDto> pending() {
        return repo.findByStatusOrderByRequestedAtDesc(ProjectApproval.ApprovalStatus.PENDING)
                .stream().map(ProjectApprovalDto::from).collect(Collectors.toList());
    }

    // ── Submit request ────────────────────────────────────────────────────────

    @PostMapping("/api/projects/{projectId}/approvals")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectApprovalDto submit(
            @PathVariable Long projectId,
            @RequestBody ProjectApprovalDto.SubmitRequest req,
            Authentication auth) {

        // Only one PENDING approval per project at a time
        repo.findFirstByProjectIdAndStatusOrderByRequestedAtDesc(
                projectId, ProjectApproval.ApprovalStatus.PENDING)
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "A pending approval already exists for this project");
                });

        ProjectApproval a = new ProjectApproval();
        a.setProjectId(projectId);
        a.setRequestedBy(auth != null ? auth.getName() : "anonymous");
        a.setRequestNote(req.getRequestNote());
        a.setStatus(ProjectApproval.ApprovalStatus.PENDING);
        return ProjectApprovalDto.from(repo.save(a));
    }

    // ── Review (approve / reject) ─────────────────────────────────────────────

    @PutMapping("/api/approvals/{id}/review")
    public ProjectApprovalDto review(
            @PathVariable Long id,
            @RequestBody ProjectApprovalDto.ReviewRequest req,
            Authentication auth) {

        ProjectApproval a = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (a.getStatus() != ProjectApproval.ApprovalStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Approval is not PENDING");
        }

        ProjectApproval.ApprovalStatus newStatus =
                "APPROVE".equalsIgnoreCase(req.getAction())
                        ? ProjectApproval.ApprovalStatus.APPROVED
                        : ProjectApproval.ApprovalStatus.REJECTED;

        a.setStatus(newStatus);
        a.setReviewedBy(auth != null ? auth.getName() : "anonymous");
        a.setReviewComment(req.getReviewComment());
        a.setReviewedAt(LocalDateTime.now());
        return ProjectApprovalDto.from(repo.save(a));
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    @DeleteMapping("/api/projects/{projectId}/approvals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(
            @PathVariable Long projectId,
            @PathVariable Long id,
            Authentication auth) {

        ProjectApproval a = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String requester = auth != null ? auth.getName() : "anonymous";
        if (!a.getRequestedBy().equals(requester)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot withdraw another user's request");
        }
        a.setStatus(ProjectApproval.ApprovalStatus.WITHDRAWN);
        repo.save(a);
    }
}
