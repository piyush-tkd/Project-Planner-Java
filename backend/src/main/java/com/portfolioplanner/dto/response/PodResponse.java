package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

public record PodResponse(
        Long id,
        String name,
        BigDecimal complexityMultiplier,
        Integer displayOrder,
        Boolean active
) {
}
