package com.portfolioplanner.ai.llm;

/**
 * Response from the LLM gateway.
 *
 * @param content    raw text content returned by the model
 * @param latencyMs  wall-clock time of the model call in milliseconds
 */
public record LlmChatResponse(
        String content,
        long   latencyMs
) {}
