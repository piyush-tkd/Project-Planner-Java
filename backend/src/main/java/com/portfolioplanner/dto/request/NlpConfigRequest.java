package com.portfolioplanner.dto.request;

import java.util.List;

public record NlpConfigRequest(
        List<String> strategyChain,
        Double confidenceThreshold,
        String cloudProvider,
        String cloudModel,
        String cloudApiKey,
        String localModelUrl,
        String localModel,
        Integer localTimeoutMs,
        Boolean cacheEnabled,
        Integer cacheTtlMinutes,
        Boolean logQueries,
        Integer maxTimeoutMs,
        String embeddingModel
) {}
