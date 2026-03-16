package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ResourceAvailabilityRequest(
        @NotNull @Min(1) @Max(12) Integer monthIndex,
        @NotNull BigDecimal hours
) {
}
