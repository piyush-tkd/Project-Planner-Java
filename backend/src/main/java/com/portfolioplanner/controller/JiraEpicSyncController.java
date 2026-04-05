package com.portfolioplanner.controller;

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
 * REST endpoints for Jira epic synchronisation.
 *
 * <ul>
 *   <li>{@code POST /api/jira-sync/run}      — trigger a full sync immediately (admin only)</li>
 *   <li>{@code POST /api/jira-sync/board/{id}} — sync a single board (admin only)</li>
 *   <li>{@code GET  /api/jira-sync/status}    — per-board sync status panel</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/jira-sync")
@RequiredArgsConstructor
public class JiraEpicSyncController {

    private final JiraEpicSyncService syncService;

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
}
