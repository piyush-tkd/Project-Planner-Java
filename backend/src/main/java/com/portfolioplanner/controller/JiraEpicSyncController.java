package com.portfolioplanner.controller;

import com.portfolioplanner.service.jira.JiraClient;
import com.portfolioplanner.service.jira.JiraEpicPushService;
import com.portfolioplanner.service.jira.JiraEpicPushService.PushResult;
import com.portfolioplanner.service.jira.JiraEpicSyncService;
import com.portfolioplanner.service.jira.JiraEpicSyncService.SyncResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for Jira epic synchronisation and push-to-Jira.
 *
 * <ul>
 *   <li>{@code POST /api/jira-sync/run}              — trigger a full sync immediately (admin)</li>
 *   <li>{@code POST /api/jira-sync/board/{id}}        — sync a single board (admin)</li>
 *   <li>{@code GET  /api/jira-sync/status}            — per-board sync status panel</li>
 *   <li>{@code POST /api/jira-sync/push/{projectId}}  — push a MANUAL project to Jira as an Epic</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/jira-sync")
@RequiredArgsConstructor
public class JiraEpicSyncController {

    private final JiraEpicSyncService syncService;
    private final JiraEpicPushService pushService;
    private final JiraClient jiraClient;

    /**
     * Triggers a full sync across all Jira boards.
     * Restricted to ADMIN role to prevent accidental mass-imports.
     */
    @PostMapping("/run")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SyncResult> runFullSync() {
        log.info("JiraEpicSyncController: manual full-sync triggered");
        SyncResult result = syncService.syncAllBoards();
        return ResponseEntity.ok(result);
    }

    /**
     * Triggers a sync for a single board identified by its Jira board ID.
     */
    @PostMapping("/board/{boardId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<JiraEpicSyncService.BoardSyncResult> runBoardSync(
            @PathVariable long boardId) {
        log.info("JiraEpicSyncController: manual board sync triggered for board {}", boardId);
        JiraEpicSyncService.BoardSyncResult result = syncService.syncBoard(boardId, "board-" + boardId);
        return ResponseEntity.ok(result);
    }

    /**
     * Syncs a single Jira epic by key (e.g. "PMO-45").
     * Called from the Project Detail page — much cheaper than a full sync.
     * Any authenticated user with access to the project can call this.
     */
    @PostMapping("/epic/{epicKey}")
    public ResponseEntity<java.util.Map<String, Object>> syncOneEpic(@PathVariable String epicKey) {
        log.info("JiraEpicSyncController: single-epic sync for {}", epicKey);
        java.util.Map<String, Object> result = syncService.syncOneEpic(epicKey);
        return ResponseEntity.ok(result);
    }

    /**
     * Returns the per-board sync status for the admin settings panel.
     * All authenticated users can read this (needed for the OrgSettings sync panel).
     */
    @GetMapping("/status")
    public ResponseEntity<List<Map<String, Object>>> getBoardStatus() {
        return ResponseEntity.ok(syncService.getBoardSyncStatus());
    }

    /**
     * GET /api/jira-sync/diagnose
     * Returns raw Jira data for each board to diagnose why status/priority may be wrong.
     * Shows boards, epic keys, and the enriched fields (status + priority) from Jira.
     */
    @GetMapping("/diagnose")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> diagnose() {
        java.util.List<Map<String, Object>> boards;
        try {
            boards = jiraClient.getAllAgileBoards();
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", "Cannot fetch agile boards: " + e.getMessage()));
        }

        java.util.List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Map<String, Object> board : boards) {
            long boardId = board.get("id") instanceof Number n ? n.longValue() : 0L;
            String boardName = (String) board.getOrDefault("name", "?");

            Map<String, Object> boardInfo = new java.util.LinkedHashMap<>();
            boardInfo.put("boardId", boardId);
            boardInfo.put("boardName", boardName);

            java.util.List<Map<String, Object>> epics;
            try {
                epics = jiraClient.getEpicsFromBoard(boardId);
            } catch (Exception e) {
                boardInfo.put("error", "Epic fetch failed: " + e.getMessage());
                result.add(boardInfo);
                continue;
            }

            boardInfo.put("epicCount", epics.size());
            java.util.List<String> keys = epics.stream()
                    .map(e -> e.get("key") instanceof String s ? s : null)
                    .filter(k -> k != null)
                    .collect(java.util.stream.Collectors.toList());
            boardInfo.put("epicKeys", keys);

            // Enrich with full fields
            Map<String, Map<String, Object>> enriched = Map.of();
            try {
                enriched = jiraClient.getIssueFieldsByKeys(keys);
            } catch (Exception e) {
                boardInfo.put("enrichmentError", e.getMessage());
            }
            boardInfo.put("enrichedCount", enriched.size());

            // Sample first 5 issues with their status + priority
            java.util.List<Map<String, Object>> samples = new java.util.ArrayList<>();
            for (Map.Entry<String, Map<String, Object>> entry : enriched.entrySet()) {
                if (samples.size() >= 5) break;
                Map<String, Object> issue = entry.getValue();
                Object fields = issue.get("fields");
                Map<String, Object> sample = new java.util.LinkedHashMap<>();
                sample.put("key", entry.getKey());
                if (fields instanceof Map<?,?> f) {
                    Object statusObj = f.get("status");
                    if (statusObj instanceof Map<?,?> s) {
                        sample.put("statusName", s.get("name"));
                        Object cat = s.get("statusCategory");
                        if (cat instanceof Map<?,?> c) sample.put("statusCategory", c.get("key"));
                    }
                    Object priObj = f.get("priority");
                    if (priObj instanceof Map<?,?> p) sample.put("priorityName", p.get("name"));
                    else sample.put("priorityName", "null/missing");
                } else {
                    sample.put("fields", "null/missing — enrichment may have failed");
                }
                samples.add(sample);
            }
            boardInfo.put("sampleIssues", samples);
            result.add(boardInfo);
        }

        return ResponseEntity.ok(Map.of("boards", result, "boardCount", boards.size()));
    }

    /**
     * Pushes a MANUAL Portfolio Planner project to Jira as a new Epic.
     *
     * <p>Request body: {@code { "jiraProjectKey": "PMO" }}
     *
     * <p>On success, the project's {@code source_type} is updated to
     * {@code PUSHED_TO_JIRA} and {@code jira_epic_key} is populated.
     */
    @PostMapping("/push/{projectId}")
    public ResponseEntity<?> pushProjectToJira(
            @PathVariable Long projectId,
            @RequestBody Map<String, String> body) {
        String jiraProjectKey = body.get("jiraProjectKey");
        if (jiraProjectKey == null || jiraProjectKey.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "jiraProjectKey is required"));
        }
        log.info("JiraEpicSyncController: push project {} to Jira project {}", projectId, jiraProjectKey);
        try {
            PushResult result = pushService.pushToJira(projectId, jiraProjectKey);
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
