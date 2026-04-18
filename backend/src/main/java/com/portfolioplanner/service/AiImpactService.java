package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AiImpactMetric;
import com.portfolioplanner.domain.repository.AiImpactMetricRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiImpactService {

    private final AiImpactMetricRepository repo;

    // ── Summary KPIs ──────────────────────────────────────────────────────────

    public Map<String, Object> getSummary() {
        List<AiImpactMetric> allMetrics = repo.findAll();

        double avgAiPrRatio       = avgLatest(allMetrics, "ai_pr_ratio");
        double velocityLift       = avgLatest(allMetrics, "velocity_delta");
        double costSavingsPct     = avgLatest(allMetrics, "cost_per_point");
        double reviewCycleReduction = avgLatest(allMetrics, "review_cycle_days");

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("avgAiPrRatio",           round2(avgAiPrRatio));
        m.put("velocityLift",           round2(velocityLift));
        m.put("costSavingsPct",         round2(costSavingsPct));
        m.put("reviewCycleReduction",   round2(reviewCycleReduction));
        return m;
    }

    // ── Trend data ─────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getTrend(String type) {
        List<AiImpactMetric> metrics = repo.findByMetricTypeOrderByPeriodAsc(type);

        // Group by period, then by podName
        Map<String, Map<String, BigDecimal>> byPeriod = new LinkedHashMap<>();
        for (AiImpactMetric m : metrics) {
            byPeriod.computeIfAbsent(m.getPeriod(), k -> new LinkedHashMap<>())
                    .put(m.getPodName(), m.getValue());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Map<String, BigDecimal>> entry : byPeriod.entrySet()) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", entry.getKey());
            point.putAll(entry.getValue().entrySet().stream()
                    .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue())));
            result.add(point);
        }
        return result;
    }

    // ── Pod names ─────────────────────────────────────────────────────────────

    public List<String> getPodNames() {
        return repo.findDistinctPodNames();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double avgLatest(List<AiImpactMetric> all, String type) {
        List<AiImpactMetric> filtered = all.stream()
                .filter(m -> type.equals(m.getMetricType()))
                .collect(Collectors.toList());
        if (filtered.isEmpty()) return 0.0;
        // Get the latest period's average
        String latestPeriod = filtered.stream().map(AiImpactMetric::getPeriod).max(Comparator.naturalOrder()).orElse("");
        return filtered.stream()
                .filter(m -> latestPeriod.equals(m.getPeriod()))
                .mapToDouble(m -> m.getValue() != null ? m.getValue().doubleValue() : 0.0)
                .average().orElse(0.0);
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
