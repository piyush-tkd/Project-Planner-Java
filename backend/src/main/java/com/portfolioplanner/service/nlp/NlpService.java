package com.portfolioplanner.service.nlp;

import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.NlpQueryLogRepository;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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

            // Process through strategy chain (use preprocessed query)
            NlpQueryResponse response = engine.process(processedQuery, catalog);

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
