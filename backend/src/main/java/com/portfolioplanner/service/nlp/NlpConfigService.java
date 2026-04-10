package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.model.NlpConfig;
import com.portfolioplanner.domain.repository.NlpConfigRepository;
import com.portfolioplanner.dto.request.NlpConfigRequest;
import com.portfolioplanner.dto.response.NlpConfigResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Manages NLP configuration (strategy chain, LLM settings, etc.)
 * and keeps the NlpStrategyEngine in sync.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NlpConfigService {

    private static final Logger log = LoggerFactory.getLogger(NlpConfigService.class);
    private final NlpConfigRepository configRepo;
    private final NlpStrategyEngine engine;
    private final LocalLlmStrategy localLlm;
    private final CloudLlmStrategy cloudLlm;
    private final EmbeddingService embeddingService;
    private final NlpVectorSearchService vectorSearchService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        loadAndApplyConfig();
    }

    /** Load config from DB and push into strategy engine + strategy implementations. */
    private void loadAndApplyConfig() {
        try {
            List<String> chain = getListValue("strategy_chain", List.of("DETERMINISTIC", "LOCAL_LLM", "RULE_BASED"));
            double threshold = getDoubleValue("confidence_threshold", 0.75);
            engine.configure(chain, threshold);

            localLlm.configure(
                    getStringValue("local_model_url", "http://localhost:11434"),
                    getStringValue("local_model", "llama3:8b"),
                    getIntValue("local_timeout_ms", 10000)
            );

            cloudLlm.configure(
                    getStringValue("cloud_provider", "ANTHROPIC"),
                    getStringValue("cloud_model", "claude-haiku-4-5-20251001"),
                    getStringValue("cloud_api_key", ""),
                    getIntValue("max_timeout_ms", 5000)
            );

            // Configure embedding service (uses same Ollama URL)
            embeddingService.configure(
                    getStringValue("local_model_url", "http://localhost:11434"),
                    getStringValue("embedding_model", "nomic-embed-text")
            );

            log.info("NLP config loaded: chain={}, threshold={}, embeddings={}",
                    chain, threshold, embeddingService.isAvailable() ? "available" : "not available");
        } catch (Exception e) {
            log.error("Failed to load NLP config, using defaults", e);
            engine.configure(List.of("DETERMINISTIC", "LOCAL_LLM", "RULE_BASED"), 0.75);
        }
    }

    public NlpConfigResponse getConfig() {
        Map<String, NlpConfigResponse.StrategyStatus> statuses = new LinkedHashMap<>();
        engine.getStrategyAvailability().forEach((name, avail) ->
                statuses.put(name, new NlpConfigResponse.StrategyStatus(avail,
                        avail ? "Connected" : "Not available", null)));

        return new NlpConfigResponse(
                getListValue("strategy_chain", List.of("DETERMINISTIC", "LOCAL_LLM", "RULE_BASED")),
                getDoubleValue("confidence_threshold", 0.75),
                getStringValue("cloud_provider", "ANTHROPIC"),
                getStringValue("cloud_model", "claude-haiku-4-5-20251001"),
                !getStringValue("cloud_api_key", "").isBlank(),
                getStringValue("local_model_url", "http://localhost:11434"),
                getStringValue("local_model", "llama3:8b"),
                getIntValue("local_timeout_ms", 10000),
                getBooleanValue("cache_enabled", true),
                getIntValue("cache_ttl_minutes", 5),
                getBooleanValue("log_queries", true),
                getIntValue("max_timeout_ms", 5000),
                statuses,
                embeddingService.getEmbeddingModel(),
                embeddingService.isAvailable(),
                embeddingService.getEmbeddingDimension(),
                vectorSearchService.getEmbeddingStats()
        );
    }

    @Transactional
    public NlpConfigResponse updateConfig(NlpConfigRequest request) {
        if (request.strategyChain() != null)
            setValue("strategy_chain", toJson(request.strategyChain()));
        if (request.confidenceThreshold() != null)
            setValue("confidence_threshold", String.valueOf(request.confidenceThreshold()));
        if (request.cloudProvider() != null)
            setValue("cloud_provider", request.cloudProvider());
        if (request.cloudModel() != null)
            setValue("cloud_model", request.cloudModel());
        if (request.cloudApiKey() != null)
            setValue("cloud_api_key", request.cloudApiKey());
        if (request.localModelUrl() != null)
            setValue("local_model_url", request.localModelUrl());
        if (request.localModel() != null)
            setValue("local_model", request.localModel());
        if (request.localTimeoutMs() != null)
            setValue("local_timeout_ms", String.valueOf(request.localTimeoutMs()));
        if (request.cacheEnabled() != null)
            setValue("cache_enabled", String.valueOf(request.cacheEnabled()));
        if (request.cacheTtlMinutes() != null)
            setValue("cache_ttl_minutes", String.valueOf(request.cacheTtlMinutes()));
        if (request.logQueries() != null)
            setValue("log_queries", String.valueOf(request.logQueries()));
        if (request.maxTimeoutMs() != null)
            setValue("max_timeout_ms", String.valueOf(request.maxTimeoutMs()));
        if (request.embeddingModel() != null)
            setValue("embedding_model", request.embeddingModel());

        // Re-apply config to engine
        loadAndApplyConfig();

        return getConfig();
    }

    // ── Org-level cloud AI getters (used by UserAiKeyService) ─────────────

    /** Returns the org-level cloud API key, or empty string if not set. */
    public String getOrgCloudApiKey() {
        return getStringValue("cloud_api_key", "");
    }

    /** Returns the org-level cloud provider (ANTHROPIC | OPENAI). */
    public String getOrgCloudProvider() {
        return getStringValue("cloud_provider", "ANTHROPIC");
    }

    /** Returns the org-level cloud model name. */
    public String getOrgCloudModel() {
        return getStringValue("cloud_model", "claude-haiku-4-5-20251001");
    }

    // ── Config value helpers ───────────────────────────────────────────────
    private String getStringValue(String key, String defaultValue) {
        return configRepo.findByConfigKey(key)
                .map(NlpConfig::getConfigValue)
                .orElse(defaultValue);
    }

    private int getIntValue(String key, int defaultValue) {
        try {
            return Integer.parseInt(getStringValue(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private double getDoubleValue(String key, double defaultValue) {
        try {
            return Double.parseDouble(getStringValue(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private boolean getBooleanValue(String key, boolean defaultValue) {
        return Boolean.parseBoolean(getStringValue(key, String.valueOf(defaultValue)));
    }

    private List<String> getListValue(String key, List<String> defaultValue) {
        String json = getStringValue(key, null);
        if (json == null) return defaultValue;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private void setValue(String key, String value) {
        NlpConfig config = configRepo.findByConfigKey(key)
                .orElseGet(() -> {
                    NlpConfig c = new NlpConfig();
                    c.setConfigKey(key);
                    return c;
                });
        config.setConfigValue(value);
        configRepo.save(config);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }
}
