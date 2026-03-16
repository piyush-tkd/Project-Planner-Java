package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodMonthUtilization;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class UtilizationCalculator {

    /**
     * Computes utilization percentage per pod and month.
     * utilization% = (totalDemand / totalCapacity) * 100
     * Levels: GREEN (<80%), YELLOW (80-100%), RED (100-120%), CRITICAL (>120%)
     */
    public List<PodMonthUtilization> calculate(
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand,
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity,
            Map<Long, Pod> pods) {

        List<PodMonthUtilization> utilizations = new ArrayList<>();

        Set<Long> allPodIds = new HashSet<>();
        allPodIds.addAll(demand.keySet());
        allPodIds.addAll(capacity.keySet());

        for (Long podId : allPodIds) {
            Pod pod = pods.get(podId);
            String podName = pod != null ? pod.getName() : "Unknown";

            for (int m = 1; m <= 12; m++) {
                BigDecimal totalDemand = sumAcrossRoles(demand, podId, m);
                BigDecimal totalCapacity = sumAcrossRoles(capacity, podId, m);

                BigDecimal utilizationPct;
                if (totalCapacity.compareTo(BigDecimal.ZERO) == 0) {
                    utilizationPct = totalDemand.compareTo(BigDecimal.ZERO) > 0
                            ? BigDecimal.valueOf(999)
                            : BigDecimal.ZERO;
                } else {
                    utilizationPct = totalDemand
                            .multiply(BigDecimal.valueOf(100))
                            .divide(totalCapacity, 2, RoundingMode.HALF_UP);
                }

                String level = determineLevel(utilizationPct);
                utilizations.add(new PodMonthUtilization(podId, podName, m, utilizationPct, level));
            }
        }

        return utilizations;
    }

    private String determineLevel(BigDecimal pct) {
        if (pct.compareTo(BigDecimal.valueOf(120)) > 0) {
            return "CRITICAL";
        } else if (pct.compareTo(BigDecimal.valueOf(100)) >= 0) {
            return "RED";
        } else if (pct.compareTo(BigDecimal.valueOf(80)) >= 0) {
            return "YELLOW";
        } else {
            return "GREEN";
        }
    }

    private BigDecimal sumAcrossRoles(Map<Long, Map<Role, Map<Integer, BigDecimal>>> data, Long podId, int month) {
        Map<Role, Map<Integer, BigDecimal>> roleMap = data.get(podId);
        if (roleMap == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (Map<Integer, BigDecimal> monthMap : roleMap.values()) {
            sum = sum.add(monthMap.getOrDefault(month, BigDecimal.ZERO));
        }
        return sum;
    }
}
