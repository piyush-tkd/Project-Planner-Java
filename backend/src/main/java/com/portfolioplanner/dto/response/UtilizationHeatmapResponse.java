package com.portfolioplanner.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record UtilizationHeatmapResponse(
        List<PodMonthUtilization> cells
) {
    public record PodMonthUtilization(
            Long podId,
            String podName,
            int monthIndex,
            String monthLabel,
            BigDecimal utilizationPct,
            String level
    ) {
    }
}
