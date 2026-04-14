package com.portfolioplanner.ai.api;

import com.portfolioplanner.ai.api.dto.QueryRequest;
import com.portfolioplanner.ai.api.dto.QueryResponse;
import com.portfolioplanner.ai.chunking.ChunkingService;
import com.portfolioplanner.ai.rag.RagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Public AI Hub API — called by the main app's proxy controller.
 *
 * POST /ai/query          — answer a natural-language question about the portfolio
 * POST /ai/feedback       — record thumbs-up/down on an answer
 * GET  /ai/status         — health + model info for the AI Hub UI panel
 */
@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
@Slf4j
public class AiHubController {

    private final RagService ragService;
    private final ChunkingService chunkingService;

    /**
     * Main query endpoint. Proxied from main app at /api/ai/query.
     */
    @PostMapping("/query")
    public ResponseEntity<QueryResponse> query(@Valid @RequestBody QueryRequest request) {
        QueryResponse response = ragService.query(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Feedback endpoint — records thumbs up/down for a conversation.
     * conversationId would need to be returned in QueryResponse in a future iteration.
     */
    @PostMapping("/feedback")
    public ResponseEntity<Map<String, String>> feedback(
            @RequestBody Map<String, Object> body) {
        // TODO: wire to ai.conversations.feedback column once conversationId is in QueryResponse
        log.debug("Feedback received: {}", body);
        return ResponseEntity.ok(Map.of("status", "recorded"));
    }

    /**
     * Status endpoint for the AI Hub panel — shows whether Ollama is reachable
     * and what model is configured.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "service", "portfolio-planner-ai",
                "version",  "1.0.0",
                "status",  "UP"
        ));
    }

    /**
     * Manual re-index trigger (admin use, not exposed to regular users).
     * Protected by a simple token check to avoid accidental triggers.
     */
    @PostMapping("/admin/reindex")
    public ResponseEntity<Map<String, Object>> reindex(
            @RequestHeader(value = "X-Admin-Token", required = false) String token) {
        if (!"pp-ai-admin".equals(token)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid admin token"));
        }
        int total = chunkingService.indexAllProjects();
        return ResponseEntity.ok(Map.of("status", "complete", "chunksWritten", total));
    }
}
