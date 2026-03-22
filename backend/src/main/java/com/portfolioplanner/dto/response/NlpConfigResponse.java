package com.portfolioplanner.dto.response;

import java.util.List;
import java.util.Map;

public record NlpConfigResponse(
        List<String> strategyChain,
        double confidenceThreshold,
        String cloudProvider,
        String cloudModel,
        boolean cloudApiKeySet,
        String localModelUrl,
        String localModel,
        int localTimeoutMs,
        boolean cacheEnabled,
        int cacheTtlMinutes,
        boolean logQueries,
        int maxTimeoutMs,
        Map<String, StrategyStatus> strategyStatuses,
        String embeddingModel,
        boolean embeddingAvailable,
        int embeddingDimension,
        Map<String, Long> embeddingStats
) {
    public record StrategyStatus(
            boolean available,
            String message,
            Integer avgResponseMs
    ) {}
}
