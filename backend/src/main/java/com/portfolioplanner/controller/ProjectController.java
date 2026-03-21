package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.enums.ProjectStatus;
import com.portfolioplanner.dto.request.ProjectPodPlanningRequest;
import com.portfolioplanner.dto.request.ProjectRequest;
import com.portfolioplanner.dto.response.ProjectPodMatrixResponse;
import com.portfolioplanner.dto.response.ProjectPodPlanningResponse;
import com.portfolioplanner.dto.response.ProjectResponse;
import com.portfolioplanner.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getAll(@RequestParam(required = false) ProjectStatus status) {
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
}
