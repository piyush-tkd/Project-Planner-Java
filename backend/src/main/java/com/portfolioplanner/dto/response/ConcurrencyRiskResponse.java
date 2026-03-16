package com.portfolioplanner.dto.response;

import java.util.List;

public record ConcurrencyRiskResponse(
        List<PodMonthConcurrency> risks
) {
    public record PodMonthConcurrency(
            Long podId,
            String podName,
            int monthIndex,
            String monthLabel,
            int activeProjectCount,
            String riskLevel
    ) {
    }
}
