package com.portfolioplanner.service.calculation;

import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodMonthConcurrency;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class ConcurrencyRiskCalculator {

    /**
     * For each pod and month, counts how many active projects overlap.
     * Risk levels: LOW (1-2), MEDIUM (3-4), HIGH (5+)
     *
     * @param plannings all project-pod planning records
     * @param pods      pod lookup by id
     * @param projects  project lookup by id
     * @return list of concurrency risk records
     */
    public List<PodMonthConcurrency> calculate(
            List<ProjectPodPlanning> plannings,
            Map<Long, Pod> pods,
            Map<Long, Project> projects) {

        // podId -> monthIndex -> count of active projects
        Map<Long, Map<Integer, Integer>> podMonthCounts = new HashMap<>();

        for (ProjectPodPlanning pp : plannings) {
            Project project = projects.get(pp.getProject().getId());
            if (project == null || !"ACTIVE".equalsIgnoreCase(project.getStatus())) {
                continue;
            }

            Long podId = pp.getPod().getId();

            int startM = pp.getPodStartMonth() != null
                    ? pp.getPodStartMonth()
                    : (project.getStartMonth() != null ? project.getStartMonth() : 1);

            int duration = pp.getDurationOverride() != null
                    ? pp.getDurationOverride()
                    : (project.getDurationMonths() != null ? project.getDurationMonths() : 1);

            int endM = Math.min(startM + duration - 1, 12);

            for (int m = startM; m <= endM; m++) {
                podMonthCounts.computeIfAbsent(podId, k -> new HashMap<>())
                        .merge(m, 1, Integer::sum);
            }
        }

        List<PodMonthConcurrency> risks = new ArrayList<>();
        for (Map.Entry<Long, Map<Integer, Integer>> entry : podMonthCounts.entrySet()) {
            Long podId = entry.getKey();
            Pod pod = pods.get(podId);
            String podName = pod != null ? pod.getName() : "Unknown";

            for (int m = 1; m <= 12; m++) {
                int count = entry.getValue().getOrDefault(m, 0);
                String riskLevel = determineRisk(count);
                risks.add(new PodMonthConcurrency(podId, podName, m, count, riskLevel));
            }
        }

        return risks;
    }

    private String determineRisk(int count) {
        if (count >= 5) {
            return "HIGH";
        } else if (count >= 3) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }
}
