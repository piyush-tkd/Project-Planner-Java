package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;
import java.util.List;

public record ResourceAllocationResponse(
        List<ResourceMonthAllocation> allocations
) {
    public record ResourceMonthAllocation(
            Long resourceId,
            String resourceName,
            Role role,
            String podName,
            int monthIndex,
            BigDecimal allocatedHours,
            BigDecimal availableHours,
            BigDecimal utilizationPct
    ) {
    }
}
