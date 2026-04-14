package com.portfolioplanner.ai.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Incoming query from the AI Hub (proxied by main app → /api/ai/query).
 *
 * @param query      The user's natural-language question
 * @param sessionId  Optional session ID for conversation continuity (generated server-side if absent)
 */
public record QueryRequest(
        @NotBlank(message = "query must not be blank")
        @Size(max = 2000, message = "query must be 2000 characters or less")
        String query,

        String sessionId
) {}
