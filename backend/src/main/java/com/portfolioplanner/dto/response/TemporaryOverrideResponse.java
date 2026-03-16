package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

public record TemporaryOverrideResponse(
        Long id,
        Long resourceId,
        String resourceName,
        Long toPodId,
        String toPodName,
        Integer startMonth,
        Integer endMonth,
        BigDecimal allocationPct,
        String notes
) {
}
