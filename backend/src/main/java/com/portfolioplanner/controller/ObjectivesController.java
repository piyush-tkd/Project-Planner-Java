package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ObjectiveProjectLink;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.StrategicObjective;
import com.portfolioplanner.service.ObjectivesService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.temporal.ChronoUnit;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/objectives")
@RequiredArgsConstructor
public class ObjectivesController {

    private final ObjectivesService service;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record ObjectiveResponse(
        Long   id,
        String title,
        String description,
        String owner,
        String status,
        int    progress,
        String targetDate,
        String quarter,
        String createdAt
    ) {}

    public record ObjectiveRequest(
        @NotBlank String title,
        String description,
        String owner,
        String status,
        @Min(0) @Max(100) Integer progress,
        String targetDate,  // ISO yyyy-MM-dd or null
        String quarter
    ) {}

    public record StatusUpdateRequest(@NotBlank String status, Integer progress) {}

    public record LinkedProjectResponse(
        Long   projectId,
        String name,
        String status,
        int    computedProgress  // 0-100 derived from project status / timeline
    ) {}

    public record LinkRequest(Long projectId) {}

    public record SummaryResponse(
        long total,
        long onTrack,
        long atRisk,
        long completed,
        long notStarted
    ) {}

    // ── Mappings ─────────────────────────────────────────────────────────────

    private ObjectiveResponse toDto(StrategicObjective o) {
        return new ObjectiveResponse(
            o.getId(),
            o.getTitle(),
            o.getDescription(),
            o.getOwner(),
            o.getStatus(),
            o.getProgress(),
            o.getTargetDate() != null ? o.getTargetDate().toString() : null,
            o.getQuarter(),
            o.getCreatedAt() != null ? o.getCreatedAt().toString() : null
        );
    }


    // ── Endpoints ────────────────────────────────────────────────────────────

    @GetMapping
    public List<ObjectiveResponse> getAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String quarter) {
        return service.getAll(status, quarter).stream().map(this::toDto).toList();
    }

    @GetMapping("/summary")
    public SummaryResponse getSummary() {
        Map<String, Long> counts = service.getSummary();
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        return new SummaryResponse(
            total,
            counts.getOrDefault("ON_TRACK",    0L),
            counts.getOrDefault("AT_RISK",     0L),
            counts.getOrDefault("COMPLETED",   0L),
            counts.getOrDefault("NOT_STARTED", 0L)
        );
    }

    @GetMapping("/{id}")
    public ObjectiveResponse getById(@PathVariable Long id) {
        return service.getById(id).map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ObjectiveResponse> create(@Valid @RequestBody ObjectiveRequest req) {
        StrategicObjective obj = service.create(
                req.title(), req.description(), req.owner(),
                req.status(), req.progress(), req.targetDate(), req.quarter());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(obj));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ObjectiveResponse update(@PathVariable Long id, @Valid @RequestBody ObjectiveRequest req) {
        return service.update(id, req.title(), req.description(), req.owner(),
                req.status(), req.progress(), req.targetDate(), req.quarter())
            .map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found"));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ObjectiveResponse updateStatus(@PathVariable Long id, @Valid @RequestBody StatusUpdateRequest req) {
        return service.updateStatus(id, req.status(), req.progress())
            .map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!service.delete(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found");
        return ResponseEntity.noContent().build();
    }

    // ── Project link endpoints ────────────────────────────────────────────────

    @GetMapping("/{id}/links")
    public List<LinkedProjectResponse> getLinks(@PathVariable Long id) {
        if (!service.getById(id).isPresent())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found");
        return service.getLinkedProjects(id).stream()
            .map(this::deriveLinkedResponse)
            .toList();
    }

    @PostMapping("/{id}/links")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<LinkedProjectResponse> addLink(@PathVariable Long id,
                                                          @RequestBody LinkRequest req) {
        Optional<ObjectiveProjectLink> linkResult = service.addLink(id, req.projectId());
        if (!linkResult.isPresent())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective or Project not found");
        Project project = service.getLinkedProjects(id).stream()
            .filter(p -> p.getId().equals(req.projectId()))
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        return ResponseEntity.status(HttpStatus.CREATED).body(deriveLinkedResponse(project));
    }

    @DeleteMapping("/{id}/links/{projectId}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> removeLink(@PathVariable Long id, @PathVariable Long projectId) {
        service.removeLink(id, projectId);
        return ResponseEntity.noContent().build();
    }

    private LinkedProjectResponse deriveLinkedResponse(Project p) {
        int progress = deriveProgress(p);
        return new LinkedProjectResponse(p.getId(), p.getName(), p.getStatus(), progress);
    }

    private int deriveProgress(Project p) {
        String s = p.getStatus() == null ? "" : p.getStatus().toUpperCase();
        if (s.equals("COMPLETED"))   return 100;
        if (s.equals("CANCELLED"))   return 0;
        if (s.equals("NOT_STARTED")) return 0;
        LocalDate start  = p.getStartDate();
        LocalDate target = p.getTargetDate();
        if (start != null && target != null && !target.isBefore(start)) {
            long total   = ChronoUnit.DAYS.between(start, target);
            long elapsed = ChronoUnit.DAYS.between(start, LocalDate.now());
            if (total > 0) {
                int pct = (int) Math.min(95, Math.max(0, (elapsed * 100) / total));
                return pct;
            }
        }
        return 10;
    }
}
