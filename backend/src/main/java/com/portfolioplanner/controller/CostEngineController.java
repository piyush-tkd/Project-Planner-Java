package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.ProjectValueMetric;
import com.portfolioplanner.domain.model.ResourceCostRate;
import com.portfolioplanner.service.CostEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cost-engine")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CostEngineController {

    private final CostEngineService service;

    // ── Resource Cost Rates ──────────────────────────────────────────────────

    @GetMapping("/rates")
    public List<ResourceCostRate> getAllRates() {
        return service.getAllRates();
    }

    @GetMapping("/rates/resource/{resourceId}")
    public List<ResourceCostRate> getRatesByResource(@PathVariable Long resourceId) {
        return service.getRatesByResource(resourceId);
    }

    @PostMapping("/rates")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResourceCostRate createRate(@RequestBody ResourceCostRate rate) {
        return service.createRate(rate);
    }

    @PutMapping("/rates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ResourceCostRate> updateRate(@PathVariable Long id,
                                                        @RequestBody ResourceCostRate updated) {
        return service.updateRate(id, updated)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/rates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> deleteRate(@PathVariable Long id) {
        if (!service.deleteRate(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.noContent().build();
    }

    // ── Project Value Metrics ───────────────────────────────────────────────

    @GetMapping("/metrics")
    public List<ProjectValueMetric> getAllMetrics() {
        return service.getAllMetrics();
    }

    @GetMapping("/metrics/project/{projectId}")
    public List<ProjectValueMetric> getMetricsByProject(@PathVariable Long projectId) {
        return service.getMetricsByProject(projectId);
    }

    @PostMapping("/metrics")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ProjectValueMetric createMetric(@RequestBody ProjectValueMetric metric) {
        return service.createMetric(metric);
    }

    @PutMapping("/metrics/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ProjectValueMetric> updateMetric(@PathVariable Long id,
                                                            @RequestBody ProjectValueMetric updated) {
        return service.updateMetric(id, updated)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/metrics/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> deleteMetric(@PathVariable Long id) {
        if (!service.deleteMetric(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.noContent().build();
    }

    // ── ROI Summary ─────────────────────────────────────────────────────────

    @GetMapping("/roi-summary")
    public List<Map<String, Object>> getRoiSummary() {
        return service.getRoiSummary();
    }
}
