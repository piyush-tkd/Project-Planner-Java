package com.portfolioplanner.ai.llm;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * LLM Gateway — routes model inference calls from the main app to
 * the appropriate backend (Ollama, Anthropic, or OpenAI).
 *
 * <p>This is an internal service endpoint — it is not intended for
 * direct browser/frontend consumption. The main app's proxy layer
 * handles all authentication; no auth is applied here.
 *
 * <p>Endpoints:
 * <pre>
 *   POST /ai/llm/chat    — single-turn chat with any configured provider
 *   GET  /ai/llm/status  — reports Ollama health and service version
 * </pre>
 */
@RestController
@RequestMapping("/ai/llm")
@RequiredArgsConstructor
public class LlmGatewayController {

    private final LlmGatewayService gatewayService;

    /**
     * Execute a single-turn chat with the requested provider.
     * Returns HTTP 200 with a null {@code content} field if the model
     * call fails gracefully (e.g. Ollama is down, bad API key).
     * Returns HTTP 400 if the request is missing required fields.
     */
    @PostMapping("/chat")
    public ResponseEntity<LlmChatResponse> chat(@RequestBody LlmChatRequest req) {
        if (req.provider() == null || req.userMessage() == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(gatewayService.chat(req));
    }

    /**
     * Status / health endpoint — includes Ollama reachability.
     * Used by the main app's {@code LocalLlmStrategy.isAvailable()} check.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        boolean ollamaUp = gatewayService.isOllamaHealthy();
        return ResponseEntity.ok(Map.of(
                "service",   "portfolio-planner-ai / llm-gateway",
                "version",   "1.0.0",
                "ollama",    ollamaUp ? "UP" : "DOWN",
                "available", ollamaUp
        ));
    }
}
