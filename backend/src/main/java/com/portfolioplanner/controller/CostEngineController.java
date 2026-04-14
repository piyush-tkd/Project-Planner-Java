package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ProjectValueMetric;
import com.portfolioplanner.domain.model.ResourceCostRate;
import com.portfolioplanner.domain.repository.ProjectValueMetricRepository;
import com.portfolioplanner.domain.repository.ResourceCostRateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cost-engine")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CostEngineController {

    private final ResourceCostRateRepository costRateRepository;
    private final ProjectValueMetricRepository projectValueMetricRepository;

    // ── Resource Cost Rates ──────────────────────────────────────────────────

    @GetMapping("/rates")
    public List<ResourceCostRate> getAllRates() {
        return costRateRepository.findAll();
    }

    @GetMapping("/rates/resource/{resourceId}")
    public List<ResourceCostRate> getRatesByResource(@PathVariable Long resourceId) {
        return costRateRepository.findByResourceId(resourceId);
    }

    @PostMapping("/rates")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResourceCostRate createRate(@RequestBody ResourceCostRate rate) {
        return costRateRepository.save(rate);
    }

    @PutMapping("/rates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ResourceCostRate> updateRate(@PathVariable Long id,
                                                        @RequestBody ResourceCostRate updated) {
        return costRateRepository.findById(id)
            .map(existing -> {
                existing.setRateType(updated.getRateType());
                existing.setAmount(updated.getAmount());
                existing.setCurrency(updated.getCurrency());
                existing.setEffectiveFrom(updated.getEffectiveFrom());
                existing.setEffectiveTo(updated.getEffectiveTo());
                return ResponseEntity.ok(costRateRepository.save(existing));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/rates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> deleteRate(@PathVariable Long id) {
        if (!costRateRepository.existsById(id)) return ResponseEntity.notFound().build();
        costRateRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Project Value Metrics ───────────────────────────────────────────────

    @GetMapping("/metrics")
    public List<ProjectValueMetric> getAllMetrics() {
        return projectValueMetricRepository.findAll();
    }

    @GetMapping("/metrics/project/{projectId}")
    public List<ProjectValueMetric> getMetricsByProject(@PathVariable Long projectId) {
        return projectValueMetricRepository.findByProjectId(projectId);
    }

    @PostMapping("/metrics")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ProjectValueMetric createMetric(@RequestBody ProjectValueMetric metric) {
        return projectValueMetricRepository.save(metric);
    }

    @PutMapping("/metrics/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ProjectValueMetric> updateMetric(@PathVariable Long id,
                                                            @RequestBody ProjectValueMetric updated) {
        return projectValueMetricRepository.findById(id)
            .map(existing -> {
                existing.setMetricType(updated.getMetricType());
                existing.setProjectedValue(updated.getProjectedValue());
                existing.setActualValue(updated.getActualValue());
                existing.setCapexAmount(updated.getCapexAmount());
                existing.setOpexAmount(updated.getOpexAmount());
                existing.setMeasurementPeriod(updated.getMeasurementPeriod());
                existing.setNotes(updated.getNotes());
                return ResponseEntity.ok(projectValueMetricRepository.save(existing));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/metrics/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> deleteMetric(@PathVariable Long id) {
        if (!projectValueMetricRepository.existsById(id)) return ResponseEntity.notFound().build();
        projectValueMetricRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── ROI Summary ─────────────────────────────────────────────────────────

    @GetMapping("/roi-summary")
    public List<Map<String, Object>> getRoiSummary() {
        return projectValueMetricRepository.findAll().stream()
            .collect(Collectors.groupingBy(m -> m.getProject().getId()))
            .entrySet().stream()
            .map(entry -> {
                var metrics = entry.getValue();
                double totalCost = metrics.stream()
                    .mapToDouble(m -> m.getCapexAmount().doubleValue() + m.getOpexAmount().doubleValue())
                    .sum();
                double totalValue = metrics.stream()
                    .mapToDouble(m -> m.getProjectedValue().doubleValue())
                    .sum();
                double roi = totalCost == 0 ? 0 : (totalValue - totalCost) / totalCost * 100;
                return Map.<String, Object>of(
                    "projectId", entry.getKey(),
                    "projectName", metrics.get(0).getProject().getName(),
                    "totalCost", totalCost,
                    "totalValue", totalValue,
                    "roiPercent", Math.round(roi * 100.0) / 100.0
                );
            })
            .toList();
    }
}
