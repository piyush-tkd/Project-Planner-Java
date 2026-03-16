package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.util.Map;

public record EffortPatternResponse(
        Long id,
        String name,
        String description,
        Map<String, BigDecimal> weights
) {
}
