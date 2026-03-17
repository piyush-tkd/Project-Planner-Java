package com.portfolioplanner.controller;

import com.portfolioplanner.config.JiraProperties;
import com.portfolioplanner.domain.model.JiraPodWatch;
import com.portfolioplanner.domain.repository.JiraPodWatchRepository;
import com.portfolioplanner.service.jira.JiraPodService;
import com.portfolioplanner.service.jira.JiraPodService.PodMetrics;
import com.portfolioplanner.service.jira.JiraPodService.SprintVelocity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jira/pods")
@RequiredArgsConstructor
public class JiraPodController {

    private final JiraPodService podService;
    private final JiraPodWatchRepository watchRepo;
    private final JiraProperties props;

    // ── Metrics ────────────────────────────────────────────────────────

    /**
     * Fast path: active sprint + backlog for watched PODs, in parallel.
     * Falls back to all Jira projects if watchlist is empty.
     */
    @GetMapping
    public ResponseEntity<List<PodMetrics>> getAllPods() {
        return ResponseEntity.ok(podService.getAllPodMetrics());
    }

    /** On-demand velocity for a single POD (last 6 sprints). */
    @GetMapping("/{projectKey}/velocity")
    public ResponseEntity<List<SprintVelocity>> getVelocity(@PathVariable String projectKey) {
        return ResponseEntity.ok(podService.getVelocityForPod(projectKey));
    }

    // ── Watchlist config ───────────────────────────────────────────────

    /** List all watchlist entries (enabled + disabled). */
    @GetMapping("/config")
    @Transactional(readOnly = true)
    public ResponseEntity<List<WatchResponse>> getConfig() {
        return ResponseEntity.ok(
            watchRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc().stream()
                .map(WatchResponse::from)
                .toList()
        );
    }

    /** Bulk replace the entire watchlist (frontend sends the full desired state). */
    @PostMapping("/config")
    @Transactional
    public ResponseEntity<List<WatchResponse>> saveConfig(@RequestBody List<WatchRequest> requests) {
        for (int i = 0; i < requests.size(); i++) {
            WatchRequest req = requests.get(i);
            JiraPodWatch watch = watchRepo.findByJiraProjectKey(req.jiraProjectKey())
                    .orElseGet(JiraPodWatch::new);
            watch.setJiraProjectKey(req.jiraProjectKey());
            watch.setPodDisplayName(req.podDisplayName() != null && !req.podDisplayName().isBlank()
                    ? req.podDisplayName() : req.jiraProjectKey());
            watch.setEnabled(Boolean.TRUE.equals(req.enabled()));
            watch.setSortOrder(i);
            watchRepo.save(watch);
        }
        // Remove any entries not in the new list
        List<String> newKeys = requests.stream().map(WatchRequest::jiraProjectKey).toList();
        watchRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc().stream()
                .filter(w -> !newKeys.contains(w.getJiraProjectKey()))
                .forEach(watchRepo::delete);

        return ResponseEntity.ok(
            watchRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc().stream()
                .map(WatchResponse::from).toList()
        );
    }

    /** Toggle enabled flag for a single entry. */
    @PatchMapping("/config/{id}")
    @Transactional
    public ResponseEntity<WatchResponse> toggleWatch(@PathVariable Long id,
                                                      @RequestBody ToggleRequest req) {
        return watchRepo.findById(id).map(w -> {
            if (req.enabled() != null) w.setEnabled(req.enabled());
            if (req.podDisplayName() != null) w.setPodDisplayName(req.podDisplayName());
            return ResponseEntity.ok(WatchResponse.from(watchRepo.save(w)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record WatchRequest(String jiraProjectKey, String podDisplayName, Boolean enabled) {}
    public record ToggleRequest(Boolean enabled, String podDisplayName) {}
    public record WatchResponse(Long id, String jiraProjectKey, String podDisplayName,
                                Boolean enabled, Integer sortOrder) {
        static WatchResponse from(JiraPodWatch w) {
            return new WatchResponse(w.getId(), w.getJiraProjectKey(),
                    w.getPodDisplayName(), w.getEnabled(), w.getSortOrder());
        }
    }
}
