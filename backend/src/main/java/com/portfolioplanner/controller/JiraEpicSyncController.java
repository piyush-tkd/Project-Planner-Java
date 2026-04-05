package com.portfolioplanner.controller;

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
     * Returns the per-board sync status for the admin settings panel.
     * All authenticated users can read this (needed for the OrgSettings sync panel).
     */
    @GetMapping("/status")
    public ResponseEntity<List<Map<String, Object>>> getBoardStatus() {
        return ResponseEntity.ok(syncService.getBoardSyncStatus());
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
