package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record CapacityGapResponse(
        List<PodMonthGap> gaps
) {
    public record PodMonthGap(
            Long podId,
            String podName,
            int monthIndex,
            String monthLabel,
            BigDecimal demandHours,
            BigDecimal capacityHours,
            BigDecimal gapHours,
            BigDecimal gapFte
    ) {
    }
}
