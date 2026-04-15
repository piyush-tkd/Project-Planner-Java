package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.service.jira.JiraClient;
import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodBoard;
import com.portfolioplanner.domain.repository.JiraPodRepository;
import com.portfolioplanner.domain.repository.JiraSyncedSprintRepository;
import com.portfolioplanner.domain.repository.JiraSprintIssueRepository;
import com.portfolioplanner.domain.repository.JiraSyncStatusRepository;
import com.portfolioplanner.service.jira.JiraPodService;
import org.springframework.jdbc.core.JdbcTemplate;
import com.portfolioplanner.service.jira.JiraPodService.PodMetrics;
import com.portfolioplanner.service.jira.JiraPodService.SprintVelocity;
import com.portfolioplanner.service.jira.JiraPodService.SprintIssueRow;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import lombok.extern.slf4j.Slf4j;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/jira/pods")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Slf4j
public class JiraPodController {

    private final JiraPodService            podService;
    private final JiraPodRepository         podRepo;
    private final JiraCredentialsService    creds;
    private final JiraClient                jiraClient;
    private final JiraSyncedSprintRepository  sprintRepo;
    private final JiraSprintIssueRepository   sprintIssueRepo;
    private final JiraSyncStatusRepository    syncStatusRepo;
    private final JdbcTemplate                jdbc;

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

        // ── Capture project keys BEFORE saving so we can clean up orphaned data ──
        Set<String> oldKeys = podRepo.findAll().stream()
            .flatMap(p -> p.getBoards().stream())
            .map(b -> b.getJiraProjectKey().toUpperCase())
            .collect(Collectors.toSet());

        Set<String> newKeys = requests.stream()
            .filter(r -> r.boardKeys() != null)
            .flatMap(r -> r.boardKeys().stream())
            .filter(k -> k != null && !k.isBlank())
            .map(k -> k.trim().toUpperCase())
            .collect(Collectors.toSet());

        // Project keys that are being removed
        Set<String> removedKeys = oldKeys.stream()
            .filter(k -> !newKeys.contains(k))
            .collect(Collectors.toSet());

        // Delete all existing PODs (cascade deletes boards), then flush so the
        // DB sees the deletes before we insert — avoids uq_jira_pod_board_key violation.
        podRepo.deleteAll();
        podRepo.flush();

        // ── Full cascade cleanup for removed project keys ─────────────────────
        // Deletes ALL synced data: issues, transitions, worklogs, comments,
        // sprints, sprint-issue links, sync status. Nothing left behind.
        if (!removedKeys.isEmpty()) {
            log.info("POD config change: full data cleanup for removed project keys: {}", removedKeys);
            for (String key : removedKeys) {
                try {
                    // 1. Child tables that reference jira_issue by issue_key
                    jdbc.update("DELETE FROM jira_issue_transition WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_worklog    WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_comment    WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_custom_field WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);
                    jdbc.update("DELETE FROM jira_issue_fix_version  WHERE issue_key IN (SELECT issue_key FROM jira_issue WHERE project_key = ?)", key);

                    // 2. Sprint-issue links for this project's sprints
                    jdbc.update("DELETE FROM jira_sprint_issue WHERE sprint_jira_id IN (SELECT sprint_jira_id FROM jira_sprint WHERE project_key = ?)", key);

                    // 3. Issues and sprints
                    int issues  = jdbc.update("DELETE FROM jira_issue WHERE project_key = ?", key);
                    int sprints = jdbc.update("DELETE FROM jira_sprint WHERE project_key = ?", key);

                    // 4. Sync status
                    jdbc.update("DELETE FROM jira_sync_status WHERE project_key = ?", key);

                    log.info("  Removed project key '{}': deleted {} issues, {} sprints", key, issues, sprints);
                } catch (Exception e) {
                    log.warn("  Cleanup failed for project key '{}': {}", key, e.getMessage());
                }
            }
        }

        for (int i = 0; i < requests.size(); i++) {
            PodConfigRequest req = requests.get(i);
            JiraPod pod = new JiraPod();
            pod.setPodDisplayName(req.podDisplayName() != null && !req.podDisplayName().isBlank()
                    ? req.podDisplayName() : "POD " + (i + 1));
            pod.setEnabled(Boolean.TRUE.equals(req.enabled()));
            pod.setSortOrder(i);

            // Add boards — prefer full BoardEntry list (preserves sprintBoardId),
            // fall back to simple boardKeys list for backward compatibility
            if (req.boards() != null && !req.boards().isEmpty()) {
                for (BoardEntry entry : req.boards()) {
                    if (entry.projectKey() != null && !entry.projectKey().isBlank()) {
                        JiraPodBoard board = new JiraPodBoard(pod, entry.projectKey().trim().toUpperCase());
                        board.setSprintBoardId(entry.sprintBoardId());
                        pod.getBoards().add(board);
                    }
                }
            } else if (req.boardKeys() != null) {
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

    /** Board entry with optional sprint board ID override */
    public record BoardEntry(String projectKey, Long sprintBoardId) {}

    public record PodConfigRequest(
            String podDisplayName,
            Boolean enabled,
            List<String> boardKeys,
            List<BoardEntry> boards) {}   // boards takes priority over boardKeys if present

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
