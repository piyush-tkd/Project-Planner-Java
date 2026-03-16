package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

public record ProjectPodPlanningResponse(
        Long id,
        Long podId,
        String podName,
        String tshirtSize,
        BigDecimal complexityOverride,
        String effortPattern,
        Integer podStartMonth,
        Integer durationOverride
) {
}
