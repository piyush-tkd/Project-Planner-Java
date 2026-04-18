package com.portfolioplanner.controller;

import com.portfolioplanner.service.AiImpactService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Provides AI impact analytics for the Engineering Intelligence dashboard.
 * All data is served from the ai_impact_metric table (seeded by V88 migration).
 */
@RestController
@RequestMapping("/api/reports/ai-impact")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AiImpactController {

    private final AiImpactService service;

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
        return ResponseEntity.ok(service.getSummary());
    }

    // ── GET /api/reports/ai-impact/trend?type=velocity_delta ──────────────────
    /**
     * Returns time-series data grouped by period, with one entry per pod.
     * Used for the trend line chart.
     */
    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> trend(
            @RequestParam(defaultValue = "velocity_delta") String type) {
        return ResponseEntity.ok(service.getTrend(type));
    }

    // ── GET /api/reports/ai-impact/pods ───────────────────────────────────────
    /** Returns distinct pod names that have data. */
    @GetMapping("/pods")
    public ResponseEntity<List<String>> pods() {
        return ResponseEntity.ok(service.getPodNames());
    }
}
