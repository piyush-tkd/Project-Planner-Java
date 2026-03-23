package com.portfolioplanner.service.nlp;

import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.NlpQueryLogRepository;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Main NLP service — the single entry point for processing natural language queries.
 * Applies query preprocessing (abbreviation expansion, synonym normalization, fuzzy matching)
 * before routing through the strategy chain.
 */
@Service
@RequiredArgsConstructor
public class NlpService {

    private static final Logger log = LoggerFactory.getLogger(NlpService.class);

    private final NlpStrategyEngine engine;
    private final NlpCatalogService catalogService;
    private final NlpQueryLogRepository queryLogRepo;
    private final NlpConfigService configService;
    private final NlpQueryPreprocessor preprocessor;
    private final AliasResolver aliasResolver;
    private final NlpVectorSearchService vectorSearchService;
    private final NlpRoutingCatalog routingCatalog;
    private final NlpToolRegistry toolRegistry;
    private final NlpResponseBuilder responseBuilder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Minimum similarity for a vector pattern match to be used as a shortcut. */
    private static final double VECTOR_PATTERN_THRESHOLD = 0.88;

    /** Auto-learn threshold: queries above this confidence are auto-embedded without user feedback. */
    private static final double AUTO_LEARN_CONFIDENCE = 0.90;

    /**
     * Intents worth auto-learning.
     * IMPORTANT: DATA_QUERY, INSIGHT, REPORT are EXCLUDED because their responses contain
     * live data that becomes stale immediately. Auto-learning these caused "poisoned patterns"
     * that returned empty/stale cached data instead of fresh tool results.
     * Only FORM_PREFILL is safe to auto-learn because the response is a route + form fields (no live data).
     */
    private static final Set<String> AUTO_LEARN_INTENTS = Set.of("FORM_PREFILL");

    /**
     * Process a natural language query and return a structured response.
     */
    public NlpQueryResponse query(String queryText, Long userId) {
        long start = System.currentTimeMillis();

        try {
            // Load entity catalog for context
            NlpCatalogResponse catalog = catalogService.getCatalog();

            // Preprocess: normalize abbreviations, synonyms, filler words, then resolve aliases
            String processedQuery = preprocessor.preprocess(queryText);
            processedQuery = aliasResolver.resolve(processedQuery);
            log.debug("Query preprocessed: '{}' -> '{}'", queryText, processedQuery);

            // ── Phase 1.6: Routing catalog — check if a known query pattern is in the catalog ──
            NlpQueryResponse routingCatalogResponse = tryRoutingCatalog(processedQuery, catalog);
            NlpQueryResponse response;
            if (routingCatalogResponse != null) {
                response = routingCatalogResponse;
                log.info("NLP query resolved via routing catalog for '{}'", queryText);
            } else {
                // ── Vector pattern shortcut: check if a very similar query was already resolved ──
                NlpQueryResponse vectorShortcut = tryVectorPatternMatch(processedQuery);
                if (vectorShortcut != null) {
                    response = vectorShortcut;
                    log.info("NLP query resolved via vector pattern match for '{}'", queryText);
                } else {
                    // Process through strategy chain (use preprocessed query)
                    response = engine.process(processedQuery, catalog);
                }
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("NLP query processed in {}ms: '{}' -> intent={} confidence={} resolvedBy={}",
                    elapsed, queryText, response.intent(), response.confidence(), response.resolvedBy());

            // ── Auto-learn: embed high-confidence results (fire-and-forget) ──
            try { tryAutoLearn(queryText, response); } catch (Exception ignored) {}

            // Log query asynchronously — don't block the response for a DB write
            final NlpQueryResponse finalResponse = response;
            final long el = elapsed;
            Long logId = null;
            try {
                logId = saveQueryLog(userId, queryText, finalResponse, (int) el);
            } catch (Exception e) {
                log.debug("Query logging failed (non-critical): {}", e.getMessage());
            }
            return response.withLogId(logId);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("NLP query FAILED in {}ms for '{}': {}", elapsed, queryText, e.getMessage(), e);
            return NlpQueryResponse.fallback(
                    "Sorry, something went wrong processing your query. The error has been logged. Please try again or rephrase your question.");
        }
    }

    /**
     * Try to resolve a routing decision from the NlpRoutingCatalog.
     * If a match is found, execute the tool immediately and return the response.
     * Phase 1.6 — routing catalog has highest priority for known patterns.
     */
    private NlpQueryResponse tryRoutingCatalog(String query, NlpCatalogResponse catalog) {
        try {
            NlpRoutingCatalog.RoutingDecision decision = routingCatalog.findRoute(query);
            if (decision == null) return null;

            log.debug("Routing catalog match: '{}' → tool={} params={} confidence={}",
                    query, decision.toolName(), decision.params(), decision.confidence());

            try {
                JsonNode toolParams = objectMapper.valueToTree(decision.params());
                NlpToolRegistry.ToolResult toolResult = toolRegistry.executeTool(
                        decision.toolName(), toolParams, catalog);

                if (toolResult.success()) {
                    NlpStrategy.NlpResult result = responseBuilder.buildFromToolResult(
                            decision.toolName(), decision.params(), toolResult);
                    return result.toResponse("ROUTING_CATALOG");
                } else {
                    log.debug("Routing catalog tool execution failed for {}: {}",
                            decision.toolName(), toolResult.error());
                    return null;
                }
            } catch (Exception e) {
                log.warn("Routing catalog execution failed for {}: {}", decision.toolName(), e.getMessage());
                return null;
            }
        } catch (Exception e) {
            log.debug("Routing catalog check failed (non-critical): {}", e.getMessage());
            return null;
        }
    }

    /**
     * Try to resolve a query by finding a very similar previously-confirmed query pattern
     * in the vector store. If the closest match has high similarity, reuse its intent/route
     * to skip the full strategy chain entirely.
     */
    private NlpQueryResponse tryVectorPatternMatch(String query) {
        try {
            var patterns = vectorSearchService.searchQueryPatterns(query, 1);
            if (patterns.isEmpty()) return null;

            var best = patterns.get(0);
            if (best.similarity() >= VECTOR_PATTERN_THRESHOLD && best.intent() != null) {
                log.debug("Vector pattern match: '{}' → intent={} similarity={}",
                        query, best.intent(), String.format("%.3f", best.similarity()));

                // Vector patterns only provide routing hints (intent + entity).
                // For DATA_QUERY/INSIGHT intents, the cached response has no actual data —
                // the real data must come from the strategy chain. Only use vector shortcuts
                // for NAVIGATE, GREETING, HELP, and FORM_PREFILL which are self-contained.
                String intent = best.intent();
                if ("DATA_QUERY".equals(intent) || "INSIGHT".equals(intent) || "REPORT".equals(intent)) {
                    log.debug("Vector pattern match skipped for data-bearing intent '{}' — needs fresh strategy processing", intent);
                    return null;
                }

                return new NlpQueryResponse(
                        best.intent(),
                        best.confidence() * best.similarity(), // Combine original confidence with similarity
                        "VECTOR_PATTERN",
                        new NlpQueryResponse.NlpResponsePayload(
                                null, best.route(), null,
                                best.entityName() != null ? Map.of("entityName", best.entityName()) : null,
                                null, null),
                        List.of(),
                        null, null
                );
            }
        } catch (Exception e) {
            log.debug("Vector pattern search failed (non-critical): {}", e.getMessage());
        }
        return null;
    }

    /**
     * Process a query with conversation context.
     * Prepends recent conversation history to help the LLM understand follow-up questions.
     */
    public NlpQueryResponse queryWithContext(String queryText, String conversationContext, Long userId) {
        // If there's conversation context, prepend it to help the LLM
        String enhancedQuery = conversationContext != null && !conversationContext.isBlank()
                ? conversationContext + "\n\nCurrent question: " + queryText
                : queryText;
        return query(enhancedQuery, userId);
    }

    /**
     * Auto-embed high-confidence query results as learned patterns.
     * This compounds over time — the more the system is used, the faster it gets.
     * Only embeds DATA_QUERY/FORM_PREFILL/INSIGHT/REPORT intents to avoid noise.
     */
    private void tryAutoLearn(String queryText, NlpQueryResponse response) {
        try {
            if (response.confidence() >= AUTO_LEARN_CONFIDENCE
                    && response.intent() != null
                    && AUTO_LEARN_INTENTS.contains(response.intent())
                    && !"VECTOR_PATTERN".equals(response.resolvedBy())) { // Don't re-embed pattern shortcuts
                String route = response.response() != null ? response.response().route() : null;
                vectorSearchService.embedQueryPattern(
                        queryText, response.intent(), route, response.confidence(), "AUTO_LEARN");
                log.debug("Auto-learned query pattern: '{}' → {} (confidence: {})",
                        queryText, response.intent(), response.confidence());
            }
        } catch (Exception e) {
            log.debug("Auto-learn failed (non-critical): {}", e.getMessage());
        }
    }

    /**
     * Stream a query with real-time progress events via SSE.
     * Sends phase events as the pipeline progresses, then the final result.
     */
    @Async
    public void queryStreaming(String queryText, Long userId, SseEmitter emitter) {
        long start = System.currentTimeMillis();
        ObjectMapper mapper = new ObjectMapper();

        try {
            // Phase 1: Understanding
            sendPhase(emitter, "thinking", "Understanding your question...", "Parsing intent and entities");

            NlpCatalogResponse catalog = catalogService.getCatalog();
            String processedQuery = aliasResolver.resolve(preprocessor.preprocess(queryText));

            // Phase 2: Routing catalog check
            sendPhase(emitter, "searching", "Checking catalog...", "Looking for known query patterns");
            NlpQueryResponse routingCatalogResponse = tryRoutingCatalog(processedQuery, catalog);

            NlpQueryResponse response;
            if (routingCatalogResponse != null) {
                response = routingCatalogResponse;
                sendPhase(emitter, "matched", "Found in catalog!", "Executing known pattern");
            } else {
                // Phase 3: Vector pattern check
                sendPhase(emitter, "searching", "Checking learned patterns...", "Looking for similar past queries");
                NlpQueryResponse vectorShortcut = tryVectorPatternMatch(processedQuery);

                if (vectorShortcut != null) {
                    response = vectorShortcut;
                    sendPhase(emitter, "matched", "Found a pattern match!", "Reusing a previously confirmed answer");
                } else {
                    // Phase 4: Strategy chain
                    sendPhase(emitter, "analyzing", "Running analysis...", "Processing through the strategy chain");
                    response = engine.process(processedQuery, catalog);
                }
            }

            long elapsed = System.currentTimeMillis() - start;

            // Phase 5: Finalizing
            sendPhase(emitter, "finalizing", "Preparing your answer...", "Formatting response");

            tryAutoLearn(queryText, response);
            Long logId = saveQueryLog(userId, queryText, response, (int) elapsed);
            NlpQueryResponse finalResponse = response.withLogId(logId);

            // Send final result
            emitter.send(SseEmitter.event()
                    .name("result")
                    .data(mapper.writeValueAsString(finalResponse)));
            emitter.complete();

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("NLP streaming query FAILED in {}ms for '{}': {}", elapsed, queryText, e.getMessage(), e);
            try {
                NlpQueryResponse fallback = NlpQueryResponse.fallback(
                        "Sorry, something went wrong. Please try again or rephrase your question.");
                emitter.send(SseEmitter.event()
                        .name("result")
                        .data(mapper.writeValueAsString(fallback)));
                emitter.complete();
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        }
    }

    /** Send a progress phase event via SSE. */
    private void sendPhase(SseEmitter emitter, String phase, String message, String detail) {
        try {
            emitter.send(SseEmitter.event()
                    .name("phase")
                    .data("{\"phase\":\"" + phase + "\",\"message\":\"" + message + "\",\"detail\":\"" + detail + "\"}"));
        } catch (Exception e) {
            log.debug("Failed to send SSE phase event: {}", e.getMessage());
        }
    }

    private Long saveQueryLog(Long userId, String queryText, NlpQueryResponse response, int responseMs) {
        try {
            NlpQueryLog logEntry = new NlpQueryLog();
            logEntry.setUserId(userId);
            logEntry.setQueryText(queryText);
            logEntry.setIntent(response.intent());
            logEntry.setConfidence(response.confidence());
            logEntry.setResolvedBy(response.resolvedBy());
            logEntry.setResponseMs(responseMs);
            // Store entity name from response data if present
            if (response.response() != null && response.response().data() != null) {
                Object entityName = response.response().data().get("name");
                if (entityName != null) {
                    logEntry.setEntityName(String.valueOf(entityName));
                }
            }
            NlpQueryLog saved = queryLogRepo.save(logEntry);
            return saved.getId();
        } catch (Exception e) {
            log.warn("Failed to log NLP query: {}", e.getMessage());
            return null;
        }
    }
}
