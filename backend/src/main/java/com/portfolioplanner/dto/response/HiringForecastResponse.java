package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;
import java.util.List;

public record HiringForecastResponse(
        List<PodRoleMonthHire> hires
) {
    public record PodRoleMonthHire(
            Long podId,
            String podName,
            Role role,
            int monthIndex,
            String monthLabel,
            BigDecimal deficitHours,
            BigDecimal ftesNeeded
    ) {
    }
}
