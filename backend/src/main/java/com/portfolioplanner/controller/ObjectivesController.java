package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ObjectiveProjectLink;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.StrategicObjective;
import com.portfolioplanner.domain.repository.ObjectiveProjectLinkRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.StrategicObjectiveRepository;
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

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/objectives")
@RequiredArgsConstructor
public class ObjectivesController {

    private final StrategicObjectiveRepository repo;
    private final ObjectiveProjectLinkRepository linkRepo;
    private final ProjectRepository projectRepo;

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

    private void applyRequest(StrategicObjective obj, ObjectiveRequest req) {
        obj.setTitle(req.title());
        if (req.description() != null) obj.setDescription(req.description());
        if (req.owner()       != null) obj.setOwner(req.owner());
        if (req.status()      != null) obj.setStatus(req.status());
        if (req.progress()    != null) obj.setProgress(req.progress());
        if (req.targetDate()  != null && !req.targetDate().isBlank())
            obj.setTargetDate(LocalDate.parse(req.targetDate()));
        if (req.quarter()     != null) obj.setQuarter(req.quarter());
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    @GetMapping
    public List<ObjectiveResponse> getAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String quarter) {
        if (quarter != null && !quarter.isBlank())
            return repo.findByQuarterOrderByCreatedAtDesc(quarter)
                       .stream().map(this::toDto).toList();
        if (status != null && !status.isBlank())
            return repo.findByStatusOrderByCreatedAtDesc(status)
                       .stream().map(this::toDto).toList();
        return repo.findAllByOrderByCreatedAtDesc()
                   .stream().map(this::toDto).toList();
    }

    @GetMapping("/summary")
    public SummaryResponse getSummary() {
        List<StrategicObjective> all = repo.findAll();
        Map<String, Long> counts = all.stream()
            .collect(Collectors.groupingBy(StrategicObjective::getStatus, Collectors.counting()));
        return new SummaryResponse(
            all.size(),
            counts.getOrDefault("ON_TRACK",    0L),
            counts.getOrDefault("AT_RISK",     0L),
            counts.getOrDefault("COMPLETED",   0L),
            counts.getOrDefault("NOT_STARTED", 0L)
        );
    }

    @GetMapping("/{id}")
    public ObjectiveResponse getById(@PathVariable Long id) {
        return repo.findById(id).map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ObjectiveResponse> create(@Valid @RequestBody ObjectiveRequest req) {
        StrategicObjective obj = new StrategicObjective();
        obj.setStatus("NOT_STARTED");
        obj.setProgress(0);
        applyRequest(obj, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(repo.save(obj)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ObjectiveResponse update(@PathVariable Long id, @Valid @RequestBody ObjectiveRequest req) {
        StrategicObjective obj = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found"));
        applyRequest(obj, req);
        return toDto(repo.save(obj));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ObjectiveResponse updateStatus(@PathVariable Long id, @Valid @RequestBody StatusUpdateRequest req) {
        StrategicObjective obj = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found"));
        obj.setStatus(req.status());
        if (req.progress() != null) obj.setProgress(req.progress());
        return toDto(repo.save(obj));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found");
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Project link endpoints ────────────────────────────────────────────────

    @GetMapping("/{id}/links")
    public List<LinkedProjectResponse> getLinks(@PathVariable Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found");
        return linkRepo.findByObjectiveId(id).stream()
            .map(link -> projectRepo.findById(link.getProjectId())
                .map(p -> new LinkedProjectResponse(p.getId(), p.getName(), p.getStatus(), deriveProgress(p)))
                .orElse(null))
            .filter(r -> r != null)
            .toList();
    }

    @PostMapping("/{id}/links")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<LinkedProjectResponse> addLink(@PathVariable Long id,
                                                          @RequestBody LinkRequest req) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found");
        Project project = projectRepo.findById(req.projectId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        if (!linkRepo.existsByObjectiveIdAndProjectId(id, req.projectId())) {
            ObjectiveProjectLink link = new ObjectiveProjectLink();
            link.setObjectiveId(id);
            link.setProjectId(req.projectId());
            linkRepo.save(link);
            // Auto-update objective progress from linked projects
            recomputeProgress(id);
        }
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new LinkedProjectResponse(project.getId(), project.getName(),
                                             project.getStatus(), deriveProgress(project)));
    }

    @DeleteMapping("/{id}/links/{projectId}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> removeLink(@PathVariable Long id, @PathVariable Long projectId) {
        linkRepo.deleteByObjectiveIdAndProjectId(id, projectId);
        recomputeProgress(id);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Derive 0–100 progress from project status and timeline. */
    private int deriveProgress(Project p) {
        String s = p.getStatus() == null ? "" : p.getStatus().toUpperCase();
        if (s.equals("COMPLETED"))   return 100;
        if (s.equals("CANCELLED"))   return 0;
        if (s.equals("NOT_STARTED")) return 0;
        // Time-based estimate for ACTIVE / ON_HOLD / IN_DISCOVERY
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
        return 10; // minimal progress when no dates
    }

    /** Recompute objective's progress as average of linked project progress values. */
    private void recomputeProgress(Long objectiveId) {
        List<ObjectiveProjectLink> links = linkRepo.findByObjectiveId(objectiveId);
        if (links.isEmpty()) return;
        double avg = links.stream()
            .map(link -> projectRepo.findById(link.getProjectId()).orElse(null))
            .filter(p -> p != null)
            .mapToInt(this::deriveProgress)
            .average()
            .orElse(0);
        repo.findById(objectiveId).ifPresent(obj -> {
            obj.setProgress((int) Math.round(avg));
            repo.save(obj);
        });
    }
}
