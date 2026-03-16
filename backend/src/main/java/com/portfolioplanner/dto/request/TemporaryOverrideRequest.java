package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TemporaryOverrideRequest(
        @NotNull Long resourceId,
        @NotNull Long toPodId,
        @NotNull Integer startMonth,
        @NotNull Integer endMonth,
        @NotNull BigDecimal allocationPct,
        String notes
) {
}
