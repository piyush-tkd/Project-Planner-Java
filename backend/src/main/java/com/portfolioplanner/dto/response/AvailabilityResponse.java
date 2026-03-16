package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.util.Map;

public record AvailabilityResponse(
        Long resourceId,
        String resourceName,
        BigDecimal capacityFte,
        Map<Integer, BigDecimal> months
) {
}
