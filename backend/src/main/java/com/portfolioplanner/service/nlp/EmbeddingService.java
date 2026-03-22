package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Generates vector embeddings using Ollama's /api/embeddings endpoint.
 * Uses nomic-embed-text (768d) or mxbai-embed-large (1024d) model.
 * Falls back gracefully if Ollama is unavailable.
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String ollamaUrl = "http://localhost:11434";
    private String embeddingModel = "nomic-embed-text";
    private int embeddingDimension = 768;
    private volatile boolean available = false;

    /**
     * Configure the Ollama URL and embedding model.
     * Called by NlpConfigService when config loads.
     */
    public void configure(String ollamaUrl, String embeddingModel) {
        if (ollamaUrl != null && !ollamaUrl.isBlank()) {
            this.ollamaUrl = ollamaUrl;
        }
        if (embeddingModel != null && !embeddingModel.isBlank()) {
            this.embeddingModel = embeddingModel;
            // Auto-detect dimension based on known models
            this.embeddingDimension = switch (embeddingModel) {
                case "nomic-embed-text" -> 768;
                case "mxbai-embed-large" -> 1024;
                case "all-minilm" -> 384;
                default -> 768;
            };
        }
        checkAvailability();
    }

    /**
     * Generate an embedding vector for the given text.
     * Returns null if Ollama is unavailable or the call fails.
     */
    public float[] embed(String text) {
        if (text == null || text.isBlank()) return null;

        try {
            RestTemplate rt = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String payload = objectMapper.writeValueAsString(Map.of(
                    "model", embeddingModel,
                    "prompt", text
            ));

            HttpEntity<String> entity = new HttpEntity<>(payload, headers);
            ResponseEntity<String> resp = rt.postForEntity(
                    ollamaUrl + "/api/embeddings", entity, String.class);

            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                log.warn("Embedding request failed: {}", resp.getStatusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(resp.getBody());
            JsonNode embeddingNode = root.path("embedding");

            if (!embeddingNode.isArray() || embeddingNode.isEmpty()) {
                log.warn("No embedding returned from Ollama");
                return null;
            }

            float[] vector = new float[embeddingNode.size()];
            for (int i = 0; i < embeddingNode.size(); i++) {
                vector[i] = (float) embeddingNode.get(i).asDouble();
            }

            // Update dimension if it differs from expected
            if (vector.length != embeddingDimension) {
                embeddingDimension = vector.length;
                log.info("Embedding dimension updated to {} for model {}", embeddingDimension, embeddingModel);
            }

            available = true;
            return vector;

        } catch (Exception e) {
            log.warn("Embedding generation failed: {}", e.getMessage());
            available = false;
            return null;
        }
    }

    /**
     * Generate embeddings for multiple texts in sequence.
     * (Ollama doesn't support batch embedding natively.)
     */
    public List<float[]> embedBatch(List<String> texts) {
        return texts.stream()
                .map(this::embed)
                .toList();
    }

    /**
     * Convert a float[] vector to the pgvector string format: [0.1,0.2,0.3,...]
     */
    public static String toPgVector(float[] vector) {
        if (vector == null) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(vector[i]);
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Parse a pgvector string back to float[].
     */
    public static float[] fromPgVector(String pgVector) {
        if (pgVector == null || pgVector.isBlank()) return null;
        String cleaned = pgVector.replaceAll("[\\[\\]]", "");
        String[] parts = cleaned.split(",");
        float[] vector = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            vector[i] = Float.parseFloat(parts[i].trim());
        }
        return vector;
    }

    /**
     * Check if the embedding model is available on Ollama.
     */
    public boolean checkAvailability() {
        try {
            RestTemplate rt = new RestTemplate();
            ResponseEntity<String> resp = rt.getForEntity(ollamaUrl + "/api/tags", String.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                // Check if our embedding model is in the list
                available = resp.getBody().contains(embeddingModel);
                if (!available) {
                    log.info("Embedding model '{}' not found on Ollama. Pull it with: ollama pull {}",
                            embeddingModel, embeddingModel);
                }
                return available;
            }
        } catch (Exception e) {
            log.debug("Ollama not reachable for embeddings: {}", e.getMessage());
        }
        available = false;
        return false;
    }

    public boolean isAvailable() {
        return available;
    }

    public int getEmbeddingDimension() {
        return embeddingDimension;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }
}
