package com.portfolioplanner.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.Map;

/**
 * Transparent proxy: forwards all /api/ai/** requests to the AI microservice
 * running on port 8081. The frontend never knows a second service exists.
 *
 * If the AI service is unreachable (Ollama not running, service not started),
 * returns a graceful 503 rather than letting the error bubble to the user.
 */
@RestController
@RequestMapping("/api/ai")
@PreAuthorize("isAuthenticated()")
@Slf4j
public class AiProxyController {

    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8081}")
    private String aiServiceUrl;

    public AiProxyController() {
        this.restTemplate = new RestTemplate();
    }

    // ── POST /api/ai/query → POST http://localhost:8081/ai/query
    @PostMapping("/query")
    public ResponseEntity<?> proxyQuery(
            @RequestBody String body,
            HttpServletRequest request) {
        return forward(HttpMethod.POST, "/ai/query", body, request);
    }

    // ── POST /api/ai/feedback → POST http://localhost:8081/ai/feedback
    @PostMapping("/feedback")
    public ResponseEntity<?> proxyFeedback(
            @RequestBody String body,
            HttpServletRequest request) {
        return forward(HttpMethod.POST, "/ai/feedback", body, request);
    }

    // ── GET /api/ai/status → GET http://localhost:8081/ai/status
    @GetMapping("/status")
    public ResponseEntity<?> proxyStatus(HttpServletRequest request) {
        return forward(HttpMethod.GET, "/ai/status", null, request);
    }

    // ── Generic forwarder
    private ResponseEntity<?> forward(HttpMethod method, String path,
                                       String body, HttpServletRequest request) {
        try {
            String targetUrl = aiServiceUrl + path;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    URI.create(targetUrl), method, entity, String.class);

            // Pass the response through unchanged (status, body, content-type)
            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.getBody());

        } catch (ResourceAccessException e) {
            // AI service or Ollama not running
            log.warn("AI service unreachable at {}: {}", aiServiceUrl, e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "answer", "The AI service is currently offline. " +
                                      "Please ensure Ollama is running (`ollama serve`) " +
                                      "and the portfolio-planner-ai service is started.",
                            "grounded", false,
                            "sources", java.util.List.of()
                    ));
        } catch (Exception e) {
            log.error("AI proxy error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "AI proxy error: " + e.getMessage()));
        }
    }
}
