package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ProjectTemplate;
import com.portfolioplanner.domain.repository.ProjectTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

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

    private final ProjectTemplateRepository repo;

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record PhaseDto(String name, String duration, String description) {}

    public record TemplateResponse(
        Long id,
        String name,
        String description,
        String category,
        String duration,
        String team,
        String effort,
        List<String> tags,
        boolean starred,
        int usageCount,
        String lastUsed,
        String phases   // raw JSON string — frontend parses
    ) {}

    public record TemplateRequest(
        String name,
        String description,
        String category,
        String duration,
        String team,
        String effort,
        List<String> tags,
        boolean starred,
        String phases   // raw JSON string
    ) {}

    private TemplateResponse toDto(ProjectTemplate t) {
        List<String> tagList = t.getTags() != null && !t.getTags().isBlank()
            ? Arrays.stream(t.getTags().split(",")).map(String::trim).collect(Collectors.toList())
            : List.of();
        return new TemplateResponse(
            t.getId(), t.getName(), t.getDescription(),
            t.getCategory(), t.getDuration(), t.getTeamDesc(), t.getEffort(),
            tagList, Boolean.TRUE.equals(t.getStarred()), t.getUsageCount(),
            t.getLastUsed() != null ? t.getLastUsed().toString() : null,
            t.getPhases()
        );
    }

    private void applyRequest(ProjectTemplate t, TemplateRequest req) {
        t.setName(req.name());
        t.setDescription(req.description());
        t.setCategory(req.category());
        t.setDuration(req.duration());
        t.setTeamDesc(req.team());
        t.setEffort(req.effort());
        t.setTags(req.tags() != null ? String.join(",", req.tags()) : null);
        t.setStarred(req.starred());
        t.setPhases(req.phases() != null ? req.phases() : "[]");
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @GetMapping
    public List<TemplateResponse> getAll() {
        return repo.findAllByOrderByStarredDescUsageCountDesc()
            .stream().map(this::toDto).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TemplateResponse> getOne(@PathVariable Long id) {
        return repo.findById(id)
            .map(t -> ResponseEntity.ok(toDto(t)))
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse create(@RequestBody TemplateRequest req) {
        ProjectTemplate t = new ProjectTemplate();
        applyRequest(t, req);
        return toDto(repo.save(t));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TemplateResponse> update(@PathVariable Long id,
                                                    @RequestBody TemplateRequest req) {
        return repo.findById(id)
            .map(t -> {
                applyRequest(t, req);
                return ResponseEntity.ok(toDto(repo.save(t)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/star")
    public ResponseEntity<TemplateResponse> toggleStar(@PathVariable Long id) {
        return repo.findById(id)
            .map(t -> {
                t.setStarred(!Boolean.TRUE.equals(t.getStarred()));
                return ResponseEntity.ok(toDto(repo.save(t)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/use")
    public ResponseEntity<TemplateResponse> markUsed(@PathVariable Long id) {
        return repo.findById(id)
            .map(t -> {
                t.setUsageCount(t.getUsageCount() + 1);
                t.setLastUsed(LocalDate.now());
                return ResponseEntity.ok(toDto(repo.save(t)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
