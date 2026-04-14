package com.portfolioplanner.service.nlp;

import com.portfolioplanner.dto.response.NlpQueryResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Fallback to the portfolio-planner-ai RAG microservice when the rule-based
 * NLP engine returns UNKNOWN or very low confidence.
 *
 * Call flow:
 *   NlpService → engine.process() → UNKNOWN
 *       → AiRagFallbackService.query()
 *       → POST http://localhost:8081/ai/query
 *       → NlpQueryResponse.text(answer, "RAG", ...)
 */
@Service
@Slf4j
public class AiRagFallbackService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai.service.url:http://localhost:8081}")
    private String aiServiceUrl;

    /** Confidence threshold below which we try RAG fallback. */
    public static final double RAG_FALLBACK_THRESHOLD = 0.35;

    /**
     * Attempts to answer the query via the RAG pipeline.
     * Returns null if the AI service is offline or the answer is not grounded.
     */
    public NlpQueryResponse query(String queryText) {
        try {
            // If the query has prepended conversation context, extract just the current question
            // so the vector similarity search gets a clean query, not a multi-sentence blob
            String actualQuery = queryText;
            int currentQuestionIdx = queryText.lastIndexOf("Current question:");
            if (currentQuestionIdx >= 0) {
                actualQuery = queryText.substring(currentQuestionIdx + "Current question:".length()).trim();
            }
            // Also strip "Previous conversation:..." if no "Current question:" marker
            int prevConvIdx = actualQuery.indexOf("Previous conversation:");
            if (prevConvIdx == 0) {
                // Entire string is context with no clear question — skip RAG
                log.debug("RAG fallback skipped — query is pure conversation context");
                return null;
            }

            String url = aiServiceUrl + "/ai/query";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(Map.of("query", queryText), headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class).getBody();

            if (body == null) return null;

            String answer  = (String) body.get("answer");
            boolean grounded = Boolean.TRUE.equals(body.get("grounded"));

            if (!grounded || answer == null || answer.isBlank()) {
                log.debug("RAG fallback returned ungrounded answer for '{}'", queryText);
                return null;
            }

            // Map sources to suggestion strings so the UI can show them
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sources = (List<Map<String, Object>>) body.getOrDefault("sources", List.of());
            List<String> suggestions = sources.stream()
                    .map(s -> (String) s.getOrDefault("projectName", ""))
                    .filter(n -> !n.isBlank())
                    .distinct()
                    .limit(4)
                    .toList();

            log.info("RAG fallback answered '{}' with {} source(s)", queryText, sources.size());
            return NlpQueryResponse.text(answer, "RAG", 0.80, suggestions);

        } catch (ResourceAccessException e) {
            // AI service not running — silent fallback, don't break the NLP flow
            log.debug("RAG fallback skipped (AI service offline): {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("RAG fallback error for '{}': {}", queryText, e.getMessage());
            return null;
        }
    }
}
