package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.EffortPattern;
import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.enums.ProjectStatus;
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
public class DemandCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /**
     * Computes demand hours per pod, role, and month.
     *
     * @param plannings   all project-pod planning records
     * @param patterns    effort patterns keyed by name
     * @param roleMix     role -> percentage of total effort allocated to that role
     * @param pods        pod lookup by id
     * @param projects    project lookup by id
     * @return nested map: podId -> role -> monthIndex -> hours
     */
    public Map<Long, Map<Role, Map<Integer, BigDecimal>>> calculate(
            List<ProjectPodPlanning> plannings,
            Map<String, EffortPattern> patterns,
            Map<Role, BigDecimal> roleMix,
            Map<Long, Pod> pods,
            Map<Long, Project> projects,
            Map<String, Integer> tshirtSizeMap) {

        Map<Long, Map<Role, Map<Integer, BigDecimal>>> demand = new HashMap<>();

        for (ProjectPodPlanning pp : plannings) {
            Project project = projects.get(pp.getProject().getId());
            if (project == null || project.getStatus() != ProjectStatus.ACTIVE) {
                continue;
            }

            String sizeName = pp.getTshirtSize();
            if (sizeName == null || !tshirtSizeMap.containsKey(sizeName)) {
                continue;
            }

            BigDecimal baseHours = BigDecimal.valueOf(tshirtSizeMap.get(sizeName));

            if (pp.getPod() == null) {
                continue;
            }
            Long podId = pp.getPod().getId();
            Pod pod = pods.get(podId);
            if (pod == null) {
                continue;
            }

            // Apply both pod-level and row-level complexity (multiplicative).
            // Previously, complexityOverride (always non-null, defaulting to 1.0) shadowed
            // podComplexityMultiplier entirely — so pod complexity was never applied.
            BigDecimal podComplexity = pod.getComplexityMultiplier() != null
                    ? pod.getComplexityMultiplier()
                    : BigDecimal.ONE;
            BigDecimal rowComplexity = pp.getComplexityOverride() != null
                    ? pp.getComplexityOverride()
                    : BigDecimal.ONE;
            BigDecimal complexity = podComplexity.multiply(rowComplexity);

            String patternName = pp.getEffortPattern() != null
                    ? pp.getEffortPattern()
                    : project.getDefaultPattern();

            EffortPattern pattern = patternName != null ? patterns.get(patternName) : null;
            if (pattern == null || pattern.getWeights() == null || pattern.getWeights().isEmpty()) {
                log.warn("DemandCalculator: no effort pattern '{}' found for project '{}' / pod {}. " +
                         "Demand for this row will be 0. Check Effort Patterns sheet.",
                         patternName, project.getName(), pp.getPod().getId());
                continue;
            }

            int startM = pp.getPodStartMonth() != null
                    ? pp.getPodStartMonth()
                    : (project.getStartMonth() != null ? project.getStartMonth() : 1);

            int duration = pp.getDurationOverride() != null
                    ? pp.getDurationOverride()
                    : (project.getDurationMonths() != null ? project.getDurationMonths() : 1);

            int endM = Math.min(startM + duration - 1, 12);

            // Collect active weights using relative position in pattern
            BigDecimal weightSum = BigDecimal.ZERO;
            Map<Integer, BigDecimal> monthWeights = new HashMap<>();
            for (int m = startM; m <= endM; m++) {
                int relativeIndex = m - startM + 1;
                String key = "M" + relativeIndex;
                BigDecimal weight = pattern.getWeights().getOrDefault(key, BigDecimal.ZERO);
                monthWeights.put(m, weight);
                weightSum = weightSum.add(weight);
            }

            if (weightSum.compareTo(BigDecimal.ZERO) == 0) {
                log.warn("DemandCalculator: all effort-pattern weights are zero for project '{}' / pod {} " +
                         "in its active period M{}-M{}. Demand will be 0. " +
                         "Pattern '{}' may have zero weights beyond its intended duration.",
                         project.getName(), pp.getPod().getId(), startM, endM, patternName);
                continue;
            }

            for (Role role : Role.values()) {
                BigDecimal mixPct = roleMix.getOrDefault(role, BigDecimal.ZERO);
                if (mixPct.compareTo(BigDecimal.ZERO) == 0) {
                    continue;
                }

                BigDecimal totalRoleHours = baseHours
                        .multiply(complexity)
                        .multiply(mixPct)
                        .divide(HUNDRED, 10, RoundingMode.HALF_UP);

                for (int m = startM; m <= endM; m++) {
                    BigDecimal weight = monthWeights.get(m);
                    if (weight == null) {
                        continue;
                    }
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
}
