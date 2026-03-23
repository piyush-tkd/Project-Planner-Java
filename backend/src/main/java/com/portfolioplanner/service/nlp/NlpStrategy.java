package com.portfolioplanner.service.nlp;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;

/**
 * Interface for all NLP processing strategies.
 * Implementations are tried in configured chain order until one
 * returns a result with confidence >= threshold.
 */
public interface NlpStrategy {

    /** Strategy identifier: RULE_BASED, LOCAL_LLM, CLOUD_LLM */
    String name();

    /** Health check — is this strategy available right now? */
    boolean isAvailable();

    /** Classify intent and extract entities from a user query. */
    NlpResult classify(String query, NlpCatalogResponse catalog);

    /** Result of a classification attempt. */
    record NlpResult(
            String intent,
            double confidence,
            String message,
            String route,
            java.util.Map<String, Object> formData,
            java.util.Map<String, Object> data,
            String drillDown,
            java.util.List<String> suggestions,
            String shape
    ) {
        public NlpQueryResponse toResponse(String resolvedBy) {
            return new NlpQueryResponse(
                    intent, confidence, resolvedBy,
                    new NlpQueryResponse.NlpResponsePayload(message, route, formData, data, drillDown, shape),
                    suggestions != null ? suggestions : java.util.List.of(),
                    null, null
            );
        }
    }
}
