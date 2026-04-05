package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.EffortPattern;
import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Computes demand hours per pod, role, and month from ProjectPodPlanning records.
 *
 * The new model uses explicit role hours (dev/qa/bsa/techLead) with a contingency
 * percentage rather than the old t-shirt size + complexity multiplier approach.
 * Hours are distributed across months using the assigned effort pattern.
 */
@Slf4j
@Component
public class DemandCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /**
     * @param plannings  all project-pod planning records
     * @param patterns   effort patterns keyed by name
     * @param pods       pod lookup by id
     * @param projects   project lookup by id
     * @return nested map: podId -> role -> monthIndex -> hours
     */
    public Map<Long, Map<Role, Map<Integer, BigDecimal>>> calculate(
            List<ProjectPodPlanning> plannings,
            Map<String, EffortPattern> patterns,
            Map<Long, Pod> pods,
            Map<Long, Project> projects) {

        Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = new HashMap<>();

        for (ProjectPodPlanning pp : plannings) {
            Project project = projects.get(pp.getProject().getId());
            if (project == null || "CANCELLED".equalsIgnoreCase(project.getStatus())) {
                continue;
            }

            // Only include statuses that contribute to demand
            if (project.getStatus() == null) continue;

            if (pp.getPod() == null) continue;
            Long podId = pp.getPod().getId();
            if (!pods.containsKey(podId)) continue;

            // Role hours with contingency applied to the total
            BigDecimal dev = orZero(pp.getDevHours());
            BigDecimal qa  = orZero(pp.getQaHours());
            BigDecimal bsa = orZero(pp.getBsaHours());
            BigDecimal tl  = orZero(pp.getTechLeadHours());
            BigDecimal contingencyFactor = BigDecimal.ONE.add(
                    orZero(pp.getContingencyPct()).divide(HUNDRED, 10, RoundingMode.HALF_UP));

            Map<Role, BigDecimal> roleHours = new EnumMap<>(Role.class);
            roleHours.put(Role.DEVELOPER,       dev.multiply(contingencyFactor).setScale(2, RoundingMode.HALF_UP));
            roleHours.put(Role.QA,        qa.multiply(contingencyFactor).setScale(2, RoundingMode.HALF_UP));
            roleHours.put(Role.BSA,       bsa.multiply(contingencyFactor).setScale(2, RoundingMode.HALF_UP));
            roleHours.put(Role.TECH_LEAD, tl.multiply(contingencyFactor).setScale(2, RoundingMode.HALF_UP));

            // Skip if no hours at all
            boolean hasHours = roleHours.values().stream()
                    .anyMatch(h -> h.compareTo(BigDecimal.ZERO) > 0);
            if (!hasHours) continue;

            // Effort pattern for distributing hours across months
            String patternName = pp.getEffortPattern() != null
                    ? pp.getEffortPattern()
                    : project.getDefaultPattern();

            EffortPattern pattern = patternName != null ? patterns.get(patternName) : null;
            if (pattern == null || pattern.getWeights() == null || pattern.getWeights().isEmpty()) {
                log.warn("DemandCalculator: no effort pattern '{}' for project '{}' / pod {}. Skipping.",
                        patternName, project.getName(), podId);
                continue;
            }

            int startM = pp.getPodStartMonth() != null
                    ? pp.getPodStartMonth()
                    : (project.getStartMonth() != null ? project.getStartMonth() : 1);

            int duration = pp.getDurationOverride() != null
                    ? pp.getDurationOverride()
                    : (project.getDurationMonths() != null ? project.getDurationMonths() : 1);

            int endM = Math.min(startM + duration - 1, 12);

            // Build month weight map
            BigDecimal weightSum = BigDecimal.ZERO;
            Map<Integer, BigDecimal> monthWeights = new HashMap<>();
            for (int m = startM; m <= endM; m++) {
                String key = "M" + (m - startM + 1);
                BigDecimal weight = pattern.getWeights().getOrDefault(key, BigDecimal.ZERO);
                monthWeights.put(m, weight);
                weightSum = weightSum.add(weight);
            }

            if (weightSum.compareTo(BigDecimal.ZERO) == 0) {
                log.warn("DemandCalculator: all pattern weights zero for project '{}' / pod {} M{}-M{}.",
                        project.getName(), podId, startM, endM);
                continue;
            }

            // Distribute each role's hours across months by pattern weight
            for (Map.Entry<Role, BigDecimal> entry : roleHours.entrySet()) {
                Role role = entry.getKey();
                BigDecimal totalRoleHours = entry.getValue();
                if (totalRoleHours.compareTo(BigDecimal.ZERO) == 0) continue;

                for (int m = startM; m <= endM; m++) {
                    BigDecimal weight = monthWeights.get(m);
                    if (weight == null || weight.compareTo(BigDecimal.ZERO) == 0) continue;

                    BigDecimal normalizedWeight = weight.divide(weightSum, 10, RoundingMode.HALF_UP);
                    BigDecimal monthDemand = totalRoleHours
                            .multiply(normalizedWeight)
                            .setScale(2, RoundingMode.HALF_UP);

                    demand.computeIfAbsent(podId, k -> new EnumMap<>(Role.class))
                            .computeIfAbsent(role, k -> new HashMap<>())
                            .merge(m, monthDemand, BigDecimal::add);
                }
            }
        }

        log.debug("Demand calculated: {} pod entries", demand.size());
        return demand;
    }

    private static BigDecimal orZero(BigDecimal val) {
        return val != null ? val : BigDecimal.ZERO;
    }
}
