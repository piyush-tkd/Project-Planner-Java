package com.portfolioplanner.dto.response;

import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;

public record ResourceResponse(
        Long id,
        String name,
        Role role,
        Location location,
        Boolean active,
        Boolean countsInCapacity,
        PodAssignment podAssignment
) {
    public record PodAssignment(
            Long podId,
            String podName,
            BigDecimal capacityFte
    ) {
    }
}
