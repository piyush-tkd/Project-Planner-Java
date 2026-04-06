package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ProjectComment;
import com.portfolioplanner.domain.repository.ProjectCommentRepository;
import com.portfolioplanner.dto.ProjectCommentDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

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
public class ProjectCommentController {

    private final ProjectCommentRepository repo;

    // ── GET list ──────────────────────────────────────────────────────────────

    @GetMapping
    public List<ProjectCommentDto> list(@PathVariable Long projectId) {
        List<ProjectComment> roots = repo.findByProjectIdAndParentIdIsNullOrderByCreatedAtDesc(projectId);
        return roots.stream()
                .map(c -> toDto(c, true))
                .collect(Collectors.toList());
    }

    // ── POST create ───────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<ProjectCommentDto> create(
            @PathVariable Long projectId,
            @RequestBody ProjectCommentDto.Request req,
            Authentication auth) {

        String author = auth != null ? auth.getName() : "anonymous";

        ProjectComment comment = new ProjectComment();
        comment.setProjectId(projectId);
        comment.setParentId(req.getParentId());
        comment.setAuthor(author);
        comment.setBody(req.getBody() == null ? "" : req.getBody().trim());

        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(repo.save(comment), false));
    }

    // ── PUT edit ──────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ProjectCommentDto edit(
            @PathVariable Long projectId,
            @PathVariable Long id,
            @RequestBody ProjectCommentDto.Request req,
            Authentication auth) {

        ProjectComment comment = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment does not belong to this project");
        }

        comment.setBody(req.getBody() == null ? "" : req.getBody().trim());
        // @PreUpdate on entity sets edited=true and updatedAt automatically
        return toDto(repo.save(comment), false);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long projectId,
            @PathVariable Long id) {

        ProjectComment comment = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment does not belong to this project");
        }

        repo.delete(comment);
        return ResponseEntity.noContent().build();
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private ProjectCommentDto toDto(ProjectComment c, boolean includeReplies) {
        List<ProjectCommentDto> replies = null;
        if (includeReplies && c.getParentId() == null) {
            replies = repo.findByParentIdOrderByCreatedAtAsc(c.getId())
                    .stream()
                    .map(r -> toDto(r, false))
                    .collect(Collectors.toList());
        }
        return new ProjectCommentDto(
                c.getId(),
                c.getProjectId(),
                c.getParentId(),
                c.getAuthor(),
                c.getBody(),
                c.isEdited(),
                c.getCreatedAt(),
                c.getUpdatedAt(),
                replies
        );
    }
}
