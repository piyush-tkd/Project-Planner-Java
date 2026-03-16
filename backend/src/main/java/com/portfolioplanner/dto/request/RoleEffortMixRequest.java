package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record RoleEffortMixRequest(
        @NotBlank String role,
        @NotNull BigDecimal mixPct
) {}
