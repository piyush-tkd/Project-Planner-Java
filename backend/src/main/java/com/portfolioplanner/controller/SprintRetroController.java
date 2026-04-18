package com.portfolioplanner.controller;

import com.portfolioplanner.service.SprintRetroService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Thin routing layer for sprint retrospective summaries.
 * All business logic lives in {@link SprintRetroService}.
 */
@RestController
@RequestMapping("/api/retro")
@RequiredArgsConstructor
public class SprintRetroController {

    private final SprintRetroService retroService;

    /**
     * List closed/active sprints with retro status, newest first.
     *
     * @param projectKey optional project filter
     * @param limit      max results (1–500, default 150)
     */
    @GetMapping("/sprints")
    public List<SprintRetroService.SprintSummaryItem> listSprints(
            @RequestParam(required = false) String projectKey,
            @RequestParam(defaultValue = "150") int limit) {
        return retroService.listSprints(projectKey, limit);
    }

    /** All retro summaries, optionally filtered by project key. */
    @GetMapping("/summaries")
    public List<SprintRetroService.RetroResponse> getSummaries(
            @RequestParam(required = false) String projectKey) {
        return retroService.getSummaries(projectKey);
    }

    /** Get a specific retro by sprint ID. */
    @GetMapping("/summaries/{sprintJiraId}")
    public SprintRetroService.RetroResponse getBySprintId(@PathVariable Long sprintJiraId) {
        return retroService.getBySprintId(sprintJiraId);
    }

    /** Delete a retro summary by its DB id. */
    @DeleteMapping("/summaries/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> deleteRetro(@PathVariable Long id) {
        retroService.deleteRetro(id);
        return ResponseEntity.noContent().build();
    }

    /** Generate (or regenerate) a retro summary for a closed sprint. */
    @PostMapping("/generate/{sprintJiraId}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<SprintRetroService.RetroResponse> generate(@PathVariable Long sprintJiraId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(retroService.generate(sprintJiraId));
    }
}
