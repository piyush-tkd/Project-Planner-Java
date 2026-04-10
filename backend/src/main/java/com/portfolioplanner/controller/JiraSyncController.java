package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.JiraSyncStatus;
import com.portfolioplanner.service.jira.JiraCredentialsService;
import com.portfolioplanner.service.jira.JiraIssueSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Endpoints for managing Jira issue sync.
 * Allows manual trigger and status monitoring.
 */
@RestController
@RequestMapping("/api/jira/sync")
@PreAuthorize("hasRole('ADMIN')")   // S2.3 — sync triggers are admin-only
@RequiredArgsConstructor
@Slf4j
public class JiraSyncController {

    private final JiraIssueSyncService syncService;
    private final JiraCredentialsService creds;

    /**
     * POST /api/jira/sync/trigger
     * Manually trigger a Jira sync (async).
     * @param fullSync  If true, re-fetch ALL issues; otherwise incremental (updated since last sync)
     */
    @PostMapping("/trigger")
    public ResponseEntity<Map<String, Object>> triggerSync(
            @RequestParam(defaultValue = "false") boolean fullSync) {

        if (!creds.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }

        if (syncService.isSyncing()) {
            return ResponseEntity.ok(Map.of(
                    "status", "ALREADY_RUNNING",
                    "message", "A sync is already in progress"));
        }

        syncService.triggerSync(fullSync);

        return ResponseEntity.ok(Map.of(
                "status", "STARTED",
                "message", fullSync ? "Full sync started" : "Incremental sync started"));
    }

    /**
     * GET /api/jira/sync/status
     * Returns sync status for all configured projects.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getSyncStatus() {
        if (!creds.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }

        boolean syncing = syncService.isSyncing();
        List<JiraSyncStatus> statuses = syncService.getSyncStatuses();

        List<Map<String, Object>> statusList = statuses.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("projectKey", s.getProjectKey());
            m.put("boardType", s.getBoardType());
            m.put("status", s.getStatus());
            m.put("lastSyncAt", s.getLastSyncAt());
            m.put("lastFullSync", s.getLastFullSync());
            m.put("issuesSynced", s.getIssuesSynced());
            m.put("errorMessage", s.getErrorMessage());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "syncing", syncing,
                "projects", statusList));
    }

    /**
     * POST /api/jira/sync/project/{projectKey}
     * Sync a single project.
     */
    @PostMapping("/project/{projectKey}")
    public ResponseEntity<Map<String, Object>> syncProject(
            @PathVariable String projectKey,
            @RequestParam(defaultValue = "false") boolean fullSync) {

        if (!creds.isConfigured()) {
            return ResponseEntity.ok(Map.of("error", "Jira not configured"));
        }

        try {
            syncService.syncProject(projectKey, fullSync);
            return ResponseEntity.ok(Map.of(
                    "status", "COMPLETED",
                    "message", "Sync completed for " + projectKey));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "status", "FAILED",
                    "error", e.getMessage()));
        }
    }
}
