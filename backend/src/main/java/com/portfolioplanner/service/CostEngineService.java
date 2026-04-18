package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ProjectValueMetric;
import com.portfolioplanner.domain.model.ResourceCostRate;
import com.portfolioplanner.domain.repository.ProjectValueMetricRepository;
import com.portfolioplanner.domain.repository.ResourceCostRateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CostEngineService {

    private final ResourceCostRateRepository costRateRepository;
    private final ProjectValueMetricRepository projectValueMetricRepository;

    // ── Resource Cost Rates ──────────────────────────────────────────────────

    public List<ResourceCostRate> getAllRates() {
        return costRateRepository.findAll();
    }

    public List<ResourceCostRate> getRatesByResource(Long resourceId) {
        return costRateRepository.findByResourceId(resourceId);
    }

    @Transactional
    public ResourceCostRate createRate(ResourceCostRate rate) {
        return costRateRepository.save(rate);
    }

    @Transactional
    public Optional<ResourceCostRate> updateRate(Long id, ResourceCostRate updated) {
        return costRateRepository.findById(id).map(existing -> {
            existing.setRateType(updated.getRateType());
            existing.setAmount(updated.getAmount());
            existing.setCurrency(updated.getCurrency());
            existing.setEffectiveFrom(updated.getEffectiveFrom());
            existing.setEffectiveTo(updated.getEffectiveTo());
            return costRateRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteRate(Long id) {
        if (!costRateRepository.existsById(id)) return false;
        costRateRepository.deleteById(id);
        return true;
    }

    // ── Project Value Metrics ───────────────────────────────────────────────

    public List<ProjectValueMetric> getAllMetrics() {
        return projectValueMetricRepository.findAll();
    }

    public List<ProjectValueMetric> getMetricsByProject(Long projectId) {
        return projectValueMetricRepository.findByProjectId(projectId);
    }

    @Transactional
    public ProjectValueMetric createMetric(ProjectValueMetric metric) {
        return projectValueMetricRepository.save(metric);
    }

    @Transactional
    public Optional<ProjectValueMetric> updateMetric(Long id, ProjectValueMetric updated) {
        return projectValueMetricRepository.findById(id).map(existing -> {
            existing.setMetricType(updated.getMetricType());
            existing.setProjectedValue(updated.getProjectedValue());
            existing.setActualValue(updated.getActualValue());
            existing.setCapexAmount(updated.getCapexAmount());
            existing.setOpexAmount(updated.getOpexAmount());
            existing.setMeasurementPeriod(updated.getMeasurementPeriod());
            existing.setNotes(updated.getNotes());
            return projectValueMetricRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteMetric(Long id) {
        if (!projectValueMetricRepository.existsById(id)) return false;
        projectValueMetricRepository.deleteById(id);
        return true;
    }

    // ── ROI Summary ─────────────────────────────────────────────────────────

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
