package com.portfolioplanner.controller;

import com.portfolioplanner.service.ProductivityMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.Map;

/**
 * Engineering Productivity Metrics Controller.
 *
 * Aggregates data from multiple existing sources to produce a single
 * executive-level productivity dashboard covering:
 *   1. Investment — total engineering spend, spend by POD/project
 *   2. Output    — projects delivered, throughput per sprint
 *   3. Efficiency — DORA metrics, cost-per-project, planned vs actual
 *   4. Impact    — priority distribution, project-by-status breakdown
 */
@RestController
@RequestMapping("/api/reports/productivity")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProductivityMetricsController {

    private final ProductivityMetricsService productivityMetricsService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getProductivityMetrics(
            @RequestParam(required = false) Integer months) {
        return ResponseEntity.ok(productivityMetricsService.getProductivityMetrics(months));
    }
}
