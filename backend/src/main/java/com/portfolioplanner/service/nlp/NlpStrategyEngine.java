package com.portfolioplanner.service.nlp;

import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Chain-of-responsibility engine that tries each configured NLP strategy
 * in order until one returns a result with confidence >= threshold.
 */
@Component
public class NlpStrategyEngine {

    private static final Logger log = LoggerFactory.getLogger(NlpStrategyEngine.class);

    private final Map<String, NlpStrategy> strategyMap;
    // IMPORTANT: RULE_BASED must come BEFORE LOCAL_LLM.
    // RULE_BASED is fast (~200ms, regex + keyword matching) and handles most queries.
    // LOCAL_LLM calls Ollama (10+ seconds) and should only be the last resort.
    private volatile List<String> chain = List.of("DETERMINISTIC", "RULE_BASED", "LOCAL_LLM");
    private volatile double confidenceThreshold = 0.75;

    public NlpStrategyEngine(DeterministicStrategy deterministic,
                              RuleBasedStrategy ruleBased,
                              LocalLlmStrategy localLlm,
                              CloudLlmStrategy cloudLlm) {
        this.strategyMap = new LinkedHashMap<>();
        strategyMap.put("DETERMINISTIC", deterministic);
        strategyMap.put("RULE_BASED", ruleBased);
        strategyMap.put("LOCAL_LLM", localLlm);
        strategyMap.put("CLOUD_LLM", cloudLlm);
    }

    /** Update the strategy chain and threshold from configuration. */
    public void configure(List<String> chain, double confidenceThreshold) {
        this.chain = chain != null ? List.copyOf(chain) : List.of("RULE_BASED");
        this.confidenceThreshold = confidenceThreshold;
        log.info("NLP strategy chain updated: {} (threshold: {})", this.chain, this.confidenceThreshold);
    }

    /** Process a query through the strategy chain. */
    public NlpQueryResponse process(String query, NlpCatalogResponse catalog) {
        long chainStart = System.currentTimeMillis();
        List<Map<String, Object>> tierTrace = new ArrayList<>();

        for (String strategyName : chain) {
            NlpStrategy strategy = strategyMap.get(strategyName);
            if (strategy == null) {
                log.warn("Unknown NLP strategy in chain: {}", strategyName);
                continue;
            }
            if (!strategy.isAvailable()) {
                log.debug("Strategy {} not available, skipping", strategyName);
                tierTrace.add(Map.of("tier", strategyName, "skipped", true, "reason", "unavailable"));
                continue;
            }

            long start = System.currentTimeMillis();
            NlpStrategy.NlpResult result = strategy.classify(query, catalog);
            long elapsed = System.currentTimeMillis() - start;
            log.debug("Strategy {} returned intent={} confidence={} in {}ms",
                    strategyName, result.intent(), result.confidence(), elapsed);

            tierTrace.add(Map.of(
                    "tier", strategyName,
                    "intent", result.intent() != null ? result.intent() : "null",
                    "confidence", result.confidence(),
                    "latencyMs", elapsed,
                    "resolved", result.confidence() >= confidenceThreshold
            ));

            if (result.confidence() >= confidenceThreshold) {
                long total = System.currentTimeMillis() - chainStart;
                Map<String, Object> debug = new LinkedHashMap<>();
                debug.put("resolvedBy", strategyName);
                debug.put("tierTrace", tierTrace);
                debug.put("totalLatencyMs", total);
                debug.put("thresholdUsed", confidenceThreshold);
                return result.toResponse(strategyName).withDebug(debug);
            }

            // If this was the last strategy in the chain, return whatever we got
            // (even low confidence) rather than a generic fallback
            if (strategyName.equals(chain.get(chain.size() - 1)) && result.confidence() > 0) {
                long total = System.currentTimeMillis() - chainStart;
                Map<String, Object> debug = new LinkedHashMap<>();
                debug.put("resolvedBy", strategyName + " (best-effort)");
                debug.put("tierTrace", tierTrace);
                debug.put("totalLatencyMs", total);
                debug.put("thresholdUsed", confidenceThreshold);
                return result.toResponse(strategyName).withDebug(debug);
            }
        }

        return NlpQueryResponse.fallback(
                "I'm not sure what you mean. Try rephrasing, or use one of the quick actions below.");
    }

    /** Get status of all strategies (for the settings page). */
    public Map<String, Boolean> getStrategyAvailability() {
        Map<String, Boolean> status = new LinkedHashMap<>();
        strategyMap.forEach((name, strategy) -> status.put(name, strategy.isAvailable()));
        return status;
    }

    public List<String> getChain() {
        return chain;
    }

    public double getConfidenceThreshold() {
        return confidenceThreshold;
    }
}
