package com.portfolioplanner.ai.llm;

/**
 * Request body for the LLM gateway endpoint.
 *
 * <p>The caller (main app) is responsible for supplying all parameters.
 * API keys are passed per-request — this service never stores them.
 *
 * @param provider    OLLAMA | ANTHROPIC | OPENAI
 * @param model       model name (e.g. "llama3:8b", "claude-haiku-4-5-20251001")
 * @param apiKey      required for ANTHROPIC/OPENAI; ignored for OLLAMA
 * @param systemPrompt system/context prompt
 * @param userMessage  user turn
 * @param maxTokens   max tokens in response (defaults to 1024 if null)
 * @param format      optional output format hint — pass "json" to request JSON output from Ollama
 */
public record LlmChatRequest(
        String  provider,
        String  model,
        String  apiKey,
        String  systemPrompt,
        String  userMessage,
        Integer maxTokens,
        String  format
) {}
