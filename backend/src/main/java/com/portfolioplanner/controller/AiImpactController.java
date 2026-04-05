package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AiImpactMetric;
import com.portfolioplanner.domain.repository.AiImpactMetricRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Provides AI impact analytics for the Engineering Intelligence dashboard.
 * All data is served from the ai_impact_metric table (seeded by V88 migration).
 */
@RestController
@RequestMapping("/api/reports/ai-impact")
@RequiredArgsConstructor
public class AiImpactController {

    private final AiImpactMetricRepository repo;

    // ── GET /api/reports/ai-impact/summary ─────────────────────────────────────
    /**
     * Returns headline KPI cards:
     *  - avgAiPrRatio   (latest period, all pods)
     *  - velocityLift   (avg % improvement across pods)
     *  - costSavingsPct (avg % cost reduction)
     *  - reviewCycleReduction (avg days saved)
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary() {
        Map<String, Object> result = new LinkedHashMap<>();

        // Latest AI PR ratio across pods
        List<AiImpactMetric> ratios = repo.findByMetricTypeOrderByPeriodAsc("ai_pr_ratio");
        if (!ratios.isEmpty()) {
            String latestPeriod = ratios.stream().map(AiImpactMetric::getPeriod).max(String::compareTo).orElse("");
            double avg = ratios.stream()
                    .filter(m -> latestPeriod.equals(m.getPeriod()))
                    .mapToDouble(m -> m.getValue().doubleValue())
                    .average().orElse(0);
            result.put("avgAiPrRatioPct", Math.round(avg * 100));
        } else {
            result.put("avgAiPrRatioPct", 0);
        }

        // Velocity lift %
        List<AiImpactMetric> velocity = repo.findByMetricTypeOrderByPeriodAsc("velocity_delta");
        if (!velocity.isEmpty()) {
            double liftPct = velocity.stream()
                    .filter(m -> m.getBaselineValue() != null && m.getBaselineValue().doubleValue() > 0)
                    .mapToDouble(m -> (m.getValue().doubleValue() - m.getBaselineValue().doubleValue())
                            / m.getBaselineValue().doubleValue() * 100)
                    .average().orElse(0);
            result.put("velocityLiftPct", BigDecimal.valueOf(liftPct).setScale(1, RoundingMode.HALF_UP));
        } else {
            result.put("velocityLiftPct", 0);
        }

        // Cost savings %
        List<AiImpactMetric> costs = repo.findByMetricTypeOrderByPeriodAsc("cost_per_point");
        if (!costs.isEmpty()) {
            String latestPeriod = costs.stream().map(AiImpactMetric::getPeriod).max(String::compareTo).orElse("");
            double savingsPct = costs.stream()
                    .filter(m -> latestPeriod.equals(m.getPeriod())
                            && m.getBaselineValue() != null && m.getBaselineValue().doubleValue() > 0)
                    .mapToDouble(m -> (m.getBaselineValue().doubleValue() - m.getValue().doubleValue())
                            / m.getBaselineValue().doubleValue() * 100)
                    .average().orElse(0);
            result.put("costSavingsPct", BigDecimal.valueOf(savingsPct).setScale(1, RoundingMode.HALF_UP));
        } else {
            result.put("costSavingsPct", 0);
        }

        // Review cycle reduction (days saved vs baseline)
        List<AiImpactMetric> reviews = repo.findByMetricTypeOrderByPeriodAsc("review_cycle_days");
        if (!reviews.isEmpty()) {
            String latestPeriod = reviews.stream().map(AiImpactMetric::getPeriod).max(String::compareTo).orElse("");
            double daysSaved = reviews.stream()
                    .filter(m -> latestPeriod.equals(m.getPeriod())
                            && m.getBaselineValue() != null)
                    .mapToDouble(m -> m.getBaselineValue().doubleValue() - m.getValue().doubleValue())
                    .average().orElse(0);
            result.put("reviewCycleDaysSaved", BigDecimal.valueOf(daysSaved).setScale(1, RoundingMode.HALF_UP));
        } else {
            result.put("reviewCycleDaysSaved", 0);
        }

        return ResponseEntity.ok(result);
    }

    // ── GET /api/reports/ai-impact/trend?type=velocity_delta ──────────────────
    /**
     * Returns time-series data grouped by period, with one entry per pod.
     * Used for the trend line chart.
     */
    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> trend(
            @RequestParam(defaultValue = "velocity_delta") String type) {

        List<AiImpactMetric> rows = repo.findByMetricTypeOrderByPeriodAsc(type);
        List<String> periods = rows.stream().map(AiImpactMetric::getPeriod).distinct()
                .sorted().collect(Collectors.toList());
        List<String> pods    = rows.stream().map(AiImpactMetric::getPodName).distinct()
                .sorted().collect(Collectors.toList());

        // Index by period→pod
        Map<String, Map<String, AiImpactMetric>> index = new LinkedHashMap<>();
        for (AiImpactMetric m : rows) {
            index.computeIfAbsent(m.getPeriod(), k -> new LinkedHashMap<>()).put(m.getPodName(), m);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (String period : periods) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", period);
            Map<String, AiImpactMetric> byPod = index.getOrDefault(period, Map.of());
            for (String pod : pods) {
                AiImpactMetric m = byPod.get(pod);
                if (m != null) {
                    point.put(pod, m.getValue());
                    if (m.getBaselineValue() != null) {
                        point.put(pod + "_baseline", m.getBaselineValue());
                    }
                }
            }
            result.add(point);
        }
        return ResponseEntity.ok(result);
    }

    // ── GET /api/reports/ai-impact/pods ───────────────────────────────────────
    /** Returns distinct pod names that have data. */
    @GetMapping("/pods")
    public ResponseEntity<List<String>> pods() {
        return ResponseEntity.ok(repo.findDistinctPodNames());
    }
}
