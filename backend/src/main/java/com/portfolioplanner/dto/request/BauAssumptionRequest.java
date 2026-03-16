package com.portfolioplanner.dto.request;

import com.portfolioplanner.domain.model.enums.Role;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record BauAssumptionRequest(
        @NotNull Long podId,
        @NotNull Role role,
        @NotNull BigDecimal bauPct
) {
}
