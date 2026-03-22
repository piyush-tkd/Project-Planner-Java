package com.portfolioplanner.service.nlp;

import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.NlpQueryLogRepository;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

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
    private final NlpVectorSearchService vectorSearchService;

    /** Minimum similarity for a vector pattern match to be used as a shortcut. */
    private static final double VECTOR_PATTERN_THRESHOLD = 0.88;

    /**
     * Process a natural language query and return a structured response.
     */
    public NlpQueryResponse query(String queryText, Long userId) {
        long start = System.currentTimeMillis();

        try {
            // Load entity catalog for context
            NlpCatalogResponse catalog = catalogService.getCatalog();

            // Preprocess: normalize abbreviations, synonyms, filler words
            String processedQuery = preprocessor.preprocess(queryText);
            log.debug("Query preprocessed: '{}' -> '{}'", queryText, processedQuery);

            // ── Vector pattern shortcut: check if a very similar query was already resolved ──
            NlpQueryResponse vectorShortcut = tryVectorPatternMatch(processedQuery);
            NlpQueryResponse response;
            if (vectorShortcut != null) {
                response = vectorShortcut;
                log.info("NLP query resolved via vector pattern match for '{}'", queryText);
            } else {
                // Process through strategy chain (use preprocessed query)
                response = engine.process(processedQuery, catalog);
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("NLP query processed in {}ms: '{}' -> intent={} confidence={} resolvedBy={}",
                    elapsed, queryText, response.intent(), response.confidence(), response.resolvedBy());

            // Log query synchronously and attach log ID to response
            Long logId = saveQueryLog(userId, queryText, response, (int) elapsed);
            return response.withLogId(logId);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("NLP query FAILED in {}ms for '{}': {}", elapsed, queryText, e.getMessage(), e);
            return NlpQueryResponse.fallback(
                    "Sorry, something went wrong processing your query. The error has been logged. Please try again or rephrase your question.");
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

                return new NlpQueryResponse(
                        best.intent(),
                        best.confidence() * best.similarity(), // Combine original confidence with similarity
                        "VECTOR_PATTERN",
                        new NlpQueryResponse.NlpResponsePayload(
                                null, best.route(), null,
                                best.entityName() != null ? Map.of("entityName", best.entityName()) : null,
                                null),
                        List.of(),
                        null
                );
            }
        } catch (Exception e) {
            log.debug("Vector pattern search failed (non-critical): {}", e.getMessage());
        }
        return null;
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
