package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodRoleMonthHire;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class HiringForecastCalculator {

    private static final BigDecimal DEFAULT_WORKING_HOURS = BigDecimal.valueOf(160);

    /**
     * Computes org-wide incremental hiring needs per role per month.
     *
     * <p>Algorithm mirrors the HTML dashboard's computeHiring() logic:
     * <ol>
     *   <li>Aggregate demand and capacity across ALL pods per role per month (net org-wide gap —
     *       a surplus in one pod offsets a deficit in another).</li>
     *   <li>Apply cumulative incremental logic: once N FTEs are committed in month M,
     *       subsequent months only ask for the <em>additional</em> hires needed above N.
     *       This prevents double-counting the same hiring need across multiple months.</li>
     * </ol>
     *
     * @param demand           podId -> role -> monthIndex -> hours
     * @param capacity         podId -> role -> monthIndex -> hours
     * @param pods             pod lookup by id (unused in org-wide mode, kept for API compatibility)
     * @param workingHoursMap  monthIndex -> working hours per month
     * @return list of hiring forecast records (podName = "Org-Wide", podId = null)
     */
    public List<PodRoleMonthHire> calculate(
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand,
            Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity,
            Map<Long, Pod> pods,
            Map<Integer, BigDecimal> workingHoursMap) {

        List<PodRoleMonthHire> hires = new ArrayList<>();

        Set<Long> allPodIds = new HashSet<>();
        allPodIds.addAll(demand.keySet());
        allPodIds.addAll(capacity.keySet());

        // Step 1: Aggregate demand and capacity org-wide per role per month.
        // Surpluses in one pod offset deficits in another — only hire when the
        // organisation as a whole is short.
        Map<Role, Map<Integer, BigDecimal>> orgDemand = new EnumMap<>(Role.class);
        Map<Role, Map<Integer, BigDecimal>> orgCapacity = new EnumMap<>(Role.class);

        for (Role role : Role.values()) {
            Map<Integer, BigDecimal> demandByMonth = new HashMap<>();
            Map<Integer, BigDecimal> capByMonth = new HashMap<>();
            for (int m = 1; m <= 12; m++) {
                BigDecimal totalDemand = BigDecimal.ZERO;
                BigDecimal totalCapacity = BigDecimal.ZERO;
                for (Long podId : allPodIds) {
                    totalDemand = totalDemand.add(
                            demand.getOrDefault(podId, Map.of())
                                  .getOrDefault(role, Map.of())
                                  .getOrDefault(m, BigDecimal.ZERO));
                    totalCapacity = totalCapacity.add(
                            capacity.getOrDefault(podId, Map.of())
                                    .getOrDefault(role, Map.of())
                                    .getOrDefault(m, BigDecimal.ZERO));
                }
                demandByMonth.put(m, totalDemand);
                capByMonth.put(m, totalCapacity);
            }
            orgDemand.put(role, demandByMonth);
            orgCapacity.put(role, capByMonth);
        }

        // Step 2: Cumulative incremental logic.
        // cumHired[role] tracks total FTEs committed so far.  Each month we compute the
        // raw FTE need; if it exceeds what's already been committed, only the incremental
        // amount is added to the forecast (and accumulated for future months).
        Map<Role, BigDecimal> cumHired = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            cumHired.put(role, BigDecimal.ZERO);
        }

        for (int m = 1; m <= 12; m++) {
            BigDecimal workingHours = workingHoursMap.getOrDefault(m, DEFAULT_WORKING_HOURS);

            for (Role role : Role.values()) {
                BigDecimal demandHours = orgDemand.get(role).getOrDefault(m, BigDecimal.ZERO);
                BigDecimal capacityHours = orgCapacity.get(role).getOrDefault(m, BigDecimal.ZERO);
                BigDecimal netGap = capacityHours.subtract(demandHours); // negative = org is short

                if (netGap.compareTo(BigDecimal.ZERO) < 0
                        && workingHours.compareTo(BigDecimal.ZERO) > 0) {

                    BigDecimal rawFte = netGap.abs().divide(workingHours, 2, RoundingMode.HALF_UP);
                    BigDecimal incrementalFte = rawFte.subtract(cumHired.get(role))
                            .max(BigDecimal.ZERO)
                            .setScale(2, RoundingMode.HALF_UP);

                    if (incrementalFte.compareTo(BigDecimal.ZERO) > 0) {
                        cumHired.merge(role, incrementalFte, BigDecimal::add);
                        BigDecimal deficitHours = incrementalFte
                                .multiply(workingHours)
                                .setScale(2, RoundingMode.HALF_UP);
                        hires.add(new PodRoleMonthHire(null, "Org-Wide", role, m,
                                deficitHours, incrementalFte));
                    }
                }
            }
        }

        return hires;
    }
}
