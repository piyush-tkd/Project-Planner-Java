package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodMonthGap;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class GapAnalyzer {

    private static final BigDecimal DEFAULT_WORKING_HOURS = BigDecimal.valueOf(160);

    /**
     * Computes gap (capacity - demand) per pod and month, aggregated across all roles.
     *
     * @param demand           podId -> role -> monthIndex -> hours
     * @param capacity         podId -> role -> monthIndex -> hours
     * @param pods             pod lookup by id
     * @param workingHoursMap  monthIndex -> working hours per month (for FTE conversion)
     * @return list of gap records per pod per month
     */
    public List<PodMonthGap> analyze(
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand,
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity,
            Map<Long, Pod> pods,
            Map<Integer, BigDecimal> workingHoursMap) {

        List<PodMonthGap> gaps = new ArrayList<>();

        Set<Long> allPodIds = new HashSet<>();
        allPodIds.addAll(demand.keySet());
        allPodIds.addAll(capacity.keySet());

        for (Long podId : allPodIds) {
            Pod pod = pods.get(podId);
            String podName = pod != null ? pod.getName() : "Unknown";

            for (int m = 1; m <= 12; m++) {
                BigDecimal totalDemand = sumAcrossRoles(demand, podId, m);
                BigDecimal totalCapacity = sumAcrossRoles(capacity, podId, m);
                BigDecimal gapHours = totalCapacity.subtract(totalDemand)
                        .setScale(2, RoundingMode.HALF_UP);

                BigDecimal workingHours = workingHoursMap.getOrDefault(m, DEFAULT_WORKING_HOURS);
                BigDecimal gapFte = workingHours.compareTo(BigDecimal.ZERO) > 0
                        ? gapHours.divide(workingHours, 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;

                gaps.add(new PodMonthGap(podId, podName, m, totalDemand, totalCapacity, gapHours, gapFte));
            }
        }

        return gaps;
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
