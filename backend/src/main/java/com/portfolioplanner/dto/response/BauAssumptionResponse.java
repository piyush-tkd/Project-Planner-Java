package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;

public record BauAssumptionResponse(
        Long id,
        Long podId,
        String podName,
        Role role,
        BigDecimal bauPct
) {
}
