package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record CapacityDemandSummaryResponse(
        List<MonthSummary> months
) {
    public record MonthSummary(
            int monthIndex,
            String monthLabel,
            BigDecimal totalDemandHours,
            BigDecimal totalCapacityHours,
            BigDecimal netGapHours,
            BigDecimal utilizationPct
    ) {
    }
}
