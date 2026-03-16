package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record PodResourceSummaryResponse(
        List<PodSummary> pods
) {
    public record PodSummary(
            Long podId,
            String podName,
            int homeCount,
            BigDecimal homeFte,
            Map<String, Integer> homeCountByRole,
            Map<String, BigDecimal> homeFteByRole,
            List<MonthEffective> monthlyEffective
    ) {}

    public record MonthEffective(
            int monthIndex,
            String monthLabel,
            BigDecimal effectiveFte,
            Map<String, BigDecimal> effectiveByRole
    ) {}
}
