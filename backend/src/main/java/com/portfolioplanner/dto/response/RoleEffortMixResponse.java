package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;

public record RoleEffortMixResponse(
        Role role,
        BigDecimal mixPct
) {
}
