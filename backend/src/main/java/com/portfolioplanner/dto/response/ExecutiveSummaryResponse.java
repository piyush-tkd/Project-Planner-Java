package com.portfolioplanner.dto.response;

import java.math.BigDecimal;

public record ExecutiveSummaryResponse(
        int totalResources,
        int activeProjects,
        int totalPods,
        BigDecimal overallUtilizationPct,
        int podMonthsInDeficit,
        String highestRiskPod,
        int projectsAtRisk,
        int recommendedHiresNext3Months
) {
}
