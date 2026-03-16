package com.portfolioplanner.service.calculation.dto;

import com.portfolioplanner.domain.model.enums.Role;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record CalculationSnapshot(
        Map<String, Map<String, Map<Integer, BigDecimal>>> demand,
        Map<String, Map<String, Map<Integer, BigDecimal>>> capacity,
        Map<Long, Map<Role, Map<Integer, BigDecimal>>> demandByPodId,
        Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacityByPodId,
        List<PodMonthGap> gaps,
        List<PodMonthUtilization> utilization,
        List<PodRoleMonthHire> hiringForecast,
        List<PodMonthConcurrency> concurrencyRisk,
        ExecutiveSummaryData executiveSummary,
        List<CapacityDemandMonth> capacityDemandSummary
) {

    public record PodMonthGap(
            Long podId,
            String podName,
            int monthIndex,
            BigDecimal demandHours,
            BigDecimal capacityHours,
            BigDecimal gapHours,
            BigDecimal gapFte
    ) {
    }

    public record PodMonthUtilization(
            Long podId,
            String podName,
            int monthIndex,
            BigDecimal utilizationPct,
            String level
    ) {
    }

    public record PodRoleMonthHire(
            Long podId,
            String podName,
            Role role,
            int monthIndex,
            BigDecimal deficitHours,
            BigDecimal ftesNeeded
    ) {
    }

    public record PodMonthConcurrency(
            Long podId,
            String podName,
            int monthIndex,
            int activeProjectCount,
            String riskLevel
    ) {
    }

    public record ExecutiveSummaryData(
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

    public record CapacityDemandMonth(
            int monthIndex,
            BigDecimal totalDemandHours,
            BigDecimal totalCapacityHours,
            BigDecimal netGapHours,
            BigDecimal utilizationPct
    ) {
    }
}
