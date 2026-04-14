package com.portfolioplanner.controller;

import com.portfolioplanner.dto.ProjectHealthDto;
import com.portfolioplanner.dto.request.ProjectPodPlanningRequest;
import com.portfolioplanner.dto.request.ProjectRequest;
import com.portfolioplanner.dto.response.ProjectPodMatrixResponse;
import com.portfolioplanner.dto.response.ProjectPodPlanningResponse;
import com.portfolioplanner.dto.response.ProjectResponse;
import com.portfolioplanner.service.ProjectHealthService;
import com.portfolioplanner.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProjectController {

    private final ProjectService       projectService;
    private final ProjectHealthService projectHealthService;

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getAll(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(projectService.getAll(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(@Valid @RequestBody ProjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectResponse> update(@PathVariable Long id, @Valid @RequestBody ProjectRequest request) {
        return ResponseEntity.ok(projectService.update(id, request));
    }

    /**
     * PATCH /api/projects/{id}/status
     * Lightweight endpoint for updating only the status (e.g. drag-and-drop on kanban board).
     * Accepts: { "status": "ACTIVE" } or any custom lane name.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ProjectResponse> patchStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(projectService.patchStatus(id, newStatus));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/copy")
    public ResponseEntity<ProjectResponse> copy(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.copy(id));
    }

    @GetMapping("/pod-matrix")
    public ResponseEntity<List<ProjectPodMatrixResponse>> getAllPodPlannings() {
        return ResponseEntity.ok(projectService.getAllPodPlannings());
    }

    @GetMapping("/pod-matrix/by-pod/{podId}")
    public ResponseEntity<List<ProjectPodMatrixResponse>> getPodPlanningsByPod(@PathVariable Long podId) {
        return ResponseEntity.ok(projectService.getPodPlanningsByPodId(podId));
    }

    @GetMapping("/{id}/pod-planning")
    public ResponseEntity<List<ProjectPodPlanningResponse>> getPodPlannings(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getPodPlannings(id));
    }

    @PutMapping("/{id}/pod-planning")
    public ResponseEntity<List<ProjectPodPlanningResponse>> setPodPlannings(
            @PathVariable Long id,
            @Valid @RequestBody List<ProjectPodPlanningRequest> requests) {
        return ResponseEntity.ok(projectService.setPodPlannings(id, requests));
    }

    // ── Health scorecard ──────────────────────────────────────────────────────

    /**
     * Returns health scorecards for all non-archived projects.
     * Each entry contains RAG status, overall score, and per-dimension scores.
     */
    @GetMapping("/health")
    public ResponseEntity<List<ProjectHealthDto>> getAllHealth() {
        return ResponseEntity.ok(projectHealthService.computeAll());
    }

    /**
     * Returns the health scorecard for a single project.
     */
    @GetMapping("/{id}/health")
    public ResponseEntity<ProjectHealthDto> getHealth(@PathVariable Long id) {
        return ResponseEntity.ok(projectHealthService.computeOne(id));
    }
}
