package com.portfolioplanner.service.nlp;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.model.NlpConversation;
import com.portfolioplanner.domain.model.NlpConversationMessage;
import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.domain.repository.NlpConversationMessageRepository;
import com.portfolioplanner.domain.repository.NlpConversationRepository;
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

import java.time.Instant;
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
    private final NlpRateLimiter rateLimiter;
    private final NlpSessionContextCache sessionContextCache;
    private final FollowUpResolver followUpResolver;
    private final AppUserRepository userRepo;
    private final AiRagFallbackService ragFallback;
    private final NlpConversationRepository conversationRepo;
    private final NlpConversationMessageRepository conversationMessageRepo;

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

        // ── Rate limiting: enforce per-user 10 req/min cap ───────────────────
        if (!rateLimiter.tryAcquire(userId)) {
            int remaining = rateLimiter.remainingRequests(userId);
            log.warn("NLP rate limit enforced for user {} — {} requests remaining", userId, remaining);
            return NlpQueryResponse.fallback(
                    "You've sent too many queries in the last minute. Please wait a moment and try again. " +
                    "(Limit: " + NlpRateLimiter.MAX_REQUESTS_PER_MINUTE + " queries/minute)");
        }

        try {
            // Load entity catalog for context
            NlpCatalogResponse catalog = catalogService.getCatalog();

            // Preprocess: normalize abbreviations, synonyms, filler words, then resolve aliases
            String processedQuery = preprocessor.preprocess(queryText);
            processedQuery = aliasResolver.resolve(processedQuery);

            // ── Follow-up resolution: substitute pronouns with entities from last result ──
            processedQuery = followUpResolver.resolve(processedQuery, userId);

            log.debug("Query preprocessed: '{}' -> '{}'", queryText, processedQuery);

            // ── RBAC: enforce tool-level access control before query execution ──
            String userRole = resolveUserRole(userId);
            NlpQueryResponse rbacDenied = checkToolRbac(processedQuery, userRole);
            if (rbacDenied != null) {
                log.warn("NLP RBAC denied tool access for user {} (role={}): '{}'",
                        userId, userRole, queryText);
                return rbacDenied;
            }

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

            // ── RAG fallback: if still UNKNOWN or very low confidence, ask the AI service ──
            if ("UNKNOWN".equals(response.intent()) || response.confidence() < AiRagFallbackService.RAG_FALLBACK_THRESHOLD) {
                NlpQueryResponse ragResponse = ragFallback.query(queryText);
                if (ragResponse != null) {
                    response = ragResponse;
                    log.info("NLP query answered via RAG fallback for '{}'", queryText);
                }
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("NLP query processed in {}ms: '{}' -> intent={} confidence={} resolvedBy={}",
                    elapsed, queryText, response.intent(), response.confidence(), response.resolvedBy());

            // ── Store session context for follow-up pronoun resolution ──
            try { storeSessionContext(userId, response); } catch (Exception ignored) {}

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
            processedQuery = followUpResolver.resolve(processedQuery, userId);

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

                    // Phase 4.5: RAG fallback if still UNKNOWN
                    if ("UNKNOWN".equals(response.intent()) || response.confidence() < AiRagFallbackService.RAG_FALLBACK_THRESHOLD) {
                        sendPhase(emitter, "searching", "Searching your portfolio data...", "Querying AI knowledge base");
                        NlpQueryResponse ragResponse = ragFallback.query(queryText);
                        if (ragResponse != null) {
                            response = ragResponse;
                            log.info("Streaming query answered via RAG fallback for '{}'", queryText);
                        }
                    }
                }
            }

            long elapsed = System.currentTimeMillis() - start;

            // Phase 5: Finalizing
            sendPhase(emitter, "finalizing", "Preparing your answer...", "Formatting response");

            tryAutoLearn(queryText, response);
            Long logId = saveQueryLog(userId, queryText, response, (int) elapsed);
            NlpQueryResponse finalResponse = response.withLogId(logId);

            // Auto-save to conversation history (fire-and-forget, never block the stream)
            try { autoSaveConversation(userId, queryText, finalResponse); } catch (Exception ignored) {}

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

    /**
     * Extract and store session context from a successful response.
     * Used by FollowUpResolver to resolve pronouns in subsequent queries.
     */
    private void storeSessionContext(Long userId, NlpQueryResponse response) {
        if (userId == null || response == null || response.response() == null) return;

        // Only store context for data-bearing intents that produce entity lists
        String intent = response.intent();
        if (!"DATA_QUERY".equals(intent) && !"INSIGHT".equals(intent)) return;

        var data = response.response().data();
        if (data == null) return;

        // Extract entity names from numbered items (#1, #2, ...)
        java.util.List<String> entityNames = new java.util.ArrayList<>();
        int i = 1;
        while (data.containsKey("#" + i) && entityNames.size() < 10) {
            String itemText = String.valueOf(data.get("#" + i));
            // Take just the first segment before " | " as the entity name
            String name = itemText.contains(" | ") ? itemText.split(" \\| ")[0].trim() : itemText;
            // Strip priority brackets like "[P0]" from the end
            name = name.replaceAll("\\s*\\[[^]]+]$", "").trim();
            if (!name.isBlank()) entityNames.add(name);
            i++;
        }

        int resultCount = 0;
        if (data.containsKey("Count")) {
            try { resultCount = Integer.parseInt(String.valueOf(data.get("Count"))); }
            catch (NumberFormatException ignored) {}
        }
        if (resultCount == 0) resultCount = entityNames.size();

        String toolName = null;
        java.util.Map<String, String> params = java.util.Map.of();
        String listType = data.containsKey("listType") ? String.valueOf(data.get("listType")) : null;

        sessionContextCache.put(userId, new NlpSessionContextCache.SessionContext(
                toolName, params, entityNames, resultCount, intent, listType,
                java.time.Instant.now()
        ));
    }

    // ── RBAC helpers ───────────────────────────────────────────────────────────

    /**
     * Resolve the role string for a given user ID.
     * Returns null if userId is null or user not found (role check will pass-through).
     */
    private String resolveUserRole(Long userId) {
        if (userId == null) return null;
        try {
            return userRepo.findById(userId).map(AppUser::getRole).orElse(null);
        } catch (Exception e) {
            log.debug("Could not resolve role for userId {}: {}", userId, e.getMessage());
            return null;
        }
    }

    /**
     * Pre-flight RBAC check: use the routing catalog to predict which tool would be called.
     * If that tool is role-restricted and the user's role doesn't meet the minimum,
     * returns an access-denied NlpQueryResponse. Otherwise returns null (proceed normally).
     */
    private NlpQueryResponse checkToolRbac(String processedQuery, String userRole) {
        if (!"READ_ONLY".equalsIgnoreCase(userRole)) return null; // non-READ_ONLY: always allowed
        try {
            NlpRoutingCatalog.RoutingDecision decision = routingCatalog.findRoute(processedQuery);
            if (decision != null && toolRegistry.isRestrictedTool(decision.toolName())) {
                String friendlyName = decision.toolName().replaceFirst("^get_", "").replace('_', ' ');
                return NlpQueryResponse.fallback(
                        "Access denied: your READ_ONLY role does not permit viewing " + friendlyName + " data. " +
                        "Please contact your administrator to request READ_WRITE access."
                );
            }
        } catch (Exception e) {
            log.debug("RBAC routing catalog check failed (non-critical): {}", e.getMessage());
        }
        return null;
    }

    /**
     * Auto-saves query + result to nlp_conversation so the history page is populated.
     * Creates a new conversation per calendar day per user, or reuses today's if one exists.
     * Never throws — wrapped in try/catch at call site.
     */
    private void autoSaveConversation(Long userId, String queryText, NlpQueryResponse response) {
        if (userId == null) return;
        // Skip saving UNKNOWN, ERROR, or rate-limit responses
        if (response.intent() == null || "UNKNOWN".equals(response.intent()) || "ERROR".equals(response.intent())) return;

        String username = userRepo.findById(userId).map(AppUser::getUsername).orElse(null);
        if (username == null) return;

        // Find today's auto-conversation or create one
        String todayTitle = "Session " + java.time.LocalDate.now();
        NlpConversation conversation = conversationRepo
                .findByUsernameOrderByUpdatedAtDesc(username)
                .stream()
                .filter(c -> todayTitle.equals(c.getTitle()))
                .findFirst()
                .orElseGet(() -> {
                    NlpConversation c = new NlpConversation();
                    c.setUsername(username);
                    c.setTitle(todayTitle);
                    c.setPinned(false);
                    c.setMessageCount(0);
                    c.setCreatedAt(Instant.now());
                    c.setUpdatedAt(Instant.now());
                    return conversationRepo.save(c);
                });

        // Save user message
        NlpConversationMessage userMsg = new NlpConversationMessage();
        userMsg.setConversationId(conversation.getId());
        userMsg.setRole("user");
        userMsg.setContent(queryText);
        conversationMessageRepo.save(userMsg);

        // Save assistant response
        String assistantContent = response.response() != null && response.response().message() != null
                ? response.response().message() : response.intent();
        NlpConversationMessage assistantMsg = new NlpConversationMessage();
        assistantMsg.setConversationId(conversation.getId());
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(assistantContent);
        assistantMsg.setIntent(response.intent());
        assistantMsg.setConfidence(response.confidence());
        assistantMsg.setResolvedBy(response.resolvedBy());
        conversationMessageRepo.save(assistantMsg);

        // Update conversation metadata
        conversation.setMessageCount(conversation.getMessageCount() + 2);
        conversation.setUpdatedAt(Instant.now());
        conversationRepo.save(conversation);
        log.debug("Auto-saved query to conversation {} for user {}", conversation.getId(), username);
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
