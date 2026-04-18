package com.portfolioplanner.controller;

import com.portfolioplanner.dto.ProjectApprovalDto;
import com.portfolioplanner.service.ProjectApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for project approval workflows.
 *
 * GET    /api/projects/{projectId}/approvals          → history for a project
 * GET    /api/approvals/pending                       → all PENDING (reviewer queue)
 * POST   /api/projects/{projectId}/approvals          → submit approval request
 * PUT    /api/approvals/{id}/review                   → approve / reject
 * PUT    /api/approvals/{id}                          → inline update (reviewComment, requestNote)
 * DELETE /api/projects/{projectId}/approvals/{id}     → withdraw own request
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProjectApprovalController {

    private final ProjectApprovalService projectApprovalService;

    // ── List history for a project ────────────────────────────────────────────

    @GetMapping("/api/projects/{projectId}/approvals")
    public List<ProjectApprovalDto> listForProject(@PathVariable Long projectId) {
        return projectApprovalService.listForProject(projectId);
    }

    // ── Pending queue (for reviewers) ─────────────────────────────────────────

    @GetMapping("/api/approvals/pending")
    public List<ProjectApprovalDto> pending() {
        return projectApprovalService.listPending();
    }

    // ── Full history (all statuses, newest first) ─────────────────────────────

    @GetMapping("/api/approvals/history")
    public List<ProjectApprovalDto> history() {
        return projectApprovalService.listHistory();
    }

    // ── Submit request ────────────────────────────────────────────────────────

    @PostMapping("/api/projects/{projectId}/approvals")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectApprovalDto submit(
            @PathVariable Long projectId,
            @RequestBody ProjectApprovalDto.SubmitRequest req,
            Authentication auth) {
        return projectApprovalService.submit(projectId, req, auth != null ? auth.getName() : "anonymous");
    }

    // ── Review (approve / reject) ─────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/api/approvals/{id}/review")
    public ProjectApprovalDto review(
            @PathVariable Long id,
            @RequestBody ProjectApprovalDto.ReviewRequest req,
            Authentication auth) {
        return projectApprovalService.review(id, req, auth != null ? auth.getName() : "anonymous");
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/api/projects/{projectId}/approvals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(
            @PathVariable Long projectId,
            @PathVariable Long id,
            Authentication auth) {
        projectApprovalService.withdraw(id, projectId, auth != null ? auth.getName() : "anonymous");
    }

    // ── Inline update endpoint ────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/api/approvals/{id}")
    public ProjectApprovalDto updateApproval(
            @PathVariable Long id,
            @RequestBody Map<String, Object> updates) {
        return projectApprovalService.updateApproval(id, updates);
    }
}
