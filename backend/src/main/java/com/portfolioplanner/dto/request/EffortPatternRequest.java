package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.Map;

public record EffortPatternRequest(
        @NotBlank String name,
        String description,
        @NotNull Map<String, BigDecimal> weights
) {}
