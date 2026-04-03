package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.service.jira.JiraClient;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.service.jira.JiraPodService;
import com.portfolioplanner.service.jira.JiraPodService.PodMetrics;
import com.portfolioplanner.service.jira.JiraPodService.SprintVelocity;
import com.portfolioplanner.service.jira.JiraPodService.SprintIssueRow;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jira/pods")
@RequiredArgsConstructor
public class JiraPodController {

    private final JiraPodService         podService;
    private final JiraPodRepository      podRepo;
    private final JiraCredentialsService creds;
    private final JiraClient             jiraClient;

    // ── Metrics ────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<PodMetrics>> getAllPods() {
        return ResponseEntity.ok(podService.getAllPodMetrics());
    }

    /** On-demand velocity for a single POD (aggregated across all its boards). */
    @GetMapping("/{podId}/velocity")
    public ResponseEntity<List<SprintVelocity>> getVelocity(@PathVariable Long podId) {
        return ResponseEntity.ok(podService.getVelocityForPod(podId));
    }

    /** Active-sprint issue list for a single POD — used for the drill-down modal. */
    @GetMapping("/{podId}/sprint-issues")
    public ResponseEntity<List<SprintIssueRow>> getSprintIssues(@PathVariable Long podId) {
        return ResponseEntity.ok(podService.getSprintIssuesForPod(podId));
    }

    // ── Config ────────────────────────────────────────────────────────

    /** List all PODs (enabled + disabled) with their board keys. */
    @GetMapping("/config")
    @Transactional(readOnly = true)
    public ResponseEntity<List<PodConfigResponse>> getConfig() {
        return ResponseEntity.ok(
            podRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc().stream()
                .map(PodConfigResponse::from).toList()
        );
    }

    /** Bulk replace the entire POD config. */
    @PostMapping("/config")
    @Transactional
    public ResponseEntity<List<PodConfigResponse>> saveConfig(@RequestBody List<PodConfigRequest> requests) {
        // Delete all existing PODs (cascade deletes boards), then flush so the
        // DB sees the deletes before we insert — avoids uq_jira_pod_board_key violation.
        podRepo.deleteAll();
        podRepo.flush();

        for (int i = 0; i < requests.size(); i++) {
            PodConfigRequest req = requests.get(i);
            JiraPod pod = new JiraPod();
            pod.setPodDisplayName(req.podDisplayName() != null && !req.podDisplayName().isBlank()
                    ? req.podDisplayName() : "POD " + (i + 1));
            pod.setEnabled(Boolean.TRUE.equals(req.enabled()));
            pod.setSortOrder(i);

            // Add boards
            if (req.boardKeys() != null) {
                for (String key : req.boardKeys()) {
                    if (key != null && !key.isBlank()) {
                        pod.getBoards().add(new JiraPodBoard(pod, key.trim().toUpperCase()));
                    }
                }
            }
            podRepo.save(pod);
        }

        // Evict all Jira API caches so pages that cache data by project key
        // (POD Dashboard, Jira Actuals, epics, sprints) pick up the new mapping immediately.
        jiraClient.evictAllCaches();

        return ResponseEntity.ok(
            podRepo.findAllByOrderBySortOrderAscPodDisplayNameAsc().stream()
                .map(PodConfigResponse::from).toList()
        );
    }

    /** Toggle or rename a single POD. */
    @PatchMapping("/config/{id}")
    @Transactional
    public ResponseEntity<PodConfigResponse> patchPod(@PathVariable Long id,
                                                       @RequestBody PodPatchRequest req) {
        return podRepo.findById(id).map(pod -> {
            if (req.enabled() != null)        pod.setEnabled(req.enabled());
            if (req.podDisplayName() != null) pod.setPodDisplayName(req.podDisplayName());
            return ResponseEntity.ok(PodConfigResponse.from(podRepo.save(pod)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    public record PodConfigRequest(
            String podDisplayName,
            Boolean enabled,
            List<String> boardKeys) {}

    public record PodPatchRequest(Boolean enabled, String podDisplayName) {}

    public record PodConfigResponse(
            Long id,
            String podDisplayName,
            Boolean enabled,
            Integer sortOrder,
            List<String> boardKeys) {

        static PodConfigResponse from(JiraPod pod) {
            return new PodConfigResponse(
                    pod.getId(),
                    pod.getPodDisplayName(),
                    pod.getEnabled(),
                    pod.getSortOrder(),
                    pod.getBoards().stream()
                            .map(JiraPodBoard::getJiraProjectKey)
                            .toList());
        }
    }
}
