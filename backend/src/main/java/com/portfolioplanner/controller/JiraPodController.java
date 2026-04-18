package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.service.jira.JiraPodService;
import com.portfolioplanner.service.jira.JiraPodService.PodMetrics;
import com.portfolioplanner.service.jira.JiraPodService.SprintVelocity;
import com.portfolioplanner.service.jira.JiraPodService.SprintIssueRow;
import com.portfolioplanner.service.JiraPodConfigService;
import com.portfolioplanner.service.JiraPodConfigService.PodConfigRequest;
import com.portfolioplanner.service.JiraPodConfigService.BoardEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import lombok.extern.slf4j.Slf4j;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira/pods")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Slf4j
public class JiraPodController {

    private final JiraPodService            podService;
    private final JiraCredentialsService    creds;
    private final JiraPodConfigService      configService;

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
            configService.getAllPodsSorted().stream()
                .map(PodConfigResponse::from).toList()
        );
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/config")
    public ResponseEntity<List<PodConfigResponse>> saveConfig(@RequestBody List<PodConfigRequest> requests) {
        configService.saveConfig(requests);
        return ResponseEntity.ok(
            configService.getAllPodsSorted().stream()
                .map(PodConfigResponse::from).toList()
        );
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/config/{id}")
    public ResponseEntity<PodConfigResponse> patchPod(@PathVariable Long id,
                                                       @RequestBody PodPatchRequest req) {
        configService.patchPod(id, req.enabled(), req.podDisplayName());
        return configService.getPodById(id)
                .map(PodConfigResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── DTOs ──────────────────────────────────────────────────────────

    // PodConfigRequest and BoardEntry are imported from JiraPodConfigService

    public record PodPatchRequest(Boolean enabled, String podDisplayName) {}

    public record PodConfigResponse(
            Long id,
            String podDisplayName,
            Boolean enabled,
            Integer sortOrder,
            List<String> boardKeys,
            List<BoardEntry> boards) {

        static PodConfigResponse from(JiraPod pod) {
            List<BoardEntry> boardEntries = pod.getBoards().stream()
                    .map(b -> new BoardEntry(b.getJiraProjectKey(), b.getSprintBoardId()))
                    .toList();
            return new PodConfigResponse(
                    pod.getId(),
                    pod.getPodDisplayName(),
                    pod.getEnabled(),
                    pod.getSortOrder(),
                    boardEntries.stream().map(BoardEntry::projectKey).toList(),
                    boardEntries);
        }
    }
}
