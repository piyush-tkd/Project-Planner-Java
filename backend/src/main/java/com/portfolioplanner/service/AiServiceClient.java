package com.portfolioplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * HTTP client for the portfolio-planner-ai microservice.
 *
 * <p>All AI inference (Ollama, Anthropic, OpenAI) is delegated to the
 * AI service — the main app holds credentials and business logic but
 * never calls model APIs directly.
 *
 * <p>Endpoints used:
 * <pre>
 *   POST {ai.service.url}/ai/llm/chat    — single-turn chat
 *   GET  {ai.service.url}/ai/llm/status  — Ollama health check
 * </pre>
 */
@Component
@Slf4j
public class AiServiceClient {

    private static final int CONNECT_TIMEOUT_MS = 3_000;
    private static final int READ_TIMEOUT_MS    = 60_000; // generous: Ollama can be slow

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.service.url:http://localhost:8081}")
    private String aiServiceUrl;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Execute a single-turn chat with the given provider.
     *
     * @param provider    OLLAMA | ANTHROPIC | OPENAI
     * @param model       model name
     * @param apiKey      required for cloud providers; null/blank for OLLAMA
     * @param systemPrompt system/context prompt
     * @param userMessage  user turn
     * @param maxTokens   max tokens in the response
     * @param format      optional format hint ("json" for Ollama JSON mode)
     * @return raw content string, or {@code null} if the AI service is unreachable
     *         or the model call fails
     */
    public String chat(String provider, String model, String apiKey,
                       String systemPrompt, String userMessage,
                       int maxTokens, String format) {
        try {
            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("provider",     provider);
            body.put("model",        model);
            body.put("apiKey",       apiKey);
            body.put("systemPrompt", systemPrompt);
            body.put("userMessage",  userMessage);
            body.put("maxTokens",    maxTokens);
            body.put("format",       format);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);

            RestTemplate rt = buildRestTemplate();
            ResponseEntity<String> resp = rt.postForEntity(
                    aiServiceUrl + "/ai/llm/chat", entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("AiServiceClient: /ai/llm/chat returned {}", resp.getStatusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("content").asText(null);

        } catch (ResourceAccessException e) {
            log.warn("AiServiceClient: portfolio-planner-ai is unreachable ({})", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("AiServiceClient: chat call failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Returns {@code true} when portfolio-planner-ai reports Ollama as reachable.
     * Result is intentionally not cached here — callers (LocalLlmStrategy) handle
     * their own caching.
     */
    public boolean isOllamaHealthy() {
        try {
            RestTemplate rt = buildRestTemplate();
            ResponseEntity<String> resp = rt.getForEntity(
                    aiServiceUrl + "/ai/llm/status", String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return false;

            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("available").asBoolean(false);
        } catch (Exception e) {
            log.debug("AiServiceClient: Ollama health check failed: {}", e.getMessage());
            return false;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        RestTemplate rt = new RestTemplate();
        rt.setRequestFactory(factory);
        return rt;
    }
}
