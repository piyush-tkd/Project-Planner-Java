package com.portfolioplanner.controller;

import com.portfolioplanner.service.ProjectTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD for reusable project templates.
 * GET/POST /api/project-templates
 * PUT/DELETE /api/project-templates/{id}
 * POST /api/project-templates/{id}/use  → increments usageCount
 */
@RestController
@RequestMapping("/api/project-templates")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProjectTemplateController {

    private final ProjectTemplateService projectTemplateService;

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GetMapping
    public List<ProjectTemplateService.TemplateResponse> getAll() {
        return projectTemplateService.getAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectTemplateService.TemplateResponse> getOne(@PathVariable Long id) {
        return projectTemplateService.getOne(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectTemplateService.TemplateResponse create(@RequestBody ProjectTemplateService.TemplateRequest req) {
        return projectTemplateService.create(req);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectTemplateService.TemplateResponse> update(@PathVariable Long id,
                                                    @RequestBody ProjectTemplateService.TemplateRequest req) {
        return projectTemplateService.update(id, req)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/star")
    public ResponseEntity<ProjectTemplateService.TemplateResponse> toggleStar(@PathVariable Long id) {
        return projectTemplateService.toggleStar(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/use")
    public ResponseEntity<ProjectTemplateService.TemplateResponse> markUsed(@PathVariable Long id) {
        return projectTemplateService.markUsed(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!projectTemplateService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
