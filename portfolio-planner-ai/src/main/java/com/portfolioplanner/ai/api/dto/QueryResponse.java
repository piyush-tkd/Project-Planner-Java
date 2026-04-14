package com.portfolioplanner.ai.api.dto;

import java.util.List;

/**
 * AI Hub response returned to the frontend (via main app proxy).
 *
 * @param answer      The synthesised natural-language answer from Ollama
 * @param sources     Chunks used to ground the answer (for the "Sources" panel)
 * @param sessionId   Session ID for follow-up queries
 * @param grounded    True if answer was backed by retrieved data; false if fallback/error
 */
public record QueryResponse(
        String answer,
        List<SourceReference> sources,
        String sessionId,
        boolean grounded
) {}
