package com.portfolioplanner.service.nlp.handler;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.service.nlp.NlpStrategy;

/**
 * Handler for a specific category of NLP query patterns.
 * Extracted from the RuleBasedStrategy god class to improve maintainability.
 * Each handler owns a focused set of patterns and their resolution logic.
 */
public interface NlpPatternHandler {

    /** Human-readable handler name for logging/debug. */
    String name();

    /**
     * Try to match and handle the query.
     * @return NlpResult if matched, null if this handler doesn't handle the query
     */
    NlpStrategy.NlpResult tryHandle(String query, NlpCatalogResponse catalog);

    /** Order in which this handler should be tried (lower = earlier). */
    default int order() { return 100; }
}
