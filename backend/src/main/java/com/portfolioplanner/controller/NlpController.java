package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.model.NlpLearnedPattern;
import com.portfolioplanner.domain.model.NlpLearnerRun;
import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.dto.request.NlpConfigRequest;
import com.portfolioplanner.dto.request.NlpQueryRequest;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpConfigResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import com.portfolioplanner.dto.response.NlpConversationResponse;
import com.portfolioplanner.service.nlp.NlpCatalogService;
import com.portfolioplanner.service.nlp.NlpConversationService;
import com.portfolioplanner.service.nlp.NlpConfigService;
import com.portfolioplanner.service.nlp.NlpRoutingCatalog;
import com.portfolioplanner.service.nlp.NlpEmbeddingSyncService;
import com.portfolioplanner.service.nlp.NlpLearnerService;
import com.portfolioplanner.service.nlp.NlpInsightService;
import com.portfolioplanner.service.nlp.NlpService;
import com.portfolioplanner.service.nlp.NlpStrategyEngine;
import com.portfolioplanner.service.nlp.NlpVectorSearchService;
import com.portfolioplanner.service.nlp.NlpToolRegistry;
import com.portfolioplanner.service.nlp.NlpResponseBuilder;
import com.portfolioplanner.service.nlp.NlpStrategy;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/nlp")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NlpController {

    private final NlpService nlpService;
    private final NlpCatalogService catalogService;
    private final NlpConfigService configService;
    private final NlpLearnerService learnerService;
    private final NlpEmbeddingSyncService embeddingSyncService;
    private final NlpVectorSearchService vectorSearchService;
    private final NlpConversationService conversationService;
    private final NlpInsightService insightService;
    private final AppUserRepository userRepo;
    private final NlpToolRegistry toolRegistry;
    private final NlpResponseBuilder responseBuilder;
    private final NlpStrategyEngine strategyEngine;
    private final NlpRoutingCatalog routingCatalog;

    /** Process a natural language query, optionally with session context for follow-ups. */
    @PostMapping("/query")
    public ResponseEntity<NlpQueryResponse> query(@Valid @RequestBody NlpQueryRequest request,
                                                   Authentication auth) {
        Long userId = resolveUserId(auth);
        NlpQueryResponse response;
        if (request.sessionContext() != null && !request.sessionContext().isBlank()) {
            response = nlpService.queryWithContext(request.query(), request.sessionContext(), userId);
        } else {
            response = nlpService.query(request.query(), userId);
        }
        return ResponseEntity.ok(response);
    }

    /**
     * Stream a natural language query with real-time progress events via SSE.
     * Events: phase (progress updates), result (final answer), error (on failure).
     */
    @PostMapping(value = "/query/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter queryStream(@Valid @RequestBody NlpQueryRequest request,
                                   Authentication auth) {
        Long userId = resolveUserId(auth);
        SseEmitter emitter = new SseEmitter(120_000L); // 2 min timeout
        String queryText = request.query();
        // If session context provided, build enhanced query
        if (request.sessionContext() != null && !request.sessionContext().isBlank()) {
            queryText = request.sessionContext() + "\n\nCurrent question: " + queryText;
        }
        nlpService.queryStreaming(queryText, userId, emitter);
        return emitter;
    }

    /** Get the entity catalog (for autocomplete and LLM context). */
    @GetMapping("/catalog")
    public ResponseEntity<NlpCatalogResponse> getCatalog() {
        return ResponseEntity.ok(catalogService.getCatalog());
    }

    /** Get proactive insight cards for the Ask AI landing page. */
    @GetMapping("/insights")
    public ResponseEntity<List<NlpInsightService.InsightCard>> getInsights() {
        return ResponseEntity.ok(insightService.getInsights());
    }

    /** Execute a tool directly (used by insight cards to bypass NLP pipeline). */
    @PostMapping("/direct-tool")
    public ResponseEntity<NlpQueryResponse> directTool(@RequestBody Map<String, Object> body) {
        String toolName = (String) body.get("toolName");
        @SuppressWarnings("unchecked")
        Map<String, String> params = (Map<String, String>) body.getOrDefault("params", Map.of());

        NlpCatalogResponse catalog = catalogService.getCatalog();
        com.fasterxml.jackson.databind.JsonNode toolParams = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(params);

        NlpToolRegistry.ToolResult toolResult = toolRegistry.executeTool(toolName, toolParams, catalog);
        NlpStrategy.NlpResult nlpResult = responseBuilder.buildFromToolResult(toolName, params, toolResult);

        return ResponseEntity.ok(nlpResult.toResponse("DIRECT_TOOL"));
    }

    /** Get NLP configuration (admin). */
    @GetMapping("/config")
    public ResponseEntity<NlpConfigResponse> getConfig() {
        return ResponseEntity.ok(configService.getConfig());
    }

    /** Update NLP configuration (admin). */
    @PutMapping("/config")
    public ResponseEntity<NlpConfigResponse> updateConfig(@RequestBody NlpConfigRequest request) {
        return ResponseEntity.ok(configService.updateConfig(request));
    }

    /**
     * Smart autocomplete endpoint — returns up to 5 example phrases matching the partial query.
     * Called on every keystroke (after 300ms debounce) to populate the search dropdown.
     * Uses the routing catalog's curated phrase list; no DB or LLM involved.
     */
    @GetMapping("/suggest")
    public ResponseEntity<List<String>> suggest(@RequestParam(required = false, defaultValue = "") String q) {
        if (q.length() < 2) return ResponseEntity.ok(List.of());
        List<String> suggestions = routingCatalog.getSuggestions(q, 5);
        return ResponseEntity.ok(suggestions);
    }

    /** Test a specific strategy's availability. */
    @PostMapping("/test-connection")
    public ResponseEntity<NlpConfigResponse> testConnection() {
        return ResponseEntity.ok(configService.getConfig());
    }

    /**
     * Health check endpoint — returns the current operational tier of the NLP engine.
     * Used by the frontend to show a degraded-mode banner when LLM is unavailable.
     *
     * Tiers:
     *   FULL      — pgvector + Ollama both available (full semantic + LLM pipeline)
     *   DB_ONLY   — pgvector available but Ollama unavailable (routing catalog + rule-based only)
     *   REGEX_ONLY — pgvector unavailable (deterministic + rule-based only, no vector search)
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealth() {
        boolean pgvector = vectorSearchService.isPgvectorAvailable();
        Map<String, Boolean> strategyAvailability = strategyEngine.getStrategyAvailability();
        boolean ollama = Boolean.TRUE.equals(strategyAvailability.getOrDefault("LOCAL_LLM", false));
        boolean cloudLlm = Boolean.TRUE.equals(strategyAvailability.getOrDefault("CLOUD_LLM", false));

        String tier;
        if (pgvector && (ollama || cloudLlm)) {
            tier = "FULL";
        } else if (pgvector) {
            tier = "DB_ONLY";
        } else {
            tier = "REGEX_ONLY";
        }

        Map<String, Object> health = new java.util.LinkedHashMap<>();
        health.put("pgvector", pgvector);
        health.put("ollama", ollama);
        health.put("cloudLlm", cloudLlm);
        health.put("tier", tier);
        health.put("strategyAvailability", strategyAvailability);
        health.put("activeChain", strategyEngine.getChain());
        return ResponseEntity.ok(health);
    }

    // ── Feedback ───────────────────────────────────────────────────────────

    /** Submit thumbs-up / thumbs-down feedback on a query result. */
    @PostMapping("/feedback")
    public ResponseEntity<Void> submitFeedback(@RequestBody Map<String, Object> body) {
        Long queryLogId = ((Number) body.get("queryLogId")).longValue();
        short rating = ((Number) body.get("rating")).shortValue();
        String comment = body.get("comment") != null ? body.get("comment").toString() : null;
        String screenshot = body.get("screenshot") != null ? body.get("screenshot").toString() : null;
        learnerService.submitFeedback(queryLogId, rating, comment, screenshot);
        return ResponseEntity.ok().build();
    }

    /** Undo feedback — resets rating, comment, and screenshot within the undo window. */
    @PostMapping("/feedback/undo")
    public ResponseEntity<Void> undoFeedback(@RequestBody Map<String, Object> body) {
        Long queryLogId = ((Number) body.get("queryLogId")).longValue();
        learnerService.undoFeedback(queryLogId);
        return ResponseEntity.ok().build();
    }

    // ── Learner / Optimizer ────────────────────────────────────────────────

    /** Run the NLP learner analysis (admin). */
    @PostMapping("/learner/run")
    public ResponseEntity<NlpLearnerService.LearnerStats> runLearner() {
        return ResponseEntity.ok(learnerService.runLearner());
    }

    /** Get low-confidence query logs for admin review. */
    @GetMapping("/learner/low-confidence")
    public ResponseEntity<List<NlpQueryLog>> getLowConfidenceLogs() {
        return ResponseEntity.ok(learnerService.getLowConfidenceLogs());
    }

    /** Get negatively-rated query logs for admin review. */
    @GetMapping("/learner/negative-rated")
    public ResponseEntity<List<NlpQueryLog>> getNegativelyRatedLogs() {
        return ResponseEntity.ok(learnerService.getNegativelyRatedLogs());
    }

    /** Get all learned patterns. */
    @GetMapping("/learner/patterns")
    public ResponseEntity<List<NlpLearnedPattern>> getAllPatterns() {
        return ResponseEntity.ok(learnerService.getAllPatterns());
    }

    /** Toggle a learned pattern's active state. */
    @PutMapping("/learner/patterns/{id}/toggle")
    public ResponseEntity<NlpLearnedPattern> togglePattern(@PathVariable Long id) {
        return ResponseEntity.ok(learnerService.togglePattern(id));
    }

    /** Delete a learned pattern. */
    @DeleteMapping("/learner/patterns/{id}")
    public ResponseEntity<Void> deletePattern(@PathVariable Long id) {
        learnerService.deletePattern(id);
        return ResponseEntity.noContent().build();
    }

    /** Get learner run history for trend analysis. */
    @GetMapping("/learner/history")
    public ResponseEntity<List<NlpLearnerRun>> getRunHistory() {
        return ResponseEntity.ok(learnerService.getRunHistory());
    }

    // ── Embeddings / Vector Search ────────────────────────────────────────

    /** Trigger embedding sync (admin). */
    @PostMapping("/embeddings/sync")
    public ResponseEntity<Map<String, Object>> syncEmbeddings() {
        embeddingSyncService.syncNow();
        return ResponseEntity.ok(Map.of(
                "status", "synced",
                "stats", vectorSearchService.getEmbeddingStats()
        ));
    }

    /** Get embedding statistics (admin). */
    @GetMapping("/embeddings/stats")
    public ResponseEntity<Map<String, Long>> getEmbeddingStats() {
        return ResponseEntity.ok(vectorSearchService.getEmbeddingStats());
    }

    // ── Conversations ─────────────────────────────────────────────────────

    /** List user's conversations. */
    @GetMapping("/conversations")
    public ResponseEntity<List<NlpConversationResponse>> listConversations(Authentication auth) {
        return ResponseEntity.ok(conversationService.listConversations(resolveUsername(auth)));
    }

    /** Get a single conversation with messages. */
    @GetMapping("/conversations/{id}")
    public ResponseEntity<NlpConversationResponse> getConversation(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(conversationService.getConversation(id, resolveUsername(auth)));
    }

    /** Create a new conversation. */
    @PostMapping("/conversations")
    public ResponseEntity<NlpConversationResponse> createConversation(@RequestBody Map<String, String> body, Authentication auth) {
        String title = body.getOrDefault("title", null);
        return ResponseEntity.ok(conversationService.createConversation(resolveUsername(auth), title));
    }

    /** Send a message in a conversation. */
    @PostMapping("/conversations/{id}/messages")
    public ResponseEntity<NlpConversationResponse.MessageResponse> sendMessage(
            @PathVariable Long id, @RequestBody Map<String, String> body, Authentication auth) {
        String message = body.get("message");
        Long userId = resolveUserId(auth);
        return ResponseEntity.ok(conversationService.sendMessage(id, resolveUsername(auth), message, userId));
    }

    /** Delete a conversation. */
    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id, Authentication auth) {
        conversationService.deleteConversation(id, resolveUsername(auth));
        return ResponseEntity.noContent().build();
    }

    /** Pin/unpin a conversation. */
    @PutMapping("/conversations/{id}/pin")
    public ResponseEntity<Void> togglePin(@PathVariable Long id, Authentication auth) {
        conversationService.togglePin(id, resolveUsername(auth));
        return ResponseEntity.ok().build();
    }

    /** Get conversation context JSON for session memory restoration. */
    @GetMapping("/conversations/{id}/context")
    public ResponseEntity<String> getConversationContext(@PathVariable Long id, Authentication auth) {
        return conversationService.getContext(id, resolveUsername(auth))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    private Long resolveUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userRepo.findByUsername(auth.getName())
                .map(AppUser::getId)
                .orElse(null);
    }

    private String resolveUsername(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return auth.getName();
    }
}
