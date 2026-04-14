package com.portfolioplanner.ai.sync;

import com.portfolioplanner.ai.chunking.ChunkingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Internal webhook endpoints called by the main Portfolio Planner app
 * whenever portfolio data changes (Option B sync strategy).
 *
 * These are NOT exposed to the frontend — main app → AI service only.
 * Bind to a separate port or add IP allowlist in production if needed.
 *
 * Endpoints:
 *   POST /internal/sync/project/{id}   — re-index a single project
 *   POST /internal/sync/all            — trigger full re-index (async)
 */
@RestController
@RequestMapping("/internal/sync")
@RequiredArgsConstructor
@Slf4j
public class SyncController {

    private final ChunkingService chunkingService;

    /**
     * Re-index a single project after create/update/patchStatus.
     * Returns immediately with 202 Accepted; indexing happens on the caller thread.
     * (Small enough operation to be synchronous without blocking the main app.)
     */
    @PostMapping("/project/{id}")
    public ResponseEntity<Map<String, Object>> syncProject(@PathVariable Long id) {
        log.info("Sync webhook received for project {}", id);
        try {
            int chunks = chunkingService.indexProject(id);
            return ResponseEntity.accepted()
                    .body(Map.of("projectId", id, "chunksWritten", chunks, "status", "OK"));
        } catch (Exception e) {
            log.error("Sync failed for project {}: {}", id, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("projectId", id, "status", "ERROR", "error", e.getMessage()));
        }
    }

    /**
     * Trigger a full re-index asynchronously.
     * Returns 202 immediately — re-index runs in background.
     */
    @PostMapping("/all")
    public ResponseEntity<Map<String, String>> syncAll() {
        log.info("Full re-index triggered via webhook");
        runFullReindexAsync();
        return ResponseEntity.accepted()
                .body(Map.of("status", "ACCEPTED", "message", "Full re-index started in background"));
    }

    @Async
    protected void runFullReindexAsync() {
        try {
            int total = chunkingService.indexAllProjects();
            log.info("Async full re-index complete: {} chunks", total);
        } catch (Exception e) {
            log.error("Async full re-index failed: {}", e.getMessage(), e);
        }
    }
}
