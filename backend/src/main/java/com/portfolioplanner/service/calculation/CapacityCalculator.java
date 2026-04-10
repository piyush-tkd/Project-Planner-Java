package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceAvailability;
import com.portfolioplanner.domain.model.ResourcePodAssignment;
import com.portfolioplanner.domain.model.TemporaryOverride;
import com.portfolioplanner.domain.model.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class CapacityCalculator {

    private static final BigDecimal DEFAULT_BAU_PCT = BigDecimal.valueOf(20);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /**
     * Computes available capacity per pod, role, and month.
     *
     * @param resources                  all active resources that count in capacity
     * @param assignmentMap              resource id -> pod assignment
     * @param availabilities             all resource availability records
     * @param overrides                  all temporary overrides (loans between pods)
     * @param bauByPodRole               podId -> role -> BAU percentage (0-100)
     * @param holidayDeductionByLocation location ("US"/"INDIA") -> monthIndex -> hours to deduct
     *                                   (8 hrs per holiday; pre-combined with "ALL" holidays)
     * @param leaveHoursByResource       resourceId -> monthIndex -> leave hours to deduct
     * @return nested map: podId -> role -> monthIndex -> hours
     */
    public Map<Long, Map<Role, Map<Integer, BigDecimal>>> calculate(
            List<Resource> resources,
            Map<Long, ResourcePodAssignment> assignmentMap,
            List<ResourceAvailability> availabilities,
            List<TemporaryOverride> overrides,
            Map<Long, Map<Role, BigDecimal>> bauByPodRole,
            Map<String, Map<Integer, BigDecimal>> holidayDeductionByLocation,
            Map<Long, Map<Integer, BigDecimal>> leaveHoursByResource) {

        Map<Long, Map<Role, Map<Integer, BigDecimal>>> capacity = new HashMap<>();

        // Build availability lookup: resourceId -> monthIndex -> hours
        Map<Long, Map<Integer, BigDecimal>> availMap = new HashMap<>();
        for (ResourceAvailability ra : availabilities) {
            availMap.computeIfAbsent(ra.getResource().getId(), k -> new HashMap<>())
                    .put(ra.getMonthIndex(), ra.getHours());
        }

        // Build override lookup: resourceId -> list of overrides
        Map<Long, List<TemporaryOverride>> overridesByResource = new HashMap<>();
        for (TemporaryOverride ov : overrides) {
            overridesByResource.computeIfAbsent(ov.getResource().getId(), k -> new java.util.ArrayList<>())
                    .add(ov);
        }

        for (Resource resource : resources) {
            if (!Boolean.TRUE.equals(resource.getActive()) || !Boolean.TRUE.equals(resource.getCountsInCapacity())) {
                continue;
            }

            Long resourceId = resource.getId();
            ResourcePodAssignment assignment = assignmentMap.get(resourceId);
            if (assignment == null) {
                continue;
            }

            Long homePodId = assignment.getPod().getId();
            BigDecimal fte = assignment.getCapacityFte() != null
                    ? assignment.getCapacityFte()
                    : BigDecimal.ONE;
            Role role = resource.getRole();

            BigDecimal homeBauPct = getBauPct(bauByPodRole, homePodId, role);

            Map<Integer, BigDecimal> resourceAvail = availMap.getOrDefault(resourceId, Map.of());

            if (resourceAvail.isEmpty()) {
                log.warn("CapacityCalculator: resource '{}' (id={}) has no availability records. " +
                         "Their capacity will be 0 for all months. " +
                         "Ensure the Availability sheet includes this person.",
                         resource.getName(), resourceId);
            }

            // Holiday deduction map for this resource's location
            String locationKey = resource.getLocation() != null ? resource.getLocation().name() : "";
            Map<Integer, BigDecimal> locationHolidayDeductions =
                holidayDeductionByLocation.getOrDefault(locationKey, Map.of());

            // Leave hours deduction map for this resource
            Map<Integer, BigDecimal> resourceLeaveDeductions =
                leaveHoursByResource.getOrDefault(resourceId, Map.of());

            for (int m = 1; m <= 12; m++) {
                BigDecimal availHours = resourceAvail.getOrDefault(m, BigDecimal.ZERO);
                if (availHours.compareTo(BigDecimal.ZERO) == 0) {
                    continue;
                }

                // Deduct public holiday hours (8 hrs per holiday) for this location/month
                BigDecimal holidayHours = locationHolidayDeductions.getOrDefault(m, BigDecimal.ZERO);
                if (holidayHours.compareTo(BigDecimal.ZERO) > 0) {
                    availHours = availHours.subtract(holidayHours).max(BigDecimal.ZERO);
                    log.trace("Holiday deduction for {} ({}): month {} → -{} hrs → {} hrs available",
                        resource.getName(), locationKey, m, holidayHours, availHours);
                }

                // Deduct planned/sick leave hours for this resource/month
                BigDecimal leaveHours = resourceLeaveDeductions.getOrDefault(m, BigDecimal.ZERO);
                if (leaveHours.compareTo(BigDecimal.ZERO) > 0) {
                    availHours = availHours.subtract(leaveHours).max(BigDecimal.ZERO);
                    log.trace("Leave deduction for {}: month {} → -{} hrs → {} hrs available",
                        resource.getName(), m, leaveHours, availHours);
                }

                BigDecimal baseCapacity = availHours
                        .multiply(fte)
                        .multiply(BigDecimal.ONE.subtract(homeBauPct.divide(HUNDRED, 10, RoundingMode.HALF_UP)));

                // Process temporary overrides (loans)
                // Match HTML app logic: loan raw hours × FTE × ovrPct, then apply
                // destination pod's BAU (not home pod's BAU) to the loaned portion.
                List<TemporaryOverride> resourceOverrides = overridesByResource.getOrDefault(resourceId, List.of());
                for (TemporaryOverride ov : resourceOverrides) {
                    if (m >= ov.getStartMonth() && m <= ov.getEndMonth()) {
                        BigDecimal loanPct = ov.getAllocationPct().divide(HUNDRED, 10, RoundingMode.HALF_UP);

                        // Raw loaned hours (before any BAU)
                        BigDecimal rawLoanHours = availHours.multiply(fte).multiply(loanPct);

                        // Deduct from home: remove the loan portion's home-BAU-adjusted value
                        BigDecimal homeDeduction = rawLoanHours
                                .multiply(BigDecimal.ONE.subtract(homeBauPct.divide(HUNDRED, 10, RoundingMode.HALF_UP)));
                        baseCapacity = baseCapacity.subtract(homeDeduction);

                        // Add to destination: apply destination pod's BAU to the loaned hours
                        Long destPodId = ov.getToPod().getId();
                        BigDecimal destBauPct = getBauPct(bauByPodRole, destPodId, role);
                        BigDecimal loanCapacity = rawLoanHours
                                .multiply(BigDecimal.ONE.subtract(destBauPct.divide(HUNDRED, 10, RoundingMode.HALF_UP)))
                                .setScale(2, RoundingMode.HALF_UP);

                        capacity.computeIfAbsent(destPodId, k -> new EnumMap<>(Role.class))
                                .computeIfAbsent(role, k -> new HashMap<>())
                                .merge(m, loanCapacity, BigDecimal::add);
                    }
                }

                baseCapacity = baseCapacity.setScale(2, RoundingMode.HALF_UP);

                capacity.computeIfAbsent(homePodId, k -> new EnumMap<>(Role.class))
                        .computeIfAbsent(role, k -> new HashMap<>())
                        .merge(m, baseCapacity, BigDecimal::add);
            }
        }

        return capacity;
    }

    private BigDecimal getBauPct(Map<Long, Map<Role, BigDecimal>> bauByPodRole, Long podId, Role role) {
        return bauByPodRole
                .getOrDefault(podId, Map.of())
                .getOrDefault(role, DEFAULT_BAU_PCT);
    }
}
