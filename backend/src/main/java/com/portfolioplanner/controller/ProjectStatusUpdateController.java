package com.portfolioplanner.controller;

import com.portfolioplanner.service.ProjectStatusUpdateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProjectStatusUpdateController {

    private final ProjectStatusUpdateService projectStatusUpdateService;

    // ── Per-project endpoints ─────────────────────────────────────────────────

    /** List all status updates for a project, newest first. */
    @GetMapping("/api/projects/{projectId}/status-updates")
    public ResponseEntity<List<Map<String, Object>>> listForProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(projectStatusUpdateService.listForProject(projectId));
    }

    /** Post a new status update for a project. */
    @PostMapping("/api/projects/{projectId}/status-updates")
    public ResponseEntity<Map<String, Object>> create(
            @PathVariable Long projectId,
            @RequestBody ProjectStatusUpdateService.CreateRequest req
    ) {
        try {
            return ResponseEntity.ok(projectStatusUpdateService.create(projectId, req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** Delete a specific update (admin action). */
    @DeleteMapping("/api/projects/{projectId}/status-updates/{updateId}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId, @PathVariable Long updateId) {
        projectStatusUpdateService.delete(projectId, updateId);
        return ResponseEntity.noContent().build();
    }

    // ── Cross-project feed ────────────────────────────────────────────────────

    /** Cross-project status feed — latest 50 updates, enriched with project name. */
    @GetMapping("/api/reports/status-updates/feed")
    public ResponseEntity<List<Map<String, Object>>> feed(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String ragStatus
    ) {
        return ResponseEntity.ok(projectStatusUpdateService.getFeed(projectId, ragStatus));
    }

}
