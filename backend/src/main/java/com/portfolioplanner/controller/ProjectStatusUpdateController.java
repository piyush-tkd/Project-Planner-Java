package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectStatusUpdate;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.ProjectStatusUpdateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ProjectStatusUpdateController {

    private final ProjectStatusUpdateRepository updateRepo;
    private final ProjectRepository             projectRepo;

    // ── Per-project endpoints ─────────────────────────────────────────────────

    /** List all status updates for a project, newest first. */
    @GetMapping("/api/projects/{projectId}/status-updates")
    public ResponseEntity<List<Map<String, Object>>> listForProject(@PathVariable Long projectId) {
        List<ProjectStatusUpdate> updates = updateRepo.findByProjectIdOrderByCreatedAtDesc(projectId);
        return ResponseEntity.ok(updates.stream().map(this::toMap).collect(Collectors.toList()));
    }

    /** Post a new status update for a project. */
    @PostMapping("/api/projects/{projectId}/status-updates")
    public ResponseEntity<Map<String, Object>> create(
            @PathVariable Long projectId,
            @RequestBody CreateRequest req
    ) {
        if (!projectRepo.existsById(projectId)) {
            return ResponseEntity.notFound().build();
        }
        ProjectStatusUpdate update = ProjectStatusUpdate.builder()
                .projectId(projectId)
                .ragStatus(req.ragStatus())
                .summary(req.summary())
                .whatDone(req.whatDone())
                .whatsNext(req.whatsNext())
                .blockers(req.blockers())
                .author(req.author())
                .build();
        ProjectStatusUpdate saved = updateRepo.save(update);
        return ResponseEntity.ok(toMap(saved));
    }

    /** Delete a specific update (admin action). */
    @DeleteMapping("/api/projects/{projectId}/status-updates/{updateId}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId, @PathVariable Long updateId) {
        updateRepo.findById(updateId).ifPresent(u -> {
            if (u.getProjectId().equals(projectId)) updateRepo.delete(u);
        });
        return ResponseEntity.noContent().build();
    }

    // ── Cross-project feed ────────────────────────────────────────────────────

    /** Cross-project status feed — latest 50 updates, enriched with project name. */
    @GetMapping("/api/reports/status-updates/feed")
    public ResponseEntity<List<Map<String, Object>>> feed(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String ragStatus
    ) {
        List<ProjectStatusUpdate> all = updateRepo.findTop50ByOrderByCreatedAtDesc();

        // Build project name lookup
        Set<Long> projectIds = all.stream().map(ProjectStatusUpdate::getProjectId).collect(Collectors.toSet());
        Map<Long, String> nameMap = projectRepo.findAllById(projectIds).stream()
                .collect(Collectors.toMap(Project::getId, Project::getName));

        return ResponseEntity.ok(
                all.stream()
                   .filter(u -> projectId == null || u.getProjectId().equals(projectId))
                   .filter(u -> ragStatus  == null || ragStatus.equalsIgnoreCase(u.getRagStatus()))
                   .map(u -> {
                       Map<String, Object> m = toMap(u);
                       m.put("projectName", nameMap.getOrDefault(u.getProjectId(), "Unknown"));
                       return m;
                   })
                   .collect(Collectors.toList())
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private Map<String, Object> toMap(ProjectStatusUpdate u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        u.getId());
        m.put("projectId", u.getProjectId());
        m.put("ragStatus", u.getRagStatus());
        m.put("summary",   u.getSummary());
        m.put("whatDone",  u.getWhatDone());
        m.put("whatsNext", u.getWhatsNext());
        m.put("blockers",  u.getBlockers());
        m.put("author",    u.getAuthor());
        m.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
        return m;
    }

    record CreateRequest(
            String ragStatus, String summary,
            String whatDone,  String whatsNext,
            String blockers,  String author
    ) {}
}
