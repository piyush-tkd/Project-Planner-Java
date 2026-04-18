package com.portfolioplanner.controller;

import com.portfolioplanner.dto.ProjectCommentDto;
import com.portfolioplanner.service.ProjectCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for project discussion comments.
 *
 * GET    /api/projects/{projectId}/comments          → list top-level comments + replies
 * POST   /api/projects/{projectId}/comments          → add comment (or reply)
 * PUT    /api/projects/{projectId}/comments/{id}     → edit own comment
 * DELETE /api/projects/{projectId}/comments/{id}     → delete own comment
 */
@RestController
@RequestMapping("/api/projects/{projectId}/comments")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProjectCommentController {

    private final ProjectCommentService projectCommentService;

    // ── GET list ──────────────────────────────────────────────────────────────

    @GetMapping
    public List<ProjectCommentDto> list(@PathVariable Long projectId) {
        return projectCommentService.listForProject(projectId);
    }

    // ── POST create ───────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<ProjectCommentDto> create(
            @PathVariable Long projectId,
            @RequestBody ProjectCommentDto.Request req,
            Authentication auth) {
        ProjectCommentDto dto = projectCommentService.create(projectId, req, auth != null ? auth.getName() : "anonymous");
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    // ── PUT edit ──────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ProjectCommentDto edit(
            @PathVariable Long projectId,
            @PathVariable Long id,
            @RequestBody ProjectCommentDto.Request req,
            Authentication auth) {
        return projectCommentService.edit(projectId, id, req);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long projectId,
            @PathVariable Long id) {
        projectCommentService.delete(projectId, id);
        return ResponseEntity.noContent().build();
    }

}
