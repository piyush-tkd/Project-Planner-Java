package com.portfolioplanner.ai.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.util.*;

/**
 * LLM Gateway — single place where all model HTTP calls are made.
 *
 * <p>Supports three providers:
 * <ul>
 *   <li>OLLAMA   — local Ollama instance (URL from application.yml)</li>
 *   <li>ANTHROPIC — Anthropic Messages API (key passed per-request)</li>
 *   <li>OPENAI    — OpenAI Chat Completions API (key passed per-request)</li>
 * </ul>
 *
 * <p>API keys are never stored here — they are passed in on each request
 * and discarded after use.
 */
@Service
@Slf4j
public class LlmGatewayService {

    private static final int DEFAULT_MAX_TOKENS = 1024;
    private static final int OLLAMA_CONNECT_TIMEOUT_MS = 3_000;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${spring.ai.ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Route a chat request to the appropriate provider and return the raw model output.
     */
    public LlmChatResponse chat(LlmChatRequest req) {
        long start = System.currentTimeMillis();
        int maxTokens = req.maxTokens() != null ? req.maxTokens() : DEFAULT_MAX_TOKENS;

        String content = switch (provider(req.provider())) {
            case "OLLAMA"    -> callOllama(req.model(), req.systemPrompt(), req.userMessage(),
                                           maxTokens, req.format(), req.maxTokens());
            case "ANTHROPIC" -> callAnthropic(req.model(), req.apiKey(),
                                              req.systemPrompt(), req.userMessage(), maxTokens);
            case "OPENAI"    -> callOpenAI(req.model(), req.apiKey(),
                                           req.systemPrompt(), req.userMessage(), maxTokens);
            default -> {
                log.warn("LlmGateway: unknown provider '{}', returning null", req.provider());
                yield null;
            }
        };

        long latency = System.currentTimeMillis() - start;
        log.debug("LlmGateway: provider={} model={} latency={}ms content={}chars",
                req.provider(), req.model(), latency,
                content != null ? content.length() : 0);

        return new LlmChatResponse(content, latency);
    }

    /**
     * Health check: returns true when Ollama's /api/tags endpoint is reachable.
     */
    public boolean isOllamaHealthy() {
        try {
            RestTemplate rt = buildRestTemplate(OLLAMA_CONNECT_TIMEOUT_MS, OLLAMA_CONNECT_TIMEOUT_MS);
            ResponseEntity<String> resp = rt.getForEntity(ollamaBaseUrl + "/api/tags", String.class);
            return resp.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.debug("Ollama health check failed: {}", e.getMessage());
            return false;
        }
    }

    // ── Providers ─────────────────────────────────────────────────────────────

    private String callOllama(String model, String systemPrompt, String userMessage,
                               int maxTokens, String format, Integer configuredMaxTokens) {
        try {
            Map<String, Object> options = new LinkedHashMap<>();
            options.put("temperature", 0.1);
            options.put("num_predict", maxTokens);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model != null ? model : "llama3:8b");
            body.put("prompt", userMessage);
            body.put("system", systemPrompt);
            body.put("stream", false);
            body.put("options", options);
            if ("json".equalsIgnoreCase(format)) {
                body.put("format", "json");
            }

            // Use a longer read timeout for Ollama (inference can be slow)
            int readTimeout = Math.max(10_000, configuredMaxTokens != null ? configuredMaxTokens : 10_000);
            RestTemplate rt = buildRestTemplate(OLLAMA_CONNECT_TIMEOUT_MS, readTimeout);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> resp = rt.postForEntity(ollamaBaseUrl + "/api/generate", entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("Ollama returned {}", resp.getStatusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("response").asText(null);
        } catch (Exception e) {
            log.warn("Ollama call failed: {}", e.getMessage());
            return null;
        }
    }

    private String callAnthropic(String model, String apiKey,
                                  String systemPrompt, String userMessage, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("LlmGateway: Anthropic call skipped — no API key");
            return null;
        }
        try {
            Map<String, Object> body = Map.of(
                    "model",      model != null ? model : "claude-haiku-4-5-20251001",
                    "max_tokens", maxTokens,
                    "system",     systemPrompt,
                    "messages",   List.of(Map.of("role", "user", "content", userMessage))
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", apiKey);
            headers.set("anthropic-version", "2023-06-01");

            RestTemplate rt = buildRestTemplate(5_000, 30_000);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> resp = rt.postForEntity(
                    "https://api.anthropic.com/v1/messages", entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("Anthropic API returned {}", resp.getStatusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("content").get(0).path("text").asText(null);
        } catch (Exception e) {
            log.warn("Anthropic call failed: {}", e.getMessage());
            return null;
        }
    }

    private String callOpenAI(String model, String apiKey,
                               String systemPrompt, String userMessage, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("LlmGateway: OpenAI call skipped — no API key");
            return null;
        }
        try {
            Map<String, Object> body = Map.of(
                    "model",      model != null ? model : "gpt-4o-mini",
                    "max_tokens", maxTokens,
                    "messages",   List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user",   "content", userMessage)
                    )
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            RestTemplate rt = buildRestTemplate(5_000, 30_000);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> resp = rt.postForEntity(
                    "https://api.openai.com/v1/chat/completions", entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("OpenAI API returned {}", resp.getStatusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("choices").get(0).path("message").path("content").asText(null);
        } catch (Exception e) {
            log.warn("OpenAI call failed: {}", e.getMessage());
            return null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String provider(String raw) {
        return raw != null ? raw.toUpperCase() : "OLLAMA";
    }

    private static RestTemplate buildRestTemplate(int connectMs, int readMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectMs);
        factory.setReadTimeout(readMs);
        RestTemplate rt = new RestTemplate();
        rt.setRequestFactory(factory);
        return rt;
    }
}
