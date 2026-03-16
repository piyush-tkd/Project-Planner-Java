package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProjectPodPlanningRequest(
        @NotNull Long podId,
        String tshirtSize,
        BigDecimal complexityOverride,
        String effortPattern,
        Integer podStartMonth,
        Integer durationOverride
) {
}
